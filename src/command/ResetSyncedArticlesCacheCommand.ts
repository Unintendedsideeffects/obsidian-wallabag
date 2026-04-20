import WallabagPlugin from 'main';
import { Command, Notice } from 'obsidian';

export default class ClearSyncedArticlesCacheCommand implements Command {
  id = 'wallabag:clear-synced-cache';
  name = 'Wallabag: Clear synced-articles cache';

  private plugin: WallabagPlugin;
  private syncedFilePath: string;

  constructor(plugin: WallabagPlugin) {
    this.plugin = plugin;
    this.syncedFilePath = `${this.plugin.manifest.dir}/.synced`;
  }

  async callback() {
    if (await this.plugin.app.vault.adapter.exists(this.syncedFilePath)) {
      await this.plugin.app.vault.adapter.write(this.syncedFilePath, JSON.stringify([]));
    }
    new Notice('Synced articles cache cleared.');
  }
}
