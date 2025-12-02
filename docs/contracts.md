# Shared types and contracts

This document keeps frontend and backend aligned on structures used in the MVP (Phase 0–1). Types are expressed in TypeScript-ish notation.

## FileDescriptor
Represents one uploaded file after inspection.
```ts
type FileKind = "text" | "binary";

interface FileDescriptor {
  name: string;            // Original filename
  extension: string;       // Lowercase extension without dot
  size: number;            // Bytes
  mime: string;            // Combined/sniffed MIME type
  hash: string;            // SHA-256 hex digest
  kind: FileKind;          // Text vs binary classification
  warnings?: string[];     // Optional notices about detection
}
```

## DiffLine
Represents one line in the text diff view. `before` and `after` help render side-by-side.
```ts
type DiffLineType = "unchanged" | "added" | "removed" | "modified";

interface DiffLine {
  type: DiffLineType;
  oldNumber: number | null; // Line number in original file
  newNumber: number | null; // Line number in comparison file
  before?: string | null;   // Content from original (if applicable)
  after?: string | null;    // Content from comparison (if applicable)
}
```

## DiffSummary
High-level stats computed for text comparisons.
```ts
interface DiffSummary {
  identical: boolean;
  totalLines: number;
  added: number;
  removed: number;
  modified: number;
  changePercent: number; // 0–100 rounded percentage of changed lines
}
```

## DiffResult
Top-level response for `/api/diff`.
```ts
interface DiffResult {
  files: [FileDescriptor, FileDescriptor];
  summary: DiffSummary;
  textDiff?: DiffLine[];       // Present when both files are text-like
  warnings?: string[];         // Cross-file warnings (size limits, binary fallback)
  error?: string;              // Present when validation fails
}
```

## Validation constraints (MVP)
- Exactly two files are required.
- Max 5 MB per file; max 8 MB combined.
- Text-like files are diffed; binary or mixed pairs return warnings and skip text diff.
