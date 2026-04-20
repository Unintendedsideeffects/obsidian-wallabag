import WallabagPlugin from 'main';
import { TFile } from 'obsidian';

export class VaultFileWatcher {
  private readonly debouncers = new Map<string, number>();

  constructor(private readonly plugin: WallabagPlugin) {}

  register(): void {
    this.plugin.registerEvent(
      this.plugin.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') {
          return;
        }
        if (!this.plugin.settings.watchers.vaultFileWatcher) {
          return;
        }
        const prev = this.debouncers.get(file.path);
        if (prev !== undefined) {
          window.clearTimeout(prev);
        }
        const ms = Math.max(500, this.plugin.settings.push.pushDebounceMs);
        const id = window.setTimeout(() => {
          this.debouncers.delete(file.path);
          void this.plugin.syncEngine.pushFrontmatter(file);
        }, ms);
        this.debouncers.set(file.path, id);
      })
    );
  }
}
