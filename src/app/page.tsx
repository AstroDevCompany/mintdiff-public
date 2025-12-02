"use client";

import { useEffect, useMemo, useState } from "react";
import { DiffLine, DiffResult } from "@/lib/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_COMBINED_SIZE = 8 * 1024 * 1024;
const BLOCKED_PREFIXES = ["video/", "audio/"];

type SelectedFile = {
  id: string;
  file: File;
};

const formatBytes = (size: number) => {
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.floor(Math.log(size) / Math.log(1024));
  const value = size / 1024 ** idx;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
};

const isChange = (line: DiffLine) => line.type !== "unchanged";

const badgeClasses = "rounded-full border px-3 py-1 text-xs font-semibold";

function FileCard({ file }: { file: File }) {
  return (
    <div className="rounded-xl border border-teal-800 bg-teal-900/40 p-3">
      <div className="flex items-center justify-between text-sm text-teal-100">
        <span className="truncate font-medium">{file.name}</span>
        <span className="text-teal-200">{formatBytes(file.size)}</span>
      </div>
      <p className="mt-1 text-xs text-teal-300/80">{file.type || "unknown"}</p>
    </div>
  );
}

function SummaryPanel({
  result,
  warnings,
}: {
  result: DiffResult;
  warnings: string[];
}) {
  const similarity = Math.max(
    0,
    Math.min(100, 100 - result.summary.changePercent),
  );

  return (
    <div className="rounded-2xl border border-teal-800 bg-teal-950/50 p-5 shadow-lg shadow-teal-900/40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-teal-200/80">Verdict</p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`${badgeClasses} border-cyan-400/60 bg-cyan-400/15 text-cyan-50`}
            >
              {result.summary.identical ? "Identical" : "Compared"}
            </span>
            <span className="text-3xl font-semibold text-teal-50">
              {similarity}% similar
            </span>
          </div>
          <p className="mt-1 text-sm text-teal-200/80">
            {result.summary.identical
              ? "Hashes match and no line-level changes."
              : "Similarity is calculated from unchanged lines."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-teal-100">
          <div className="rounded-xl border border-teal-800 bg-teal-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-teal-200/80">
              Total lines
            </p>
            <p className="text-xl font-semibold">{result.summary.totalLines}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-100/80">
              Added
            </p>
            <p className="text-xl font-semibold text-emerald-50">
              {result.summary.added}
            </p>
          </div>
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-rose-200/80">
              Removed
            </p>
            <p className="text-xl font-semibold text-rose-50">
              {result.summary.removed}
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-amber-100/80">
              Modified
            </p>
            <p className="text-xl font-semibold text-amber-50">
              {result.summary.modified}
            </p>
          </div>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {warnings.map((warning) => (
            <span
              key={warning}
              className={`${badgeClasses} border-amber-400/50 bg-amber-400/15 text-amber-50`}
            >
              {warning}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptorCards({ files }: { files: DiffResult["files"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {files.map((file, idx) => (
        <div
          key={`${file.hash}-${idx}`}
          className="rounded-xl border border-teal-800 bg-teal-900/50 p-4"
        >
          <div className="flex items-center justify-between text-sm text-teal-100">
            <span className="font-semibold">File {idx + 1}</span>
            <span className="text-teal-200/90">{formatBytes(file.size)}</span>
          </div>
          <p className="mt-1 truncate text-sm text-teal-50">{file.name}</p>
          <p className="text-xs text-teal-300/80">{file.mime}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-teal-300/70">
            Hash
          </p>
          <p className="font-mono text-xs text-teal-100 break-all">
            {file.hash}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-teal-100">
            <span className="rounded-full border border-teal-700 px-2 py-1">
              .{file.extension || "none"}
            </span>
            <span
              className={`rounded-full border px-2 py-1 ${
                file.kind === "text"
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-50"
                  : "border-amber-400/40 bg-amber-400/15 text-amber-50"
              }`}
            >
              {file.kind === "text" ? "Text-like" : "Binary"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffControls({
  hideUnchanged,
  onToggleHidden,
  onPrev,
  onNext,
  hasChanges,
}: {
  hideUnchanged: boolean;
  onToggleHidden: (next: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  hasChanges: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-800 bg-teal-900/50 px-4 py-3">
      <label className="flex items-center gap-2 text-sm text-teal-100">
        <input
          type="checkbox"
          checked={hideUnchanged}
          onChange={(e) => onToggleHidden(e.target.checked)}
          className="h-4 w-4 accent-cyan-400"
        />
        Hide unchanged lines
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasChanges}
          className="rounded-lg border border-teal-700 bg-teal-800 px-3 py-2 text-sm text-teal-100 transition hover:border-cyan-400 hover:text-white disabled:opacity-40"
        >
          Previous change
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasChanges}
          className="rounded-lg border border-teal-700 bg-teal-800 px-3 py-2 text-sm text-teal-100 transition hover:border-cyan-400 hover:text-white disabled:opacity-40"
        >
          Next change
        </button>
      </div>
    </div>
  );
}

function DiffLineRow({
  line,
  index,
}: {
  line: DiffLine;
  index: number;
}) {
  const base = "grid grid-cols-[72px_72px_1fr_1fr] gap-3 rounded-lg border px-3 py-2";
  const colors: Record<DiffLine["type"], string> = {
    unchanged: "border-teal-800 bg-teal-900/40",
    added: "border-emerald-400/50 bg-emerald-400/15",
    removed: "border-rose-500/50 bg-rose-500/15",
    modified: "border-amber-400/50 bg-amber-400/15",
  };

  const beforeContent = line.before ?? "";
  const afterContent = line.after ?? "";

  return (
    <div
      id={`diff-line-${index}`}
      className={`${base} ${colors[line.type]}`}
    >
      <div className="text-right text-xs text-teal-200/80">
        {line.oldNumber ?? "–"}
      </div>
      <div className="text-right text-xs text-teal-200/80">
        {line.newNumber ?? "–"}
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-sm text-teal-50">
        {beforeContent}
      </pre>
      <pre className="whitespace-pre-wrap break-words font-mono text-sm text-teal-50">
        {afterContent}
      </pre>
    </div>
  );
}

function TextDiffView({
  lines,
  hideUnchanged,
}: {
  lines: DiffLine[];
  hideUnchanged: boolean;
}) {
  const visibleLines = hideUnchanged
    ? lines.filter((line) => line.type !== "unchanged")
    : lines;

  return (
    <div className="rounded-2xl border border-teal-800 bg-teal-950/70 p-3">
      <div className="grid grid-cols-[72px_72px_1fr_1fr] gap-3 rounded-lg border border-teal-800 bg-teal-900/70 px-3 py-2 text-xs uppercase tracking-wide text-teal-200/80">
        <span className="text-right">Left</span>
        <span className="text-right">Right</span>
        <span>Original</span>
        <span>Comparison</span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {visibleLines.length === 0 ? (
          <p className="rounded-lg border border-teal-800 bg-teal-900/50 px-4 py-3 text-sm text-teal-200">
            No differences to show.
          </p>
        ) : (
          visibleLines.map((line, idx) => (
            <DiffLineRow key={`${line.type}-${idx}-${line.oldNumber}-${line.newNumber}`} line={line} index={idx} />
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideUnchanged, setHideUnchanged] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeChange, setActiveChange] = useState(0);
  const [dragging, setDragging] = useState(false);

  const hasExactlyTwo = selected.length === 2;
  const currentFiles = selected.map((item) => item.file);

  const displayedLines = useMemo(() => {
    if (!result?.textDiff) return [];
    return hideUnchanged
      ? result.textDiff.filter((line) => line.type !== "unchanged")
      : result.textDiff;
  }, [hideUnchanged, result?.textDiff]);

  const changePositions = useMemo(() => {
    const lines = displayedLines;
    const positions: number[] = [];
    lines.forEach((line, idx) => {
      if (isChange(line)) positions.push(idx);
    });
    return positions;
  }, [displayedLines]);

  useEffect(() => {
    setActiveChange(0);
  }, [hideUnchanged, result?.textDiff]);

  useEffect(() => {
    if (!changePositions.length) return;
    const clampedIndex = Math.min(activeChange, changePositions.length - 1);
    const lineIndex = changePositions[clampedIndex];
    const element = document.getElementById(`diff-line-${lineIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeChange, changePositions]);

  const validateFiles = (files: File[]) => {
    if (files.length === 0) {
      return "Select at least one file.";
    }
    if (files.length > 2) {
      return "Only two files can be compared at once. Reset to replace.";
    }
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      return "Each file must be 5 MB or smaller.";
    }
    if (
      files.some((file) =>
        BLOCKED_PREFIXES.some((prefix) => (file.type || "").startsWith(prefix)),
      )
    ) {
      return "Videos and audio files are blocked for the MVP.";
    }
    if (files.length === 2) {
      const total = files.reduce((sum, file) => sum + file.size, 0);
      if (total > MAX_COMBINED_SIZE) {
        return "Combined file size must be 8 MB or smaller.";
      }
    }
    return null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const merged = [...currentFiles, ...incoming];
    const validationError = validateFiles(merged);
    if (validationError) {
      setError(validationError);
      return;
    }
    const trimmed = merged.slice(0, 2);
    setSelected(
      trimmed.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
      })),
    );
    setError(null);
    setResult(null);
    setWarnings([]);
  };

  const submit = async () => {
    if (!hasExactlyTwo) {
      setError("Add one more file to compare.");
      return;
    }
    const files = currentFiles;
    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setWarnings([]);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/diff", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as DiffResult;

      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Upload failed.");
      }

      setResult(payload);
      setWarnings(payload.warnings ?? []);
      setHideUnchanged(false);
      setActiveChange(0);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setSelected([]);
    setResult(null);
    setError(null);
    setWarnings([]);
    setHideUnchanged(false);
  };

  const displayedWarnings = warnings;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-teal-50">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`${badgeClasses} border-cyan-400/70 bg-cyan-400/15 text-cyan-50`}
          >
            Phase 1 · Text diff MVP
          </span>
          <span className="text-sm text-teal-200">
            Limits: 5 MB per file / 8 MB total. Text-first comparison.
          </span>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-teal-50">MintDiff</h1>
            <p className="mt-2 max-w-3xl text-lg text-teal-200">
              Upload two files, inspect metadata, and read a clean line-based
              diff. Built for fast comparisons with sensible validation and
              in-browser privacy.
            </p>
          </div>
          <div className="flex gap-2 text-xs text-teal-100">
            <span className="rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-3 py-2">
              Text-first analyzer
            </span>
            <span className="rounded-xl border border-teal-700 bg-teal-900/60 px-3 py-2">
              Next.js + Tailwind
            </span>
            <span className="rounded-xl border border-cyan-400/60 bg-cyan-400/15 px-3 py-2">
              Drag & Drop uploads
            </span>
          </div>
        </div>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-teal-800 bg-teal-950/50 p-6 shadow-lg shadow-teal-900/40 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-teal-200/80">Upload</p>
              <h2 className="text-xl font-semibold text-teal-50">
                Bring two files to compare
              </h2>
            </div>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-teal-700 bg-teal-900 px-3 py-2 text-sm text-teal-100 transition hover:border-cyan-400 hover:text-white"
            >
              Reset
            </button>
          </div>

          <div
            className={`mt-4 flex h-48 items-center justify-center rounded-xl border-2 border-dashed transition ${
              dragging
                ? "border-cyan-300 bg-cyan-300/10"
                : "border-teal-700 bg-teal-900/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <div className="text-center">
              <p className="text-lg font-semibold text-teal-50">
                Drop files here
              </p>
              <p className="mt-1 text-sm text-teal-200">
                or choose exactly two files to compare
              </p>
              <label className="mt-4 inline-block cursor-pointer rounded-full border border-teal-700 bg-teal-800 px-4 py-2 text-sm font-medium text-teal-100 transition hover:border-cyan-400 hover:text-white">
                Browse files
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {selected.map((item) => (
              <FileCard key={item.id} file={item.file} />
            ))}
            {selected.length === 0 && (
              <p className="rounded-xl border border-teal-800 bg-teal-900/50 px-4 py-3 text-sm text-teal-200">
                Waiting for files. Add two files to enable the comparison.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-teal-200">
              We never upload beyond this session. Size cap: 5 MB each / 8 MB
              total.
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-200 border-t-transparent" />
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!hasExactlyTwo || loading}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-teal-950 transition hover:bg-teal-300 disabled:opacity-40"
              >
                {loading ? "Processing…" : "Compare files"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-teal-800 bg-teal-950/50 p-6 shadow-lg shadow-teal-900/40 backdrop-blur">
          <p className="text-sm text-teal-200/80">File descriptors</p>
          <h2 className="text-xl font-semibold text-teal-50">Quick glance</h2>
          <div className="mt-4 space-y-3">
            {[0, 1].map((idx) => {
              const file = selected[idx]?.file;
              return file ? (
                <div
                  key={selected[idx]?.id ?? idx}
                  className="rounded-xl border border-teal-800 bg-teal-900/40 p-4"
                >
                  <div className="flex items-center justify-between text-sm text-teal-100">
                    <span className="font-semibold">File {idx + 1}</span>
                    <span className="text-teal-200/90">{formatBytes(file.size)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-teal-50">
                    {file.name}
                  </p>
                  <p className="text-xs text-teal-300/80">{file.type || "unknown"}</p>
                </div>
              ) : (
                <div
                  key={idx}
                  className="rounded-xl border border-dashed border-teal-800 bg-teal-900/30 p-4 text-sm text-teal-300/70"
                >
                  File {idx + 1} not selected yet.
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-teal-800 bg-teal-900/50 px-4 py-3 text-sm text-teal-200">
            <p className="font-semibold text-teal-50">What you get</p>
            <ul className="mt-2 space-y-1 text-teal-200">
              <li>• File metadata: name, extension, size, MIME, hash.</li>
              <li>• Text vs binary classification.</li>
              <li>• Line-level diff with added/removed/modified counts.</li>
            </ul>
          </div>
        </div>
      </section>

      {result && (
        <section className="mt-8 space-y-4">
          <SummaryPanel result={result} warnings={displayedWarnings} />
          <DescriptorCards files={result.files} />

          {result.textDiff ? (
            <>
              <DiffControls
                hideUnchanged={hideUnchanged}
                onToggleHidden={(next) => setHideUnchanged(next)}
                onPrev={() =>
                  setActiveChange((prev) =>
                    changePositions.length
                      ? Math.max(prev - 1, 0)
                      : 0,
                  )
                }
                onNext={() =>
                  setActiveChange((prev) =>
                    changePositions.length
                      ? Math.min(prev + 1, changePositions.length - 1)
                      : 0,
                  )
                }
                hasChanges={changePositions.length > 0}
              />
              <div className="overflow-hidden rounded-2xl border border-teal-800 bg-teal-950/50 shadow-lg shadow-teal-900/30">
                <div className="flex flex-wrap items-center gap-3 border-b border-teal-800 px-4 py-3 text-sm text-teal-200">
                  <span className="font-semibold text-teal-50">
                    Text diff view
                  </span>
                  <span className="rounded-full border border-teal-700 px-2 py-1 text-xs text-teal-200/80">
                    {hideUnchanged
                      ? `${displayedLines.length} visible lines`
                      : `${result.textDiff.length} total lines`}
                  </span>
                  <span className="text-xs text-teal-200/80">
                    Navigate changes or hide noise to focus on edits.
                  </span>
                </div>
                <div className="p-4">
                  <TextDiffView lines={result.textDiff} hideUnchanged={hideUnchanged} />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-amber-50">
              No text diff available. One or both files were classified as
              binary. Hash comparison has been recorded in the summary above.
            </div>
          )}
        </section>
      )}
    </main>
  );
}
