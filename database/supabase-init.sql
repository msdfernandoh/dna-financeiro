-- =============================================================================
-- DNA FINANCEIRO — SCRIPT SQL INICIAL — SUPABASE
-- Domínio: dnafinanceiro.app.br
-- Stack: Next.js 14 · Supabase · Vercel · TypeScript · Tailwind · Shadcn UI
-- Versão: 1.0 · Maio 2026
-- Idempotente: seguro para rodar múltiplas vezes
-- =============================================================================
-- INSTRUÇÕES DE EXECUÇÃO — leia antes de rodar
-- 1. Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor
-- 2. Cole este script completo ou rode bloco a bloco na ordem indicada
-- 3. Se rodar bloco a bloco, respeite a ordem: 1 → 2 → 3 → 4 → 5 → 6 → 7
-- 4. O bloco 8 são apenas queries de validação — rode depois para confirmar
-- 5. Este script NÃO configura custom claims no JWT.
--    Isso é feito via Dashboard > Authentication > Hooks (veja comentários no Bloco 6)
-- =============================================================================


-- =============================================================================
-- BLOCO 1 — EXTENSÕES, ENUMS E FUNÇÕES AUXILIARES
-- =============================================================================

-- Habilitar extensão para geração de UUIDs v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Habilitar extensão para funções de texto avançadas (slugs, buscas)
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- -----------------------------------------------------------------------------
-- ENUMS
-- Criados com DO $$ para ser idempotente (IF NOT EXISTS não existe para enums)
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'master',        -- acesso total, sem restrição de unidade
    'unit_admin',    -- acesso completo à própria unidade
    'unit_viewer',   -- acesso de leitura à própria unidade (consultor)
    'end_user'       -- usuário final do app (não acessa painel admin)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_plan AS ENUM (
    'basic',         -- funcionalidades essenciais
    'standard',      -- campanhas e oportunidades avançadas
    'premium'        -- white label + subdomínio próprio
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new',           -- recém cadastrado
    'in_progress',   -- DNA em preenchimento
    'qualified',     -- perfil suficiente para abordagem comercial
    'converted',     -- virou cliente / realizou objetivo
    'inactive'       -- parou de usar o app
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.input_method AS ENUM (
    'manual',        -- digitado pelo usuário
    'voice',         -- reconhecido por voz
    'photo'          -- extraído de foto de comprovante via IA
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.opportunity_type AS ENUM (
    'event',         -- evento presencial ou online
    'course',        -- curso ou workshop
    'challenge',     -- desafio financeiro
    'job',           -- vaga de renda extra / diária
    'banner',        -- banner promocional de parceiro
    'partner'        -- oferta de empresa parceira
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'create',
    'update',
    'delete',
    'export',
    'login',
    'logout',
    'view',
    'suspend',
    'activate',
    'invite',
    'unauthorized_attempt'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_resource AS ENUM (
    'unit',
    'lead',
    'campaign',
    'opportunity',
    'daily_question',
    'expense',
    'dream',
    'admin_user',
    'auth_session',
    'export'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- FUNÇÃO AUXILIAR — atualizar updated_at automaticamente via trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNÇÕES AUXILIARES — extrair claims do JWT do usuário autenticado
--
-- IMPORTANTE: estas funções dependem de custom claims no JWT do Supabase.
-- Os claims 'role', 'unit_id' e 'unit_slug' precisam ser adicionados ao
-- app_metadata do usuário via:
--   Dashboard → Authentication → Hooks → Custom Access Token Hook
--   OU via função SQL chamada após criação do admin_user
--
-- Enquanto os hooks não estiverem configurados, as funções retornam NULL
-- e as policies dependentes desta função não funcionarão para admins.
-- O acesso via service_role key (Next.js server-side) continua funcionando.
-- -----------------------------------------------------------------------------

-- Retorna o role do usuário autenticado via JWT
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'end_user'
  );
$$;

-- Retorna o unit_id do usuário autenticado via JWT (NULL se master)
CREATE OR REPLACE FUNCTION public.get_my_unit_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'unit_id')::UUID;
$$;

-- Retorna true se o usuário autenticado é master
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master',
    false
  );
$$;

-- Retorna true se o usuário autenticado é admin ou superior de uma unidade
CREATE OR REPLACE FUNCTION public.is_unit_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('master', 'unit_admin'),
    false
  );
$$;

-- Retorna true se o usuário autenticado tem acesso de leitura a uma unidade
-- (unit_viewer, unit_admin ou master)
CREATE OR REPLACE FUNCTION public.is_unit_member_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('master', 'unit_admin', 'unit_viewer'),
    false
  );
$$;

-- Retorna true se o unit_id passado pertence ao usuário autenticado (ou se for master)
CREATE OR REPLACE FUNCTION public.can_access_unit(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_master()
    OR (auth.jwt() -> 'app_metadata' ->> 'unit_id')::UUID = p_unit_id;
$$;


-- =============================================================================
-- BLOCO 2 — CRIAÇÃO DAS TABELAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABELA: units (unidades/franquias)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.units (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,    -- ex: "sinop", "sorriso"
  subdomain       TEXT,                    -- ex: "sinop" → sinop.dnafinanceiro.app.br (futuro)
  city            TEXT        NOT NULL,
  state           CHAR(2)     NOT NULL,    -- ex: "MT", "SP"
  plan            public.unit_plan NOT NULL DEFAULT 'basic',
  active          BOOLEAN     NOT NULL DEFAULT true,
  logo_url        TEXT,                    -- path no Supabase Storage
  primary_color   TEXT,                    -- ex: "#7F77DD" (white label — plano premium)
  contact_name    TEXT        NOT NULL,
  contact_email   TEXT        NOT NULL,
  contact_phone   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,             -- soft delete
  CONSTRAINT units_slug_unique UNIQUE (slug),
  CONSTRAINT units_subdomain_unique UNIQUE (subdomain),
  CONSTRAINT units_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$'),
  CONSTRAINT units_state_format CHECK (state ~ '^[A-Z]{2}$')
);

COMMENT ON TABLE  public.units IS 'Unidades/franquias do sistema. Cada unidade tem seu próprio slug de rota.';
COMMENT ON COLUMN public.units.slug IS 'Identificador único na URL: dnafinanceiro.app.br/sinop';
COMMENT ON COLUMN public.units.subdomain IS 'Para subdomínio premium futuro: sinop.dnafinanceiro.app.br';
COMMENT ON COLUMN public.units.primary_color IS 'Cor primária para white label. Apenas plano premium.';

-- -----------------------------------------------------------------------------
-- TABELA: profiles (perfis de usuários admin — espelha auth.users)
-- Criada separada do auth.users para não depender de tabela interna do Supabase
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID        PRIMARY KEY,  -- mesmo id do auth.users
  unit_id         UUID        REFERENCES public.units(id) ON DELETE RESTRICT,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  role            public.user_role NOT NULL DEFAULT 'end_user',
  active          BOOLEAN     NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  -- unit_id deve ser NULL apenas para role = master
  CONSTRAINT profiles_master_no_unit CHECK (
    (role = 'master' AND unit_id IS NULL)
    OR (role != 'master' AND unit_id IS NOT NULL)
  )
);

COMMENT ON TABLE  public.profiles IS 'Perfis de admins. id = auth.users.id. unit_id NULL apenas para master.';
COMMENT ON COLUMN public.profiles.id IS 'FK para auth.users.id — mesmo UUID do Supabase Auth.';
COMMENT ON COLUMN public.profiles.unit_id IS 'NULL apenas para role=master. Obrigatório para unit_admin e unit_viewer.';

-- -----------------------------------------------------------------------------
-- TABELA: unit_admins (convites e vínculos entre admins e unidades)
-- Mantém histórico de convites e permite múltiplas roles por histórico
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.unit_invites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  invited_by      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  email           TEXT        NOT NULL,
  role            public.user_role NOT NULL CHECK (role IN ('unit_admin', 'unit_viewer')),
  token           UUID        NOT NULL DEFAULT gen_random_uuid(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unit_invites_token_unique UNIQUE (token)
);

COMMENT ON TABLE public.unit_invites IS 'Convites para novos admins de unidade. Token válido por 48h.';

-- -----------------------------------------------------------------------------
-- TABELA: campaigns (campanhas por unidade)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,    -- ex: "casa-propria"
  headline        TEXT,
  subheadline     TEXT,
  banner_url      TEXT,
  target_dream    TEXT,                    -- casa | carro | negocio | viagem | etc.
  target_profile  TEXT,                    -- servidor | clt | autonomo | todos
  active          BOOLEAN     NOT NULL DEFAULT true,
  starts_at       DATE,
  ends_at         DATE,
  created_by      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT campaigns_unit_slug_unique UNIQUE (unit_id, slug),
  CONSTRAINT campaigns_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{0,48}[a-z0-9]$')
);

COMMENT ON TABLE  public.campaigns IS 'Campanhas segmentadas por unidade. Gera rota /[unit_slug]/[campaign_slug].';
COMMENT ON COLUMN public.campaigns.slug IS 'Slug da rota: dnafinanceiro.app.br/sinop/casa-propria';

-- -----------------------------------------------------------------------------
-- TABELA: leads (usuários finais — dados cadastrais e de rastreamento)
-- PRIVACIDADE: dados financeiros detalhados ficam em expenses e dreams
-- Consultor (unit_viewer) acessa apenas campos autorizados via view (Bloco 6)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  campaign_id     UUID        REFERENCES public.campaigns(id) ON DELETE SET NULL,

  -- Dados pessoais (visíveis ao usuário e ao admin da unidade)
  name            TEXT        NOT NULL,
  phone           TEXT        NOT NULL,
  email           TEXT,
  city            TEXT,

  -- Dados financeiros declarados
  -- PRIVACIDADE: monthly_income e monthly_expenses são SENSÍVEIS
  -- Unit_viewer NÃO deve acessar esses campos — use a view leads_commercial_summary
  monthly_income  NUMERIC(12,2),
  monthly_expenses NUMERIC(12,2),
  main_dream      TEXT,                    -- casa | carro | negocio | viagem | reserva | etc.

  -- Consentimentos (gravados no momento do aceite — imutáveis após gravação inicial)
  consent_diagnosis     BOOLEAN NOT NULL DEFAULT false,  -- obrigatório para usar o app
  consent_communications BOOLEAN NOT NULL DEFAULT false, -- opcional — receber contato
  consent_analytics     BOOLEAN NOT NULL DEFAULT false,  -- opcional — melhorar produto
  consent_at            TIMESTAMPTZ,                     -- quando aceitou

  -- Rastreamento de origem (gravados no cadastro — nunca alterados depois)
  source_url      TEXT        NOT NULL,
  unit_slug       TEXT        NOT NULL,
  campaign_slug   TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_term        TEXT,
  utm_content     TEXT,
  referrer        TEXT,
  device_type     TEXT,                    -- mobile | tablet | desktop

  -- Progresso no app
  dna_progress    SMALLINT    NOT NULL DEFAULT 0 CHECK (dna_progress BETWEEN 0 AND 100),
  dna_stage       SMALLINT    NOT NULL DEFAULT 1 CHECK (dna_stage BETWEEN 1 AND 6),
  status          public.lead_status NOT NULL DEFAULT 'new',

  -- Controle
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT leads_consent_required CHECK (
    consent_diagnosis = true OR status = 'new'
  )
);

COMMENT ON TABLE  public.leads IS 'Usuários finais do app. Dados sensíveis (income, expenses) não expostos a unit_viewer.';
COMMENT ON COLUMN public.leads.monthly_income IS 'SENSÍVEL — não expor via RLS para unit_viewer. Use leads_commercial_summary.';
COMMENT ON COLUMN public.leads.monthly_expenses IS 'SENSÍVEL — não expor via RLS para unit_viewer. Use leads_commercial_summary.';
COMMENT ON COLUMN public.leads.source_url IS 'URL completa no momento do cadastro. Gravada pelo servidor — imutável.';
COMMENT ON COLUMN public.leads.consent_at IS 'Timestamp do aceite dos termos. Obrigatório para compliance LGPD.';

-- -----------------------------------------------------------------------------
-- VIEW: leads_commercial_summary
-- O que o unit_viewer (consultor) pode ver — sem dados financeiros detalhados
-- Criada como VIEW para garantir que a query de origem nunca exponha campos sensíveis
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.leads_commercial_summary AS
SELECT
  l.id,
  l.unit_id,
  l.campaign_id,
  l.name,
  l.phone,
  l.email,
  l.city,
  l.main_dream,
  -- Faixa de renda em vez do valor exato (LGPD: mínimo necessário)
  CASE
    WHEN l.monthly_income < 2000  THEN 'Até R$ 2.000'
    WHEN l.monthly_income < 4000  THEN 'R$ 2.000 – R$ 4.000'
    WHEN l.monthly_income < 7000  THEN 'R$ 4.000 – R$ 7.000'
    ELSE                               'Acima de R$ 7.000'
  END AS income_range,
  l.unit_slug,
  l.campaign_slug,
  l.device_type,
  l.dna_progress,
  l.dna_stage,
  l.status,
  l.last_seen_at,
  l.created_at,
  c.name AS campaign_name
FROM public.leads l
LEFT JOIN public.campaigns c ON c.id = l.campaign_id
WHERE l.deleted_at IS NULL;

COMMENT ON VIEW public.leads_commercial_summary IS
  'Visão segura para unit_viewer. Sem monthly_income exato, sem expenses, sem UTMs detalhados.';

-- -----------------------------------------------------------------------------
-- TABELA: opportunities (oportunidades por unidade)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.opportunities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  campaign_id     UUID        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  type            public.opportunity_type NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  image_url       TEXT,
  cta_label       TEXT        NOT NULL DEFAULT 'Saiba mais',
  cta_url         TEXT,
  target_dream    TEXT,                    -- NULL = todos os sonhos
  target_profile  TEXT,                    -- NULL = todos os perfis
  featured        BOOLEAN     NOT NULL DEFAULT false,
  active          BOOLEAN     NOT NULL DEFAULT true,
  position        SMALLINT    NOT NULL DEFAULT 0,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  created_by      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.opportunities IS 'Oportunidades segmentadas por unidade. Visíveis no app público filtradas por perfil do lead.';

-- -----------------------------------------------------------------------------
-- TABELA: daily_questions (perguntas do dia por unidade)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.daily_questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  campaign_id     UUID        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  question_text   TEXT        NOT NULL,
  target_profile  TEXT,                    -- NULL = todos
  active_date     DATE        NOT NULL,
  created_by      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_questions_unit_date_unique UNIQUE (unit_id, active_date)
);

COMMENT ON TABLE public.daily_questions IS 'Uma pergunta por unidade por dia. Segmentada por perfil opcionalmente.';

-- -----------------------------------------------------------------------------
-- TABELA: question_answers (respostas dos leads às perguntas do dia)
-- PRIVACIDADE: pode conter respostas sensíveis — NUNCA exposta a unit_viewer
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.question_answers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id         UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES public.daily_questions(id) ON DELETE RESTRICT,
  answer          TEXT        NOT NULL,
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT question_answers_lead_question_unique UNIQUE (lead_id, question_id)
);

COMMENT ON TABLE public.question_answers IS
  'SENSÍVEL — respostas dos leads às perguntas do dia. Não exposta a unit_viewer.';

-- -----------------------------------------------------------------------------
-- TABELA: expenses (despesas lançadas pelo lead)
-- PRIVACIDADE: dados financeiros detalhados — NUNCA visíveis para unit_viewer
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id         UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category        TEXT        NOT NULL,    -- alimentacao | transporte | saude | lazer | moradia | compras | educacao | outros
  description     TEXT,
  input_method    public.input_method NOT NULL DEFAULT 'manual',
  receipt_url     TEXT,                    -- Supabase Storage — path privado
  ai_confidence   SMALLINT    CHECK (ai_confidence BETWEEN 0 AND 100),
  expense_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT expenses_ai_confidence_only_photo CHECK (
    (input_method = 'photo' AND ai_confidence IS NOT NULL)
    OR (input_method != 'photo')
  )
);

COMMENT ON TABLE  public.expenses IS 'SENSÍVEL — despesas individuais do lead. Visível APENAS para o próprio lead e admin master.';
COMMENT ON COLUMN public.expenses.receipt_url IS 'Path no Supabase Storage — bucket privado. Nunca URL pública direta.';
COMMENT ON COLUMN public.expenses.ai_confidence IS 'Preenchido apenas quando input_method = photo. Percentual de confiança da IA.';

-- -----------------------------------------------------------------------------
-- TABELA: dreams (sonhos e metas financeiras do lead)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dreams (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id         UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dream_type      TEXT        NOT NULL,    -- casa | carro | negocio | viagem | reserva | faculdade | reforma | dividas | moto | outro
  target_amount   NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  saved_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  monthly_contribution NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_contribution >= 0),
  is_primary      BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dreams IS 'Sonhos e metas financeiras do lead. Visível ao lead e ao unit_admin (não ao unit_viewer).';

-- -----------------------------------------------------------------------------
-- TABELA: achievements (conquistas desbloqueadas pelo lead)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.achievements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id         UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  achievement_key TEXT        NOT NULL,    -- first_step | dream_set | control_on | 7_days | economy_hunter | income_radar | full_profile
  points          SMALLINT    NOT NULL DEFAULT 0 CHECK (points >= 0),
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT achievements_lead_key_unique UNIQUE (lead_id, achievement_key)
);

COMMENT ON TABLE public.achievements IS 'Conquistas e pontos do lead. Visível ao próprio lead. Resumo visível ao unit_admin.';

-- -----------------------------------------------------------------------------
-- TABELA: audit_logs (log imutável de ações administrativas)
-- PRIVACIDADE: visível APENAS para admin master
-- old_data e new_data não devem conter dados financeiros detalhados do lead
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  unit_id         UUID        REFERENCES public.units(id) ON DELETE SET NULL,
  action          public.audit_action NOT NULL,
  resource_type   public.audit_resource NOT NULL,
  resource_id     UUID,
  -- old_data e new_data: snapshots antes/depois — não incluir campos financeiros do lead
  old_data        JSONB,
  new_data        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- SEM updated_at — audit_logs são IMUTÁVEIS
  -- SEM deleted_at — audit_logs NUNCA são deletados
);

COMMENT ON TABLE  public.audit_logs IS 'IMUTÁVEL — log de ações admin. Visível APENAS para master. Sem UPDATE ou DELETE permitido por RLS.';
COMMENT ON COLUMN public.audit_logs.old_data IS 'Snapshot anterior — não incluir monthly_income, expenses, respostas sensíveis.';
COMMENT ON COLUMN public.audit_logs.new_data IS 'Snapshot posterior — mesma restrição de old_data.';


-- =============================================================================
-- BLOCO 3 — ÍNDICES E CONSTRAINTS
-- =============================================================================

-- units
CREATE INDEX IF NOT EXISTS idx_units_slug       ON public.units(slug)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_active     ON public.units(active)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_plan       ON public.units(plan);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_unit_id ON public.profiles(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role    ON public.profiles(role)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email   ON public.profiles(email);

-- unit_invites
CREATE INDEX IF NOT EXISTS idx_unit_invites_unit_id ON public.unit_invites(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_invites_token   ON public.unit_invites(token);
CREATE INDEX IF NOT EXISTS idx_unit_invites_email   ON public.unit_invites(email);

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_unit_id    ON public.campaigns(unit_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_slug       ON public.campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_active     ON public.campaigns(active)   WHERE deleted_at IS NULL;

-- leads — índices críticos para performance de queries multiunidade
CREATE INDEX IF NOT EXISTS idx_leads_unit_id        ON public.leads(unit_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id    ON public.leads(campaign_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status         ON public.leads(status)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_unit_status    ON public.leads(unit_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at     ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_unit_created   ON public.leads(unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone          ON public.leads(phone);       -- busca por telefone

-- opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_unit_id    ON public.opportunities(unit_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_campaign   ON public.opportunities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_active     ON public.opportunities(unit_id, active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_featured   ON public.opportunities(unit_id, featured) WHERE active = true AND deleted_at IS NULL;

-- daily_questions
CREATE INDEX IF NOT EXISTS idx_daily_questions_unit_date ON public.daily_questions(unit_id, active_date);

-- question_answers — SENSÍVEL: índices para queries do próprio lead
CREATE INDEX IF NOT EXISTS idx_question_answers_unit_id    ON public.question_answers(unit_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_lead_id    ON public.question_answers(lead_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_question_id ON public.question_answers(question_id);

-- expenses — SENSÍVEL: índices para queries do próprio lead
CREATE INDEX IF NOT EXISTS idx_expenses_unit_id     ON public.expenses(unit_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_lead_id     ON public.expenses(lead_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_date        ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_lead_date   ON public.expenses(lead_id, expense_date DESC);

-- dreams
CREATE INDEX IF NOT EXISTS idx_dreams_unit_id   ON public.dreams(unit_id);
CREATE INDEX IF NOT EXISTS idx_dreams_lead_id   ON public.dreams(lead_id);
CREATE INDEX IF NOT EXISTS idx_dreams_primary   ON public.dreams(lead_id, is_primary) WHERE is_primary = true;

-- achievements
CREATE INDEX IF NOT EXISTS idx_achievements_unit_id  ON public.achievements(unit_id);
CREATE INDEX IF NOT EXISTS idx_achievements_lead_id  ON public.achievements(lead_id);

-- audit_logs — unit_id pode ser NULL (ações do master sem unidade)
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON public.audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_unit_id    ON public.audit_logs(unit_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource   ON public.audit_logs(resource_type, resource_id);


-- =============================================================================
-- BLOCO 4 — TRIGGERS DE updated_at
-- =============================================================================

-- Macro para criar trigger de updated_at (evita repetição)
-- Aplicado em todas as tabelas com coluna updated_at

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'units',
    'profiles',
    'campaigns',
    'leads',
    'opportunities',
    'dreams'
    -- NÃO incluir: audit_logs (imutável), achievements (sem updated_at),
    -- question_answers (sem updated_at), expenses (sem updated_at),
    -- daily_questions (sem updated_at), unit_invites (sem updated_at)
  ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;
      CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    ', t, t, t, t);
  END LOOP;
END;
$$;

-- Trigger adicional: atualiza leads.updated_at quando uma expense é inserida
-- (mantém last_seen_at e updated_at do lead sincronizados com atividade)
CREATE OR REPLACE FUNCTION public.handle_lead_activity_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
  SET last_seen_at = NOW(), updated_at = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_update_lead_activity ON public.expenses;
CREATE TRIGGER trg_expenses_update_lead_activity
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_lead_activity_on_expense();


-- =============================================================================
-- BLOCO 5 — ATIVAÇÃO DE RLS
-- =============================================================================

ALTER TABLE public.units               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dreams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- Forçar RLS mesmo para o owner da tabela (segurança adicional)
ALTER TABLE public.leads               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- BLOCO 6 — POLICIES RLS POR TABELA
--
-- IMPORTANTE: as policies abaixo dependem de custom claims no JWT do Supabase.
-- Antes de ativar em produção, configure:
--   Dashboard → Authentication → Hooks → "Custom Access Token Hook"
--   A função hook deve adicionar ao app_metadata:
--     { "role": "unit_admin", "unit_id": "uuid-da-unidade", "unit_slug": "sinop" }
--
-- Enquanto o hook NÃO estiver configurado:
--   - auth.jwt()->'app_metadata' retorna NULL
--   - get_my_role() retorna 'end_user'
--   - Admins não conseguem acessar dados via RLS com a anon key
--   - O Next.js server-side usando service_role key BYPASSA o RLS
--     e funciona normalmente (esse é o comportamento correto para APIs server-side)
-- =============================================================================

-- Limpar policies existentes antes de recriar (idempotência)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- ==========
-- units
-- ==========

-- Qualquer pessoa autenticada pode ler unidades ativas (necessário para o app público resolver unit_slug)
-- O service_role key no Next.js faz essa query sem RLS
CREATE POLICY "units_read_active"
  ON public.units FOR SELECT
  USING (active = true AND deleted_at IS NULL);

-- Master pode ver todas, incluindo inativas
CREATE POLICY "units_read_all_master"
  ON public.units FOR SELECT
  TO authenticated
  USING (public.is_master());

-- Somente master pode inserir e atualizar unidades
CREATE POLICY "units_insert_master"
  ON public.units FOR INSERT
  TO authenticated
  WITH CHECK (public.is_master());

CREATE POLICY "units_update_master"
  ON public.units FOR UPDATE
  TO authenticated
  USING (public.is_master())
  WITH CHECK (public.is_master());

-- Sem DELETE real — usar soft delete via updated_at e deleted_at

-- ==========
-- profiles
-- ==========

-- Usuário autenticado lê seu próprio perfil
CREATE POLICY "profiles_read_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Master lê todos os perfis
CREATE POLICY "profiles_read_all_master"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_master());

-- Unit_admin lê perfis da própria unidade
CREATE POLICY "profiles_read_own_unit"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Inserção via service_role apenas (Next.js server-side ao criar admin via convite)
-- Não criar policy de INSERT para authenticated — sempre via service_role

-- Master atualiza qualquer perfil
CREATE POLICY "profiles_update_master"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_master());

-- Usuário atualiza seu próprio perfil (apenas campos não-sensíveis)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- ==========
-- unit_invites
-- ==========

-- Unit_admin lê convites da própria unidade
CREATE POLICY "unit_invites_read_unit_admin"
  ON public.unit_invites FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Unit_admin cria convites para a própria unidade
CREATE POLICY "unit_invites_insert_unit_admin"
  ON public.unit_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- ==========
-- campaigns
-- ==========

-- Acesso público para leitura de campanhas ativas (app público resolve campaign_slug)
CREATE POLICY "campaigns_read_public_active"
  ON public.campaigns FOR SELECT
  USING (active = true AND deleted_at IS NULL);

-- Admin da unidade lê todas as campanhas da própria unidade (incluindo inativas)
CREATE POLICY "campaigns_read_unit_admin"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    public.is_unit_member_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Unit_admin cria campanhas para a própria unidade
CREATE POLICY "campaigns_insert_unit_admin"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Unit_admin atualiza campanhas da própria unidade
CREATE POLICY "campaigns_update_unit_admin"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (
    public.can_access_unit(unit_id)
  );

-- ==========
-- leads
-- ==========
-- ATENÇÃO: inserção de leads SEMPRE via service_role key no Next.js (Route Handler)
-- Nunca via anon key do browser — o unit_id é injetado pelo servidor

-- Unit_admin lê todos os campos dos leads da própria unidade
CREATE POLICY "leads_read_unit_admin"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
    AND deleted_at IS NULL
  );

-- NOTA: unit_viewer (consultor) NÃO tem policy de SELECT direta em leads
-- Ele acessa APENAS a view leads_commercial_summary (sem dados financeiros sensíveis)
-- A view é criada com SECURITY DEFINER e filtra os campos na definição da view

-- Master lê todos os leads de todas as unidades
CREATE POLICY "leads_read_master"
  ON public.leads FOR SELECT
  TO authenticated
  USING (public.is_master() AND deleted_at IS NULL);

-- Unit_admin atualiza status e campos comerciais do lead (não financeiros)
CREATE POLICY "leads_update_status_unit_admin"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (public.can_access_unit(unit_id));

-- Sem DELETE real em leads — soft delete via deleted_at

-- ==========
-- opportunities
-- ==========

-- Leitura pública de oportunidades ativas (app público)
CREATE POLICY "opportunities_read_public_active"
  ON public.opportunities FOR SELECT
  USING (active = true AND deleted_at IS NULL);

-- Admin da unidade lê todas as oportunidades (incluindo inativas)
CREATE POLICY "opportunities_read_unit_admin"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (
    public.is_unit_member_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Unit_admin cria e edita oportunidades da própria unidade
CREATE POLICY "opportunities_insert_unit_admin"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

CREATE POLICY "opportunities_update_unit_admin"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (public.can_access_unit(unit_id));

-- ==========
-- daily_questions
-- ==========

-- Leitura pública da pergunta do dia da unidade (app público)
CREATE POLICY "daily_questions_read_public"
  ON public.daily_questions FOR SELECT
  USING (true);

-- Admin da unidade cria perguntas para a própria unidade
CREATE POLICY "daily_questions_insert_unit_admin"
  ON public.daily_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- ==========
-- question_answers
-- ==========
-- SENSÍVEL: respostas das perguntas do dia. Unit_viewer NÃO tem acesso.

-- Unit_admin lê respostas da própria unidade
CREATE POLICY "question_answers_read_unit_admin"
  ON public.question_answers FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Master lê todas as respostas
CREATE POLICY "question_answers_read_master"
  ON public.question_answers FOR SELECT
  TO authenticated
  USING (public.is_master());

-- Inserção sempre via service_role key no Next.js (lead session token)

-- ==========
-- expenses
-- ==========
-- SENSÍVEL: despesas individuais. Apenas o próprio lead (via session) e unit_admin.
-- Unit_viewer NUNCA acessa esta tabela diretamente.

-- Unit_admin lê despesas da própria unidade (para relatórios agregados)
CREATE POLICY "expenses_read_unit_admin"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
    AND deleted_at IS NULL
  );

-- Master lê todas as despesas
CREATE POLICY "expenses_read_master"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (public.is_master() AND deleted_at IS NULL);

-- Inserção sempre via service_role key no Next.js (Route Handler de despesa)

-- ==========
-- dreams
-- ==========

-- Unit_admin lê sonhos da própria unidade
CREATE POLICY "dreams_read_unit_admin"
  ON public.dreams FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Master lê todos os sonhos
CREATE POLICY "dreams_read_master"
  ON public.dreams FOR SELECT
  TO authenticated
  USING (public.is_master());

-- ==========
-- achievements
-- ==========

-- Unit_admin lê conquistas da própria unidade (para gamificação e relatórios)
CREATE POLICY "achievements_read_unit_admin"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Master lê todas as conquistas
CREATE POLICY "achievements_read_master"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (public.is_master());

-- ==========
-- audit_logs
-- ==========
-- EXCLUSIVO: somente master pode ler. NENHUM admin de unidade tem acesso.
-- IMUTÁVEL: somente INSERT permitido — sem UPDATE, sem DELETE.

-- Master lê todos os logs
CREATE POLICY "audit_logs_read_master"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_master());

-- Inserção via service_role key no Next.js (Route Handler de auditoria)
-- Não criar policy de INSERT para authenticated — sempre via service_role

-- Bloquear explicitamente UPDATE e DELETE em audit_logs (proteção adicional ao FORCE RLS)
CREATE POLICY "audit_logs_no_update"
  ON public.audit_logs FOR UPDATE
  TO authenticated
  USING (false);  -- nunca permite update

CREATE POLICY "audit_logs_no_delete"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (false);  -- nunca permite delete


-- =============================================================================
-- BLOCO 7 — SEEDS INICIAIS
-- Inserir as unidades piloto do MVP 1
-- Usa INSERT ... ON CONFLICT DO NOTHING para ser idempotente
-- =============================================================================

INSERT INTO public.units (
  name, slug, city, state, plan, active,
  contact_name, contact_email, contact_phone
) VALUES
(
  'DNA Financeiro Sinop',
  'sinop',
  'Sinop',
  'MT',
  'basic',
  true,
  'Responsável Sinop',
  'sinop@dnafinanceiro.app.br',
  NULL
),
(
  'DNA Financeiro Sorriso',
  'sorriso',
  'Sorriso',
  'MT',
  'basic',
  true,
  'Responsável Sorriso',
  'sorriso@dnafinanceiro.app.br',
  NULL
),
(
  'DNA Financeiro Lucas do Rio Verde',
  'lucas-do-rio-verde',
  'Lucas do Rio Verde',
  'MT',
  'basic',
  true,
  'Responsável Lucas',
  'lucas@dnafinanceiro.app.br',
  NULL
)
ON CONFLICT (slug) DO NOTHING;

-- Verificar seeds
-- SELECT id, name, slug, city, plan, active FROM public.units ORDER BY created_at;


-- =============================================================================
-- BLOCO 8 — CONSULTAS DE VALIDAÇÃO
-- Execute após rodar os blocos 1–7 para confirmar que tudo foi criado
-- =============================================================================

-- 8.1 Verificar tabelas criadas
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'units', 'profiles', 'unit_invites', 'campaigns', 'leads',
    'opportunities', 'daily_questions', 'question_answers',
    'expenses', 'dreams', 'achievements', 'audit_logs'
  )
ORDER BY tablename;

-- 8.2 Verificar enums criados
SELECT
  typname AS enum_name,
  array_agg(enumlabel ORDER BY enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN (
  'user_role', 'unit_plan', 'lead_status',
  'input_method', 'opportunity_type', 'audit_action', 'audit_resource'
)
GROUP BY typname
ORDER BY typname;

-- 8.3 Verificar índices criados
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 8.4 Verificar policies RLS criadas
SELECT
  tablename,
  policyname,
  cmd AS operation,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8.5 Verificar funções auxiliares criadas
SELECT
  proname AS function_name,
  prosrc IS NOT NULL AS has_body
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN (
    'handle_updated_at',
    'handle_lead_activity_on_expense',
    'get_my_role',
    'get_my_unit_id',
    'is_master',
    'is_unit_admin_or_above',
    'is_unit_member_or_above',
    'can_access_unit'
  )
ORDER BY proname;

-- 8.6 Verificar seeds das unidades
SELECT
  id,
  name,
  slug,
  city,
  state,
  plan,
  active,
  created_at
FROM public.units
ORDER BY city;

-- 8.7 Verificar triggers de updated_at
SELECT
  trigger_name,
  event_object_table AS table_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_%'
ORDER BY event_object_table;

-- 8.8 Verificar view leads_commercial_summary
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads_commercial_summary'
ORDER BY ordinal_position;

-- 8.9 Teste de isolamento: simular query de unit_viewer de sinop tentando acessar leads
-- (Rode manualmente com um token de unit_viewer para confirmar que retorna 0 linhas)
-- SELECT COUNT(*) FROM public.leads; -- deve retornar 0 para unit_viewer sem policy direta
-- SELECT COUNT(*) FROM public.leads_commercial_summary; -- deve retornar leads da própria unidade

-- 8.10 Confirmar que audit_logs não permite update nem delete via RLS
-- (Rode manualmente como authenticated — deve retornar erro de policy)
-- UPDATE public.audit_logs SET action = 'create' WHERE id = '00000000-0000-0000-0000-000000000000';
-- DELETE FROM public.audit_logs WHERE id = '00000000-0000-0000-0000-000000000000';

