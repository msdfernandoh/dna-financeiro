'use client'

import { useActionState, useState } from 'react'
import type { EntrarResult }        from './actions'
import { C }                        from '@/app/components/ui'

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

interface Props {
  action:   (prev: EntrarResult | null, fd: FormData) => Promise<EntrarResult>
  unitSlug: string
  city:     string
}

export function EntrarForm({ action, unitSlug, city }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [phone, setPhone] = useState('')

  return (
    <form action={formAction} noValidate>

      <div style={{ marginBottom: 16 }}>
        <label style={{
          display: 'block', fontSize: 12, fontWeight: 500,
          color: '#555', marginBottom: 6,
        }}>
          Seu telefone com DDD
        </label>
        <input
          name="phone"
          type="tel"
          value={phone}
          onChange={e => setPhone(formatPhone(e.target.value))}
          placeholder="(65) 99999-1234"
          autoComplete="tel"
          inputMode="numeric"
          required
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.bgApp,
            border: `0.5px solid ${state?.success === false ? C.coral : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 10, padding: '14px 12px',
            fontSize: 16, fontFamily: 'inherit', color: C.text,
            outline: 'none',
          }}
        />
      </div>

      {/* Erro */}
      {state?.success === false && (
        <div style={{
          background: C.coralBg, borderRadius: 10,
          padding: '12px 14px', marginBottom: 14,
          color: C.coralDark, fontSize: 13, lineHeight: 1.5,
        }}>
          {state.error}
          {state.error.includes('diagnóstico') && (
            <>
              {' '}
              <a
                href={`/${unitSlug}`}
                style={{ color: C.purple, fontWeight: 600, textDecoration: 'none' }}
              >
                Começar agora →
              </a>
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || phone.replace(/\D/g, '').length < 10}
        style={{
          width: '100%', border: 'none', borderRadius: 12,
          padding: '14px', fontSize: 15, fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background .2s',
          background: isPending || phone.replace(/\D/g, '').length < 10
            ? 'rgba(0,0,0,0.1)'
            : C.purple,
          color: isPending || phone.replace(/\D/g, '').length < 10
            ? C.textSec
            : '#fff',
        }}
      >
        {isPending ? 'Buscando...' : 'Acessar meu painel →'}
      </button>

      <p style={{
        textAlign: 'center', fontSize: 11,
        color: C.textTer, marginTop: 12,
      }}>
        🔒 Apenas você acessa seus dados
      </p>
    </form>
  )
}
