# Folio — Flipbook Studio

## Original Problem Statement
An app to turn a collection of documents or images into a flip book.

## User Choices
- File types: Both images and PDFs
- Auth: No login
- Sharing: Private only
- Flip style: Realistic 3D page-curl animation
- Design: Auto-chosen ("The Archival Gallery" — editorial/print aesthetic, Cormorant Garamond + Manrope)

## Architecture
- **Backend**: FastAPI + MongoDB (motor). PDF→PNG rendering via PyMuPDF. Files stored in Emergent Object Storage; served through `/api/files/{path}`.
- **Frontend**: React + react-router, react-pageflip (3D curl), @dnd-kit (page reorder), Tailwind + shadcn/ui, sonner toasts.
- Books stored as documents with embedded `pages[]` (id, storage_path, order).

## Core Requirements (static)
- Create flipbooks, upload images & PDFs, auto-split PDFs into pages.
- Reorder/delete pages, rename/delete books.
- Read with realistic page-flip viewer.

## Implemented (2026-06-26)
- Library page: hero, book grid, create-dialog (optional initial files), delete with confirm, empty state.
- Editor: drag-drop upload zone, sortable page thumbnails, page delete, inline rename, Read button.
- Reader: react-pageflip portrait viewer, page indicator, prev/next controls.
- Backend CRUD + object storage + PDF rendering. Tested e2e (15/15 backend, all frontend flows pass).

### Iteration 2 (2026-06-26)
- P1 Public shareable read-only links: share toggle + copyable `/s/:shareId` URL, read-only SharedReader page. Backend share_id + share_enabled.
- P2 Custom covers (upload image or set any page as cover, COVER badge), double-page spread toggle in reader, page rotate 90° and crop (react-image-crop) — processed server-side via Pillow.
- Auto-adjust flipbook page size/orientation: pages store width/height; reader frame matches content aspect ratio (landscape/portrait).
- Tested e2e: 25/25 backend, 100% frontend.

### Iteration 3 (2026-06-26)
- Code-quality fixes (serve_file unbound-var, useCallback hook deps, lint cleanups). Verified 27/27 backend.
- Orphaned-object cleanup: rotate/crop/page-delete now record replaced storage paths in an `orphaned_objects` ledger; `GET /api/admin/orphans` (status) and `POST /api/admin/orphans/purge` (best-effort delete). NOTE: storage backend returns 405 on DELETE today, so purge is a no-op that will free storage automatically once deletion is supported.

## Backlog
- P1: Public shareable read-only links (currently private only by design).
- P2: Page rotation/cropping, double-page spread layout, book cover customization.
- P2: Run PDF rendering in a thread; async http client for storage; per-flipbook page-resume in reader.

## Next Tasks
- Await user feedback; consider share links and cover customization.
