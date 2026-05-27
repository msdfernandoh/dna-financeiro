// =============================================================================
// Editar Investimento — /[unitSlug]/investimentos/[id]/editar
//
// SEGURANÇA:
//   • lead_id e unit_id resolvidos do cookie + banco — nunca do browser
//   • Valida ownership: WHERE id + lead_id + unit_id + deleted_at IS NULL
//   • updateInvestment vinculado ao unitSlug no servidor
//   • Investments e expenses são universos separados — NUNCA somados
// =============================================================================

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import { updateInvestment } from '@/lib/actions'
import { EditInvestmentForm } from './EditInvestmentForm'

interface Props {
  params: Promise<{ unitSlug: string; id: string }>
}

export default async function EditarInvestimentoPage({ params }: Props) {
  const { unitSlug, id: investmentId } = await params

  // Validar formato do ID antes de qualquer query
  if (!investmentId || !/^[0-9a-f-]{36}$/.test(investmentId)) {
    redirect(`/${unitSlug}/investimentos`)
  }

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

  // 3. Buscar investimento — ownership validada: id + lead_id + unit_id
  const { data: investment } = await supabase
    .from('investments')
    .select('id, amount, investment_type, description, investment_date, is_recurring, current_value, expected_return')
    .eq('id', investmentId)
    .eq('lead_id', lead!.id)         // ← impede acesso cross-lead
    .eq('unit_id', lead!.unit_id)    // ← impede acesso cross-unit
    .is('deleted_at', null)
    .single()

  if (!investment) redirect(`/${unitSlug}/investimentos`)

  // 4. Vincular updateInvestment ao unitSlug
  const boundUpdate = updateInvestment.bind(null, unitSlug)

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href={`/${unitSlug}/investimentos`} style={{
          width: 34, height: 34, borderRadius: 10, background: C.bgApp,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', fontSize: 18, flexShrink: 0,
          border: `0.5px solid ${C.border}`,
        }}>←</a>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>
            ✏️ Editar Investimento
          </p>
          <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
            Altere os dados do aporte
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 90px' }}>
        <EditInvestmentForm
          investment={investment!}
          updateAction={boundUpdate}
          cancelHref={`/${unitSlug}/investimentos`}
        />
      </main>

      <LeadBottomNav unitSlug={unitSlug} isBusiness={false} />
    </div>
  )
}
