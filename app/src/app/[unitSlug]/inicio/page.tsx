// =============================================================================
// Meu Dia Financeiro — /[unitSlug]/inicio
//
// Primeira tela pós-login. Foco em ação imediata: lançar despesa, controlar
// o dia e acompanhar o sonho. Painel completo continua em /painel.
//
// SEGURANÇA:
//   • lead_id e unit_id resolvidos do cookie — nunca do browser
//   • unit_slug validado contra o banco (cross-unit protection)
//   • Dados financeiros nunca expostos ao cliente como estado
// =============================================================================

import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import {
  calculateDreamPlan, fmtBRLPlan, formatDreamSubtype,
  type PlanSettings,
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

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function InicioPage({ params }: Props) {
  const { unitSlug } = await params

  // 1. Cookie → leadId
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 2. Resolver lead (valida unit_slug → cross-unit protection)
  const supabase = createServerSupabaseClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('name, monthly_income, monthly_expenses, main_dream, city, dna_progress, unit_id')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (!lead) redirect(`/${unitSlug}`)

  // 3. Despesas do mês → totais de hoje / semana / mês
  const now          = new Date()
  const todayStr     = now.toISOString().split('T')[0]
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const weekAgo      = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let todayTotal = 0
  let weekTotal  = 0
  let monthTotal = 0
  try {
    const { data: exps } = await supabase
      .from('expenses')
      .select('amount, expense_date')
      .eq('lead_id', leadId!)
      .eq('unit_id', lead!.unit_id)
      .is('deleted_at', null)
      .gte('expense_date', firstOfMonth)
      .limit(200)
    const rows = exps ?? []
    monthTotal = rows.reduce((s, e) => s + e.amount, 0)
    weekTotal  = rows.filter(e => e.expense_date >= weekAgo).reduce((s, e) => s + e.amount, 0)
    todayTotal = rows.filter(e => e.expense_date === todayStr).reduce((s, e) => s + e.amount, 0)
  } catch { /* graceful */ }

  // 4. Investimentos do mês (universo separado — NUNCA soma com expenses)
  let investedMonth = 0
  try {
    const { data: invs } = await supabase
      .from('investments')
      .select('amount')
      .eq('lead_id', leadId!)
      .eq('unit_id', lead!.unit_id)
      .is('deleted_at', null)
      .gte('investment_date', firstOfMonth)
    investedMonth = (invs ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0)
  } catch { /* graceful */ }

  // 5. Sonho primário (graceful — leads antigos podem não ter)
  type PrimaryDream = {
    dream_type:    string
    dream_subtype: string | null
    target_amount: number
    target_label:  string | null
  }
  let primaryDream: PrimaryDream | null = null
  try {
    const { data } = await supabase
      .from('dreams')
      .select('dream_type, dream_subtype, target_amount, target_label')
      .eq('lead_id', leadId!)
      .eq('unit_id', lead!.unit_id)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle()
    primaryDream = data
  } catch { /* graceful */ }

  // 6. PlanSettings (graceful)
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

  // ── Cálculos ─────────────────────────────────────────────────────────────────

  const income      = lead!.monthly_income   ?? 0
  const expenses    = lead!.monthly_expenses ?? 0
  const sobra       = income - expenses
  const limiteDia   = sobra > 0 ? sobra / 30 : 0
  const firstName   = lead!.name.split(' ')[0]
  const dreamKey    = (primaryDream?.dream_type ?? lead!.main_dream) ?? 'outro'
  const dreamInfo   = DREAMS[dreamKey] ?? DREAMS.outro
  const plan        = primaryDream ? calculateDreamPlan(primaryDream.target_amount, sobra, planSettings) : null

  const hour      = now.getHours()
  const greeting  = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Status do dia (simples para o card)
  const overLimit   = limiteDia > 0 && todayTotal > limiteDia
  const dayStatusBg = overLimit ? C.coralBg : C.greenBg
  const dayColor    = overLimit ? C.coralDark : C.greenDark

  // Parcela sugerida (menor valor disponível)
  const parcelaSugerida = plan?.hasPlanSettings
    ? (plan.reducedInstallment ?? plan.fullInstallment)
    : null

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: C.bgApp, minHeight: '100dvh',
    }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.border}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>{greeting} ☀️</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>
            Meu Dia Financeiro
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
            {firstName}
          </span>
          <a href={`/${unitSlug}/painel`} style={{
            background: C.purpleBg, borderRadius: 8,
            padding: '5px 10px', fontSize: 11, fontWeight: 500,
            color: C.purpleDeep, textDecoration: 'none',
          }}>
            Painel →
          </a>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 90px' }}>

        {/* ── Card principal: Lançar despesa ── */}
        <div style={{
          background: `linear-gradient(135deg, ${C.coral} 0%, #B84420 100%)`,
          borderRadius: 20, padding: '20px',
          marginBottom: 12,
          boxShadow: `0 6px 24px ${C.coral}40`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>📅</div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                Lance seus gastos agora
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                Registre em poucos segundos e deixe seu diagnóstico mais inteligente.
              </p>
            </div>
          </div>

          <a href={`/${unitSlug}/despesas/nova`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: '#fff', color: C.coralDark,
            borderRadius: 14, padding: '16px',
            fontSize: 16, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}>
            💸 Lançar despesa agora
          </a>
        </div>

        {/* ── Grid 2×2 de ações ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 8, marginBottom: 12,
        }}>
          {/* Falar despesa (IA beta) */}
          <a href={`/${unitSlug}/despesas/nova`} style={{
            background: '#fff', borderRadius: 16,
            border: `0.5px solid ${C.border}`,
            padding: '16px 14px', textDecoration: 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
            position: 'relative', overflow: 'hidden',
          }}>
            <span style={{ fontSize: 24 }}>🎙️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
              Falar despesa
            </span>
            <span style={{ fontSize: 11, color: C.textSec }}>
              Registre por voz
            </span>
            <span style={{
              position: 'absolute', top: 10, right: 10,
              background: C.purpleBg, color: C.purpleDeep,
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
            }}>IA BETA</span>
          </a>

          {/* Registrar investimento */}
          <a href={`/${unitSlug}/investimentos`} style={{
            background: C.greenBg, borderRadius: 16,
            border: `0.5px solid ${C.greenDark}20`,
            padding: '16px 14px', textDecoration: 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 24 }}>💚</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.greenDark, lineHeight: 1.3 }}>
              Registrar investimento
            </span>
            <span style={{ fontSize: 11, color: C.greenDark }}>
              Me pagar em dia
            </span>
          </a>

          {/* Ver meu sonho */}
          <a href={`/${unitSlug}/sonho`} style={{
            background: C.amberBg, borderRadius: 16,
            border: `0.5px solid ${C.amber}30`,
            padding: '16px 14px', textDecoration: 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 24 }}>🎯</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.amberDark, lineHeight: 1.3 }}>
              Ver meu sonho
            </span>
            <span style={{ fontSize: 11, color: C.amberDark }}>
              Acompanhar meu plano
            </span>
          </a>

          {/* Painel completo */}
          <a href={`/${unitSlug}/painel`} style={{
            background: C.purpleBg, borderRadius: 16,
            border: `0.5px solid ${C.purple}20`,
            padding: '16px 14px', textDecoration: 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 24 }}>📊</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.purpleDeep, lineHeight: 1.3 }}>
              Painel completo
            </span>
            <span style={{ fontSize: 11, color: C.purpleDeep }}>
              Análise detalhada
            </span>
          </a>
        </div>

        {/* ── Resumo do dia — chips compactos ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          border: `0.5px solid ${C.border}`,
          padding: '14px 16px', marginBottom: 12,
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: C.text }}>
            📅 Resumo do dia
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <MetricChip
              label="Hoje"
              value={todayTotal > 0 ? fmtBRL(todayTotal) : '—'}
              color={overLimit ? C.coralDark : C.text}
              bg={overLimit ? C.coralBg : '#fff'}
            />
            <MetricChip label="Semana" value={weekTotal > 0 ? fmtBRL(weekTotal) : '—'} />
            <MetricChip
              label="Mês"
              value={monthTotal > 0 ? fmtBRL(monthTotal) : '—'}
              color={income > 0 && monthTotal > income ? C.coralDark : C.text}
            />
            <MetricChip
              label="Investido"
              value={investedMonth > 0 ? fmtBRL(investedMonth) : '—'}
              color={investedMonth > 0 ? C.greenDark : C.textTer}
              bg={investedMonth > 0 ? C.greenBg : '#fff'}
            />
            <MetricChip
              label="Limite/dia"
              value={limiteDia > 0 ? fmtBRL(limiteDia) : '—'}
              color={limiteDia > 0 ? C.purple : C.textTer}
            />
            <MetricChip
              label="Histórico"
              value="Ver →"
              color={C.purple}
              href={`/${unitSlug}/despesas`}
            />
          </div>
        </div>

        {/* ── Card: Consultor IA ── */}
        <div style={{
          background: `linear-gradient(135deg, ${C.purpleBg} 0%, #E0DEFF 100%)`,
          borderRadius: 16, padding: '16px',
          border: `0.5px solid ${C.purple}20`,
          marginBottom: 12,
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            boxShadow: `0 2px 8px ${C.purple}20`,
          }}>🧬</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>
              Seu consultor financeiro com IA
            </p>
            <p style={{ margin: 0, fontSize: 11, color: C.purpleDeep, lineHeight: 1.6 }}>
              Lance seus gastos, acompanhe seu mês, registre investimentos e receba
              orientações personalizadas para realizar seus objetivos.
            </p>
            {lead!.dna_progress < 100 && (
              <a href={`/${unitSlug}/dna`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 10, background: C.purple, color: '#fff',
                borderRadius: 8, padding: '7px 14px',
                fontSize: 11, fontWeight: 600, textDecoration: 'none',
              }}>
                🧬 Completar DNA ({lead!.dna_progress}%) →
              </a>
            )}
          </div>
        </div>

        {/* ── Card: Sonho em destaque ── */}
        {primaryDream ? (
          <div style={{
            background: '#fff', borderRadius: 16,
            border: `0.5px solid ${C.border}`,
            padding: '16px', marginBottom: 12,
          }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: C.amberBg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>
                {dreamInfo.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>Seu sonho financeiro</p>
                <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: C.text }}>
                  {dreamInfo.label}
                </p>
                {formatDreamSubtype(primaryDream.dream_subtype) && (
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: C.textSec }}>
                    {formatDreamSubtype(primaryDream.dream_subtype)}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 10, color: C.textSec }}>Meta</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: C.amberDark }}>
                  {primaryDream.target_label ?? fmtBRLPlan(primaryDream.target_amount)}
                </p>
              </div>
            </div>

            {/* Prazo mais realista (se houver) */}
            {plan?.bestMonths !== null && plan?.bestMonths !== undefined && (
              <div style={{
                background: C.purpleBg, borderRadius: 10,
                padding: '8px 12px', marginBottom: 12, textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: 11, color: C.purpleDeep }}>
                  Prazo mais realista:{' '}
                  <strong>{plan.bestMonths} meses</strong>
                  {parcelaSugerida !== null && (
                    <span> · Parcela: <strong>{fmtBRL(parcelaSugerida)}/mês</strong></span>
                  )}
                </p>
              </div>
            )}

            {/* CTA grande */}
            <a href={`/${unitSlug}/sonho`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: C.amber, color: '#fff',
              borderRadius: 13, padding: '14px',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              marginBottom: 6,
            }}>
              🎯 Ver caminhos para meu sonho
            </a>
            <a href={`/${unitSlug}/sonho/editar`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#fff', color: C.text,
              borderRadius: 13, padding: '11px',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              border: `0.5px solid ${C.border}`,
            }}>
              ✏️ Refinar meu sonho
            </a>
          </div>
        ) : (
          /* Sonho não cadastrado */
          <div style={{
            background: '#fff', borderRadius: 16,
            border: `0.5px dashed ${C.border}`,
            padding: '16px', marginBottom: 12, textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 22 }}>⭐</p>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: C.text }}>
              Qual é o seu sonho financeiro?
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: C.textSec }}>
              Defina sua meta e veja os caminhos para realizá-la.
            </p>
            <a href={`/${unitSlug}/sonho/trocar`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: C.amber, color: '#fff',
              borderRadius: 12, padding: '12px 20px',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
              marginBottom: 6,
            }}>
              🎯 Criar meu sonho agora
            </a>
            <a href={`/${unitSlug}/dna`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: C.bgApp, color: C.textSec,
              borderRadius: 12, padding: '10px 16px',
              fontSize: 12, fontWeight: 500, textDecoration: 'none',
            }}>
              🧬 Completar meu DNA →
            </a>
          </div>
        )}

      </main>

      <LeadBottomNav unitSlug={unitSlug} />
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function MetricChip({
  label, value, color = C.text, bg = '#fff', href,
}: {
  label: string
  value: string
  color?: string
  bg?: string
  href?: string
}) {
  const style = {
    background: bg, borderRadius: 12,
    padding: '10px 8px', border: `0.5px solid ${C.border}`,
    textAlign: 'center' as const,
    textDecoration: 'none' as const,
    display: 'block',
  }

  const inner = (
    <>
      <p style={{
        fontSize: 9, color: C.textSec, fontWeight: 500, margin: '0 0 3px',
        textTransform: 'uppercase' as const, letterSpacing: '0.4px',
      }}>{label}</p>
      <p style={{
        fontSize: 12, fontWeight: 600, color, margin: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
      }}>{value}</p>
    </>
  )

  if (href) {
    return <a href={href} style={style}>{inner}</a>
  }
  return <div style={style}>{inner}</div>
}
