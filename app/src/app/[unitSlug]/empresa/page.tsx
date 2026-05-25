// =============================================================================
// /[unitSlug]/empresa — DNA Empresarial (5 blocos progressivos)
//
// SEGURANÇA:
//   • lead_id resolvido do cookie HttpOnly — nunca do browser
//   • unit_slug validado contra o banco (impede cross-unit)
//   • isBusiness verificado via dna_answers — leads não-empresariais são redirecionados
//   • unit_id e lead_id não chegam ao Client Component
//   • Dados financeiros sensíveis ficam no banco — só labels chegam ao frontend
// =============================================================================

import { cookies }                       from 'next/headers'
import { redirect }                      from 'next/navigation'
import { createServerSupabaseClient }    from '@/lib/supabase/server'
import { C }                             from '@/app/components/ui'
import { LeadBottomNav }                 from '@/app/components/LeadBottomNav'
import { EmpresaForm }                   from './EmpresaForm'
import type { BusinessProfile }          from '@/types/database'

interface Props {
  params:       Promise<{ unitSlug: string }>
  searchParams: Promise<{ bloco?: string; concluido?: string }>
}

export default async function EmpresaPage({ params, searchParams }: Props) {
  const { unitSlug } = await params
  const sp           = await searchParams

  // ── 1. Cookie → leadId ────────────────────────────────────────────────────
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

  const supabase = createServerSupabaseClient()

  // ── 2. Lead (valida unit_slug → cross-unit protection) ────────────────────
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, unit_id, name, dna_progress')
    .eq('id', leadId!)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadErr || !lead) redirect(`/${unitSlug}`)

  // ── 3. Verificar se é lead empresarial ────────────────────────────────────
  let isBusiness = false
  try {
    const { data: bizAns } = await supabase
      .from('dna_answers')
      .select('answer')
      .eq('lead_id', lead.id)
      .eq('unit_id', lead.unit_id)
      .eq('question_key', 'vinculo_trabalho')
      .single()
    isBusiness = ['empresario', 'pj', 'autonomo'].includes(bizAns?.answer ?? '')
  } catch { /* não resposta = não empresarial */ }

  if (!isBusiness) redirect(`/${unitSlug}/painel`)

  // ── 4. Perfil empresarial existente ───────────────────────────────────────
  let profile: BusinessProfile | null = null
  let bizProgress = 0
  try {
    const { data: bizData } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('unit_id', lead.unit_id)
      .is('deleted_at', null)
      .single()
    profile     = bizData as BusinessProfile | null
    bizProgress = bizData?.biz_dna_progress ?? 0
  } catch { /* sem perfil ainda */ }

  // ── 5. Determinar bloco atual (URL ?bloco=N ou 1) ─────────────────────────
  const rawBloco   = parseInt(sp.bloco ?? '1', 10)
  const currentBlock = isNaN(rawBloco) || rawBloco < 1 || rawBloco > 5 ? 1 : rawBloco
  const concluido  = sp.concluido === '1'

  const firstName = lead.name.split(' ')[0]

  // ── Tela de conclusão ─────────────────────────────────────────────────────
  if (concluido) {
    return (
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>
        <header style={{
          background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <a href={`/${unitSlug}/painel`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8, background: C.bgSecondary,
            color: C.textSec, textDecoration: 'none', fontSize: 18,
          }}>←</a>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>🏢 Minha Empresa</div>
            <div style={{ fontSize: 11, color: C.textSec }}>DNA Empresarial</div>
          </div>
        </header>

        <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px 80px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>
            DNA Empresarial concluído!
          </h1>
          <p style={{ fontSize: 14, color: C.textSec, margin: '0 0 24px', lineHeight: 1.6 }}>
            {firstName}, seu perfil empresarial está completo. Com essas informações, seu consultor poderá apresentar as melhores soluções para o seu negócio.
          </p>
          <div style={{
            background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDeep} 100%)`,
            borderRadius: 18, padding: '20px', marginBottom: 20,
            boxShadow: `0 4px 24px ${C.purple}30`,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              DNA Empresarial 100%
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
              Perfil completo — pronto para análise
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href={`/${unitSlug}/painel`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.purple, color: '#fff', borderRadius: 14, padding: '15px',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}>
              🏠 Ir para o Painel
            </a>
            <a href={`/${unitSlug}/empresa?bloco=1`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.bgSecondary, color: C.textSec, borderRadius: 14, padding: '13px',
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
            }}>
              🔄 Revisar respostas
            </a>
          </div>
        </main>
        <LeadBottomNav unitSlug={unitSlug} isBusiness={true} />
      </div>
    )
  }

  // ── Render principal ──────────────────────────────────────────────────────
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
          <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>🏢 Minha Empresa</div>
          <div style={{ fontSize: 11, color: C.textSec }}>
            {firstName} · DNA Empresarial {bizProgress}%
          </div>
        </div>
        <div style={{
          background: C.purpleBg, color: C.purpleDeep,
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
        }}>
          {bizProgress}%
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 80px' }}>
        <EmpresaForm
          unitSlug={unitSlug}
          currentBlock={currentBlock}
          profile={profile}
          bizProgress={bizProgress}
        />
      </main>

      <LeadBottomNav unitSlug={unitSlug} isBusiness={true} />
    </div>
  )
}
