-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: dreams refinement + conquista
-- Arquivo: database/INCREMENTAL_DREAMS_REFINEMENT.sql
-- Versão:  1.0 · Junho 2026 — Bloco 16A
--
-- IDEMPOTENTE: pode rodar múltiplas vezes sem erro.
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   ADD CONSTRAINT via DO block (verifica existência antes)
--   CREATE INDEX IF NOT EXISTS
--   DROP TRIGGER IF EXISTS antes de CREATE TRIGGER
--
-- O QUE FAZ:
--   PASSO 1 — Adiciona deleted_at e status em dreams
--             (crítico: código existente já usa .is('deleted_at', null))
--   PASSO 2 — Adiciona campos de conquista
--             (achieved_at, achieved_amount, achieved_method,
--              testimonial, allow_public_case)
--   PASSO 3 — Cria 4 constraints CHECK (status, achieved_method,
--             achieved_requires_date, public_case_requires_testimonial)
--   PASSO 4 — Cria 3 índices auxiliares
--   PASSO 5 — Cria trigger updated_at em dreams via public.handle_updated_at()
--   PASSO 6 — Queries de validação (comentadas — copie e rode separadamente)
--
-- NÃO ALTERA:
--   Colunas existentes: dream_type, dream_subtype, target_label, target_amount,
--   saved_amount, monthly_contribution, is_primary, created_at, updated_at
--   Tabelas: leads, expenses, investments, dream_plan_settings, units, profiles
--   RLS existente (INSERT/SELECT/UPDATE já têm policies; writes via service_role)
--
-- COMO RODAR:
--   Dashboard Supabase → SQL Editor → cole PASSOS 1–5 → Run
--   Em seguida, cole PASSO 6 (validação) linha por linha → Run
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Adicionar deleted_at e status
-- =============================================================================

ALTER TABLE public.dreams
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.dreams.deleted_at IS
  'Soft delete. NULL = registro ativo. Nunca excluir fisicamente.';

COMMENT ON COLUMN public.dreams.status IS
  'Ciclo de vida do sonho: '
  'active = em andamento | '
  'achieved = conquistado | '
  'paused = pausado | '
  'abandoned = abandonado.';


-- =============================================================================
-- PASSO 2 — Adicionar campos de conquista
-- =============================================================================

ALTER TABLE public.dreams
  ADD COLUMN IF NOT EXISTS achieved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS achieved_amount   NUMERIC(12,2)  CHECK (achieved_amount  >= 0),
  ADD COLUMN IF NOT EXISTS achieved_method   TEXT,
  ADD COLUMN IF NOT EXISTS testimonial       TEXT,
  ADD COLUMN IF NOT EXISTS allow_public_case BOOLEAN        NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dreams.achieved_at IS
  'Data em que o lead marcou o sonho como conquistado. '
  'Obrigatório quando status = achieved (garantido pela constraint).';

COMMENT ON COLUMN public.dreams.achieved_amount IS
  'Valor real conquistado. Pode diferir de target_amount '
  '(ex: comprou carro mais barato ou mais caro do que planejado).';

COMMENT ON COLUMN public.dreams.achieved_method IS
  'Como o sonho foi realizado. '
  'Valores aceitos: poupanca | investimento | financiamento | cdc | '
  'consorcio | consorcio_com_lance | consorcio_com_data_de_contemplação | outro.';

COMMENT ON COLUMN public.dreams.testimonial IS
  'Relato pessoal do lead sobre como conquistou o sonho. '
  'Obrigatório para allow_public_case = true (garantido pela constraint).';

COMMENT ON COLUMN public.dreams.allow_public_case IS
  'O lead autorizou explicitamente o uso do relato como caso de sucesso público. '
  'Nunca expor publicamente sem este campo = true. '
  'Só pode ser true se testimonial IS NOT NULL (garantido pela constraint).';


-- =============================================================================
-- PASSO 3 — Constraints CHECK (todas idempotentes via DO block)
-- =============================================================================

-- 3.1 Status válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'dreams'
      AND constraint_name = 'ck_dreams_status'
  ) THEN
    ALTER TABLE public.dreams
      ADD CONSTRAINT ck_dreams_status
        CHECK (status IN ('active', 'achieved', 'paused', 'abandoned'));
  END IF;
END;
$$;

-- 3.2 Método de conquista válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'dreams'
      AND constraint_name = 'ck_dreams_achieved_method'
  ) THEN
    ALTER TABLE public.dreams
      ADD CONSTRAINT ck_dreams_achieved_method
        CHECK (
          achieved_method IS NULL
          OR achieved_method IN (
            'poupanca',
            'investimento',
            'financiamento',
            'cdc',
            'consorcio',
            'consorcio_com_lance',
            'consorcio_com_data_de_contemplação',
            'outro'
          )
        );
  END IF;
END;
$$;

-- 3.3 achieved_at obrigatório quando status = 'achieved'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'dreams'
      AND constraint_name = 'ck_dreams_achieved_requires_date'
  ) THEN
    ALTER TABLE public.dreams
      ADD CONSTRAINT ck_dreams_achieved_requires_date
        CHECK (status != 'achieved' OR achieved_at IS NOT NULL);
  END IF;
END;
$$;

-- 3.4 allow_public_case = true exige testimonial preenchido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema   = 'public'
      AND table_name     = 'dreams'
      AND constraint_name = 'ck_dreams_public_case_requires_testimonial'
  ) THEN
    ALTER TABLE public.dreams
      ADD CONSTRAINT ck_dreams_public_case_requires_testimonial
        CHECK (allow_public_case = false OR testimonial IS NOT NULL);
  END IF;
END;
$$;


-- =============================================================================
-- PASSO 4 — Índices auxiliares
-- =============================================================================

-- 4.1 Sonhos ativos do lead — busca principal das páginas de usuário
CREATE INDEX IF NOT EXISTS idx_dreams_active
  ON public.dreams(lead_id, status)
  WHERE deleted_at IS NULL;

-- 4.2 Sonho primário ativo — substitui busca sem filtro de deleted_at
CREATE INDEX IF NOT EXISTS idx_dreams_primary_active
  ON public.dreams(lead_id, is_primary)
  WHERE is_primary = true
    AND deleted_at IS NULL
    AND status = 'active';

-- 4.3 Casos de sucesso públicos — futura tela de inspiração
CREATE INDEX IF NOT EXISTS idx_dreams_achieved_public
  ON public.dreams(unit_id, achieved_at DESC)
  WHERE status = 'achieved'
    AND allow_public_case = true
    AND deleted_at IS NULL;


-- =============================================================================
-- PASSO 5 — Trigger updated_at em dreams
-- (ausente no schema original — handle_updated_at() já existe no projeto)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_dreams_updated_at ON public.dreams;

CREATE TRIGGER trg_dreams_updated_at
  BEFORE UPDATE ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PASSO 6 — Queries de validação
-- Cole e rode cada bloco separadamente após aplicar os passos 1–5.
-- =============================================================================

-- ── 6.1 Colunas novas ── (esperado: 7 linhas)
/*
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'dreams'
  AND  column_name  IN (
         'deleted_at', 'status',
         'achieved_at', 'achieved_amount', 'achieved_method',
         'testimonial', 'allow_public_case'
       )
ORDER BY column_name;
*/

-- ── 6.2 Constraints CHECK novas ── (esperado: 4 linhas com os nomes abaixo)
/*
SELECT constraint_name, constraint_type
FROM   information_schema.table_constraints
WHERE  table_schema = 'public'
  AND  table_name   = 'dreams'
  AND  constraint_name LIKE 'ck_dreams_%'
ORDER BY constraint_name;
-- Esperado:
--   ck_dreams_achieved_method
--   ck_dreams_achieved_requires_date
--   ck_dreams_public_case_requires_testimonial
--   ck_dreams_status
*/

-- ── 6.3 Trigger updated_at ── (esperado: 1 linha)
/*
SELECT trigger_name, event_manipulation, action_timing
FROM   information_schema.triggers
WHERE  event_object_schema = 'public'
  AND  event_object_table  = 'dreams';
-- Esperado: trg_dreams_updated_at · UPDATE · BEFORE
*/

-- ── 6.4 Índices auxiliares novos ── (esperado: 3 linhas)
/*
SELECT indexname, indexdef
FROM   pg_indexes
WHERE  schemaname = 'public'
  AND  tablename  = 'dreams'
  AND  indexname  IN (
         'idx_dreams_active',
         'idx_dreams_primary_active',
         'idx_dreams_achieved_public'
       )
ORDER BY indexname;
*/

-- ── 6.5 Todos os índices da tabela ── (visão geral completa)
/*
SELECT indexname
FROM   pg_indexes
WHERE  schemaname = 'public'
  AND  tablename  = 'dreams'
ORDER BY indexname;
-- Esperado (total): 6+ índices, incluindo os 3 originais + 3 novos
*/

-- ── 6.6 Status padrão nos registros existentes ── (esperado: apenas 'active')
/*
SELECT status, COUNT(*) AS total
FROM   public.dreams
GROUP  BY status
ORDER  BY status;
-- Esperado: status = 'active' para todos os registros existentes
*/

-- ── 6.7 allow_public_case padrão ── (esperado: apenas false)
/*
SELECT allow_public_case, COUNT(*) AS total
FROM   public.dreams
GROUP  BY allow_public_case;
-- Esperado: allow_public_case = false para todos
*/

-- ── 6.8 Smoke test: constraint de método (deve falhar com erro) ──
/*
-- Rode para confirmar que a constraint está ativa:
-- INSERT INTO public.dreams (unit_id, lead_id, dream_type, target_amount, status, achieved_at, achieved_method)
-- VALUES (gen_random_uuid(), gen_random_uuid(), 'carro', 10000, 'achieved', NOW(), 'INVALIDO');
-- Esperado: ERROR — new row violates check constraint "ck_dreams_achieved_method"
*/

-- ── 6.9 Smoke test: constraint de allow_public_case (deve falhar) ──
/*
-- INSERT INTO public.dreams (unit_id, lead_id, dream_type, target_amount, allow_public_case)
-- VALUES (gen_random_uuid(), gen_random_uuid(), 'carro', 10000, true);
-- Esperado: ERROR — new row violates check constraint "ck_dreams_public_case_requires_testimonial"
*/
