import WallabagPlugin from 'main';
import { Command, Notice } from 'obsidian';

export default class DumpStateCommand implements Command {
  id = 'wallabag:dump-state';
  name = 'Wallabag: Write state snapshot to disk';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    const path = `${this.plugin.manifest.dir}/.wallabag-debug.json`;
    const dedup = await this.plugin.syncEngine.dedup.dump();
    const payload = {
      authenticated: this.plugin.authenticated,
      settings: this.plugin.settings,
      dedup,
    };
    await this.plugin.app.vault.adapter.write(path, JSON.stringify(payload, null, 2));
    new Notice(`Wallabag: wrote ${path}`);
  }
}
