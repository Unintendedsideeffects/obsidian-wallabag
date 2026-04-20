import WallabagPlugin from 'main';
import { Command, Notice } from 'obsidian';

export default class PushCurrentNoteCommand implements Command {
  id = 'wallabag:push-current-note';
  name = 'Wallabag: Push current note to server';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    if (!this.plugin.authenticated) {
      new Notice('Wallabag: authenticate first.');
      return;
    }
    const file = this.plugin.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Wallabag: open a note first.');
      return;
    }
    const fm = this.plugin.syncEngine.codec.readFromFile(file);
    if (fm?.wallabag_id && fm.wallabag_id > 0) {
      const r = await this.plugin.syncEngine.pushFrontmatter(file);
      if ('kind' in r) {
        new Notice(`Wallabag: skipped (${r.reason}).`);
      } else if (r.ok) {
        new Notice('Wallabag: note pushed.');
      } else {
        new Notice(`Wallabag: push failed ${r.message ?? ''}`);
      }
      return;
    }
    const body = await this.plugin.app.vault.cachedRead(file);
    const links = this.plugin.syncEngine.links.scan(body);
    const url = fm?.source_url ?? links[0]?.normalized;
    if (!url) {
      new Notice('Wallabag: no URL found in this note.');
      return;
    }
    const res = await this.plugin.syncEngine.pushNew(url, 'command', file);
    if (res.ok) {
      new Notice(res.dryRun ? 'Wallabag: dry-run only (enable remote writes).' : 'Wallabag: URL submitted.');
    } else {
      new Notice(`Wallabag: ${res.message ?? 'failed'}`);
    }
  }
}
