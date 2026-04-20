import WallabagPlugin from 'main';
import { Command, Notice } from 'obsidian';

export default class LogoutCommand implements Command {
  id = 'wallabag:logout';
  name = 'Wallabag: Logout';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    await this.plugin.onLogout();
    new Notice('Wallabag: logged out.');
  }
}
