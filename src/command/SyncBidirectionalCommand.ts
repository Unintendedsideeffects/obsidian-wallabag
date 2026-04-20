import WallabagPlugin from 'main';
import { Command, Notice, sanitizeHTMLToDom } from 'obsidian';

export default class SyncBidirectionalCommand implements Command {
  id = 'wallabag:sync-bidirectional';
  name = 'Wallabag: Full bidirectional sync';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    if (!this.plugin.authenticated) {
      new Notice('Wallabag: authenticate first.');
      return;
    }
    const n = new Notice('Wallabag: full sync…');
    const r = await this.plugin.syncEngine.reconcileAll();
    n.hide();
    new Notice(
      sanitizeHTMLToDom(
        `Wallabag sync complete.<br>Pull: +${r.pull.created} ~${r.pull.updated} skipped ${r.pull.skipped}.<br>` +
          `Push new: ${r.pushNew.created}/${r.pushNew.attempted}.<br>` +
          `Push FM: ${r.pushFrontmatter.ok} ok, ${r.pushFrontmatter.conflicts} conflicts.`
      )
    );
  }
}
