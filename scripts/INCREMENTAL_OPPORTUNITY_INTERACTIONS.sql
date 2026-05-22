-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: Interações de leads com oportunidades
-- Arquivo: scripts/INCREMENTAL_OPPORTUNITY_INTERACTIONS.sql
--
-- Descrição:
--   Cria a tabela public.opportunity_interactions para registrar cada
--   interação de um lead com uma oportunidade (interesse, clique, salvar).
--
-- Segurança:
--   • unit_id e lead_id são sempre resolvidos server-side — nunca do client.
--   • Escrita feita exclusivamente via service_role (bypassa RLS).
--   • Leitura disponível para unit_admin/master via RLS (tabela de admin).
--   • Anon e authenticated sem role não têm acesso.
--
-- Idempotência:
--   Script pode ser executado múltiplas vezes sem efeitos colaterais.
--   Usa CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--   CREATE INDEX IF NOT EXISTS e DROP POLICY IF EXISTS + CREATE POLICY.
--
-- ATENÇÃO: Aplicar manualmente no Supabase SQL Editor.
-- =============================================================================

-- ── Tabela ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.opportunity_interactions (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id           UUID        NOT NULL REFERENCES public.units(id),
  lead_id           UUID        NOT NULL REFERENCES public.leads(id),
  opportunity_id    UUID        NULL     REFERENCES public.opportunities(id),
  opportunity_type  TEXT        NULL,
  opportunity_title TEXT        NOT NULL,
  interaction_type  TEXT        NOT NULL,
  source            TEXT        NOT NULL,
  target_dream      TEXT        NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT oi_interaction_type_check
    CHECK (interaction_type IN ('view', 'click', 'interest', 'save', 'unsave')),
  CONSTRAINT oi_source_check
    CHECK (source IN ('painel', 'oportunidades', 'fallback'))
);

COMMENT ON TABLE public.opportunity_interactions IS
  'Registra interações de leads com oportunidades (interesse, clique, salvar).
   unit_id e lead_id são sempre resolvidos server-side — nunca aceitos do client.
   opportunity_id pode ser NULL quando a oportunidade é fallback (não está no banco).';

COMMENT ON COLUMN public.opportunity_interactions.opportunity_id IS
  'UUID da oportunidade no banco. NULL = oportunidade de fallback (gerada dinamicamente).';

COMMENT ON COLUMN public.opportunity_interactions.opportunity_title IS
  'Título exibido ao lead no momento da interação (incluindo fallback).';

COMMENT ON COLUMN public.opportunity_interactions.interaction_type IS
  'view=visualizou | click=clicou CTA externo | interest=Tenho interesse |
   save=salvou | unsave=removeu dos salvos';

COMMENT ON COLUMN public.opportunity_interactions.source IS
  'painel=card de destaque no painel | oportunidades=lista pública |
   fallback=oportunidade de fallback (sem opportunity_id)';

COMMENT ON COLUMN public.opportunity_interactions.metadata IS
  'Dados extras opcionais (ex: {"fallback": true, "tab": "todos"}). Limitado a 1 KB.';

-- ── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_oi_lead_id
  ON public.opportunity_interactions (lead_id);

CREATE INDEX IF NOT EXISTS idx_oi_unit_id
  ON public.opportunity_interactions (unit_id);

CREATE INDEX IF NOT EXISTS idx_oi_opportunity_id
  ON public.opportunity_interactions (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_oi_interaction_type
  ON public.opportunity_interactions (interaction_type);

CREATE INDEX IF NOT EXISTS idx_oi_created_at
  ON public.opportunity_interactions (created_at DESC);

-- Índice composto para agrupar interesse por lead+opp (evitar N+1 no admin)
CREATE INDEX IF NOT EXISTS idx_oi_lead_opp_type
  ON public.opportunity_interactions (lead_id, opportunity_id, interaction_type)
  WHERE opportunity_id IS NOT NULL;

-- Índice para contadores por unidade (dashboard admin)
CREATE INDEX IF NOT EXISTS idx_oi_unit_type
  ON public.opportunity_interactions (unit_id, interaction_type, opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.opportunity_interactions ENABLE ROW LEVEL SECURITY;

-- Leitura: unit_admin vê interações da própria unidade
DROP POLICY IF EXISTS "oi_read_unit_admin" ON public.opportunity_interactions;
CREATE POLICY "oi_read_unit_admin"
  ON public.opportunity_interactions FOR SELECT
  TO authenticated
  USING (
    public.is_unit_member_or_above()
    AND public.can_access_unit(unit_id)
  );

-- Leitura: master vê tudo
DROP POLICY IF EXISTS "oi_read_master" ON public.opportunity_interactions;
CREATE POLICY "oi_read_master"
  ON public.opportunity_interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'master'
        AND p.active = true
        AND p.deleted_at IS NULL
    )
  );

-- Escrita: somente service_role (server-side) — anon e authenticated não escrevem
-- service_role bypassa RLS por padrão no Supabase.
-- Política explícita de negação para authenticated (extra segurança):
DROP POLICY IF EXISTS "oi_insert_deny_authenticated" ON public.opportunity_interactions;
CREATE POLICY "oi_insert_deny_authenticated"
  ON public.opportunity_interactions FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ── Verificação pós-migração ─────────────────────────────────────────────────
-- Após executar, verifique com:
--
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'opportunity_interactions'
-- ORDER BY ordinal_position;
--
-- E as políticas:
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE tablename = 'opportunity_interactions';
