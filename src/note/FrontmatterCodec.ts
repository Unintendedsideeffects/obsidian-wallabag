import { App, TFile, parseFrontMatterEntry } from 'obsidian';
import { EntryPatch, WallabagArticle } from 'wallabag/WallabagAPI';

export interface FrontmatterState {
  wallabag_id?: number;
  wallabag_url?: string;
  source_url?: string;
  given_url?: string;
  title?: string;
  domain_name?: string;
  reading_time?: number;
  preview_picture?: string;
  tags: string[];
  read: boolean;
  starred: boolean;
  date_added?: string;
  date_read?: string | null;
  published_at?: string;
  wallabag_last_synced?: string;
  wallabag_etag?: string;
  clipper_source?: string;
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const sortedUnique = (values: string[]): string[] => {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
};

export class FrontmatterCodec {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  fromArticle(article: WallabagArticle, serverBaseUrl = ''): FrontmatterState {
    return {
      wallabag_id: article.id,
      wallabag_url: serverBaseUrl ? `${serverBaseUrl}/view/${article.id}` : undefined,
      source_url: article.url,
      given_url: article.givenUrl,
      title: article.title,
      domain_name: article.domainName,
      reading_time: Number(article.readingTime),
      preview_picture: article.previewPicture,
      tags: sortedUnique(article.tags),
      read: article.isArchived,
      starred: article.isStarred,
      date_added: article.createdAt,
      date_read: article.archivedAt ?? null,
      published_at: article.publishedAt,
      wallabag_last_synced: article.updatedAt,
      wallabag_etag: article.etag,
    };
  }

  pushRelevantFieldsDiffer(a: FrontmatterState, b: FrontmatterState): boolean {
    const ta = [...a.tags].map((t) => t.trim()).filter(Boolean).sort().join('\0');
    const tb = [...b.tags].map((t) => t.trim()).filter(Boolean).sort().join('\0');
    return a.read !== b.read || a.starred !== b.starred || ta !== tb;
  }

  toPatch(current: FrontmatterState, remote: FrontmatterState): EntryPatch | null {
    const patch: EntryPatch = {};
    const currentTags = sortedUnique(current.tags);
    const remoteTags = sortedUnique(remote.tags);

    if (current.read !== remote.read) {
      patch.archive = current.read ? 1 : 0;
    }
    if (current.starred !== remote.starred) {
      patch.starred = current.starred ? 1 : 0;
    }
    if (currentTags.join(',') !== remoteTags.join(',')) {
      patch.tags = currentTags.join(',');
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }

  readFromFile(file: TFile): FrontmatterState | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter) {
      return null;
    }

    const wallabagIdValue = parseFrontMatterEntry(frontmatter, 'wallabag_id');
    const readingTimeValue = parseFrontMatterEntry(frontmatter, 'reading_time');
    return {
      wallabag_id: typeof wallabagIdValue === 'number' ? wallabagIdValue : Number(wallabagIdValue ?? 0) || undefined,
      wallabag_url: this.readString(frontmatter, 'wallabag_url'),
      source_url: this.readString(frontmatter, 'source_url'),
      given_url: this.readString(frontmatter, 'given_url'),
      title: this.readString(frontmatter, 'title'),
      domain_name: this.readString(frontmatter, 'domain_name'),
      reading_time: typeof readingTimeValue === 'number' ? readingTimeValue : Number(readingTimeValue ?? 0) || undefined,
      preview_picture: this.readString(frontmatter, 'preview_picture'),
      tags: sortedUnique(toStringArray(parseFrontMatterEntry(frontmatter, 'tags'))),
      read: Boolean(parseFrontMatterEntry(frontmatter, 'read')),
      starred: Boolean(parseFrontMatterEntry(frontmatter, 'starred')),
      date_added: this.readString(frontmatter, 'date_added'),
      date_read: this.readNullableString(frontmatter, 'date_read'),
      published_at: this.readString(frontmatter, 'published_at'),
      wallabag_last_synced: this.readString(frontmatter, 'wallabag_last_synced'),
      wallabag_etag: this.readString(frontmatter, 'wallabag_etag'),
      clipper_source: this.readString(frontmatter, 'clipper_source'),
    };
  }

  async writeToFile(file: TFile, next: Partial<FrontmatterState>): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      Object.entries(next).forEach(([key, value]) => {
        if (value === undefined) {
          delete frontmatter[key];
          return;
        }
        frontmatter[key] = value;
      });
    });
  }

  async writeArticleState(file: TFile, article: WallabagArticle, serverBaseUrl: string, extras: Partial<FrontmatterState> = {}): Promise<void> {
    const next = {
      ...this.fromArticle(article, serverBaseUrl),
      ...extras,
    };
    await this.writeToFile(file, next);
  }

  private readString(frontmatter: Record<string, unknown>, key: string): string | undefined {
    const value = parseFrontMatterEntry(frontmatter, key);
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }

  private readNullableString(frontmatter: Record<string, unknown>, key: string): string | null | undefined {
    const value = parseFrontMatterEntry(frontmatter, key);
    if (value === null) {
      return null;
    }
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }
}

export const frontmatterIsLinked = (state: FrontmatterState | null): state is FrontmatterState & { wallabag_id: number } => {
  return Boolean(state?.wallabag_id && state.wallabag_id > 0);
};
