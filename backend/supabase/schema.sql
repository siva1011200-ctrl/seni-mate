-- SeniMate schema for Supabase Postgres.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('senior', 'junior', 'moderator')),
    year INTEGER
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    semester INTEGER NOT NULL,
    department TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('notes', 'previous_paper', 'tips')),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    uploader_id INTEGER NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reject_reason TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    created_at TEXT NOT NULL,
    UNIQUE (user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id),
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_subject ON resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);

-- Storage bucket for uploaded resource files.
-- The backend uses the service-role key, which bypasses RLS, so no storage
-- policies are strictly required; the bucket just needs to exist and be public
-- is NOT required (backend downloads via authenticated endpoint).
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false)
ON CONFLICT (id) DO NOTHING;

-- Optional: allow the service role full access explicitly (defensive; the
-- service role already bypasses RLS).
-- No anon/authenticated policies are created on purpose: only the backend
-- (service role) should touch this bucket.
