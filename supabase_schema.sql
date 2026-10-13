-- ============================================================
-- NTEE — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  full_name      TEXT      NOT NULL,
  email          TEXT      NOT NULL UNIQUE,
  password_hash  TEXT      NOT NULL,
  block_code     TEXT      NOT NULL,
  role           TEXT      NOT NULL DEFAULT 'neighbor',
  is_verified    BOOLEAN   NOT NULL DEFAULT FALSE,
  verify_token   TEXT,
  login_attempts INTEGER   NOT NULL DEFAULT 0,
  locked_until   TIMESTAMPTZ,
  remember_token TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tools table
CREATE TABLE IF NOT EXISTS tools (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT      NOT NULL,
  category       TEXT      NOT NULL,
  description    TEXT      NOT NULL,
  condition      TEXT      NOT NULL DEFAULT 'Good',
  deposit_amount NUMERIC   NOT NULL DEFAULT 0,
  status         TEXT      NOT NULL DEFAULT 'Available',
  image_url      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_tools_user   ON tools(user_id);

-- ─── Row Level Security (RLS) ────────────────────────────────
-- We use the service role key on the server, so disable RLS
-- (our Express server enforces auth itself).
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tools DISABLE ROW LEVEL SECURITY;
