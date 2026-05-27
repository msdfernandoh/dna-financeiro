// =============================================================================
// /[unitSlug]/sonho/trocar — Trocar sonho principal / ver histórico / novo sonho
//
// SEGURANÇA:
//   • lead_id resolvido do cookie — nunca do browser
//   • unit_slug validado contra o banco (cross-unit protection)
//   • Sonhos anteriores mantidos com is_primary = false (histórico preservado)
// =============================================================================

import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import { setPrimaryDream, createDream } from '@/lib/actions'
import { TrocarSonhoClient } from './TrocarSonhoClient'

interface Props {
  params:      Promise<{ unitSlug: string }>
  searchParams: Promise<{ criado?: string }>
}

export default async function TrocarSonhoPage({ params, searchParams }: Props) {
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

  // 3. Todos os sonhos do lead (não deletados)
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
      .eq('lead_id', lead!.id)
      .eq('unit_id', lead!.unit_id)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at',  { ascending: false })
      .limit(30)
    allDreams = data ?? []
  } catch { /* graceful */ }

  const boundSetPrimary = setPrimaryDream.bind(null, unitSlug)
  const boundCreate     = createDream.bind(null, unitSlug)

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
          🔄 Trocar sonho principal
        </p>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 90px' }}>

        {/* Banner de feedback */}
        {sp.criado === '1' && (
          <div style={{
            background: C.greenBg, borderRadius: 14, padding: '12px 14px',
            marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
            border: `0.5px solid ${C.greenDark}30`,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>✅</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.greenDark }}>Sonho adicionado!</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.greenDark }}>
                Escolha abaixo para torná-lo o seu sonho principal.
              </p>
            </div>
          </div>
        )}

        <TrocarSonhoClient
          unitSlug={unitSlug}
          allDreams={allDreams}
          setPrimaryAction={boundSetPrimary}
          createDreamAction={boundCreate}
        />

      </main>

      <LeadBottomNav unitSlug={unitSlug} />
    </div>
  )
}
