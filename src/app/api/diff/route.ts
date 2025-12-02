import { NextResponse } from "next/server";
import {
  buildDescriptor,
  classifyKind,
  decodeText,
  sniffMime,
  computeTextDiff,
  extensionOf,
} from "@/lib/diff";
import { DiffResult, FileDescriptor } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_COMBINED_SIZE = 8 * 1024 * 1024; // combined cap
const BLOCKED_MIME_PREFIXES = ["video/", "audio/"];

const validationError = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

type LoadedFile = {
  descriptor: FileDescriptor;
  text?: string;
};

const loadFile = async (file: File): Promise<LoadedFile> => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionOf(file.name);
  const inferredMime = await sniffMime(buffer, file.type, ext);
  const kind = classifyKind(buffer, inferredMime, ext);
  const warnings: string[] = [];

  if (BLOCKED_MIME_PREFIXES.some((prefix) => inferredMime.startsWith(prefix))) {
    warnings.push(
      "Large media files are blocked in the MVP. Provide text-like files instead.",
    );
  }

  let text: string | undefined;
  if (kind === "text" && warnings.length === 0) {
    try {
      text = decodeText(buffer);
    } catch {
      warnings.push("Unable to decode text content using UTF-8.");
    }
  }

  const descriptor = buildDescriptor({
    name: file.name,
    mime: inferredMime,
    buffer,
    kind,
    warnings: warnings.length ? warnings : undefined,
  });

  return { descriptor, text };
};

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return validationError("Invalid form data.");
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length !== 2) {
    return validationError("Please upload exactly two files.");
  }

  if (files.some((file) => file.size > MAX_FILE_SIZE)) {
    return validationError("Each file must be 5 MB or smaller.");
  }

  const combinedSize = files.reduce((total, file) => total + file.size, 0);
  if (combinedSize > MAX_COMBINED_SIZE) {
    return validationError("Combined file size must be 8 MB or smaller.");
  }

  const loadedFiles = await Promise.all(files.map((file) => loadFile(file)));
  const [left, right] = loadedFiles;
  const warnings: string[] = [];

  loadedFiles.forEach(({ descriptor }) => {
    if (descriptor.warnings) {
      warnings.push(...descriptor.warnings);
    }
  });

  const hashesMatch = left.descriptor.hash === right.descriptor.hash;
  const sizesMatch = left.descriptor.size === right.descriptor.size;
  let summary = {
    identical: hashesMatch && sizesMatch,
    totalLines: 0,
    added: 0,
    removed: 0,
    modified: 0,
    changePercent: hashesMatch && sizesMatch ? 0 : 100,
  };
  let textDiff;

  if (left.descriptor.kind === "text" && right.descriptor.kind === "text") {
    if (!left.text || !right.text) {
      return validationError("Could not read text contents from both files.");
    }
    const diff = computeTextDiff(left.text, right.text);
    summary = diff.summary;
    textDiff = diff.lines;
  } else {
    warnings.push(
      "One or both files are binary. Text diff view is not available in the MVP.",
    );
  }

  const result: DiffResult = {
    files: [left.descriptor, right.descriptor],
    summary,
    textDiff,
    warnings: warnings.length ? warnings : undefined,
  };

  return NextResponse.json(result);
}
