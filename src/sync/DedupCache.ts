import WallabagPlugin from 'main';
import { sha256Hex } from 'util/sha256';

interface DedupRecord {
  wallabag_id: number;
  ts: string;
}

type DedupStore = Record<string, DedupRecord>;

export class DedupCache {
  private readonly plugin: WallabagPlugin;
  private readonly cachePath: string;

  constructor(plugin: WallabagPlugin) {
    this.plugin = plugin;
    this.cachePath = `${plugin.manifest.dir}/.dedup.json`;
  }

  async has(normalizedUrl: string): Promise<boolean> {
    const store = await this.read();
    return (await this.hash(normalizedUrl)) in store;
  }

  async mark(normalizedUrl: string, wallabagId: number): Promise<void> {
    const store = await this.read();
    store[await this.hash(normalizedUrl)] = {
      wallabag_id: wallabagId,
      ts: new Date().toISOString(),
    };
    await this.write(store);
  }

  async dump(): Promise<DedupStore> {
    return this.read();
  }

  async prune(): Promise<void> {
    const store = await this.read();
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const next = Object.fromEntries(
      Object.entries(store).filter(([, value]) => {
        return Date.parse(value.ts) >= cutoff;
      })
    );
    await this.write(next);
  }

  private async read(): Promise<DedupStore> {
    const exists = await this.plugin.app.vault.adapter.exists(this.cachePath);
    if (!exists) {
      return {};
    }
    return JSON.parse(await this.plugin.app.vault.adapter.read(this.cachePath)) as DedupStore;
  }

  private async write(store: DedupStore): Promise<void> {
    await this.plugin.app.vault.adapter.write(this.cachePath, JSON.stringify(store, null, 2));
  }

  private async hash(normalizedUrl: string): Promise<string> {
    return sha256Hex(normalizedUrl);
  }
}
