import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { saveDnaAnswers } from '@/lib/actions'
import { C } from '@/app/components/ui'
import { DnaForm } from './DnaForm'
import type { DnaAnswerRecord } from '@/types/database'

interface Props {
  params:       Promise<{ unitSlug: string }>
  searchParams: Promise<{ etapa?: string; dna?: string }>
}

export default async function DnaPage({ params, searchParams }: Props) {
  const { unitSlug }        = await params
  const { etapa: etapaRaw } = await searchParams

  // ── Sessão ────────────────────────────────────────────────────────────────
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

  // ── Lead ──────────────────────────────────────────────────────────────────
  const supabase = createServerSupabaseClient()

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, name, dna_stage, dna_progress')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) redirect(`/${unitSlug}`)

  // ── Respostas existentes ───────────────────────────────────────────────────
  let existingAnswers: DnaAnswerRecord[] = []
  try {
    const { data } = await supabase
      .from('dna_answers')
      .select('step_key, question_key, answer, answer_type')
      .eq('lead_id', leadId!)
    existingAnswers = data ?? []
  } catch { /* ignora silenciosamente — respostas inexistentes não são erro */ }

  // ── Etapa inicial ─────────────────────────────────────────────────────────
  // Prioridade: ?etapa param → dna_stage do lead → 1
  const etapaParam   = etapaRaw ? parseInt(etapaRaw, 10) : null
  const initialStage = (etapaParam && etapaParam >= 1 && etapaParam <= 6)
    ? etapaParam
    : Math.min(6, Math.max(1, lead.dna_stage))

  // ── Server Action vinculada ────────────────────────────────────────────────
  const saveDnaAction = saveDnaAnswers.bind(null, unitSlug)

  const firstName = lead.name.split(' ')[0]

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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: C.textSec }}>Perfil completo de {firstName}</div>
        </div>
        {/* Progresso geral */}
        <div style={{
          flexShrink: 0, background: C.purpleBg, borderRadius: 99,
          padding: '4px 10px', fontSize: 11, fontWeight: 600, color: C.purpleDeep,
        }}>
          {lead.dna_progress}%
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* Barra de progresso geral */}
        <div style={{
          background: C.purpleBg, borderRadius: 99, height: 4, marginBottom: 20, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 99, background: C.purple,
            width: `${lead.dna_progress}%`, transition: 'width .4s',
          }} />
        </div>

        <DnaForm
          unitSlug={unitSlug}
          initialStage={initialStage}
          existingAnswers={existingAnswers}
          saveDnaAction={saveDnaAction}
          leadDnaStage={lead.dna_stage}
        />

      </main>
    </div>
  )
}
