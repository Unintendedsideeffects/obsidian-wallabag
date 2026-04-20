import WallabagPlugin from 'main';
import { TFile } from 'obsidian';

export class ClipperBridge {
  constructor(private readonly plugin: WallabagPlugin) {}

  register(): void {
    this.plugin.registerEvent(
      this.plugin.app.vault.on('create', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') {
          return;
        }
        if (!this.plugin.settings.watchers.clipperBridge.enabled) {
          return;
        }
        window.setTimeout(() => void this.handle(file), 400);
      })
    );
  }

  private async handle(file: TFile): Promise<void> {
    const clipTag = this.plugin.settings.watchers.clipperBridge.clipperTag.trim();
    if (!clipTag) {
      return;
    }
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const rawTags = cache?.frontmatter?.tags;
    const tags: string[] = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === 'string')
      : typeof rawTags === 'string'
        ? rawTags.split(',').map((t) => t.trim())
        : [];
    if (!tags.includes(clipTag)) {
      return;
    }
    const rawId = cache?.frontmatter?.wallabag_id;
    const wid = typeof rawId === 'number' ? rawId : Number(rawId);
    if (!Number.isNaN(wid) && wid > 0) {
      return;
    }
    let source = typeof cache?.frontmatter?.source_url === 'string' ? cache.frontmatter.source_url : '';
    if (!source) {
      const body = await this.plugin.app.vault.cachedRead(file);
      const links = this.plugin.syncEngine.links.scan(body);
      source = links[0]?.normalized ?? '';
    }
    if (!source) {
      return;
    }
    await this.plugin.syncEngine.pushNew(source, 'clipper', file);
  }
}
