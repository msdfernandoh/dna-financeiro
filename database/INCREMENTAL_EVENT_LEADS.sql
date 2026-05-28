-- ============================================================
-- INCREMENTAL_EVENT_LEADS.sql
--
-- Tabela para leads captados em eventos de construtoras.
-- Idempotente — seguro rodar múltiplas vezes.
-- NÃO altera a tabela leads normal.
-- Reutiliza public.handle_updated_at() já existente.
-- ============================================================

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS public.event_leads (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id                     uuid        REFERENCES public.units(id),
  event_key                   text,
  event_name                  text,
  source_page                 text,
  name                        text        NOT NULL,
  whatsapp                    text        NOT NULL,
  city                        text,
  empreendimento              text,
  torre                       text,
  apartamento                 text,
  valor_imovel                numeric,
  valor_entrega               numeric,
  valor_entrada_disponivel    numeric,
  renda_aproximada            numeric,
  precisa_financiamento       boolean,
  interesse_consorcio         boolean,
  interesse_carta_contemplada boolean,
  interesse_credito           boolean,
  interesse_plano_pontual     boolean,
  melhor_horario_contato      text,
  observacoes                 text,
  consent_share_builder       boolean     NOT NULL DEFAULT false,
  consent_contact             boolean     NOT NULL DEFAULT false,
  ip_address                  text,
  user_agent                  text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_event_leads_unit_id
  ON public.event_leads(unit_id);

CREATE INDEX IF NOT EXISTS idx_event_leads_event_key
  ON public.event_leads(event_key);

CREATE INDEX IF NOT EXISTS idx_event_leads_created_at
  ON public.event_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_leads_deleted_at
  ON public.event_leads(deleted_at)
  WHERE deleted_at IS NULL;

-- 3. Trigger de updated_at — reutiliza handle_updated_at() já existente no banco
--    (definida em supabase-init.sql e reutilizada em INCREMENTAL_INVESTMENTS.sql, etc.)
DROP TRIGGER IF EXISTS trg_event_leads_updated_at ON public.event_leads;
CREATE TRIGGER trg_event_leads_updated_at
  BEFORE UPDATE ON public.event_leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. RLS — apenas service_role acessa (API Routes server-side usam service_role)
ALTER TABLE public.event_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'event_leads'
      AND policyname = 'event_leads_service_only'
  ) THEN
    CREATE POLICY event_leads_service_only
      ON public.event_leads
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
