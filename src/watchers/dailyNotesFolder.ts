import { App } from 'obsidian';

type DailyNotesPlugin = {
  enabled: boolean;
  instance?: { options?: { folder?: string } };
};

export function getDailyNotesFolder(app: App): string | null {
  const internalPlugins = (app as unknown as {
    internalPlugins?: {
      plugins?: Record<string, DailyNotesPlugin>;
    };
  }).internalPlugins;
  const plugins = internalPlugins?.plugins;
  const daily = plugins?.['daily-notes'];
  if (!daily?.enabled) {
    return null;
  }
  const folder = daily.instance?.options?.folder ?? '';
  const trimmed = folder.trim();
  return trimmed === '' ? null : trimmed;
}
