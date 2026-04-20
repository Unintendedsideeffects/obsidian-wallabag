import WallabagPlugin from 'main';
import { Command, Notice } from 'obsidian';
import WallabagAPI from 'wallabag/WallabagAPI';

export default class AuthenticateHeadlessCommand implements Command {
  id = 'wallabag:authenticate-headless';
  name = 'Wallabag: Authenticate (from settings.json)';

  constructor(private readonly plugin: WallabagPlugin) {}

  async callback(): Promise<void> {
    const { server, auth } = this.plugin.settings;
    if (!server.url || !server.clientId || !server.clientSecret || !auth.username || !auth.password) {
      new Notice('Wallabag: fill server URL, client id/secret, and credentials in settings.');
      return;
    }
    const n = new Notice('Wallabag: authenticating…');
    try {
      const token = await WallabagAPI.authenticate(
        server.url,
        server.clientId,
        server.clientSecret,
        auth.username,
        auth.password
      );
      await this.plugin.onAuthenticated(token);
      if (!auth.storeCredentials) {
        await this.plugin.saveSettings({
          auth: {
            username: '',
            password: '',
            storeCredentials: false,
          },
        });
      }
      n.hide();
      new Notice('Wallabag: authenticated.');
    } catch (e) {
      console.error(e);
      n.hide();
      new Notice('Wallabag: authentication failed.');
    }
  }
}
