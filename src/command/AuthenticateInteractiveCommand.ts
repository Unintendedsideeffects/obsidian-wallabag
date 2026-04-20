import { Command, Notice } from 'obsidian';

export default class AuthenticateInteractiveCommand implements Command {
  id = 'wallabag:authenticate-interactive';
  name = 'Wallabag: Authenticate (interactive)';

  callback(): void {
    new Notice('Wallabag: open Settings → Community plugins → Wallabag, enter API credentials, then Authenticate.');
  }
}
