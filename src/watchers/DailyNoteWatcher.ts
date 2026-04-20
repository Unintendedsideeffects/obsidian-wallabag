import WallabagPlugin from 'main';
import { TFile } from 'obsidian';
import { getDailyNotesFolder } from 'watchers/dailyNotesFolder';

export class DailyNoteWatcher {
  private readonly debouncers = new Map<string, number>();

  constructor(private readonly plugin: WallabagPlugin) {}

  register(): void {
    this.plugin.registerEvent(
      this.plugin.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') {
          return;
        }
        if (!this.plugin.settings.watchers.dailyNotesHarvest.enabled) {
          return;
        }
        const folder = getDailyNotesFolder(this.plugin.app);
        if (!folder) {
          return;
        }
        const prefix = folder.endsWith('/') ? folder : `${folder}/`;
        if (!file.path.startsWith(prefix)) {
          return;
        }
        const prev = this.debouncers.get(file.path);
        if (prev !== undefined) {
          window.clearTimeout(prev);
        }
        const ms = Math.max(500, this.plugin.settings.push.pushDebounceMs);
        const id = window.setTimeout(() => {
          this.debouncers.delete(file.path);
          void this.runHarvest(file);
        }, ms);
        this.debouncers.set(file.path, id);
      })
    );
  }

  async runHarvest(file: TFile): Promise<void> {
    if (!this.plugin.authenticated) {
      return;
    }
    const body = await this.plugin.app.vault.cachedRead(file);
    const links = this.plugin.syncEngine.links.scan(body);
    for (const link of links) {
      const res = await this.plugin.syncEngine.pushNew(link.normalized, 'daily');
      if (res.ok && !res.dryRun) {
        await this.appendMarker(file, link.line);
      }
    }
  }

  private async appendMarker(file: TFile, lineIndex: number): Promise<void> {
    const body = await this.plugin.app.vault.cachedRead(file);
    const lines = body.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return;
    }
    const line = lines[lineIndex];
    if (line.includes('wallabag\'d') || line.includes('— wallabag')) {
      return;
    }
    lines[lineIndex] = `${line.trimEnd()} — wallabag'd`;
    await this.plugin.app.vault.modify(file, lines.join('\n'));
  }
}
