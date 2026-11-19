# SeniMate

Campus knowledge-sharing platform for the hackathon. Seniors upload notes,
previous papers and preparation tips; moderators review them; juniors search,
download and save them.

- `frontend/` - React 18 + Vite + plain CSS
- `backend/` - FastAPI + SQLite (standard-library `sqlite3`, no ORM)
- `docs/PROJECT_REPORT.md` - full project report

## Prerequisites

- Python 3.10+ (`python` on Windows, `python3` on Linux/macOS)
- Node.js 18+ and npm
- (Optional, for tests) pytest is included in `backend/requirements.txt`;
  Playwright e2e needs `frontend/node_modules` installed and Microsoft Edge
  or Chrome on the machine.

## First-time setup and run

**Windows:** double-click `start-demo.bat`

**Linux / macOS:**

```bash
chmod +x start-demo.sh
./start-demo.sh
```

The script creates the backend virtualenv, installs Python and npm
dependencies if missing, resets and seeds the demo database, then starts:

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

## Demo users

Pick one in the "Signed in as" dropdown (top right of the app):

| User | Role | Department |
|------|------|------------|
| Karthik R | junior | CSE |
| Meena P | junior | AI&DS |
| Arun Kumar | senior | CSE |
| Divya S | senior | AI&DS |
| Priya N | moderator | CSE |

## Demo script

1. As **Karthik (junior)**: search "Data" on the home page, open a resource,
   Download file, Save for later.
2. Switch to **Arun (senior)** -> Upload: try `backend/demo_files/program.exe`
   (rejected), `empty.pdf` (rejected), `too-big.pdf` (rejected), `fake.pdf`
   (content mismatch), then `valid-notes.pdf` or `notes.docx` -> shows
   "Submitted for review" / Pending review. Upload the same file again to see
   the duplicate error. Check My uploads.
3. Switch to **Priya (moderator)** -> Review queue: reject an item with a
   reason, approve another.
4. Switch back to **Karthik**: the approved resource now appears in Explore
   Resources with a Verified badge; the rejected one does not.

## Resetting demo data

```bash
# from repo root
backend/.venv/Scripts/python.exe backend/seed.py --reset   # Windows
backend/.venv/bin/python backend/seed.py --reset           # Linux/macOS
```

This drops `backend/hub.db`, deletes `backend/uploads/*` and reseeds.

## Switching the frontend between mock and real backend

`frontend/.env` controls it:

- `VITE_USE_MOCK=false` - real backend (current default for the full stack)
- `VITE_USE_MOCK=true` - built-in mock data, no backend needed

After changing it, restart `npm run dev` in `frontend/`.

## Running the tests

Backend unit/API tests (temporary DB, never touches real data):

```bash
cd backend
.venv/Scripts/python.exe -m pytest tests -v        # Windows
.venv/bin/python -m pytest tests -v                # Linux/macOS
```

End-to-end UI test (needs backend on :8000 and frontend dev server on :5173;
it reseeds the DB itself first):

```bash
cd frontend
node scripts/e2e-check.mjs
```

## Configuration (environment variables)

| Variable | Default | Meaning |
|----------|---------|---------|
| `DB_PATH` | `backend/hub.db` | SQLite database file |
| `UPLOAD_DIR` | `backend/uploads` | where uploaded files are stored |
| `MAX_UPLOAD_MB` | `10` | upload size limit |

## Project layout

```
frontend/          React app (see frontend/README.md)
backend/
  app/             FastAPI app: main.py, database.py, validators.py, storage.py
  tests/           pytest suite
  tools/           make_demo_files.py (creates backend/demo_files/)
  uploads/         stored uploads (git-ignored)
  seed.py          demo data seed (--reset to rebuild)
  hub.db           SQLite database (git-ignored)
docs/PROJECT_REPORT.md
start-demo.bat / start-demo.sh
```
