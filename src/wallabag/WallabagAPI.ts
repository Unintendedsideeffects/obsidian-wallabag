import WallabagPlugin from 'main';
import { request, requestUrl, RequestUrlResponse } from 'obsidian';
import { Token } from './WallabagAuth';

interface WallabagAnnotation {
  user: string;
  annotator_schema_version: string;
  id: number;
  text: string;
  created_at: string;
  updated_at: string;
  quote: string;
}

interface WallabagTag {
  slug: string;
}

interface WallabagArticleRaw {
  id: number;
  tags: WallabagTag[];
  title: string;
  url: string;
  content: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  reading_time: string;
  preview_picture: string;
  domain_name: string;
  annotations: WallabagAnnotation[];
  is_archived: boolean;
  is_starred: boolean;
  given_url: string;
  archived_at?: string | null;
  etag?: string;
}

export interface WallabagArticle {
  id: number;
  tags: string[];
  title: string;
  url: string;
  content: string;
  createdAt: string;
  publishedAt: string;
  updatedAt: string;
  readingTime: string;
  previewPicture: string;
  domainName: string;
  annotations: WallabagAnnotation[];
  isArchived: boolean;
  isStarred: boolean;
  givenUrl: string;
  archivedAt?: string | null;
  etag?: string;
}

export interface WallabagArticlesResponse {
  page: number;
  pages: number;
  articles: WallabagArticle[];
}

export interface EntryPatch {
  archive?: 0 | 1;
  starred?: 0 | 1;
  tags?: string;
}

export default class WallabagAPI {
  plugin: WallabagPlugin;
  token: Token;

  constructor(token: Token, plugin: WallabagPlugin) {
    this.plugin = plugin;
    this.token = token;
  }

  static async authenticate(serverUrl: string, clientId: string, clientSecret: string, username: string, password: string): Promise<Token> {
    const body = {
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
    };

    const requestOptions = {
      url: `${serverUrl}/oauth/v2/token`,
      method: 'POST',
      body: JSON.stringify(body),
      contentType: 'application/json',
    };

    const response = await requestUrl(requestOptions);
    const parsed = response.json;

    return {
      clientId,
      clientSecret,
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
    };
  }

  async refresh(): Promise<Token> {
    return request({
      url: `${this.plugin.settings.server.url}/oauth/v2/token`,
      method: 'POST',
      body: `grant_type=refresh_token&refresh_token=${this.token.refreshToken}&client_id=${this.token.clientId}&client_secret=${this.token.clientSecret}`,
      contentType: 'application/x-www-form-urlencoded',
    }).then((response) => {
      const parsed = JSON.parse(response);
      return {
        clientId: this.token.clientId,
        clientSecret: this.token.clientSecret,
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token,
      };
    });
  }

  private convertWallabagArticle(article: WallabagArticleRaw): WallabagArticle {
    const getTag = (tag: WallabagTag) => (tag.slug.startsWith('t:') ? tag.slug.substring(2) : tag.slug);
    return {
      id: article.id,
      tags: (article.tags ?? []).map(getTag),
      title: article.title ?? '',
      url: article.url ?? '',
      content: article.content ?? '',
      createdAt: article.created_at ?? '',
      updatedAt: article.updated_at ?? '',
      publishedAt: article.published_at ?? '',
      readingTime: article.reading_time ?? '',
      previewPicture: article.preview_picture ?? '',
      domainName: article.domain_name ?? '',
      annotations: article.annotations ?? [],
      isArchived: article.is_archived,
      isStarred: article.is_starred,
      givenUrl: article.given_url ?? article.url ?? '',
      archivedAt: article.archived_at ?? null,
      etag: article.etag,
    };
  }

  private convertWallabagArticlesResponse(response: RequestUrlResponse): WallabagArticlesResponse {
    const embedded = response.json['_embedded'] as { items?: WallabagArticleRaw[] } | undefined;
    return {
      page: response.json['page'],
      pages: response.json['pages'],
      articles: (embedded?.items ?? []).map((article) => this.convertWallabagArticle(article)),
    };
  }

  private async tokenRefreshingFetch(url: string, method?: string, body?: string): Promise<RequestUrlResponse> {
    return requestUrl({
      url: url,
      headers: this.authHeaders(method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined),
      method: method ? method : 'GET',
      body: body,
    }).catch(async (reason) => {
      if (reason.status === 401) {
        console.log('Likely the token expired, refreshing it.');
        return await this.refresh()
          .then(async (token) => {
            this.token = token;
            await this.plugin.onAuthenticated(this.token);
            return this.tokenRefreshingFetch(url, method, body);
          })
          .catch(async (reason) => {
            console.log('Token refresh failed.', reason);
            await this.plugin.onTokenRefreshFailed();
            throw new Error('');
          });
      } else {
        console.log(`Something else failed ${reason}`);
        throw new Error('');
      }
    });
  }

  private getArchiveParam(syncUnReadArticles: boolean, syncArchivedArticles: boolean): string {
    if (syncUnReadArticles && !syncArchivedArticles) {
      return '&archive=0';
    } else if (!syncUnReadArticles && syncArchivedArticles) {
      return '&archive=1';
    } else {
      return '';
    }
  }

  authHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token.accessToken}`,
      ...extraHeaders,
    };
  }

  authHeadersFor(url: string): Record<string, string> | undefined {
    if (new URL(url).origin === new URL(this.plugin.settings.server.url).origin) {
      return this.authHeaders();
    }
    return undefined;
  }

  async fetchArticles(
    syncUnReadArticles = true,
    syncArchivedArticles = false,
    page = 1,
    results: WallabagArticle[] = []
  ): Promise<WallabagArticle[]> {
    const archiveParam = this.getArchiveParam(syncUnReadArticles, syncArchivedArticles);
    const tagQuery = this.plugin.settings.pull.tagFilter ? `&tags=${encodeURIComponent(this.plugin.settings.pull.tagFilter)}` : '';
    const url = `${this.plugin.settings.server.url}/api/entries.json?page=${page}${tagQuery}${archiveParam}`;
    return this.tokenRefreshingFetch(url).then((value) => {
      const response = this.convertWallabagArticlesResponse(value);
      if (response.pages === response.page) {
        return [...results, ...response.articles];
      } else {
        return this.fetchArticles(syncUnReadArticles, syncArchivedArticles, page + 1, [...results, ...response.articles]);
      }
    });
  }

  async exportArticle(id: number, format = 'pdf'): Promise<ArrayBuffer> {
    const url = `${this.plugin.settings.server.url}/api/entries/${id}/export.${format}`;
    return this.tokenRefreshingFetch(url).then((value) => {
      return value.arrayBuffer;
    });
  }

  async archiveArticle(id: number) {
    const url = `${this.plugin.settings.server.url}/api/entries/${id}`;
    return this.tokenRefreshingFetch(url, 'PATCH', JSON.stringify({ archive: 1 }));
  }

  async createEntry(url: string, tags: string[] = []): Promise<WallabagArticle> {
    const response = await this.tokenRefreshingFetch(
      `${this.plugin.settings.server.url}/api/entries.json`,
      'POST',
      JSON.stringify({
        url,
        tags: tags.join(','),
      })
    );
    return this.convertWallabagArticle(response.json as WallabagArticleRaw);
  }

  async fetchEntry(id: number): Promise<WallabagArticle> {
    const response = await this.tokenRefreshingFetch(`${this.plugin.settings.server.url}/api/entries/${id}.json`);
    return this.convertWallabagArticle(response.json as WallabagArticleRaw);
  }

  async patchEntry(id: number, patch: EntryPatch): Promise<WallabagArticle> {
    const response = await this.tokenRefreshingFetch(`${this.plugin.settings.server.url}/api/entries/${id}`, 'PATCH', JSON.stringify(patch));
    return this.convertWallabagArticle(response.json as WallabagArticleRaw);
  }

  async deleteEntry(id: number): Promise<void> {
    await this.tokenRefreshingFetch(`${this.plugin.settings.server.url}/api/entries/${id}`, 'DELETE');
  }

  async listTags(): Promise<string[]> {
    const response = await this.tokenRefreshingFetch(`${this.plugin.settings.server.url}/api/tags.json`);
    const embedded = response.json['_embedded'] as { items?: WallabagTag[] } | undefined;
    return (embedded?.items ?? []).map((tag) => (tag.slug.startsWith('t:') ? tag.slug.substring(2) : tag.slug));
  }

  async fetchSince(isoTimestamp: string): Promise<WallabagArticle[]> {
    const response = await this.tokenRefreshingFetch(
      `${this.plugin.settings.server.url}/api/entries.json?since=${encodeURIComponent(isoTimestamp)}`
    );
    return this.convertWallabagArticlesResponse(response).articles;
  }
}
