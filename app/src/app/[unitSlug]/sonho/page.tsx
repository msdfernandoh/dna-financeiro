// =============================================================================
// /[unitSlug]/sonho — Caminhos para realizar meu sonho financeiro
//
// SEGURANÇA:
//   • lead_id resolvido do cookie HttpOnly (dna_lead_token) — nunca do browser
//   • unit_slug validado contra o banco (cross-unit protection)
//   • unit_id e lead_id nunca chegam ao frontend
//   • Simulações são matemáticas puras no servidor — nada salvo em localStorage
//   • NUNCA prometer aprovação de crédito, rendimento garantido ou contemplação
// =============================================================================

import { Fragment, type ReactNode } from 'react'
import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import {
  calculateDreamPlan, fmtBRLPlan, formatDreamSubtype,
  GOAL_STATUS_META, INSTALLMENT_STATUS_META,
  resolvePaths, futureValue, annualToMonthlyRate, evalInstallmentStatus, calcInstallment,
  type PlanSettings, type GoalStatus, type InstallmentStatus,
  type DreamPathSetting,
} from '@/lib/dreamPlan'

// ── Dados dos sonhos ──────────────────────────────────────────────────────────

const DREAMS: Record<string, { label: string; emoji: string }> = {
  carro:                     { label: 'Carro próprio',             emoji: '🚗' },
  casa:                      { label: 'Casa própria',              emoji: '🏠' },
  negocio:                   { label: 'Negócio próprio',           emoji: '🏪' },
  viagem:                    { label: 'Viagem dos sonhos',         emoji: '✈️' },
  reserva:                   { label: 'Reserva de emergência',     emoji: '🐷' },
  faculdade:                 { label: 'Faculdade',                 emoji: '🎓' },
  reforma:                   { label: 'Reforma da casa',           emoji: '🔨' },
  dividas:                   { label: 'Quitar dívidas',            emoji: '💳' },
  moto:                      { label: 'Moto',                      emoji: '🏍️' },
  caminhao:                  { label: 'Caminhão próprio',          emoji: '🚛' },
  aposentadoria_imobiliaria: { label: 'Aposentadoria imobiliária', emoji: '🏦' },
  outro:                     { label: 'Outro sonho',               emoji: '⭐' },
}

// Tipos elegíveis para consórcio
const CONSORCIAVEL = new Set(['carro', 'casa', 'caminhao', 'aposentadoria_imobiliaria'])

// Tipos imobiliários — não exibem plano fixo genérico sem configuração real
const REAL_ESTATE_TYPES = new Set(['casa', 'aposentadoria_imobiliaria'])

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

/** Valor futuro de anuidade (juro composto). Ex: 1%/mês = 0.01 */
function compoundFV(monthlySaving: number, months: number, rate = 0.01): number {
  if (monthlySaving <= 0) return 0
  return monthlySaving * ((Math.pow(1 + rate, months) - 1) / rate)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  params:       Promise<{ unitSlug: string }>
  searchParams: Promise<{ refinado?: string; trocado?: string; conquistado?: string }>
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function SonhoPage({ params, searchParams }: Props) {
  const { unitSlug } = await params
  const sp = await searchParams

  // 1. Cookie → leadId
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  let leadId: string
  try {
    const decoded = Buffer.from(token!, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 2. Lead (valida unit_slug → cross-unit protection)
  const supabase = createServerSupabaseClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('name, monthly_income, monthly_expenses, city, unit_id')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (!lead) redirect(`/${unitSlug}`)

  // 3. Todos os sonhos do lead (primário + histórico + conquistados)
  type DreamRow = {
    id:            string
    dream_type:    string
    dream_subtype: string | null
    target_amount: number
    target_label:  string | null
    is_primary:    boolean
    status:        string
    achieved_at:   string | null
  }
  let allDreams: DreamRow[] = []
  try {
    const { data } = await supabase
      .from('dreams')
      .select('id, dream_type, dream_subtype, target_amount, target_label, is_primary, status, achieved_at')
      .eq('lead_id', leadId!)
      .eq('unit_id', lead!.unit_id)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at',  { ascending: false })
      .limit(30)
    allDreams = data ?? []
  } catch { /* graceful */ }

  type PrimaryDream = DreamRow
  const primaryDream   = allDreams.find(d => d.is_primary && d.status === 'active') ?? null
  const otherDreams    = allDreams.filter(d => !d.is_primary && d.status === 'active')
  const achievedDreams = allDreams.filter(d => d.status === 'achieved')

  // 4. PlanSettings (graceful — global sem unit_id)
  let planSettings: PlanSettings | null = null
  if (primaryDream) {
    try {
      const { data: psRows } = await supabase
        .from('dream_plan_settings')
        .select('dream_subtype, term_months, full_installment_amount, reduced_installment_amount, full_installment_rate, reduced_installment_rate')
        .eq('dream_type', primaryDream.dream_type)
        .eq('active', true)
        .is('deleted_at', null)
        .limit(10)
      const row = (psRows ?? []).find(r => r.dream_subtype === primaryDream!.dream_subtype)
        ?? (psRows ?? []).find(r => r.dream_subtype === null)
        ?? null
      if (row) {
        planSettings = {
          term_months:                row.term_months,
          full_installment_amount:    row.full_installment_amount,
          reduced_installment_amount: row.reduced_installment_amount,
          full_installment_rate:      row.full_installment_rate,
          reduced_installment_rate:   row.reduced_installment_rate,
        }
      }
    } catch { /* graceful */ }
  }

  // 5. dream_path_settings — caminhos dinâmicos por tipo de sonho
  let rawPaths: DreamPathSetting[] = []
  if (primaryDream) {
    try {
      const { data: pathRows } = await supabase
        .from('dream_path_settings')
        .select(`
          path_type, dream_subtype, label, description,
          sort_order, show_capital_gain, show_total_cost,
          default_amount,
          term_months, annual_return_rate, monthly_interest_rate, annual_interest_rate,
          admin_fee_rate, admin_fee_base, down_payment_percent, bid_percent,
          programmed_contemplation_month, anticipation_start_month, anticipation_installments,
          full_installment_amount, reduced_installment_amount,
          group_size, draws_per_month, required_paid_installments_for_credit,
          average_letter_premium_percent,
          calculation_mode,
          promo_active, promo_label, promo_starts_at, promo_ends_at,
          promo_admin_fee_rate, promo_installment_amount, promo_reduced_installment_amount
        `)
        .eq('dream_type', primaryDream.dream_type)
        .eq('active', true)
        .is('deleted_at', null)
        .order('sort_order')
      rawPaths = (pathRows ?? []) as DreamPathSetting[]
    } catch { /* graceful — fallback para cards hardcoded */ }
  }
  const resolvedPaths    = resolvePaths(rawPaths, primaryDream?.dream_subtype ?? null)
  const hasDynamicPaths  = resolvedPaths.length > 0
  const showComparisonBlock = hasDynamicPaths &&
    resolvedPaths.some(p => p.path_type === 'investment') &&
    resolvedPaths.some(p =>
      p.path_type === 'consortium_programmed_date' ||
      p.path_type === 'consortium_traditional'
    )

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const income   = lead!.monthly_income   ?? 0
  const expenses = lead!.monthly_expenses ?? 0
  const sobra    = income - expenses

  const dreamInfo      = primaryDream ? (DREAMS[primaryDream.dream_type] ?? DREAMS.outro) : null
  const plan           = primaryDream ? calculateDreamPlan(primaryDream.target_amount, sobra, planSettings) : null
  const isConsorcio    = primaryDream ? CONSORCIAVEL.has(primaryDream.dream_type) : false
  const isPlanoPontual = primaryDream ? ['carro', 'caminhao'].includes(primaryDream.dream_type) : false
  const isRealEstate   = primaryDream ? REAL_ESTATE_TYPES.has(primaryDream.dream_type) : false

  // PARTE D — prazo do plano para horizonte de comparação nos cards fallback
  // Prioridade: consórcio > financiamento > qualquer path com term_months > planSettings
  const planTermMonths: number | null = (() => {
    if (hasDynamicPaths) {
      const consTerm = resolvedPaths.find(p =>
        p.path_type === 'consortium_traditional' ||
        p.path_type === 'consortium_with_bid' ||
        p.path_type === 'consortium_programmed_date'
      )?.term_months ?? null
      if (consTerm) return consTerm
      return resolvedPaths.find(p => p.term_months !== null)?.term_months ?? null
    }
    return planSettings?.term_months ?? null
  })()

  // Linhas "guardar à vista" — horizontes base + prazo do plano se > 60
  const safeMonthly = sobra > 0 ? sobra : 0

  const savingRows: { months: number; em: number; status: GoalStatus }[] = (() => {
    if (!plan) return []
    const rows: { months: number; em: number; status: GoalStatus }[] = [
      { months: 12, em: plan.em12, status: plan.status12 },
      { months: 24, em: plan.em24, status: plan.status24 },
      { months: 36, em: plan.em36, status: plan.status36 },
      { months: 60, em: plan.em60, status: plan.status60 },
    ]
    if (planTermMonths && planTermMonths > 60) {
      const em   = sobra * planTermMonths
      const need = plan.target / planTermMonths
      const gap  = need - (sobra > 0 ? sobra : 0)
      const status: GoalStatus = sobra <= 0 ? 'dificil'
        : gap <= 0 ? 'confortavel'
        : gap / need <= 0.30 ? 'possivel'
        : 'dificil'
      rows.push({ months: planTermMonths, em, status })
    }
    return rows
  })()

  // Linhas "investir mensalmente" (juros compostos 1%/mês) — mesmos horizontes
  const compoundRows: { months: number; fv: number }[] = (() => {
    if (!plan) return []
    const rows = [
      { months: 12, fv: compoundFV(safeMonthly, 12) },
      { months: 24, fv: compoundFV(safeMonthly, 24) },
      { months: 36, fv: compoundFV(safeMonthly, 36) },
      { months: 60, fv: compoundFV(safeMonthly, 60) },
    ]
    if (planTermMonths && planTermMonths > 60) {
      rows.push({ months: planTermMonths, fv: compoundFV(safeMonthly, planTermMonths) })
    }
    return rows
  })()

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href={`/${unitSlug}/inicio`} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: C.bgApp, border: `0.5px solid ${C.border}`,
          borderRadius: 8, padding: '6px 10px',
          fontSize: 11, fontWeight: 500, color: C.textSec,
          textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
        }}>← Meu Dia</a>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 600, color: C.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            🎯 Meu Sonho Financeiro
          </p>
          <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
            {lead!.city ?? unitSlug}
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 90px' }}>

        {/* ── Título ── */}
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
            Caminhos para seu sonho 🎯
          </h1>
          <p style={{ fontSize: 13, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
            Veja como você pode chegar lá — na velocidade que couber no seu bolso.
          </p>
        </div>

        {/* ── Banners de feedback ── */}
        {sp.refinado === '1' && (
          <div style={{
            background: C.greenBg, borderRadius: 14, padding: '12px 14px',
            marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
            border: `0.5px solid ${C.greenDark}30`,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>✅</span>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: C.greenDark }}>Sonho refinado!</p>
              <p style={{ margin: 0, fontSize: 11, color: C.greenDark }}>As alterações foram salvas com sucesso.</p>
            </div>
          </div>
        )}
        {sp.trocado === '1' && (
          <div style={{
            background: C.purpleBg, borderRadius: 14, padding: '12px 14px',
            marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
            border: `0.5px solid ${C.purple}30`,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🔄</span>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>Sonho principal atualizado!</p>
              <p style={{ margin: 0, fontSize: 11, color: C.purpleDeep }}>O sonho anterior permanece no histórico.</p>
            </div>
          </div>
        )}
        {sp.conquistado === '1' && (
          <div style={{
            background: C.amberBg, borderRadius: 14, padding: '12px 14px',
            marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
            border: `0.5px solid ${C.amber}40`,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🏆</span>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: C.amberDark }}>Parabéns! Sonho conquistado!</p>
              <p style={{ margin: 0, fontSize: 11, color: C.amberDark }}>Está registrado no seu histórico de conquistas.</p>
            </div>
          </div>
        )}

        {/* ── 3 botões de gestão do sonho (só quando há sonho primário) ── */}
        {primaryDream && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            <a href={`/${unitSlug}/sonho/editar`} style={{
              background: '#fff', borderRadius: 12,
              border: `0.5px solid ${C.border}`,
              padding: '12px 8px', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 20 }}>✏️</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>
                Refinar sonho
              </span>
            </a>
            <a href={`/${unitSlug}/sonho/trocar`} style={{
              background: C.purpleBg, borderRadius: 12,
              border: `0.5px solid ${C.purple}20`,
              padding: '12px 8px', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 20 }}>🔄</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.purpleDeep, textAlign: 'center', lineHeight: 1.3 }}>
                Trocar sonho
              </span>
            </a>
            <a href={`/${unitSlug}/sonho/conquistado`} style={{
              background: C.amberBg, borderRadius: 12,
              border: `0.5px solid ${C.amber}30`,
              padding: '12px 8px', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.amberDark, textAlign: 'center', lineHeight: 1.3 }}>
                Conquistei!
              </span>
            </a>
          </div>
        )}

        {/* ── PARTE A: Sem sonho cadastrado ── */}
        {!primaryDream && (
          <>
            <div style={{
              background: '#fff', borderRadius: 16,
              border: `0.5px solid ${C.border}`,
              padding: '24px 20px', marginBottom: 16, textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 36 }}>⭐</p>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: C.text }}>
                Refine seu sonho para ver os caminhos possíveis
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
                Defina sua meta e descubra como chegar lá — poupança, investimento ou consórcio.
              </p>
              <a href={`/${unitSlug}/sonho/trocar`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: C.amber, color: '#fff',
                borderRadius: 14, padding: '14px 24px',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
                marginBottom: 8,
              }}>
                🎯 Criar meu sonho agora
              </a>
              <a href={`/${unitSlug}/dna`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: C.bgApp, color: C.textSec,
                borderRadius: 14, padding: '12px 24px',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
                border: `0.5px solid ${C.border}`,
              }}>
                🧬 Completar meu DNA Financeiro
              </a>
            </div>
            <ActionButtons unitSlug={unitSlug} />
          </>
        )}

        {/* ── PARTES B–E: Sonho cadastrado ── */}
        {primaryDream && dreamInfo && plan && (
          <>

            {/* ── PARTE B: Card principal do sonho ── */}
            <div style={{
              background: '#fff', borderRadius: 20,
              border: `0.5px solid ${C.border}`,
              padding: '20px', marginBottom: 12,
            }}>
              {/* Identidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: C.amberBg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                }}>
                  {dreamInfo.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>Seu sonho principal</p>
                  <p style={{ margin: '2px 0', fontSize: 16, fontWeight: 700, color: C.text }}>
                    {dreamInfo.label}
                  </p>
                  {formatDreamSubtype(primaryDream.dream_subtype) && (
                    <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
                      {formatDreamSubtype(primaryDream.dream_subtype)}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, color: C.textSec }}>Meta</p>
                  <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 800, color: C.amberDark }}>
                    {primaryDream.target_label ?? fmtBRLPlan(primaryDream.target_amount)}
                  </p>
                </div>
              </div>

              {/* KPIs financeiros */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: 6, marginBottom: 14,
              }}>
                <MiniKpi label="Renda/mês"    value={income   > 0 ? fmtBRL(income)   : '—'} />
                <MiniKpi label="Despesas/mês" value={expenses > 0 ? fmtBRL(expenses) : '—'} color={C.coralDark} />
                <MiniKpi
                  label="Sobra/mês"
                  value={
                    sobra > 0 ? fmtBRL(sobra)
                    : sobra < 0 ? '-' + fmtBRL(Math.abs(sobra))
                    : '—'
                  }
                  color={sobra > 0 ? C.greenDark : sobra < 0 ? C.coralDark : C.textTer}
                  bg={sobra > 0 ? C.greenBg : sobra < 0 ? C.coralBg : '#fff'}
                />
              </div>

              {/* Prazo mais realista */}
              {plan.bestMonths !== null && (
                <div style={{
                  background: C.purpleBg, borderRadius: 12,
                  padding: '12px 14px', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📅</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.purpleDeep }}>
                      Prazo mais realista: {plan.bestMonths} meses
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.purpleDeep, lineHeight: 1.4 }}>
                      Guardando toda a sobra mensal ({fmtBRL(sobra)}).
                    </p>
                  </div>
                </div>
              )}

              {/* Alerta: sobra zero ou negativa */}
              {sobra <= 0 && (
                <div style={{
                  background: C.coralBg, borderRadius: 12,
                  padding: '12px 14px', marginBottom: 10,
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                  <p style={{ margin: 0, fontSize: 12, color: C.coralDark, lineHeight: 1.5 }}>
                    Suas despesas estão acima da sua renda.
                    Reduzir gastos é o primeiro passo para conquistar seu sonho.
                  </p>
                </div>
              )}

              {/* Parcela sugerida — só com plano real configurado (dream_path_settings) */}
              {hasDynamicPaths && plan.hasPlanSettings &&
               (plan.reducedInstallment !== null || plan.fullInstallment !== null) && (
                <div style={{
                  background: C.greenBg, borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.greenDark }}>
                      Parcela sugerida:{' '}
                      {fmtBRL(plan.reducedInstallment ?? plan.fullInstallment!)}
                      /mês
                    </p>
                    {plan.suggestedTerm && (
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: C.greenDark }}>
                        em {plan.suggestedTerm} meses — simulação inicial.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Sem plano configurado — mensagem limpa */}
              {!hasDynamicPaths && (
                <div style={{
                  background: C.bgApp, borderRadius: 12,
                  padding: '12px 14px', border: `0.5px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🔧</span>
                  <p style={{ margin: 0, fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
                    {isRealEstate
                      ? 'Planos de imóvel serão configurados em breve. Veja as simulações abaixo.'
                      : 'Plano ainda não configurado para este tipo de sonho.'}
                  </p>
                </div>
              )}
            </div>

            {/* ── PARTE C: Comparativo de caminhos ── */}
            <p style={{ margin: '4px 0 10px', fontSize: 13, fontWeight: 700, color: C.text }}>
              📊 Comparativo de caminhos
            </p>

            {/* Cards dinâmicos do banco (dream_path_settings) */}
            {hasDynamicPaths && (
              <>
                {resolvedPaths.map(p => (
                  <Fragment key={p.path_type}>
                    {renderDynamicPathCard(p, {
                      target:         primaryDream.target_amount,
                      targetLabel:    primaryDream.target_label,
                      sobra,
                      safeMonthly,
                      bestMonths:     plan.bestMonths,
                      planTermMonths,
                    })}
                  </Fragment>
                ))}
                {showComparisonBlock && <ComparisonBlock />}
              </>
            )}

            {/* Fallback: cards simples quando não há dream_path_settings configurado */}
            {!hasDynamicPaths && (<>

            {/* Card 1: Guardar à vista */}
            <PathCard
              emoji="🐷"
              title="Guardar e comprar à vista"
              subtitle="Poupança direta — sem juros, sem dívida"
            >
              {sobra > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {savingRows.map(({ months, em, status }) => {
                    const meta    = GOAL_STATUS_META[status]
                    const reached = em >= primaryDream.target_amount
                    return (
                      <div key={months} style={{
                        background: reached ? C.greenBg : meta.bg,
                        borderRadius: 10, padding: '10px 12px',
                        border: reached ? `0.5px solid ${C.greenDark}30` : 'none',
                      }}>
                        <p style={{ margin: '0 0 2px', fontSize: 10, color: reached ? C.greenDark : meta.color, fontWeight: 500 }}>
                          {months} meses
                        </p>
                        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: reached ? C.greenDark : meta.color }}>
                          {fmtBRL(em)}
                        </p>
                        <p style={{ margin: 0, fontSize: 9, color: reached ? C.greenDark : meta.color }}>
                          {reached ? '✅ Meta atingida!' : meta.label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
                  Ajuste suas despesas para liberar uma sobra mensal e ver a simulação.
                </p>
              )}
            </PathCard>

            {/* Card 2: Investir mensalmente */}
            <PathCard
              emoji="📈"
              title="Investir mensalmente"
              subtitle="Simulação a 1% ao mês — rendimento não é garantido"
            >
              {sobra > 0 ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {compoundRows.map(({ months, fv }) => {
                      const reached = fv >= primaryDream.target_amount
                      return (
                        <div key={months} style={{
                          background: reached ? C.greenBg : C.purpleBg,
                          borderRadius: 10, padding: '10px 12px',
                        }}>
                          <p style={{ margin: '0 0 2px', fontSize: 10, color: reached ? C.greenDark : C.purpleDeep, fontWeight: 500 }}>
                            {months} meses
                          </p>
                          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: reached ? C.greenDark : C.purpleDeep }}>
                            {fmtBRL(fv)}
                          </p>
                          {reached && (
                            <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>✅ Meta atingida!</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
                    ⚠️ Simulação inicial a 1% ao mês. Rendimento não é garantido — depende da aplicação escolhida.
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
                  Libere uma sobra mensal para simular o crescimento do investimento.
                </p>
              )}
            </PathCard>

            {/* Card 3: Plano com parcela
                  — Não exibir para imóvel (valores fixos genéricos são enganosos)
                  — Para outros tipos: rotular como "simulação padrão (genérica)" */}
            {plan.hasPlanSettings && !isRealEstate && (
              <PathCard
                emoji="📋"
                title="Simulação padrão (genérica)"
                subtitle="Referência de prazo e parcela — configure planos reais no admin"
              >
                {plan.suggestedTerm && (
                  <div style={{
                    background: C.purpleBg, borderRadius: 10,
                    padding: '10px 12px', marginBottom: 8,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: C.purpleDeep, fontWeight: 600 }}>
                      📅 Prazo de referência: {plan.suggestedTerm} meses
                    </p>
                  </div>
                )}
                {plan.fullInstallment !== null && plan.fullInstallmentStatus !== null && (
                  <div style={{ marginBottom: 6 }}>
                    <InstallmentRow
                      label="Parcela de referência"
                      value={plan.fullInstallment}
                      status={plan.fullInstallmentStatus}
                    />
                  </div>
                )}
                {plan.reducedInstallment !== null && plan.reducedInstallmentStatus !== null && (
                  <div style={{ marginBottom: 8 }}>
                    <InstallmentRow
                      label="Parcela reduzida (ref.)"
                      value={plan.reducedInstallment}
                      status={plan.reducedInstallmentStatus}
                    />
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
                  ⚠️ Simulação genérica — não reflete plano específico para este sonho.
                  Configure planos reais no painel admin para exibir dados precisos.
                </p>
              </PathCard>
            )}

            {/* Card 4: Consórcio (apenas para tipos elegíveis) */}
            {isConsorcio && (
              <PathCard
                emoji="🤝"
                title="Consórcio / Crédito atualizado"
                subtitle="Carta de crédito sem juros de financiamento"
              >
                {plan.hasPlanSettings && !isRealEstate ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>
                          Carta de crédito
                        </p>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>
                          {primaryDream.target_label ?? fmtBRL(primaryDream.target_amount)}
                        </p>
                      </div>
                      {plan.suggestedTerm && (
                        <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
                          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>
                            Prazo estimado
                          </p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>
                            {plan.suggestedTerm} meses
                          </p>
                        </div>
                      )}
                    </div>
                    {plan.fullInstallment !== null && plan.fullInstallmentStatus !== null && (
                      <div style={{ marginBottom: 8 }}>
                        <InstallmentRow
                          label="Parcela estimada"
                          value={plan.fullInstallment}
                          status={plan.fullInstallmentStatus}
                        />
                      </div>
                    )}
                    <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
                      ⚠️ Simulação inicial. O crédito contratado pode se valorizar ao longo do prazo.
                      Não há promessa de contemplação, aprovação de crédito ou garantia de rendimento.
                    </p>
                  </>
                ) : (
                  <div style={{
                    background: C.amberBg, borderRadius: 10,
                    padding: '14px 16px', textAlign: 'center',
                  }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: C.amberDark }}>
                      {isRealEstate
                        ? 'Planos de imóvel serão configurados em breve'
                        : 'Simulação detalhada em breve'}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: C.amberDark, lineHeight: 1.5 }}>
                      Carta de crédito estimada:{' '}
                      {primaryDream.target_label ?? fmtBRL(primaryDream.target_amount)}
                    </p>
                    {isRealEstate && (
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: C.amberDark }}>
                        Configure os planos no admin para habilitar esta comparação.
                      </p>
                    )}
                  </div>
                )}
              </PathCard>
            )}

            {/* ── Card 5: Plano Pontual (carro e caminhão) ── */}
            {isPlanoPontual && (
              <PathCard
                emoji="📅"
                title="Plano Pontual"
                subtitle="Consórcio com contemplação programada — automóvel e caminhão"
              >
                {/* Crédito + Prazo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>
                      Crédito desejado
                    </p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>
                      {primaryDream.target_label ?? fmtBRL(primaryDream.target_amount)}
                    </p>
                  </div>
                  <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>
                      Prazo programado
                    </p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>
                      até 24 meses
                    </p>
                  </div>
                </div>

                {plan.hasPlanSettings && plan.fullInstallment !== null ? (
                  <>
                    {/* Parcela estimada */}
                    <div style={{
                      background: C.purpleBg, borderRadius: 10,
                      padding: '10px 14px', marginBottom: 6,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <p style={{ margin: '0 0 1px', fontSize: 10, fontWeight: 600, color: C.purpleDeep }}>
                          Parcela estimada
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: C.purpleDeep }}>
                          até o 6º mês
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.purpleDeep }}>
                        {fmtBRL(plan.fullInstallment)}
                        <span style={{ fontSize: 10, fontWeight: 500 }}>/mês</span>
                      </p>
                    </div>

                    {/* Antecipação / Desembolso */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <div style={{
                        background: C.bgApp, borderRadius: 10, padding: '10px 12px',
                        border: `0.5px solid ${C.border}`,
                      }}>
                        <p style={{ margin: '0 0 2px', fontSize: 9, color: C.textSec, fontWeight: 500 }}>
                          Pago até 6º mês
                        </p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
                          {fmtBRL(plan.fullInstallment * 6)}
                        </p>
                      </div>
                      <div style={{
                        background: C.bgApp, borderRadius: 10, padding: '10px 12px',
                        border: `0.5px solid ${C.border}`,
                      }}>
                        <p style={{ margin: '0 0 2px', fontSize: 9, color: C.textSec, fontWeight: 500 }}>
                          Antecipar 18 parcelas
                        </p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
                          {fmtBRL(plan.fullInstallment * 18)}
                        </p>
                      </div>
                      <div style={{
                        gridColumn: '1 / -1',
                        background: C.greenBg, borderRadius: 10, padding: '10px 12px',
                        border: `0.5px solid ${C.greenDark}20`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div>
                          <p style={{ margin: '0 0 1px', fontSize: 9, fontWeight: 600, color: C.greenDark }}>
                            Desembolso total estimado
                          </p>
                          <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>
                            6 parcelas + antecipação de 18
                          </p>
                        </div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.greenDark }}>
                          {fmtBRL(plan.fullInstallment * 24)}
                        </p>
                      </div>
                    </div>

                    {/* Comparação com juntar sozinho */}
                    {plan.bestMonths !== null && (
                      <div style={{
                        background: C.purpleBg, borderRadius: 10,
                        padding: '10px 12px', marginBottom: 8,
                      }}>
                        <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: C.purpleDeep }}>
                          📊 Comparação com juntar sozinho
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <p style={{ margin: '0 0 1px', fontSize: 9, color: C.purpleDeep }}>Poupança direta</p>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>
                              {plan.bestMonths} meses
                            </p>
                          </div>
                          <span style={{ fontSize: 14, color: C.purpleDeep }}>→</span>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '0 0 1px', fontSize: 9, color: C.purpleDeep }}>Plano Pontual</p>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>
                              até 24 meses
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Sem planSettings — descrição do produto */
                  <div style={{ marginBottom: 8 }}>
                    <div style={{
                      background: C.purpleBg, borderRadius: 10,
                      padding: '12px 14px', marginBottom: 6,
                    }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: C.purpleDeep }}>
                        📋 Como funciona
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ margin: 0, fontSize: 11, color: C.purpleDeep, lineHeight: 1.5 }}>
                          • Contemplação programada conforme regra do plano
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: C.purpleDeep, lineHeight: 1.5 }}>
                          • A partir do 6º mês: antecipe 18 parcelas para buscar a carta de crédito
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: C.purpleDeep, lineHeight: 1.5 }}>
                          • Parcelas e condições a confirmar com o consultor
                        </p>
                      </div>
                    </div>
                    {plan.bestMonths !== null && (
                      <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ margin: 0, fontSize: 11, color: C.amberDark, lineHeight: 1.5 }}>
                          Juntando sozinho: <strong>{plan.bestMonths} meses</strong>{' '}
                          — com Plano Pontual, contemplação programada em{' '}
                          <strong>até 24 meses</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
                  ⚠️ Simulação inicial. A contemplação programada, antecipação de parcelas, valores e condições
                  dependem das regras do plano, contrato e administradora.
                </p>
              </PathCard>
            )}

            </>)} {/* /fallback hardcoded */}

            {/* ── PARTE D: Bloco educacional ── */}
            <div style={{
              background: '#fff', borderRadius: 16,
              border: `0.5px solid ${C.border}`,
              padding: '16px', marginBottom: 12,
            }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: C.text }}>
                📚 Entendendo os caminhos
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <EduRow
                  emoji="🐷"
                  title="Poupança direta"
                  desc="O caminho mais simples: guardar a sobra todo mês até juntar o valor. Sem risco de dívida."
                  color={C.greenDark}
                  bg={C.greenBg}
                />
                <EduRow
                  emoji="📈"
                  title="Investimento"
                  desc="Você aplica mensalmente e o dinheiro pode crescer com o tempo. Tem liquidez e flexibilidade, mas rendimento não é garantido."
                  color={C.purpleDeep}
                  bg={C.purpleBg}
                />
                {isConsorcio && (
                  <EduRow
                    emoji="🤝"
                    title="Consórcio"
                    desc="Você paga parcelas mensais e concorre à carta de crédito. Sem juros de financiamento, mas depende de contemplação — não há garantia de prazo."
                    color={C.amberDark}
                    bg={C.amberBg}
                  />
                )}
              </div>
            </div>

            {/* ── PARTE D2: Histórico de sonhos ── */}
            {(otherDreams.length > 0 || achievedDreams.length > 0) && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.text }}>
                  📂 Seus outros sonhos
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

                  {/* Sonhos ativos não-primários */}
                  {otherDreams.map(d => {
                    const di = DREAMS[d.dream_type] ?? DREAMS.outro
                    return (
                      <div key={d.id} style={{
                        background: '#fff', borderRadius: 14,
                        border: `0.5px solid ${C.border}`,
                        padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 12,
                          background: C.bgApp, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        }}>
                          {di.emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>
                            {di.label}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSec }}>
                            Meta: {d.target_label ?? fmtBRL(d.target_amount)}
                          </p>
                        </div>
                        <a href={`/${unitSlug}/sonho/trocar`} style={{
                          fontSize: 10, fontWeight: 600, color: C.purpleDeep,
                          background: C.purpleBg, borderRadius: 8,
                          padding: '6px 10px', textDecoration: 'none', flexShrink: 0,
                          border: `0.5px solid ${C.purple}20`,
                          whiteSpace: 'nowrap',
                        }}>
                          Tornar principal
                        </a>
                      </div>
                    )
                  })}

                  {/* Sonhos conquistados */}
                  {achievedDreams.map(d => {
                    const di = DREAMS[d.dream_type] ?? DREAMS.outro
                    const achievedDate = d.achieved_at
                      ? new Date(d.achieved_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                      : null
                    return (
                      <div key={d.id} style={{
                        background: C.amberBg, borderRadius: 14,
                        border: `0.5px solid ${C.amber}30`,
                        padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 12,
                          background: 'rgba(255,255,255,0.5)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        }}>
                          {di.emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.amberDark }}>
                            {di.label}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.amberDark }}>
                            🏆 Conquistado{achievedDate ? ` em ${achievedDate}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}

                </div>
              </div>
            )}

            {/* ── PARTE E: Botões de ação ── */}
            <ActionButtons unitSlug={unitSlug} />
          </>
        )}

      </main>

      <LeadBottomNav unitSlug={unitSlug} />
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MiniKpi({
  label, value, color = C.text, bg = '#fff',
}: {
  label: string; value: string; color?: string; bg?: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center',
      border: `0.5px solid ${C.border}`,
    }}>
      <p style={{
        margin: '0 0 2px', fontSize: 9, color: C.textSec, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.4px',
      }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontSize: 12, fontWeight: 700, color,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </p>
    </div>
  )
}

function PathCard({
  emoji, title, subtitle, children,
}: {
  emoji: string; title: string; subtitle: string; children: ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: `0.5px solid ${C.border}`,
      padding: '16px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: C.bgApp, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {emoji}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{title}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: C.textSec }}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function InstallmentRow({
  label, value, status,
}: {
  label: string; value: number; status: InstallmentStatus
}) {
  const meta = INSTALLMENT_STATUS_META[status]
  return (
    <div style={{
      background: meta.bg, borderRadius: 10,
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 11, color: meta.color, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: meta.color }}>
          {meta.emoji} {meta.label}
        </p>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: meta.color, flexShrink: 0 }}>
        {fmtBRLPlan(value)}<span style={{ fontSize: 11, fontWeight: 500 }}>/mês</span>
      </p>
    </div>
  )
}

function EduRow({
  emoji, title, desc, color, bg,
}: {
  emoji: string; title: string; desc: string; color: string; bg: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 10,
      padding: '12px 14px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div>
        <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color }}>{title}</p>
        <p style={{ margin: 0, fontSize: 11, color, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  )
}

function ActionButtons({ unitSlug }: { unitSlug: string }) {
  const buttons = [
    { href: `/${unitSlug}/despesas/nova`,  emoji: '💸', label: 'Lançar despesa',         bg: C.coral,    color: '#fff'       },
    { href: `/${unitSlug}/investimentos`,  emoji: '💚', label: 'Registrar investimento',  bg: C.greenBg,  color: C.greenDark  },
    { href: `/${unitSlug}/relatorio`,      emoji: '📋', label: 'Ver relatório',           bg: C.purpleBg, color: C.purpleDeep },
    { href: `/${unitSlug}/oportunidades`,  emoji: '🎯', label: 'Ver oportunidades',       bg: C.amberBg,  color: C.amberDark  },
    { href: `/${unitSlug}/inicio`,         emoji: '🏠', label: 'Voltar ao Meu Dia',       bg: C.bgApp,    color: C.text       },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {buttons.map(b => (
        <a key={b.href} href={b.href} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: b.bg, borderRadius: 14,
          padding: '16px 18px', textDecoration: 'none',
          border: `0.5px solid ${C.border}`,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{b.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: b.color }}>{b.label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textTer }}>→</span>
        </a>
      ))}
    </div>
  )
}

// =============================================================================
// Cards dinâmicos — dream_path_settings
// =============================================================================

/**
 * Escala uma parcela conforme calculation_mode.
 *   fixed        → retorna base sem alterar
 *   proportional → base * target / default_amount (padrão)
 *   formula      → chamador usa PMT; este helper trata o fallback proporcional
 *   null          → backward-compat: proportional
 */
function scaleInstallment(
  base:          number | null,
  defaultAmount: number | null,
  target:        number,
  mode?:         string | null,
): number | null {
  if (base === null) return null
  const m = mode ?? 'proportional'
  if (m === 'fixed') return base
  // proportional (e formula como fallback)
  if (!defaultAmount || defaultAmount <= 0) return base
  return base * target / defaultAmount
}

// ── Promoção ─────────────────────────────────────────────────────────────────

type PromoData = {
  label:               string | null
  adminFeeRate:        number | null
  installment:         number | null
  reducedInstallment:  number | null
  endsAt:              Date   | null
}

/**
 * Retorna os dados de promoção vigente ou null.
 * Considera promo_active + janela de datas.
 */
function resolvePromo(path: DreamPathSetting): PromoData | null {
  if (!path.promo_active) return null
  const now = new Date()
  if (path.promo_starts_at && new Date(path.promo_starts_at) > now) return null
  if (path.promo_ends_at   && new Date(path.promo_ends_at)   < now) return null
  return {
    label:              path.promo_label              ?? null,
    adminFeeRate:       path.promo_admin_fee_rate      ?? null,
    installment:        path.promo_installment_amount  ?? null,
    reducedInstallment: path.promo_reduced_installment_amount ?? null,
    endsAt:             path.promo_ends_at ? new Date(path.promo_ends_at) : null,
  }
}

function PromoBadge({ label, endsAt }: { label: string | null; endsAt: Date | null }) {
  const endStr = endsAt
    ? endsAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  return (
    <div style={{
      background: '#FFF7ED', border: '1px solid #FED7AA',
      borderRadius: 8, padding: '8px 12px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>🔥</span>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#C2410C', lineHeight: 1.4 }}>
        {label ?? 'Condição promocional ativa'}
        {endStr && (
          <span style={{ fontWeight: 400, color: '#9A3412' }}> — até {endStr}</span>
        )}
      </p>
    </div>
  )
}

const PATH_ICONS: Record<string, string> = {
  cash_saving:                '🐷',
  investment:                 '📈',
  financing:                  '🏦',
  cdc:                        '💳',
  investment_plus_cdc:        '🔀',
  consortium_traditional:     '🤝',
  consortium_with_bid:        '🎯',
  consortium_programmed_date: '📅',
}

type CardCtx = {
  target:         number
  targetLabel:    string | null
  sobra:          number
  safeMonthly:    number
  bestMonths:     number | null
  planTermMonths: number | null
}

function renderDynamicPathCard(path: DreamPathSetting, ctx: CardCtx): ReactNode {
  switch (path.path_type) {
    case 'cash_saving':                return renderCashSavingCard(path, ctx)
    case 'investment':                 return renderInvestmentCard(path, ctx)
    case 'financing':                  return renderFinancingCard(path, ctx, false)
    case 'cdc':                        return renderFinancingCard(path, ctx, true)
    case 'investment_plus_cdc':        return renderInvestmentPlusCdcCard(path, ctx)
    case 'consortium_traditional':     return renderConsortiumTraditionalCard(path, ctx)
    case 'consortium_with_bid':        return renderConsortiumWithBidCard(path, ctx)
    case 'consortium_programmed_date': return renderConsortiumProgrammedDateCard(path, ctx)
    default:                           return null
  }
}

function ComparisonBlock() {
  return (
    <div style={{
      background: C.purpleBg, borderRadius: 16,
      border: `0.5px solid ${C.purple}20`,
      padding: '16px', marginBottom: 8,
    }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>
        📊 Por que comparar os caminhos?
      </p>
      <p style={{ margin: 0, fontSize: 12, color: C.purpleDeep, lineHeight: 1.6 }}>
        No investimento, o crescimento acontece sobre o dinheiro que você consegue guardar.
        No consórcio, a atualização pode acompanhar o valor do crédito contratado, conforme regra do plano.
        Por isso, para sonhos de alto valor, comparar os caminhos ajuda a tomar uma decisão mais consciente.
      </p>
    </div>
  )
}

function renderCashSavingCard(path: DreamPathSetting, ctx: CardCtx): ReactNode {
  const { target, safeMonthly, sobra, planTermMonths } = ctx
  const baseHorizons = [
    { months: 12,  label: '1 ano'   },
    { months: 36,  label: '3 anos'  },
    { months: 60,  label: '5 anos'  },
    { months: 84,  label: '7 anos'  },
    { months: 120, label: '10 anos' },
  ]
  // Adicionar prazo do plano se > 120 meses (evitar duplicata)
  const horizons = (planTermMonths && planTermMonths > 120)
    ? [...baseHorizons, { months: planTermMonths, label: `${Math.round(planTermMonths / 12)} anos (plano)` }]
    : baseHorizons
  return (
    <PathCard
      emoji={PATH_ICONS.cash_saving}
      title={path.label}
      subtitle={path.description ?? 'Guardar mensalmente até atingir o valor total — sem juros, sem dívida'}
    >
      {sobra > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {horizons.map(({ months, label }) => {
            const em      = safeMonthly * months
            const reached = em >= target
            const need    = target / months
            const gap     = need - safeMonthly
            const status: GoalStatus =
              safeMonthly <= 0 ? 'dificil' :
              gap <= 0         ? 'confortavel' :
              gap / need <= 0.30 ? 'possivel' : 'dificil'
            const meta = GOAL_STATUS_META[status]
            return (
              <div key={months} style={{
                background: reached ? C.greenBg : meta.bg,
                borderRadius: 10, padding: '10px 12px',
                border: reached ? `0.5px solid ${C.greenDark}30` : 'none',
                gridColumn: months === 120 ? '1 / -1' : undefined,
              }}>
                <p style={{ margin: '0 0 2px', fontSize: 10, color: reached ? C.greenDark : meta.color, fontWeight: 500 }}>
                  {label}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: reached ? C.greenDark : meta.color }}>
                  {fmtBRL(em)}
                </p>
                <p style={{ margin: 0, fontSize: 9, color: reached ? C.greenDark : meta.color }}>
                  {reached ? '✅ Meta atingida!' : meta.label}
                </p>
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
          Ajuste suas despesas para liberar uma sobra mensal e ver a simulação.
        </p>
      )}
    </PathCard>
  )
}

function renderInvestmentCard(path: DreamPathSetting, ctx: CardCtx): ReactNode {
  const { target, safeMonthly, sobra, planTermMonths } = ctx
  const annual     = path.annual_return_rate ?? 0.12
  const mRate      = annualToMonthlyRate(annual)
  const annualPct  = Math.round(annual * 100)
  const termMonths = path.term_months ?? 48
  // Incluir planTermMonths para comparação com prazo do consórcio/financiamento
  const rawH   = planTermMonths
    ? [12, 36, termMonths, planTermMonths]
    : [12, 24, 36, termMonths]
  const horizons = rawH.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).slice(0, 5)

  return (
    <PathCard
      emoji={PATH_ICONS.investment}
      title={path.label}
      subtitle={path.description ?? `Investimento com projeção a ${annualPct}% a.a. — rendimento não garantido`}
    >
      {sobra > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {horizons.map(months => {
              const totalInvested = safeMonthly * months
              const fv      = futureValue(safeMonthly, months, mRate)
              const gain    = fv - totalInvested
              const reached = fv >= target
              const yrs     = months / 12
              const lbl     = Number.isInteger(yrs) ? `${yrs} ${yrs === 1 ? 'ano' : 'anos'}` : `${months}m`
              return (
                <div key={months} style={{
                  background: reached ? C.greenBg : C.purpleBg,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <p style={{ margin: '0 0 2px', fontSize: 10, color: reached ? C.greenDark : C.purpleDeep, fontWeight: 500 }}>
                    {lbl}
                  </p>
                  <p style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 700, color: reached ? C.greenDark : C.purpleDeep }}>
                    {fmtBRL(fv)}
                  </p>
                  <p style={{ margin: '0 0 1px', fontSize: 9, color: reached ? C.greenDark : C.purpleDeep }}>
                    Aportado: {fmtBRL(totalInvested)}
                  </p>
                  {path.show_capital_gain && gain > 0 && (
                    <p style={{ margin: 0, fontSize: 9, color: reached ? C.greenDark : C.purpleDeep }}>
                      +{fmtBRL(gain)} estimado
                    </p>
                  )}
                  {reached && <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>✅ Meta!</p>}
                </div>
              )
            })}
          </div>
          <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
            ⚠️ Simulação a {annualPct}% a.a. Rendimento estimado — não é garantido. Depende da aplicação escolhida.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
          Libere uma sobra mensal para simular o crescimento do investimento.
        </p>
      )}
    </PathCard>
  )
}

function renderFinancingCard(path: DreamPathSetting, ctx: CardCtx, isCdc: boolean): ReactNode {
  const { target, sobra } = ctx
  const termMonths = path.term_months ?? 48
  const mode       = path.calculation_mode ?? null

  const mRate = path.monthly_interest_rate
    ?? (path.annual_interest_rate !== null ? annualToMonthlyRate(path.annual_interest_rate!) : null)

  // BLOCO 2 — calculation_mode
  // formula (ou null com taxa): usar PMT
  // proportional sem taxa / null sem taxa: escalar
  // fixed: usar valor cadastrado exato
  const useFormula = mode === 'formula'
    ? (mRate !== null)
    : (mode === null && mRate !== null)   // backward-compat: usa PMT quando taxa existe

  const baseFull: number | null = useFormula && mRate !== null
    ? Math.round(calcInstallment(target, mRate, termMonths))
    : scaleInstallment(path.full_installment_amount, path.default_amount, target, mode)
  const baseReduced = scaleInstallment(path.reduced_installment_amount, path.default_amount, target, mode)

  // BLOCO 3 — promoção
  const promo           = resolvePromo(path)
  const fullInstallment = promo?.installment !== null && promo !== null
    ? scaleInstallment(promo.installment,         path.default_amount, target, mode)
    : baseFull
  const reducedInstallment = promo?.reducedInstallment !== null && promo !== null
    ? scaleInstallment(promo.reducedInstallment, path.default_amount, target, mode)
    : baseReduced

  const promoFullEconomy    = (promo && fullInstallment !== null    && baseFull    !== null && baseFull    > fullInstallment)    ? baseFull    - fullInstallment    : null
  const promoReducedEconomy = (promo && reducedInstallment !== null && baseReduced !== null && baseReduced > reducedInstallment) ? baseReduced - reducedInstallment : null

  const totalPaid     = fullInstallment !== null ? fullInstallment * termMonths : null
  const financingCost = totalPaid !== null ? totalPaid - target : null
  const annualPct     = path.annual_interest_rate !== null
    ? ` (${Math.round((path.annual_interest_rate ?? 0) * 100)}% a.a.)`
    : ''

  const fullStatus    = evalInstallmentStatus(fullInstallment, sobra)
  const reducedStatus = evalInstallmentStatus(reducedInstallment, sobra)
  const emoji  = isCdc ? PATH_ICONS.cdc : PATH_ICONS.financing
  const defSub = isCdc
    ? 'Crédito direto ao consumidor — sujeito à análise e condições'
    : 'Financiamento com parcelas mensais — sujeito à análise e condições'

  return (
    <PathCard
      emoji={emoji}
      title={path.label}
      subtitle={path.description ?? defSub}
    >
      {/* BLOCO 3 — badge de promoção */}
      {promo && <PromoBadge label={promo.label} endsAt={promo.endsAt} />}

      {fullInstallment !== null && fullStatus !== null && (
        <div style={{ marginBottom: 6 }}>
          <InstallmentRow label={promo ? 'Parcela promocional 🔥' : 'Parcela estimada'} value={fullInstallment} status={fullStatus} />
          {promoFullEconomy !== null && (
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#C2410C' }}>
              <span style={{ textDecoration: 'line-through', color: C.textTer }}>{fmtBRL(baseFull!)}/mês</span>
              {' '}→ 💰 economia de {fmtBRL(promoFullEconomy)}/mês
            </p>
          )}
        </div>
      )}
      {reducedInstallment !== null && reducedStatus !== null && (
        <div style={{ marginBottom: 6 }}>
          <InstallmentRow
            label={promo ? 'Parc. reduzida promo. 🔥' : `Parcela c/ entrada${path.down_payment_percent ? ` (${Math.round(path.down_payment_percent * 100)}%)` : ''}`}
            value={reducedInstallment}
            status={reducedStatus}
          />
          {promoReducedEconomy !== null && (
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#C2410C' }}>
              <span style={{ textDecoration: 'line-through', color: C.textTer }}>{fmtBRL(baseReduced!)}/mês</span>
              {' '}→ 💰 economia de {fmtBRL(promoReducedEconomy)}/mês
            </p>
          )}
        </div>
      )}
      {path.show_total_cost && totalPaid !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div style={{ background: C.bgApp, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textSec, fontWeight: 500 }}>Prazo</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{termMonths} meses</p>
          </div>
          <div style={{ background: C.bgApp, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textSec, fontWeight: 500 }}>Total pago est.</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{fmtBRL(totalPaid)}</p>
          </div>
          {financingCost !== null && financingCost > 0 && (
            <div style={{
              gridColumn: '1 / -1',
              background: C.coralBg, borderRadius: 10, padding: '10px 12px',
              border: `0.5px solid ${C.coral}20`,
            }}>
              <p style={{ margin: '0 0 2px', fontSize: 10, color: C.coralDark, fontWeight: 500 }}>Custo financeiro est.</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.coralDark }}>
                {fmtBRL(financingCost)}{annualPct}
              </p>
            </div>
          )}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
        ⚠️ Simulação inicial. Sujeito à análise de crédito e condições do produto. Sem compromisso de aprovação.
      </p>
    </PathCard>
  )
}

function renderInvestmentPlusCdcCard(path: DreamPathSetting, ctx: CardCtx): ReactNode {
  const { target, targetLabel, safeMonthly, sobra } = ctx
  const accum12    = safeMonthly * 12
  const accum24    = safeMonthly * 24
  const remaining12 = Math.max(0, target - accum12)
  const remaining24 = Math.max(0, target - accum24)

  return (
    <PathCard
      emoji={PATH_ICONS.investment_plus_cdc}
      title={path.label}
      subtitle={path.description ?? 'Acumule uma entrada investindo e financie o saldo com CDC'}
    >
      <div style={{ background: C.purpleBg, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: C.purpleDeep }}>
          💡 Estratégia híbrida
        </p>
        <p style={{ margin: 0, fontSize: 11, color: C.purpleDeep, lineHeight: 1.5 }}>
          Invista por um período para acumular a entrada. Depois use CDC ou financiamento para o saldo restante.
        </p>
      </div>
      {sobra > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div style={{ background: C.bgApp, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
              <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textSec, fontWeight: 500 }}>Acumulado em 1 ano</p>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.text }}>{fmtBRL(accum12)}</p>
              {remaining12 > 0 && <p style={{ margin: 0, fontSize: 9, color: C.textSec }}>Saldo: {fmtBRL(remaining12)}</p>}
              {remaining12 === 0 && <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>✅ Meta!</p>}
            </div>
            <div style={{ background: C.bgApp, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
              <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textSec, fontWeight: 500 }}>Acumulado em 2 anos</p>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.text }}>{fmtBRL(accum24)}</p>
              {remaining24 > 0 && <p style={{ margin: 0, fontSize: 9, color: C.textSec }}>Saldo: {fmtBRL(remaining24)}</p>}
              {remaining24 === 0 && <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>✅ Meta!</p>}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
            ⚠️ Simulação inicial. CDC sujeito à análise. Rendimento do investimento não é garantido.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
          Libere uma sobra mensal para ver quanto você pode acumular para a entrada.
        </p>
      )}
    </PathCard>
  )
}

// =============================================================================
// Carta Contemplada — Oportunidade de venda com ágio
// Usada em consortium_traditional e consortium_with_bid
// Nunca prometer venda, ágio fixo ou contemplação garantida.
// =============================================================================

function CartaContemplacaoBlock({
  credit, installment, premiumPct,
}: {
  credit: number
  installment: number
  premiumPct: number
}): ReactNode {
  const scenarios = [1, 3, 6, 12] as const
  const valorAgio = credit * premiumPct

  return (
    <div style={{
      background: C.greenBg, borderRadius: 12, padding: '12px 14px',
      border: `0.5px solid ${C.greenDark}20`, marginBottom: 8,
    }}>
      <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: C.greenDark }}>
        💡 Se for contemplado — potencial com a venda da carta
      </p>

      {/* Resumo: crédito, ágio e potencial */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>Carta de crédito</p>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: C.greenDark }}>{fmtBRL(credit)}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>
            Ágio médio estimado {Math.round(premiumPct * 100)}%
          </p>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: C.greenDark }}>{fmtBRL(valorAgio)}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>Potencial de recebimento pela venda</p>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: C.greenDark }}>{fmtBRL(valorAgio)}</p>
        </div>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 9, color: C.greenDark, lineHeight: 1.4 }}>
        O comprador assume a carta e as parcelas conforme negociação e regras da administradora.
      </p>

      {/* Cenários: ganho bruto por nº de parcelas pagas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 }}>
        {scenarios.map(n => {
          const totalPago  = installment * n
          const ganhoBruto = valorAgio - totalPago
          const positivo   = ganhoBruto >= 0
          return (
            <div key={n} style={{
              background: '#fff', borderRadius: 8, padding: '6px 4px', textAlign: 'center',
              border: `0.5px solid ${C.greenDark}20`,
            }}>
              <p style={{ margin: '0 0 2px', fontSize: 8, color: C.textSec, fontWeight: 600 }}>
                {n === 1 ? '1 parcela' : `${n} parcelas`}
              </p>
              <p style={{ margin: '0 0 3px', fontSize: 8, color: C.textSec }}>
                pago {fmtBRL(totalPago)}
              </p>
              <p style={{ margin: '0 0 1px', fontSize: 8, color: C.textSec }}>ganho bruto est.</p>
              <p style={{
                margin: 0, fontSize: 10, fontWeight: 800,
                color: positivo ? C.greenDark : C.textSec,
              }}>
                {fmtBRL(ganhoBruto)}
              </p>
            </div>
          )
        })}
      </div>

      <p style={{ margin: 0, fontSize: 9, color: C.greenDark, lineHeight: 1.4 }}>
        ⚠️ Ágio médio estimado — varia com o mercado. Não é garantia de venda nem de valor fixo.
        Requer encontrar comprador. Simulação inicial.
      </p>
    </div>
  )
}

function renderConsortiumTraditionalCard(path: DreamPathSetting, ctx: CardCtx): ReactNode {
  const { target, targetLabel, sobra } = ctx
  const termMonths    = path.term_months ?? 60
  const mode          = path.calculation_mode ?? null

  // BLOCO 2 — calculation_mode
  const baseInstallment = scaleInstallment(path.full_installment_amount,    path.default_amount, target, mode)
  const baseReduced     = scaleInstallment(path.reduced_installment_amount, path.default_amount, target, mode)

  // BLOCO 3 — promoção
  const promo              = resolvePromo(path)
  const installment        = promo?.installment         !== null && promo !== null
    ? scaleInstallment(promo.installment,         path.default_amount, target, mode)
    : baseInstallment
  const reducedInstallment = promo?.reducedInstallment  !== null && promo !== null
    ? scaleInstallment(promo.reducedInstallment,  path.default_amount, target, mode)
    : baseReduced

  const promoEconomy        = (promo && installment        !== null && baseInstallment !== null && baseInstallment > installment)        ? baseInstallment - installment        : null
  const promoReducedEconomy = (promo && reducedInstallment !== null && baseReduced     !== null && baseReduced     > reducedInstallment) ? baseReduced     - reducedInstallment : null

  const totalCost     = installment !== null ? installment * termMonths : null
  const fullStatus    = evalInstallmentStatus(installment, sobra)
  const reducedStatus = evalInstallmentStatus(reducedInstallment, sobra)
  const premiumPct    = path.average_letter_premium_percent ?? null

  return (
    <PathCard
      emoji={PATH_ICONS.consortium_traditional}
      title={path.label}
      subtitle={path.description ?? 'Consórcio sem juros de financiamento — crédito atualizado'}
    >
      {/* BLOCO 3 — badge de promoção */}
      {promo && <PromoBadge label={promo.label} endsAt={promo.endsAt} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>Crédito desejado</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>
            {targetLabel ?? fmtBRL(target)}
          </p>
        </div>
        <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>Prazo estimado</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>{termMonths} meses</p>
        </div>
      </div>
      {installment !== null && fullStatus !== null && (
        <div style={{ marginBottom: 6 }}>
          <InstallmentRow label={promo ? 'Parcela promocional 🔥' : 'Parcela estimada'} value={installment} status={fullStatus} />
          {promoEconomy !== null && (
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#C2410C' }}>
              <span style={{ textDecoration: 'line-through', color: C.textTer }}>{fmtBRL(baseInstallment!)}/mês</span>
              {' '}→ 💰 economia de {fmtBRL(promoEconomy)}/mês
            </p>
          )}
        </div>
      )}
      {reducedInstallment !== null && reducedStatus !== null && (
        <div style={{ marginBottom: 6 }}>
          <InstallmentRow label={promo ? 'Parc. c/ lance promo. 🔥' : 'Parcela c/ lance'} value={reducedInstallment} status={reducedStatus} />
          {promoReducedEconomy !== null && (
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#C2410C' }}>
              <span style={{ textDecoration: 'line-through', color: C.textTer }}>{fmtBRL(baseReduced!)}/mês</span>
              {' '}→ 💰 economia de {fmtBRL(promoReducedEconomy)}/mês
            </p>
          )}
        </div>
      )}
      {path.show_total_cost && totalCost !== null && (
        <div style={{ background: C.bgApp, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}`, marginBottom: 8 }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textSec, fontWeight: 500 }}>Total pago estimado</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{fmtBRL(totalCost)}</p>
        </div>
      )}

      {/* Bloco Carta Contemplada — só exibe se ágio configurado */}
      {premiumPct !== null && installment !== null && (
        <CartaContemplacaoBlock credit={target} installment={installment} premiumPct={premiumPct} />
      )}

      <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
        ⚠️ Simulação inicial. Contemplação não é garantida — depende de sorteio ou lance.
        O crédito contratado pode ser atualizado conforme regra do plano.
      </p>
    </PathCard>
  )
}

function renderConsortiumWithBidCard(path: DreamPathSetting, ctx: CardCtx): ReactNode {
  const { target, targetLabel, sobra } = ctx
  const bidPct         = path.bid_percent ?? 0.25
  const bidAmount      = target * bidPct
  const mode           = path.calculation_mode ?? null

  // BLOCO 2 — calculation_mode
  const baseInstallment = scaleInstallment(path.full_installment_amount, path.default_amount, target, mode)

  // BLOCO 3 — promoção
  const promo           = resolvePromo(path)
  const installment     = promo?.installment !== null && promo !== null
    ? scaleInstallment(promo.installment, path.default_amount, target, mode)
    : baseInstallment
  const promoEconomy    = (promo && installment !== null && baseInstallment !== null && baseInstallment > installment)
    ? baseInstallment - installment : null

  const installmentStatus = evalInstallmentStatus(installment, sobra)
  const premiumPct        = path.average_letter_premium_percent ?? null

  return (
    <PathCard
      emoji={PATH_ICONS.consortium_with_bid}
      title={path.label}
      subtitle={path.description ?? 'Oferte um lance para antecipar sua contemplação'}
    >
      {/* BLOCO 3 — badge de promoção */}
      {promo && <PromoBadge label={promo.label} endsAt={promo.endsAt} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>Crédito desejado</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>
            {targetLabel ?? fmtBRL(target)}
          </p>
        </div>
        <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>
            Lance est. ({Math.round(bidPct * 100)}%)
          </p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>{fmtBRL(bidAmount)}</p>
        </div>
      </div>
      {installment !== null && installmentStatus !== null && (
        <div style={{ marginBottom: 8 }}>
          <InstallmentRow label={promo ? 'Parcela c/ lance promo. 🔥' : 'Parcela est. (c/ lance)'} value={installment} status={installmentStatus} />
          {promoEconomy !== null && (
            <p style={{ margin: '3px 0 0', fontSize: 10, color: '#C2410C' }}>
              <span style={{ textDecoration: 'line-through', color: C.textTer }}>{fmtBRL(baseInstallment!)}/mês</span>
              {' '}→ 💰 economia de {fmtBRL(promoEconomy)}/mês
            </p>
          )}
        </div>
      )}

      {/* Bloco Carta Contemplada — só exibe se ágio configurado */}
      {premiumPct !== null && installment !== null && (
        <CartaContemplacaoBlock credit={target} installment={installment} premiumPct={premiumPct} />
      )}

      <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
        ⚠️ Simulação inicial. Lance não garante contemplação — depende das regras da administradora.
        O crédito contratado pode ser atualizado conforme regra do plano.
      </p>
    </PathCard>
  )
}

function renderConsortiumProgrammedDateCard(path: DreamPathSetting, ctx: CardCtx): ReactNode {
  const { target, targetLabel, sobra, bestMonths } = ctx

  // ── Parâmetros do plano ──────────────────────────────────────────────────────
  const termMonths          = path.term_months                            ?? 60
  const contemMonth         = path.programmed_contemplation_month         ?? 24
  const anticipStartMonth   = path.anticipation_start_month               ?? 6
  const anticipInstallments = path.anticipation_installments              ?? 18
  const requiredPaid        = path.required_paid_installments_for_credit  ?? (anticipStartMonth + anticipInstallments)
  const groupSize           = path.group_size                             ?? null
  const drawsPerMonth       = path.draws_per_month                        ?? null
  const mode                = path.calculation_mode                       ?? null

  // BLOCO 2 — calculation_mode
  const baseInstallment   = scaleInstallment(path.full_installment_amount, path.default_amount, target, mode)

  // BLOCO 3 — promoção
  const promo             = resolvePromo(path)
  const installment       = promo?.installment !== null && promo !== null
    ? scaleInstallment(promo.installment, path.default_amount, target, mode)
    : baseInstallment
  const promoEconomy      = (promo && installment !== null && baseInstallment !== null && baseInstallment > installment)
    ? baseInstallment - installment : null

  const installmentStatus   = evalInstallmentStatus(installment, sobra)

  // ── Fórmulas oficiais do Plano Pontual ───────────────────────────────────────
  // Fase 1 (meses 1–6): pagar normalmente
  // Fase 2 (mês 6): antecipar 18 parcelas → buscar carta no mês 24
  // Total desembolsado para buscar crédito = requiredPaid × parcela (= 24)
  // Saldo restante = (termMonths − requiredPaid) × parcela (= 36 parcelas)
  // Meses restantes = termMonths − anticipStartMonth (= 54)
  // Nova parcela = saldo_restante / meses_restantes
  const paidUntilStart   = installment !== null ? installment * anticipStartMonth    : null
  const anticipationAmt  = installment !== null ? installment * anticipInstallments  : null
  const totalDesembolso  = installment !== null ? installment * requiredPaid         : null
  const saldoRestante    = installment !== null ? installment * (termMonths - requiredPaid) : null
  const mesesRestantes   = termMonths - anticipStartMonth
  const novaParcela      = saldoRestante !== null ? saldoRestante / mesesRestantes   : null

  return (
    <PathCard
      emoji={PATH_ICONS.consortium_programmed_date}
      title={path.label}
      subtitle={path.description ?? `Plano de ${termMonths} meses — contemplação programada no mês ${contemMonth}`}
    >
      {/* BLOCO 3 — badge de promoção */}
      {promo && <PromoBadge label={promo.label} endsAt={promo.endsAt} />}

      {/* Crédito + Prazo total do plano */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>Crédito desejado</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>
            {targetLabel ?? fmtBRL(target)}
          </p>
        </div>
        <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 500 }}>Prazo total do plano</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.amberDark }}>{termMonths} meses</p>
        </div>
      </div>

      {/* Info do grupo */}
      {(groupSize !== null || drawsPerMonth !== null) && (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 8,
        }}>
          {groupSize !== null && (
            <div style={{ flex: 1, background: C.bgApp, borderRadius: 10, padding: '8px 12px', border: `0.5px solid ${C.border}` }}>
              <p style={{ margin: '0 0 1px', fontSize: 9, color: C.textSec, fontWeight: 500 }}>Grupo</p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>{groupSize} participantes</p>
            </div>
          )}
          {drawsPerMonth !== null && (
            <div style={{ flex: 1, background: C.bgApp, borderRadius: 10, padding: '8px 12px', border: `0.5px solid ${C.border}` }}>
              <p style={{ margin: '0 0 1px', fontSize: 9, color: C.textSec, fontWeight: 500 }}>Sorteios</p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>{drawsPerMonth}x por mês</p>
            </div>
          )}
        </div>
      )}

      {/* Parcela estimada (fases 1 e 2) */}
      {installment !== null && installmentStatus !== null && (
        <div style={{ marginBottom: 6 }}>
        <div style={{
          background: C.purpleBg, borderRadius: 10,
          padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ margin: '0 0 1px', fontSize: 10, fontWeight: 600, color: C.purpleDeep }}>
              {promo ? 'Parcela promocional 🔥' : 'Parcela estimada (referência)'}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: C.purpleDeep }}>
              meses 1 a {anticipStartMonth}, depois antecipa {anticipInstallments}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.purpleDeep }}>
            {fmtBRLPlan(installment)}<span style={{ fontSize: 10, fontWeight: 500 }}>/mês</span>
          </p>
        </div>
        {promoEconomy !== null && (
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#C2410C' }}>
            <span style={{ textDecoration: 'line-through', color: C.textTer }}>{fmtBRL(baseInstallment!)}/mês</span>
            {' '}→ 💰 economia de {fmtBRL(promoEconomy)}/mês
          </p>
        )}
        </div>
      )}

      {/* Como funciona — fases */}
      {paidUntilStart !== null && anticipationAmt !== null && totalDesembolso !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div style={{ background: C.bgApp, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
            <p style={{ margin: '0 0 2px', fontSize: 9, color: C.textSec, fontWeight: 500 }}>
              Pago nos {anticipStartMonth} primeiros meses
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
              {fmtBRL(paidUntilStart)}
            </p>
          </div>
          <div style={{ background: C.bgApp, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
            <p style={{ margin: '0 0 2px', fontSize: 9, color: C.textSec, fontWeight: 500 }}>
              Antecipação de {anticipInstallments} parcelas
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
              {fmtBRL(anticipationAmt)}
            </p>
          </div>

          {/* Total desembolsado para buscar o crédito */}
          <div style={{
            gridColumn: '1 / -1',
            background: C.greenBg, borderRadius: 10, padding: '10px 12px',
            border: `0.5px solid ${C.greenDark}20`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 9, fontWeight: 600, color: C.greenDark }}>
                Total para buscar a carta (mês {contemMonth})
              </p>
              <p style={{ margin: 0, fontSize: 9, color: C.greenDark }}>
                {anticipStartMonth} normais + {anticipInstallments} antecipadas = {requiredPaid} parcelas
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.greenDark }}>
              {fmtBRL(totalDesembolso)}
            </p>
          </div>
        </div>
      )}

      {/* Após a contemplação — nova parcela */}
      {novaParcela !== null && saldoRestante !== null && (
        <div style={{
          background: C.bgApp, borderRadius: 10, padding: '10px 12px',
          border: `0.5px solid ${C.border}`, marginBottom: 8,
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.text }}>
            📋 Após buscar o crédito (meses {contemMonth + 1}–{termMonths})
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 9, color: C.textSec }}>
                Saldo restante ({termMonths - requiredPaid} parcelas em {mesesRestantes} meses)
              </p>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.textSec }}>
                {fmtBRL(saldoRestante)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 1px', fontSize: 9, color: C.textSec }}>Nova parcela est.</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
                {fmtBRLPlan(novaParcela)}<span style={{ fontSize: 9, fontWeight: 500 }}>/mês</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comparação com poupança direta */}
      {bestMonths !== null && (
        <div style={{ background: C.purpleBg, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: C.purpleDeep }}>
            📊 Comparação com juntar sozinho
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 9, color: C.purpleDeep }}>Poupança direta</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>{bestMonths} meses</p>
            </div>
            <span style={{ fontSize: 14, color: C.purpleDeep }}>→</span>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 1px', fontSize: 9, color: C.purpleDeep }}>Plano Pontual</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>crédito no mês {contemMonth}</p>
            </div>
          </div>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
        ⚠️ Simulação inicial. Contemplação programada conforme regra do plano — valores sujeitos
        à correção conforme contrato. Condições dependem da administradora e do produto.
        Sorteio mensal. Não há garantia de contemplação.
      </p>
    </PathCard>
  )
}
