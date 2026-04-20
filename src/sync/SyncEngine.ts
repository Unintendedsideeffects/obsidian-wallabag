import { AttachmentManager } from 'attachments/AttachmentManager';
import { DedupCache } from 'sync/DedupCache';
import { LinkExtractor } from 'links/LinkExtractor';
import WallabagPlugin from 'main';
import { FrontmatterCodec, FrontmatterState, frontmatterIsLinked } from 'note/FrontmatterCodec';
import NoteTemplate, { DefaultTemplate, PDFTemplate } from 'note/NoteTemplate';
import { normalizePath, Notice, TFile } from 'obsidian';
import { PullResult, PushContext, PushResult, ReconcileResult, SkipResult } from 'sync/types';
import { WallabagArticle } from 'wallabag/WallabagAPI';

export class SyncEngine {
  readonly codec: FrontmatterCodec;
  readonly dedup: DedupCache;
  readonly attachments: AttachmentManager;
  readonly links = new LinkExtractor();
  private pullLock = false;

  constructor(private readonly plugin: WallabagPlugin) {
    this.codec = new FrontmatterCodec(plugin.app);
    this.dedup = new DedupCache(plugin);
    this.attachments = new AttachmentManager(plugin.app, () => plugin.settings, () => plugin.api ?? undefined);
  }

  private mergePullTags(tags: string[]): string[] {
    const cfg = this.plugin.settings.watchers.clipperBridge;
    if (!cfg.enabled) {
      return tags;
    }
    const clip = cfg.clipperTag.trim();
    if (!clip || tags.includes(clip)) {
      return tags;
    }
    return [...tags, clip];
  }

  private async ensureFolderForFile(path: string): Promise<void> {
    const parent = normalizePath(path.split('/').slice(0, -1).join('/'));
    if (!parent) {
      return;
    }
    const segments = parent.split('/');
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!(await this.plugin.app.vault.adapter.exists(current))) {
        await this.plugin.app.vault.createFolder(current);
      }
    }
  }

  private async getBodyTemplate(): Promise<NoteTemplate> {
    const path = this.plugin.settings.template.path.trim();
    if (!path) {
      return DefaultTemplate;
    }
    const raw = await this.plugin.app.vault.adapter.read(`${path}.md`);
    return new NoteTemplate(raw);
  }

  private async renderNote(article: WallabagArticle, bodyMarkdown: string, frontmatter: FrontmatterState): Promise<string> {
    const tpl = await this.getBodyTemplate();
    return tpl.fill(
      article,
      this.plugin.settings.server.url,
      bodyMarkdown,
      this.plugin.settings.pull.tagFormat,
      frontmatter,
      this.plugin.settings.template.emitFullFrontmatter
    );
  }

  async findFileByWallabagId(id: number): Promise<TFile | null> {
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      const st = this.codec.readFromFile(file);
      if (st?.wallabag_id === id) {
        return file;
      }
    }
    return null;
  }

  private getArticleFolder(article: WallabagArticle): string {
    const f = this.plugin.settings.folders;
    if (article.isArchived && f.archivedNotes.trim() !== '') {
      return f.archivedNotes;
    }
    if (!article.isArchived && f.unreadNotes.trim() !== '') {
      return f.unreadNotes;
    }
    return f.notes;
  }

  private sanitizeFilename(article: WallabagArticle): string {
    const base = article.title.replaceAll(/[\\,#%&{}/*<>$"@.?]/g, ' ').replaceAll(/[:|]/g, ' ');
    if (this.plugin.settings.pull.idInTitle) {
      return `${base}-${article.id}`;
    }
    return base;
  }

  private async logDry(line: string): Promise<void> {
    if (!this.plugin.settings.dryRun.logMutations) {
      return;
    }
    const path = `${this.plugin.manifest.dir}/.dry-run.log`;
    const stamp = new Date().toISOString();
    const entry = `[${stamp}] ${line}\n`;
    const prev = (await this.plugin.app.vault.adapter.exists(path)) ? await this.plugin.app.vault.adapter.read(path) : '';
    await this.plugin.app.vault.adapter.write(path, prev + entry);
  }

  async pull(): Promise<PullResult> {
    const result: PullResult = { created: 0, updated: 0, skipped: 0 };
    if (!this.plugin.settings.pull.enabled) {
      return result;
    }
    if (!this.plugin.authenticated || !this.plugin.api) {
      new Notice('Wallabag: authenticate before pull.');
      return result;
    }
    if (!this.plugin.settings.pull.syncUnread && !this.plugin.settings.pull.syncArchived) {
      new Notice('Wallabag: enable at least one of unread or archived pull.');
      return result;
    }
    if (this.pullLock) {
      return result;
    }
    this.pullLock = true;
    try {
      await this.dedup.prune();
      const articles = await this.plugin.api.fetchArticles(
        this.plugin.settings.pull.syncUnread,
        this.plugin.settings.pull.syncArchived
      );
      const attachmentsRoot = this.plugin.settings.folders.attachments;
      for (const article of articles) {
        try {
          const existing = await this.findFileByWallabagId(article.id);
          if (this.plugin.settings.pull.downloadAsPDF) {
            const folder = this.getArticleFolder(article);
            const pdfPath = normalizePath(`${this.plugin.settings.folders.pdfs}/${this.sanitizeFilename(article)}.pdf`);
            await this.ensureFolderForFile(pdfPath);
            const pdf = await this.plugin.api.exportArticle(article.id);
            await this.plugin.app.vault.adapter.writeBinary(pdfPath, pdf);
            if (this.plugin.settings.pull.createPDFNote) {
              const tpl = this.plugin.settings.template.path.trim() === '' ? PDFTemplate : await this.getBodyTemplate();
              const fm = this.codec.fromArticle(article, this.plugin.settings.server.url);
              fm.tags = this.mergePullTags(fm.tags);
              const notePath = normalizePath(`${folder}/${this.sanitizeFilename(article)}.md`);
              await this.ensureFolderForFile(notePath);
              const pdfLink = pdfPath.split('/').pop() ?? pdfPath;
              const body = tpl.fill(
                article,
                this.plugin.settings.server.url,
                '',
                this.plugin.settings.pull.tagFormat,
                fm,
                this.plugin.settings.template.emitFullFrontmatter,
                pdfLink
              );
              if (existing) {
                await this.plugin.app.vault.modify(existing, body);
                result.updated++;
              } else {
                await this.plugin.app.vault.create(notePath, body);
                result.created++;
              }
            }
          } else {
            const processed = await this.attachments.processArticle(article, attachmentsRoot);
            const fm = this.codec.fromArticle(article, this.plugin.settings.server.url);
            fm.tags = this.mergePullTags(fm.tags);
            fm.wallabag_last_synced = article.updatedAt;
            const body = await this.renderNote(article, processed.markdown, fm);
            const folder = this.getArticleFolder(article);
            const notePath = normalizePath(`${folder}/${this.sanitizeFilename(article)}.md`);
            if (existing) {
              await this.plugin.app.vault.modify(existing, body);
              result.updated++;
            } else {
              await this.ensureFolderForFile(notePath);
              await this.plugin.app.vault.create(notePath, body);
              result.created++;
            }
          }
          if (this.plugin.settings.pull.archiveAfterSync) {
            if (this.plugin.settings.push.enableRemoteWrites) {
              await this.plugin.api.archiveArticle(article.id);
            } else {
              await this.logDry(`WOULD PATCH archive /api/entries/${article.id}`);
            }
          }
        } catch (e) {
          console.error(`Wallabag pull failed for article ${article.id}`, e);
          result.skipped++;
        }
      }
    } finally {
      this.pullLock = false;
    }
    return result;
  }

  private resolveTagsForContext(ctx: PushContext): string[] {
    const s = this.plugin.settings;
    if (ctx === 'daily') {
      return [...s.watchers.dailyNotesHarvest.tagOnSubmit];
    }
    if (ctx === 'clipper') {
      return [...s.watchers.clipperBridge.tagOnSubmit];
    }
    return [];
  }

  async pushNew(url: string, ctx: PushContext, sourceFile?: TFile): Promise<PushResult> {
    if (!this.plugin.settings.push.pushNewContent) {
      return { ok: false, message: 'push new disabled' };
    }
    if (!this.plugin.authenticated || !this.plugin.api) {
      return { ok: false, message: 'not authenticated' };
    }
    const normalized = this.links.normalize(url);
    if (await this.dedup.has(normalized)) {
      return { ok: false, message: 'duplicate url' };
    }
    const tags = this.resolveTagsForContext(ctx);
    if (!this.plugin.settings.push.enableRemoteWrites) {
      await this.logDry(`POST /api/entries.json url=${normalized} tags=${tags.join(',')}`);
      return { ok: true, dryRun: true, wallabag_id: 0 };
    }
    try {
      const created = await this.plugin.api.createEntry(normalized, tags);
      await this.dedup.mark(normalized, created.id);
      if (sourceFile && ctx === 'clipper') {
        await this.codec.writeToFile(sourceFile, { wallabag_id: created.id, wallabag_url: `${this.plugin.settings.server.url}/view/${created.id}` });
      }
      return { ok: true, wallabag_id: created.id };
    } catch (e) {
      console.error('Wallabag pushNew failed', e);
      return { ok: false, message: String(e) };
    }
  }

  private isConflict(remoteUpdatedAt: string, wallabagLastSynced?: string): boolean {
    if (!wallabagLastSynced) {
      return false;
    }
    return remoteUpdatedAt > wallabagLastSynced;
  }

  async pushFrontmatter(file: TFile): Promise<PushResult | SkipResult> {
    const s = this.plugin.settings;
    if (!this.plugin.authenticated || !this.plugin.api) {
      return { kind: 'skip', reason: 'not authenticated' };
    }
    if (!s.push.pushFrontmatterUpdates) {
      return { kind: 'skip', reason: 'push frontmatter disabled' };
    }
    const current = this.codec.readFromFile(file);
    if (!current || !frontmatterIsLinked(current)) {
      return { kind: 'skip', reason: 'not linked' };
    }
    let remoteArticle: WallabagArticle;
    try {
      remoteArticle = await this.plugin.api.fetchEntry(current.wallabag_id);
    } catch (e) {
      console.error('fetchEntry failed', e);
      return { kind: 'skip', reason: 'fetch failed' };
    }
    const remoteFm = this.codec.fromArticle(remoteArticle, s.server.url);
    const patch = this.codec.toPatch(current, remoteFm);
    if (!patch) {
      return { kind: 'skip', reason: 'no diff' };
    }
    if (this.isConflict(remoteArticle.updatedAt, current.wallabag_last_synced)) {
      new Notice(`Wallabag: conflict on ${file.basename} — run pull or resolve timestamps.`);
      return { kind: 'skip', reason: 'conflict' };
    }
    if (!s.push.enableRemoteWrites) {
      await this.logDry(`WOULD PATCH /api/entries/${current.wallabag_id} ${JSON.stringify(patch)}`);
      return { ok: true, dryRun: true };
    }
    try {
      const updated = await this.plugin.api.patchEntry(current.wallabag_id, patch);
      await this.codec.writeToFile(file, { wallabag_last_synced: updated.updatedAt });
      return { ok: true };
    } catch (e) {
      console.error('patchEntry failed', e);
      return { ok: false, message: String(e) };
    }
  }

  async pushNewSweep(): Promise<{ attempted: number; created: number }> {
    let attempted = 0;
    let created = 0;
    if (!this.plugin.settings.push.pushNewContent) {
      return { attempted, created };
    }
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      const fm = this.codec.readFromFile(file);
      if (!fm || fm.wallabag_id) {
        continue;
      }
      const clip = this.plugin.settings.watchers.clipperBridge.clipperTag;
      const tagged = fm.tags.some((t) => t === clip);
      const hasSource = Boolean(fm.source_url);
      if (!tagged && !hasSource) {
        continue;
      }
      const urls: string[] = [];
      if (fm.source_url) {
        urls.push(fm.source_url);
      }
      const body = await this.plugin.app.vault.cachedRead(file);
      for (const link of this.links.scan(body)) {
        urls.push(link.normalized);
      }
      const seen = new Set<string>();
      for (const u of urls) {
        if (seen.has(u)) {
          continue;
        }
        seen.add(u);
        attempted++;
        const res = await this.pushNew(u, tagged ? 'clipper' : 'vault', file);
        if (res.ok && res.wallabag_id && !res.dryRun) {
          created++;
        }
      }
    }
    return { attempted, created };
  }

  async pushAllLinkedFrontmatter(): Promise<{ ok: number; skipped: number; conflicts: number }> {
    let ok = 0;
    let skipped = 0;
    let conflicts = 0;
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      const fm = this.codec.readFromFile(file);
      if (!fm || !frontmatterIsLinked(fm)) {
        continue;
      }
      const r = await this.pushFrontmatter(file);
      if ('kind' in r) {
        skipped++;
        if (r.reason === 'conflict') {
          conflicts++;
        }
      } else if (r.ok) {
        ok++;
      } else {
        skipped++;
      }
    }
    return { ok, skipped, conflicts };
  }

  async reconcileAll(): Promise<ReconcileResult> {
    const pull = await this.pull();
    const pushNew = await this.pushNewSweep();
    const pushFrontmatter = await this.pushAllLinkedFrontmatter();
    return {
      pull,
      pushNew,
      pushFrontmatter,
    };
  }

  async deleteServerEntryById(wallabagId: number): Promise<void> {
    if (!this.plugin.api) {
      return;
    }
    const mode = this.plugin.settings.push.onLocalDelete;
    if (mode === 'ignore') {
      return;
    }
    if (!this.plugin.settings.push.enableRemoteWrites) {
      await this.logDry(`WOULD ${mode} /api/entries/${wallabagId}`);
      return;
    }
    if (mode === 'delete') {
      await this.plugin.api.deleteEntry(wallabagId);
    } else if (mode === 'archive') {
      await this.plugin.api.patchEntry(wallabagId, { archive: 1 });
    }
  }
}
