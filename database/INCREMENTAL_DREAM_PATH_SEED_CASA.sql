-- =============================================================================
-- DNA FINANCEIRO — SEED: dream_path_settings para CASA (imóvel)
-- Arquivo: database/INCREMENTAL_DREAM_PATH_SEED_CASA.sql
-- Versão:  1.1 · Maio 2026 · dream_type = 'casa' apenas (global)
--
-- PRÉ-REQUISITO (colunas extras — não é schema da tabela base):
--   database/INCREMENTAL_DREAM_PATH_SETTINGS_COLUMNS.sql
--   (calculation_mode, average_letter_premium_percent, promo_*, etc.)
--
-- ⚠️  Rodar este arquivo no Supabase SQL Editor após o pré-requisito acima.
--
-- NÃO INCLUI: aposentadoria_imobiliaria, dream_type imovel (investment_type).
--
-- OBJETIVO:
--   Inserir caminhos globais (unit_id NULL) para dream_type = 'casa'.
--   Não altera schema, RLS ou registros existentes (WHERE NOT EXISTS).
--
-- NOTAS:
--   • Não existe dream_type 'imovel' no fluxo de sonho — imóvel = 'casa' ou
--     'aposentadoria_imobiliaria' (sonho separado).
--   • Campos inexistentes: reduced_payment_percent, embedded_bid_percent
--     → usar reduced_installment_amount e bid_percent.
--   • Referência R$ 500.000 · consórcio 220 meses · parcela reduzida R$ 1.710
--     (proportional escala para outras metas no app).
--   • full_installment_amount = R$ 2.850 (ref. parcela cheia no default_amount).
--
-- IDEMPOTENTE: cada INSERT só roda se o trio global não existir.
-- =============================================================================

-- Texto legal padrão (description)
-- Simulação inicial. Não garante aprovação de crédito, contemplação ou ágio.
-- Ágio de carta contemplada é estimativa de mercado. Condições dependem de
-- administradora, contrato, mercado e análise.

-- ── 1. Guardar à vista ───────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type, dream_subtype, unit_id,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  calculation_mode, admin_notes
)
SELECT
  'casa', 'cash_saving', NULL, NULL,
  'Imóvel — Guardar à vista',
  'Guardar mensalmente até juntar o valor. Simulação inicial — sem juros, sem dívida. '
    'Não garante aprovação. Condições dependem de mercado e planejamento pessoal.',
  ARRAY['casa'],
  10, TRUE, FALSE, FALSE,
  80000, 3000000, 500000, 220,
  'proportional',
  'Horizontes no card incluem prazo do consórcio (220m) quando configurado em paralelo.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'casa' AND dream_subtype IS NULL
    AND path_type = 'cash_saving' AND unit_id IS NULL AND deleted_at IS NULL
);

-- ── 2. Investimento ──────────────────────────────────────────────────────────
-- ~1% a.m. equivalente composto ≈ 12,68% a.a. (0.126825)
INSERT INTO public.dream_path_settings (
  dream_type, path_type, dream_subtype, unit_id,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_return_rate, calculation_mode, admin_notes
)
SELECT
  'casa', 'investment', NULL, NULL,
  'Imóvel — Investimento mensal',
  'Projeção com rendimento estimado (~1% a.m. equivalente). Simulação inicial — '
    'rendimento não é garantido. Condições dependem da aplicação e do mercado.',
  ARRAY['casa'],
  20, TRUE, TRUE, TRUE,
  80000, 3000000, 500000, 220,
  0.126825, 'proportional',
  'annual_return_rate ≈ (1,01^12 − 1). Ajustar no admin conforme produto.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'casa' AND dream_subtype IS NULL
    AND path_type = 'investment' AND unit_id IS NULL AND deleted_at IS NULL
);

-- ── 3. Consórcio tradicional ─────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type, dream_subtype, unit_id,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base,
  full_installment_amount, reduced_installment_amount,
  average_letter_premium_percent, calculation_mode, admin_notes
)
SELECT
  'casa', 'consortium_traditional', NULL, NULL,
  'Imóvel — Consórcio tradicional',
  'Consórcio imobiliário por sorteio ou lance. Simulação inicial — '
    'contemplação não é garantida. Ágio de carta contemplada é estimativa (40% médio). '
    'Condições dependem de administradora, contrato, mercado e análise.',
  ARRAY['casa'],
  50, TRUE, FALSE, TRUE,
  100000, 3000000, 500000, 220,
  0.03, 'credit_value',
  2850, 1710,
  0.40, 'proportional',
  'Ref. crédito R$ 500k · 220 meses. reduced_installment_amount = R$ 1.710 (escala proportional). '
  'full_installment_amount = ref. parcela cheia R$ 2.850 no default_amount.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'casa' AND dream_subtype IS NULL
    AND path_type = 'consortium_traditional' AND unit_id IS NULL AND deleted_at IS NULL
);

-- ── 4. Consórcio com lance ───────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type, dream_subtype, unit_id,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base, bid_percent,
  full_installment_amount, reduced_installment_amount,
  average_letter_premium_percent, calculation_mode, admin_notes
)
SELECT
  'casa', 'consortium_with_bid', NULL, NULL,
  'Imóvel — Consórcio com lance',
  'Consórcio com lance para antecipar contemplação. Simulação inicial — '
    'lance e contemplação não são garantidos. Ágio de carta contemplada: estimativa 40%. '
    'Condições dependem de administradora, contrato, mercado e análise.',
  ARRAY['casa'],
  60, TRUE, FALSE, TRUE,
  100000, 3000000, 500000, 220,
  0.03, 'credit_value', 0.25,
  2850, 1710,
  0.40, 'proportional',
  'bid_percent = 25% (ajustar para 40% no admin se regra do produto exigir). '
  'Mesma base de parcelas do consórcio tradicional no default R$ 500k.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'casa' AND dream_subtype IS NULL
    AND path_type = 'consortium_with_bid' AND unit_id IS NULL AND deleted_at IS NULL
);

-- ── 5. Financiamento habitacional ────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type, dream_subtype, unit_id,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_interest_rate, monthly_interest_rate,
  admin_fee_base, down_payment_percent,
  calculation_mode, admin_notes
)
SELECT
  'casa', 'financing', NULL, NULL,
  'Imóvel — Financiamento habitacional',
  'Financiamento com parcelas mensais. Simulação inicial — '
    'sujeito à análise de crédito; aprovação não é garantida. '
    'Condições dependem de banco, contrato, mercado e análise.',
  ARRAY['casa'],
  30, TRUE, FALSE, TRUE,
  100000, 3000000, 500000, 360,
  0.11, 0.008735,
  'financed_amount', 0.20,
  'formula',
  'PMT via monthly_interest_rate (11% a.a. ref.). Ajustar taxas no admin. '
  'Entrada ref. 20% — usar down_payment_percent / parcela reduzida se necessário.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'casa' AND dream_subtype IS NULL
    AND path_type = 'financing' AND unit_id IS NULL AND deleted_at IS NULL
);


-- =============================================================================
-- VALIDAÇÃO (copiar e rodar após os INSERTs)
-- =============================================================================

-- V1 — Cinco caminhos globais ativos
-- SELECT path_type, label, default_amount, term_months,
--        full_installment_amount, reduced_installment_amount,
--        average_letter_premium_percent, calculation_mode, active, unit_id
-- FROM public.dream_path_settings
-- WHERE dream_type = 'casa' AND unit_id IS NULL AND deleted_at IS NULL
-- ORDER BY sort_order;
-- Esperado: 5 linhas · default_amount 500000 · consórcios term_months 220
-- · reduced 1710 · full 2850 (consórcios) · premium 0.40 · unit_id NULL

-- V2 — Contagem e unicidade
-- SELECT COUNT(*) AS total_casa
-- FROM public.dream_path_settings
-- WHERE dream_type = 'casa' AND unit_id IS NULL AND deleted_at IS NULL;
-- Esperado: total_casa = 5

-- SELECT path_type, COUNT(*) AS qtd
-- FROM public.dream_path_settings
-- WHERE dream_type = 'casa' AND unit_id IS NULL AND deleted_at IS NULL
-- GROUP BY path_type
-- HAVING COUNT(*) > 1;
-- Esperado: 0 linhas

-- V3 — Consórcio tradicional (referência R$ 500k)
-- SELECT path_type, term_months, default_amount,
--        full_installment_amount, reduced_installment_amount,
--        calculation_mode, average_letter_premium_percent
-- FROM public.dream_path_settings
-- WHERE dream_type = 'casa' AND path_type = 'consortium_traditional'
--   AND unit_id IS NULL AND deleted_at IS NULL;

-- V4 — Escala proportional esperada no app para meta R$ 750.000
-- SELECT
--   1710.0 * 750000 / 500000 AS reduced_esperado_750k,
--   2850.0 * 750000 / 500000 AS full_esperado_750k;
-- Esperado: 2565 e 4275

-- V5 — Financiamento usa formula + taxa mensal
-- SELECT path_type, calculation_mode, term_months,
--        monthly_interest_rate, annual_interest_rate
-- FROM public.dream_path_settings
-- WHERE dream_type = 'casa' AND path_type = 'financing'
--   AND unit_id IS NULL AND deleted_at IS NULL;
-- Esperado: formula · 360 meses · taxas preenchidas
