'use client'

import { useState } from 'react'
import { C } from '@/app/components/ui'

// =============================================================================
// Botão "Tenho interesse" para a página de detalhe da oportunidade
// Registra interaction_type='interest', source='detalhe'
// unit_id e lead_id resolvidos server-side (cookie dna_lead_token + banco)
// Duplicate interest: servidor retorna 200 com {duplicate:true} — UX não muda
// =============================================================================

interface Props {
  unitSlug:    string
  oppId:       string
  oppType:     string
  oppTitle:    string
  targetDream: string | null
  ctaLabel:    string | null
  secondary?:  boolean         // true = estilo secundário (botão fantasma)
}

export function OppInterestButton({
  unitSlug, oppId, oppType, oppTitle, targetDream, ctaLabel, secondary = false,
}: Props) {
  const [interested, setInterested] = useState(false)
  const [loading,    setLoading]    = useState(false)

  async function handleClick() {
    if (interested || loading) return
    setLoading(true)
    try {
      await fetch(`/api/${unitSlug}/opportunities/interactions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          opportunity_id:    oppId,
          opportunity_type:  oppType,
          opportunity_title: oppTitle,
          interaction_type:  'interest',
          source:            'detalhe',
          target_dream:      targetDream,
          metadata:          { from: 'opp_detail' },
        }),
      })
    } catch { /* silencioso */ }
    setInterested(true)
    setLoading(false)
  }

  if (secondary) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || interested}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: interested ? C.greenBg : C.bgSecondary,
          color: interested ? C.greenDark : C.text,
          border: `0.5px solid ${interested ? C.green : C.border}`,
          borderRadius: 14, padding: '14px 20px',
          fontSize: 14, fontWeight: 500,
          cursor: interested ? 'default' : 'pointer',
          fontFamily: 'inherit', transition: 'all .2s', width: '100%',
        }}
      >
        {interested ? '✓ Interesse registrado' : loading ? '...' : '🔔 Tenho interesse'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || interested}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: interested ? C.greenBg : C.green,
        color: interested ? C.greenDark : '#fff',
        border: interested ? `0.5px solid ${C.green}` : 'none',
        borderRadius: 14, padding: '16px 20px',
        fontSize: 15, fontWeight: 600,
        cursor: interested ? 'default' : 'pointer',
        fontFamily: 'inherit', transition: 'all .2s', width: '100%',
        boxShadow: interested ? 'none' : `0 4px 20px ${C.green}40`,
      }}
    >
      {interested
        ? '✓ Interesse registrado!'
        : loading
          ? '...'
          : (ctaLabel ?? 'Tenho interesse')}
    </button>
  )
}
