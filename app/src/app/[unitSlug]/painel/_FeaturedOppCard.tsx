'use client'

import { useState } from 'react'
import { C } from '@/app/components/ui'

// =============================================================================
// Card de oportunidade em destaque no painel
// Registra interação via API quando o lead clica "Tenho interesse"
//
// SEGURANÇA:
//   • unit_id e lead_id NÃO são props — resolvidos server-side pelo cookie
//   • opportunity_id passado apenas se for opp real (não fallback)
//   • source = 'painel' para opps reais, 'fallback' para fallback
// =============================================================================

// Garante protocolo na URL externa
function safeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

interface Props {
  unitSlug:    string
  title:       string
  oppId:       string | null   // null = fallback
  oppType:     string | null
  targetDream: string | null
  isFallback:  boolean
  ctaUrl:      string | null   // link externo configurado no admin
  ctaLabel:    string | null   // label do botão configurado no admin
}

export function FeaturedOppCard({
  unitSlug, title, oppId, oppType, targetDream, isFallback, ctaUrl, ctaLabel,
}: Props) {
  const [interested, setInterested] = useState(false)
  const [loading,    setLoading]    = useState(false)

  async function handleInterest() {
    if (interested || loading) return
    setLoading(true)
    const source = isFallback ? 'fallback' : 'painel'
    try {
      await fetch(`/api/${unitSlug}/opportunities/interactions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          opportunity_id:    oppId,
          opportunity_type:  oppType,
          opportunity_title: title,
          interaction_type:  'interest',
          source,
          target_dream:      targetDream,
          metadata:          { from: 'painel_featured' },
        }),
      })
    } catch { /* silencioso */ }
    setInterested(true)
    setLoading(false)
  }

  const hasLink = !!ctaUrl

  return (
    <div style={{
      background: C.green, borderRadius: 16,
      padding: '16px', marginBottom: 10,
    }}>
      <span style={{
        display: 'inline-block',
        background: 'rgba(255,255,255,0.2)', color: '#fff',
        fontSize: 11, padding: '2px 10px', borderRadius: 99, marginBottom: 8,
      }}>✨ Oportunidade para você</span>

      <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.5, margin: '0 0 12px' }}>
        {title}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

        {/* Botão primário: link externo se tiver, senão "Tenho interesse" */}
        {hasLink ? (
          <a
            href={safeUrl(ctaUrl!)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              // Registra clique mesmo sendo link externo
              void fetch(`/api/${unitSlug}/opportunities/interactions`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                  opportunity_id:   oppId,
                  opportunity_type: oppType,
                  opportunity_title: title,
                  interaction_type: 'click',
                  source: isFallback ? 'fallback' : 'painel',
                  target_dream: targetDream,
                }),
              }).catch(() => {})
            }}
            style={{
              flex: 1, minWidth: 120, textAlign: 'center',
              background: '#fff', color: C.green,
              borderRadius: 10, padding: '9px 14px',
              fontSize: 12, fontWeight: 600,
              textDecoration: 'none', display: 'block',
            }}
          >
            {ctaLabel ?? 'Ver detalhes'} →
          </a>
        ) : (
          <button
            type="button"
            onClick={handleInterest}
            disabled={loading}
            style={{
              flex: 1, textAlign: 'center',
              background: interested ? 'rgba(255,255,255,0.35)' : '#fff',
              color: interested ? '#fff' : C.green,
              borderRadius: 10, padding: '9px 14px',
              fontSize: 12, fontWeight: 600,
              border: 'none', cursor: interested ? 'default' : 'pointer',
              fontFamily: 'inherit', transition: 'all .2s',
            }}
          >
            {interested ? '✓ Interesse registrado' : loading ? '...' : (ctaLabel ?? 'Tenho interesse')}
          </button>
        )}

        {/* Se tem link externo, mostra "Tenho interesse" como secundário */}
        {hasLink && (
          <button
            type="button"
            onClick={handleInterest}
            disabled={loading || interested}
            style={{
              background: interested ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
              color: '#fff', border: 'none',
              borderRadius: 10, padding: '9px 12px',
              fontSize: 11, fontWeight: 500,
              cursor: interested ? 'default' : 'pointer',
              fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap',
            }}
          >
            {interested ? '✓ Interesse' : '🔔 Interesse'}
          </button>
        )}

        {/* Ver todas */}
        <a href={`/${unitSlug}/oportunidades`} style={{
          display: 'flex', alignItems: 'center',
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          borderRadius: 10, padding: '9px 12px',
          fontSize: 11, textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap',
        }}>Ver todas</a>
      </div>
    </div>
  )
}
