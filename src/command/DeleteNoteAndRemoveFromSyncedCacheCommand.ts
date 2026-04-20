import WallabagPlugin from 'main';
import { Command, Notice, parseFrontMatterEntry, TFile } from 'obsidian';

export default class DeleteNoteAndRemoveFromSyncedCacheCommand implements Command {
  id = 'wallabag:delete-and-forget';
  name = 'Wallabag: Delete note and remove from synced cache';

  private plugin: WallabagPlugin;
  private syncedFilePath: string;

  constructor(plugin: WallabagPlugin) {
    this.plugin = plugin;
    this.syncedFilePath = `${this.plugin.manifest.dir}/.synced`;
  }

  async callback() {
    const currentNote = this.plugin.app.workspace.getActiveFile();
    if (currentNote instanceof TFile) {
      const cmeta = this.plugin.app.metadataCache.getFileCache(currentNote);
      let wallabag_id = parseFrontMatterEntry(cmeta?.frontmatter, 'wallabag_id');
      if (wallabag_id === null) {
        new Notice('Error: Wallabag ID not found in frontmatter. Please see plugin docs.');
        return;
      }
      wallabag_id = Number(wallabag_id);
      if (isNaN(wallabag_id) || wallabag_id === 0) {
        new Notice('Error: Wallabag ID frontmatter doesn\'t seem to be a valid number.');
        return;
      }

      await this.plugin.syncEngine.deleteServerEntryById(wallabag_id);

      if (await this.plugin.app.vault.adapter.exists(this.syncedFilePath)) {
        const syncedIds = await this.plugin.app.vault.adapter.read(this.syncedFilePath).then(JSON.parse as (text: string) => number[]);
        await this.plugin.app.vault.adapter.write(this.syncedFilePath, JSON.stringify(syncedIds.filter((item) => item !== wallabag_id)));
      }
      await this.plugin.app.vault.trash(currentNote, false);
      new Notice('Note is moved to trash and removed from synced articles cache.');
    } else {
      new Notice('Error: Current item is not a note.');
    }
  }
}
