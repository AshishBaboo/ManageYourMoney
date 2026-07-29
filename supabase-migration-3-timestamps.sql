-- ============================================================
-- Migration 3: timestamps, custom ordering, saved preferences
-- Paste into Supabase Dashboard → SQL Editor → Run (idempotent)
--
-- 1. transactions.occurred_at — every transaction shows date AND
--    time ("01-07-2026 03:54 PM"), existing rows get noon.
-- 2. categories.sort_order — drag-to-reorder categories and
--    subcategories, position saved per user.
-- 3. users.theme / users.currency — dark mode + currency follow
--    your account on any device.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP;

UPDATE public.transactions
  SET occurred_at = (date::timestamp + interval '12 hours')
  WHERE occurred_at IS NULL;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS sort_order INT;

-- seed existing rows in their creation order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, type, parent_id ORDER BY created_at) * 10 AS rn
  FROM public.categories
)
UPDATE public.categories c
  SET sort_order = ranked.rn
  FROM ranked
  WHERE c.id = ranked.id AND c.sort_order IS NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- 4. Favorite account — starred account is pre-selected in transaction forms
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
