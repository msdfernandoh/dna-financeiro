// =============================================================================
// /admin — Dashboard Administrativo
//
// SEGURANÇA:
//   • requireAdmin() valida sessão em toda requisição
//   • master: sem filtro de unidade — vê tudo
//   • unit_admin / unit_viewer: filtro por session.unitId em todas as queries
//   • canSeeSensitive: controla renderização de médias financeiras e totais
//   • unit_id NUNCA exposto no HTML — apenas unit_slug para exibição
//   • Todos os cálculos são server-side; nenhum dado sensível vai ao client
//   • service_role apenas no servidor (createServerSupabaseClient)
// =============================================================================

import type { CSSProperties }        from 'react'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from './_AdminShell'
import { C }                          from '@/app/components/ui'

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtN(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}k`
  return String(v)
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 2)   return 'agora'
  if (mins  < 60)  return `${mins}min atrás`
  if (hours < 24)  return `${hours}h atrás`
  if (days  === 1) return 'ontem'
  if (days  < 7)   return `${days}d atrás`
  if (days  < 30)  return `${Math.floor(days / 7)} sem atrás`
  return `${Math.floor(days / 30)}m atrás`
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

// ── Mapeamentos ───────────────────────────────────────────────────────────────

const DREAM_LABELS: Record<string, string> = {
  carro:                     '🚗 Carro',
  casa:                      '🏠 Casa',
  negocio:                   '🏪 Negócio',
  viagem:                    '✈️ Viagem',
  reserva:                   '🐷 Reserva',
  faculdade:                 '🎓 Faculdade',
  reforma:                   '🔨 Reforma',
  dividas:                   '💳 Dívidas',
  moto:                      '🏍️ Moto',
  caminhao:                  '🚛 Caminhão',
  aposentadoria_imobiliaria: '🏦 Aposent. Imóvel',
  outro:                     '⭐ Outro',
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  new:         { label: 'Novo',         bg: C.bgSecondary, color: C.textSec    },
  in_progress: { label: 'Em progresso', bg: C.amberBg,     color: C.amberDark  },
  qualified:   { label: 'Qualificado',  bg: C.greenBg,     color: C.greenDark  },
  converted:   { label: 'Convertido',   bg: C.purpleBg,    color: C.purpleDeep },
  inactive:    { label: 'Inativo',      bg: '#FEE2E2',     color: '#991B1B'    },
}

const CAT_EMOJI: Record<string, string> = {
  alimentacao: '🍽️', mercado: '🛒', transporte: '🚗',
  saude: '💊', educacao: '📚', lazer: '🎮',
  dividas: '💳', contas: '📄', outros: '📦',
}

const OPP_TYPE_LABEL: Record<string, string> = {
  event: 'Evento', course: 'Curso', challenge: 'Desafio',
  job: 'Renda extra', banner: 'Banner', partner: 'Parceiro',
}

// ── Estilos compartilhados ────────────────────────────────────────────────────

const card: CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: `0.5px solid ${C.border}`, padding: '16px',
}

const sectionTitle: CSSProperties = {
  fontSize: 13, fontWeight: 700, color: C.text,
  marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()

  const isMaster        = session.role === 'master'
  const canSeeSensitive = session.role !== 'unit_viewer'
  const unitId          = session.unitId   // null para master

  // ── Datas ─────────────────────────────────────────────────────────────────
  const now          = new Date()
  const nowIso       = now.toISOString()
  const today        = nowIso.split('T')[0]
  const weekAgo      = new Date(now.getTime() - 6 * 86_400_000).toISOString()
  const firstOfMonth = `${today.slice(0, 7)}-01`

  const dateLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Query 1: Leads ────────────────────────────────────────────────────────
  // Todas as colunas buscadas via service_role (server-side) — dados sensíveis
  // controlados exclusivamente no render com canSeeSensitive. Nunca chegam ao browser.
  let leadsQ = supabase
    .from('leads')
    .select('id, name, city, main_dream, dna_progress, dna_stage, status, last_seen_at, created_at, updated_at, unit_slug, monthly_income, monthly_expenses')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (!isMaster && unitId) leadsQ = leadsQ.eq('unit_id', unitId)

  // ── Query 2: Despesas do mês ──────────────────────────────────────────────
  let expQ = supabase
    .from('expenses').select('lead_id, category, amount')
    .is('deleted_at', null)
    .gte('expense_date', firstOfMonth)
  if (!isMaster && unitId) expQ = expQ.eq('unit_id', unitId)

  // ── Query 3: Investimentos do mês ─────────────────────────────────────────
  let invQ = supabase
    .from('investments').select('lead_id, amount, investment_type')
    .is('deleted_at', null)
    .gte('investment_date', firstOfMonth)
  if (!isMaster && unitId) invQ = invQ.eq('unit_id', unitId)

  // ── Query 4: Perfis empresariais ──────────────────────────────────────────
  let bizQ = supabase
    .from('business_profiles')
    .select('lead_id, formalization, has_rent, has_vehicles, needs_working_capital, has_collateral_asset, has_separate_accounts, biz_dna_progress')
    .is('deleted_at', null)
  if (!isMaster && unitId) bizQ = bizQ.eq('unit_id', unitId)

  // ── Query 5: Oportunidades ────────────────────────────────────────────────
  let oppQ = supabase
    .from('opportunities')
    .select('id, type, title, cta_url, featured, active, starts_at, ends_at')
    .is('deleted_at', null)
  if (!isMaster && unitId) oppQ = oppQ.eq('unit_id', unitId)

  // ── Query 6: Interações com oportunidades ─────────────────────────────────
  let intQ = supabase
    .from('opportunity_interactions')
    .select('lead_id, opportunity_id, opportunity_title, interaction_type, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (!isMaster && unitId) intQ = intQ.eq('unit_id', unitId)

  // ── Execução paralela ─────────────────────────────────────────────────────
  const [
    { data: leadsRaw },
    { data: expRaw },
    { data: invRaw },
    { data: bizRaw },
    { data: oppsRaw },
    { data: intRaw },
  ] = await Promise.all([leadsQ, expQ, invQ, bizQ, oppQ, intQ])

  type LeadRow = {
    id: string; name: string; city: string | null
    main_dream: string | null; dna_progress: number; dna_stage: number
    status: string; last_seen_at: string | null
    created_at: string; updated_at: string; unit_slug: string
    monthly_income?: number | null; monthly_expenses?: number | null
  }
  type ExpRow  = { lead_id: string; category: string; amount: number }
  type InvRow  = { lead_id: string; amount: number; investment_type: string }
  type BizRow  = {
    lead_id: string; formalization: string | null
    has_rent: boolean | null; has_vehicles: boolean | null
    needs_working_capital: boolean | null; has_collateral_asset: boolean | null
    has_separate_accounts: boolean | null; biz_dna_progress: number
  }
  type OppRow  = {
    id: string; type: string; title: string; cta_url: string | null
    featured: boolean; active: boolean
    starts_at: string | null; ends_at: string | null
  }
  type IntRow  = {
    lead_id: string; opportunity_id: string | null
    opportunity_title: string | null; interaction_type: string; created_at: string
  }

  const leads  = (leadsRaw ?? []) as LeadRow[]
  const exps   = (expRaw   ?? []) as ExpRow[]
  const invs   = (invRaw   ?? []) as InvRow[]
  const bizs   = (bizRaw   ?? []) as BizRow[]
  const opps   = (oppsRaw  ?? []) as OppRow[]
  const ints   = (intRaw   ?? []) as IntRow[]

  // ── Estatísticas de leads ─────────────────────────────────────────────────

  const totalLeads  = leads.length
  const todayLeads  = leads.filter(l => l.created_at >= today).length
  const weekLeads   = leads.filter(l => l.created_at >= weekAgo).length
  const dnaComplete = leads.filter(l => l.dna_progress === 100).length
  const dnaStarted  = leads.filter(l => l.dna_progress > 0).length
  const lastSeenSet = leads.filter(l => l.last_seen_at != null).length

  // Sets de lead_ids para cruzamento
  const expLeadIds  = new Set(exps.map(e => e.lead_id))
  const invLeadIds  = new Set(invs.map(i => i.lead_id))
  const bizLeadIds  = new Set(bizs.map(b => b.lead_id))
  const intLeadIds  = new Set(ints.map(i => i.lead_id))
  const intrstIds   = new Set(ints.filter(i => i.interaction_type === 'interest').map(i => i.lead_id))

  const leadsWithExp  = expLeadIds.size
  const leadsWithInv  = invLeadIds.size
  const leadsWithBiz  = bizLeadIds.size
  const leadsWithInt  = intLeadIds.size
  const totalInterests = ints.filter(i => i.interaction_type === 'interest').length

  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {}
  for (const l of leads) statusMap[l.status] = (statusMap[l.status] ?? 0) + 1

  // ── Sonhos ────────────────────────────────────────────────────────────────
  const dreamMap: Record<string, number> = {}
  for (const l of leads) {
    const d = l.main_dream ?? 'outro'
    dreamMap[d] = (dreamMap[d] ?? 0) + 1
  }
  const dreamEntries = Object.entries(dreamMap).sort((a, b) => b[1] - a[1])
  const topDream = dreamEntries[0]?.[0] ?? '—'

  // ── Perfil financeiro (canSeeSensitive) ───────────────────────────────────
  let avgIncome = 0, avgExpenses = 0, sobrasPos = 0, sobrasNeg = 0
  if (canSeeSensitive) {
    const withInc = leads.filter(l => l.monthly_income != null)
    const withExp = leads.filter(l => l.monthly_expenses != null)
    if (withInc.length) avgIncome   = withInc.reduce((s, l) => s + (l.monthly_income ?? 0), 0)   / withInc.length
    if (withExp.length) avgExpenses = withExp.reduce((s, l) => s + (l.monthly_expenses ?? 0), 0)  / withExp.length
    sobrasPos = leads.filter(l =>
      l.monthly_income != null && l.monthly_expenses != null &&
      (l.monthly_income ?? 0) > (l.monthly_expenses ?? 0)
    ).length
    sobrasNeg = leads.filter(l =>
      l.monthly_income != null && l.monthly_expenses != null &&
      (l.monthly_expenses ?? 0) >= (l.monthly_income ?? 0)
    ).length
  }

  // ── Despesas por categoria ────────────────────────────────────────────────
  const catMap: Record<string, number> = {}
  for (const e of exps) catMap[e.category] = (catMap[e.category] ?? 0) + 1
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const topCat     = catEntries[0]?.[0] ?? null
  const totalExpAmount = exps.reduce((s, e) => s + e.amount, 0)

  // ── Investimentos ─────────────────────────────────────────────────────────
  const totalInvAmount = invs.reduce((s, i) => s + i.amount, 0)

  // ── Oportunidades ─────────────────────────────────────────────────────────
  const activeOpps    = opps.filter(o => o.active && (o.starts_at == null || o.starts_at <= nowIso) && (o.ends_at == null || o.ends_at >= nowIso))
  const scheduledOpps = opps.filter(o => o.active && o.starts_at != null && o.starts_at > nowIso)
  const expiredOpps   = opps.filter(o => o.ends_at != null && o.ends_at < nowIso)
  const featuredOpps  = opps.filter(o => o.featured && o.active)
  const noLinkOpps    = opps.filter(o => o.active && !o.cta_url)

  // Top opps por interações
  const oppIntCount: Record<string, { title: string; count: number }> = {}
  for (const i of ints) {
    if (i.opportunity_id) {
      if (!oppIntCount[i.opportunity_id]) {
        oppIntCount[i.opportunity_id] = { title: i.opportunity_title ?? 'Oportunidade', count: 0 }
      }
      oppIntCount[i.opportunity_id].count++
    }
  }
  const topOpps = Object.entries(oppIntCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  // ── Perfil empresarial ────────────────────────────────────────────────────
  const bizComplete      = bizs.filter(b => b.biz_dna_progress === 100).length
  const bizWithRent      = bizs.filter(b => b.has_rent             === true).length
  const bizWithFleet     = bizs.filter(b => b.has_vehicles         === true).length
  const bizNeedsCapital  = bizs.filter(b => b.needs_working_capital === true).length
  const bizHasCollateral = bizs.filter(b => b.has_collateral_asset  === true).length
  const bizNoSepAccounts = bizs.filter(b => b.has_separate_accounts === false).length

  // ── Alertas ───────────────────────────────────────────────────────────────
  // DNA completo sem interação com oportunidades
  const dnaCompleteIds     = new Set(leads.filter(l => l.dna_progress === 100).map(l => l.id))
  const dnaCompleteNoInt   = [...dnaCompleteIds].filter(id => !intLeadIds.has(id)).length
  // Oportunidades expiradas ainda em destaque
  const expiredFeatured    = opps.filter(o => o.featured && o.ends_at != null && o.ends_at < nowIso).length
  // Opps ativas sem link de CTA
  const activeNoLink       = noLinkOpps.length
  // Leads empresariais que precisam de capital de giro
  const bizCapital         = bizNeedsCapital
  // Leads com interesse registrado
  const leadsWithInterest  = intrstIds.size

  // ── Funil ─────────────────────────────────────────────────────────────────
  const funnelSteps = [
    { label: 'Cadastrados',                    value: totalLeads,   icon: '👤' },
    { label: 'DNA iniciado',                   value: dnaStarted,   icon: '🧬' },
    { label: 'Painel acessado *',              value: lastSeenSet,  icon: '🏠' },
    { label: 'Despesa lançada',                value: leadsWithExp, icon: '💸' },
    { label: 'DNA completo',                   value: dnaComplete,  icon: '✅' },
    { label: 'Relatório disponível',           value: dnaComplete,  icon: '📋' },
    { label: 'Interagiu com oportunidade',     value: leadsWithInt, icon: '🎯' },
  ]

  // ── Atividade recente ─────────────────────────────────────────────────────
  type Activity = { icon: string; text: string; time: string; color: string }
  const activities: Activity[] = []

  for (const l of leads.slice(0, 4)) {
    activities.push({ icon: '👤', text: `${l.name.split(' ')[0]} se cadastrou`, time: l.created_at, color: C.purple })
  }
  for (const l of leads.filter(l => l.dna_progress === 100).slice(0, 3)) {
    activities.push({ icon: '🧬', text: `${l.name.split(' ')[0]} concluiu o DNA`, time: l.updated_at, color: C.green })
  }
  for (const i of ints.filter(x => x.interaction_type === 'interest').slice(0, 4)) {
    activities.push({
      icon: '🎯',
      text: `Interesse: "${(i.opportunity_title ?? 'oportunidade').slice(0, 35)}"`,
      time: i.created_at, color: C.amber,
    })
  }
  activities.sort((a, b) => b.time.localeCompare(a.time))

  // ── Leads recentes ────────────────────────────────────────────────────────
  const recentLeads = leads.slice(0, 10)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AdminShell session={session} title="Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── A. Header ─────────────────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDeep} 100%)`,
          borderRadius: 16, padding: '20px 20px 16px',
          boxShadow: `0 4px 24px ${C.purple}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
                📊 Dashboard
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                {isMaster
                  ? 'Visão geral de todas as unidades'
                  : `Visão geral — ${session.name.split(' ')[0]}`}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                {dateLabel}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/admin/leads" style={quickBtn('#fff', C.purpleDeep)}>👥 Ver leads</a>
              {canSeeSensitive && (
                <a href="/admin/oportunidades/nova" style={quickBtn('rgba(255,255,255,0.15)', '#fff')}>+ Oportunidade</a>
              )}
              <a href="/admin/oportunidades" style={quickBtn('rgba(255,255,255,0.15)', '#fff')}>🎯 Oportunidades</a>
            </div>
          </div>

          {/* Mini KPIs no header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Total leads', value: fmtN(totalLeads) },
              { label: 'Hoje',        value: fmtN(todayLeads) },
              { label: 'Esta semana', value: fmtN(weekLeads)  },
              { label: 'DNA 100%',    value: fmtN(dnaComplete) },
            ].map(m => (
              <div key={m.label} style={{
                background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                padding: '8px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{m.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── B. KPIs ───────────────────────────────────────────────────────── */}
        <div>
          <div style={sectionTitle}>📈 KPIs principais</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <KpiCard icon="👥" value={fmtN(totalLeads)} label="Leads totais"
              sub={`${todayLeads} hoje · ${weekLeads} na semana`} href="/admin/leads" />
            <KpiCard icon="🧬" value={fmtN(dnaStarted)} label="DNA iniciado"
              sub={`${pct(dnaStarted, totalLeads)} dos leads`} />
            <KpiCard icon="✅" value={fmtN(dnaComplete)} label="DNA completo"
              sub={`${pct(dnaComplete, totalLeads)} dos leads`} color={C.green} />
            <KpiCard icon="💸" value={fmtN(leadsWithExp)} label="Com despesas"
              sub={`no mês atual`} color={C.coral} />
            <KpiCard icon="💚" value={fmtN(leadsWithInv)} label="Com investimentos"
              sub={`no mês atual`} color={C.green} />
            <KpiCard icon="🏢" value={fmtN(leadsWithBiz)} label="Empresariais"
              sub={`${pct(leadsWithBiz, totalLeads)} dos leads`} color={C.purple} />
            <KpiCard icon="🎯" value={fmtN(leadsWithInt)} label="Interag. opport."
              sub={`${totalInterests} interesses`} color={C.amber} />
            <KpiCard icon="🎯" value={fmtN(activeOpps.length)} label="Opps ativas"
              sub={`de ${opps.length} cadastradas`} href="/admin/oportunidades" />
          </div>
        </div>

        {/* ── Status breakdown ──────────────────────────────────────────────── */}
        {Object.keys(statusMap).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(statusMap).map(([status, count]) => {
              const m = STATUS_META[status] ?? { label: status, bg: C.bgSecondary, color: C.textSec }
              return (
                <div key={status} style={{
                  background: m.bg, color: m.color,
                  borderRadius: 99, padding: '4px 14px',
                  fontSize: 12, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {m.label}
                  <span style={{
                    background: m.color, color: '#fff',
                    borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>{count}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── C. Funil de engajamento ──────────────────────────────────────── */}
        <div style={card}>
          <div style={sectionTitle}>🔽 Funil de engajamento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnelSteps.map((step, i) => {
              const barPct = totalLeads > 0 ? Math.max((step.value / totalLeads) * 100, 2) : 0
              return (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: C.textSec }}>
                      {step.icon} {step.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      {fmtN(step.value)} <span style={{ fontSize: 10, fontWeight: 400, color: C.textTer }}>({pct(step.value, totalLeads)})</span>
                    </span>
                  </div>
                  <div style={{ background: C.bgSecondary, borderRadius: 99, height: 6, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: i === 0 ? C.purple : i < 3 ? C.amber : C.green,
                      width: `${barPct}%`, transition: 'width .4s',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 10, color: C.textTer, margin: '10px 0 0' }}>
            * Painel acessado é estimado via last_seen_at (atualiza ao lançar despesa/investimento)
          </p>
        </div>

        {/* ── D + E. Sonhos + Oportunidades lado a lado ────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* D. Sonhos */}
          <div style={card}>
            <div style={sectionTitle}>✨ Sonhos mais buscados</div>
            {dreamEntries.length === 0
              ? <Empty text="Nenhum sonho cadastrado." />
              : dreamEntries.slice(0, 7).map(([dream, count]) => (
                  <div key={dream} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, color: C.text }}>
                        {DREAM_LABELS[dream] ?? dream}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>
                        {count} <span style={{ fontWeight: 400 }}>({pct(count, totalLeads)})</span>
                      </span>
                    </div>
                    <div style={{ background: C.bgSecondary, borderRadius: 99, height: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, background: C.amber,
                        width: `${(count / totalLeads) * 100}%`,
                      }} />
                    </div>
                  </div>
                ))
            }
          </div>

          {/* E. Oportunidades */}
          <div style={card}>
            <div style={sectionTitle}>🎯 Oportunidades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Cadastradas',     value: opps.length,           color: C.text    },
                { label: 'Ativas agora',    value: activeOpps.length,     color: C.green   },
                { label: 'Programadas',     value: scheduledOpps.length,  color: C.amber   },
                { label: 'Expiradas',       value: expiredOpps.length,    color: C.coral   },
                { label: 'Em destaque',     value: featuredOpps.length,   color: C.purple  },
                { label: 'Sem link CTA',    value: noLinkOpps.length,     color: C.textSec },
                { label: 'Total interações',value: ints.length,           color: C.purple  },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.textSec }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
            {topOpps.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>
                  Mais interesse:
                </div>
                {topOpps.map(([id, data]) => (
                  <div key={id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 0', borderTop: `0.5px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: 11, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                      {data.title.slice(0, 40)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.purple, flexShrink: 0 }}>
                      {data.count}×
                    </span>
                  </div>
                ))}
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <a href="/admin/oportunidades" style={linkBtn}>Ver todas →</a>
              {canSeeSensitive && (
                <a href="/admin/oportunidades/nova" style={linkBtn}>+ Criar →</a>
              )}
            </div>
          </div>
        </div>

        {/* ── F. Perfil financeiro ──────────────────────────────────────────── */}
        <div style={card}>
          <div style={sectionTitle}>💰 Perfil financeiro — mês atual</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>

            {canSeeSensitive && (
              <>
                <StatCell label="Renda média" value={avgIncome > 0 ? fmtBRL(avgIncome) : '—'} note="aproximada" />
                <StatCell label="Desp. declarada méd." value={avgExpenses > 0 ? fmtBRL(avgExpenses) : '—'} note="aproximada" />
                <StatCell label="Total invest. mês" value={totalInvAmount > 0 ? fmtBRL(totalInvAmount) : '—'} color={C.green} />
                <StatCell label="Total desp. mês" value={totalExpAmount > 0 ? fmtBRL(totalExpAmount) : '—'} color={C.coral} />
              </>
            )}

            <StatCell label="Com sobra positiva" value={String(sobrasPos || '—')} note="renda > despesa" />
            <StatCell label="Com sobra negativa" value={String(sobrasNeg || '—')} note="despesa ≥ renda" color={C.coral} />
            <StatCell label="Lançaram despesa" value={fmtN(leadsWithExp)} note="no mês" />
            <StatCell label="Registraram invest." value={fmtN(leadsWithInv)} note="no mês" color={C.green} />

            {topCat && (
              <StatCell
                label="Categ. + frequente"
                value={`${CAT_EMOJI[topCat] ?? '📦'} ${topCat}`}
                note={`${catMap[topCat] ?? 0} lançamentos`}
              />
            )}

            {canSeeSensitive && catEntries.slice(0, 3).map(([cat, count]) => (
              <StatCell key={cat} label={`${CAT_EMOJI[cat] ?? '📦'} ${cat}`} value={String(count)} note="lançamentos" />
            ))}
          </div>

          {!canSeeSensitive && (
            <p style={{ fontSize: 11, color: C.textTer, margin: '10px 0 0' }}>
              💡 Médias e totais financeiros disponíveis apenas para unit_admin e master.
            </p>
          )}
        </div>

        {/* ── G. Perfil empresarial ─────────────────────────────────────────── */}
        {(leadsWithBiz > 0 || bizs.length > 0) && (
          <div style={card}>
            <div style={sectionTitle}>🏢 Perfil empresarial</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCell label="Leads empresariais" value={fmtN(leadsWithBiz)} color={C.purple} />
              <StatCell label="DNA empresarial 100%" value={fmtN(bizComplete)} note={pct(bizComplete, leadsWithBiz)} color={C.green} />
              <StatCell label="Pagam aluguel" value={fmtN(bizWithRent)} />
              <StatCell label="Com frota" value={fmtN(bizWithFleet)} />
              <StatCell label="Precisam capital" value={fmtN(bizNeedsCapital)} color={C.amber} />
              <StatCell label="Têm garantia" value={fmtN(bizHasCollateral)} />
              <StatCell label="Sem conta PJ" value={fmtN(bizNoSepAccounts)} color={C.coral} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/admin/leads" style={linkBtn}>Ver leads empresariais →</a>
              {canSeeSensitive && (
                <a href="/admin/oportunidades/nova" style={linkBtn}>+ Oportunidade empresarial →</a>
              )}
            </div>
          </div>
        )}

        {/* ── H + I. Atividade recente + Leads recentes ───────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14 }}>

          {/* H. Atividade recente */}
          <div style={card}>
            <div style={sectionTitle}>⚡ Atividade recente</div>
            {activities.length === 0
              ? <Empty text="Nenhuma atividade recente." />
              : activities.slice(0, 10).map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '7px 0',
                    borderTop: i > 0 ? `0.5px solid ${C.border}` : 'none',
                  }}>
                    <span style={{
                      fontSize: 16, width: 28, height: 28, borderRadius: 8,
                      background: C.bgSecondary, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{a.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: a.color, margin: 0, lineHeight: 1.3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{a.text}</p>
                      <p style={{ fontSize: 10, color: C.textTer, margin: '2px 0 0' }}>
                        {fmtRelative(a.time)}
                      </p>
                    </div>
                  </div>
                ))
            }
          </div>

          {/* I. Leads recentes */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={sectionTitle}>👥 Leads recentes</div>
              <a href="/admin/leads" style={{ fontSize: 11, color: C.purple, textDecoration: 'none' }}>Ver todos →</a>
            </div>
            {recentLeads.length === 0
              ? <Empty text="Nenhum lead ainda." />
              : recentLeads.map((l, i) => {
                  const st = STATUS_META[l.status] ?? STATUS_META.new
                  return (
                    <div key={l.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0',
                      borderTop: i > 0 ? `0.5px solid ${C.border}` : 'none',
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: C.purpleBg, color: C.purpleDeep,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {l.name.trim().split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{l.name.split(' ')[0]}</span>
                          {l.city && <span style={{ fontSize: 10, color: C.textSec }}>{l.city}</span>}
                          {l.main_dream && <span style={{ fontSize: 10 }}>{DREAM_LABELS[l.main_dream]?.split(' ')[0]}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 99,
                            background: st.bg, color: st.color, fontWeight: 600,
                          }}>{st.label}</span>
                          <span style={{ fontSize: 10, color: C.textTer }}>
                            DNA {l.dna_progress}%
                          </span>
                          <span style={{ fontSize: 10, color: C.textTer }}>
                            {fmtDateShort(l.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Link */}
                      <a href={`/admin/leads/${l.id}`} style={{
                        fontSize: 10, color: C.purple, textDecoration: 'none',
                        flexShrink: 0, padding: '3px 8px',
                        border: `1px solid ${C.purpleBg}`, borderRadius: 6,
                      }}>Ver →</a>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* ── J. Alertas comerciais ─────────────────────────────────────────── */}
        {(dnaCompleteNoInt > 0 || leadsWithInterest > 0 || bizCapital > 0 || expiredFeatured > 0 || activeNoLink > 0) && (
          <div style={card}>
            <div style={sectionTitle}>🚨 Alertas comerciais</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {dnaCompleteNoInt > 0 && (
                <AlertRow
                  icon="🧬" color={C.purple} bg={C.purpleBg}
                  title={`${dnaCompleteNoInt} leads com DNA 100% sem interação`}
                  desc="Estes leads estão prontos para abordagem — ainda não clicaram em nenhuma oportunidade."
                  href="/admin/leads"
                />
              )}

              {leadsWithInterest > 0 && (
                <AlertRow
                  icon="🎯" color={C.amber} bg={C.amberBg}
                  title={`${leadsWithInterest} leads demonstraram interesse em oportunidades`}
                  desc={`${totalInterests} interações de interesse registradas. Momento ideal para contato.`}
                  href="/admin/leads"
                />
              )}

              {bizCapital > 0 && (
                <AlertRow
                  icon="💰" color={C.green} bg={C.greenBg}
                  title={`${bizCapital} empresários precisam de capital de giro`}
                  desc="Perfis empresariais com necessidade declarada de crédito. Oportunidade para oferta direcionada."
                  href="/admin/leads"
                />
              )}

              {expiredFeatured > 0 && (
                <AlertRow
                  icon="⚠️" color={C.coral} bg={C.coralBg}
                  title={`${expiredFeatured} oportunidade(s) expirada(s) ainda em destaque`}
                  desc="Oportunidade com data de fim no passado continua aparecendo como destaque."
                  href="/admin/oportunidades"
                />
              )}

              {activeNoLink > 0 && (
                <AlertRow
                  icon="🔗" color={C.textSec} bg={C.bgSecondary}
                  title={`${activeNoLink} oportunidade(s) ativa(s) sem link de CTA`}
                  desc="O botão mostrará 'Tenho interesse' e registrará interação, mas sem URL de destino."
                  href="/admin/oportunidades"
                />
              )}

            </div>
          </div>
        )}

        {/* Sem alertas */}
        {dnaCompleteNoInt === 0 && leadsWithInterest === 0 && bizCapital === 0 && expiredFeatured === 0 && activeNoLink === 0 && totalLeads > 0 && (
          <div style={{ ...card, background: C.greenBg, borderColor: `${C.green}20`, textAlign: 'center', padding: '20px' }}>
            <p style={{ margin: 0, fontSize: 14, color: C.greenDark, fontWeight: 500 }}>
              ✅ Nenhum alerta comercial no momento. Tudo em ordem!
            </p>
          </div>
        )}

        {/* Estado vazio — sem leads ainda */}
        {totalLeads === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>📭</p>
            <p style={{ fontSize: 15, fontWeight: 500, color: C.text, margin: '0 0 6px' }}>
              Nenhum lead cadastrado ainda
            </p>
            <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
              Os dados aparecerão aqui assim que os primeiros leads acessarem o app.
            </p>
          </div>
        )}

      </div>
    </AdminShell>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function quickBtn(bg: string, color: string): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    background: bg, color,
    borderRadius: 8, padding: '6px 12px',
    fontSize: 11, fontWeight: 600, textDecoration: 'none',
    whiteSpace: 'nowrap',
  }
}

const linkBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  background: C.purpleBg, color: C.purpleDeep,
  borderRadius: 8, padding: '6px 12px',
  fontSize: 11, fontWeight: 600, textDecoration: 'none',
}

function KpiCard({
  icon, value, label, sub, color = C.text, href,
}: {
  icon: string; value: string; label: string
  sub?: string; color?: string; href?: string
}) {
  const inner = (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `0.5px solid ${C.border}`,
      padding: '14px 14px 12px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>{label}</span>
      {sub && <span style={{ fontSize: 10, color: C.textTer, marginTop: 1 }}>{sub}</span>}
    </div>
  )
  if (href) return <a href={href} style={{ textDecoration: 'none' }}>{inner}</a>
  return inner
}

function StatCell({
  label, value, note, color = C.text,
}: {
  label: string; value: string; note?: string; color?: string
}) {
  return (
    <div style={{
      background: C.bgSecondary, borderRadius: 10,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, color: C.textSec, marginBottom: 3, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      {note && <div style={{ fontSize: 9, color: C.textTer, marginTop: 2 }}>{note}</div>}
    </div>
  )
}

function AlertRow({
  icon, color, bg, title, desc, href,
}: {
  icon: string; color: string; bg: string; title: string; desc: string; href: string
}) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: bg, borderRadius: 10, padding: '10px 12px',
      textDecoration: 'none',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color, margin: '0 0 2px' }}>{title}</p>
        <p style={{ fontSize: 11, color, opacity: 0.8, margin: 0, lineHeight: 1.4 }}>{desc}</p>
      </div>
      <span style={{ fontSize: 14, color, flexShrink: 0, alignSelf: 'center' }}>→</span>
    </a>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 12, color: C.textTer, textAlign: 'center', padding: '16px 0', margin: 0 }}>
      {text}
    </p>
  )
}

// ── sectionTitle como constante de estilo (já declarada acima) ───────────────
// Redeclaro como função para uso nos sub-componentes que não têm acesso à const
// (const sectionTitle acima é CSSProperties, usada com spread em divs inline)
