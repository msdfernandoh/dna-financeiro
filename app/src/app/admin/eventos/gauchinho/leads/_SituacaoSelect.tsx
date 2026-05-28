'use client'

import { useState } from 'react'

// ── Tipos e constantes ────────────────────────────────────────────────────────

type Situacao =
  | 'enviar_proposta'
  | 'proposta_enviada'
  | 'aguardando_documentacao'
  | 'documentacao_enviada'
  | 'aprovado'

const OPTIONS: { value: Situacao; label: string; bg: string; color: string }[] = [
  { value: 'enviar_proposta',         label: 'Enviar proposta',          bg: '#FAEEDA', color: '#854F0B' },
  { value: 'proposta_enviada',        label: 'Proposta enviada',         bg: '#EEEDFE', color: '#534AB7' },
  { value: 'aguardando_documentacao', label: 'Aguardando documentação',  bg: '#FAECE7', color: '#993C1D' },
  { value: 'documentacao_enviada',    label: 'Documentação enviada',     bg: '#E1F5EE', color: '#0F6E56' },
  { value: 'aprovado',                label: 'Aprovado ✓',              bg: '#D1FAE5', color: '#065F46' },
]

function optionOf(v: string): typeof OPTIONS[0] {
  return OPTIONS.find(o => o.value === v) ?? OPTIONS[0]
}

// ── Componente ────────────────────────────────────────────────────────────────

export function SituacaoSelect({ leadId, initial }: { leadId: string; initial: string }) {
  const [situacao, setSituacao]   = useState<string>(initial || 'enviar_proposta')
  const [saving, setSaving]       = useState(false)
  const [flash, setFlash]         = useState<'ok' | 'err' | null>(null)

  async function onChange(e: { target: { value: string } }) {
    const next = e.target.value
    setSituacao(next)
    setSaving(true)
    setFlash(null)

    try {
      const res = await fetch(`/api/admin/eventos/gauchinho/leads/${leadId}/situacao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situacao: next }),
      })
      setFlash(res.ok ? 'ok' : 'err')
    } catch {
      setFlash('err')
    } finally {
      setSaving(false)
      setTimeout(() => setFlash(null), 2000)
    }
  }

  const opt = optionOf(situacao)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        value={situacao}
        onChange={onChange}
        disabled={saving}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: opt.bg,
          color: opt.color,
          border: `1px solid ${opt.color}40`,
          borderRadius: 8,
          padding: '4px 24px 4px 8px',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: saving ? 'wait' : 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23${opt.color.replace('#', '')}' /%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
          minWidth: 160,
          opacity: saving ? 0.7 : 1,
        }}
      >
        {OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {flash === 'ok'  && <span style={{ fontSize: 11, color: '#0F6E56' }}>✓</span>}
      {flash === 'err' && <span style={{ fontSize: 11, color: '#993C1D' }}>✗</span>}
      {saving          && <span style={{ fontSize: 10, color: '#888' }}>…</span>}
    </div>
  )
}
