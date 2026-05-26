-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: dream_plan_settings + correção schema dreams
-- Arquivo: database/INCREMENTAL_DREAM_PLAN_SETTINGS.sql
-- Versão:  1.0 · Junho 2026
-- Bloco:   15D
--
-- IDEMPOTENTE: pode rodar múltiplas vezes sem erro.
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   CREATE TABLE IF NOT EXISTS
--   CREATE INDEX IF NOT EXISTS
--   DROP POLICY IF EXISTS antes de recriar
--   DROP TRIGGER IF EXISTS antes de recriar
--
-- O QUE FAZ:
--   1. Corrige schema de dreams (adiciona dream_subtype, target_label se ausentes)
--   2. Cria tabela dream_plan_settings (configuração global de planos por sonho)
--   3. Cria índices
--   4. Habilita RLS
--   5. Cria políticas (somente master escreve; unit_admin/viewer só lê)
--   6. Cria trigger updated_at  →  usa handle_updated_at() (padrão do projeto)
--   7. Seeds iniciais (sem ON CONFLICT — rode apenas uma vez em banco vazio)
--
-- NÃO ALTERA:
--   leads, expenses, investments, business_profiles, opportunities
--   Nenhuma coluna existente em dreams é modificada
--
-- NOTA SOBRE SEEDS:
--   O bloco de INSERT (Passo 7) NÃO usa ON CONFLICT porque a constraint
--   única foi criada como UNIQUE INDEX por expressão (COALESCE), que o
--   PostgreSQL não expõe como constraint nomeável para ON CONFLICT ON CONSTRAINT.
--   Se precisar re-inserir, apague os registros antes: TRUNCATE dream_plan_settings;
--
-- COMO RODAR:
--   Dashboard Supabase → SQL Editor → cole PASSOS 1 a 6 → Run
--   Depois cole o PASSO 7 (seeds) separadamente → Run
--   Em seguida, rode o PASSO 8 (validação)
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Corrigir schema da tabela dreams
-- (colunas adicionadas no BLOCO 15A mas não documentadas em script anterior)
-- =============================================================================

ALTER TABLE public.dreams
  ADD COLUMN IF NOT EXISTS dream_subtype TEXT,
  ADD COLUMN IF NOT EXISTS target_label  TEXT;

COMMENT ON COLUMN public.dreams.dream_subtype IS
  'Subtipo do sonho: financiado, a_vista, consorcio, comprar_pronta, etc.';
COMMENT ON COLUMN public.dreams.target_label IS
  'Label formatado do valor-alvo: ex. "R$ 80.000" — gerado no frontend.';

-- Índice de busca por subtipo (útil para relatórios futuros)
CREATE INDEX IF NOT EXISTS idx_dreams_subtype
  ON public.dreams(dream_type, dream_subtype)
  WHERE is_primary = true;


-- =============================================================================
-- PASSO 2 — Criar tabela dream_plan_settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dream_plan_settings (

  -- Identidade
  id                         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classificação: tipo obrigatório, subtipo opcional
  -- Juntos formam a "chave comercial" do plano
  dream_type                 TEXT            NOT NULL,
  dream_subtype              TEXT,           -- NULL = vale para todos os subtipos do tipo

  -- Label descritivo para exibição no admin
  label                      TEXT            NOT NULL,

  -- Valores sugeridos exibidos no cadastro/simulador
  -- Ex: '{30000, 50000, 80000, 120000}'
  suggested_amounts          NUMERIC(12,2)[] NOT NULL DEFAULT '{}',

  -- Faixa de valores aceitos
  min_amount                 NUMERIC(12,2)   CHECK (min_amount  >= 0),
  max_amount                 NUMERIC(12,2)   CHECK (max_amount  >= 0),

  -- Valor padrão quando o lead não informa
  default_amount             NUMERIC(12,2)   CHECK (default_amount >= 0),

  -- Prazo típico do plano em meses (ex: 36, 48, 60)
  term_months                SMALLINT        CHECK (term_months > 0),

  -- Taxa de parcela (percentual sobre o valor-alvo por mês)
  -- Opcional — usado se o produto tem simulação com taxa
  full_installment_rate      NUMERIC(8,6)    CHECK (full_installment_rate    >= 0),
  reduced_installment_rate   NUMERIC(8,6)    CHECK (reduced_installment_rate >= 0),

  -- Valor fixo de parcela (alternativo à taxa)
  -- Usado quando o consultor quer fixar uma parcela de referência
  full_installment_amount    NUMERIC(12,2)   CHECK (full_installment_amount    >= 0),
  reduced_installment_amount NUMERIC(12,2)   CHECK (reduced_installment_amount >= 0),

  -- Notas internas do consultor/master (não exibidas ao lead)
  admin_notes                TEXT,

  -- Controle
  active                     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at                 TIMESTAMPTZ     -- soft delete

);

-- Unique index parcial: uma configuração ativa por tipo+subtipo
-- Usa COALESCE para tratar NULL como string vazia na comparação
-- NOTA: índice por expressão — não é nomeável via ON CONFLICT ON CONSTRAINT
CREATE UNIQUE INDEX IF NOT EXISTS uidx_dream_plan_type_subtype
  ON public.dream_plan_settings (dream_type, COALESCE(dream_subtype, ''))
  WHERE deleted_at IS NULL;

-- Índices de busca
CREATE INDEX IF NOT EXISTS idx_dream_plan_type
  ON public.dream_plan_settings(dream_type)
  WHERE deleted_at IS NULL AND active = TRUE;

CREATE INDEX IF NOT EXISTS idx_dream_plan_active
  ON public.dream_plan_settings(active, deleted_at);

-- Comentários
COMMENT ON TABLE  public.dream_plan_settings IS
  'Configuração global de planos por tipo/subtipo de sonho. '
  'Somente master edita. unit_admin e unit_viewer leem via RLS. '
  'Sem vínculo com unit_id nesta versão — configuração global do sistema.';

COMMENT ON COLUMN public.dream_plan_settings.dream_type              IS 'Tipo do sonho: carro|casa|negocio|caminhao|aposentadoria_imobiliaria|moto|etc.';
COMMENT ON COLUMN public.dream_plan_settings.dream_subtype           IS 'Subtipo específico. NULL = configuração genérica para o tipo inteiro.';
COMMENT ON COLUMN public.dream_plan_settings.suggested_amounts       IS 'Array de valores sugeridos no seletor de meta. Ex: {30000, 50000, 80000}.';
COMMENT ON COLUMN public.dream_plan_settings.term_months             IS 'Prazo típico em meses. Usado na simulação de parcela padrão.';
COMMENT ON COLUMN public.dream_plan_settings.full_installment_rate   IS 'Taxa mensal (ex: 0.018 = 1.8% a.m.) para parcela cheia. Opcional.';
COMMENT ON COLUMN public.dream_plan_settings.full_installment_amount IS 'Valor fixo de referência para parcela cheia. Alternativo à taxa.';
COMMENT ON COLUMN public.dream_plan_settings.admin_notes             IS 'Nota interna do consultor/master. Não exposta ao lead.';


-- =============================================================================
-- PASSO 3 — RLS
-- =============================================================================

ALTER TABLE public.dream_plan_settings ENABLE ROW LEVEL SECURITY;

-- Limpeza idempotente antes de recriar
DROP POLICY IF EXISTS "dps_read_authenticated"  ON public.dream_plan_settings;
DROP POLICY IF EXISTS "dps_insert_master"        ON public.dream_plan_settings;
DROP POLICY IF EXISTS "dps_update_master"        ON public.dream_plan_settings;
DROP POLICY IF EXISTS "dps_delete_master"        ON public.dream_plan_settings;

-- Qualquer admin autenticado pode ler registros ativos e não deletados
CREATE POLICY "dps_read_authenticated"
  ON public.dream_plan_settings FOR SELECT
  TO authenticated
  USING (active = TRUE AND deleted_at IS NULL);

-- Somente master pode inserir
CREATE POLICY "dps_insert_master"
  ON public.dream_plan_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_master());

-- Somente master pode atualizar
CREATE POLICY "dps_update_master"
  ON public.dream_plan_settings FOR UPDATE
  TO authenticated
  USING  (public.is_master())
  WITH CHECK (public.is_master());

-- Somente master pode deletar (soft delete via deleted_at)
CREATE POLICY "dps_delete_master"
  ON public.dream_plan_settings FOR DELETE
  TO authenticated
  USING (public.is_master());


-- =============================================================================
-- PASSO 4 — Trigger updated_at
-- Usa handle_updated_at() — função padrão do projeto (supabase-final.sql)
-- NÃO usar set_updated_at() — essa função não existe neste banco
-- =============================================================================

DROP TRIGGER IF EXISTS trg_dream_plan_settings_updated_at ON public.dream_plan_settings;
CREATE TRIGGER trg_dream_plan_settings_updated_at
  BEFORE UPDATE ON public.dream_plan_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PASSO 5 — (reservado para futura migração de dados)
-- =============================================================================

-- (vazio nesta versão)


-- =============================================================================
-- PASSO 6 — (reservado para futura view ou função de lookup)
-- =============================================================================

-- (vazio nesta versão)


-- =============================================================================
-- PASSO 7 — Seeds iniciais
--
-- ATENÇÃO: rode este bloco apenas UMA VEZ em banco sem dados.
-- O unique index (uidx_dream_plan_type_subtype) impede duplicatas,
-- mas o INSERT sem ON CONFLICT vai gerar erro se rodar novamente.
-- Para recriar: TRUNCATE public.dream_plan_settings; antes de rodar.
-- =============================================================================

INSERT INTO public.dream_plan_settings
  (dream_type, dream_subtype, label,
   suggested_amounts, default_amount, min_amount, max_amount,
   term_months,
   full_installment_amount, reduced_installment_amount,
   admin_notes)
VALUES

-- ─── CARRO ───────────────────────────────────────────────────────────────────

('carro', NULL,
  'Carro próprio (geral)',
  '{20000,35000,50000,80000,120000}', 50000, 10000, 300000,
  48, 1100, 800,
  'Configuração genérica para qualquer subtipo de carro. Usada como fallback.'),

('carro', 'financiado',
  'Carro financiado',
  '{20000,35000,50000,80000}', 50000, 10000, 200000,
  48, 1100, 800,
  'Parcela cheia: financiamento integral. Parcela reduzida: com entrada de 30%.'),

('carro', 'a_vista',
  'Carro à vista',
  '{20000,35000,50000,80000,120000}', 50000, 10000, 300000,
  36, NULL, NULL,
  'Sem parcela — acumulação linear até atingir o valor-alvo.'),

('carro', 'consorcio',
  'Carro via consórcio',
  '{30000,50000,80000,120000}', 50000, 20000, 250000,
  60, 900, 700,
  'Parcela cheia ≈ 1,8% do crédito/mês. Parcela reduzida ≈ 1,4% (lance embutido).'),

('carro', 'financiar_novo',
  'Financiar carro novo',
  '{50000,80000,120000,200000}', 80000, 30000, 300000,
  60, 1700, 1200,
  'Carro novo tem parcelas mais altas. Parcela reduzida pressupõe entrada de 30%.'),

('carro', 'entrada_carro',
  'Usar carro atual como entrada',
  '{15000,25000,40000,60000}', 25000, 5000, 150000,
  36, 700, 500,
  'Valor = diferença a pagar após dar o carro como entrada.'),

('carro', 'vender_comprar',
  'Vender e comprar outro',
  '{10000,20000,35000,60000}', 20000, 5000, 150000,
  24, 900, 600,
  'Valor = diferença entre venda e compra. Prazo curto.'),

-- ─── CASA ────────────────────────────────────────────────────────────────────

('casa', NULL,
  'Casa própria (geral)',
  '{100000,200000,350000,500000,800000}', 250000, 50000, 2000000,
  120, 2200, 1600,
  'Configuração genérica. Parcelas baseadas em financiamento habitacional típico.'),

('casa', 'comprar_pronta',
  'Comprar casa pronta',
  '{150000,250000,400000,600000}', 300000, 80000, 1500000,
  120, 2200, 1600,
  'Parcela cheia: financiamento 80% · 30 anos. Parcela reduzida: com entrada maior.'),

('casa', 'construir',
  'Construir casa',
  '{80000,150000,250000,400000}', 180000, 50000, 800000,
  84, 1800, 1200,
  'Construção permite dividir em etapas. Parcela reduzida = fase inicial.'),

('casa', 'financiamento',
  'Financiamento habitacional',
  '{100000,200000,350000,500000}', 250000, 80000, 1500000,
  120, 2200, 1600,
  'FGTS pode reduzir o valor financiado. Parcela reduzida pressupõe uso do FGTS.'),

-- ─── CAMINHÃO ────────────────────────────────────────────────────────────────

('caminhao', NULL,
  'Caminhão próprio (geral)',
  '{80000,150000,250000,400000}', 180000, 50000, 800000,
  60, 3200, 2400,
  'Configuração genérica. Parcelas consideram financiamento PJ/PF.'),

('caminhao', 'renda_autonoma',
  'Caminhão para renda autônoma (frete)',
  '{80000,150000,250000}', 150000, 50000, 500000,
  60, 3000, 2200,
  'Foco em caminhão leve/toco para autônomo. Parcela reduzida com entrada de 20%.'),

('caminhao', 'empresa',
  'Caminhão para empresa',
  '{150000,250000,400000,600000}', 280000, 80000, 800000,
  72, 4500, 3200,
  'Financiamento PJ. Pode incluir dedução fiscal. Parcela reduzida com BNDES.'),

('caminhao', 'ampliar_frota',
  'Ampliar frota existente',
  '{200000,400000,600000,1000000}', 400000, 100000, 2000000,
  72, 6000, 4500,
  'Múltiplos veículos. Considerar leasing operacional como alternativa.'),

-- ─── APOSENTADORIA IMOBILIÁRIA ───────────────────────────────────────────────

('aposentadoria_imobiliaria', NULL,
  'Aposentadoria imobiliária (geral)',
  '{100000,200000,350000,500000}', 250000, 80000, 2000000,
  120, 1800, 1200,
  'Configuração genérica para patrimônio imobiliário de longo prazo.'),

('aposentadoria_imobiliaria', 'comprar_alugar',
  'Comprar imóvel para alugar',
  '{120000,200000,350000,500000}', 250000, 80000, 1500000,
  120, 2000, 1400,
  'Renda passiva. Parcela cheia = financiamento. Parcela reduzida = com renda do aluguel abatendo.'),

('aposentadoria_imobiliaria', 'construir_alugar',
  'Construir para alugar',
  '{80000,150000,250000,400000}', 180000, 50000, 800000,
  84, 1500, 1000,
  'Construção parcelada. Retorno começa quando a obra termina.'),

('aposentadoria_imobiliaria', 'revenda',
  'Revenda de imóveis',
  '{100000,200000,400000,800000}', 300000, 100000, 2000000,
  60, 2500, 1800,
  'Capital de giro para compra e revenda. Giro médio de 60 dias por operação.'),

-- ─── MOTO ────────────────────────────────────────────────────────────────────

('moto', NULL,
  'Moto própria (geral)',
  '{8000,12000,18000,30000,50000}', 15000, 5000, 100000,
  36, 400, 280,
  'Moto 0 km popular ≈ R$ 15.000–18.000.'),

-- ─── NEGÓCIO ─────────────────────────────────────────────────────────────────

('negocio', NULL,
  'Negócio próprio (geral)',
  '{15000,30000,60000,100000,200000}', 50000, 5000, 500000,
  48, NULL, NULL,
  'Configuração genérica. Sem parcela — capital é acumulado e aportado.'),

('negocio', 'abrir_zero',
  'Abrir negócio do zero',
  '{15000,30000,50000,80000}', 30000, 5000, 200000,
  36, NULL, NULL,
  'Capital inicial. Reserva + capital de giro + equipamentos básicos.'),

('negocio', 'franquia',
  'Comprar franquia',
  '{30000,60000,100000,200000,400000}', 100000, 20000, 500000,
  48, NULL, NULL,
  'Taxa de franquia + capital de giro + adequação. Varia muito por bandeira.'),

('negocio', 'ampliar_atual',
  'Ampliar negócio atual',
  '{10000,25000,50000,100000}', 30000, 5000, 300000,
  24, NULL, NULL,
  'Capital para expansão. Foco em equipamentos, estoque ou ponto.'),

-- ─── DÍVIDAS ─────────────────────────────────────────────────────────────────

('dividas', NULL,
  'Quitar dívidas (geral)',
  '{5000,15000,30000,60000,100000}', 20000, 1000, 500000,
  24, NULL, NULL,
  'Configuração genérica. Prazo reduzido — urgência na quitação.'),

('dividas', 'cartao',
  'Quitar cartão de crédito',
  '{3000,8000,15000,30000}', 10000, 500, 100000,
  12, NULL, NULL,
  'Cartão tem juros altíssimos. Prazo curto é prioritário.'),

('dividas', 'emprestimo',
  'Quitar empréstimo / cheque especial',
  '{5000,15000,30000,60000}', 20000, 1000, 200000,
  18, NULL, NULL,
  'Incluir taxa do cheque especial na conversa.'),

('dividas', 'varias',
  'Quitar várias dívidas',
  '{10000,25000,50000,100000}', 30000, 2000, 500000,
  36, NULL, NULL,
  'Estratégia avalanche ou bola de neve. Mapear taxas de cada dívida.'),

-- ─── OUTROS ──────────────────────────────────────────────────────────────────

('viagem', NULL,
  'Viagem dos sonhos',
  '{5000,10000,20000,40000}', 10000, 1000, 100000,
  18, NULL, NULL,
  'Prazo curto a médio. Valores dependem do destino.'),

('reserva', NULL,
  'Reserva de emergência',
  '{5000,10000,20000,30000}', 10000, 1000, 100000,
  12, NULL, NULL,
  'Meta: 3–6 meses de gastos mensais. Prazo curto.'),

('reforma', NULL,
  'Reforma da casa',
  '{10000,25000,50000,100000}', 30000, 3000, 300000,
  24, NULL, NULL,
  'Obras por etapas. Sem parcela — capital acumulado.'),

('faculdade', NULL,
  'Faculdade',
  '{5000,15000,30000,60000}', 20000, 2000, 150000,
  48, NULL, NULL,
  'Inclui mensalidade × meses ou curso integral.');


-- =============================================================================
-- PASSO 8 — Validação (rode após o script)
-- =============================================================================

-- 8.1 Colunas adicionadas em dreams
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'dreams'
--   AND column_name  IN ('dream_subtype', 'target_label')
-- ORDER BY column_name;
-- Esperado: 2 linhas

-- 8.2 Seeds por tipo
-- SELECT dream_type, COUNT(*) AS planos
-- FROM public.dream_plan_settings
-- WHERE deleted_at IS NULL
-- GROUP BY dream_type
-- ORDER BY dream_type;
-- Esperado: 32 registros no total

-- 8.3 Nenhum tipo+subtipo duplicado
-- SELECT dream_type, dream_subtype, COUNT(*) AS qtd
-- FROM public.dream_plan_settings
-- WHERE deleted_at IS NULL
-- GROUP BY dream_type, dream_subtype
-- HAVING COUNT(*) > 1;
-- Esperado: 0 linhas

-- 8.4 RLS habilitado
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'dream_plan_settings';
-- Esperado: rowsecurity = true

-- 8.5 Trigger presente
-- SELECT trigger_name, event_object_table, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'dream_plan_settings';
-- Esperado: trg_dream_plan_settings_updated_at · BEFORE UPDATE

-- 8.6 Lookup típico do diagnóstico (busca mais específico primeiro)
-- SELECT label, term_months, full_installment_amount, reduced_installment_amount
-- FROM public.dream_plan_settings
-- WHERE dream_type = 'carro'
--   AND (dream_subtype = 'consorcio' OR dream_subtype IS NULL)
--   AND active = TRUE AND deleted_at IS NULL
-- ORDER BY dream_subtype NULLS LAST
-- LIMIT 1;
-- Esperado: 'Carro via consórcio' · 60 meses · 900 · 700

-- 8.7 Policies
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'dream_plan_settings';
-- Esperado: 4 policies (read, insert, update, delete)
