-- ============================================================
-- INCREMENTAL_EVENT_LEADS_SITUACAO.sql
-- Adiciona coluna situacao à tabela event_leads.
-- Idempotente — seguro rodar múltiplas vezes.
-- ============================================================

ALTER TABLE public.event_leads
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'enviar_proposta'
    CHECK (situacao IN (
      'enviar_proposta',
      'proposta_enviada',
      'aguardando_documentacao',
      'documentacao_enviada',
      'aprovado'
    ));
