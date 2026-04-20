import WallabagPlugin from 'main';
import { Command, Notice, sanitizeHTMLToDom } from 'obsidian';

export default class SyncPushNewCommand implements Command {
  id = 'wallabag:sync-push-new';
  name = 'Wallabag: Push new content to server';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    if (!this.plugin.authenticated) {
      new Notice('Wallabag: authenticate first.');
      return;
    }
    const n = new Notice('Wallabag: scanning for new URLs…');
    const result = await this.plugin.syncEngine.pushNewSweep();
    n.hide();
    new Notice(
      sanitizeHTMLToDom(
        `Wallabag push-new done.<br>Attempted ${result.attempted}, created ${result.created}.`
      )
    );
  }
}
