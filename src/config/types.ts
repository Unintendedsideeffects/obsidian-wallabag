export const SCHEMA_VERSION = 1;

export type OnLocalDelete = 'ignore' | 'archive' | 'delete';

export interface WallabagServerSettings {
  url: string;
  clientId: string;
  clientSecret: string;
}

export interface WallabagAuthSettings {
  username: string;
  password: string;
  storeCredentials: boolean;
}

export interface WallabagPullSettings {
  enabled: boolean;
  tagFilter: string;
  syncUnread: boolean;
  syncArchived: boolean;
  archiveAfterSync: boolean;
  convertHtmlToMarkdown: boolean;
  downloadAsPDF: boolean;
  createPDFNote: boolean;
  idInTitle: boolean;
  tagFormat: string;
}

export interface WallabagPushSettings {
  enableRemoteWrites: boolean;
  pushNewContent: boolean;
  pushFrontmatterUpdates: boolean;
  pushDebounceMs: number;
  onLocalDelete: OnLocalDelete;
}

export interface WallabagFoldersSettings {
  notes: string;
  unreadNotes: string;
  archivedNotes: string;
  pdfs: string;
  attachments: string;
}

export interface WallabagTemplateSettings {
  path: string;
  emitFullFrontmatter: boolean;
}

export interface WallabagTimerSettings {
  enabled: boolean;
  intervalMinutes: number;
  runOnStartup: boolean;
}

export interface DailyNotesHarvestSettings {
  enabled: boolean;
  submitUnreadByDefault: boolean;
  tagOnSubmit: string[];
}

export interface ClipperBridgeSettings {
  enabled: boolean;
  clipperTag: string;
  tagOnSubmit: string[];
}

export interface WallabagWatchersSettings {
  vaultFileWatcher: boolean;
  dailyNotesHarvest: DailyNotesHarvestSettings;
  clipperBridge: ClipperBridgeSettings;
}

export interface WallabagAttachmentsSettings {
  download: boolean;
  maxImagesPerArticle: number;
  maxBytesPerImage: number;
  rewriteToWikilinks: boolean;
}

export interface WallabagDryRunSettings {
  logMutations: boolean;
}

export interface WallabagSettings {
  $schemaVersion: number;
  server: WallabagServerSettings;
  auth: WallabagAuthSettings;
  pull: WallabagPullSettings;
  push: WallabagPushSettings;
  folders: WallabagFoldersSettings;
  template: WallabagTemplateSettings;
  timer: WallabagTimerSettings;
  watchers: WallabagWatchersSettings;
  attachments: WallabagAttachmentsSettings;
  dryRun: WallabagDryRunSettings;
}

export type WallabagDeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? WallabagDeepPartial<T[K]>
      : T[K];
};

export const DEFAULT_SETTINGS: WallabagSettings = {
  $schemaVersion: SCHEMA_VERSION,
  server: {
    url: '',
    clientId: '',
    clientSecret: '',
  },
  auth: {
    username: '',
    password: '',
    storeCredentials: false,
  },
  pull: {
    enabled: true,
    tagFilter: '',
    syncUnread: true,
    syncArchived: false,
    archiveAfterSync: false,
    convertHtmlToMarkdown: true,
    downloadAsPDF: false,
    createPDFNote: false,
    idInTitle: false,
    tagFormat: 'csv',
  },
  push: {
    enableRemoteWrites: false,
    pushNewContent: true,
    pushFrontmatterUpdates: true,
    pushDebounceMs: 2000,
    onLocalDelete: 'ignore',
  },
  folders: {
    notes: 'Wallabag',
    unreadNotes: '',
    archivedNotes: '',
    pdfs: 'Wallabag/PDFs',
    attachments: 'Attachments/Wallabag',
  },
  template: {
    path: '',
    emitFullFrontmatter: true,
  },
  timer: {
    enabled: false,
    intervalMinutes: 30,
    runOnStartup: false,
  },
  watchers: {
    vaultFileWatcher: true,
    dailyNotesHarvest: {
      enabled: false,
      submitUnreadByDefault: true,
      tagOnSubmit: ['from-daily-note'],
    },
    clipperBridge: {
      enabled: false,
      clipperTag: 'clippings',
      tagOnSubmit: ['from-clipper'],
    },
  },
  attachments: {
    download: true,
    maxImagesPerArticle: 50,
    maxBytesPerImage: 5242880,
    rewriteToWikilinks: true,
  },
  dryRun: {
    logMutations: true,
  },
};

export function cloneSettings(base: WallabagSettings): WallabagSettings {
  return JSON.parse(JSON.stringify(base)) as WallabagSettings;
}
