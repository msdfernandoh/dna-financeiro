-- =============================================================================
-- DNA FINANCEIRO — INCREMENTAL: tabela investments (Estou me pagando)
-- Versão: 1.0 · Junho 2026
-- Idempotente: pode rodar múltiplas vezes sem erro
--
-- REGRAS DE NEGÓCIO:
--   • investments NUNCA somam com expenses (são dois universos separados)
--   • Painel  → "Você se pagou R$ X este mês"
--   • Relatório → aparece como ponto positivo / construção de patrimônio
--   • unit_id e lead_id SEMPRE resolvidos no servidor (service_role)
--   • Frontend/browser nunca envia unit_id ou lead_id como dado confiável
--   • authenticated NÃO insere diretamente — apenas via Server Action (service_role)
--   • unit_admin vê resumo agregado por unidade
--   • unit_viewer: sem acesso (segue padrão de expenses)
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Criar a tabela
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.investments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo obrigatório — sempre resolvido pelo servidor, nunca do browser
  unit_id          UUID          NOT NULL REFERENCES public.units(id)  ON DELETE RESTRICT,
  lead_id          UUID          NOT NULL REFERENCES public.leads(id)  ON DELETE CASCADE,

  -- Classificação do investimento
  investment_type  TEXT          NOT NULL,

  -- Valor aportado (sempre positivo)
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),

  -- Descrição livre (opcional)
  description      TEXT,

  -- Data do aporte
  investment_date  DATE          NOT NULL DEFAULT CURRENT_DATE,

  -- Análise de patrimônio (opcionais)
  expected_return  NUMERIC(6,2),      -- % anual esperado (ex: 12.50 = 12,5% a.a.)
  current_value    NUMERIC(12,2),     -- valor atual do ativo (renda variável)

  -- Recorrência: TRUE para aportes mensais fixos (previdência, consórcio etc.)
  is_recurring     BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Metadados de auditoria
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,  -- soft delete — nunca DELETE físico

  -- ── Constraints ────────────────────────────────────────────────────────────

  -- Tipo deve ser um valor válido da lista aprovada
  CONSTRAINT investments_type_check CHECK (
    investment_type IN (
      'poupanca',
      'reserva_emergencia',
      'renda_fixa',
      'acoes',
      'fundos_imobiliarios',
      'cripto',
      'imovel',
      'consorcio',
      'veiculo',
      'previdencia',
      'negocio',
      'curso',
      'equipamento',
      'outro'
    )
  ),

  -- Percentual de retorno esperado dentro de intervalo razoável
  CONSTRAINT investments_expected_return_range CHECK (
    expected_return IS NULL
    OR expected_return BETWEEN -100.00 AND 1000.00
  ),

  -- Valor atual nunca negativo
  CONSTRAINT investments_current_value_positive CHECK (
    current_value IS NULL OR current_value >= 0
  )
);

-- Comentários da tabela e colunas
COMMENT ON TABLE public.investments IS
  '"Estou me pagando" — aportes e construção de patrimônio do lead. '
  'NUNCA soma com expenses. unit_admin vê resumo agregado. '
  'INSERT exclusivo via service_role (Server Action Next.js).';

COMMENT ON COLUMN public.investments.unit_id IS
  'Injetado pelo servidor — nunca vem do browser.';

COMMENT ON COLUMN public.investments.lead_id IS
  'Resolvido do cookie dna_lead_token no servidor — nunca vem do browser.';

COMMENT ON COLUMN public.investments.investment_type IS
  'Tipo do investimento. Valores válidos definidos na constraint investments_type_check.';

COMMENT ON COLUMN public.investments.expected_return IS
  '% anual esperado. Ex: 12.50 = 12,5% a.a. Opcional — informado pelo lead.';

COMMENT ON COLUMN public.investments.current_value IS
  'Valor atual do ativo (renda variável). Opcional — atualizado manualmente pelo lead.';

COMMENT ON COLUMN public.investments.is_recurring IS
  'TRUE se é aporte mensal recorrente (previdência, consórcio, poupança automática).';

COMMENT ON COLUMN public.investments.deleted_at IS
  'Soft delete — nunca usar DELETE físico. Filtrar sempre com deleted_at IS NULL.';


-- =============================================================================
-- PASSO 2 — Índices
-- =============================================================================

-- Busca por lead (uso mais frequente: painel e relatório do lead)
CREATE INDEX IF NOT EXISTS idx_investments_lead_id
  ON public.investments(lead_id)
  WHERE deleted_at IS NULL;

-- Busca por unidade (admin da unidade visualiza resumo)
CREATE INDEX IF NOT EXISTS idx_investments_unit_id
  ON public.investments(unit_id)
  WHERE deleted_at IS NULL;

-- Filtro por data (relatório mensal, gráficos de evolução)
CREATE INDEX IF NOT EXISTS idx_investments_date
  ON public.investments(investment_date DESC)
  WHERE deleted_at IS NULL;

-- Filtro por tipo (agrupamento no relatório: poupança, ações etc.)
CREATE INDEX IF NOT EXISTS idx_investments_type
  ON public.investments(investment_type)
  WHERE deleted_at IS NULL;

-- Índice composto: lead + data — query mais comum no painel
-- "aportes deste mês para este lead"
CREATE INDEX IF NOT EXISTS idx_investments_lead_date
  ON public.investments(lead_id, investment_date DESC)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- PASSO 3 — Ativar RLS e FORCE RLS
--
-- FORCE ROW LEVEL SECURITY: garante que mesmo o owner da tabela (postgres)
-- respeita as policies quando conectado como role authenticated.
-- service_role continua bypassando RLS (comportamento padrão Supabase).
-- =============================================================================

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- PASSO 4 — Policies RLS
--
-- Segue o padrão de expenses:
--   SELECT master     → lê tudo
--   SELECT unit_admin → lê da própria unidade
--   unit_viewer       → sem policy (não acessa)
--   INSERT            → sem policy (somente service_role via Server Action)
--   UPDATE/DELETE     → sem policy (somente service_role via Server Action)
-- =============================================================================

-- Remove policies existentes para garantir idempotência
DROP POLICY IF EXISTS "investments_read_master"     ON public.investments;
DROP POLICY IF EXISTS "investments_read_unit_admin" ON public.investments;

-- Master lê todos os investimentos de todas as unidades
CREATE POLICY "investments_read_master"
  ON public.investments FOR SELECT
  TO authenticated
  USING (public.is_master() AND deleted_at IS NULL);

-- unit_admin lê investimentos da própria unidade
-- unit_viewer NÃO tem policy — sem acesso (igual a expenses)
CREATE POLICY "investments_read_unit_admin"
  ON public.investments FOR SELECT
  TO authenticated
  USING (
    public.is_unit_admin_or_above()
    AND public.can_access_unit(unit_id)
    AND deleted_at IS NULL
  );

-- INSERT/UPDATE/DELETE: sem policy RLS
-- → Bloqueado para todo authenticated pelo FORCE RLS
-- → Permitido apenas para service_role (usado pelo Next.js server-side)


-- =============================================================================
-- PASSO 5 — Trigger: updated_at automático
-- Reutiliza handle_updated_at() já existente no banco (definida em supabase-final.sql)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_investments_updated_at ON public.investments;

CREATE TRIGGER trg_investments_updated_at
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- PASSO 6 — Trigger: atualiza last_seen_at do lead ao inserir investimento
-- Segue o mesmo padrão de trg_expenses_update_lead_activity
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_lead_activity_on_investment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.leads
  SET last_seen_at = NOW(),
      updated_at   = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_lead_activity_on_investment() IS
  'Atualiza last_seen_at e updated_at do lead quando um investimento é '
  'inserido. SECURITY DEFINER: executa como owner (postgres) para '
  'poder fazer UPDATE em leads mesmo com RLS ativo.';

DROP TRIGGER IF EXISTS trg_investments_update_lead_activity ON public.investments;

CREATE TRIGGER trg_investments_update_lead_activity
  AFTER INSERT ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.handle_lead_activity_on_investment();


-- =============================================================================
-- VALIDAÇÕES — Execute depois do script para confirmar que tudo está correto
-- =============================================================================

-- 1. Confirma colunas da tabela
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'investments'
ORDER BY ordinal_position;
-- Resultado esperado: 16 colunas (id, unit_id, lead_id, investment_type,
-- amount, description, investment_date, expected_return, current_value,
-- is_recurring, created_at, updated_at, deleted_at)


-- 2. Confirma RLS ativo e FORCE RLS
SELECT
  relname,
  relrowsecurity     AS rls_ativo,
  relforcerowsecurity AS force_rls
FROM pg_class
WHERE relname = 'investments';
-- Resultado esperado: rls_ativo = true, force_rls = true


-- 3. Confirma policies criadas
SELECT
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'investments'
ORDER BY policyname;
-- Resultado esperado: 2 policies (investments_read_master, investments_read_unit_admin)


-- 4. Confirma índices
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'investments'
ORDER BY indexname;
-- Resultado esperado: 6 entradas (primary key + 5 índices criados acima)


-- 5. Confirma triggers
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table  = 'investments'
ORDER BY trigger_name;
-- Resultado esperado:
--   trg_investments_update_lead_activity | INSERT | AFTER
--   trg_investments_updated_at           | UPDATE | BEFORE


-- 6. Confirma constraints
SELECT
  conname,
  pg_get_constraintdef(pg_constraint.oid) AS definicao
FROM pg_constraint
JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
WHERE pg_class.relname = 'investments'
  AND contype = 'c'
ORDER BY conname;
-- Resultado esperado: 3 constraints CHECK
--   investments_current_value_positive
--   investments_expected_return_range
--   investments_type_check


-- 7. Teste de inserção via service_role (SQL Editor usa service_role)
--    Substitua os UUIDs pelos valores reais do seu banco
/*
INSERT INTO public.investments (
  unit_id,
  lead_id,
  investment_type,
  amount,
  description,
  investment_date,
  is_recurring
) VALUES (
  '00000000-0000-0000-0000-000000000001',  -- substitua pelo unit_id real
  '00000000-0000-0000-0000-000000000002',  -- substitua pelo lead_id real
  'poupanca',
  500.00,
  'Teste de inserção via SQL Editor',
  CURRENT_DATE,
  false
)
RETURNING *;

-- Confirma que o trigger atualizou o lead
SELECT id, last_seen_at, updated_at
FROM public.leads
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Confirma que a constraint de tipo invalida valores errados
INSERT INTO public.investments (unit_id, lead_id, investment_type, amount, investment_date)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'tipo_invalido',  -- deve falhar com violação de constraint
  100.00,
  CURRENT_DATE
);

-- Limpa o teste
DELETE FROM public.investments
WHERE description = 'Teste de inserção via SQL Editor';
*/
