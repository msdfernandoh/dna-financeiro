// =============================================================================
// Histórico de Despesas — /[unitSlug]/despesas
//
// SEGURANÇA:
//   • lead_id e unit_id resolvidos do cookie + banco — nunca do browser
//   • unit_slug validado contra o banco (impede cross-unit)
//   • deleteExpense vinculado no servidor (unitSlug pré-fixado)
//   • Apenas despesas do próprio lead são listadas
// =============================================================================

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import { deleteExpense } from '@/lib/actions'
import { DespesasHistoricoClient } from './DespesasHistoricoClient'

// ── Categorias (mapeamento) ───────────────────────────────────────────────────

export const EXPENSE_CATS: Record<string, { emoji: string; label: string }> = {
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

// ── Filtros disponíveis ───────────────────────────────────────────────────────

const FILTROS = [
  { key: 'hoje',   label: 'Hoje' },
  { key: 'semana', label: '7 dias' },
  { key: 'mes',    label: 'Este mês' },
  { key: 'todos',  label: 'Todos' },
] as const

type Filtro = typeof FILTROS[number]['key']

// ── Formatador ────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  params:      Promise<{ unitSlug: string }>
  searchParams: Promise<{ filtro?: string; excluido?: string; editado?: string }>
}

export default async function DespesasPage({ params, searchParams }: Props) {
  const { unitSlug } = await params
  const sp = await searchParams

  const filtro: Filtro = (FILTROS.map(f => f.key) as string[]).includes(sp.filtro ?? '')
    ? (sp.filtro as Filtro)
    : 'mes'

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

  // 2. Resolver lead + unit_id (valida unit_slug → sem cross-unit)
  const supabase = createServerSupabaseClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('id, unit_id')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (!lead) redirect(`/${unitSlug}`)

  // 3. Calcular intervalo de datas pelo filtro
  const today   = new Date()
  const todayStr = today.toISOString().split('T')[0]
  let dateFrom: string | null = null

  if (filtro === 'hoje') {
    dateFrom = todayStr
  } else if (filtro === 'semana') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    dateFrom = d.toISOString().split('T')[0]
  } else if (filtro === 'mes') {
    dateFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  }
  // 'todos' → sem filtro de data

  // 4. Buscar despesas — apenas do próprio lead
  type Expense = {
    id: string
    amount: number
    category: string
    description: string | null
    expense_date: string
  }

  let expenses: Expense[] = []
  try {
    let q = supabase
      .from('expenses')
      .select('id, amount, category, description, expense_date')
      .eq('lead_id', lead!.id)
      .eq('unit_id', lead!.unit_id)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })
      .order('created_at',   { ascending: false })
      .limit(200)

    if (dateFrom) q = q.gte('expense_date', dateFrom)

    const { data } = await q
    expenses = data ?? []
  } catch { /* silently ignore — lista vazia */ }

  // 5. Totais
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // 6. Vincular deleteExpense ao unitSlug (nunca expõe ao browser)
  const boundDelete = deleteExpense.bind(null, unitSlug)

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href={`/${unitSlug}/painel`} style={{
          width: 34, height: 34, borderRadius: 10, background: C.bgApp,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', fontSize: 18, flexShrink: 0,
          border: `0.5px solid ${C.border}`,
        }}>←</a>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>
            💸 Minhas Despesas
          </p>
          <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
            Histórico e controle
          </p>
        </div>
        <a href={`/${unitSlug}/despesas/nova`} style={{
          background: C.coral, color: '#fff',
          borderRadius: 10, padding: '7px 14px',
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          + Lançar
        </a>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 90px' }}>

        {/* ── Banners de feedback ── */}
        {sp.excluido === '1' && (
          <div style={{
            background: C.greenBg, borderRadius: 14, padding: '12px 14px',
            marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
            border: `0.5px solid ${C.greenDark}30`,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>✅</span>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: C.greenDark }}>
                Despesa excluída
              </p>
              <p style={{ margin: 0, fontSize: 11, color: C.greenDark }}>
                O lançamento foi removido com sucesso.
              </p>
            </div>
          </div>
        )}

        {sp.editado === '1' && (
          <div style={{
            background: C.purpleBg, borderRadius: 14, padding: '12px 14px',
            marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
            border: `0.5px solid ${C.purple}30`,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>✏️</span>
            <div>
              <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: C.purple }}>
                Despesa atualizada
              </p>
              <p style={{ margin: 0, fontSize: 11, color: C.purple }}>
                As alterações foram salvas com sucesso.
              </p>
            </div>
          </div>
        )}

        {/* ── Filtros ── */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto',
          paddingBottom: 2,
        }}>
          {FILTROS.map(f => (
            <a
              key={f.key}
              href={`/${unitSlug}/despesas?filtro=${f.key}`}
              style={{
                flexShrink: 0,
                padding: '7px 14px', borderRadius: 99,
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
                background: filtro === f.key ? C.coral : '#fff',
                color:      filtro === f.key ? '#fff' : C.textSec,
                border:     filtro === f.key ? 'none' : `0.5px solid ${C.border}`,
                transition: 'all .15s',
              }}
            >
              {f.label}
            </a>
          ))}
        </div>

        {/* ── Resumo do período ── */}
        {total > 0 && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '12px 16px',
            marginBottom: 12, border: `0.5px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
                {expenses.length} {expenses.length === 1 ? 'lançamento' : 'lançamentos'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textTer }}>
                {FILTROS.find(f => f.key === filtro)?.label}
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.coralDark }}>
              {fmtBRL(total)}
            </p>
          </div>
        )}

        {/* ── Lista com editar/excluir ── */}
        <DespesasHistoricoClient
          unitSlug={unitSlug}
          expenses={expenses}
          deleteAction={boundDelete}
          expenseCats={EXPENSE_CATS}
        />

      </main>

      <LeadBottomNav unitSlug={unitSlug} isBusiness={false} />
    </div>
  )
}
