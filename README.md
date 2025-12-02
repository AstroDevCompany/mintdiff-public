# MintDiff

MintDiff is a Next.js web app for comparing two files. The MVP covers text-oriented comparisons with a clear upload flow, file descriptors, and a line-based diff view. It follows the roadmap in `../roadmap.md`, focusing on Phase 0 (setup) and Phase 1 (upload + text diff).

## What’s here now
- Next.js (App Router) + Tailwind v4 setup with linting (ESLint) and testing (Vitest).
- Shared type contracts for file descriptors and diff results (`docs/contracts.md`).
- `/api/diff` endpoint that accepts two files, validates size/type, builds descriptors, and returns summary + line diff for text-like files.
- Frontend uploader with drag/drop, validation, loading/error states, and a text diff viewer (hide unchanged lines, jump between changes).

## Running locally
```bash
npm install
npm run dev    # start the app at http://localhost:3000
npm run lint   # static analysis
npm test       # unit tests for diff + classification helpers
```

## API quick reference
- `POST /api/diff`
- Body: `multipart/form-data` with exactly two `files` fields.
- Limits: max 5 MB per file and 8 MB combined in the MVP.
- Response: file descriptors, summary stats (added/removed/modified, change percentage, identical flag), text diff lines when both files are text-like, plus warnings for unsupported cases.

## Project structure
- `src/app/api/diff/route.ts` – file upload handling and diff computation.
- `src/lib/types.ts` – shared interfaces for descriptors and diff payloads.
- `src/lib/diff.ts` – classification, hashing, newline normalization, and line diff logic.
- `src/app/page.tsx` – uploader UI, summary, and text diff viewer.
- `docs/contracts.md` – documented schema for frontend/backend alignment.

## Next steps (from the roadmap)
- Phase 2: binary handling (hash/size comparison, byte preview) with unified similarity scoring.
- Phase 3: image analyzer and metadata comparison.
- Phase 4: archives/documents (ZIP/TAR, PDF/DOCX text extraction).
- Phase 5: export/share flows, persistence, rate limits, and pluggable analyzers.
