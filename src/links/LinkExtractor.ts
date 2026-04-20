export interface ExtractedLink {
  raw: string;
  normalized: string;
  line: number;
}

export interface ScanOptions {
  skipMarkedLines?: boolean;
}

export class LinkExtractor {
  scan(markdown: string, opts: ScanOptions = {}): ExtractedLink[] {
    const stripped = this.stripCode(markdown);
    const results: ExtractedLink[] = [];
    const lines = stripped.split('\n');
    const pattern = /(?:\[[^\]]*]\((https?:\/\/[^\s)]+)\)|<(https?:\/\/[^>\s]+)>|\b(https?:\/\/[^\s<>)\]]+))/g;

    lines.forEach((lineContent, index) => {
      if (opts.skipMarkedLines !== false && (lineContent.includes('wallabag\'d') || lineContent.includes('— wallabag'))) {
        return;
      }

      let match: RegExpExecArray | null = pattern.exec(lineContent);
      while (match) {
        const raw = match[1] ?? match[2] ?? match[3];
        if (raw) {
          results.push({
            raw,
            normalized: this.normalize(raw),
            line: index,
          });
        }
        match = pattern.exec(lineContent);
      }
      pattern.lastIndex = 0;
    });

    const seen = new Set<string>();
    return results.filter((result) => {
      const key = `${result.line}:${result.normalized}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  normalize(url: string): string {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.searchParams.forEach((_value, key) => {
      if (key.toLowerCase().startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    });
    if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  }

  private stripCode(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]*`/g, '');
  }
}
