import DeleteNoteAndRemoveFromSyncedCacheCommand from 'command/DeleteNoteAndRemoveFromSyncedCacheCommand';
import AuthenticateHeadlessCommand from 'command/AuthenticateHeadlessCommand';
import AuthenticateInteractiveCommand from 'command/AuthenticateInteractiveCommand';
import DumpStateCommand from 'command/DumpStateCommand';
import HarvestDailyNotesCommand from 'command/HarvestDailyNotesCommand';
import LogoutCommand from 'command/LogoutCommand';
import PushCurrentNoteCommand from 'command/PushCurrentNoteCommand';
import ClearSyncedArticlesCacheCommand from 'command/ResetSyncedArticlesCacheCommand';
import SyncBidirectionalCommand from 'command/SyncBidirectionalCommand';
import SyncPullCommand from 'command/SyncPullCommand';
import SyncPushFrontmatterCommand from 'command/SyncPushFrontmatterCommand';
import SyncPushNewCommand from 'command/SyncPushNewCommand';
import { ConfigStore } from 'config/ConfigStore';
import { WallabagDeepPartial, WallabagSettings } from 'config/types';
import { Notice, Plugin, TFile } from 'obsidian';
import { WallabagSettingTab } from 'settings/WallabagSettingTab';
import { SyncEngine } from 'sync/SyncEngine';
import { ClipperBridge } from 'watchers/ClipperBridge';
import { DailyNoteWatcher } from 'watchers/DailyNoteWatcher';
import { TimerWatcher } from 'watchers/TimerWatcher';
import { VaultFileWatcher } from 'watchers/VaultFileWatcher';
import WallabagAPI from 'wallabag/WallabagAPI';
import { loadTokenFromVault, removeTokenFromVault, storeTokenToVault, Token } from 'wallabag/WallabagAuth';

export default class WallabagPlugin extends Plugin {
  settings!: WallabagSettings;
  configStore!: ConfigStore;
  syncEngine!: SyncEngine;
  api: WallabagAPI | null = null;
  authenticated = false;
  dailyNoteWatcher!: DailyNoteWatcher;
  private timerWatcher!: TimerWatcher;

  override async onload(): Promise<void> {
    this.configStore = new ConfigStore(this);
    this.settings = await this.configStore.load();
    await this.loadToken();
    this.syncEngine = new SyncEngine(this);
    this.dailyNoteWatcher = new DailyNoteWatcher(this);
    this.timerWatcher = new TimerWatcher(this);

    this.timerWatcher.start();
    new VaultFileWatcher(this).register();
    this.dailyNoteWatcher.register();
    new ClipperBridge(this).register();

    this.addSettingTab(new WallabagSettingTab(this.app, this));
    this.registerCommands();

    this.addRibbonIcon('sheets-in-box', 'Pull Wallabag articles', () => {
      void this.syncEngine.pull();
    });

    this.configStore.onChange((next) => {
      this.settings = next;
      this.timerWatcher.start();
    });

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') {
          return;
        }
        const cache = this.app.metadataCache.getFileCache(file);
        const raw = cache?.frontmatter?.wallabag_id;
        const id = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isNaN(id) || id <= 0) {
          return;
        }
        void this.syncEngine.deleteServerEntryById(id);
      })
    );

    if (this.settings.timer.runOnStartup) {
      void this.syncEngine.reconcileAll();
    }
  }

  override onunload(): void {
    this.configStore.unload();
    this.timerWatcher.stop();
  }

  async saveSettings(patch: WallabagDeepPartial<WallabagSettings>): Promise<void> {
    this.settings = await this.configStore.save(patch);
  }

  async loadToken(): Promise<void> {
    const token = await loadTokenFromVault(this);
    if (token) {
      this.api = new WallabagAPI(token, this);
      this.authenticated = true;
      return;
    }
    this.api = null;
    this.authenticated = false;
  }

  async authenticateFromSettings(): Promise<void> {
    const { server, auth } = this.settings;
    if (!server.url || !server.clientId || !server.clientSecret || !auth.username || !auth.password) {
      new Notice('Fill server URL, OAuth client id/secret, and username/password.');
      return;
    }
    try {
      const token = await WallabagAPI.authenticate(server.url, server.clientId, server.clientSecret, auth.username, auth.password);
      await this.storeToken(token);
      if (!this.settings.auth.storeCredentials) {
        await this.saveSettings({
          auth: {
            username: '',
            password: '',
            storeCredentials: false,
          },
        });
      }
      new Notice('Authenticated with Wallabag.');
    } catch (error) {
      console.error(error);
      new Notice('Authentication with Wallabag failed.');
    }
  }

  async onLogout(): Promise<void> {
    await removeTokenFromVault(this);
    this.authenticated = false;
    this.api = null;
  }

  async onAuthenticated(token: Token): Promise<void> {
    await this.storeToken(token);
  }

  async onTokenRefreshFailed(): Promise<void> {
    await this.onLogout();
    new Notice('Authentication refresh has failed. Please authenticate again.');
  }

  private async storeToken(token: Token): Promise<void> {
    await storeTokenToVault(this, token);
    this.api = new WallabagAPI(token, this);
    this.authenticated = true;
  }

  private registerCommands(): void {
    [
      new SyncPullCommand(this),
      new SyncPushNewCommand(this),
      new SyncPushFrontmatterCommand(this),
      new SyncBidirectionalCommand(this),
      new PushCurrentNoteCommand(this),
      new HarvestDailyNotesCommand(this, this.dailyNoteWatcher),
      new AuthenticateInteractiveCommand(),
      new AuthenticateHeadlessCommand(this),
      new LogoutCommand(this),
      new ClearSyncedArticlesCacheCommand(this),
      new DeleteNoteAndRemoveFromSyncedCacheCommand(this),
      new DumpStateCommand(this),
    ].forEach((command) => this.addCommand(command));
  }
}
