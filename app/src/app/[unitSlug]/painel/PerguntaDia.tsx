'use client'

// =============================================================================
// PerguntaDia — Pergunta inteligente visual do dia
// Apenas visual: nenhuma query, nenhuma alteração de banco.
// Estado local descartado quando o usuário responde.
// =============================================================================

import { useState } from 'react'
import { C } from '@/app/components/ui'

interface Props {
  unitSlug: string
}

export function PerguntaDia({ unitSlug }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      padding: '14px 16px', marginBottom: 8,
      border: `0.5px solid ${C.border}`,
    }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.4 }}>
        💭 Você teve algum gasto fora do previsto hoje?
      </p>
      <div style={{ display: 'flex', gap: 7 }}>
        {/* Sim → lança despesa */}
        <a
          href={`/${unitSlug}/despesas/nova`}
          style={{
            flex: 1, textAlign: 'center', textDecoration: 'none',
            background: C.coralBg, color: C.coralDark,
            borderRadius: 10, padding: '9px 8px',
            fontSize: 12, fontWeight: 700,
          }}
        >
          Sim, lançar →
        </a>

        {/* Não — descarta */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            flex: 1, background: C.greenBg, color: C.greenDark,
            border: 'none', borderRadius: 10, padding: '9px 8px',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Não, ok! ✓
        </button>

        {/* Depois — descarta */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            flex: 1, background: C.bgSecondary, color: C.textSec,
            border: 'none', borderRadius: 10, padding: '9px 8px',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Depois
        </button>
      </div>
    </div>
  )
}
