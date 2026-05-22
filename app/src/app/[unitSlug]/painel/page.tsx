import type { CSSProperties } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { DailyQuestion } from './DailyQuestion'

// ── Categorias de despesa ─────────────────────────────────────────────────────

const EXPENSE_CATS: Record<string, { emoji: string; label: string }> = {
  alimentacao: { emoji: '🍽️', label: 'Alimentação' },
  mercado:     { emoji: '🛒', label: 'Mercado' },
  transporte:  { emoji: '🚗', label: 'Transporte' },
  saude:       { emoji: '💊', label: 'Saúde' },
  educacao:    { emoji: '📚', label: 'Educação' },
  lazer:       { emoji: '🎮', label: 'Lazer' },
  dividas:     { emoji: '💳', label: 'Dívidas' },
  contas:      { emoji: '📄', label: 'Contas fixas' },
  outros:      { emoji: '📦', label: 'Outros' },
}

// ── Sonhos ────────────────────────────────────────────────────────────────────

const DREAMS: Record<string, { label: string; emoji: string }> = {
  carro:     { label: 'Carro próprio',         emoji: '🚗' },
  casa:      { label: 'Casa própria',          emoji: '🏠' },
  negocio:   { label: 'Negócio próprio',       emoji: '🏪' },
  viagem:    { label: 'Viagem dos sonhos',      emoji: '✈️' },
  reserva:   { label: 'Reserva de emergência', emoji: '🐷' },
  faculdade: { label: 'Faculdade',              emoji: '🎓' },
  reforma:   { label: 'Reforma da casa',        emoji: '🔨' },
  dividas:   { label: 'Quitar dívidas',         emoji: '💳' },
  moto:      { label: 'Moto',                   emoji: '🏍️' },
  outro:     { label: 'Outro sonho',            emoji: '⭐' },
}

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function initials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function PainelPage({ params }: Props) {
  const { unitSlug } = await params

  // 1. Cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  // 2. Decodificar token → lead_id
  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 3. Buscar lead — valida unit_slug (impede cross-unit)
  let lead: {
    name: string
    main_dream: string | null
    monthly_income: number | null
    monthly_expenses: number | null
    city: string | null
    dna_progress: number | null
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('leads')
      .select('name, main_dream, monthly_income, monthly_expenses, city, dna_progress')
      .eq('id', leadId)
      .eq('unit_slug', unitSlug)
      .is('deleted_at', null)
      .single()

    if (error || !data) redirect(`/${unitSlug}`)
    lead = data
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 4. Cálculos financeiros
  const income       = lead.monthly_income   ?? 0
  const expenses     = lead.monthly_expenses ?? 0
  const sobra        = income - expenses
  const limiteDiario = sobra > 0 ? sobra / 30 : 0
  const dnaProgress  = lead.dna_progress ?? 0

  const dream     = lead.main_dream ?? 'outro'
  const dreamInfo = DREAMS[dream] ?? DREAMS.outro
  const firstName = lead.name.split(' ')[0]
  const avatar    = initials(lead.name)

  // 5. Buscar despesas recentes (não falha se tabela estiver vazia)
  const today = new Date().toISOString().split('T')[0]
  let recentExpenses: { amount: number; category: string; description: string | null; expense_date: string }[] = []
  let todayTotal = 0
  try {
    const supabase2 = createServerSupabaseClient()
    const { data: expData } = await supabase2
      .from('expenses')
      .select('amount, category, description, expense_date')
      .eq('lead_id', leadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(3)
    recentExpenses = expData ?? []
    todayTotal = recentExpenses
      .filter(e => e.expense_date === today)
      .reduce((sum, e) => sum + e.amount, 0)
  } catch { /* silently ignore */ }

  // Saudação por hora do servidor
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: C.purpleBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>🧬</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: C.textSec }}>{lead.city ?? unitSlug}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: C.purple, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>{avatar}</div>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 48px' }}>

        {/* ── Saudação ── */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 2px' }}>{greeting} ☀️</p>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: 0 }}>
            {firstName}!
          </h1>
        </div>

        {/* ── DNA Progress ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, color: C.purple }}>🧬</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>DNA Financeiro</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.purple }}>{dnaProgress}%</span>
          </div>
          <div style={{ background: C.bgSecondary, borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              background: C.purple, height: '100%', borderRadius: 99,
              width: `${Math.max(dnaProgress, 3)}%`, transition: 'width 0.5s',
            }} />
          </div>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
            Complete mais informações para receber dicas melhores.
          </p>
        </div>

        {/* ── Resumo financeiro — 4 cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <FinCard label="Renda aproximada" value={fmtBRL(income)} />
          <FinCard label="Despesas" value={fmtBRL(expenses)} valueColor={expenses > income ? C.coral : C.text} />
          <FinCard
            label="Sobra mensal"
            value={fmtBRL(sobra)}
            valueColor={sobra >= 0 ? C.green : C.coral}
            bg={sobra >= 0 ? C.greenBg : C.coralBg}
          />
          <FinCard
            label="Limite por dia"
            value={limiteDiario > 0 ? fmtBRL(limiteDiario) : '—'}
            valueColor={C.purple}
          />
        </div>

        {/* ── Sonho principal ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              background: C.amberBg, borderRadius: 10,
              width: 36, height: 36, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>{dreamInfo.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Seu sonho principal</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: '2px 0 0' }}>
                {dreamInfo.label}
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Faltam</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.amberDark, margin: 0 }}>
                definir meta
              </p>
            </div>
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.06)', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 5,
          }}>
            <div style={{ background: C.amber, height: '100%', borderRadius: 99, width: '5%' }} />
          </div>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
            Diagnóstico iniciado — próximo passo: definir sua meta financeira
          </p>
        </div>

        {/* ── Despesas recentes ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Despesas registradas</span>
            {todayTotal > 0 && (
              <span style={{
                background: C.coralBg, color: C.coralDark,
                fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
              }}>Hoje: {fmtBRL(todayTotal)}</span>
            )}
          </div>

          {recentExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 22, margin: '0 0 6px' }}>📭</p>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
                Nenhuma despesa registrada ainda.
              </p>
              <p style={{ fontSize: 11, color: C.textTer, margin: '4px 0 0' }}>
                Lance sua primeira despesa para melhorar seu diagnóstico.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentExpenses.map((exp, i) => {
                const cat = EXPENSE_CATS[exp.category] ?? { emoji: '📦', label: exp.category }
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    paddingBottom: i < recentExpenses.length - 1 ? 8 : 0,
                    borderBottom: i < recentExpenses.length - 1 ? `0.5px solid ${C.border}` : 'none',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, background: C.bgSecondary,
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>{cat.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{cat.label}</p>
                      {exp.description && (
                        <p style={{ fontSize: 11, color: C.textSec, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exp.description}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.coral, flexShrink: 0 }}>
                      -{fmtBRL(exp.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Pergunta do dia (Client Component) ── */}
        <DailyQuestion unitSlug={unitSlug} />

        {/* ── CTA: Lançar despesa ── */}
        <a href={`/${unitSlug}/despesas/nova`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: C.purple, color: '#fff', borderRadius: 14, padding: '16px 20px',
          textDecoration: 'none', fontSize: 15, fontWeight: 500, marginBottom: 10,
          boxShadow: `0 4px 20px ${C.purple}40`,
        }}>
          + Lançar despesa rápida
        </a>

        {/* ── Oportunidade da semana ── */}
        <div style={{
          background: C.green, borderRadius: 16,
          padding: '16px', marginBottom: 10,
        }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.2)', color: '#fff',
            fontSize: 11, padding: '2px 10px', borderRadius: 99, marginBottom: 8,
          }}>Oportunidade da semana</span>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.5, margin: '0 0 10px' }}>
            Palestra gratuita: Como organizar sua vida financeira em 30 dias
          </p>
          <a href={`/${unitSlug}/oportunidades`} style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.2)', color: '#fff',
            borderRadius: 8, padding: '6px 14px',
            fontSize: 12, textDecoration: 'none', fontWeight: 500,
          }}>Ver oportunidades →</a>
        </div>

        {/* ── Conquista desbloqueada ── */}
        <div style={{
          background: C.amberBg, borderRadius: 16,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>🏆</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.amberDark, margin: '0 0 2px' }}>
              Conquista desbloqueada!
            </p>
            <p style={{ fontSize: 12, color: '#854F0B', margin: 0, lineHeight: 1.4 }}>
              Diagnóstico iniciado — Primeiro passo dado 🎉
            </p>
          </div>
          <span style={{
            background: C.amber, color: '#fff',
            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99, flexShrink: 0,
          }}>+50 pts</span>
        </div>

      </main>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function FinCard({ label, value, valueColor = C.text, bg = '#fff' }: {
  label: string; value: string; valueColor?: string; bg?: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 14,
      padding: '12px 14px', border: `0.5px solid ${C.border}`,
    }}>
      <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 500, color: valueColor, margin: 0 }}>{value}</p>
    </div>
  )
}
