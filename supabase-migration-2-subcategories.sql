-- ============================================================
-- Migration 2: Subcategories support (iSaveMoney model)
-- Paste into Supabase Dashboard → SQL Editor → Run (idempotent)
--
-- Categories become a 2-level tree: parent_id NULL = top-level
-- category, parent_id set = subcategory. Budgets/transactions can
-- attach to either level; the app rolls subcategory spend up into
-- the parent. Existing data is unaffected.
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
