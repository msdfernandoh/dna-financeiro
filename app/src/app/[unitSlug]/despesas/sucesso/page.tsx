import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  alimentacao: { label: 'Alimentação',  emoji: '🍽️' },
  mercado:     { label: 'Mercado',      emoji: '🛒' },
  transporte:  { label: 'Transporte',   emoji: '🚗' },
  saude:       { label: 'Saúde',        emoji: '💊' },
  educacao:    { label: 'Educação',     emoji: '📚' },
  lazer:       { label: 'Lazer',        emoji: '🎮' },
  dividas:     { label: 'Dívidas',      emoji: '💳' },
  contas:      { label: 'Contas fixas', emoji: '📄' },
  outros:      { label: 'Outros',       emoji: '📦' },
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
}

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function SucessoPage({ params }: Props) {
  const { unitSlug } = await params

  // Verificar sessão
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error()
  } catch {
    redirect(`/${unitSlug}`)
  }

  // Buscar última despesa para mostrar no card de confirmação
  let lastExpense: { amount: number; category: string; description: string | null } | null = null
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from('expenses')
      .select('amount, category, description')
      .eq('lead_id', leadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    lastExpense = data
  } catch { /* se não encontrar, exibe sem detalhes */ }

  const catInfo = lastExpense ? (CATEGORY_LABELS[lastExpense.category] ?? { label: lastExpense.category, emoji: '📦' }) : null

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: C.purpleBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>🧬</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: C.textSec }}>{unitSlug}</div>
        </div>
      </header>

      <main style={{
        maxWidth: 480, margin: '0 auto', padding: '48px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>

        {/* Ícone de sucesso */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: C.greenBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, marginBottom: 20,
          boxShadow: `0 0 0 8px ${C.greenBg}80`,
        }}>✅</div>

        <h1 style={{ fontSize: 22, fontWeight: 600, color: C.text, margin: '0 0 6px', textAlign: 'center' }}>
          Despesa registrada!
        </h1>
        <p style={{ fontSize: 14, color: C.textSec, margin: '0 0 28px', textAlign: 'center', lineHeight: 1.6 }}>
          Seu diagnóstico ficou um pouco mais inteligente. Continue registrando para ter análises cada vez melhores.
        </p>

        {/* Card com detalhes da última despesa */}
        {lastExpense && catInfo && (
          <div style={{
            width: '100%', background: '#fff', borderRadius: 16,
            padding: '16px', border: `0.5px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: C.greenBg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>{catInfo.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 2px' }}>{catInfo.label}</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.green, margin: 0 }}>
                {fmtBRL(lastExpense.amount)}
              </p>
              {lastExpense.description && (
                <p style={{ fontSize: 11, color: C.textTer, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lastExpense.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Recompensa */}
        <div style={{
          width: '100%', background: C.amberBg, borderRadius: 16,
          padding: '14px 16px', marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🏆</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.amberDark, margin: '0 0 2px' }}>
              Conquista desbloqueada!
            </p>
            <p style={{ fontSize: 12, color: '#854F0B', margin: 0 }}>
              Controle ativado — você lançou sua primeira despesa 🎉
            </p>
          </div>
          <span style={{
            marginLeft: 'auto', background: C.amber, color: '#fff',
            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99, flexShrink: 0,
          }}>+100 pts</span>
        </div>

        {/* Botões */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={`/${unitSlug}/painel`} style={{
            display: 'block', textAlign: 'center', textDecoration: 'none',
            background: C.purple, color: '#fff', borderRadius: 14, padding: '15px 20px',
            fontSize: 15, fontWeight: 500,
          }}>
            Voltar ao painel
          </a>
          <a href={`/${unitSlug}/despesas/nova`} style={{
            display: 'block', textAlign: 'center', textDecoration: 'none',
            background: C.purpleBg, color: C.purpleDeep, borderRadius: 14, padding: '15px 20px',
            fontSize: 15, fontWeight: 500,
          }}>
            Lançar outra despesa
          </a>
        </div>

      </main>
    </div>
  )
}
