-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: event_leads
-- Versão: 1.0 · Junho 2026
-- Idempotente: seguro para rodar múltiplas vezes em produção
--
-- Tabela SEPARADA de public.leads (não mistura com leads normais do DNA).
-- Acesso exclusivo via service_role (server-side, bypassa RLS).
-- LGPD: exportação para construtora filtra APENAS consent_share_builder = true.
--
-- Trigger: reutiliza public.handle_updated_at() já existente no projeto.
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Tabela principal
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.event_leads (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id                     UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,

  -- Identificador do evento — permite reutilizar a tabela para eventos futuros
  event_key                   TEXT        NOT NULL DEFAULT 'gauchinho_construtora',

  -- Dados pessoais do lead
  name                        TEXT        NOT NULL,
  whatsapp                    TEXT        NOT NULL,
  cpf                         TEXT,                         -- ⚠️ LGPD, opcional

  -- Dados do imóvel
  empreendimento              TEXT,
  torre                       TEXT,
  apartamento                 TEXT,
  valor_imovel                NUMERIC(14,2),
  valor_entrega               NUMERIC(14,2),
  valor_entrada_disponivel    NUMERIC(14,2),
  renda_aproximada            NUMERIC(14,2),

  -- Interesses declarados
  precisa_financiamento       BOOLEAN     NOT NULL DEFAULT false,
  interesse_consorcio         BOOLEAN     NOT NULL DEFAULT false,
  interesse_carta_contemplada BOOLEAN     NOT NULL DEFAULT false,
  interesse_credito           BOOLEAN     NOT NULL DEFAULT false,
  interesse_plano_pontual     BOOLEAN     NOT NULL DEFAULT false,

  -- Preferência de contato
  melhor_horario_contato      TEXT,
  observacoes                 TEXT,

  -- ⚠️ LGPD — consentimentos
  consent_share_builder       BOOLEAN     NOT NULL DEFAULT false,  -- autoriza envio à construtora
  consent_contact             BOOLEAN     NOT NULL DEFAULT false,  -- autoriza contato pelo Gauchinho

  -- Rastreio técnico (preenchido pelo servidor, nunca pelo browser)
  source_page                 TEXT,
  ip_address                  INET,
  user_agent                  TEXT,

  -- Timestamps
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                  TIMESTAMPTZ
);


-- =============================================================================
-- PASSO 2 — Constraints de formato
-- =============================================================================

-- WhatsApp: 10 ou 11 dígitos (DDD + número)
ALTER TABLE public.event_leads
  DROP CONSTRAINT IF EXISTS event_leads_whatsapp_format;

ALTER TABLE public.event_leads
  ADD CONSTRAINT event_leads_whatsapp_format
  CHECK (whatsapp ~ '^[0-9]{10,11}$');

-- CPF: 11 dígitos ou NULL
ALTER TABLE public.event_leads
  DROP CONSTRAINT IF EXISTS event_leads_cpf_format;

ALTER TABLE public.event_leads
  ADD CONSTRAINT event_leads_cpf_format
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');


-- =============================================================================
-- PASSO 3 — Índices para performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_event_leads_unit_id
  ON public.event_leads(unit_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_leads_event_key
  ON public.event_leads(event_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_leads_whatsapp
  ON public.event_leads(whatsapp)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_leads_created_at
  ON public.event_leads(created_at DESC)
  WHERE deleted_at IS NULL;

-- Índice parcial para exportação Excel (filtro mais comum)
CREATE INDEX IF NOT EXISTS idx_event_leads_consent_share
  ON public.event_leads(unit_id, event_key, created_at DESC)
  WHERE deleted_at IS NULL AND consent_share_builder = true;


-- =============================================================================
-- PASSO 4 — Trigger updated_at
-- Reutiliza public.handle_updated_at() já existente no projeto.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_event_leads_updated_at ON public.event_leads;

CREATE TRIGGER trg_event_leads_updated_at
  BEFORE UPDATE ON public.event_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PASSO 5 — Row Level Security
-- Nenhuma policy pública — dados acessíveis apenas via service_role (servidor).
-- =============================================================================

ALTER TABLE public.event_leads ENABLE ROW LEVEL SECURITY;

-- Sem policies intencionalmente: service_role bypassa RLS.
-- Nenhum acesso pelo browser (anon key) é possível.


-- =============================================================================
-- PASSO 6 — Documentação
-- =============================================================================

COMMENT ON TABLE public.event_leads IS
  'Leads capturados em eventos de parceiros (ex: Gauchinho x Construtora). '
  'SEPARADO da tabela leads do DNA Financeiro — nunca misturar. '
  'Acesso apenas via service_role (server-side). '
  'LGPD: consent_share_builder = true é pré-requisito para exportação à construtora.';

COMMENT ON COLUMN public.event_leads.event_key IS
  'Identificador do evento. Ex: gauchinho_construtora. '
  'Permite usar a mesma tabela para eventos futuros sem alteração de schema.';

COMMENT ON COLUMN public.event_leads.consent_share_builder IS
  '⚠️ LGPD — TRUE = lead autorizou compartilhamento com a construtora parceira. '
  'Exportação Excel filtra APENAS consent_share_builder = true.';

COMMENT ON COLUMN public.event_leads.cpf IS
  '⚠️ SENSÍVEL (LGPD) — CPF opcional. Armazenado como 11 dígitos sem formatação.';

COMMENT ON COLUMN public.event_leads.whatsapp IS
  'WhatsApp sem formatação: DDD (2 dígitos) + número (8 ou 9 dígitos). Total: 10 ou 11.';


-- =============================================================================
-- VALIDAÇÕES — Execute após rodar para confirmar que tudo está correto
-- =============================================================================

-- 1. Confirma colunas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'event_leads'
ORDER BY ordinal_position;

-- 2. Confirma índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'event_leads';

-- 3. Confirma RLS ativo
SELECT relname, relrowsecurity
FROM pg_class WHERE relname = 'event_leads';
-- Resultado esperado: relrowsecurity = true

-- 4. Confirma trigger
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'event_leads';
-- Resultado esperado: 1 linha com trg_event_leads_updated_at

-- 5. Confirma que tabela está vazia no primeiro run
SELECT COUNT(*) FROM public.event_leads;  -- esperado: 0

-- 6. Confirma que leads normais não foram alterados
SELECT COUNT(*) FROM public.leads;  -- deve retornar o mesmo valor de antes
