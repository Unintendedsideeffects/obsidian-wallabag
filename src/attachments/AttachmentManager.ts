import { App, htmlToMarkdown, normalizePath, requestUrl } from 'obsidian';
import { sha256Hex } from 'util/sha256';
import { WallabagSettings } from 'config/types';
import WallabagAPI, { WallabagArticle } from 'wallabag/WallabagAPI';

export interface ProcessedContent {
  html: string;
  markdown: string;
  files: string[];
}

export class AttachmentManager {
  private readonly app: App;
  private readonly settings: () => WallabagSettings;
  private readonly api: () => WallabagAPI | undefined;

  constructor(app: App, settings: () => WallabagSettings, api: () => WallabagAPI | undefined) {
    this.app = app;
    this.settings = settings;
    this.api = api;
  }

  async processArticle(article: WallabagArticle, attachmentsRoot: string): Promise<ProcessedContent> {
    if (!this.settings().attachments.download) {
      const markdown = this.settings().pull.convertHtmlToMarkdown ? htmlToMarkdown(article.content ?? '') : article.content ?? '';
      return { html: article.content ?? '', markdown, files: [] };
    }

    const imageUrls = this.extractImageUrls(article.content ?? '').slice(0, this.settings().attachments.maxImagesPerArticle);
    const replacements = new Map<string, string>();
    const files: string[] = [];

    for (let index = 0; index < imageUrls.length; index += 4) {
      const batch = imageUrls.slice(index, index + 4);
      const batchResults = await Promise.all(batch.map(async (imageUrl) => this.downloadImage(article.id, imageUrl, attachmentsRoot)));
      batchResults.forEach((result) => {
        if (result) {
          replacements.set(result.source, result.localPath);
          files.push(result.localPath);
        }
      });
    }

    let html = article.content ?? '';
    replacements.forEach((localPath, source) => {
      html = html.replaceAll(source, localPath);
    });

    let markdown = this.settings().pull.convertHtmlToMarkdown ? htmlToMarkdown(html) : html;
    if (this.settings().attachments.rewriteToWikilinks) {
      replacements.forEach((localPath, source) => {
        markdown = markdown
          .replaceAll(`![](${source})`, `![[${localPath}]]`)
          .replaceAll(`![](${localPath})`, `![[${localPath}]]`);
      });
    }

    return { html, markdown, files };
  }

  private extractImageUrls(content: string): string[] {
    const urls = new Set<string>();
    const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const markdownPattern = /!\[[^\]]*]\((https?:\/\/[^)]+)\)/g;

    let match: RegExpExecArray | null = imgPattern.exec(content);
    while (match) {
      urls.add(match[1]);
      match = imgPattern.exec(content);
    }

    match = markdownPattern.exec(content);
    while (match) {
      urls.add(match[1]);
      match = markdownPattern.exec(content);
    }

    return [...urls];
  }

  private async downloadImage(articleId: number, source: string, attachmentsRoot: string): Promise<{ source: string; localPath: string } | null> {
    try {
      const response = await requestUrl({
        url: source,
        headers: this.api()?.authHeadersFor(source),
      });
      const bytes = response.arrayBuffer.byteLength;
      if (bytes > this.settings().attachments.maxBytesPerImage) {
        return null;
      }

      const extension = this.getExtension(source, response.headers['content-type']);
      const filename = `${await sha256Hex(source)}.${extension}`;
      const localPath = normalizePath(`${attachmentsRoot}/${articleId}/${filename}`);
      await this.ensureFolder(localPath);
      await this.app.vault.adapter.writeBinary(localPath, response.arrayBuffer);
      return { source, localPath };
    } catch (error) {
      console.log(`Failed to download image ${source}`, error);
      return null;
    }
  }

  private getExtension(source: string, contentType?: string): string {
    const pathname = new URL(source).pathname;
    const fromPath = pathname.split('.').pop();
    if (fromPath && fromPath.length <= 5) {
      return fromPath.toLowerCase();
    }

    switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'png';
    }
  }

  private async ensureFolder(path: string): Promise<void> {
    const parent = normalizePath(path.split('/').slice(0, -1).join('/'));
    if (parent === '') {
      return;
    }

    const segments = parent.split('/');
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!(await this.app.vault.adapter.exists(current))) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}
