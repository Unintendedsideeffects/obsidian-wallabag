import WallabagPlugin from 'main';
import { Command, Notice, sanitizeHTMLToDom } from 'obsidian';

export default class SyncPullCommand implements Command {
  id = 'wallabag:sync-pull';
  name = 'Wallabag: Pull articles from server';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    if (!this.plugin.authenticated) {
      new Notice('Wallabag: authenticate first.');
      return;
    }
    const n = new Notice('Wallabag: pulling…');
    const result = await this.plugin.syncEngine.pull();
    n.hide();
    new Notice(
      sanitizeHTMLToDom(
        `Wallabag pull done.<br>Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}.`
      )
    );
  }
}
