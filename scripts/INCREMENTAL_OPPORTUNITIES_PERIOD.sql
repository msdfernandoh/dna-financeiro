-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: Período de validade de oportunidades
-- Arquivo: scripts/INCREMENTAL_OPPORTUNITIES_PERIOD.sql
--
-- Descrição:
--   Adiciona as colunas starts_at e ends_at à tabela public.opportunities
--   para controlar quando cada oportunidade deve ser exibida ao lead.
--
-- Regras de exibição pública:
--   • starts_at NULL → sem restrição de início (exibe imediatamente se active=true)
--   • ends_at NULL   → sem restrição de prazo (exibe indefinidamente)
--   • starts_at NOT NULL → só aparece quando NOW() >= starts_at
--   • ends_at NOT NULL   → deixa de aparecer quando NOW() > ends_at
--
-- Idempotência:
--   Script pode ser executado múltiplas vezes sem efeitos colaterais.
--   Usa ADD COLUMN IF NOT EXISTS e CREATE INDEX IF NOT EXISTS.
--
-- ATENÇÃO: NÃO executar automaticamente. Aplicar manualmente no Supabase.
-- =============================================================================

-- ── Coluna: starts_at ─────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.opportunities.starts_at IS
  'Data/hora de início da exibição (UTC). NULL = sem restrição de início.
   A oportunidade só aparece quando NOW() >= starts_at.
   Útil para pré-cadastrar campanhas e eventos futuros.';

-- ── Coluna: ends_at ───────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.opportunities.ends_at IS
  'Data/hora de fim da exibição (UTC). NULL = sem prazo de expiração.
   A oportunidade deixa de aparecer quando NOW() > ends_at.
   Útil para feirões, vagas temporárias, desafios e campanhas com prazo.';

-- ── Índice composto para queries de período ───────────────────────────────────
-- Cobre os filtros mais comuns: unit_id + active + período
-- Partial index: exclui linhas soft-deleted (deleted_at IS NOT NULL)

CREATE INDEX IF NOT EXISTS idx_opportunities_period
  ON public.opportunities (unit_id, active, starts_at, ends_at)
  WHERE deleted_at IS NULL;

-- ── Verificação pós-migração ──────────────────────────────────────────────────
-- Após executar, rode a query abaixo para confirmar as colunas:
--
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'opportunities'
--   AND column_name  IN ('starts_at', 'ends_at')
-- ORDER BY column_name;
--
-- Resultado esperado:
--   ends_at   | timestamp with time zone | YES | NULL
--   starts_at | timestamp with time zone | YES | NULL
