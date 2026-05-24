import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createExpense } from '@/lib/actions'
import { C } from '@/app/components/ui'
import { ExpenseForm } from './ExpenseForm'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function NovaDepesaPage({ params }: Props) {
  const { unitSlug } = await params

  // Verificar sessão — se não houver cookie, redireciona
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) redirect(`/${unitSlug}`)
  } catch {
    redirect(`/${unitSlug}`)
  }

  // Vincular unitSlug ao server action — lead_id e unit_id são resolvidos internamente
  const createExpenseAction = createExpense.bind(null, unitSlug)

  // Data de hoje (servidor) para o campo de data
  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href={`/${unitSlug}/painel`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, background: C.bgSecondary,
          color: C.textSec, textDecoration: 'none', fontSize: 18, flexShrink: 0,
        }}>←</a>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>Lançar despesa</div>
          <div style={{ fontSize: 11, color: C.textSec }}>DNA Financeiro · {unitSlug}</div>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 80px' }}>

        <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 16px', lineHeight: 1.5 }}>
          Registre em poucos segundos para melhorar seu DNA Financeiro.
        </p>

        <ExpenseForm
          unitSlug={unitSlug}
          today={today}
          createExpenseAction={createExpenseAction}
        />

      </main>

      <LeadBottomNav unitSlug={unitSlug} />
    </div>
  )
}
