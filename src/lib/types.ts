export type FileKind = "text" | "binary";

export interface FileDescriptor {
  name: string;
  extension: string;
  size: number;
  mime: string;
  hash: string;
  kind: FileKind;
  warnings?: string[];
}

export type DiffLineType = "unchanged" | "added" | "removed" | "modified";

export interface DiffLine {
  type: DiffLineType;
  oldNumber: number | null;
  newNumber: number | null;
  before?: string | null;
  after?: string | null;
}

export interface DiffSummary {
  identical: boolean;
  totalLines: number;
  added: number;
  removed: number;
  modified: number;
  changePercent: number;
}

export interface DiffResult {
  files: [FileDescriptor, FileDescriptor];
  summary: DiffSummary;
  textDiff?: DiffLine[];
  warnings?: string[];
  error?: string;
}
