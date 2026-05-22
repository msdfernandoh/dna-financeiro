-- =============================================================================
-- DNA FINANCEIRO — SCRIPT SQL FINAL — SUPABASE
-- Domínio  : dnafinanceiro.app.br
-- Stack    : Next.js 14 · Supabase · Vercel · TypeScript · Tailwind · Shadcn UI
-- Versão   : 2.0-final · Maio 2026
-- Status   : ✅ Pronto para colar no Supabase SQL Editor
-- =============================================================================
--
-- COMO RODAR
--   Opção A (recomendado no primeiro setup)
--     SQL Editor → cole o script inteiro → Run
--
--   Opção B (bloco a bloco — útil em ambientes já existentes)
--     Respeite a ordem: Bloco 1 → 2 → 3 → 4 → 5 → 6 → 7
--     Bloco 8 é somente validação — rode depois
--
--   Idempotência
--     Todos os blocos são seguros para reexecução:
--     CREATE ... IF NOT EXISTS, CREATE OR REPLACE, DO $$ EXCEPTION ...
--     O início do Bloco 6 apaga e recria todas as policies.
--
-- DEPENDÊNCIA OBRIGATÓRIA — JWT Custom Claims
--   As funções get_my_role(), is_master(), can_access_unit() leem o campo
--   app_metadata do JWT do Supabase. Sem o hook configurado, elas retornam
--   'end_user' / false e nenhum admin passa pelas policies via anon key.
--
--   Configure ANTES de colocar em produção:
--     Dashboard → Authentication → Hooks → Custom Access Token Hook
--     A função hook deve inserir em app_metadata:
--       {
--         "role":       "unit_admin",   -- master | unit_admin | unit_viewer
--         "unit_id":    "<uuid>",        -- NULL para master
--         "unit_slug":  "sinop"          -- NULL para master
--       }
--
--   Durante o desenvolvimento:
--     O Next.js server-side usa a service_role key, que bypassa o RLS.
--     Todas as inserções e leituras sensíveis devem usar service_role.
--     A anon key é usada apenas pelo browser — nunca envie dados sensíveis por ela.
--
-- MODELO DE ACESSO RESUMIDO
--   ┌─────────────────────────────────────────────────────────────────┐
--   │  Quem          │  O que acessa via RLS                          │
--   ├─────────────────────────────────────────────────────────────────┤
--   │  anon          │  units ativas, campaigns ativas,               │
--   │                │  opportunities ativas, daily_questions (hoje)  │
--   │  end_user      │  (sem JWT admin — app usa service_role)        │
--   │  unit_viewer   │  leads_commercial_summary (own unit, resumo)  │
--   │  unit_admin    │  leads + dreams + achievements (own unit)      │
--   │  master        │  tudo — todas as unidades                      │
--   │  service_role  │  tudo — bypassa RLS (só no servidor)           │
--   └─────────────────────────────────────────────────────────────────┘
-- =============================================================================


-- =============================================================================
-- BLOCO 1 — EXTENSÕES, ENUMS E FUNÇÕES AUXILIARES
-- =============================================================================

-- ------------------------------------
-- 1.1 Extensões
-- ------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- slugs e buscas sem acento

-- ------------------------------------
-- 1.2 Enums
-- Padrão idempotente: DO $$ EXCEPTION WHEN duplicate_object THEN NULL
-- ------------------------------------

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'master',       -- acesso total, sem restrição de unidade
    'unit_admin',   -- acesso completo à própria unidade
    'unit_viewer',  -- leitura autorizada da própria unidade (consultor)
    'end_user'      -- usuário final do app — não acessa painel admin
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_plan AS ENUM (
    'basic',        -- funcionalidades essenciais
    'standard',     -- campanhas e oportunidades avançadas
    'premium'       -- white label + subdomínio próprio
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'new',          -- recém cadastrado
    'in_progress',  -- DNA em preenchimento
    'qualified',    -- perfil suficiente para abordagem comercial
    'converted',    -- virou cliente / realizou objetivo
    'inactive'      -- sem acesso há mais de 90 dias
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.input_method AS ENUM (
    'manual',       -- digitado pelo usuário
    'voice',        -- reconhecido por voz (MVP 1: simulado)
    'photo'         -- extraído de foto via IA (MVP 1: simulado)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.opportunity_type AS ENUM (
    'event',        -- evento presencial ou online
    'course',       -- curso ou workshop
    'challenge',    -- desafio financeiro gamificado
    'job',          -- vaga de renda extra / diária
    'banner',       -- banner promocional de parceiro
    'partner'       -- oferta de empresa parceira
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'create', 'update', 'delete', 'export',
    'login', 'logout', 'view', 'suspend',
    'activate', 'invite', 'unauthorized_attempt'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_resource AS ENUM (
    'unit', 'lead', 'campaign', 'opportunity',
    'daily_question', 'expense', 'dream',
    'admin_user', 'auth_session', 'export'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------
-- 1.3 Função: updated_at automático
-- ------------------------------------

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

-- ------------------------------------
-- 1.4 Funções auxiliares de JWT
--
-- ⚠️  JWT CUSTOM CLAIMS NECESSÁRIOS
--     Todas as funções abaixo leem auth.jwt()->'app_metadata'.
--     Sem o Custom Access Token Hook configurado, retornam o fallback seguro
--     (false / 'end_user' / NULL) e nenhum admin passa pelas policies de RLS.
--     O Next.js com service_role key continua funcionando normalmente.
-- ------------------------------------

-- Role do usuário autenticado. Fallback 'end_user' é propositalmente seguro.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'end_user'
  );
$$;

-- UUID da unidade do usuário autenticado. NULL para master ou sem JWT.
CREATE OR REPLACE FUNCTION public.get_my_unit_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'unit_id')::UUID;
$$;

-- true apenas para master.
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master',
    false
  );
$$;

-- true para master ou unit_admin (pode criar e editar recursos).
CREATE OR REPLACE FUNCTION public.is_unit_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('master', 'unit_admin'),
    false
  );
$$;

-- true para master, unit_admin ou unit_viewer (pode ler dados autorizados).
CREATE OR REPLACE FUNCTION public.is_unit_member_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('master', 'unit_admin', 'unit_viewer'),
    false
  );
$$;

-- true se p_unit_id é a unidade do usuário autenticado, OU se ele é master.
-- Usada em EVERY policy que isola por unidade — é o coração do multiunidade.
CREATE OR REPLACE FUNCTION public.can_access_unit(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_master()
    OR (auth.jwt() -> 'app_metadata' ->> 'unit_id')::UUID = p_unit_id;
$$;

-- ------------------------------------
-- 1.5 Função auxiliar: trigger de atividade do lead
-- (definida aqui para não dividir o BLOCO 4 com definição de função)
-- ------------------------------------

CREATE OR REPLACE FUNCTION public.handle_lead_activity_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza last_seen_at e updated_at do lead quando uma despesa é inserida
  UPDATE public.leads
  SET last_seen_at = NOW(),
      updated_at   = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- BLOCO 2 — CRIAÇÃO DAS TABELAS
-- Ordem respeita dependências de FK:
--   units → profiles → unit_invites → campaigns → leads → opportunities
--   → daily_questions → question_answers → expenses → dreams
--   → achievements → audit_logs
-- =============================================================================

-- ------------------------------------
-- 2.1 units — unidades/franquias
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.units (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT            NOT NULL,
  -- Slug: identificador único de URL — dnafinanceiro.app.br/sinop
  slug            TEXT            NOT NULL,
  -- Subdomínio premium futuro — sinop.dnafinanceiro.app.br
  subdomain       TEXT,
  city            TEXT            NOT NULL,
  state           CHAR(2)         NOT NULL,
  plan            public.unit_plan NOT NULL DEFAULT 'basic',
  active          BOOLEAN         NOT NULL DEFAULT true,
  -- Logo e cor: injetados via CSS variable para white label (plano premium)
  logo_url        TEXT,
  primary_color   TEXT,
  contact_name    TEXT            NOT NULL,
  contact_email   TEXT            NOT NULL,
  contact_phone   TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,                              -- soft delete
  CONSTRAINT units_slug_unique      UNIQUE (slug),
  CONSTRAINT units_subdomain_unique UNIQUE (subdomain),
  -- Slugs aceitos: letras minúsculas, números, hífens. Sem espaços ou especiais.
  CONSTRAINT units_slug_format      CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$'),
  CONSTRAINT units_state_format     CHECK (state ~ '^[A-Z]{2}$')
);

COMMENT ON TABLE  public.units IS 'Unidades/franquias. slug é o identificador de rota.';
COMMENT ON COLUMN public.units.slug IS 'Ex: "sinop" → dnafinanceiro.app.br/sinop';
COMMENT ON COLUMN public.units.subdomain IS 'Ex: "sinop" → sinop.dnafinanceiro.app.br (plano premium)';
COMMENT ON COLUMN public.units.primary_color IS 'Hex sem # — ex: "7F77DD". White label plano premium.';

-- ------------------------------------
-- 2.2 profiles — admins do sistema
-- Espelha auth.users. id = auth.users.id (mesmo UUID).
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID            PRIMARY KEY,   -- FK implícita: auth.users.id
  unit_id         UUID            REFERENCES public.units(id) ON DELETE RESTRICT,
  name            TEXT            NOT NULL,
  email           TEXT            NOT NULL,
  role            public.user_role NOT NULL DEFAULT 'end_user',
  active          BOOLEAN         NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  -- unit_id é NULL apenas para master; obrigatório para unit_admin e unit_viewer
  CONSTRAINT profiles_master_no_unit CHECK (
    (role = 'master'   AND unit_id IS NULL)
    OR
    (role != 'master'  AND unit_id IS NOT NULL)
  )
);

COMMENT ON TABLE  public.profiles IS 'Admins. id = auth.users.id. unit_id NULL apenas para role=master.';
COMMENT ON COLUMN public.profiles.id IS 'Mesmo UUID do auth.users — inserido pelo servidor via service_role após criação no Auth.';

-- ------------------------------------
-- 2.3 unit_invites — convites de admin
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.unit_invites (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID            NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  invited_by      UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  email           TEXT            NOT NULL,
  -- Apenas unit_admin e unit_viewer podem ser convidados — nunca master
  role            public.user_role NOT NULL CHECK (role IN ('unit_admin', 'unit_viewer')),
  token           UUID            NOT NULL DEFAULT gen_random_uuid(),
  expires_at      TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT unit_invites_token_unique UNIQUE (token)
);

COMMENT ON TABLE public.unit_invites IS 'Convites para admins de unidade. Token expira em 48h.';

-- ------------------------------------
-- 2.4 campaigns — campanhas por unidade
-- Gera rota pública: dnafinanceiro.app.br/[unit_slug]/[campaign_slug]
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.campaigns (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  name            TEXT            NOT NULL,
  slug            TEXT            NOT NULL,     -- ex: "casa-propria"
  headline        TEXT,
  subheadline     TEXT,
  banner_url      TEXT,
  target_dream    TEXT,           -- casa | carro | negocio | viagem | etc.
  target_profile  TEXT,           -- servidor | clt | autonomo | todos
  active          BOOLEAN         NOT NULL DEFAULT true,
  starts_at       DATE,
  ends_at         DATE,
  created_by      UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  -- Slug único por unidade (duas unidades podem ter slug igual entre si)
  CONSTRAINT campaigns_unit_slug_unique UNIQUE (unit_id, slug),
  CONSTRAINT campaigns_slug_format      CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{0,48}[a-z0-9]$')
);

COMMENT ON TABLE  public.campaigns IS 'Campanhas por unidade. Gera /[unit_slug]/[campaign_slug].';
COMMENT ON COLUMN public.campaigns.slug IS 'Ex: "casa-propria" → /sinop/casa-propria';

-- ------------------------------------
-- 2.5 leads — usuários finais do app
--
-- PRIVACIDADE — campos sensíveis:
--   monthly_income, monthly_expenses: nunca expostos a unit_viewer
--   utm_*, referrer, source_url: rastreamento interno, nunca ao consultor
--   consent_*: compliance LGPD, somente para o próprio lead e o master
--
-- Inserção: SEMPRE via service_role no Route Handler do Next.js.
--   O unit_id é injetado pelo servidor a partir do slug da URL — nunca vem do browser.
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.leads (
  id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id                 UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  campaign_id             UUID            REFERENCES public.campaigns(id) ON DELETE SET NULL,

  -- Dados pessoais
  name                    TEXT            NOT NULL,
  phone                   TEXT            NOT NULL,
  email                   TEXT,
  city                    TEXT,

  -- Dados financeiros declarados
  -- ⚠️  SENSÍVEIS: unit_viewer NÃO acessa. Use a view leads_commercial_summary.
  monthly_income          NUMERIC(12,2),
  monthly_expenses        NUMERIC(12,2),
  main_dream              TEXT,           -- casa | carro | negocio | viagem | etc.

  -- Consentimentos LGPD — gravados pelo servidor, nunca alterados pelo cliente
  consent_diagnosis       BOOLEAN         NOT NULL DEFAULT false,  -- obrigatório para uso do app
  consent_communications  BOOLEAN         NOT NULL DEFAULT false,  -- opcional — receber contato
  consent_analytics       BOOLEAN         NOT NULL DEFAULT false,  -- opcional — melhoria do produto
  consent_at              TIMESTAMPTZ,    -- timestamp do aceite — obrigatório para compliance

  -- Rastreamento de origem — gravados pelo servidor na inserção, imutáveis
  source_url              TEXT            NOT NULL,
  unit_slug               TEXT            NOT NULL,
  campaign_slug           TEXT,
  utm_source              TEXT,
  utm_medium              TEXT,
  utm_campaign            TEXT,
  utm_term                TEXT,
  utm_content             TEXT,
  referrer                TEXT,
  device_type             TEXT,           -- mobile | tablet | desktop

  -- Progresso no app
  dna_progress            SMALLINT        NOT NULL DEFAULT 0  CHECK (dna_progress BETWEEN 0 AND 100),
  dna_stage               SMALLINT        NOT NULL DEFAULT 1  CHECK (dna_stage    BETWEEN 1 AND 6),
  status                  public.lead_status NOT NULL DEFAULT 'new',
  last_seen_at            TIMESTAMPTZ,

  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,

  -- Consentimento obrigatório a partir de qualquer status que não seja 'new'
  CONSTRAINT leads_consent_required CHECK (
    consent_diagnosis = true OR status = 'new'
  )
);

COMMENT ON TABLE  public.leads IS 'Usuários finais. Inserção obrigatória via service_role. unit_id vem do servidor.';
COMMENT ON COLUMN public.leads.monthly_income IS '⚠️ SENSÍVEL — unit_viewer não acessa. Usar leads_commercial_summary.';
COMMENT ON COLUMN public.leads.monthly_expenses IS '⚠️ SENSÍVEL — unit_viewer não acessa. Usar leads_commercial_summary.';
COMMENT ON COLUMN public.leads.source_url IS 'URL completa no cadastro. Gravada pelo servidor — imutável.';
COMMENT ON COLUMN public.leads.consent_at IS 'Timestamp do aceite dos termos — obrigatório para LGPD.';
COMMENT ON COLUMN public.leads.unit_id IS 'Injetado pelo Route Handler a partir do slug da URL. Nunca vem do browser.';

-- ------------------------------------
-- 2.6 VIEW: leads_commercial_summary
--
-- O QUE É:
--   Visão segura do lead para unit_viewer (consultor) e unit_admin.
--   Expõe apenas dados comerciais autorizados — sem valores financeiros exatos.
--
-- SEGURANÇA:
--   SECURITY DEFINER (security_invoker = false): a view executa com os privilégios
--   do owner (postgres), não do chamador. Isso permite ler leads internamente
--   sem conceder SELECT diretamente para unit_viewer.
--   O isolamento real é garantido pelo WHERE duplo abaixo.
--
-- ⚠️  JWT CUSTOM CLAIMS NECESSÁRIOS:
--   Os filtros chamam is_unit_member_or_above() e can_access_unit(), que
--   dependem de app_metadata no JWT. Sem o hook configurado:
--     • anon / end_user → retorna 0 linhas (comportamento seguro)
--     • unit_admin / unit_viewer → também retorna 0 linhas até o hook ser ativado
--     • service_role → lê diretamente, bypassa a view se necessário
--
-- CAMPOS EXCLUÍDOS INTENCIONALMENTE (nunca devem aparecer na view):
--   monthly_income, monthly_expenses → substituídos por income_range
--   utm_source/medium/campaign/term/content, referrer → marketing interno
--   source_url → rastreamento técnico
--   consent_diagnosis/communications/analytics, consent_at → LGPD
--   deleted_at → controle interno
-- ------------------------------------

DROP VIEW IF EXISTS public.leads_commercial_summary;

CREATE VIEW public.leads_commercial_summary
  WITH (security_invoker = false)   -- SECURITY DEFINER equivalente para views
AS
SELECT
  l.id,
  l.unit_id,
  l.campaign_id,
  l.name,
  l.phone,
  l.email,
  l.city,
  l.main_dream,

  -- Faixa de renda — nunca o valor exato (LGPD: princípio de minimização)
  CASE
    WHEN l.monthly_income IS NULL THEN 'Não informado'
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
  l.updated_at,
  c.name AS campaign_name

FROM public.leads l
LEFT JOIN public.campaigns c
       ON c.id          = l.campaign_id
      AND c.deleted_at  IS NULL

WHERE
  l.deleted_at IS NULL

  -- FILTRO A: bloqueia anon, end_user e não-autenticados
  -- ⚠️  Depende de JWT custom claims. Sem o hook → retorna 0 linhas (seguro).
  AND public.is_unit_member_or_above()

  -- FILTRO B: isola por unidade
  -- unit_admin/unit_viewer: apenas leads da própria unidade
  -- master: pode_access_unit() retorna true para qualquer unit_id
  -- ⚠️  Depende de JWT custom claims.
  AND public.can_access_unit(l.unit_id);

COMMENT ON VIEW public.leads_commercial_summary IS
  'Visão segura para unit_viewer e unit_admin. '
  'Filtra por is_unit_member_or_above() + can_access_unit(). '
  'Exclui: valores exatos de renda, despesas, UTMs, rastreamento e consentimentos. '
  'anon e end_user retornam 0 linhas mesmo com SECURITY DEFINER.';

-- Revogar acesso público e anon — conceder somente para authenticated
REVOKE ALL  ON public.leads_commercial_summary FROM public;
REVOKE ALL  ON public.leads_commercial_summary FROM anon;
GRANT SELECT ON public.leads_commercial_summary TO authenticated;

-- Owner postgres garante que SECURITY DEFINER lê a tabela leads
ALTER VIEW public.leads_commercial_summary OWNER TO postgres;

-- ------------------------------------
-- 2.7 opportunities — oportunidades por unidade
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.opportunities (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  campaign_id     UUID            REFERENCES public.campaigns(id) ON DELETE SET NULL,
  type            public.opportunity_type NOT NULL,
  title           TEXT            NOT NULL,
  description     TEXT,
  image_url       TEXT,
  cta_label       TEXT            NOT NULL DEFAULT 'Saiba mais',
  cta_url         TEXT,
  target_dream    TEXT,           -- NULL = todos os sonhos
  target_profile  TEXT,           -- NULL = todos os perfis
  featured        BOOLEAN         NOT NULL DEFAULT false,
  active          BOOLEAN         NOT NULL DEFAULT true,
  position        SMALLINT        NOT NULL DEFAULT 0,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  created_by      UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.opportunities IS 'Oportunidades por unidade. Filtradas no servidor por perfil do lead.';

-- ------------------------------------
-- 2.8 daily_questions — pergunta do dia por unidade
-- Uma pergunta por unidade por data (UNIQUE constraint).
-- Leitura pública restrita por date via policy — nunca USING (true).
-- O app público usa service_role no servidor para resolver unit_slug.
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.daily_questions (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  campaign_id     UUID            REFERENCES public.campaigns(id) ON DELETE SET NULL,
  question_text   TEXT            NOT NULL,
  target_profile  TEXT,           -- NULL = todos
  active_date     DATE            NOT NULL,
  created_by      UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_questions_unit_date_unique UNIQUE (unit_id, active_date)
);

COMMENT ON TABLE public.daily_questions IS 'Uma pergunta por unidade por dia. Leitura pública restrita à data de hoje.';

-- ------------------------------------
-- 2.9 question_answers — respostas dos leads
--
-- ⚠️  SENSÍVEL: respostas podem conter conteúdo delicado
--     ("Qual dívida mais tira seu sono?", "Você tem medo de não pagar o aluguel?")
-- MVP 1: somente master lê via RLS.
-- MVP 2 futuro: unit_admin terá acesso a contagens agregadas via função dedicada.
-- Inserção: via service_role (lead_session_token no Route Handler).
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.question_answers (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id         UUID            NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  question_id     UUID            NOT NULL REFERENCES public.daily_questions(id) ON DELETE RESTRICT,
  answer          TEXT            NOT NULL,
  answered_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT question_answers_lead_question_unique UNIQUE (lead_id, question_id)
);

COMMENT ON TABLE public.question_answers IS
  '⚠️ SENSÍVEL — respostas dos leads. MVP 1: somente master lê via RLS. '
  'MVP 2: unit_admin terá acesso a resumos agregados via função, nunca registros brutos.';

-- ------------------------------------
-- 2.10 expenses — despesas individuais dos leads
--
-- ⚠️  SENSÍVEL: dados financeiros individuais (valor, categoria, data, descrição)
-- MVP 1: somente master lê via RLS. unit_admin não acessa registros brutos.
-- MVP 2 futuro: unit_admin terá totais por categoria via função agregada.
-- Inserção: via service_role (lead_session_token no Route Handler).
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id         UUID            NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2)   NOT NULL CHECK (amount > 0),
  category        TEXT            NOT NULL,  -- alimentacao|transporte|saude|lazer|moradia|compras|educacao|outros
  description     TEXT,
  input_method    public.input_method NOT NULL DEFAULT 'manual',
  receipt_url     TEXT,           -- path no Supabase Storage (bucket privado)
  -- ai_confidence: preenchido somente quando input_method = 'photo'
  ai_confidence   SMALLINT        CHECK (ai_confidence BETWEEN 0 AND 100),
  expense_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT expenses_ai_confidence_only_photo CHECK (
    (input_method = 'photo' AND ai_confidence IS NOT NULL)
    OR (input_method != 'photo')
  )
);

COMMENT ON TABLE  public.expenses IS
  '⚠️ SENSÍVEL — despesas individuais. MVP 1: somente master lê via RLS. '
  'unit_admin: acesso a totais agregados via função no MVP 2.';
COMMENT ON COLUMN public.expenses.receipt_url IS 'Path no Supabase Storage — bucket privado. Nunca URL pública.';
COMMENT ON COLUMN public.expenses.ai_confidence IS 'Percentual de confiança da IA. Somente quando input_method = photo.';

-- ------------------------------------
-- 2.11 dreams — sonhos e metas dos leads
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.dreams (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id               UUID            NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dream_type            TEXT            NOT NULL,  -- casa|carro|negocio|viagem|reserva|faculdade|reforma|dividas|moto|outro
  target_amount         NUMERIC(12,2)   NOT NULL CHECK (target_amount > 0),
  saved_amount          NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  monthly_contribution  NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (monthly_contribution >= 0),
  is_primary            BOOLEAN         NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dreams IS 'Sonhos e metas do lead. unit_admin acessa via policy. unit_viewer não acessa.';

-- ------------------------------------
-- 2.12 achievements — conquistas desbloqueadas
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.achievements (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID            NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  lead_id         UUID            NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  -- Chaves válidas: first_step | dream_set | control_on | 7_days | economy_hunter | income_radar | full_profile
  achievement_key TEXT            NOT NULL,
  points          SMALLINT        NOT NULL DEFAULT 0 CHECK (points >= 0),
  unlocked_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT achievements_lead_key_unique UNIQUE (lead_id, achievement_key)
);

COMMENT ON TABLE public.achievements IS 'Conquistas do lead. unit_admin vê contagem. unit_viewer não acessa.';

-- ------------------------------------
-- 2.13 audit_logs — log imutável de ações admin
--
-- REGRAS DE IMUTABILIDADE:
--   • Sem coluna updated_at (não deve ser atualizado)
--   • Sem coluna deleted_at (não deve ser deletado)
--   • Policies explícitas bloqueiam UPDATE e DELETE para qualquer authenticated
--   • FORCE ROW LEVEL SECURITY aplicado no Bloco 5
--   • Inserção: somente via service_role no Next.js (Route Handler de auditoria)
--
-- CONTEÚDO DE old_data e new_data:
--   Nunca incluir: monthly_income, expenses, question_answers, receitas
--   Incluir: campos comerciais não-sensíveis (status, campaign_id, role)
-- ------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  unit_id         UUID            REFERENCES public.units(id) ON DELETE SET NULL,  -- NULL se master sem contexto de unidade
  action          public.audit_action   NOT NULL,
  resource_type   public.audit_resource NOT NULL,
  resource_id     UUID,
  old_data        JSONB,          -- snapshot anterior — sem dados financeiros
  new_data        JSONB,          -- snapshot posterior — sem dados financeiros
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
  -- Sem updated_at: imutável por design
  -- Sem deleted_at: nunca deletado
);

COMMENT ON TABLE  public.audit_logs IS '⚠️ IMUTÁVEL — log de ações admin. Somente master lê. UPDATE e DELETE bloqueados por policy.';
COMMENT ON COLUMN public.audit_logs.old_data IS 'Snapshot anterior. Não incluir monthly_income, expenses ou question_answers.';
COMMENT ON COLUMN public.audit_logs.new_data IS 'Snapshot posterior. Mesma restrição.';
COMMENT ON COLUMN public.audit_logs.unit_id IS 'NULL quando master age sem contexto de unidade (ex: criar unidade global).';


-- =============================================================================
-- BLOCO 3 — ÍNDICES
-- Todos com CREATE INDEX IF NOT EXISTS — idempotente.
-- Índices parciais (WHERE) excluem soft-deleted automaticamente.
-- =============================================================================

-- units
CREATE INDEX IF NOT EXISTS idx_units_slug         ON public.units(slug)                        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_active        ON public.units(active)                      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_plan          ON public.units(plan);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_unit_id    ON public.profiles(unit_id)                  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role       ON public.profiles(role)                     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email      ON public.profiles(email);

-- unit_invites
CREATE INDEX IF NOT EXISTS idx_invites_unit_id     ON public.unit_invites(unit_id);
CREATE INDEX IF NOT EXISTS idx_invites_token       ON public.unit_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email       ON public.unit_invites(email);

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_unit_id   ON public.campaigns(unit_id)                 WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_slug      ON public.campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_active    ON public.campaigns(active)                  WHERE deleted_at IS NULL;

-- leads — críticos para isolamento e performance multiunidade
CREATE INDEX IF NOT EXISTS idx_leads_unit_id       ON public.leads(unit_id)                     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id   ON public.leads(campaign_id)                 WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status        ON public.leads(status)                      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_unit_status   ON public.leads(unit_id, status)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_unit_created  ON public.leads(unit_id, created_at DESC)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at    ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone         ON public.leads(phone);

-- opportunities
CREATE INDEX IF NOT EXISTS idx_opps_unit_id        ON public.opportunities(unit_id)             WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opps_campaign       ON public.opportunities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_opps_unit_active    ON public.opportunities(unit_id, active)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opps_unit_featured  ON public.opportunities(unit_id, featured)   WHERE active = true AND deleted_at IS NULL;

-- daily_questions
CREATE INDEX IF NOT EXISTS idx_dq_unit_date        ON public.daily_questions(unit_id, active_date);

-- question_answers — sensível: acesso apenas por lead_id ou unit_id
CREATE INDEX IF NOT EXISTS idx_qa_unit_id          ON public.question_answers(unit_id);
CREATE INDEX IF NOT EXISTS idx_qa_lead_id          ON public.question_answers(lead_id);
CREATE INDEX IF NOT EXISTS idx_qa_question_id      ON public.question_answers(question_id);

-- expenses — sensível: acesso apenas por lead_id (próprio lead ou master)
CREATE INDEX IF NOT EXISTS idx_expenses_unit_id    ON public.expenses(unit_id)                  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_lead_id    ON public.expenses(lead_id)                  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_lead_date  ON public.expenses(lead_id, expense_date DESC);

-- dreams
CREATE INDEX IF NOT EXISTS idx_dreams_unit_id      ON public.dreams(unit_id);
CREATE INDEX IF NOT EXISTS idx_dreams_lead_id      ON public.dreams(lead_id);
CREATE INDEX IF NOT EXISTS idx_dreams_primary      ON public.dreams(lead_id, is_primary)        WHERE is_primary = true;

-- achievements
CREATE INDEX IF NOT EXISTS idx_ach_unit_id         ON public.achievements(unit_id);
CREATE INDEX IF NOT EXISTS idx_ach_lead_id         ON public.achievements(lead_id);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_admin_user    ON public.audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_unit_id       ON public.audit_logs(unit_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at    ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action        ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource      ON public.audit_logs(resource_type, resource_id);


-- =============================================================================
-- BLOCO 4 — TRIGGERS DE updated_at
-- =============================================================================

-- Loop idempotente: recria triggers de updated_at para todas as tabelas
-- que possuem a coluna. Tabelas excluídas intencionalmente estão comentadas.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'units',
    'profiles',
    'campaigns',
    'leads',
    'opportunities',
    'dreams'
    -- Sem updated_at (por design):
    -- unit_invites, daily_questions, question_answers,
    -- expenses, achievements, audit_logs
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

-- Trigger adicional: atualiza last_seen_at e updated_at do lead
-- sempre que uma nova despesa for inserida para ele
DROP TRIGGER IF EXISTS trg_expenses_update_lead_activity ON public.expenses;
CREATE TRIGGER trg_expenses_update_lead_activity
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_lead_activity_on_expense();


-- =============================================================================
-- BLOCO 5 — ATIVAÇÃO DE RLS
-- =============================================================================

ALTER TABLE public.units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dreams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;

-- FORCE RLS nas tabelas mais sensíveis:
-- garante RLS mesmo para o owner da tabela, sem exceção
ALTER TABLE public.leads              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_questions    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- BLOCO 6 — POLICIES RLS POR TABELA
--
-- ⚠️  JWT CUSTOM CLAIMS NECESSÁRIOS
--     As policies de admin (unit_admin, unit_viewer, master) dependem de
--     app_metadata no JWT. Sem o Custom Access Token Hook configurado:
--       • get_my_role() retorna 'end_user'
--       • is_master() retorna false
--       • can_access_unit() retorna false
--     Resultado: authenticated sem claims não passa em nenhuma policy de admin.
--     O Next.js com service_role key bypassa RLS — funciona normalmente.
--
-- PATTERN DE ISOLAMENTO MULTIUNIDADE:
--   Toda policy de leitura para admins de unidade usa o par:
--     is_unit_member_or_above()   → verifica se o role tem permissão
--     can_access_unit(unit_id)    → verifica se a unidade é a correta
--   Master passa em can_access_unit() sempre (is_master() = true).
-- =============================================================================

-- Limpar TODAS as policies antes de recriar — garante idempotência total
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END;
$$;

-- ═══════════════════════
-- units
-- ═══════════════════════

-- Leitura pública de unidades ativas
-- Necessário para o Next.js middleware resolver unit_slug antes de qualquer auth
CREATE POLICY "units_read_active"
  ON public.units FOR SELECT
  USING (active = true AND deleted_at IS NULL);

-- Master vê todas as unidades, incluindo inativas e soft-deleted
CREATE POLICY "units_read_all_master"
  ON public.units FOR SELECT
  TO authenticated
  USING (public.is_master());

-- Criação e edição de unidades: somente master
CREATE POLICY "units_insert_master"
  ON public.units FOR INSERT
  TO authenticated
  WITH CHECK (public.is_master());

CREATE POLICY "units_update_master"
  ON public.units FOR UPDATE
  TO authenticated
  USING    (public.is_master())
  WITH CHECK (public.is_master());

-- Sem DELETE: usar soft delete via deleted_at

-- ═══════════════════════
-- profiles
-- ═══════════════════════

-- Admin lê o próprio perfil (qualquer role)
CREATE POLICY "profiles_read_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Master lê todos os perfis
CREATE POLICY "profiles_read_all_master"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_master());

-- unit_admin lê perfis da própria unidade (para gestão de acesso)
CREATE POLICY "profiles_read_own_unit"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Master atualiza qualquer perfil (role, active, etc.)
CREATE POLICY "profiles_update_master"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_master());

-- Admin atualiza o próprio perfil (nome, last_login_at)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- INSERT: somente via service_role no servidor (criação de admin via convite)

-- ═══════════════════════
-- unit_invites
-- ═══════════════════════

-- unit_admin lê convites da própria unidade
CREATE POLICY "unit_invites_read_unit_admin"
  ON public.unit_invites FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- unit_admin cria convites para a própria unidade
CREATE POLICY "unit_invites_insert_unit_admin"
  ON public.unit_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- ═══════════════════════
-- campaigns
-- ═══════════════════════

-- Leitura pública de campanhas ativas
-- O Next.js usa service_role, mas esta policy cobre ferramentas e edge cases
CREATE POLICY "campaigns_read_public_active"
  ON public.campaigns FOR SELECT
  USING (active = true AND deleted_at IS NULL);

-- Admins da unidade leem todas as campanhas (incluindo inativas) da própria unidade
CREATE POLICY "campaigns_read_unit_admin"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    public.is_unit_member_or_above()
    AND public.can_access_unit(unit_id)
  );

-- unit_admin cria campanhas para a própria unidade
CREATE POLICY "campaigns_insert_unit_admin"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- unit_admin edita campanhas da própria unidade
CREATE POLICY "campaigns_update_unit_admin"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (public.can_access_unit(unit_id));

-- ═══════════════════════
-- leads
-- ═══════════════════════
-- INSERT: SEMPRE via service_role no Route Handler. Nunca via anon key.
-- unit_viewer: acessa APENAS via view leads_commercial_summary — sem policy direta.

-- unit_admin lê leads completos da própria unidade (incluindo dados financeiros)
-- unit_viewer NÃO tem policy aqui — acessa somente a view
CREATE POLICY "leads_read_unit_admin"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
    AND deleted_at IS NULL
  );

-- Master lê leads de todas as unidades
CREATE POLICY "leads_read_master"
  ON public.leads FOR SELECT
  TO authenticated
  USING (public.is_master() AND deleted_at IS NULL);

-- unit_admin atualiza campos comerciais do lead (status, dna_stage, dna_progress)
-- Atenção: RLS não restringe colunas — o Route Handler deve validar quais campos aceita
CREATE POLICY "leads_update_unit_admin"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (public.can_access_unit(unit_id));

-- Sem DELETE: soft delete via deleted_at

-- ═══════════════════════
-- opportunities
-- ═══════════════════════

-- Leitura pública de oportunidades ativas (app público do lead)
CREATE POLICY "opps_read_public_active"
  ON public.opportunities FOR SELECT
  USING (active = true AND deleted_at IS NULL);

-- Admins da unidade leem todas as oportunidades (incluindo inativas)
CREATE POLICY "opps_read_unit_admin"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (
    public.is_unit_member_or_above()
    AND public.can_access_unit(unit_id)
  );

-- unit_admin cria oportunidades para a própria unidade
CREATE POLICY "opps_insert_unit_admin"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- unit_admin edita oportunidades da própria unidade
CREATE POLICY "opps_update_unit_admin"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (public.can_access_unit(unit_id));

-- ═══════════════════════
-- daily_questions
-- ═══════════════════════
-- Sem USING (true) — leitura pública é restrita por data atual.
-- O app público usa service_role no servidor — esta policy cobre clientes
-- autenticados (painel admin) e a salvaguarda de anon.

-- Admins da unidade leem todas as perguntas da própria unidade (histórico)
CREATE POLICY "dq_read_unit_admin"
  ON public.daily_questions FOR SELECT
  TO authenticated
  USING (
    public.is_unit_member_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Leitura pública restrita: somente a pergunta de HOJE de qualquer unidade
-- Não filtra por unit_id pois anon não tem JWT.
-- O isolamento real é feito pelo servidor via service_role + unit_slug da URL.
-- Esta policy evita exposição de histórico de perguntas.
CREATE POLICY "dq_read_public_today"
  ON public.daily_questions FOR SELECT
  USING (active_date = CURRENT_DATE);

-- unit_admin cria perguntas para a própria unidade
CREATE POLICY "dq_insert_unit_admin"
  ON public.daily_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- unit_admin edita perguntas da própria unidade
CREATE POLICY "dq_update_unit_admin"
  ON public.daily_questions FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (public.can_access_unit(unit_id));

-- ═══════════════════════
-- question_answers — SENSÍVEL
-- ═══════════════════════
-- MVP 1: somente master lê via RLS.
-- unit_admin NÃO tem policy de leitura — receberá acesso a agregados no MVP 2.
-- INSERT: via service_role no Route Handler (lead_session_token).

CREATE POLICY "qa_read_master"
  ON public.question_answers FOR SELECT
  TO authenticated
  USING (public.is_master());

-- ═══════════════════════
-- expenses — SENSÍVEL
-- ═══════════════════════
-- MVP 1: somente master lê registros individuais via RLS.
-- unit_admin NÃO tem policy de leitura — receberá totais agregados no MVP 2.
-- INSERT: via service_role no Route Handler (lead_session_token).

CREATE POLICY "expenses_read_master"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (public.is_master() AND deleted_at IS NULL);

-- ═══════════════════════
-- dreams
-- ═══════════════════════

-- unit_admin lê sonhos da própria unidade (perfil completo do lead no painel)
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

-- unit_admin atualiza sonhos da própria unidade (meta ajustada manualmente)
CREATE POLICY "dreams_update_unit_admin"
  ON public.dreams FOR UPDATE
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  )
  WITH CHECK (public.can_access_unit(unit_id));

-- INSERT: via service_role no Route Handler

-- ═══════════════════════
-- achievements
-- ═══════════════════════

-- unit_admin lê conquistas da própria unidade (contagem no perfil do lead)
CREATE POLICY "ach_read_unit_admin"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Master lê todas as conquistas
CREATE POLICY "ach_read_master"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (public.is_master());

-- INSERT: via service_role no Route Handler

-- ═══════════════════════
-- audit_logs — IMUTÁVEL
-- ═══════════════════════

-- Master lê todos os logs
CREATE POLICY "audit_read_master"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_master());

-- INSERT: via service_role no Route Handler — sem policy para authenticated

-- Bloqueio explícito de UPDATE e DELETE para qualquer authenticated
-- (complementa o FORCE ROW LEVEL SECURITY do Bloco 5)
CREATE POLICY "audit_block_update"
  ON public.audit_logs FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "audit_block_delete"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (false);


-- =============================================================================
-- BLOCO 7 — SEEDS INICIAIS
-- ON CONFLICT DO NOTHING garante idempotência total.
-- =============================================================================

INSERT INTO public.units (
  name, slug, city, state, plan, active,
  contact_name, contact_email, contact_phone
) VALUES
  (
    'DNA Financeiro Sinop',
    'sinop',
    'Sinop', 'MT',
    'basic', true,
    'Responsável Sinop',
    'sinop@dnafinanceiro.app.br',
    NULL
  ),
  (
    'DNA Financeiro Sorriso',
    'sorriso',
    'Sorriso', 'MT',
    'basic', true,
    'Responsável Sorriso',
    'sorriso@dnafinanceiro.app.br',
    NULL
  ),
  (
    'DNA Financeiro Lucas do Rio Verde',
    'lucas-do-rio-verde',
    'Lucas do Rio Verde', 'MT',
    'basic', true,
    'Responsável Lucas',
    'lucas@dnafinanceiro.app.br',
    NULL
  )
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- BLOCO 8 — VALIDAÇÃO
-- Execute após os blocos 1–7. Não modifica dados.
-- Cada query tem o resultado esperado comentado abaixo dela.
-- =============================================================================

-- 8.1 Tabelas — RLS e FORCE RLS habilitados
SELECT
  tablename,
  rowsecurity        AS rls_enabled,
  forcerowsecurity   AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'units','profiles','unit_invites','campaigns','leads',
    'opportunities','daily_questions','question_answers',
    'expenses','dreams','achievements','audit_logs'
  )
ORDER BY tablename;
-- Esperado: rls_enabled = true para todas as 12 tabelas.
-- rls_forced = true para: leads, expenses, question_answers, daily_questions, audit_logs.

-- 8.2 Enums criados
SELECT
  typname                                                    AS enum_name,
  array_agg(enumlabel ORDER BY enumsortorder)                AS values
FROM pg_type  t
JOIN pg_enum  e ON t.oid = e.enumtypid
WHERE typname IN (
  'user_role','unit_plan','lead_status',
  'input_method','opportunity_type','audit_action','audit_resource'
)
GROUP BY typname
ORDER BY typname;
-- Esperado: 7 linhas, uma por enum.

-- 8.3 Policies — confirmar presença e ausência
SELECT tablename, policyname, cmd AS op, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Confirmar que EXISTEM:
--   leads            → leads_read_unit_admin, leads_read_master, leads_update_unit_admin
--   expenses         → expenses_read_master  (somente master — unit_admin excluído)
--   question_answers → qa_read_master        (somente master)
--   daily_questions  → dq_read_unit_admin, dq_read_public_today (sem USING(true))
--   audit_logs       → audit_read_master, audit_block_update, audit_block_delete
-- Confirmar que NÃO EXISTEM:
--   expenses_read_unit_admin         (removida — unit_admin não vê despesas brutas)
--   daily_questions_read_public      (removida — substituída por dq_read_public_today)
--   question_answers_read_unit_admin (removida — unit_admin não vê respostas brutas)

-- 8.4 View: owner e presença
SELECT viewname, viewowner
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'leads_commercial_summary';
-- Esperado: viewowner = 'postgres'

-- 8.5 Colunas da view — confirmar que não há campos sensíveis
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'leads_commercial_summary'
ORDER BY ordinal_position;

-- 8.6 Campos PROIBIDOS na view — deve retornar 0 linhas
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'leads_commercial_summary'
  AND column_name IN (
    'monthly_income', 'monthly_expenses',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'referrer', 'source_url',
    'consent_diagnosis', 'consent_communications', 'consent_analytics', 'consent_at',
    'deleted_at'
  );
-- Esperado: 0 linhas

-- 8.7 Grants da view — anon NÃO deve ter SELECT
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name   = 'leads_commercial_summary'
ORDER BY grantee;
-- Esperado: somente 'authenticated' com SELECT.
-- 'anon' e 'public' NÃO devem aparecer com SELECT.

-- 8.8 Seeds das unidades
SELECT id, name, slug, city, state, plan, active, created_at
FROM public.units
ORDER BY city;
-- Esperado: 3 linhas — Lucas do Rio Verde, Sinop, Sorriso.

-- 8.9 Índices criados
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
-- Esperado: 33+ índices distribuídos pelas 12 tabelas.

-- 8.10 Triggers criados
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_%'
ORDER BY event_object_table, trigger_name;
-- Esperado:
--   trg_campaigns_updated_at      → campaigns    BEFORE UPDATE
--   trg_dreams_updated_at         → dreams       BEFORE UPDATE
--   trg_expenses_update_lead_...  → expenses     AFTER  INSERT
--   trg_leads_updated_at          → leads        BEFORE UPDATE
--   trg_opportunities_updated_at  → opportunities BEFORE UPDATE
--   trg_profiles_updated_at       → profiles     BEFORE UPDATE
--   trg_units_updated_at          → units        BEFORE UPDATE

-- 8.11 Funções auxiliares — security_definer = true para todas
SELECT proname, prosecdef AS security_definer
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
-- Esperado: 8 linhas, security_definer = true para todas.

-- 8.12 Testes manuais de isolamento — rode com tokens específicos
--
-- COM token de unit_admin de Sinop:
--   SELECT unit_slug, COUNT(*) FROM public.leads_commercial_summary GROUP BY unit_slug;
--   → retorna APENAS 'sinop'
--
-- COM token de unit_viewer de Sinop:
--   SELECT count(*) FROM public.leads;          → 0 linhas (sem policy direta)
--   SELECT count(*) FROM public.expenses;       → 0 linhas
--   SELECT count(*) FROM public.question_answers; → 0 linhas
--   SELECT unit_slug FROM public.leads_commercial_summary LIMIT 1; → 'sinop'
--
-- COM anon key (sem token JWT):
--   SELECT count(*) FROM public.leads_commercial_summary; → 0 linhas
--   SELECT count(*) FROM public.expenses;       → 0 linhas
--   SELECT count(*) FROM public.question_answers; → 0 linhas
--   SELECT count(*) FROM public.daily_questions
--     WHERE active_date != CURRENT_DATE;        → 0 linhas (histórico bloqueado)
--
-- COM token de master:
--   SELECT unit_slug, COUNT(*) FROM public.leads GROUP BY unit_slug;
--   → retorna todas as unidades
--
-- AUDIT_LOGS imutável:
--   UPDATE public.audit_logs SET action = 'create' WHERE false;
--   → ERROR: new row violates row-level security policy
--   DELETE FROM public.audit_logs WHERE false;
--   → ERROR: new row violates row-level security policy

