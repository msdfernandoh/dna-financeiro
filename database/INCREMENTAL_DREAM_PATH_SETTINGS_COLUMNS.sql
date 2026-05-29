-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: colunas extras em dream_path_settings
-- Arquivo: database/INCREMENTAL_DREAM_PATH_SETTINGS_COLUMNS.sql
--
-- Contexto: INCREMENTAL_DREAM_PATH_SETTINGS.sql criou a tabela base.
-- O app (admin + /sonho) usa colunas adicionais que não estavam no CREATE TABLE.
-- Rodar ANTES de seeds/admin que usam calculation_mode, ágio, promo, Plano Pontual.
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS
-- Não altera RLS. Não apaga dados.
-- =============================================================================

-- Modo de cálculo de parcela (fixed | proportional | formula)
ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS calculation_mode TEXT;

COMMENT ON COLUMN public.dream_path_settings.calculation_mode IS
  'fixed | proportional | formula. NULL = proportional (compat.)';

-- Plano Pontual / grupo
ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS group_size SMALLINT;

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS draws_per_month SMALLINT;

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS required_paid_installments_for_credit SMALLINT;

-- Carta contemplada (ágio médio estimado — decimal, ex: 0.40 = 40%)
ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS average_letter_premium_percent NUMERIC(5,4);

COMMENT ON COLUMN public.dream_path_settings.average_letter_premium_percent IS
  'Ágio médio estimado venda carta contemplada (0.40 = 40%). Não é garantia.';

-- Promoção por período
ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS promo_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS promo_label TEXT;

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS promo_starts_at TIMESTAMPTZ;

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ;

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS promo_admin_fee_rate NUMERIC(8,6);

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS promo_installment_amount NUMERIC(12,2);

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS promo_reduced_installment_amount NUMERIC(12,2);

-- CHECK calculation_mode (idempotente: só adiciona se constraint não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_dpath_calculation_mode'
      AND conrelid = 'public.dream_path_settings'::regclass
  ) THEN
    ALTER TABLE public.dream_path_settings
      ADD CONSTRAINT ck_dpath_calculation_mode CHECK (
        calculation_mode IS NULL
        OR calculation_mode IN ('fixed', 'proportional', 'formula')
      );
  END IF;
END $$;

-- Validação:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'dream_path_settings'
--   AND column_name IN (
--     'calculation_mode', 'group_size', 'draws_per_month',
--     'required_paid_installments_for_credit', 'average_letter_premium_percent',
--     'promo_active', 'promo_label', 'promo_starts_at', 'promo_ends_at',
--     'promo_admin_fee_rate', 'promo_installment_amount', 'promo_reduced_installment_amount'
--   )
-- ORDER BY column_name;
-- Esperado: 12 linhas
