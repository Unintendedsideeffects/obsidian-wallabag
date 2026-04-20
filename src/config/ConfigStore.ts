import { migrateV0FlatToV1, isV0Shape } from 'config/migrations/v0-to-v1';
import { cloneSettings, DEFAULT_SETTINGS, WallabagDeepPartial, WallabagSettings } from 'config/types';
import { Notice, Plugin } from 'obsidian';

export type Unsubscribe = () => void;

function deepMerge<T extends WallabagSettings>(base: T, patch: WallabagDeepPartial<T>): T {
  const out = cloneSettings(base) as T;
  for (const key of Object.keys(patch) as (keyof WallabagDeepPartial<T>)[]) {
    const pv = patch[key];
    if (pv === undefined) {continue;}
    const bk = key as keyof T;
    const bv = base[bk];
    if (
      pv !== null &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      (out as Record<string, unknown>)[bk as string] = deepMerge(
        bv as unknown as WallabagSettings,
        pv as WallabagDeepPartial<WallabagSettings>
      ) as unknown as T[keyof T];
    } else {
      (out as Record<string, unknown>)[bk as string] = pv as T[keyof T];
    }
  }
  return out;
}

export class ConfigStore {
  private currentSettings: WallabagSettings = cloneSettings(DEFAULT_SETTINGS);
  private handlers: Set<(s: WallabagSettings) => void> = new Set();
  private pollTimer: number | undefined;
  private lastMtime = 0;
  private settingsPath: string;

  constructor(private plugin: Plugin) {
    this.settingsPath = `${this.plugin.manifest.dir}/settings.json`;
  }

  current(): Readonly<WallabagSettings> {
    return this.currentSettings;
  }

  onChange(handler: (next: WallabagSettings) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(next: WallabagSettings): void {
    this.handlers.forEach((h) => {
      try {
        h(next);
      } catch (e) {
        console.error('ConfigStore onChange handler failed', e);
      }
    });
  }

  async load(): Promise<WallabagSettings> {
    const adapter = this.plugin.app.vault.adapter;
    let loaded: WallabagSettings | null = null;
    try {
      if (await adapter.exists(this.settingsPath)) {
        const raw = await adapter.read(this.settingsPath);
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        loaded = this.normalizeLoaded(parsed);
        try {
          const st = await adapter.stat(this.settingsPath);
          this.lastMtime = st ? st.mtime : Date.now();
        } catch {
          this.lastMtime = Date.now();
        }
      }
    } catch (e) {
      console.error('Failed reading settings.json', e);
      new Notice('Wallabag: invalid settings.json — check the console.');
    }

    if (!loaded) {
      const data = (await this.plugin.loadData()) as Record<string, unknown> | null;
      const obj = data && typeof data === 'object' ? data : {};
      if (isV0Shape(obj)) {
        loaded = migrateV0FlatToV1(obj);
      } else if (typeof obj.$schemaVersion === 'number') {
        loaded = cloneSettings({ ...DEFAULT_SETTINGS, ...obj } as WallabagSettings);
      } else {
        loaded = cloneSettings(DEFAULT_SETTINGS);
      }
    }

    this.currentSettings = loaded;
    await this.persistToDisk(this.currentSettings);
    this.startPolling();
    return this.currentSettings;
  }

  private normalizeLoaded(parsed: Record<string, unknown>): WallabagSettings {
    if (isV0Shape(parsed)) {
      return migrateV0FlatToV1(parsed);
    }
    return cloneSettings({ ...DEFAULT_SETTINGS, ...parsed } as WallabagSettings);
  }

  async save(patch: WallabagDeepPartial<WallabagSettings>): Promise<WallabagSettings> {
    this.currentSettings = deepMerge(this.currentSettings, patch);
    await this.persistToDisk(this.currentSettings);
    this.emit(this.currentSettings);
    return this.currentSettings;
  }

  async replaceAll(next: WallabagSettings): Promise<void> {
    this.currentSettings = cloneSettings(next);
    await this.persistToDisk(this.currentSettings);
    this.emit(this.currentSettings);
  }

  private async persistToDisk(settings: WallabagSettings): Promise<void> {
    const json = JSON.stringify(settings, null, 2);
    await this.plugin.saveData(settings);
    await this.plugin.app.vault.adapter.write(this.settingsPath, json);
    try {
      const st = await this.plugin.app.vault.adapter.stat(this.settingsPath);
      this.lastMtime = st ? st.mtime : Date.now();
    } catch {
      this.lastMtime = Date.now();
    }
  }

  private startPolling(): void {
    if (this.pollTimer !== undefined) {
      window.clearInterval(this.pollTimer);
    }
    this.pollTimer = window.setInterval(() => void this.pollExternalEdit(), 5000);
  }

  unload(): void {
    if (this.pollTimer !== undefined) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private async pollExternalEdit(): Promise<void> {
    try {
      if (!(await this.plugin.app.vault.adapter.exists(this.settingsPath))) {
        return;
      }
      const st = await this.plugin.app.vault.adapter.stat(this.settingsPath);
      if (!st || st.mtime === this.lastMtime) {
        return;
      }
      const raw = await this.plugin.app.vault.adapter.read(this.settingsPath);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next = this.normalizeLoaded(parsed);
      this.lastMtime = st.mtime;
      this.currentSettings = next;
      await this.plugin.saveData(next);
      this.emit(next);
    } catch (e) {
      console.error('ConfigStore poll failed', e);
    }
  }
}
