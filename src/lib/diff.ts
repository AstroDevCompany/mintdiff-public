import crypto from "node:crypto";
import { diffLines } from "diff";
import { fileTypeFromBuffer } from "file-type";
import {
  DiffLine,
  DiffSummary,
  FileDescriptor,
  FileKind,
} from "./types";

const TEXT_MIME_HINTS = [
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/javascript",
  "application/typescript",
  "application/graphql",
  "text/",
];

const TEXT_EXT_HINTS = [
  "txt",
  "md",
  "json",
  "yaml",
  "yml",
  "xml",
  "toml",
  "csv",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "html",
];

const BINARY_MIME_HINTS = [
  "image/",
  "audio/",
  "video/",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
];

const CONTROL_BYTES = new Set([
  0, 1, 2, 3, 4, 5, 6, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31,
]);

export const MAX_SNIFF_BYTES = 4096;

const splitPreserve = (value: string): string[] => {
  if (!value) return [];
  const lines = value.split("\n");
  if (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
};

export const normalizeNewlines = (value: string): string =>
  value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

export const hashBuffer = (buffer: Buffer): string =>
  crypto.createHash("sha256").update(buffer).digest("hex");

export const extensionOf = (name: string): string => {
  const last = name.lastIndexOf(".");
  if (last === -1 || last === name.length - 1) return "";
  return name.slice(last + 1).toLowerCase();
};

export const sniffMime = async (
  buffer: Buffer,
  provided?: string,
  extension?: string,
): Promise<string> => {
  const detected = await fileTypeFromBuffer(buffer);
  if (detected?.mime) return detected.mime;
  if (provided) return provided;
  const ext = (extension ?? "").toLowerCase();
  if (TEXT_EXT_HINTS.includes(ext)) return "text/plain";
  return "application/octet-stream";
};

const controlRatio = (buffer: Buffer): number => {
  const sample =
    buffer.length > MAX_SNIFF_BYTES
      ? buffer.subarray(0, MAX_SNIFF_BYTES)
      : buffer;
  if (sample.length === 0) return 0;
  let controlCount = 0;
  for (const byte of sample) {
    if (byte === 0) return 1; // null byte almost always binary
    if (CONTROL_BYTES.has(byte)) controlCount += 1;
  }
  return controlCount / sample.length;
};

export const isProbablyText = (
  buffer: Buffer,
  mime?: string,
  extension?: string,
): boolean => {
  const normalizedMime = (mime ?? "").toLowerCase();
  if (TEXT_MIME_HINTS.some((hint) => normalizedMime.startsWith(hint))) {
    return true;
  }
  if (BINARY_MIME_HINTS.some((hint) => normalizedMime.startsWith(hint))) {
    return false;
  }
  if (
    normalizedMime === "application/octet-stream" ||
    normalizedMime === "" ||
    normalizedMime === "application/x-empty"
  ) {
    const ext = (extension ?? "").toLowerCase();
    if (TEXT_EXT_HINTS.includes(ext)) {
      return true;
    }
  }
  if (extension && TEXT_EXT_HINTS.includes(extension.toLowerCase())) {
    return true;
  }
  const ratio = controlRatio(buffer);
  return ratio < 0.1;
};

export const classifyKind = (
  buffer: Buffer,
  mime?: string,
  extension?: string,
): FileKind => (isProbablyText(buffer, mime, extension) ? "text" : "binary");

export const decodeText = (buffer: Buffer): string => {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return normalizeNewlines(decoder.decode(buffer));
};

export const buildDescriptor = ({
  name,
  mime,
  buffer,
  kind,
  warnings,
}: {
  name: string;
  mime: string;
  buffer: Buffer;
  kind: FileKind;
  warnings?: string[];
}): FileDescriptor => ({
  name,
  extension: extensionOf(name),
  size: buffer.byteLength,
  mime,
  hash: hashBuffer(buffer),
  kind,
  warnings,
});

export const computeTextDiff = (
  original: string,
  comparison: string,
): { lines: DiffLine[]; summary: DiffSummary } => {
  const normalizedLeft = normalizeNewlines(original);
  const normalizedRight = normalizeNewlines(comparison);
  const leftLines = splitPreserve(normalizedLeft);
  const rightLines = splitPreserve(normalizedRight);
  const changes = diffLines(normalizedLeft, normalizedRight);

  const diff: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;
  let oldLine = 1;
  let newLine = 1;

  for (let i = 0; i < changes.length; i += 1) {
    const current = changes[i];
    const next = changes[i + 1];

    // Treat a removed block immediately followed by an added block as a modification group.
    if (current.removed && next?.added) {
      const removedLines = splitPreserve(current.value);
      const addedLines = splitPreserve(next.value);
      const max = Math.max(removedLines.length, addedLines.length);
      for (let j = 0; j < max; j += 1) {
        const before = removedLines[j] ?? null;
        const after = addedLines[j] ?? null;
        if (before !== null && after !== null) {
          diff.push({
            type: "modified",
            oldNumber: oldLine,
            newNumber: newLine,
            before,
            after,
          });
          oldLine += 1;
          newLine += 1;
          modified += 1;
        } else if (before !== null) {
          diff.push({
            type: "removed",
            oldNumber: oldLine,
            newNumber: null,
            before,
            after: null,
          });
          oldLine += 1;
          removed += 1;
        } else if (after !== null) {
          diff.push({
            type: "added",
            oldNumber: null,
            newNumber: newLine,
            before: null,
            after,
          });
          newLine += 1;
          added += 1;
        }
      }
      i += 1;
      continue;
    }

    if (current.added) {
      const lines = splitPreserve(current.value);
      lines.forEach((line) => {
        diff.push({
          type: "added",
          oldNumber: null,
          newNumber: newLine,
          before: null,
          after: line,
        });
        newLine += 1;
        added += 1;
      });
      continue;
    }

    if (current.removed) {
      const lines = splitPreserve(current.value);
      lines.forEach((line) => {
        diff.push({
          type: "removed",
          oldNumber: oldLine,
          newNumber: null,
          before: line,
          after: null,
        });
        oldLine += 1;
        removed += 1;
      });
      continue;
    }

    const lines = splitPreserve(current.value);
    lines.forEach((line) => {
      diff.push({
        type: "unchanged",
        oldNumber: oldLine,
        newNumber: newLine,
        before: line,
        after: line,
      });
      oldLine += 1;
      newLine += 1;
    });
  }

  const totalLines = Math.max(leftLines.length, rightLines.length);
  const changesCount = added + removed + modified;
  const changePercent =
    totalLines === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round((changesCount / totalLines) * 100)));

  const summary: DiffSummary = {
    identical: changesCount === 0,
    totalLines,
    added,
    removed,
    modified,
    changePercent,
  };

  return { lines: diff, summary };
};
