-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: dream_path_settings
-- Arquivo: database/INCREMENTAL_DREAM_PATH_SETTINGS.sql
-- Versão:  1.0 · Maio 2026
-- Bloco:   SONHO — Caminhos Financeiros por Produto
--
-- ⚠️  PROPOSTA — NÃO EXECUTAR sem autorização do responsável pelo projeto.
--
-- OBJETIVO:
--   Criar dream_path_settings para configurar produtos financeiros (path_types)
--   separados por dream_type + path_type, permitindo que cada produto tenha
--   regras, taxas e mecânicas próprias — sem misturar tudo em dream_plan_settings.
--
-- POR QUE NOVA TABELA (e não expandir dream_plan_settings):
--
--   PROBLEMA 1 — UNIQUE INDEX incompatível com múltiplos produtos:
--     dream_plan_settings tem UNIQUE INDEX em (dream_type, dream_subtype).
--     Só cabe UM registro por tipo+subtipo. É impossível ter, para o mesmo
--     dream_type='carro', um row para financing, outro para consortium_traditional,
--     outro para consortium_programmed_date — sem mudar o índice e a semântica
--     da tabela atual.
--
--   PROBLEMA 2 — Campos mutuamente exclusivos por produto:
--     • Plano Pontual precisa de programmed_contemplation_month,
--       anticipation_start_month, anticipation_installments
--     • Financiamento precisa de monthly_interest_rate, annual_interest_rate
--     • Consórcio com lance precisa de bid_percent
--     • Investimento precisa de annual_return_rate
--     Uma única tabela genérica teria a maioria dos campos NULL por row,
--     sem semântica clara de qual campo pertence a qual produto.
--
--   RETROCOMPATIBILIDADE:
--     dream_plan_settings continua intacta e em uso pelo código atual.
--     Nenhuma coluna, índice ou dado existente é alterado.
--     O código pode consultar dream_path_settings em paralelo e usá-la
--     progressivamente — sem quebrar o que existe.
--
-- PATH_TYPES SUPORTADOS:
--   cash_saving               Poupança direta / guardar à vista
--   investment                Investimento com rendimento (não garantido)
--   financing                 Financiamento bancário
--   cdc                       CDC / Crédito Direto ao Consumidor
--   investment_plus_cdc       Investimento + CDC (estratégia híbrida)
--   consortium_traditional    Consórcio tradicional (contemplação por sorteio)
--   consortium_with_bid       Consórcio com lance
--   consortium_programmed_date Plano Pontual — Contemplação programada
--
-- PLANO PONTUAL — REGRAS ESPECÍFICAS:
--   path_type = 'consortium_programmed_date'
--   Elegível: carro e caminhao
--   Contemplação programada em até 24 meses (conforme regra do plano)
--   A partir do 6º mês: cliente pode antecipar 18 parcelas
--   O app calcula:
--     • Parcela estimada
--     • Valor pago até o 6º mês (6 × parcela)
--     • Valor para antecipar 18 parcelas (18 × parcela)
--     • Desembolso total estimado (24 × parcela)
--     • Comparação com poupança direta
--   Linguagem obrigatória:
--     "contemplação programada conforme regra do plano"
--     "simulação inicial"
--     "condições dependem do contrato, administradora e produto"
--
-- IDEMPOTENTE:
--   CREATE TABLE IF NOT EXISTS
--   CREATE INDEX IF NOT EXISTS
--   DROP POLICY IF EXISTS antes de recriar
--   DROP TRIGGER IF EXISTS antes de recriar
--   Seeds via INSERT...WHERE NOT EXISTS (idempotente — sem truncate)
--
-- COMO RODAR (Dashboard Supabase → SQL Editor):
--   Passo 1: Colar e rodar PASSO 1 (CREATE TABLE)
--   Passo 2: Colar e rodar PASSO 2 (índices)
--   Passo 3: Colar e rodar PASSO 3 (RLS)
--   Passo 4: Colar e rodar PASSO 4 (trigger)
--   Passo 5: Colar e rodar PASSO 5 (seeds carro)
--   Passo 6: Colar e rodar PASSO 6 (seeds caminhão)
--   Passo 7: (Opcional) seeds outros tipos
--   Passo 8: Colar e rodar PASSO 8 (validação)
--
-- NÃO ALTERA:
--   dream_plan_settings · leads · expenses · investments · dreams · units
--   Nenhuma coluna existente em qualquer tabela é modificada.
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Criar tabela dream_path_settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dream_path_settings (

  -- ── Identidade ──────────────────────────────────────────────────────────────
  id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Classificação do produto ────────────────────────────────────────────────
  -- (dream_type, COALESCE(dream_subtype,''), path_type) é a chave de negócio
  -- enforçada pelo índice único uidx_dream_path_type_subtype_path abaixo.
  dream_type                      TEXT          NOT NULL,
  dream_subtype                   TEXT,                    -- NULL = vale para todos os subtipos
  path_type                       TEXT          NOT NULL,  -- valores controlados pelo CHECK abaixo

  -- ── Display ─────────────────────────────────────────────────────────────────
  label                           TEXT          NOT NULL,
  description                     TEXT,

  -- ── Elegibilidade informativa ────────────────────────────────────────────────
  -- Não usada no lookup principal (que filtra por dream_type do row).
  -- Documenta para quais tipos de sonho este caminho é relevante no geral.
  -- Ex: Plano Pontual → ARRAY['carro','caminhao']
  eligible_dream_types            TEXT[],

  -- ── Controle de exibição ────────────────────────────────────────────────────
  active                          BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order                      SMALLINT      NOT NULL DEFAULT 0,
  show_capital_gain               BOOLEAN       NOT NULL DEFAULT FALSE,
  show_total_cost                 BOOLEAN       NOT NULL DEFAULT TRUE,

  -- ── Faixa e valores padrão ──────────────────────────────────────────────────
  min_amount                      NUMERIC(14,2) CHECK (min_amount                    >= 0),
  max_amount                      NUMERIC(14,2) CHECK (max_amount                    >= 0),
  default_amount                  NUMERIC(14,2) CHECK (default_amount                >= 0),
  default_monthly_contribution    NUMERIC(14,2) CHECK (default_monthly_contribution  >= 0),

  -- ── Prazo ───────────────────────────────────────────────────────────────────
  term_months                     SMALLINT      CHECK (term_months > 0),

  -- ── Taxas — frações decimais (ex: 0.12 = 12% a.a., 0.01386 = 1,386% a.m.) ─
  annual_return_rate              NUMERIC(8,6)  CHECK (annual_return_rate            >= 0),
  monthly_interest_rate           NUMERIC(8,6)  CHECK (monthly_interest_rate         >= 0),
  annual_interest_rate            NUMERIC(8,6)  CHECK (annual_interest_rate          >= 0),
  total_interest_rate             NUMERIC(8,6)  CHECK (total_interest_rate           >= 0),
  admin_fee_rate                  NUMERIC(8,6)  CHECK (admin_fee_rate                >= 0),
  insurance_rate                  NUMERIC(8,6)  CHECK (insurance_rate                >= 0),

  -- ── Bases de cálculo ────────────────────────────────────────────────────────
  -- admin_fee_base: sobre qual valor a taxa de adm incide
  admin_fee_base                  TEXT,
  -- Reajuste anual do crédito (ex: consórcio corrigido por INPC)
  credit_adjustment_rate_annual   NUMERIC(8,6)  CHECK (credit_adjustment_rate_annual >= 0),
  credit_adjustment_base          TEXT,

  -- ── Entrada e lance ─────────────────────────────────────────────────────────
  -- down_payment_percent: 0.30 = 30% de entrada
  down_payment_percent            NUMERIC(5,4)  CHECK (down_payment_percent          BETWEEN 0 AND 1),
  -- bid_percent: percentual de lance embutido no cálculo
  bid_percent                     NUMERIC(5,4)  CHECK (bid_percent                   BETWEEN 0 AND 1),

  -- ── Consórcio com contemplação programada (Plano Pontual) ───────────────────
  programmed_contemplation_month  SMALLINT      CHECK (programmed_contemplation_month >  0),
  anticipation_start_month        SMALLINT      CHECK (anticipation_start_month       >  0),
  anticipation_installments       SMALLINT      CHECK (anticipation_installments      >  0),

  -- ── Parcelas de referência ──────────────────────────────────────────────────
  -- installment_amount:         parcela genérica de referência
  -- full_installment_amount:    parcela cheia (sem entrada / sem redução)
  -- reduced_installment_amount: parcela reduzida (com entrada, lance embutido, etc.)
  installment_amount              NUMERIC(12,2) CHECK (installment_amount             >= 0),
  reduced_installment_amount      NUMERIC(12,2) CHECK (reduced_installment_amount     >= 0),
  full_installment_amount         NUMERIC(12,2) CHECK (full_installment_amount        >= 0),

  -- ── Notas internas ──────────────────────────────────────────────────────────
  admin_notes                     TEXT,

  -- ── Controle ────────────────────────────────────────────────────────────────
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at                      TIMESTAMPTZ,

  -- ── CHECK constraints de integridade ────────────────────────────────────────

  -- path_type deve ser um dos valores conhecidos
  CONSTRAINT ck_dpath_path_type CHECK (path_type IN (
    'cash_saving',
    'investment',
    'financing',
    'cdc',
    'investment_plus_cdc',
    'consortium_traditional',
    'consortium_with_bid',
    'consortium_programmed_date'
  )),

  -- admin_fee_base: NULL ou valor válido
  CONSTRAINT ck_dpath_admin_fee_base CHECK (
    admin_fee_base IS NULL
    OR admin_fee_base IN ('credit_value', 'invested_amount', 'financed_amount')
  ),

  -- credit_adjustment_base: NULL ou valor válido
  CONSTRAINT ck_dpath_credit_adj_base CHECK (
    credit_adjustment_base IS NULL
    OR credit_adjustment_base IN ('credit_value', 'invested_amount', 'financed_amount')
  ),

  -- Se programmed_contemplation_month está definido, as demais flags de
  -- antecipação também devem estar — o produto não faz sentido sem elas.
  CONSTRAINT ck_dpath_anticipation_consistency CHECK (
    (programmed_contemplation_month IS NULL)
    OR (anticipation_start_month IS NOT NULL AND anticipation_installments IS NOT NULL)
  ),

  -- anticipation_start_month deve ser ANTES da contemplação programada
  CONSTRAINT ck_dpath_anticipation_before_contemplation CHECK (
    (anticipation_start_month IS NULL OR programmed_contemplation_month IS NULL)
    OR (anticipation_start_month < programmed_contemplation_month)
  )

);

COMMENT ON TABLE public.dream_path_settings IS
  'Configuração de caminhos financeiros (path_type) por tipo de sonho. '
  'Permite múltiplos produtos para o mesmo dream_type. '
  'Retrocompatível com dream_plan_settings (que continua ativa). '
  'Somente master edita. unit_admin e unit_viewer leem via RLS. '
  'O Next.js usa service_role (bypassa RLS) — acesso total no servidor.';

COMMENT ON COLUMN public.dream_path_settings.path_type IS
  'Produto financeiro: cash_saving | investment | financing | cdc | '
  'investment_plus_cdc | consortium_traditional | consortium_with_bid | '
  'consortium_programmed_date';

COMMENT ON COLUMN public.dream_path_settings.dream_subtype IS
  'Subtipo específico do sonho. NULL = configuração genérica para o tipo inteiro.';

COMMENT ON COLUMN public.dream_path_settings.admin_fee_rate IS
  'Taxa de administração ANUAL como decimal (ex: 0.03 = 3% a.a.). '
  'Base de cálculo definida em admin_fee_base. '
  'Usada para calcular: parcela_admin = crédito × admin_fee_rate / 12.';

COMMENT ON COLUMN public.dream_path_settings.annual_return_rate IS
  'Rentabilidade anual estimada para investimentos (ex: 0.12 = 12% a.a.). '
  'NÃO é garantia de rendimento — apenas referência para simulação inicial.';

COMMENT ON COLUMN public.dream_path_settings.programmed_contemplation_month IS
  'Mês programado para contemplação (ex: 24 = até 24 meses conforme regra do plano). '
  'Exclusivo de path_type = consortium_programmed_date (Plano Pontual).';

COMMENT ON COLUMN public.dream_path_settings.anticipation_start_month IS
  'Mês a partir do qual o cliente pode antecipar parcelas (ex: 6 = a partir do 6º mês). '
  'Exclusivo de path_type = consortium_programmed_date.';

COMMENT ON COLUMN public.dream_path_settings.anticipation_installments IS
  'Número de parcelas que podem ser antecipadas de uma vez (ex: 18). '
  'Exclusivo de path_type = consortium_programmed_date.';

COMMENT ON COLUMN public.dream_path_settings.full_installment_amount IS
  'Parcela cheia de referência, em reais, para o default_amount configurado. '
  'Ajustar por produto e administradora. Usado como fallback quando não há cálculo dinâmico.';

COMMENT ON COLUMN public.dream_path_settings.eligible_dream_types IS
  'Informativo: tipos de sonho elegíveis para este caminho. '
  'Ex: Plano Pontual → {carro,caminhao}. Não usado no lookup principal.';


-- =============================================================================
-- PASSO 2 — Índices
-- =============================================================================

-- Chave de negócio: um produto único por (dream_type, dream_subtype, path_type) ativo.
-- Usa COALESCE para tratar dream_subtype NULL como '' (garante unicidade com NULL).
-- NOTA: índice parcial por expressão — não é referenciável via ON CONFLICT ON CONSTRAINT.
--       Para upserts, use WHERE NOT EXISTS (pattern adotado nos seeds abaixo).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_dream_path_type_subtype_path
  ON public.dream_path_settings (dream_type, COALESCE(dream_subtype, ''), path_type)
  WHERE deleted_at IS NULL;

-- Lookup principal do app: busca por dream_type + path_type ativos
CREATE INDEX IF NOT EXISTS idx_dream_path_by_type
  ON public.dream_path_settings (dream_type, path_type, sort_order)
  WHERE deleted_at IS NULL AND active = TRUE;

-- Admin: listar todos os caminhos de um dream_type
CREATE INDEX IF NOT EXISTS idx_dream_path_type_all
  ON public.dream_path_settings (dream_type, sort_order)
  WHERE deleted_at IS NULL;

-- Plano Pontual: busca rápida por produtos com contemplação programada
CREATE INDEX IF NOT EXISTS idx_dream_path_programmed_date
  ON public.dream_path_settings (dream_type, programmed_contemplation_month)
  WHERE deleted_at IS NULL AND active = TRUE
    AND programmed_contemplation_month IS NOT NULL;

-- Busca global por path_type (uso em relatórios e admin)
CREATE INDEX IF NOT EXISTS idx_dream_path_path_type
  ON public.dream_path_settings (path_type)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- PASSO 3 — RLS + Políticas
-- (mesmo padrão de dream_plan_settings)
-- =============================================================================

ALTER TABLE public.dream_path_settings ENABLE ROW LEVEL SECURITY;

-- Idempotente: limpar antes de recriar
DROP POLICY IF EXISTS "dpath_read_authenticated" ON public.dream_path_settings;
DROP POLICY IF EXISTS "dpath_insert_master"       ON public.dream_path_settings;
DROP POLICY IF EXISTS "dpath_update_master"       ON public.dream_path_settings;
DROP POLICY IF EXISTS "dpath_delete_master"       ON public.dream_path_settings;

-- Qualquer admin autenticado pode ler registros ativos e não deletados
CREATE POLICY "dpath_read_authenticated"
  ON public.dream_path_settings FOR SELECT
  TO authenticated
  USING (active = TRUE AND deleted_at IS NULL);

-- Somente master pode inserir
CREATE POLICY "dpath_insert_master"
  ON public.dream_path_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_master());

-- Somente master pode atualizar
CREATE POLICY "dpath_update_master"
  ON public.dream_path_settings FOR UPDATE
  TO authenticated
  USING  (public.is_master())
  WITH CHECK (public.is_master());

-- Somente master pode deletar (soft delete via deleted_at)
CREATE POLICY "dpath_delete_master"
  ON public.dream_path_settings FOR DELETE
  TO authenticated
  USING (public.is_master());


-- =============================================================================
-- PASSO 4 — Trigger updated_at
-- (função handle_updated_at() — padrão do projeto, definida em supabase-final.sql)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_dream_path_settings_updated_at ON public.dream_path_settings;
CREATE TRIGGER trg_dream_path_settings_updated_at
  BEFORE UPDATE ON public.dream_path_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PASSO 5 — Seeds: CARRO (8 caminhos)
--
-- Valores de referência para crédito padrão de R$ 50.000.
-- ADMIN: revisar e calibrar full_installment_amount conforme produto/administradora.
--
-- Idempotente: cada INSERT verifica existência pelo trio (dream_type, dream_subtype, path_type).
-- =============================================================================

-- ── 5.1 Poupança direta ────────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_notes
)
SELECT
  'carro', 'cash_saving',
  'Carro — Poupança direta',
  'Guardar mensalmente até atingir o valor total. Sem juros, sem dívida.',
  ARRAY['carro'],
  10, TRUE, FALSE, FALSE,
  5000, 300000, 50000, 36,
  'Simulação linear. O app calcula cenários de 12/24/36/60 meses com a sobra mensal do lead. Sem campos de parcela.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'cash_saving' AND deleted_at IS NULL
);

-- ── 5.2 Investimento ──────────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_return_rate,
  admin_notes
)
SELECT
  'carro', 'investment',
  'Carro — Investimento mensal',
  'Investir mensalmente com rendimento projetado. Rendimento não é garantido.',
  ARRAY['carro'],
  20, TRUE, TRUE, TRUE,
  5000, 300000, 50000, 48,
  0.12,  -- 12% a.a. (referência Tesouro/CDB) — ajustar conforme produto
  'annual_return_rate = 12% a.a. (referência). Rendimento não garantido. '
  'Ajustar conforme produto disponível na unidade.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'investment' AND deleted_at IS NULL
);

-- ── 5.3 Financiamento ─────────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_interest_rate, monthly_interest_rate,
  admin_fee_base, down_payment_percent,
  full_installment_amount, reduced_installment_amount,
  admin_notes
)
SELECT
  'carro', 'financing',
  'Carro financiado',
  'Financiamento bancário com entrada e parcelas mensais.',
  ARRAY['carro'],
  30, TRUE, FALSE, TRUE,
  10000, 300000, 50000, 48,
  0.18, 0.013860,    -- 18% a.a. → ((1,18)^(1/12) − 1) ≈ 1,386% a.m.
  'financed_amount', 0.30,
  1400, 980,          -- Ref. R$ 50k: sem entrada ≈ R$ 1.400 / com 30% entrada ≈ R$ 980
  'Parcela cheia: financiamento integral de R$ 50k em 48 meses a 18% a.a. ≈ R$ 1.400/mês. '
  'Parcela reduzida: com 30% de entrada (R$ 15k) ≈ R$ 980/mês. '
  'monthly_interest_rate = (1,18)^(1/12) − 1 ≈ 0.013860. Ajustar por produto bancário.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'financing' AND deleted_at IS NULL
);

-- ── 5.4 CDC / Crédito Direto ao Consumidor ────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_interest_rate, monthly_interest_rate,
  admin_fee_base,
  full_installment_amount,
  admin_notes
)
SELECT
  'carro', 'cdc',
  'Carro — CDC / Crédito Direto',
  'Crédito Direto ao Consumidor. Aprovação rápida, ideal para valores menores.',
  ARRAY['carro'],
  35, TRUE, FALSE, TRUE,
  5000, 120000, 40000, 36,
  0.24, 0.018110,    -- 24% a.a. → ((1,24)^(1/12) − 1) ≈ 1,811% a.m.
  'financed_amount',
  1100,               -- Ref. R$ 40k em 36 meses a 24% a.a. ≈ R$ 1.100/mês
  'CDC típico para veículos usados ou valor menor. Taxa de 24% a.a. '
  'monthly_interest_rate ≈ 0.018110. Referência para R$ 40k. '
  'Para valores acima de R$ 80k, prefer financing.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'cdc' AND deleted_at IS NULL
);

-- ── 5.5 Investimento + CDC (estratégia híbrida) ───────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_return_rate, annual_interest_rate,
  admin_fee_base,
  admin_notes
)
SELECT
  'carro', 'investment_plus_cdc',
  'Carro — Investimento + CDC estratégico',
  'Investir por um período para acumular entrada, depois usar CDC para o saldo restante.',
  ARRAY['carro'],
  40, TRUE, TRUE, TRUE,
  10000, 200000, 50000, 24,
  0.12, 0.24,
  'financed_amount',
  'Estratégia híbrida: acumular por X meses (ex: 12) e financiar a diferença com CDC. '
  'annual_return_rate = rendimento do investimento; annual_interest_rate = taxa do CDC. '
  'App deve calcular o ponto de equilíbrio. Implementação futura.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'investment_plus_cdc' AND deleted_at IS NULL
);

-- ── 5.6 Consórcio tradicional ─────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base,
  full_installment_amount, reduced_installment_amount,
  admin_notes
)
SELECT
  'carro', 'consortium_traditional',
  'Carro — Consórcio tradicional',
  'Consórcio sem juros de financiamento. Contemplação por sorteio ou lance.',
  ARRAY['carro'],
  50, TRUE, FALSE, TRUE,
  10000, 300000, 50000, 60,
  0.03, 'credit_value',    -- 3% a.a. taxa de adm sobre o crédito
  960, 720,                 -- Ref. R$ 50k: cheia ≈ R$ 960/mês, reduzida (lance) ≈ R$ 720
  'Parcela = crédito/60 + crédito × 3%/12. Ref. R$ 50k: '
  'capital R$ 833 + adm R$ 125 = R$ 958 ≈ R$ 960/mês. '
  'Parcela reduzida pressupõe lance embutido. '
  'Contemplação NÃO garantida — depende de sorteio ou lance.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'consortium_traditional' AND deleted_at IS NULL
);

-- ── 5.7 Consórcio com lance ───────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base, bid_percent,
  full_installment_amount,
  admin_notes
)
SELECT
  'carro', 'consortium_with_bid',
  'Carro — Consórcio com lance',
  'Consórcio com oferta de lance para antecipar a contemplação.',
  ARRAY['carro'],
  60, TRUE, FALSE, TRUE,
  10000, 300000, 50000, 60,
  0.03, 'credit_value', 0.25,    -- lance de 25% do crédito
  1050,                            -- Ref. R$ 50k: parcela + lance embutido ≈ R$ 1.050/mês
  'bid_percent = 0.25 (25% do crédito como lance). '
  'Parcela embutida = parcela tradicional + reserva de lance distribuída nos meses. '
  'Contemplação NÃO garantida mesmo com lance — depende das regras da administradora.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'consortium_with_bid' AND deleted_at IS NULL
);

-- ── 5.8 Plano Pontual — Consórcio com contemplação programada ─────────────────
--
--   Regras do produto:
--   • Contemplação programada em até 24 meses, conforme regra do plano.
--   • A partir do 6º mês, o cliente pode antecipar 18 parcelas.
--   • Desembolso total = 24 × parcela (6 normais + 18 antecipadas).
--   • Referência R$ 50k: parcela ≈ crédito/24 + crédito × 3%/12 = R$ 2.083 + R$ 125 ≈ R$ 2.200/mês
--     → pago até 6º mês: R$ 13.200
--     → antecipação 18 parcelas: R$ 39.600
--     → desembolso total: R$ 52.800 para crédito de R$ 50.000 (5,6% custo total)
--
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base,
  programmed_contemplation_month, anticipation_start_month, anticipation_installments,
  full_installment_amount,
  admin_notes
)
SELECT
  'carro', 'consortium_programmed_date',
  'Plano Pontual — Contemplação programada',
  'Consórcio com contemplação programada em até 24 meses. '
    'A partir do 6º mês, antecipe 18 parcelas para buscar a carta de crédito.',
  ARRAY['carro', 'caminhao'],
  70, TRUE, FALSE, TRUE,
  10000, 300000, 50000, 24,
  0.03, 'credit_value',
  24, 6, 18,    -- contemplação até mês 24; antecipação a partir do mês 6; 18 parcelas
  2200,          -- Ref. R$ 50k: ≈ R$ 2.200/mês (ver cálculo acima)
  'Plano Pontual. Cálculo: crédito/24 + crédito × 3%/12. '
  'Ref. R$ 50k → R$ 2.200/mês. '
  'Desembolso total = 24 × parcela (6 normais + antecipação de 18). '
  'AJUSTAR full_installment_amount por produto e administradora. '
  'Linguagem obrigatória: "contemplação programada conforme regra do plano" / '
  '"simulação inicial" / "condições dependem do contrato, administradora e produto". '
  'NÃO prometer contemplação genérica.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'carro' AND dream_subtype IS NULL
    AND path_type = 'consortium_programmed_date' AND deleted_at IS NULL
);


-- =============================================================================
-- PASSO 6 — Seeds: CAMINHÃO (8 caminhos)
--
-- Valores de referência para crédito padrão de R$ 180.000.
-- ADMIN: revisar e calibrar conforme produto/administradora.
-- =============================================================================

-- ── 6.1 Poupança direta ────────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_notes
)
SELECT
  'caminhao', 'cash_saving',
  'Caminhão — Poupança direta',
  'Guardar mensalmente até atingir o valor total. Sem juros, sem dívida.',
  ARRAY['caminhao'],
  10, TRUE, FALSE, FALSE,
  30000, 2000000, 180000, 60,
  'Simulação linear. O app calcula cenários dinâmicos com a sobra mensal do lead.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'cash_saving' AND deleted_at IS NULL
);

-- ── 6.2 Investimento ──────────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_return_rate,
  admin_notes
)
SELECT
  'caminhao', 'investment',
  'Caminhão — Investimento mensal',
  'Investir mensalmente com rendimento projetado. Rendimento não é garantido.',
  ARRAY['caminhao'],
  20, TRUE, TRUE, TRUE,
  30000, 2000000, 180000, 60,
  0.12,
  '12% a.a. de referência. Ajustar conforme produto disponível.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'investment' AND deleted_at IS NULL
);

-- ── 6.3 Financiamento ─────────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_interest_rate, monthly_interest_rate,
  admin_fee_base, down_payment_percent,
  full_installment_amount, reduced_installment_amount,
  admin_notes
)
SELECT
  'caminhao', 'financing',
  'Caminhão financiado',
  'Financiamento PF/PJ com entrada e parcelas mensais.',
  ARRAY['caminhao'],
  30, TRUE, FALSE, TRUE,
  30000, 2000000, 180000, 60,
  0.15, 0.011715,    -- 15% a.a. → ((1,15)^(1/12) − 1) ≈ 1,1715% a.m.
  'financed_amount', 0.30,
  4200, 2940,         -- Ref. R$ 180k: sem entrada ≈ R$ 4.200 / com 30% entrada ≈ R$ 2.940
  'Ref. R$ 180k sem entrada em 60 meses a 15% a.a. ≈ R$ 4.200/mês. '
  'Com 30% entrada (R$ 54k): R$ 126k a financiar ≈ R$ 2.940/mês. '
  'Caminhão PJ pode ter BNDES ou Finame com taxa menor — ajustar.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'financing' AND deleted_at IS NULL
);

-- ── 6.4 CDC ───────────────────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_interest_rate, monthly_interest_rate,
  admin_fee_base,
  full_installment_amount,
  admin_notes
)
SELECT
  'caminhao', 'cdc',
  'Caminhão — CDC / Crédito Direto',
  'CDC para complemento ou equipamentos auxiliares. Valores até R$ 120k.',
  ARRAY['caminhao'],
  35, TRUE, FALSE, TRUE,
  10000, 120000, 60000, 36,
  0.24, 0.018110,
  'financed_amount',
  1700,    -- Ref. R$ 60k em 36 meses a 24% a.a. ≈ R$ 1.700/mês
  'CDC usualmente limitado a R$ 80-120k. Para caminhão completo preferir financing. '
  'Útil para complementar entrada ou equipamentos adicionais.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'cdc' AND deleted_at IS NULL
);

-- ── 6.5 Investimento + CDC ────────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_return_rate, annual_interest_rate,
  admin_fee_base,
  admin_notes
)
SELECT
  'caminhao', 'investment_plus_cdc',
  'Caminhão — Investimento + CDC estratégico',
  'Acumular entrada via investimento e usar CDC/financiamento para o saldo.',
  ARRAY['caminhao'],
  40, TRUE, TRUE, TRUE,
  30000, 500000, 180000, 36,
  0.12, 0.24,
  'financed_amount',
  'Estratégia híbrida para caminhão. Investir por 12-18 meses para acumular 30% de entrada. '
  'Depois financiar o saldo com CDC ou financing (FINAME). Implementação futura.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'investment_plus_cdc' AND deleted_at IS NULL
);

-- ── 6.6 Consórcio tradicional ─────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base,
  full_installment_amount, reduced_installment_amount,
  admin_notes
)
SELECT
  'caminhao', 'consortium_traditional',
  'Caminhão — Consórcio tradicional',
  'Consórcio sem juros de financiamento. Contemplação por sorteio ou lance.',
  ARRAY['caminhao'],
  50, TRUE, FALSE, TRUE,
  30000, 2000000, 180000, 72,
  0.03, 'credit_value',
  2950, 2200,    -- Ref. R$ 180k/72 meses: capital R$ 2.500 + adm R$ 450 ≈ R$ 2.950/mês
  'Parcela = crédito/72 + crédito × 3%/12. Ref. R$ 180k: '
  'capital R$ 2.500 + adm R$ 450 = R$ 2.950/mês. '
  'Parcela reduzida com lance embutido. '
  'Contemplação NÃO garantida.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'consortium_traditional' AND deleted_at IS NULL
);

-- ── 6.7 Consórcio com lance ───────────────────────────────────────────────────
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base, bid_percent,
  full_installment_amount,
  admin_notes
)
SELECT
  'caminhao', 'consortium_with_bid',
  'Caminhão — Consórcio com lance',
  'Consórcio com oferta de lance para antecipar a contemplação.',
  ARRAY['caminhao'],
  60, TRUE, FALSE, TRUE,
  30000, 2000000, 180000, 72,
  0.03, 'credit_value', 0.25,
  3280,    -- Ref. R$ 180k: parcela + lance 25% embutido ≈ R$ 3.280/mês
  'bid_percent = 0.25. Parcela inclui reserva de lance distribuída. '
  'Contemplação NÃO garantida mesmo com lance.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'consortium_with_bid' AND deleted_at IS NULL
);

-- ── 6.8 Plano Pontual — Consórcio com contemplação programada ─────────────────
--
--   Valores de referência para R$ 180.000 de crédito, 24 meses:
--   Parcela = crédito/24 + crédito × 3%/12
--           = 180.000/24 + 180.000 × 0.0025
--           = R$ 7.500 + R$ 450
--           = R$ 7.950/mês
--
--   → pago até 6º mês:       6 × R$ 7.950 = R$  47.700
--   → antecipação 18 parcelas: 18 × R$ 7.950 = R$ 143.100
--   → desembolso total:        24 × R$ 7.950 = R$ 190.800
--     para crédito de R$ 180.000 (6,0% custo total)
--
INSERT INTO public.dream_path_settings (
  dream_type, path_type,
  label, description, eligible_dream_types,
  sort_order, active, show_capital_gain, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  admin_fee_rate, admin_fee_base,
  programmed_contemplation_month, anticipation_start_month, anticipation_installments,
  full_installment_amount,
  admin_notes
)
SELECT
  'caminhao', 'consortium_programmed_date',
  'Plano Pontual — Contemplação programada',
  'Consórcio com contemplação programada em até 24 meses. '
    'A partir do 6º mês, antecipe 18 parcelas para buscar a carta de crédito.',
  ARRAY['carro', 'caminhao'],
  70, TRUE, FALSE, TRUE,
  30000, 2000000, 180000, 24,
  0.03, 'credit_value',
  24, 6, 18,
  7950,    -- Ref. R$ 180k: ≈ R$ 7.950/mês (ver cálculo acima)
  'Plano Pontual para caminhão. Cálculo: crédito/24 + crédito × 3%/12. '
  'Ref. R$ 180k → R$ 7.950/mês. '
  'Desembolso total = 24 × parcela (6 normais + antecipação de 18). '
  'AJUSTAR full_installment_amount por produto e administradora. '
  'Linguagem obrigatória: "contemplação programada conforme regra do plano" / '
  '"simulação inicial" / "condições dependem do contrato, administradora e produto".'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'caminhao' AND dream_subtype IS NULL
    AND path_type = 'consortium_programmed_date' AND deleted_at IS NULL
);


-- =============================================================================
-- PASSO 7 — Seeds outros tipos (exemplos mínimos — descomente e ajuste)
--
-- Estas seeds são OPCIONAIS e servem como templates.
-- O Plano Pontual NÃO aparece para casa, moto, negocio, reserva, viagem, reforma.
-- =============================================================================

/*

-- CASA: financiamento e consórcio tradicional
INSERT INTO public.dream_path_settings (
  dream_type, path_type, label, description,
  sort_order, active, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_interest_rate, monthly_interest_rate, admin_fee_base, down_payment_percent,
  full_installment_amount, reduced_installment_amount, admin_notes
)
SELECT 'casa', 'financing', 'Casa — Financiamento habitacional',
  'Financiamento com entrada e parcelas mensais.', 30, TRUE, TRUE,
  80000, 2000000, 300000, 360,
  0.11, 0.008735, 'financed_amount', 0.20,
  2600, 1900,
  'Ref. R$ 300k a 11% a.a. em 360 meses ≈ R$ 2.600/mês (sem entrada). '
  'Com 20% entrada (R$ 60k): R$ 240k ≈ R$ 1.900/mês. FGTS pode reduzir.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'casa' AND dream_subtype IS NULL
    AND path_type = 'financing' AND deleted_at IS NULL
);

-- MOTO: CDC
INSERT INTO public.dream_path_settings (
  dream_type, path_type, label, description,
  sort_order, active, show_total_cost,
  min_amount, max_amount, default_amount, term_months,
  annual_interest_rate, monthly_interest_rate, admin_fee_base,
  full_installment_amount, admin_notes
)
SELECT 'moto', 'cdc', 'Moto — CDC / Crédito Direto',
  'CDC para compra de moto nova ou seminova.', 35, TRUE, TRUE,
  3000, 100000, 15000, 36,
  0.24, 0.018110, 'financed_amount',
  550,
  'Ref. R$ 15k em 36 meses a 24% a.a. ≈ R$ 550/mês.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dream_path_settings
  WHERE dream_type = 'moto' AND dream_subtype IS NULL
    AND path_type = 'cdc' AND deleted_at IS NULL
);

*/


-- =============================================================================
-- PASSO 8 — Validação (copiar e rodar no SQL Editor após inserir os seeds)
-- =============================================================================

-- 8.1 Tabela criada com colunas corretas
-- SELECT column_name, data_type, character_maximum_length, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'dream_path_settings'
-- ORDER BY ordinal_position;
-- Esperado: ~35 colunas

-- 8.2 Total de seeds inseridos
-- SELECT dream_type, COUNT(*) AS caminhos
-- FROM public.dream_path_settings
-- WHERE deleted_at IS NULL
-- GROUP BY dream_type
-- ORDER BY dream_type;
-- Esperado: carro = 8, caminhao = 8

-- 8.3 Plano Pontual configurado corretamente
-- SELECT dream_type, path_type, label,
--        term_months, full_installment_amount,
--        programmed_contemplation_month,
--        anticipation_start_month,
--        anticipation_installments
-- FROM public.dream_path_settings
-- WHERE path_type = 'consortium_programmed_date'
--   AND deleted_at IS NULL;
-- Esperado: 2 linhas (carro + caminhao)
-- carro: 24 meses, R$ 2.200/mês, contemplação mês 24, antecipação a partir mês 6, 18 parcelas
-- caminhao: 24 meses, R$ 7.950/mês, mesmas regras de antecipação

-- 8.4 Cálculo manual — Plano Pontual carro (R$ 50.000 de crédito):
-- SELECT
--   full_installment_amount                       AS parcela,
--   full_installment_amount * anticipation_start_month AS pago_ate_mes_6,
--   full_installment_amount * anticipation_installments AS antecipacao_18,
--   full_installment_amount * term_months          AS desembolso_total,
--   full_installment_amount * term_months / 50000  AS fator_custo
-- FROM public.dream_path_settings
-- WHERE dream_type = 'carro' AND path_type = 'consortium_programmed_date';
-- Esperado: parcela=2200, pago_6=13200, antecipacao=39600, total=52800, fator≈1.056

-- 8.5 Nenhum trio (dream_type, dream_subtype, path_type) duplicado
-- SELECT dream_type, dream_subtype, path_type, COUNT(*) AS qtd
-- FROM public.dream_path_settings
-- WHERE deleted_at IS NULL
-- GROUP BY dream_type, dream_subtype, path_type
-- HAVING COUNT(*) > 1;
-- Esperado: 0 linhas

-- 8.6 Índice único presente
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'dream_path_settings'
--   AND indexname = 'uidx_dream_path_type_subtype_path';
-- Esperado: 1 linha

-- 8.7 RLS habilitado
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'dream_path_settings';
-- Esperado: rowsecurity = true

-- 8.8 Trigger de updated_at presente
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE event_object_table = 'dream_path_settings';
-- Esperado: 1 linha — trg_dream_path_settings_updated_at · BEFORE · UPDATE

-- 8.9 Policies de RLS (4 esperadas)
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename = 'dream_path_settings';
-- Esperado: dpath_read_authenticated (SELECT), dpath_insert_master, dpath_update_master, dpath_delete_master

-- 8.10 Lookup típico do app (busca caminhos de carro, ordenados)
-- SELECT path_type, label, sort_order, full_installment_amount,
--        programmed_contemplation_month, anticipation_start_month, anticipation_installments
-- FROM public.dream_path_settings
-- WHERE dream_type = 'carro'
--   AND active = TRUE AND deleted_at IS NULL
-- ORDER BY sort_order;
-- Esperado: 8 linhas — cash_saving→investment→financing→cdc→investment_plus_cdc
--           →consortium_traditional→consortium_with_bid→consortium_programmed_date
