'use client'

// =============================================================================
// _DealForm — Formulário para registrar negócio fechado
// Client Component — toggle show/hide + useActionState
// =============================================================================

import { useActionState, useState } from 'react'
import { C } from '@/app/components/ui'
import type { LeadActionResult }    from './actions'

interface Props {
  action: (prev: LeadActionResult | null, fd: FormData) => Promise<LeadActionResult>
}

const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '8px 10px', fontSize: 13,
  fontFamily: 'inherit', color: C.text, background: '#fff',
  outline: 'none',
}

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.textSec, marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: 0.4,
}

const PRODUCT_OPTIONS = [
  { value: '',              label: '— Selecione o produto —' },
  { value: 'consorcio',     label: '🤝 Consórcio'           },
  { value: 'financiamento', label: '🏦 Financiamento'        },
  { value: 'cdc',           label: '💳 CDC'                  },
  { value: 'investment',    label: '📈 Investimento'          },
  { value: 'imovel',        label: '🏠 Imóvel'               },
  { value: 'outro',         label: '📦 Outro'                },
]

export function DealForm({ action }: Props) {
  const [open, setOpen]               = useState(false)
  const [state, formAction, isPending] = useActionState(action, null)

  const selectSt: React.CSSProperties = {
    ...inputSt, cursor: 'pointer', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    paddingRight: 28,
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%', marginTop: 12,
          padding: '10px 16px', borderRadius: 10,
          background: C.greenBg, color: C.greenDark,
          border: `1px solid ${C.greenDark}30`,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        🤝 Registrar negócio fechado
      </button>
    )
  }

  return (
    <div style={{
      marginTop: 12, background: C.greenBg, borderRadius: 12,
      padding: '14px 16px', border: `1px solid ${C.greenDark}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.greenDark }}>
          🤝 Registrar negócio
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textSec, fontSize: 16, lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {state && !state.success && (
        <div style={{
          background: '#FEF2F2', borderRadius: 8,
          padding: '8px 12px', marginBottom: 10,
          fontSize: 12, color: '#991B1B',
        }}>
          {state.error}
        </div>
      )}

      <form action={formAction}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelSt}>Produto</label>
            <select name="product_type" style={selectSt}>
              {PRODUCT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelSt}>Status</label>
            <select name="status" defaultValue="won" style={selectSt}>
              <option value="won">✅ Fechado (ganho)</option>
              <option value="pending">⏳ Em andamento</option>
              <option value="lost">❌ Perdido</option>
            </select>
          </div>

          <div>
            <label style={labelSt}>Valor da venda</label>
            <input
              name="sale_amount"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 100.000"
              style={inputSt}
            />
          </div>

          <div>
            <label style={labelSt}>Meu ganho (comissão)</label>
            <input
              name="gain_amount"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 3.000"
              style={inputSt}
            />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelSt}>Observação (opcional)</label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Produto, condições, observações..."
            style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              padding: '9px 16px', borderRadius: 8, fontSize: 12,
              background: '#fff', color: C.textSec,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            style={{
              flex: 1, padding: '9px 16px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
              background: isPending ? C.bgSecondary : C.greenDark,
              color: isPending ? C.textSec : '#fff',
              border: 'none', fontFamily: 'inherit',
            }}
          >
            {isPending ? 'Salvando…' : '✓ Salvar negócio'}
          </button>
        </div>
      </form>
    </div>
  )
}
