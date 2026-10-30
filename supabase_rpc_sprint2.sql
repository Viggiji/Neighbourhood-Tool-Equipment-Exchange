-- ============================================================
-- NTEE — Sprint 2 PostgreSQL RPC Functions
-- Run AFTER supabase_schema_sprint2.sql
-- These are called via db.rpc() from the Node.js backend.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- create_borrow_request(…)
-- Atomically checks for overlapping requests/rentals and inserts.
-- RAISES an exception with 'overlapping' in the message if a
-- conflict is detected — the Node layer surfaces this as a 409.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_borrow_request(
  p_tool_id     BIGINT,
  p_borrower_id BIGINT,
  p_owner_id    BIGINT,
  p_start_date  DATE,
  p_end_date    DATE,
  p_message     TEXT DEFAULT NULL
)
RETURNS borrow_requests
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_count INTEGER;
  new_request   borrow_requests;
BEGIN
  -- Lock: count accepted/pending requests whose date ranges overlap.
  -- Two ranges [A,B] and [C,D] overlap when A <= D AND C <= B.
  SELECT COUNT(*) INTO overlap_count
  FROM borrow_requests
  WHERE tool_id    = p_tool_id
    AND status    IN ('pending', 'accepted')
    AND start_date <= p_end_date
    AND end_date   >= p_start_date;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'overlapping booking detected for tool % between % and %',
      p_tool_id, p_start_date, p_end_date;
  END IF;

  INSERT INTO borrow_requests (tool_id, borrower_id, owner_id, start_date, end_date, message)
  VALUES (p_tool_id, p_borrower_id, p_owner_id, p_start_date, p_end_date, p_message)
  RETURNING * INTO new_request;

  RETURN new_request;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- accept_borrow_request(p_request_id)
-- Atomically:
--   1. Updates borrow_request status → 'accepted'
--   2. Rejects all other pending requests for the same tool
--      that overlap with the accepted window
--   3. Inserts a rental row
--   4. Updates the tool status → 'Rented'
-- Returns the new rental row.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_borrow_request(p_request_id BIGINT)
RETURNS rentals
LANGUAGE plpgsql
AS $$
DECLARE
  req         borrow_requests;
  new_rental  rentals;
BEGIN
  -- Fetch & lock the request row
  SELECT * INTO req FROM borrow_requests WHERE id = p_request_id FOR UPDATE;

  IF req IS NULL THEN
    RAISE EXCEPTION 'borrow_request % not found', p_request_id;
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'request % is already %', p_request_id, req.status;
  END IF;

  -- 1. Accept this request
  UPDATE borrow_requests
     SET status = 'accepted', updated_at = NOW()
   WHERE id = p_request_id;

  -- 2. Auto-reject overlapping pending requests for the same tool
  UPDATE borrow_requests
     SET status = 'rejected', updated_at = NOW()
   WHERE tool_id   = req.tool_id
     AND id       <> p_request_id
     AND status    = 'pending'
     AND start_date <= req.end_date
     AND end_date   >= req.start_date;

  -- 3. Create the rental
  INSERT INTO rentals (borrow_request_id, tool_id, borrower_id, owner_id, start_date, due_date)
  VALUES (req.id, req.tool_id, req.borrower_id, req.owner_id, req.start_date, req.end_date)
  RETURNING * INTO new_rental;

  -- 4. Mark tool as Rented
  UPDATE tools SET status = 'Rented', updated_at = NOW() WHERE id = req.tool_id;

  RETURN new_rental;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- get_owner_trust_score(p_owner_id)
-- Returns a weighted average rating for an owner.
-- Used by the Reviews module to surface the trust score.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_owner_trust_score(p_owner_id BIGINT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
  FROM reviews
  WHERE reviewee_id = p_owner_id;
$$;
