'use client'

import { useActionState } from 'react'
import { loginAdmin } from './actions'
import { C } from '@/app/components/ui'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAdmin, null)

  return (
    <form action={formAction} noValidate>
      {/* E-mail */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: C.textSec, fontWeight: 500, marginBottom: 5 }}>
          E-mail
        </label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `0.5px solid ${C.border}`, borderRadius: 12,
            padding: '12px 14px', fontSize: 14,
            fontFamily: 'inherit', color: C.text, background: '#fff',
            outline: 'none',
          }}
        />
      </div>

      {/* Senha */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, color: C.textSec, fontWeight: 500, marginBottom: 5 }}>
          Senha
        </label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `0.5px solid ${C.border}`, borderRadius: 12,
            padding: '12px 14px', fontSize: 14,
            fontFamily: 'inherit', color: C.text, background: '#fff',
            outline: 'none',
          }}
        />
      </div>

      {/* Erro */}
      {state?.success === false && (
        <div style={{
          background: C.coralBg, borderRadius: 10, padding: '10px 14px',
          marginBottom: 14, color: C.coralDark, fontSize: 13,
        }}>
          ⚠️ {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        style={{
          width: '100%', border: 'none', borderRadius: 12,
          padding: '14px', fontSize: 14, fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          background: isPending ? 'rgba(0,0,0,0.12)' : C.purple,
          color: isPending ? C.textSec : '#fff',
          fontFamily: 'inherit', transition: 'background .2s',
        }}
      >
        {isPending ? 'Entrando...' : 'Entrar no painel'}
      </button>
    </form>
  )
}
