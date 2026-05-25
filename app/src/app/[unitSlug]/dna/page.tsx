import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { saveDnaAnswers } from '@/lib/actions'
import { C } from '@/app/components/ui'
import { DnaForm } from './DnaForm'
import { LeadBottomNav } from '@/app/components/LeadBottomNav'
import type { DnaAnswerRecord } from '@/types/database'

interface Props {
  params:       Promise<{ unitSlug: string }>
  searchParams: Promise<{ etapa?: string; dna?: string; saved?: string; concluido?: string }>
}

export default async function DnaPage({ params, searchParams }: Props) {
  const { unitSlug }                        = await params
  const { etapa: etapaRaw, saved, concluido } = await searchParams

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

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 80px' }}>

        {concluido === '1' ? (

          /* ── PARTE E — Tela de conclusão ── */
          <div style={{ textAlign: 'center', paddingTop: 12 }}>

            {/* Celebração */}
            <div style={{ fontSize: 64, marginBottom: 10, lineHeight: 1 }}>🎉</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 6px', lineHeight: 1.3 }}>
              Parabéns, {firstName}!
            </h1>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.purple, margin: '0 0 8px' }}>
              Seu DNA Financeiro está completo!
            </p>
            <p style={{
              fontSize: 13, color: C.textSec, margin: '0 0 24px', lineHeight: 1.65,
              maxWidth: 320, marginInline: 'auto',
            }}>
              Agora conseguimos gerar um relatório mais completo sobre sua realidade,
              seus pontos fortes, pontos de atenção e próximos passos.
            </p>

            {/* Cards de benefícios desbloqueados */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24, textAlign: 'left' }}>
              {[
                { emoji: '🧬', title: 'Diagnóstico completo',  desc: 'Perfil financeiro baseado nas suas respostas' },
                { emoji: '📋', title: 'Relatório liberado',     desc: 'Análise completa e personalizada para você' },
                { emoji: '🎯', title: 'Oportunidades',          desc: 'Sugestões compatíveis com sua realidade' },
                { emoji: '🗺️', title: 'Plano financeiro',       desc: 'Próximos passos certeiros para sua meta' },
              ].map(card => (
                <div key={card.emoji} style={{
                  background: '#fff', borderRadius: 16, padding: '14px 12px',
                  border: `0.5px solid ${C.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{card.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: 10, color: C.textSec, lineHeight: 1.45 }}>
                    {card.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href={`/${unitSlug}/relatorio`} style={{
                display: 'block', background: C.purple, color: '#fff',
                borderRadius: 14, padding: '16px',
                fontSize: 15, fontWeight: 700, textDecoration: 'none',
                textAlign: 'center', letterSpacing: 0.2,
                boxShadow: `0 4px 18px ${C.purple}40`,
              }}>
                📋 Ver meu relatório
              </a>
              <a href={`/${unitSlug}/painel`} style={{
                display: 'block', background: '#fff', color: C.text,
                border: `1px solid ${C.border}`, borderRadius: 14,
                padding: '14px', fontSize: 13, fontWeight: 500,
                textDecoration: 'none', textAlign: 'center',
              }}>
                ← Voltar ao painel
              </a>
            </div>
          </div>

        ) : (
          <>
            {/* ── PARTE A — Card hero de progresso ── */}
            <div style={{
              background: `linear-gradient(135deg, ${C.purpleBg} 0%, #fff 100%)`,
              borderRadius: 18, border: `0.5px solid ${C.purple}20`,
              padding: '16px 18px', marginBottom: 18,
            }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: C.textSec, fontWeight: 500 }}>
                Complete aos poucos e receba um plano cada vez mais inteligente.
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800, color: C.text }}>
                Meu DNA Financeiro
              </p>

              {/* Barra de progresso */}
              <div style={{ background: C.bgSecondary, borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: lead.dna_progress >= 100
                    ? C.green
                    : `linear-gradient(90deg, ${C.purple}, ${C.purpleDeep})`,
                  width: `${Math.max(lead.dna_progress, 2)}%`,
                  transition: 'width .5s',
                }} />
              </div>

              {/* Legenda */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 11, color: C.textSec, lineHeight: 1.45, flex: 1 }}>
                  {lead.dna_progress === 0
                    ? '👋 Você está começando a construir seu diagnóstico.'
                    : lead.dna_progress <= 30
                    ? '📊 Seu consultor já entende melhor sua realidade.'
                    : lead.dna_progress <= 60
                    ? '🚀 Falta pouco para liberar seu relatório completo.'
                    : lead.dna_progress < 100
                    ? '⭐ Quase lá! Complete para o diagnóstico perfeito.'
                    : '🎉 Seu DNA está completo. Seu relatório está pronto!'}
                </p>
                <span style={{
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  color: lead.dna_progress >= 100 ? C.greenDark : C.purpleDeep,
                  background: lead.dna_progress >= 100 ? C.greenBg : C.purpleBg,
                  borderRadius: 99, padding: '5px 11px',
                }}>
                  {lead.dna_progress}%
                </span>
              </div>
            </div>

            <DnaForm
              unitSlug={unitSlug}
              initialStage={initialStage}
              existingAnswers={existingAnswers}
              saveDnaAction={saveDnaAction}
              leadDnaStage={lead.dna_stage}
              showSavedBanner={saved === '1'}
            />
          </>
        )}

      </main>

      <LeadBottomNav unitSlug={unitSlug} />
    </div>
  )
}
