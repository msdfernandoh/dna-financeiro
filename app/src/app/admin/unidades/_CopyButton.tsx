'use client'

// Botão simples para copiar texto para a área de transferência.
// Exibe "Copiado!" por 1.5 s após o clique.

import { useState } from 'react'
import { C } from '@/app/components/ui'

interface Props {
  text: string
  label?: string
}

export function CopyButton({ text, label = 'Copiar' }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback silencioso
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 7,
        padding: '3px 9px',
        fontSize: 11,
        cursor: 'pointer',
        background: copied ? C.greenBg : '#fff',
        color:      copied ? C.greenDark : C.textSec,
        fontFamily: 'inherit',
        fontWeight: 500,
        transition: 'all .2s',
        flexShrink: 0,
      }}
    >
      {copied ? '✓ Copiado' : label}
    </button>
  )
}
