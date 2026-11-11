-- ============================================================
-- NTEE — Sprint 2 Schema Setup & Migration (Safe & Idempotent)
-- Run AFTER supabase_schema.sql (Sprint 1: users, tools)
-- Works on BOTH:
--   • A fresh Sprint 1 database (creates all Sprint 2 tables)
--   • An existing Sprint 2 database (upgrades rentals & reviews)
-- ============================================================

-- 1. Ensure Sprint 2 tables exist
CREATE TABLE IF NOT EXISTS borrow_requests (
  id              BIGSERIAL     PRIMARY KEY,
  tool_id         BIGINT        NOT NULL REFERENCES tools(id)  ON DELETE CASCADE,
  borrower_id     BIGINT        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  owner_id        BIGINT        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  start_date      DATE          NOT NULL,
  end_date        DATE          NOT NULL,
  message         TEXT,
  status          TEXT          NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dates          CHECK (end_date >= start_date),
  CONSTRAINT chk_no_self_borrow CHECK (borrower_id <> owner_id),
  CONSTRAINT chk_req_status     CHECK (status IN ('pending','accepted','rejected','cancelled'))
);

CREATE TABLE IF NOT EXISTS rentals (
  id                   BIGSERIAL   PRIMARY KEY,
  borrow_request_id    BIGINT      NOT NULL UNIQUE REFERENCES borrow_requests(id) ON DELETE CASCADE,
  tool_id              BIGINT      NOT NULL REFERENCES tools(id)  ON DELETE CASCADE,
  borrower_id          BIGINT      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  owner_id             BIGINT      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  start_date           DATE        NOT NULL,
  due_date             DATE        NOT NULL,
  return_submitted_at  TIMESTAMPTZ,
  return_checklist     JSONB,
  return_note          TEXT,
  returned_at          TIMESTAMPTZ,
  status               TEXT        NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rental_status  CHECK (status IN ('active','return_submitted','returned','overdue'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id          BIGSERIAL   PRIMARY KEY,
  rental_id   BIGINT      NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  reviewer_id BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id     BIGINT      NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_review_per_party UNIQUE (rental_id, reviewer_id),
  CONSTRAINT chk_rating          CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_no_self_review  CHECK (reviewer_id <> reviewee_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  entity_id   BIGINT,
  entity_type TEXT,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Upgrade existing Sprint 2 rentals table (if created before fixes)
ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS return_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_checklist    JSONB,
  ADD COLUMN IF NOT EXISTS return_note         TEXT;

ALTER TABLE rentals DROP CONSTRAINT IF EXISTS chk_rental_status;
ALTER TABLE rentals
  ADD CONSTRAINT chk_rental_status
  CHECK (status IN ('active','return_submitted','returned','overdue'));

-- 3. Upgrade existing Sprint 2 reviews table for two-way ratings
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rental_id_key;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS uq_review_per_party;
ALTER TABLE reviews
  ADD CONSTRAINT uq_review_per_party UNIQUE (rental_id, reviewer_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_requests_tool       ON borrow_requests(tool_id);
CREATE INDEX IF NOT EXISTS idx_requests_borrower   ON borrow_requests(borrower_id);
CREATE INDEX IF NOT EXISTS idx_requests_owner      ON borrow_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON borrow_requests(status);
CREATE INDEX IF NOT EXISTS idx_rentals_status      ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_due_date    ON rentals(due_date);
CREATE INDEX IF NOT EXISTS idx_rentals_borrower    ON rentals(borrower_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee    ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user_unread  ON notifications(user_id, is_read);

-- 5. Disable RLS (server enforces auth)
ALTER TABLE borrow_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE rentals         DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews         DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   DISABLE ROW LEVEL SECURITY;
