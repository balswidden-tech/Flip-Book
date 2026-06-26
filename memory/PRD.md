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

## Backlog
- P1: Public shareable read-only links (currently private only by design).
- P2: Page rotation/cropping, double-page spread layout, book cover customization.
- P2: Run PDF rendering in a thread; async http client for storage; per-flipbook page-resume in reader.

## Next Tasks
- Await user feedback; consider share links and cover customization.
