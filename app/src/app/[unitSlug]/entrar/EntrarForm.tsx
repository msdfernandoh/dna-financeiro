'use client'

// =============================================================================
// EntrarForm — Formulário de login em duas etapas
//
// Etapa 1 — Telefone:  usuário informa o DDD + número.
//                      Server Action busca o cadastro e gera código.
//
// Etapa 2 — Código:    usuário digita o código de 6 dígitos.
//                      Em modo MVP/Demo, o código aparece na tela.
//                      Em produção, chega pelo WhatsApp.
// =============================================================================

import { useActionState, useState } from 'react'
import type { SolicitarCodigoResult, VerificarCodigoResult } from './actions'
import { C } from '@/app/components/ui'

// Formata o telefone progressivamente enquanto o usuário digita
function formatPhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

interface Props {
  solicitarAction: (prev: SolicitarCodigoResult | null, fd: FormData) => Promise<SolicitarCodigoResult>
  verificarAction: (prev: VerificarCodigoResult | null, fd: FormData) => Promise<VerificarCodigoResult>
  unitSlug: string
}

export function EntrarForm({ solicitarAction, verificarAction, unitSlug }: Props) {
  const [phone,    setPhone]    = useState('')
  const [step,     setStep]     = useState<'phone' | 'code'>('phone')
  const [demoCode, setDemoCode] = useState<string | null>(null)

  // ── Etapa 1: wrapper cliente para capturar transição de step ──────────────
  const [solicitarState, solicitarFormAction, isSolicitando] = useActionState(
    async (prev: SolicitarCodigoResult | null, fd: FormData): Promise<SolicitarCodigoResult> => {
      const result = await solicitarAction(prev, fd)
      if (result.success) {
        setStep('code')
        setDemoCode(result.demoCode)
      }
      return result
    },
    null,
  )

  // ── Etapa 2: verifica código — redirect on success vem do servidor ────────
  const [verificarState, verificarFormAction, isVerificando] = useActionState(
    verificarAction,
    null,
  )

  // ── Render: Etapa 2 — código ──────────────────────────────────────────────
  if (step === 'code') {
    return (
      <div>
        {/* Banner de código demo */}
        {demoCode && (
          <div style={{
            background: '#FFFBEB',
            border: '1.5px dashed #F59E0B',
            borderRadius: 12, padding: '14px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🧪</span>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Modo demo — código de teste
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 30, fontWeight: 800, letterSpacing: 8, color: '#78350F', fontFamily: 'monospace' }}>
                {demoCode}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: '#92400E', lineHeight: 1.5 }}>
                Em produção este código chegará pelo WhatsApp.
              </p>
            </div>
          </div>
        )}

        {/* Instrução */}
        <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 18px', lineHeight: 1.6, textAlign: 'center' }}>
          Digite o código de 6 dígitos enviado para<br />
          <strong style={{ color: C.text }}>{phone}</strong>
        </p>

        {/* Formulário de código */}
        <form action={verificarFormAction} noValidate>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 500,
              color: '#555', marginBottom: 8, textAlign: 'center',
            }}>
              Código de acesso
            </label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.bgApp,
                border: `1.5px solid ${verificarState?.success === false ? C.coral : 'rgba(0,0,0,0.12)'}`,
                borderRadius: 12, padding: '16px 12px',
                fontSize: 28, fontFamily: 'monospace', color: C.text,
                outline: 'none', textAlign: 'center', letterSpacing: 10,
              }}
            />
          </div>

          {/* Erro verificação */}
          {verificarState?.success === false && (
            <div style={{
              background: C.coralBg, borderRadius: 10,
              padding: '12px 14px', marginBottom: 14,
              color: C.coralDark, fontSize: 13, lineHeight: 1.5,
            }}>
              {verificarState.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isVerificando}
            style={{
              width: '100%', border: 'none', borderRadius: 12,
              padding: '14px', fontSize: 15, fontWeight: 600,
              cursor: isVerificando ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background .2s',
              background: isVerificando ? 'rgba(0,0,0,0.1)' : C.purple,
              color: isVerificando ? C.textSec : '#fff',
            }}
          >
            {isVerificando ? 'Verificando...' : '✓ Entrar no meu painel'}
          </button>
        </form>

        {/* Voltar para trocar o telefone */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => { setStep('phone'); setDemoCode(null) }}
            style={{
              background: 'none', border: 'none', color: C.textSec,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              padding: '4px 8px', borderRadius: 6,
            }}
          >
            ← Trocar telefone
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 10 }}>
          🔒 Código expira em 10 minutos
        </p>
      </div>
    )
  }

  // ── Render: Etapa 1 — telefone ────────────────────────────────────────────
  return (
    <form action={solicitarFormAction} noValidate>
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
          onChange={e => setPhone(formatPhoneDisplay(e.target.value))}
          placeholder="(65) 99999-1234"
          autoComplete="tel"
          inputMode="numeric"
          required
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.bgApp,
            border: `0.5px solid ${solicitarState?.success === false ? C.coral : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 10, padding: '14px 12px',
            fontSize: 16, fontFamily: 'inherit', color: C.text,
            outline: 'none',
          }}
        />
      </div>

      {/* Erro etapa 1 */}
      {solicitarState?.success === false && (
        <div style={{
          background: C.coralBg, borderRadius: 10,
          padding: '12px 14px', marginBottom: 14,
          color: C.coralDark, fontSize: 13, lineHeight: 1.5,
        }}>
          {solicitarState.error}
          {solicitarState.error.includes('diagnóstico') && (
            <>
              {' '}
              <a
                href={`/${unitSlug}`}
                style={{ color: C.purple, fontWeight: 600, textDecoration: 'none' }}
              >
                Fazer diagnóstico gratuito →
              </a>
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isSolicitando || phone.replace(/\D/g, '').length < 10}
        style={{
          width: '100%', border: 'none', borderRadius: 12,
          padding: '14px', fontSize: 15, fontWeight: 600,
          cursor: isSolicitando ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background .2s',
          background: isSolicitando || phone.replace(/\D/g, '').length < 10
            ? 'rgba(0,0,0,0.1)'
            : C.purple,
          color: isSolicitando || phone.replace(/\D/g, '').length < 10
            ? C.textSec
            : '#fff',
        }}
      >
        {isSolicitando ? 'Buscando...' : 'Enviar código de acesso →'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 12 }}>
        🔒 Apenas você acessa seus dados
      </p>
    </form>
  )
}
