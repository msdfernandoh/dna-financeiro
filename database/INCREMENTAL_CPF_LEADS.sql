-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: CPF como fator de autenticação do lead
-- Versão: 1.0 · Junho 2026
-- Idempotente: seguro para rodar múltiplas vezes em produção
--
-- LGPD: CPF é dado pessoal. Armazenado como 11 dígitos (sem formatação).
-- Coluna nullable para não quebrar leads existentes.
--
-- COMPORTAMENTO DE LOGIN:
--   • Lead com CPF cadastrado  → exige telefone + CPF para entrar
--   • Lead sem CPF (antigos)   → aceita apenas telefone (retrocompatível)
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Adicionar coluna cpf à tabela leads
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cpf TEXT;


-- =============================================================================
-- PASSO 2 — Constraint de formato
-- Aceita apenas 11 dígitos numéricos ou NULL (leads antigos sem CPF)
-- =============================================================================

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_cpf_format;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_cpf_format
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');


-- =============================================================================
-- PASSO 3 — Índice para lookup rápido no login
-- Usado na query: WHERE unit_slug = $1 AND phone = $2 AND cpf = $3
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_cpf
  ON public.leads(cpf)
  WHERE cpf IS NOT NULL AND deleted_at IS NULL;


-- =============================================================================
-- PASSO 4 — Comentários de documentação
-- =============================================================================

COMMENT ON COLUMN public.leads.cpf IS
  '⚠️ SENSÍVEL (LGPD) — CPF do lead. Usado como segundo fator de '
  'autenticação ("senha padrão"). Armazenado como 11 dígitos sem '
  'formatação (ex: "12345678901"). NULL para leads cadastrados antes '
  'desta migração — esses leads continuam usando acesso por telefone apenas.';


-- =============================================================================
-- VALIDAÇÕES — Execute depois para confirmar que tudo está correto
-- =============================================================================

-- 1. Confirma que a coluna existe e é nullable
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'leads'
  AND column_name  = 'cpf';
-- Resultado esperado:
--   column_name | data_type | is_nullable | column_default
--   cpf         | text      | YES         | (null)


-- 2. Confirma que a constraint de formato existe
SELECT
  conname,
  pg_get_constraintdef(pg_constraint.oid) AS definicao
FROM pg_constraint
JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
WHERE pg_class.relname = 'leads'
  AND conname = 'leads_cpf_format';
-- Resultado esperado:
--   conname          | definicao
--   leads_cpf_format | CHECK ((cpf IS NULL OR cpf ~ '^[0-9]{11}$'))


-- 3. Confirma que o índice existe
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'leads'
  AND indexname  = 'idx_leads_cpf';
-- Resultado esperado: 1 linha com a definição do índice parcial


-- 4. Teste da constraint — CPF válido deve passar
--    (substitua os campos obrigatórios por valores reais se quiser testar INSERT)
--    Teste apenas a constraint via UPDATE em lead existente:
/*
-- Deve PASSAR (11 dígitos):
UPDATE public.leads SET cpf = '12345678901'
WHERE id = (SELECT id FROM public.leads LIMIT 1);

-- Deve FALHAR (menos de 11 dígitos):
UPDATE public.leads SET cpf = '123'
WHERE id = (SELECT id FROM public.leads LIMIT 1);

-- Deve FALHAR (contém letras):
UPDATE public.leads SET cpf = 'abc45678901'
WHERE id = (SELECT id FROM public.leads LIMIT 1);

-- Deve PASSAR (NULL — lead antigo sem CPF):
UPDATE public.leads SET cpf = NULL
WHERE id = (SELECT id FROM public.leads LIMIT 1);
*/


-- 5. Confirma total de leads com e sem CPF
SELECT
  COUNT(*)                               AS total_leads,
  COUNT(cpf)                             AS com_cpf,
  COUNT(*) - COUNT(cpf)                  AS sem_cpf
FROM public.leads
WHERE deleted_at IS NULL;
-- Resultado esperado no primeiro run: com_cpf = 0, sem_cpf = total_leads
