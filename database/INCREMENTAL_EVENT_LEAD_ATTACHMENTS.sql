-- ============================================================
-- INCREMENTAL_EVENT_LEAD_ATTACHMENTS.sql
-- Cria a tabela event_lead_attachments para armazenar
-- metadados de arquivos enviados via Supabase Storage.
-- Idempotente — seguro rodar múltiplas vezes.
--
-- IMPORTANTE: criar o bucket manualmente no painel Supabase:
--   Nome:    event-attachments
--   Público: NÃO (privado)
--   Limite:  20 MB por arquivo
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_lead_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid        NOT NULL REFERENCES public.event_leads(id) ON DELETE CASCADE,
  filename     text        NOT NULL,
  storage_path text        NOT NULL,
  size_bytes   bigint,
  content_type text,
  uploaded_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice para listagem por lead
CREATE INDEX IF NOT EXISTS idx_event_lead_attachments_lead_id
  ON public.event_lead_attachments (lead_id);

-- RLS: acesso apenas via service_role
ALTER TABLE public.event_lead_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'event_lead_attachments'
      AND policyname = 'service_role_only'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY service_role_only ON public.event_lead_attachments
        USING (auth.role() = 'service_role')
    $policy$;
  END IF;
END$$;
