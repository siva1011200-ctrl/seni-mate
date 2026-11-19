# Deploying SeniMate to Vercel + Render + Supabase

Target architecture:

```
Browser -> Vercel (React frontend, HTTPS)
              |  VITE_API_URL -> https://<service>.onrender.com
              v
         Render (FastAPI backend, HTTPS)
              |  DATABASE_URL      -> Supabase Postgres
              |  SUPABASE_*        -> Supabase Storage (files)
              v
         Supabase (Postgres + Storage bucket "resources")
```

Everything below uses free tiers. You must perform the account steps
yourself - I cannot create accounts or click through dashboards for you.
Do them in order; each step tells you exactly what to copy.

---

## 0. Prerequisites

- A GitHub account with this repo pushed (see "GitHub" below - your earlier
  token lacked the `repo` scope, so push may still be pending).
- ~30-45 minutes.

---

## 1. Supabase (database + file storage)

1. Go to https://supabase.com -> **Start your project** (free plan, GitHub
   login is fastest).
2. **New project**: pick a name (`senimate`), a database password (save it!),
   and the closest region.
3. Once provisioned, open **Project Settings -> Database** and copy the
   **Connection string -> URI** (the `postgresql://postgres:[password]@...`
   one). Keep it secret - it goes only into Render env vars.
4. Open **SQL Editor -> New query**, paste the entire contents of
   `backend/supabase/schema.sql`, and run it. This creates all tables,
   indexes, and the `resources` storage bucket.
5. Open **Project Settings -> API** and copy:
   - `Project URL`  -> your `SUPABASE_URL` (https://xxxx.supabase.co)
   - `service_role` key (click "Reveal") -> your `SUPABASE_SERVICE_KEY`
     **Never put this key in the frontend or commit it.**

You now have: Postgres schema + a private `resources` bucket that only the
backend (service role) can read/write.

## 2. Render (backend API)

1. Go to https://render.com -> sign up (free) -> **New -> Blueprint** and
   connect your GitHub repo. Render reads `render.yaml` at the repo root and
   configures the `senimate-api` service automatically (root dir `backend`,
   build `pip install -r requirements.txt`, start
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/health`).
   - If Blueprint doesn't pick it up, use **New -> Web Service** manually with
     the same values from `render.yaml`.
2. In the service's **Environment** tab, set:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Supabase connection URI from step 1.3 |
   | `SUPABASE_URL` | https://xxxx.supabase.co |
   | `SUPABASE_SERVICE_KEY` | the service-role key from step 1.5 |
   | `SUPABASE_BUCKET` | `resources` |
   | `ALLOWED_ORIGINS` | `https://<your-app>.vercel.app` (add now if you already deployed frontend; otherwise update after step 3) |
   | `MAX_UPLOAD_MB` | `10` |

3. Deploy. Wait for "Live". Your API URL is
   `https://senimate-api.onrender.com` (or whatever Render assigns - check the
   dashboard). Verify:
   - `https://<api>/health` -> `{"status":"ok"}`
   - `https://<api>/docs` -> Swagger UI
   - `https://<api>/users` -> the 5 demo users? **No** - the database starts
     EMPTY. Seed it in step 4.

   Note: free Render services sleep after ~15 min idle; the first request
   after idle takes ~30-60 s. That's a free-tier limitation, not a bug.

4. Seed the demo data. Two options:
   - Easiest: run locally with the production env vars set:
     ```bash
     cd backend
     DATABASE_URL="postgresql://..." SUPABASE_URL="https://..." \
     SUPABASE_SERVICE_KEY="..." SUPABASE_BUCKET="resources" \
     .venv/Scripts/python.exe seed.py --reset   # Windows
     .venv/bin/python seed.py --reset           # Linux/macOS
     ```
     (PowerShell: set the vars with `$env:DATABASE_URL="..."` first.)
   - Or SSH/console into the Render service shell and run
     `python seed.py --reset` there.

## 3. Vercel (frontend)

1. Go to https://vercel.com -> sign up (free, GitHub login) ->
   **Add New -> Project** -> import your repo.
2. Configure:
   - **Root Directory**: `frontend`  (click "Edit" next to Root Directory)
   - Framework: Vite (auto-detected)
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Environment Variables** (expand the section before deploying):

   | Variable | Value |
   |---|---|
   | `VITE_USE_MOCK` | `false` |
   | `VITE_API_URL` | `https://<your-render-service>.onrender.com` (no `/api`, no trailing slash) |

4. Deploy. You get `https://<project>.vercel.app`.
5. Go back to **Render -> Environment** and set
   `ALLOWED_ORIGINS=https://<project>.vercel.app`, then redeploy (or wait for
   the next deploy - env changes need a redeploy: Manual Deploy -> Deploy
   latest commit, or just push any commit).

## 4. Verify the live site

Open `https://<project>.vercel.app` and repeat the demo flow:

1. Junior (Karthik, default): search, filter, open a resource, Download file
   (real file from Supabase Storage), Save for later.
2. Senior (Arun) -> Upload: `backend/demo_files/valid-notes.pdf` succeeds
   (Pending review); `program.exe`, `empty.pdf`, `too-big.pdf`, `fake.pdf`
   each show their exact error.
3. Moderator (Priya) -> Review queue -> approve -> junior sees it with the
   Verified badge.
4. Check `https://<api>.onrender.com/docs` for the Swagger UI.

If downloads 404 after a Render redeploy: they won't - files live in Supabase
Storage, not on the container disk.

---

## Environment variable reference (names only - values are secrets)

Backend (Render):

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection URI |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | service-role key; bypasses RLS; backend only |
| `SUPABASE_BUCKET` | storage bucket name (`resources`) |
| `ALLOWED_ORIGINS` | comma-separated frontend origins allowed by CORS |
| `MAX_UPLOAD_MB` | upload size cap (default 10) |
| `DB_PATH`, `UPLOAD_DIR` | local-dev only; ignored when the above are set |

Frontend (Vercel - all public, none are secrets):

| Name | Purpose |
|---|---|
| `VITE_USE_MOCK` | `false` for production |
| `VITE_API_URL` | backend origin, e.g. `https://senimate-api.onrender.com` |

## GitHub

The repo must be on GitHub before Render/Vercel can import it:

```bash
git remote add origin https://github.com/<you>/seni-mate.git
git push -u origin main
```

Your earlier token lacked the `repo` scope - generate a new classic PAT with
`repo` checked (github.com/settings/tokens) and `gh auth login`, or push via
GitHub Desktop / the web UI.

## Free-tier limitations (honest list)

- Render free: sleeps after ~15 min idle (cold start ~30-60 s), 512 MB RAM,
  **ephemeral disk** - which is exactly why uploads go to Supabase Storage.
- Vercel free (Hobby): fine for a class project; non-commercial use.
- Supabase free: 500 MB database, 1 GB storage - plenty for a demo.
- Supabase free projects pause after ~1 week of inactivity.
- No real authentication anywhere - the user switcher is still a demo.
