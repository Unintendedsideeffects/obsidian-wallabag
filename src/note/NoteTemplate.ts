import { FrontmatterState } from 'note/FrontmatterCodec';
import { WallabagArticle } from 'wallabag/WallabagAPI';

export default class NoteTemplate {
  content: string;

  constructor(content: string) {
    this.content = content;
  }

  fill(
    wallabagArticle: WallabagArticle,
    serverBaseUrl: string,
    content: string,
    tagFormat: string,
    frontmatter: FrontmatterState,
    emitFullFrontmatter: boolean,
    pdfLink = ''
  ): string {
    const annotations = wallabagArticle.annotations.map((a) => '> ' + a.quote + (a.text ? '\n\n' + a.text : '')).join('\n\n');
    const variables: { [key: string]: string } = {
      '{{frontmatter}}': this.renderFrontmatter(frontmatter),
      '{{id}}': wallabagArticle.id.toString(),
      '{{article_title}}': wallabagArticle.title,
      '{{original_link}}': wallabagArticle.url,
      '{{given_url}}': wallabagArticle.givenUrl,
      '{{created_at}}': wallabagArticle.createdAt,
      '{{published_at}}': wallabagArticle.publishedAt,
      '{{updated_at}}': wallabagArticle.updatedAt,
      '{{wallabag_link}}': `${serverBaseUrl}/view/${wallabagArticle.id}`,
      '{{content}}': content,
      '{{pdf_link}}': pdfLink,
      '{{tags}}': this.formatTags(wallabagArticle.tags, tagFormat),
      '{{reading_time}}': wallabagArticle.readingTime,
      '{{preview_picture}}': wallabagArticle.previewPicture,
      '{{domain_name}}': wallabagArticle.domainName,
      '{{annotations}}': annotations,
      '{{is_archived}}': wallabagArticle.isArchived ? 'true' : 'false',
      '{{is_starred}}': wallabagArticle.isStarred ? 'true' : 'false',
      '{{read}}': wallabagArticle.isArchived ? 'true' : 'false',
      '{{starred}}': wallabagArticle.isStarred ? 'true' : 'false',
      '{{date_read}}': wallabagArticle.archivedAt ?? '',
    };
    let noteContent = this.content;
    Object.keys(variables).forEach((key) => {
      noteContent = noteContent.replaceAll(key, variables[key]);
    });
    if (emitFullFrontmatter && !noteContent.includes(variables['{{frontmatter}}'])) {
      noteContent = `${variables['{{frontmatter}}']}\n${noteContent}`;
    }
    return noteContent;
  }

  private formatTags(tags: string[], tagFormat: string): string {
    switch (tagFormat) {
    case 'csv':
      return tags.join(', ');
    case 'hashtag':
      return tags.map((tag) => `#${tag}`).join(' ');
    default:
      return '';
    }
  }

  private renderFrontmatter(frontmatter: FrontmatterState): string {
    const lines = ['---'];
    Object.entries(frontmatter).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${key}: []`);
          return;
        }
        lines.push(`${key}:`);
        value.forEach((item) => lines.push(`  - ${this.escapeYaml(item)}`));
        return;
      }
      if (value === null) {
        lines.push(`${key}: null`);
        return;
      }
      if (typeof value === 'boolean' || typeof value === 'number') {
        lines.push(`${key}: ${String(value)}`);
        return;
      }
      lines.push(`${key}: ${this.escapeYaml(value)}`);
    });
    lines.push('---');
    return lines.join('\n');
  }

  private escapeYaml(value: string): string {
    return JSON.stringify(value);
  }
}

export const DefaultTemplate = new NoteTemplate(
  '# {{article_title}}\n\n[Original]({{original_link}}) | [Wallabag]({{wallabag_link}})\n\n{{content}}'
);

export const PDFTemplate = new NoteTemplate(
  '# {{article_title}}\n\n[Original]({{original_link}}) | [Wallabag]({{wallabag_link}})\n\nPDF: [[{{pdf_link}}]]'
);
