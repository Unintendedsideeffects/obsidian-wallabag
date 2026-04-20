import WallabagPlugin from 'main';
import { Command, Notice } from 'obsidian';
import { DailyNoteWatcher } from 'watchers/DailyNoteWatcher';
import { getDailyNotesFolder } from 'watchers/dailyNotesFolder';

export default class HarvestDailyNotesCommand implements Command {
  id = 'wallabag:harvest-daily-notes';
  name = 'Wallabag: Harvest URLs from daily notes';

  constructor(
    private readonly plugin: WallabagPlugin,
    private readonly daily: DailyNoteWatcher
  ) {}

  async callback(): Promise<void> {
    if (!this.plugin.authenticated) {
      new Notice('Wallabag: authenticate first.');
      return;
    }
    const folder = getDailyNotesFolder(this.plugin.app);
    if (!folder) {
      new Notice('Wallabag: Daily Notes core plugin is disabled or has no folder.');
      return;
    }
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;
    const n = new Notice('Wallabag: harvesting daily notes…');
    for (const file of this.plugin.app.vault.getMarkdownFiles()) {
      if (file.path.startsWith(prefix)) {
        await this.daily.runHarvest(file);
      }
    }
    n.hide();
    new Notice('Wallabag: daily harvest finished.');
  }
}
