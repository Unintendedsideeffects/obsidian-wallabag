import WallabagPlugin from 'main';
import { App, Notice, PluginSettingTab, Setting, TextAreaComponent, sanitizeHTMLToDom } from 'obsidian';

export class WallabagSettingTab extends PluginSettingTab {
  private readonly plugin: WallabagPlugin;

  constructor(app: App, plugin: WallabagPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();

    containerEl.createEl('p', {
      text: `Headless-editable settings live at ${this.plugin.manifest.dir}/settings.json and are mirrored into Obsidian's data store.`,
    });

    containerEl.createEl('h2', { text: 'Server' });
    this.addText('Server URL', 'Base URL for the Wallabag instance.', settings.server.url, async (value) => {
      await this.plugin.saveSettings({ server: { url: value.trim() } });
    });
    this.addText('Client ID', 'OAuth client ID used for authentication.', settings.server.clientId, async (value) => {
      await this.plugin.saveSettings({ server: { clientId: value.trim() } });
    });
    this.addText('Client Secret', 'OAuth client secret used for authentication.', settings.server.clientSecret, async (value) => {
      await this.plugin.saveSettings({ server: { clientSecret: value.trim() } });
    }, true);

    containerEl.createEl('h2', { text: 'Authentication' });
    this.addText('Username', 'Optional for headless auth.', settings.auth.username, async (value) => {
      await this.plugin.saveSettings({ auth: { username: value } });
    });
    this.addText('Password', 'Optional for headless auth.', settings.auth.password, async (value) => {
      await this.plugin.saveSettings({ auth: { password: value } });
    }, true);
    this.addToggle('Store credentials', 'Keep username/password in settings.json after headless auth.', settings.auth.storeCredentials, async (value) => {
      await this.plugin.saveSettings({ auth: { storeCredentials: value } });
    });
    new Setting(containerEl)
      .setName('Session actions')
      .setDesc('Use stored credentials or clear the current token.')
      .addButton((button) =>
        button.setButtonText('Authenticate').setCta().onClick(async () => {
          await this.plugin.authenticateFromSettings();
        })
      )
      .addButton((button) =>
        button.setButtonText('Logout').setWarning().onClick(async () => {
          await this.plugin.onLogout();
          new Notice('Wallabag session cleared.');
        })
      );

    containerEl.createEl('h2', { text: 'Pull' });
    this.addToggle('Enable pull', 'Allow pull commands and timers to fetch Wallabag entries.', settings.pull.enabled, async (value) => {
      await this.plugin.saveSettings({ pull: { enabled: value } });
    });
    this.addText('Tag filter', 'Only fetch tagged Wallabag entries when set.', settings.pull.tagFilter, async (value) => {
      await this.plugin.saveSettings({ pull: { tagFilter: value.trim() } });
    });
    this.addToggle('Sync unread', 'Include unread items in pull results.', settings.pull.syncUnread, async (value) => {
      await this.plugin.saveSettings({ pull: { syncUnread: value } });
    });
    this.addToggle('Sync archived', 'Include archived items in pull results.', settings.pull.syncArchived, async (value) => {
      await this.plugin.saveSettings({ pull: { syncArchived: value } });
    });
    this.addToggle('Archive after sync', 'Archive pulled entries after a successful sync.', settings.pull.archiveAfterSync, async (value) => {
      await this.plugin.saveSettings({ pull: { archiveAfterSync: value } });
    });
    this.addToggle('Convert HTML to Markdown', 'Convert pulled HTML into markdown before templating.', settings.pull.convertHtmlToMarkdown, async (value) => {
      await this.plugin.saveSettings({ pull: { convertHtmlToMarkdown: value } });
    });
    this.addToggle('Download as PDF', 'Export each Wallabag entry as PDF.', settings.pull.downloadAsPDF, async (value) => {
      await this.plugin.saveSettings({ pull: { downloadAsPDF: value } });
      this.display();
    });
    this.addToggle('Create PDF note', 'Create a note alongside the exported PDF.', settings.pull.createPDFNote, async (value) => {
      await this.plugin.saveSettings({ pull: { createPDFNote: value } });
    });
    this.addToggle('Append ID to title', 'Add the Wallabag ID to generated note names.', settings.pull.idInTitle, async (value) => {
      await this.plugin.saveSettings({ pull: { idInTitle: value } });
    });
    this.addDropdown(
      'Tag format',
      sanitizeHTMLToDom('How `{{tags}}` is rendered in templates.'),
      settings.pull.tagFormat,
      [
        { value: 'csv', label: 'CSV' },
        { value: 'hashtag', label: 'Hashtags' },
      ],
      async (value) => {
        await this.plugin.saveSettings({ pull: { tagFormat: value as 'csv' | 'hashtag' } });
      }
    );

    containerEl.createEl('h2', { text: 'Push' });
    this.addToggle('Enable remote writes', 'Arms POST/PATCH/DELETE calls. Disabled means dry-run only.', settings.push.enableRemoteWrites, async (value) => {
      await this.plugin.saveSettings({ push: { enableRemoteWrites: value } });
    });
    this.addToggle('Push new content', 'Allow new URL detection to create Wallabag entries.', settings.push.pushNewContent, async (value) => {
      await this.plugin.saveSettings({ push: { pushNewContent: value } });
    });
    this.addToggle('Push frontmatter updates', 'Allow linked notes to PATCH read/starred/tags back to Wallabag.', settings.push.pushFrontmatterUpdates, async (value) => {
      await this.plugin.saveSettings({ push: { pushFrontmatterUpdates: value } });
    });
    this.addText('Push debounce (ms)', 'Debounce delay before watcher-driven pushes run.', String(settings.push.pushDebounceMs), async (value) => {
      await this.plugin.saveSettings({ push: { pushDebounceMs: Number(value) || settings.push.pushDebounceMs } });
    });
    this.addDropdown(
      'On local delete',
      'Choose whether note deletion propagates to Wallabag.',
      settings.push.onLocalDelete,
      [
        { value: 'ignore', label: 'Ignore' },
        { value: 'archive', label: 'Archive' },
        { value: 'delete', label: 'Delete' },
      ],
      async (value) => {
        await this.plugin.saveSettings({ push: { onLocalDelete: value as 'ignore' | 'archive' | 'delete' } });
      }
    );

    containerEl.createEl('h2', { text: 'Folders & template' });
    this.addText('Notes folder', 'Default folder for pulled article notes.', settings.folders.notes, async (value) => {
      await this.plugin.saveSettings({ folders: { notes: value.trim() } });
    });
    this.addText('Unread notes folder', 'Optional override for unread entries.', settings.folders.unreadNotes, async (value) => {
      await this.plugin.saveSettings({ folders: { unreadNotes: value.trim() } });
    });
    this.addText('Archived notes folder', 'Optional override for archived entries.', settings.folders.archivedNotes, async (value) => {
      await this.plugin.saveSettings({ folders: { archivedNotes: value.trim() } });
    });
    this.addText('PDF folder', 'Folder for exported PDFs.', settings.folders.pdfs, async (value) => {
      await this.plugin.saveSettings({ folders: { pdfs: value.trim() } });
    });
    this.addText('Attachments folder', 'Folder for locally downloaded images.', settings.folders.attachments, async (value) => {
      await this.plugin.saveSettings({ folders: { attachments: value.trim() } });
    });
    this.addText('Template path', 'Optional markdown template path.', settings.template.path, async (value) => {
      await this.plugin.saveSettings({ template: { path: value.trim() } });
    });
    this.addToggle('Emit full frontmatter', 'Prepend canonical Wallabag frontmatter to generated notes.', settings.template.emitFullFrontmatter, async (value) => {
      await this.plugin.saveSettings({ template: { emitFullFrontmatter: value } });
    });

    containerEl.createEl('h2', { text: 'Timer & watchers' });
    this.addToggle('Timer enabled', 'Run periodic pull on a timer.', settings.timer.enabled, async (value) => {
      await this.plugin.saveSettings({ timer: { enabled: value } });
    });
    this.addText('Interval minutes', 'Timer interval in minutes.', String(settings.timer.intervalMinutes), async (value) => {
      await this.plugin.saveSettings({ timer: { intervalMinutes: Number(value) || settings.timer.intervalMinutes } });
    });
    this.addToggle('Run bidirectional sync on startup', 'Kick off reconciliation when the plugin loads.', settings.timer.runOnStartup, async (value) => {
      await this.plugin.saveSettings({ timer: { runOnStartup: value } });
    });
    this.addToggle('Watch linked note edits', 'Watch vault changes for linked-note frontmatter updates.', settings.watchers.vaultFileWatcher, async (value) => {
      await this.plugin.saveSettings({ watchers: { vaultFileWatcher: value } });
    });
    this.addToggle('Daily notes harvest', 'Watch the core Daily Notes folder for new URLs.', settings.watchers.dailyNotesHarvest.enabled, async (value) => {
      await this.plugin.saveSettings({ watchers: { dailyNotesHarvest: { enabled: value } } });
    });
    this.addToggle('Daily notes submit unread', 'Create harvested entries as unread by default.', settings.watchers.dailyNotesHarvest.submitUnreadByDefault, async (value) => {
      await this.plugin.saveSettings({ watchers: { dailyNotesHarvest: { submitUnreadByDefault: value } } });
    });
    this.addTextArea('Daily-note tags', 'Comma-separated tags attached to harvested daily-note submissions.', settings.watchers.dailyNotesHarvest.tagOnSubmit.join(', '), async (value) => {
      await this.plugin.saveSettings({ watchers: { dailyNotesHarvest: { tagOnSubmit: this.parseTags(value) } } });
    });
    this.addToggle('Clipper bridge', 'Watch new notes tagged as clippings and submit them to Wallabag.', settings.watchers.clipperBridge.enabled, async (value) => {
      await this.plugin.saveSettings({ watchers: { clipperBridge: { enabled: value } } });
    });
    this.addText('Clipper tag', 'Tag used to detect Web Clipper notes.', settings.watchers.clipperBridge.clipperTag, async (value) => {
      await this.plugin.saveSettings({ watchers: { clipperBridge: { clipperTag: value.trim().replace(/^#/, '') } } });
    });
    this.addTextArea('Clipper tags on submit', 'Comma-separated tags added when a clipper note is pushed.', settings.watchers.clipperBridge.tagOnSubmit.join(', '), async (value) => {
      await this.plugin.saveSettings({ watchers: { clipperBridge: { tagOnSubmit: this.parseTags(value) } } });
    });

    containerEl.createEl('h2', { text: 'Attachments' });
    this.addToggle('Download attachments', 'Download article images into the vault.', settings.attachments.download, async (value) => {
      await this.plugin.saveSettings({ attachments: { download: value } });
    });
    this.addText('Max images per article', 'Cap attachment downloads per article.', String(settings.attachments.maxImagesPerArticle), async (value) => {
      await this.plugin.saveSettings({ attachments: { maxImagesPerArticle: Number(value) || settings.attachments.maxImagesPerArticle } });
    });
    this.addText('Max bytes per image', 'Skip images larger than this size.', String(settings.attachments.maxBytesPerImage), async (value) => {
      await this.plugin.saveSettings({ attachments: { maxBytesPerImage: Number(value) || settings.attachments.maxBytesPerImage } });
    });
    this.addToggle('Rewrite to wikilinks', 'Rewrite downloaded markdown images to `![[...]]`.', settings.attachments.rewriteToWikilinks, async (value) => {
      await this.plugin.saveSettings({ attachments: { rewriteToWikilinks: value } });
    });

    containerEl.createEl('h2', { text: 'Dry-run' });
    this.addToggle('Log dry-run mutations', 'Append intended remote writes to `.dry-run.log`.', settings.dryRun.logMutations, async (value) => {
      await this.plugin.saveSettings({ dryRun: { logMutations: value } });
    });
  }

  private addText(name: string, desc: string | DocumentFragment, value: string, onSave: (value: string) => Promise<void>, secret = false): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        text.setValue(value);
        if (secret) {
          text.inputEl.type = 'password';
        }
        text.onChange(async (next) => {
          await onSave(next);
        });
      });
  }

  private addTextArea(name: string, desc: string | DocumentFragment, value: string, onSave: (value: string) => Promise<void>): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addTextArea((text: TextAreaComponent) => {
        text.setValue(value).onChange(async (next) => {
          await onSave(next);
        });
      });
  }

  private addToggle(name: string, desc: string | DocumentFragment, value: boolean, onSave: (value: boolean) => Promise<void>): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) => {
        toggle.setValue(value).onChange(async (next) => {
          await onSave(next);
        });
      });
  }

  private addDropdown(
    name: string,
    desc: string | DocumentFragment,
    value: string,
    options: Array<{ value: string; label: string }>,
    onSave: (value: string) => Promise<void>
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addDropdown((dropdown) => {
        options.forEach((option) => dropdown.addOption(option.value, option.label));
        dropdown.setValue(value).onChange(async (next) => {
          await onSave(next);
        });
      });
  }

  private parseTags(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
