-- ============================================================
-- Migration 4: transfer transactions
-- Paste into Supabase Dashboard → SQL Editor → Run (idempotent)
--
-- Allows type='transfer' so moving money between accounts is
-- recorded as transactions (excluded from income/expense math).
-- Outgoing rows store a negative amount, incoming positive.
-- ============================================================

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'transfer'));

-- links the two sides of a transfer so the app shows them as ONE entry
-- in the transactions list (each account's history shows its own side)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_group UUID;
