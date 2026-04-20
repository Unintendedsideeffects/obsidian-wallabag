import { cloneSettings, DEFAULT_SETTINGS, SCHEMA_VERSION, WallabagSettings } from 'config/types';

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') {return v;}
  if (typeof v === 'string') {return v === 'true';}
  return fallback;
}

function asStr(v: unknown, fallback: string): string {
  if (typeof v === 'string') {return v;}
  return fallback;
}

export function migrateV0FlatToV1(data: Record<string, unknown>): WallabagSettings {
  const next = cloneSettings(DEFAULT_SETTINGS);
  next.$schemaVersion = SCHEMA_VERSION;
  next.server.url = asStr(data.serverUrl, next.server.url);
  next.pull.tagFilter = asStr(data.tag, next.pull.tagFilter);
  next.folders.notes = asStr(data.folder, next.folders.notes);
  next.template.path = asStr(data.articleTemplate, next.template.path);
  next.folders.pdfs = asStr(data.pdfFolder, next.folders.pdfs);
  next.pull.downloadAsPDF = asBool(data.downloadAsPDF, next.pull.downloadAsPDF);
  next.pull.createPDFNote = asBool(data.createPDFNote, next.pull.createPDFNote);
  next.pull.convertHtmlToMarkdown = asBool(data.convertHtmlToMarkdown, next.pull.convertHtmlToMarkdown);
  next.pull.idInTitle = asBool(data.idInTitle, next.pull.idInTitle);
  next.pull.archiveAfterSync = asBool(data.archiveAfterSync, next.pull.archiveAfterSync);
  next.timer.runOnStartup = asBool(data.syncOnStartup, next.timer.runOnStartup);
  next.pull.syncArchived = asBool(data.syncArchived, next.pull.syncArchived);
  next.pull.syncUnread = asBool(data.syncUnRead, next.pull.syncUnread);
  next.pull.tagFormat = asStr(data.tagFormat, next.pull.tagFormat);
  next.folders.unreadNotes = asStr(data.unreadFolder, next.folders.unreadNotes);
  next.folders.archivedNotes = asStr(data.archivedFolder, next.folders.archivedNotes);
  return next;
}

export function isV0Shape(data: Record<string, unknown>): boolean {
  return typeof data.$schemaVersion !== 'number' && ('serverUrl' in data || 'tag' in data || 'folder' in data);
}
