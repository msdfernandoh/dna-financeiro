-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: dream_path_settings por unidade
-- Arquivo: database/INCREMENTAL_DREAM_PATH_SETTINGS_UNIT.sql
-- Versão:  1.0 · Maio 2026
-- Bloco:   SONHO — Caminhos do Sonho com override por unidade
--
-- ⚠️  Rodar no Supabase SQL Editor após revisão.
--
-- REGRAS DE NEGÓCIO:
--   unit_id NULL     → configuração global (vale para todas as unidades)
--   unit_id preenchido → override exclusivo da unidade
--   Resolução no app: unidade vence global; dream_subtype específico vence genérico
--
-- DECISÕES APROVADAS:
--   • Sentinel UUID no índice único (NULL tratado como global)
--   • ON DELETE SET NULL na FK (unidade removida → row vira global implícito)
--   • Registros existentes NÃO são alterados — permanecem com unit_id NULL
--   • RLS inalterado neste bloco
--   • dream_plan_settings por unidade: fora de escopo
--
-- IDEMPOTENTE:
--   ADD COLUMN IF NOT EXISTS
--   CREATE INDEX IF NOT EXISTS (após DROP do índice antigo)
--
-- COMO RODAR:
--   Passo 1: Colar e executar PASSO 1–4 (schema + índices)
--   Passo 2: Executar queries de validação (PASSO 5)
--
-- NÃO FAZ:
--   • UPDATE em rows existentes
--   • INSERT de seeds
--   • ALTER em dream_plan_settings
--   • Mudanças em políticas RLS
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Coluna unit_id
-- =============================================================================

ALTER TABLE public.dream_path_settings
  ADD COLUMN IF NOT EXISTS unit_id UUID
  REFERENCES public.units(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dream_path_settings.unit_id IS
  'Escopo do caminho. NULL = global (todas as unidades). '
  'UUID = configuração específica da unidade; sobrescreve o global para o mesmo '
  '(dream_type, dream_subtype, path_type) quando o lead pertence à unidade. '
  'ON DELETE SET NULL: se a unidade for removida, o registro permanece como global.';

COMMENT ON TABLE public.dream_path_settings IS
  'Configuração de caminhos financeiros (path_type) por tipo de sonho. '
  'unit_id NULL = global; unit_id preenchido = override por unidade. '
  'Retrocompatível com dream_plan_settings (global, bloco separado). '
  'Somente master edita. O Next.js usa service_role no servidor.';


-- =============================================================================
-- PASSO 2 — Índice único (substitui uidx_dream_path_type_subtype_path)
--
-- Antes: (dream_type, COALESCE(dream_subtype,''), path_type)
-- Agora: (COALESCE(unit_id, sentinel), dream_type, COALESCE(dream_subtype,''), path_type)
--
-- Permite, por exemplo:
--   • global  carro / NULL / consortium_traditional
--   • Sinop   carro / NULL / consortium_traditional
-- Sinop usa o dela; demais unidades usam o global.
-- =============================================================================

DROP INDEX IF EXISTS public.uidx_dream_path_type_subtype_path;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_dream_path_unit_type_subtype_path
  ON public.dream_path_settings (
    COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    dream_type,
    COALESCE(dream_subtype, ''),
    path_type
  )
  WHERE deleted_at IS NULL;


-- =============================================================================
-- PASSO 3 — Índice de lookup: unidade + dream_type + active
-- Usado pelo admin (filtro por unidade) e pelo app (/sonho por lead.unit_id)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_dream_path_unit_lookup
  ON public.dream_path_settings (unit_id, dream_type, active)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- PASSO 4 — Índice parcial: caminhos globais ativos por dream_type
-- Acelera fallback quando a unidade não tem override
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_dream_path_global_by_type
  ON public.dream_path_settings (dream_type, path_type, sort_order)
  WHERE deleted_at IS NULL AND active = TRUE AND unit_id IS NULL;


-- =============================================================================
-- PASSO 5 — Validação (copiar e rodar após PASSO 1–4)
-- =============================================================================

-- 5.1 Coluna unit_id existe e aceita NULL
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'dream_path_settings'
--   AND column_name = 'unit_id';
-- Esperado: 1 linha · uuid · YES

-- 5.2 Todos os registros atuais permanecem globais (nenhum UPDATE foi feito)
-- SELECT
--   COUNT(*) FILTER (WHERE unit_id IS NULL)     AS globais,
--   COUNT(*) FILTER (WHERE unit_id IS NOT NULL) AS por_unidade,
--   COUNT(*)                                    AS total
-- FROM public.dream_path_settings
-- WHERE deleted_at IS NULL;
-- Esperado após migração: por_unidade = 0, globais = total (mesmo total de antes)

-- 5.3 Índice antigo removido; novo índice presente
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'dream_path_settings'
--   AND indexname IN (
--     'uidx_dream_path_type_subtype_path',
--     'uidx_dream_path_unit_type_subtype_path',
--     'idx_dream_path_unit_lookup',
--     'idx_dream_path_global_by_type'
--   )
-- ORDER BY indexname;
-- Esperado:
--   uidx_dream_path_type_subtype_path        → 0 linhas
--   uidx_dream_path_unit_type_subtype_path   → 1 linha
--   idx_dream_path_unit_lookup               → 1 linha
--   idx_dream_path_global_by_type            → 1 linha

-- 5.4 Nenhuma duplicata na nova chave de negócio
-- SELECT
--   COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid) AS unit_key,
--   dream_type,
--   COALESCE(dream_subtype, '') AS subtype_key,
--   path_type,
--   COUNT(*) AS qtd
-- FROM public.dream_path_settings
-- WHERE deleted_at IS NULL
-- GROUP BY 1, 2, 3, 4
-- HAVING COUNT(*) > 1;
-- Esperado: 0 linhas

-- 5.5 FK para units válida (amostra)
-- SELECT
--   tc.constraint_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_schema = 'public'
--   AND tc.table_name = 'dream_path_settings'
--   AND tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'unit_id';
-- Esperado: 1 FK → public.units(id)

-- 5.6 Smoke test — simular lookup do app (substituir UUID da unidade Sinop)
-- SELECT path_type, label, unit_id IS NULL AS is_global, sort_order
-- FROM public.dream_path_settings
-- WHERE dream_type = 'carro'
--   AND active = TRUE
--   AND deleted_at IS NULL
--   AND (unit_id IS NULL OR unit_id = '00000000-0000-0000-0000-000000000000'::uuid)
-- ORDER BY sort_order;
-- Esperado: mesma lista de caminhos globais de carro que antes da migração

-- 5.7 Teste futuro de override (NÃO rodar em produção até criar override no admin)
-- Após inserir 1 row com unit_id = Sinop para carro/consortium_traditional:
--   • query 5.6 com OR unit_id = <sinop_id> deve retornar global + sinop para esse path_type
--   • merge no app ficará responsável por escolher Sinop > global
