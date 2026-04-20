import WallabagPlugin from 'main';
import { Command, Notice, sanitizeHTMLToDom } from 'obsidian';

export default class SyncPushFrontmatterCommand implements Command {
  id = 'wallabag:sync-push-frontmatter';
  name = 'Wallabag: Push frontmatter state to server';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    if (!this.plugin.authenticated) {
      new Notice('Wallabag: authenticate first.');
      return;
    }
    const n = new Notice('Wallabag: pushing frontmatter…');
    const result = await this.plugin.syncEngine.pushAllLinkedFrontmatter();
    n.hide();
    new Notice(
      sanitizeHTMLToDom(
        `Wallabag push-frontmatter done.<br>Pushed ${result.ok}, skipped ${result.skipped}, conflicts ${result.conflicts}.`
      )
    );
  }
}
