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

import type { ReactNode } from 'react'
import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import {
  calculateDreamPlan, fmtBRLPlan, formatDreamSubtype,
  GOAL_STATUS_META, INSTALLMENT_STATUS_META,
  type PlanSettings, type GoalStatus, type InstallmentStatus,
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

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const income   = lead!.monthly_income   ?? 0
  const expenses = lead!.monthly_expenses ?? 0
  const sobra    = income - expenses

  const dreamInfo   = primaryDream ? (DREAMS[primaryDream.dream_type] ?? DREAMS.outro) : null
  const plan        = primaryDream ? calculateDreamPlan(primaryDream.target_amount, sobra, planSettings) : null
  const isConsorcio = primaryDream ? CONSORCIAVEL.has(primaryDream.dream_type) : false

  // Linhas "guardar à vista"
  const savingRows: { months: number; em: number; status: GoalStatus }[] = plan ? [
    { months: 12, em: plan.em12, status: plan.status12 },
    { months: 24, em: plan.em24, status: plan.status24 },
    { months: 36, em: plan.em36, status: plan.status36 },
    { months: 60, em: plan.em60, status: plan.status60 },
  ] : []

  // Linhas "investir mensalmente" (juros compostos 1%/mês)
  const safeMonthly = sobra > 0 ? sobra : 0
  const compoundRows: { months: number; fv: number }[] = plan ? [
    { months: 12, fv: compoundFV(safeMonthly, 12) },
    { months: 24, fv: compoundFV(safeMonthly, 24) },
    { months: 36, fv: compoundFV(safeMonthly, 36) },
    { months: 60, fv: compoundFV(safeMonthly, 60) },
  ] : []

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
              border: `0.5px dashed ${C.border}`,
              padding: '36px 20px', marginBottom: 16, textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 36 }}>⭐</p>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: C.text }}>
                Você ainda não definiu seu sonho
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
                Complete o diagnóstico DNA e descubra qual caminho faz mais sentido para você.
              </p>
              <a href={`/${unitSlug}/dna`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: C.amber, color: '#fff',
                borderRadius: 14, padding: '14px 24px',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}>
                🧬 Definir meu sonho agora →
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

              {/* Parcela sugerida (quando há planSettings) */}
              {plan.hasPlanSettings && (plan.reducedInstallment !== null || plan.fullInstallment !== null) && (
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
            </div>

            {/* ── PARTE C: Comparativo de caminhos ── */}
            <p style={{ margin: '4px 0 10px', fontSize: 13, fontWeight: 700, color: C.text }}>
              📊 Comparativo de caminhos
            </p>

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

            {/* Card 3: Plano com parcela (quando há planSettings) */}
            {plan.hasPlanSettings && (
              <PathCard
                emoji="📋"
                title="Plano com parcela"
                subtitle={`Plano sugerido para ${dreamInfo.label.toLowerCase()}`}
              >
                {plan.suggestedTerm && (
                  <div style={{
                    background: C.purpleBg, borderRadius: 10,
                    padding: '10px 12px', marginBottom: 8,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: C.purpleDeep, fontWeight: 600 }}>
                      📅 Prazo sugerido: {plan.suggestedTerm} meses
                    </p>
                  </div>
                )}
                {plan.fullInstallment !== null && plan.fullInstallmentStatus !== null && (
                  <div style={{ marginBottom: 6 }}>
                    <InstallmentRow
                      label="Parcela padrão"
                      value={plan.fullInstallment}
                      status={plan.fullInstallmentStatus}
                    />
                  </div>
                )}
                {plan.reducedInstallment !== null && plan.reducedInstallmentStatus !== null && (
                  <div style={{ marginBottom: 8 }}>
                    <InstallmentRow
                      label="Parcela reduzida"
                      value={plan.reducedInstallment}
                      status={plan.reducedInstallmentStatus}
                    />
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 10, color: C.textTer, lineHeight: 1.5 }}>
                  ⚠️ Simulação inicial. Condições sujeitas a análise. Sem compromisso de aprovação.
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
                {plan.hasPlanSettings ? (
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
                      Simulação detalhada em breve
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: C.amberDark, lineHeight: 1.5 }}>
                      Carta de crédito estimada:{' '}
                      {primaryDream.target_label ?? fmtBRL(primaryDream.target_amount)}
                    </p>
                  </div>
                )}
              </PathCard>
            )}

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
