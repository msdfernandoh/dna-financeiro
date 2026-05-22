-- ============================================================================
-- DNA FINANCEIRO — MIGRAÇÃO INCREMENTAL
-- Tabela:  public.dna_answers
-- Data:    2026-05-22
-- Motivo:  Salvar respostas individuais do fluxo DNA Financeiro por lead.
--
-- ⚠️ SEGURANÇA:
--   • unit_id e lead_id NUNCA vêm do frontend — resolvidos pelo servidor
--   • Inserção exclusiva via service_role (server action Next.js)
--   • RLS + FORCE ROW LEVEL SECURITY ativados
--   • unit_admin NÃO acessa respostas brutas (segue padrão question_answers)
--   • Master pode auditar com responsabilidade
--   • Leitura do lead via service_role server-side (cookie dna_lead_token)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela principal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dna_answers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculos resolvidos exclusivamente no servidor
  unit_id       UUID        NOT NULL REFERENCES public.units(id)  ON DELETE RESTRICT,
  lead_id       UUID        NOT NULL REFERENCES public.leads(id)  ON DELETE CASCADE,

  -- Localização da pergunta no fluxo DNA (6 etapas fixas)
  step_key      TEXT        NOT NULL
                  CHECK (step_key IN (
                    'realidade', 'trabalho', 'dividas',
                    'renda_extra', 'formacao', 'sonhos'
                  )),

  -- Código único da pergunta (snake_case, definido no código)
  question_key  TEXT        NOT NULL,

  -- Texto exibido ao lead — preservado para auditoria futura
  question_text TEXT        NOT NULL,

  -- Resposta serializada em TEXT
  --   select      → valor único:          'clt'
  --   multiselect → separado por vírgula: 'pix,credito,boleto'
  --   number      → string numérica:      '3500'
  --   boolean     → 'sim' | 'nao'
  --   text        → texto livre digitado
  answer        TEXT        NOT NULL,
  answer_type   TEXT        NOT NULL DEFAULT 'select'
                  CHECK (answer_type IN (
                    'select', 'multiselect', 'number', 'text', 'boolean'
                  )),

  answered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Garante idempotência: upsert sem duplicatas por lead + pergunta
  CONSTRAINT dna_answers_lead_question_unique UNIQUE (lead_id, question_key)
);

COMMENT ON TABLE public.dna_answers IS
  '⚠️ SENSÍVEL — respostas do fluxo DNA Financeiro por lead. '
  'MVP: somente master lê via RLS. unit_admin não acessa registros brutos. '
  'unit_id e lead_id resolvidos exclusivamente pelo servidor (service_role). '
  'Multiselect: valores separados por vírgula no campo answer.';

-- ---------------------------------------------------------------------------
-- 2. Comentários de coluna
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.dna_answers.step_key      IS 'Etapa do DNA: realidade | trabalho | dividas | renda_extra | formacao | sonhos';
COMMENT ON COLUMN public.dna_answers.question_key  IS 'Código único da pergunta (snake_case). Ex: tem_renda_fixa, fontes_renda, valor_divida.';
COMMENT ON COLUMN public.dna_answers.question_text IS 'Texto exibido ao lead no momento da resposta. Preservado para auditoria futura.';
COMMENT ON COLUMN public.dna_answers.answer        IS 'Resposta serializada. Multiselect: vírgula. Número: string numérica. Boolean: sim/nao.';
COMMENT ON COLUMN public.dna_answers.answer_type   IS 'Tipo: select | multiselect | number | text | boolean';

-- ---------------------------------------------------------------------------
-- 3. Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_da_unit_id       ON public.dna_answers(unit_id);
CREATE INDEX IF NOT EXISTS idx_da_lead_id       ON public.dna_answers(lead_id);
CREATE INDEX IF NOT EXISTS idx_da_step_key      ON public.dna_answers(step_key);
CREATE INDEX IF NOT EXISTS idx_da_question_key  ON public.dna_answers(question_key);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.dna_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_answers FORCE ROW LEVEL SECURITY;

-- Master: leitura total para auditoria
CREATE POLICY da_read_master
  ON public.dna_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'master'
    )
  );

-- Nenhuma policy para unit_admin  → não vê respostas brutas (intencionalmente)
-- Nenhuma policy para anônimo     → sem acesso direto
-- service_role bypassa RLS        → servidor pode INSERT/SELECT/UPSERT livremente

-- ---------------------------------------------------------------------------
-- 5. Verificação pós-criação
-- ---------------------------------------------------------------------------
-- SELECT relname, relrowsecurity, relforcerowsecurity
-- FROM pg_class WHERE relname = 'dna_answers';
-- → relrowsecurity = true, relforcerowsecurity = true
--
-- SELECT count(*) FROM public.dna_answers;
-- → 0 linhas (tabela vazia após criação)
