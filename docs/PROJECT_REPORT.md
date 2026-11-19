# SeniMate - Project Report

## What we built

SeniMate is a campus knowledge-sharing platform for Rathinam Technical Campus,
built for the IT HAPPENS @ RAALE #14 hackathon. Seniors upload the notes,
previous papers and preparation tips they kept; a moderator reviews every
upload; juniors search, download and save approved material.

The delivered system is a full-stack web app:

- **Frontend** (`frontend/`): React 18 + Vite + plain CSS. Nine pages - home,
  resource library with search and filters, resource details, upload form,
  my uploads, moderator review queue, saved items, senior connect and about -
  plus a user switcher, role-aware navigation and a responsive blue/white UI.
- **Backend** (`backend/`): FastAPI + SQLite (standard-library `sqlite3`,
  parameterised queries only). REST API matching a fixed contract, real file
  storage under `backend/uploads/`, seed data and a pytest suite.
- **Demo tooling**: `start-demo.bat` / `start-demo.sh` launch the whole stack;
  `backend/tools/make_demo_files.py` generates valid and invalid upload files;
  `frontend/scripts/e2e-check.mjs` runs a browser-level end-to-end test.

## Architecture and chosen stack

- Frontend: React 18, Vite 5, plain CSS. No router library - page state lives
  in `App.jsx`. All API calls go through a single module
  (`frontend/src/services/api.js`), which can run against either the real
  backend (`VITE_USE_MOCK=false`) or an in-memory mock
  (`VITE_USE_MOCK=true`, kept for demos without a backend).
- Backend: Python 3.10, FastAPI, uvicorn, python-multipart. SQLite via
  `sqlite3` with `PRAGMA foreign_keys=ON`. Validation lives in
  `app/validators.py`, file handling in `app/storage.py`, schema in
  `app/database.py`.
- The Vite dev server proxies `/api` to `http://localhost:8000` (prefix
  stripped). Every authenticated request carries an `X-User-Id` header chosen
  from the "Signed in as" dropdown - there is no real login.
- Tests: pytest + FastAPI TestClient for the API; Playwright (driving the
  installed Edge/Chrome, no browser download) for the UI.

## Data model

SQLite tables (see `backend/app/database.py`):

- `users` - id, name, unique email, department, role
  (senior/junior/moderator), year
- `subjects` - id, unique code, name, semester, department
- `resources` - id, title, description, resource_type
  (notes/previous_paper/tips), subject_id FK, uploader_id FK, original
  `file_name` for display, random `stored_name` on disk, `file_hash`
  (SHA-256, unique - used for duplicate detection), status
  (pending/approved/rejected), reject_reason, reviewed_by/at,
  download_count, created_at. Indexes on status, subject_id, resource_type.
- `bookmarks` - user_id + resource_id, unique together
- `reports` - resource_id, reporter_id, reason, status, created_at

## Upload and visibility rules

Upload validation runs server-side in a fixed order (first failure wins):
role check (junior -> 403), title, type, subject, empty file, extension
(allow-list pdf/docx/pptx/png/jpg), size (10 MB), magic-byte/zip content
check, then SHA-256 duplicate check (409 with the existing title). Only after
all checks pass is the file written under a random uuid name and the row
inserted; any later failure deletes the file, so failed uploads leave no row
and no file.

Visibility: the public library shows approved resources only. A pending or
rejected resource can be opened only by its uploader or a moderator.
Bookmarks list approved resources only. `reject_reason` is exposed only to
the uploader and moderators. No response ever contains an email, file hash,
or server file path.

## Test cases with actual results

Backend pytest (`cd backend && .venv\Scripts\python.exe -m pytest tests -v`):

```
27 passed, 3 warnings in 1.85s
```

All 27 tests passed, covering: valid upload, every validation error message,
duplicate detection by hash, pending-resource visibility rules, bookmark
dedupe, review permissions and state transitions, report creation,
download counting and filename headers, filter combination, LIKE escaping,
email leakage, auth header enforcement, and string-shaped error details.
Full table: `backend/TEST_REPORT.md`.

End-to-end UI test (`cd frontend && node scripts/e2e-check.mjs`, reseeds the
backend first):

```
37/37 checks passed
```

Covers the demo path on the real backend: junior search/filter/save/
download, senior upload success plus .exe / empty / oversize / fake-pdf /
duplicate rejections, moderator reject-without-reason and approve/reject
with reason, the rejected reason visible to the uploader, the approved
resource appearing with a Verified badge, and layout at 375px and 1280px.
Full log: `frontend/scripts/e2e-results.json`.

Clean-start verification: `hub.db` and `uploads/` were deleted, the stack was
restarted from scratch (venv + seed + uvicorn + vite), and `/health`,
`/docs`, the frontend and the `/api` proxy all returned correctly with seeded
data.

## Team contribution

<!-- TODO(team): fill in names and who did what -->
- Name 1: <!-- TODO -->
- Name 2: <!-- TODO -->
- Name 3: <!-- TODO -->

## Limitations and next steps

- **No real authentication** - the "Signed in as" dropdown picks a user id;
  anyone can act as anyone. A real login (e.g. college email + OTP) is the
  top next step.
- **Local file storage** - uploads live on the server's disk under
  `backend/uploads/`; no cloud storage, no virus scanning, no previews.
- **No in-page preview** - files can only be downloaded.
- **Single-process SQLite** - fine for a demo; a client/server database would
  be needed for real scale.
- **Reports are stored but not surfaced** in a moderator UI yet.
- Next steps: real auth, moderation dashboard for reports, file previews,
  pagination on the library, and deployment.

## Exact run instructions

```bash
# Windows: double-click start-demo.bat
# Linux/macOS:
chmod +x start-demo.sh && ./start-demo.sh
```

Then open http://localhost:5173 (API docs at http://localhost:8000/docs).

Manual equivalent:

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
.venv/bin/python -m pip install -r requirements.txt           # Linux/macOS
.venv/Scripts/python.exe seed.py --reset                      # Windows
.venv/bin/python seed.py --reset                              # Linux/macOS
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000  # Windows
.venv/bin/python -m uvicorn app.main:app --port 8000          # Linux/macOS

cd ../frontend
npm install
npm run dev
```

Reset demo data any time: `python backend/seed.py --reset` from the repo
root. Tests: `cd backend && .venv/.../python -m pytest tests -v` and
`cd frontend && node scripts/e2e-check.mjs`.
