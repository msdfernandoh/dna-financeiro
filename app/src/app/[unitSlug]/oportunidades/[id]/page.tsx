'use server'

// =============================================================================
// /[unitSlug]/oportunidades/[id] — Detalhe de uma oportunidade real
//
// SEGURANÇA:
//   • lead_id resolvido do cookie HttpOnly (dna_lead_token) — nunca do browser
//   • unit_id resolvido do banco a partir do leadId + unitSlug — nunca do client
//   • Valida unit_slug E unit_id para impedir cross-unit
//   • Apenas oportunidades ativas e dentro do período são exibidas
// =============================================================================

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { OppInterestButton } from './_OppInterestButton'

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

const TYPE_META: Record<string, { label: string; emoji: string; bg: string; color: string }> = {
  event:     { label: 'Evento',    emoji: '📅', bg: C.purpleBg,  color: C.purpleDeep },
  course:    { label: 'Curso',     emoji: '📚', bg: C.greenBg,   color: C.greenDark  },
  challenge: { label: 'Desafio',   emoji: '🏆', bg: C.amberBg,   color: C.amberDark  },
  job:       { label: 'Vaga',      emoji: '💼', bg: '#EDF2FF',   color: '#3B5BDB'    },
  banner:    { label: 'Oferta',    emoji: '🎯', bg: C.coralBg,   color: C.coralDark  },
  partner:   { label: 'Parceiro',  emoji: '🤝', bg: '#F0FFF4',   color: '#276749'    },
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string; id: string }>
}

export default async function OppDetailPage({ params }: Props) {
  const { unitSlug, id } = await params

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
  let unitId: string
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('leads')
      .select('unit_id')
      .eq('id', leadId)
      .eq('unit_slug', unitSlug)
      .is('deleted_at', null)
      .single()
    if (error || !data) redirect(`/${unitSlug}`)
    unitId = data.unit_id
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 4. Buscar oportunidade — valida unit_id E active/período (impede cross-unit + opps inativas)
  const supabase = createServerSupabaseClient()
  const nowIso   = new Date().toISOString()

  const { data: opp, error: oppError } = await supabase
    .from('opportunities')
    .select('id, type, title, description, image_url, cta_url, cta_label, target_dream, active, starts_at, ends_at')
    .eq('id', id)
    .eq('unit_id', unitId)         // ← cross-unit bloqueado aqui
    .eq('active', true)
    .is('deleted_at', null)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .single()

  if (oppError || !opp) notFound()

  const typeMeta = TYPE_META[opp.type] ?? { label: opp.type, emoji: '📌', bg: C.bgSecondary, color: C.textSec }
  const hasLink  = !!opp.cta_url

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.border}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a
          href={`/${unitSlug}/oportunidades`}
          style={{
            width: 34, height: 34, borderRadius: 10, background: C.bgSecondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none', fontSize: 18, color: C.text, flexShrink: 0,
          }}
        >←</a>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>Oportunidade</div>
          <div style={{ fontSize: 11, color: C.textSec }}>Detalhes</div>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 48px' }}>

        {/* ── Badge de tipo ── */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: typeMeta.bg, color: typeMeta.color,
            fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99,
          }}>
            {typeMeta.emoji} {typeMeta.label}
          </span>
        </div>

        {/* ── Imagem (se houver) ── */}
        {opp.image_url && (
          <div style={{
            width: '100%', borderRadius: 16, overflow: 'hidden',
            marginBottom: 14, background: C.bgSecondary,
            maxHeight: 220,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={opp.image_url}
              alt={opp.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        {/* ── Título e descrição ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '16px', marginBottom: 14,
          border: `0.5px solid ${C.border}`,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 10px', lineHeight: 1.4 }}>
            {opp.title}
          </h1>
          {opp.description ? (
            <p style={{ fontSize: 14, color: C.textSec, margin: 0, lineHeight: 1.6 }}>
              {opp.description}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: C.textTer, margin: 0, fontStyle: 'italic' }}>
              Sem descrição disponível.
            </p>
          )}
        </div>

        {/* ── CTAs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Botão principal: link externo ou interesse */}
          {hasLink ? (
            <a
              href={safeUrl(opp.cta_url!)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: C.green, color: '#fff', borderRadius: 14, padding: '16px 20px',
                textDecoration: 'none', fontSize: 15, fontWeight: 600,
                boxShadow: `0 4px 20px ${C.green}40`,
              }}
            >
              {opp.cta_label ?? 'Ver detalhes'} →
            </a>
          ) : (
            <OppInterestButton
              unitSlug={unitSlug}
              oppId={opp.id}
              oppType={opp.type}
              oppTitle={opp.title}
              targetDream={opp.target_dream}
              ctaLabel={opp.cta_label}
            />
          )}

          {/* Se tem link, mostra "Tenho interesse" como secundário */}
          {hasLink && (
            <OppInterestButton
              unitSlug={unitSlug}
              oppId={opp.id}
              oppType={opp.type}
              oppTitle={opp.title}
              targetDream={opp.target_dream}
              ctaLabel={null}
              secondary
            />
          )}

          {/* Voltar */}
          <a
            href={`/${unitSlug}/oportunidades`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.bgSecondary, color: C.text, borderRadius: 14, padding: '14px 20px',
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
            }}
          >
            ← Ver todas as oportunidades
          </a>
        </div>

      </main>
    </div>
  )
}
