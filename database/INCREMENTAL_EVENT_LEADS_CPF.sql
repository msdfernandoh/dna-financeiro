-- ============================================================
-- INCREMENTAL_EVENT_LEADS_CPF.sql
-- Adiciona coluna cpf à tabela event_leads.
-- Idempotente — seguro rodar múltiplas vezes.
-- ============================================================

ALTER TABLE public.event_leads
  ADD COLUMN IF NOT EXISTS cpf text;
