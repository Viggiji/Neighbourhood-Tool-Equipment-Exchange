-- ============================================================
-- NTEE — Sprint 2 Schema Extension
-- Adds: borrow_requests, rentals, reviews, notifications
-- Run AFTER supabase_schema.sql in the Supabase SQL Editor
-- ============================================================

-- ─── ENUM-style check constraints ────────────────────────────
-- borrow_requests.status  → pending | accepted | rejected | cancelled
-- rentals.status          → active  | returned | overdue
-- reviews.rating          → 1..5

-- ─── borrow_requests ─────────────────────────────────────────
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

  -- Dates must be sane
  CONSTRAINT chk_dates          CHECK (end_date >= start_date),
  -- Self-borrow guard
  CONSTRAINT chk_no_self_borrow CHECK (borrower_id <> owner_id),
  -- Valid status values
  CONSTRAINT chk_req_status     CHECK (status IN ('pending','accepted','rejected','cancelled'))
);

-- ─── rentals ─────────────────────────────────────────────────
-- Created atomically when an owner accepts a borrow_request
CREATE TABLE IF NOT EXISTS rentals (
  id                  BIGSERIAL   PRIMARY KEY,
  borrow_request_id   BIGINT      NOT NULL UNIQUE REFERENCES borrow_requests(id) ON DELETE CASCADE,
  tool_id             BIGINT      NOT NULL REFERENCES tools(id)  ON DELETE CASCADE,
  borrower_id         BIGINT      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  owner_id            BIGINT      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  start_date          DATE        NOT NULL,
  due_date            DATE        NOT NULL,
  returned_at         TIMESTAMPTZ,
  status              TEXT        NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rental_status  CHECK (status IN ('active','returned','overdue'))
);

-- ─── reviews ─────────────────────────────────────────────────
-- A borrower leaves one review per completed rental
CREATE TABLE IF NOT EXISTS reviews (
  id          BIGSERIAL   PRIMARY KEY,
  rental_id   BIGINT      NOT NULL UNIQUE REFERENCES rentals(id) ON DELETE CASCADE,
  reviewer_id BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id     BIGINT      NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rating         CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_no_self_review CHECK (reviewer_id <> reviewee_id)
);

-- ─── notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,   -- e.g. 'BOOKING_REQUESTED', 'BOOKING_ACCEPTED', 'OVERDUE'
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  entity_id   BIGINT,                 -- polymorphic: request_id / rental_id etc.
  entity_type TEXT,                   -- 'borrow_request' | 'rental' | ...
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_tool       ON borrow_requests(tool_id);
CREATE INDEX IF NOT EXISTS idx_requests_borrower   ON borrow_requests(borrower_id);
CREATE INDEX IF NOT EXISTS idx_requests_owner      ON borrow_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON borrow_requests(status);
CREATE INDEX IF NOT EXISTS idx_rentals_status      ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_due_date    ON rentals(due_date);
CREATE INDEX IF NOT EXISTS idx_rentals_borrower    ON rentals(borrower_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee    ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user_unread  ON notifications(user_id, is_read);

-- ─── Disable RLS (server enforces auth) ─────────────────────
ALTER TABLE borrow_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE rentals         DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews         DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   DISABLE ROW LEVEL SECURITY;
