import { FrontmatterState } from 'note/FrontmatterCodec';

export type PushContext = 'daily' | 'clipper' | 'command' | 'vault';

export interface PullOptions {
  force?: boolean;
}

export interface PullResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface PushResult {
  ok: boolean;
  wallabag_id?: number;
  dryRun?: boolean;
  message?: string;
}

export interface SkipResult {
  kind: 'skip';
  reason: string;
}

export interface ReconcileResult {
  pull: PullResult;
  pushNew: { attempted: number; created: number };
  pushFrontmatter: { ok: number; skipped: number; conflicts: number };
}

export type LastKnownSnapshot = FrontmatterState;
