-- =============================================================================
-- DNA FINANCEIRO — CORREÇÃO DA VIEW leads_commercial_summary
-- Versão: 1.1 · Maio 2026
-- =============================================================================
-- PROBLEMA NA VERSÃO ANTERIOR:
--   A view não tinha filtro de unidade nem restrição de role.
--   Qualquer usuário autenticado (inclusive end_user ou outro unit_admin)
--   conseguia ver leads de TODAS as unidades simplesmente consultando a view.
--   A view rodava com SECURITY DEFINER mas não chamava can_access_unit(),
--   tornando o isolamento multiunidade ineficaz neste ponto.
--
-- O QUE ESTA CORREÇÃO FAZ:
--   1. Recria a view com filtro duplo obrigatório:
--      a) is_unit_member_or_above() — bloqueia anon, end_user e não-autenticados
--      b) can_access_unit(l.unit_id) — isola por unidade para unit_admin/viewer
--   2. Mantém SECURITY DEFINER para que a view possa acessar leads
--      sem precisar de policy SELECT direta para unit_viewer
--   3. Revoga SELECT da role "anon" (usuários não autenticados)
--   4. Revoga SELECT da role "public" (base de todas as roles)
--   5. Concede SELECT apenas para "authenticated"
--   6. Inclui queries de validação ao final
--
-- COMO RODAR:
--   Supabase Dashboard → SQL Editor → cole o script completo → Run
--   Seguro para rodar em produção (DROP IF EXISTS + recriação idempotente)
-- =============================================================================


-- =============================================================================
-- PASSO 1 — Remover a view com brecha
-- =============================================================================

DROP VIEW IF EXISTS public.leads_commercial_summary;


-- =============================================================================
-- PASSO 2 — Recriar a view com segurança correta
--
-- SECURITY DEFINER: a view executa com os privilégios do seu owner (postgres),
-- não do usuário chamador. Isso permite ler a tabela leads internamente.
-- MAS o WHERE interno impõe o isolamento — sem ele, SECURITY DEFINER
-- seria perigoso (seria equivalente a dar SELECT em leads para todo autenticado).
--
-- Filtro duplo:
--   FILTRO A — is_unit_member_or_above():
--     Retorna true apenas para master, unit_admin, unit_viewer.
--     Retorna false para anon, end_user, não-autenticado → zero linhas.
--
--   FILTRO B — can_access_unit(l.unit_id):
--     Para master: sempre true → vê leads de todas as unidades.
--     Para unit_admin/unit_viewer: true apenas quando
--       l.unit_id = (jwt -> app_metadata ->> 'unit_id')::uuid
--     → Cada admin/viewer vê apenas leads da própria unidade.
--
-- Campos excluídos intencionalmente desta view (dados sensíveis):
--   monthly_income       → substituído por income_range (faixa textual)
--   monthly_expenses     → não exposto ao consultor
--   utm_source/medium/campaign/term/content → dados de marketing interno
--   referrer             → dados de rastreamento interno
--   consent_*            → dados de compliance, não comerciais
--   consent_at           → idem
--   deleted_at           → controle interno
-- =============================================================================

CREATE VIEW public.leads_commercial_summary
WITH (security_invoker = false)
AS
SELECT
  l.id,
  l.unit_id,
  l.campaign_id,

  -- Identificação (autorizada para consultor)
  l.name,
  l.phone,
  l.email,
  l.city,

  -- Perfil comercial
  l.main_dream,

  -- Faixa de renda — nunca o valor exato (princípio de minimização LGPD)
  CASE
    WHEN l.monthly_income IS NULL THEN 'Não informado'
    WHEN l.monthly_income < 2000  THEN 'Até R$ 2.000'
    WHEN l.monthly_income < 4000  THEN 'R$ 2.000 – R$ 4.000'
    WHEN l.monthly_income < 7000  THEN 'R$ 4.000 – R$ 7.000'
    ELSE                               'Acima de R$ 7.000'
  END AS income_range,

  -- Rastreamento comercial (origem, não UTM detalhado)
  l.unit_slug,
  l.campaign_slug,
  l.device_type,

  -- Progresso e status
  l.dna_progress,
  l.dna_stage,
  l.status,
  l.last_seen_at,
  l.created_at,
  l.updated_at,

  -- Nome da campanha (join seguro — campaigns também tem unit_id)
  c.name AS campaign_name

FROM public.leads l
LEFT JOIN public.campaigns c
  ON c.id = l.campaign_id
  AND c.deleted_at IS NULL

WHERE
  l.deleted_at IS NULL

  -- FILTRO A: bloqueia completamente anon, end_user e não-autenticados
  AND public.is_unit_member_or_above()

  -- FILTRO B: isola por unidade — unit_admin/viewer vê só a própria unidade
  --           master passa porque can_access_unit retorna true para is_master()
  AND public.can_access_unit(l.unit_id);

-- Documentação da view
COMMENT ON VIEW public.leads_commercial_summary IS
  'Visão segura para unit_viewer e unit_admin. '
  'Filtra por unidade via can_access_unit(). '
  'Exclui: monthly_income exato, monthly_expenses, utm_*, referrer, consentimentos. '
  'Requer role autenticado >= unit_viewer. Anon retorna zero linhas.';


-- =============================================================================
-- PASSO 3 — Revogar acesso público e anon; conceder só para authenticated
--
-- Por padrão no Supabase/PostgreSQL:
--   "public" é concedido para todas as roles (incluindo anon)
--   "anon"   é a role usada por conexões sem token JWT
--
-- Revogamos explicitamente ambas e concedemos apenas "authenticated"
-- (role usada por conexões com JWT válido do Supabase Auth).
-- =============================================================================

-- Revogar da role "public" (base — herdada por todas as roles)
REVOKE ALL ON public.leads_commercial_summary FROM public;

-- Revogar da role "anon" (conexões sem JWT — usuário final não autenticado)
REVOKE ALL ON public.leads_commercial_summary FROM anon;

-- Conceder SELECT apenas para "authenticated" (conexões com JWT válido)
GRANT SELECT ON public.leads_commercial_summary TO authenticated;

-- Nota: a role "service_role" (usada pelo Next.js server-side) tem
-- BYPASSRLS e acesso total — não precisa de GRANT explícito aqui,
-- mas também não é prejudicada por eles.


-- =============================================================================
-- PASSO 4 — Garantir que a view tem o owner correto
--
-- No Supabase, views SECURITY DEFINER executam com os privilégios do owner.
-- O owner deve ser "postgres" (superuser) ou outro role com SELECT em leads.
-- Se a view foi criada por outro role, ajuste conforme necessário.
-- =============================================================================

ALTER VIEW public.leads_commercial_summary OWNER TO postgres;


-- =============================================================================
-- PASSO 5 — Queries de validação
-- Execute após o script para confirmar que tudo está correto.
-- =============================================================================

-- 5.1 Confirmar que a view existe e tem o owner correto
SELECT
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'leads_commercial_summary';

-- 5.2 Confirmar que os campos corretos estão presentes
--     (monthly_income e monthly_expenses NÃO devem aparecer)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'leads_commercial_summary'
ORDER BY ordinal_position;

-- 5.3 Confirmar privilégios: anon não deve ter SELECT, authenticated deve ter
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name   = 'leads_commercial_summary'
ORDER BY grantee;

-- Resultado esperado para 5.3:
--   grantee         | privilege_type | is_grantable
--   authenticated   | SELECT         | NO
--   (anon e public NÃO devem aparecer com SELECT)

-- 5.4 Teste funcional: simule a lógica do filtro A
--     Mostra o que get_my_role() retornaria para a sessão atual
SELECT public.get_my_role() AS role_atual;
-- Se rodar como postgres/service_role: retorna NULL (bypass RLS — esperado)
-- Se rodar como unit_admin autenticado: retorna 'unit_admin'
-- Se rodar como anon: retorna 'end_user' → filtro A bloqueia

-- 5.5 Checklist de campos proibidos na view
--     Deve retornar 0 linhas (nenhum campo proibido presente)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'leads_commercial_summary'
  AND column_name IN (
    'monthly_income',
    'monthly_expenses',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'referrer',
    'source_url',
    'consent_diagnosis',
    'consent_communications',
    'consent_analytics',
    'consent_at',
    'deleted_at'
  );
-- Resultado esperado: 0 linhas

-- 5.6 Teste de isolamento manual (rode com token de unit_admin de sinop)
--     Deve retornar apenas leads da unidade sinop, nunca de outras unidades
-- SELECT unit_id, unit_slug, COUNT(*) as total
-- FROM public.leads_commercial_summary
-- GROUP BY unit_id, unit_slug;

-- 5.7 Confirmar que a tabela leads em si NÃO tem policy para unit_viewer
--     unit_viewer só pode acessar via esta view — nunca diretamente
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'leads'
ORDER BY policyname;
-- unit_viewer NÃO deve aparecer em nenhuma policy da tabela leads

