// =============================================================================
// /[unitSlug]/investimentos — "Estou me pagando"
//
// SEGURANÇA:
//   • lead_id resolvido do cookie HttpOnly (dna_lead_token) — nunca do browser
//   • unit_slug validado contra o banco (cross-unit protection)
//   • unit_id e lead_id não chegam ao frontend
//   • investments NUNCA somam com expenses (universos separados)
//   • createInvestment Server Action recebe unitSlug via .bind() — nunca do FormData
// =============================================================================

import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { InvestimentosClient } from './InvestimentosClient'
import { createInvestment, deleteInvestment } from '@/lib/actions'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'

// ── Mapeamento de tipos ───────────────────────────────────────────────────────

const INV_TYPE_INFO: Record<string, { emoji: string; label: string }> = {
  poupanca:            { emoji: '🐷',  label: 'Poupança' },
  reserva_emergencia:  { emoji: '🆘',  label: 'Reserva de Emergência' },
  renda_fixa:          { emoji: '📊',  label: 'Renda Fixa' },
  acoes:               { emoji: '📈',  label: 'Ações' },
  fundos_imobiliarios: { emoji: '🏢',  label: 'Fundos Imobiliários' },
  cripto:              { emoji: '₿',   label: 'Criptomoedas' },
  imovel:              { emoji: '🏠',  label: 'Imóvel' },
  consorcio:           { emoji: '🤝',  label: 'Consórcio' },
  veiculo:             { emoji: '🚗',  label: 'Veículo' },
  previdencia:         { emoji: '🏦',  label: 'Previdência' },
  negocio:             { emoji: '🏪',  label: 'Negócio' },
  curso:               { emoji: '📚',  label: 'Educação' },
  equipamento:         { emoji: '🔧',  label: 'Equipamento' },
  outro:               { emoji: '💰',  label: 'Outro' },
}

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  params:      Promise<{ unitSlug: string }>
  searchParams: Promise<{ novo?: string; editado?: string; excluido?: string }>
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function InvestimentosPage({ params, searchParams }: Props) {
  const { unitSlug }              = await params
  const { novo, editado, excluido } = await searchParams

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

  // 2. Lead — valida unit_slug (cross-unit protection)
  const supabase = createServerSupabaseClient()
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('name, monthly_income, city')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadErr || !lead) redirect(`/${unitSlug}`)

  // 3. Investimentos — lead_id do cookie, nunca do browser
  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = `${today.slice(0, 7)}-01`

  let investments: {
    id:              string
    amount:          number
    investment_type: string
    description:     string | null
    investment_date: string
    is_recurring:    boolean
    current_value:   number | null
    expected_return: number | null
  }[] = []

  try {
    const { data } = await supabase
      .from('investments')
      .select('id, amount, investment_type, description, investment_date, is_recurring, current_value, expected_return')
      .eq('lead_id', leadId!)
      .is('deleted_at', null)
      .order('investment_date', { ascending: false })
      .order('created_at',      { ascending: false })
      .limit(50)
    investments = data ?? []
  } catch { /* silently ignore */ }

  // 4. Estatísticas (investimentos nunca somam com expenses)
  const income            = lead.monthly_income ?? 0
  const investedThisMonth = investments
    .filter(i => i.investment_date >= firstOfMonth)
    .reduce((s, i) => s + i.amount, 0)
  const totalInvested = investments.reduce((s, i) => s + i.amount, 0)
  const investPct     = income > 0 && investedThisMonth > 0
    ? Math.round((investedThisMonth / income) * 100)
    : 0

  // Tipo com maior aporte acumulado
  const typeTotals: Record<string, number> = {}
  for (const inv of investments) {
    typeTotals[inv.investment_type] = (typeTotals[inv.investment_type] ?? 0) + inv.amount
  }
  const topTypeKey  = Object.entries(typeTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topTypeInfo = topTypeKey ? INV_TYPE_INFO[topTypeKey] : null

  // 5. Bind Server Actions (unitSlug injetado pelo servidor — nunca do browser)
  const boundAction       = createInvestment.bind(null, unitSlug)
  const boundDeleteAction = deleteInvestment.bind(null, unitSlug)

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: C.greenBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>💚</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.greenDark }}>Estou me pagando</div>
          <div style={{ fontSize: 11, color: C.textSec }}>{lead.city ?? unitSlug}</div>
        </div>
        <a href={`/${unitSlug}/painel`} style={{
          marginLeft: 'auto', fontSize: 12, color: C.textSec,
          textDecoration: 'none', padding: '5px 10px',
          border: `0.5px solid ${C.border}`, borderRadius: 8,
        }}>← Painel</a>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* ── Título ── */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
            Estou me pagando 💚
          </h1>
          <p style={{ fontSize: 13, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
            Registre o que você separa para construir seu futuro.
          </p>
        </div>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <KpiCard
            emoji="💚"
            label="Investido este mês"
            value={investedThisMonth > 0 ? fmtBRL(investedThisMonth) : '—'}
            valueColor={investedThisMonth > 0 ? C.greenDark : C.textTer}
            bg={investedThisMonth > 0 ? C.greenBg : '#fff'}
          />
          <KpiCard
            emoji="📊"
            label="% da renda investida"
            value={investPct > 0 ? `${investPct}%` : '—'}
            valueColor={investPct >= 20 ? C.greenDark : investPct >= 10 ? C.purpleDeep : investPct > 0 ? C.amberDark : C.textTer}
          />
          <KpiCard
            emoji="🏦"
            label="Total registrado"
            value={totalInvested > 0 ? fmtBRL(totalInvested) : '—'}
            valueColor={C.purpleDeep}
          />
          <KpiCard
            emoji="🎯"
            label="Principal tipo"
            value={topTypeInfo ? `${topTypeInfo.emoji} ${topTypeInfo.label}` : '—'}
            smallValue
          />
        </div>

        {/* ── Banner motivacional (quando há aporte no mês) ── */}
        {investedThisMonth > 0 && (
          <div style={{
            background: `linear-gradient(135deg, ${C.greenBg} 0%, #e8faf0 100%)`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            display: 'flex', gap: 12, alignItems: 'center',
            border: `0.5px solid ${C.greenDark}20`,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
              boxShadow: `0 2px 8px ${C.greenDark}20`,
            }}>🎉</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.greenDark }}>
                Você se pagou este mês!
              </p>
              <p style={{ margin: 0, fontSize: 12, color: C.greenDark, lineHeight: 1.5 }}>
                {fmtBRL(investedThisMonth)} investidos
                {investPct > 0 ? ` · ${investPct}% da sua renda` : ''}.{' '}
                Continue construindo seu futuro. 💪
              </p>
            </div>
          </div>
        )}

        {/* ── Dica quando não há aporte no mês ── */}
        {investedThisMonth === 0 && (
          <div style={{
            background: C.amberBg, borderRadius: 14, padding: '12px 14px', marginBottom: 16,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: C.amberDark }}>
                Pagar a si mesmo é prioridade
              </p>
              <p style={{ margin: 0, fontSize: 11, color: C.amberDark, lineHeight: 1.5 }}>
                Antes de pagar as contas, separe algo para você.
                Mesmo R$ 50 por mês já é um passo gigante.
              </p>
            </div>
          </div>
        )}

        {/* ── Client Component: formulário + lista ── */}
        <InvestimentosClient
          unitSlug={unitSlug}
          investments={investments}
          income={income}
          showSuccess={novo     === '1'}
          showEdited={editado  === '1'}
          showDeleted={excluido === '1'}
          createInvestmentAction={boundAction}
          deleteInvestmentAction={boundDeleteAction}
        />

      </main>

      <LeadBottomNav unitSlug={unitSlug} isBusiness={false} />
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  emoji, label, value, valueColor = C.text, bg = '#fff', smallValue = false,
}: {
  emoji: string
  label: string
  value: string
  valueColor?: string
  bg?: string
  smallValue?: boolean
}) {
  return (
    <div style={{
      background: bg, borderRadius: 14,
      padding: '12px 14px', border: `0.5px solid ${C.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 12 }}>{emoji}</span>
        <p style={{ fontSize: 10, color: C.textSec, fontWeight: 500, margin: 0 }}>{label}</p>
      </div>
      <p style={{
        fontSize: smallValue ? 13 : 16, fontWeight: 600, color: valueColor, margin: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </p>
    </div>
  )
}
