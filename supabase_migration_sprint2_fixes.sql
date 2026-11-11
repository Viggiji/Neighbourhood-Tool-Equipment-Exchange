-- ============================================================
-- NTEE — Sprint 2 Schema Migration (Run on existing Supabase DB)
-- Safe & idempotent: upgrades Sprint 2 tables for:
--   1. Return handback checklist + owner confirmation ('return_submitted')
--   2. Two-way reviews (borrower ↔ owner per completed rental)
-- ============================================================

-- 1. Rentals: add handback verification columns & expand status check
ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS return_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_checklist    JSONB,
  ADD COLUMN IF NOT EXISTS return_note         TEXT;

ALTER TABLE rentals DROP CONSTRAINT IF EXISTS chk_rental_status;
ALTER TABLE rentals
  ADD CONSTRAINT chk_rental_status
  CHECK (status IN ('active','return_submitted','returned','overdue'));

-- 2. Reviews: allow two-way rating (one per reviewer per rental)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rental_id_key;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS uq_review_per_party;
ALTER TABLE reviews
  ADD CONSTRAINT uq_review_per_party UNIQUE (rental_id, reviewer_id);
