// =============================================================================
// /[unitSlug]/sonho/editar — Refinar sonho principal
//
// SEGURANÇA:
//   • lead_id resolvido do cookie — nunca do browser
//   • unit_slug validado contra o banco (cross-unit protection)
//   • Ownership validada no Server Action (id + lead_id + unit_id)
// =============================================================================

import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import { updateDream } from '@/lib/actions'
import { EditDreamForm } from './EditDreamForm'

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function EditarSonhoPage({ params }: Props) {
  const { unitSlug } = await params

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

  // 2. Lead (valida unit_slug)
  const supabase = createServerSupabaseClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('id, unit_id')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (!lead) redirect(`/${unitSlug}`)

  // 3. Sonho principal ativo
  const { data: dream } = await supabase
    .from('dreams')
    .select('id, dream_type, dream_subtype, target_amount, target_label, monthly_contribution, saved_amount')
    .eq('lead_id', lead!.id)
    .eq('unit_id', lead!.unit_id)
    .eq('is_primary', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single()

  // Sem sonho primário ativo → voltar para /sonho
  if (!dream) redirect(`/${unitSlug}/sonho`)

  const boundAction = updateDream.bind(null, unitSlug)

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href={`/${unitSlug}/sonho`} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: C.bgApp, border: `0.5px solid ${C.border}`,
          borderRadius: 8, padding: '6px 10px',
          fontSize: 11, fontWeight: 500, color: C.textSec,
          textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
        }}>← Meu Sonho</a>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>
          ✏️ Refinar sonho
        </p>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 90px' }}>
        <EditDreamForm dream={dream!} unitSlug={unitSlug} updateAction={boundAction} />
      </main>

      <LeadBottomNav unitSlug={unitSlug} />
    </div>
  )
}
