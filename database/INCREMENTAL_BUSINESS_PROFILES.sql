-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: tabela business_profiles (Minha Empresa)
-- Arquivo: database/INCREMENTAL_BUSINESS_PROFILES.sql
-- Versão:  1.0 · Junho 2026
-- Bloco:   12
--
-- IDEMPOTENTE: pode rodar múltiplas vezes sem erro.
--   CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--   DROP POLICY IF EXISTS antes de recriar, DROP TRIGGER IF EXISTS.
--
-- REGRAS DE NEGÓCIO:
--   • business_profiles é SEPARADO de expenses, investments e leads
--   • Fase 1: lead declara estimativas (faturamento, despesas, necessidades)
--   • Fase 2 futura: business_expenses e business_investments operacionais
--   • unit_id e lead_id SEMPRE resolvidos no servidor (service_role)
--   • Frontend/browser NUNCA envia unit_id ou lead_id como dado confiável
--   • authenticated NÃO insere diretamente — apenas via Server Action
--   • unit_admin e master leem via RLS (safety net)
--   • unit_viewer: sem policy de leitura (service_role bypassa no servidor)
--   • Dados pessoais e empresariais NUNCA se misturam
--   • CNPJ NÃO coletado nesta fase (LGPD: minimização de dados)
--
-- TABELAS NÃO ALTERADAS:
--   leads, dna_answers, expenses, investments, opportunities
--   (nenhum ALTER TABLE neste script)
--
-- COMO RODAR:
--   Dashboard Supabase → SQL Editor → cole o script inteiro → Run
--   Em seguida, execute as queries do BLOCO DE VALIDAÇÃO (Passo 8)
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Criar a tabela
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_profiles (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Vínculos ─────────────────────────────────────────────────────────────
  -- NUNCA vêm do browser — resolvidos exclusivamente no servidor:
  --   unit_id: injetado pela Server Action a partir da sessão do admin/lead
  --   lead_id: resolvido do cookie dna_lead_token (lead) ou parâmetro validado (admin)
  unit_id                  UUID          NOT NULL REFERENCES public.units(id)  ON DELETE RESTRICT,
  lead_id                  UUID          NOT NULL REFERENCES public.leads(id)  ON DELETE CASCADE,

  -- ══════════════════════════════════════════════════════════════════════════
  -- BLOCO 1 — Dados gerais do negócio
  -- ══════════════════════════════════════════════════════════════════════════

  -- Nome fantasia ou nome do negócio
  -- Opcional — LGPD: coleta mínima, não é o nome jurídico/CNPJ
  business_name            TEXT,

  -- Segmento de atuação
  -- Valores esperados (validados no app, não por constraint):
  --   alimentacao | beleza | tecnologia | servicos | comercio | agro
  --   saude | educacao | transporte | construcao | outro
  segment                  TEXT,

  -- Tempo de atividade (faixa — não data exata)
  -- Valores: menos_1 | de_1_a_3 | de_3_a_5 | mais_5
  activity_years           TEXT,

  -- Tipo de formalização
  -- CNPJ NÃO coletado nesta fase — apenas o tipo, para segmentação
  -- Valores: mei | me | ltda | autonomo_informal | produtor_rural
  --          prestador_servico | comercio | transporte | outro
  formalization            TEXT,

  -- Quantidade de funcionários (faixa — não valor exato)
  -- Valores: nenhum | 1_a_3 | 4_a_10 | mais_10
  employee_count           TEXT,

  -- ⚠️ SENSÍVEL — faturamento médio mensal estimado da empresa
  -- NÃO é renda pessoal — não misturar com leads.monthly_income
  -- unit_viewer: exibir apenas faixa no frontend (ex: "R$ 5k–R$ 15k")
  -- unit_admin e master: valor exato via service_role
  monthly_revenue          NUMERIC(12,2),

  -- ⚠️ SENSÍVEL — despesas médias mensais da empresa (estimativa declarada)
  -- NÃO misturar com tabela expenses (despesas pessoais)
  -- NÃO misturar com leads.monthly_expenses (declaração pessoal)
  -- unit_viewer: apenas faixa
  monthly_biz_expenses     NUMERIC(12,2),

  -- ⚠️ SENSÍVEL — lucro médio aproximado (opcional, o lead pode não saber)
  -- unit_viewer NÃO acessa — exibir apenas "Lucro declarado: Sim/Não"
  -- master e unit_admin: valor via service_role
  monthly_profit           NUMERIC(12,2),

  -- ══════════════════════════════════════════════════════════════════════════
  -- BLOCO 2 — Ponto comercial
  -- ══════════════════════════════════════════════════════════════════════════

  -- A empresa paga aluguel comercial?
  has_rent                 BOOLEAN,

  -- ⚠️ SENSÍVEL — valor do aluguel mensal
  -- unit_viewer: exibir apenas "Paga aluguel: Sim/Não"
  -- unit_admin e master: valor via service_role
  rent_amount              NUMERIC(12,2),

  -- Tipo de ponto / local de trabalho
  -- Valores: proprio | alugado | em_casa | online | cedido
  premise_type             TEXT,

  -- Tem interesse em comprar ponto próprio?
  -- Gatilho para oportunidade: consórcio imobiliário comercial, crédito imobiliário PJ
  wants_own_premise        BOOLEAN,

  -- ⚠️ SENSÍVEL — capacidade mensal de investimento para sair do aluguel
  -- Usado para qualificação de oportunidades (consórcio, crédito)
  -- unit_viewer NÃO acessa
  monthly_premise_budget   NUMERIC(12,2),

  -- ══════════════════════════════════════════════════════════════════════════
  -- BLOCO 3 — Frota e veículos
  -- ══════════════════════════════════════════════════════════════════════════

  -- A empresa usa veículos?
  has_vehicles             BOOLEAN,

  -- Tipos de veículo (multiselect serializado com vírgula)
  -- Valores: carro | moto | caminhao | van | utilitario | maquinas | outro
  vehicle_types            TEXT,

  -- Quantidade de veículos (faixa)
  -- Valores: 1 | 2_a_5 | mais_5
  vehicle_count            TEXT,

  -- Situação financeira da frota
  -- Valores: quitados | financiados | alugados | misto
  vehicle_ownership        TEXT,

  -- Pretende renovar ou ampliar a frota?
  -- Gatilho para oportunidade: financiamento de veículos, caminhão, máquinas
  wants_fleet_renewal      BOOLEAN,

  -- ⚠️ SENSÍVEL — capacidade mensal de investimento em frota
  -- unit_viewer NÃO acessa
  monthly_fleet_budget     NUMERIC(12,2),

  -- ══════════════════════════════════════════════════════════════════════════
  -- BLOCO 4 — Capital de giro
  -- ══════════════════════════════════════════════════════════════════════════

  -- A empresa precisa de capital de giro?
  needs_working_capital    BOOLEAN,

  -- ⚠️ SENSÍVEL — valor aproximado de capital de giro necessário
  -- unit_viewer: exibir apenas faixa (ex: "R$ 20k–R$ 50k")
  -- unit_admin e master: valor via service_role
  working_capital_amount   NUMERIC(12,2),

  -- Finalidade do capital de giro (multiselect serializado com vírgula)
  -- Valores: estoque | folha | equipamentos | reforma | marketing
  --          dividas | veiculo | imovel | expansao | outro
  working_capital_purpose  TEXT,

  -- Possui imóvel ou bem que poderia ser usado como garantia?
  -- Gatilho para oportunidade: crédito com garantia (taxas menores)
  has_collateral_asset     BOOLEAN,

  -- Tipo do bem de garantia
  -- Valores: imovel_residencial | imovel_comercial | veiculo | equipamento | outro
  collateral_type          TEXT,

  -- ⚠️ ALTAMENTE SENSÍVEL — valor estimado do bem de garantia
  -- Campo COMPLETAMENTE OPCIONAL — não insistir se lead não quiser informar
  -- unit_viewer NÃO acessa — nem faixa é exibida (dados patrimoniais críticos)
  -- master e unit_admin: valor via service_role com aviso visual de sensibilidade
  collateral_value         NUMERIC(12,2),

  -- ══════════════════════════════════════════════════════════════════════════
  -- BLOCO 5 — Equipamentos e crescimento
  -- ══════════════════════════════════════════════════════════════════════════

  -- Precisa comprar equipamentos ou maquinário?
  -- Gatilho para oportunidade: financiamento de equipamentos, leasing
  needs_equipment          BOOLEAN,

  -- Precisa reformar, ampliar ou adequar o espaço?
  needs_renovation         BOOLEAN,

  -- Precisa contratar pessoas?
  needs_hiring             BOOLEAN,

  -- Precisa investir em marketing, divulgação ou presença digital?
  needs_marketing          BOOLEAN,

  -- Precisa organizar melhor o financeiro da empresa?
  -- Gatilho para oportunidade: educação financeira empresarial, consultoria
  needs_financial_org      BOOLEAN,

  -- Já separa a conta pessoal (PF) da conta da empresa (PJ)?
  -- FALSE = alerta "⚠️ Mistura PF/PJ" no admin + oportunidade de organização
  has_separate_accounts    BOOLEAN,

  -- ══════════════════════════════════════════════════════════════════════════
  -- Progresso do DNA empresarial (0–100)
  -- Calculado pela Server Action ao salvar cada bloco:
  --   (blocos_respondidos / 5) × 100
  -- Um bloco é "respondido" quando ao menos 1 campo não-nulo pertence a ele
  -- ══════════════════════════════════════════════════════════════════════════
  biz_dna_progress         SMALLINT      NOT NULL DEFAULT 0
                             CHECK (biz_dna_progress BETWEEN 0 AND 100),

  -- ══════════════════════════════════════════════════════════════════════════
  -- Metadados de auditoria
  -- ══════════════════════════════════════════════════════════════════════════
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,  -- soft delete — NUNCA DELETE físico

  -- Um perfil empresarial por lead (atualizado progressivamente via UPSERT)
  CONSTRAINT biz_profiles_lead_unique UNIQUE (lead_id)
);


-- =============================================================================
-- PASSO 2 — Comentários da tabela e colunas
-- =============================================================================

COMMENT ON TABLE public.business_profiles IS
  '"Minha Empresa" — perfil empresarial do lead (Fase 1: estimativas declaradas). '
  'SEPARADO de expenses (pessoais), investments (pessoais) e leads (dados pessoais). '
  'Fase 2 futura: business_expenses e business_investments operacionais. '
  'INSERT/UPDATE exclusivo via service_role (Server Action Next.js). '
  'CNPJ NÃO coletado nesta fase — princípio de minimização de dados (LGPD).';

-- Vínculos
COMMENT ON COLUMN public.business_profiles.unit_id IS
  'Injetado pelo servidor — NUNCA vem do browser. '
  'Mesma unidade do leads.unit_id — garantia de isolamento multiunidade.';

COMMENT ON COLUMN public.business_profiles.lead_id IS
  'Resolvido do cookie dna_lead_token no servidor — NUNCA vem do browser. '
  'ON DELETE CASCADE: apagado automaticamente se o lead for apagado.';

-- Bloco 1 — sensíveis
COMMENT ON COLUMN public.business_profiles.monthly_revenue IS
  '⚠️ SENSÍVEL — faturamento médio mensal estimado da empresa. '
  'NÃO é renda pessoal — NÃO misturar com leads.monthly_income. '
  'unit_viewer: exibir apenas faixa (<5k | 5k–15k | 15k–30k | 30k–60k | >60k). '
  'unit_admin e master: valor exato disponível via service_role.';

COMMENT ON COLUMN public.business_profiles.monthly_biz_expenses IS
  '⚠️ SENSÍVEL — despesas médias mensais da empresa (estimativa declarada). '
  'NÃO misturar com tabela expenses (despesas pessoais do lead). '
  'NÃO misturar com leads.monthly_expenses (declaração pessoal). '
  'unit_viewer: exibir apenas faixa.';

COMMENT ON COLUMN public.business_profiles.monthly_profit IS
  '⚠️ SENSÍVEL — lucro médio aproximado (campo opcional — lead pode não saber). '
  'unit_viewer NÃO acessa — exibir apenas "Lucro declarado: Sim/Não". '
  'master e unit_admin: valor via service_role.';

-- Bloco 2 — sensíveis
COMMENT ON COLUMN public.business_profiles.rent_amount IS
  '⚠️ SENSÍVEL — valor do aluguel comercial mensal. '
  'unit_viewer: exibir apenas "Paga aluguel: Sim/Não". '
  'unit_admin e master: valor disponível via service_role.';

COMMENT ON COLUMN public.business_profiles.monthly_premise_budget IS
  '⚠️ SENSÍVEL — capacidade mensal de investimento para aquisição de ponto próprio. '
  'Gatilho para qualificação de consórcio imobiliário / crédito imobiliário PJ. '
  'unit_viewer NÃO acessa.';

-- Bloco 3 — sensíveis
COMMENT ON COLUMN public.business_profiles.monthly_fleet_budget IS
  '⚠️ SENSÍVEL — capacidade mensal de investimento em frota. '
  'Gatilho para financiamento de veículos, caminhão, máquinas. '
  'unit_viewer NÃO acessa.';

-- Bloco 4 — sensíveis
COMMENT ON COLUMN public.business_profiles.working_capital_amount IS
  '⚠️ SENSÍVEL — valor aproximado de capital de giro necessário. '
  'unit_viewer: exibir apenas faixa (ex: "R$ 20k–R$ 50k"). '
  'unit_admin e master: valor via service_role.';

COMMENT ON COLUMN public.business_profiles.collateral_value IS
  '⚠️ ALTAMENTE SENSÍVEL — valor estimado do bem de garantia (completamente opcional). '
  'NÃO insistir se lead não quiser informar — pode inibir confiança. '
  'unit_viewer NÃO acessa — nem faixa é exibida (dados patrimoniais críticos). '
  'master e unit_admin: valor via service_role com aviso visual de sensibilidade.';

-- Bloco 5
COMMENT ON COLUMN public.business_profiles.has_separate_accounts IS
  'FALSE = alerta "⚠️ Mistura PF/PJ" no admin Perfil 360. '
  'Oportunidade: apresentar conta PJ, organização financeira, educação para MEI.';

-- Controle
COMMENT ON COLUMN public.business_profiles.biz_dna_progress IS
  'Progresso do DNA empresarial (0–100). '
  'Calculado pela Server Action: (blocos_respondidos / 5) × 100. '
  'Bloco considerado respondido: ao menos 1 campo não-nulo do bloco foi salvo.';

COMMENT ON COLUMN public.business_profiles.deleted_at IS
  'Soft delete — NUNCA usar DELETE físico. '
  'Filtrar SEMPRE com deleted_at IS NULL em todas as queries.';


-- =============================================================================
-- PASSO 3 — Índices
-- Todos parciais (WHERE deleted_at IS NULL) — exclui soft-deleted.
-- =============================================================================

-- Busca pelo lead (uso mais frequente: painel, relatório, admin 360)
CREATE INDEX IF NOT EXISTS idx_biz_lead_id
  ON public.business_profiles(lead_id)
  WHERE deleted_at IS NULL;

-- Busca por unidade (admin: todos os perfis empresariais da unidade)
CREATE INDEX IF NOT EXISTS idx_biz_unit_id
  ON public.business_profiles(unit_id)
  WHERE deleted_at IS NULL;

-- Progresso do DNA empresarial por unidade
-- Uso: dashboard admin ("leads com DNA empresarial incompleto")
CREATE INDEX IF NOT EXISTS idx_biz_unit_progress
  ON public.business_profiles(unit_id, biz_dna_progress)
  WHERE deleted_at IS NULL;

-- Segmentação por tipo de formalização
-- Uso: filtro admin futuro "MEI" / "autônomo informal" / "LTDA"
CREATE INDEX IF NOT EXISTS idx_biz_formalization
  ON public.business_profiles(formalization)
  WHERE deleted_at IS NULL;

-- Segmentação por segmento de atuação
-- Uso: filtro admin futuro "transporte" / "comercio" / "agro"
CREATE INDEX IF NOT EXISTS idx_biz_segment
  ON public.business_profiles(segment)
  WHERE deleted_at IS NULL;

-- Leads que precisam de capital de giro (oportunidade comercial prioritária)
CREATE INDEX IF NOT EXISTS idx_biz_working_capital
  ON public.business_profiles(unit_id, needs_working_capital)
  WHERE deleted_at IS NULL AND needs_working_capital = true;

-- Leads que pagam aluguel e querem ponto próprio (consórcio / crédito imobiliário)
CREATE INDEX IF NOT EXISTS idx_biz_rent_premise
  ON public.business_profiles(unit_id, has_rent, wants_own_premise)
  WHERE deleted_at IS NULL;

-- Leads com garantia disponível (crédito com garantia — taxas menores)
CREATE INDEX IF NOT EXISTS idx_biz_collateral
  ON public.business_profiles(unit_id, has_collateral_asset)
  WHERE deleted_at IS NULL AND has_collateral_asset = true;


-- =============================================================================
-- PASSO 4 — Row Level Security
-- =============================================================================

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

-- FORCE RLS: garante que mesmo o owner da tabela (postgres) respeita as policies
-- quando conectado como role authenticated.
-- service_role continua bypassando RLS (comportamento padrão Supabase).
ALTER TABLE public.business_profiles FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- PASSO 5 — Policies RLS
--
-- Seguem o padrão de investments:
--   SELECT master     → lê todos os perfis (todas as unidades)
--   SELECT unit_admin → lê perfis da própria unidade
--   unit_viewer       → SEM policy (acessa somente via service_role no servidor)
--   INSERT            → SEM policy (somente service_role via Server Action)
--   UPDATE            → SEM policy (somente service_role via Server Action)
--   DELETE            → SEM policy (somente service_role — soft delete via deleted_at)
--
-- ⚠️ JWT CUSTOM CLAIMS necessários para is_master() e can_access_unit():
--   Sem o Custom Access Token Hook configurado, todas as policies retornam false
--   para usuários autenticados. O Next.js com service_role key funciona normalmente.
-- =============================================================================

-- Remove policies existentes para garantir idempotência
DROP POLICY IF EXISTS "biz_read_master"      ON public.business_profiles;
DROP POLICY IF EXISTS "biz_read_unit_admin"  ON public.business_profiles;

-- Master: lê todos os perfis empresariais de todas as unidades
CREATE POLICY "biz_read_master"
  ON public.business_profiles FOR SELECT
  TO authenticated
  USING (
    public.is_master()
    AND deleted_at IS NULL
  );

-- unit_admin: lê perfis da própria unidade
-- unit_viewer NÃO tem policy aqui — sem acesso direto (igual a investments e expenses)
-- O servidor usa service_role para leitura — esta policy é safety net para JWT direto
CREATE POLICY "biz_read_unit_admin"
  ON public.business_profiles FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
    AND deleted_at IS NULL
  );

-- INSERT/UPDATE/DELETE: sem policy para authenticated
-- → Bloqueado para todo authenticated pelo FORCE ROW LEVEL SECURITY
-- → Permitido apenas para service_role (usado pelo Next.js server-side)
-- → Nenhum lead ou admin pode gravar diretamente via browser/JWT


-- =============================================================================
-- PASSO 6 — Trigger: updated_at automático
-- Reutiliza handle_updated_at() já existente (definida em supabase-final.sql)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_biz_profiles_updated_at ON public.business_profiles;

CREATE TRIGGER trg_biz_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PASSO 7 — Trigger: atualiza last_seen_at do lead ao criar/atualizar perfil
-- Segue o mesmo padrão de handle_lead_activity_on_investment()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_lead_activity_on_biz_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza last_seen_at e updated_at do lead toda vez que o perfil
  -- empresarial é criado ou atualizado (sinal de atividade no app)
  UPDATE public.leads
  SET last_seen_at = NOW(),
      updated_at   = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_lead_activity_on_biz_profile() IS
  'Atualiza last_seen_at e updated_at do lead quando o perfil empresarial '
  'é criado ou atualizado. SECURITY DEFINER: executa como owner (postgres) '
  'para poder fazer UPDATE em leads mesmo com RLS e FORCE RLS ativos. '
  'Segue o mesmo padrão de handle_lead_activity_on_investment().';

DROP TRIGGER IF EXISTS trg_biz_profile_update_lead_activity ON public.business_profiles;

CREATE TRIGGER trg_biz_profile_update_lead_activity
  AFTER INSERT OR UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_lead_activity_on_biz_profile();


-- =============================================================================
-- PASSO 8 — VALIDAÇÃO
-- Execute cada bloco abaixo APÓS rodar os passos 1–7.
-- Nenhuma query abaixo modifica dados.
-- =============================================================================

-- ── 8.1 Colunas: confirma que todas as 38 colunas foram criadas ──────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'business_profiles'
ORDER BY ordinal_position;
/*
  Resultado esperado: 38 colunas
    id, unit_id, lead_id                                    (3 — vínculos)
    business_name, segment, activity_years, formalization,
    employee_count, monthly_revenue, monthly_biz_expenses,
    monthly_profit                                          (8 — bloco 1)
    has_rent, rent_amount, premise_type, wants_own_premise,
    monthly_premise_budget                                  (5 — bloco 2)
    has_vehicles, vehicle_types, vehicle_count,
    vehicle_ownership, wants_fleet_renewal,
    monthly_fleet_budget                                    (6 — bloco 3)
    needs_working_capital, working_capital_amount,
    working_capital_purpose, has_collateral_asset,
    collateral_type, collateral_value                       (6 — bloco 4)
    needs_equipment, needs_renovation, needs_hiring,
    needs_marketing, needs_financial_org,
    has_separate_accounts                                   (6 — bloco 5)
    biz_dna_progress                                        (1 — progresso)
    created_at, updated_at, deleted_at                      (3 — metadados)
*/

-- ── 8.2 RLS e FORCE RLS ──────────────────────────────────────────────────────
SELECT
  relname,
  relrowsecurity     AS rls_ativo,
  relforcerowsecurity AS force_rls
FROM pg_class
WHERE relname = 'business_profiles';
/*
  Resultado esperado:
    rls_ativo  = true
    force_rls  = true
*/

-- ── 8.3 Policies criadas ─────────────────────────────────────────────────────
SELECT
  policyname,
  cmd     AS operacao,
  roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'business_profiles'
ORDER BY policyname;
/*
  Resultado esperado: 2 linhas
    biz_read_master     | SELECT | {authenticated}
    biz_read_unit_admin | SELECT | {authenticated}

  Confirmar que NÃO existem policies para:
    INSERT, UPDATE, DELETE → apenas service_role pode escrever
    unit_viewer            → sem acesso direto (somente via service_role)
*/

-- ── 8.4 Índices criados ───────────────────────────────────────────────────────
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'business_profiles'
ORDER BY indexname;
/*
  Resultado esperado: 9 entradas
    business_profiles_pkey            → PRIMARY KEY (id)
    business_profiles_lead_id_key     → UNIQUE (lead_id)  [da constraint]
    idx_biz_collateral                → (unit_id, has_collateral_asset)
    idx_biz_formalization             → (formalization)
    idx_biz_lead_id                   → (lead_id)
    idx_biz_rent_premise              → (unit_id, has_rent, wants_own_premise)
    idx_biz_segment                   → (segment)
    idx_biz_unit_id                   → (unit_id)
    idx_biz_unit_progress             → (unit_id, biz_dna_progress)
    idx_biz_working_capital           → (unit_id, needs_working_capital)
*/

-- ── 8.5 Triggers criados ─────────────────────────────────────────────────────
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table  = 'business_profiles'
ORDER BY trigger_name, event_manipulation;
/*
  Resultado esperado: 3 linhas
    trg_biz_profile_update_lead_activity | INSERT | AFTER
    trg_biz_profile_update_lead_activity | UPDATE | AFTER
    trg_biz_profiles_updated_at          | UPDATE | BEFORE
*/

-- ── 8.6 Constraints ───────────────────────────────────────────────────────────
SELECT
  conname,
  pg_get_constraintdef(pg_constraint.oid) AS definicao
FROM pg_constraint
JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
WHERE pg_class.relname = 'business_profiles'
ORDER BY conname;
/*
  Resultado esperado: 5 linhas
    biz_profiles_lead_unique                    → UNIQUE (lead_id)
    business_profiles_biz_dna_progress_check    → CHECK (biz_dna_progress BETWEEN 0 AND 100)
    business_profiles_lead_id_fkey              → FOREIGN KEY → leads(id)
    business_profiles_pkey                      → PRIMARY KEY (id)
    business_profiles_unit_id_fkey              → FOREIGN KEY → units(id)
*/

-- ── 8.7 Função do trigger ────────────────────────────────────────────────────
SELECT
  proname,
  prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname = 'handle_lead_activity_on_biz_profile';
/*
  Resultado esperado: 1 linha
    proname = handle_lead_activity_on_biz_profile
    security_definer = true
*/

-- ── 8.8 Tabela vazia (recém-criada) ──────────────────────────────────────────
SELECT count(*) AS total_registros FROM public.business_profiles;
/*
  Resultado esperado: 0
*/

-- ── 8.9 Testes manuais de isolamento (rode com tokens específicos) ────────────
--
-- COM service_role (SQL Editor do Supabase — comportamento padrão do Editor):
--   SELECT count(*) FROM public.business_profiles;
--   → 0 linhas (tabela vazia), sem erro de permissão ✅
--
-- COM token de unit_admin da unidade Sinop (JWT autenticado via Supabase Auth):
--   SELECT count(*) FROM public.business_profiles;
--   → Retorna apenas perfis onde can_access_unit(unit_id) = true para Sinop ✅
--
-- COM token de unit_viewer:
--   SELECT count(*) FROM public.business_profiles;
--   → 0 linhas (sem policy para unit_viewer — proteção correta) ✅
--
-- COM anon key (sem token JWT):
--   SELECT count(*) FROM public.business_profiles;
--   → 0 linhas (sem policy para anon) ✅
--
-- Inserção de teste via service_role (SQL Editor) — substitua UUIDs reais:
/*
INSERT INTO public.business_profiles (
  unit_id,
  lead_id,
  business_name,
  segment,
  formalization,
  monthly_revenue,
  biz_dna_progress
) VALUES (
  '00000000-0000-0000-0000-000000000001',  -- substitua pelo unit_id real
  '00000000-0000-0000-0000-000000000002',  -- substitua pelo lead_id real
  'Teste Empresa',
  'comercio',
  'mei',
  8000.00,
  20
)
RETURNING *;

-- Confirma que o trigger atualizou o lead
SELECT id, last_seen_at, updated_at
FROM public.leads
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Limpa o teste
UPDATE public.business_profiles
SET deleted_at = NOW()
WHERE business_name = 'Teste Empresa';
*/

-- ── 8.10 Confirma que NENHUMA tabela existente foi alterada ──────────────────
--
-- Verificar que leads, dna_answers, expenses, investments e opportunities
-- não tiveram colunas adicionadas ou removidas:
--
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('leads', 'dna_answers', 'expenses', 'investments', 'opportunities')
  AND column_name NOT IN (
    -- leads
    'id', 'unit_id', 'campaign_id', 'name', 'phone', 'email', 'city',
    'monthly_income', 'monthly_expenses', 'main_dream',
    'consent_diagnosis', 'consent_communications', 'consent_analytics', 'consent_at',
    'source_url', 'unit_slug', 'campaign_slug',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'referrer', 'device_type', 'dna_progress', 'dna_stage', 'status',
    'last_seen_at', 'created_at', 'updated_at', 'deleted_at', 'cpf',
    -- dna_answers
    'step_key', 'question_key', 'question_text', 'answer', 'answer_type', 'answered_at',
    -- expenses
    'amount', 'category', 'description', 'input_method', 'receipt_url',
    'ai_confidence', 'expense_date',
    -- investments
    'investment_type', 'investment_date', 'expected_return', 'current_value', 'is_recurring',
    -- opportunities
    'type', 'title', 'image_url', 'cta_label', 'cta_url',
    'target_dream', 'target_profile', 'featured', 'active', 'position',
    'starts_at', 'ends_at', 'created_by'
  )
ORDER BY table_name, column_name;
/*
  Resultado esperado: 0 linhas
  → Confirma que nenhuma coluna inesperada foi adicionada às tabelas existentes
*/
