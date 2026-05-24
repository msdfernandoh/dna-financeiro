'use client'

// =============================================================================
// PrintReportButton — Botão de geração de PDF via window.print()
// Client Component isolado. Sem query, sem banco, sem alteração de segurança.
// O relatório completo já está renderizado no Server Component pai.
// =============================================================================

import { C } from '@/app/components/ui'

export function PrintReportButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 4,
        width: '100%',
        background: C.purpleBg,
        borderRadius: 14,
        padding: '14px 12px',
        border: `0.5px solid ${C.purple}30`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'opacity .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      <span style={{ fontSize: 18 }}>📄</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.purpleDeep }}>
        Gerar PDF
      </span>
      <span style={{ fontSize: 10, color: C.textSec, lineHeight: 1.3 }}>
        Salvar ou imprimir
      </span>
    </button>
  )
}
