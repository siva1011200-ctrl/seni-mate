# SeniMate frontend

Campus knowledge-sharing frontend for the hackathon. React 18 + Vite + plain CSS. No router
library - page state lives in `src/App.jsx`.

## Install and run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Demo mode vs real backend

Everything is switched by `VITE_USE_MOCK` in `.env`:

- `VITE_USE_MOCK=false` (current `.env`): real backend. All calls go to `/api` on the
  Vite dev server, which proxies to `http://localhost:8000` and strips the `/api`
  prefix (see `vite.config.js`). Every request sends the `X-User-Id` header of the
  user picked in the "Signed in as" dropdown. Start the backend first
  (`cd ../backend`, `.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`
  on Windows) after running `python seed.py --reset` once.
- `VITE_USE_MOCK=true`: built-in fake backend in `src/services/mockData.js`.
  Data is in-memory, so uploads, approvals, rejects, bookmarks and download counts
  really change during the session but reset on reload. A "Demo mode" banner is shown.

To switch back to the real backend: make sure it is running on port 8000, set
`VITE_USE_MOCK=false` in `.env`, restart `npm run dev`.

## Folder structure

```
frontend/
  index.html               fonts + root element
  vite.config.js           dev proxy /api -> http://localhost:8000
  .env                     VITE_USE_MOCK=true
  src/
    main.jsx               entry point
    App.jsx                page state, user switching, role guards, toast, demo banner
    services/
      api.js               THE ONLY file that talks to the backend (real fetch or mock)
      mockData.js          in-memory fake backend following the API contract
      format.js            type/status labels and date formatting
      toast.js             tiny toast event helper
    components/            TopBar, SubBar, Footer, Logo, ResourceRow, StatusBadge
    pages/                 Home, Library, Details, Upload, MyUploads, Moderator,
                           Saved, Connect, About (one file per page)
    styles/app.css         all styles (blue/white theme, responsive)
  scripts/
    e2e-check.mjs          Playwright smoke test (needs dev server on :5173)
    e2e-results.json       last run output
```

## Running the smoke test

Requires the dev server running (`npm run dev`) and Microsoft Edge or Chrome installed
(playwright-core drives the installed browser, no download needed):

```bash
node scripts/e2e-check.mjs
```

It walks the full demo path: junior search/filter/save/download, senior upload validation
and duplicate detection, moderator review queue approve/reject, and layout checks at
375px and 1280px. Exit code 0 means every check passed.
