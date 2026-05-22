'use client'

import { useState } from 'react'
import { C } from '@/app/components/ui'

export function DailyQuestion({ unitSlug }: { unitSlug: string }) {
  const [answered, setAnswered] = useState<'yes' | 'no' | 'later' | null>(null)

  if (answered === 'yes') {
    return (
      <div style={{
        background: C.amberBg, borderRadius: 16,
        padding: '14px 16px', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>📝</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.amberDark, margin: '0 0 2px' }}>
            Registrado!
          </p>
          <a href={`/${unitSlug}/despesas/nova`} style={{
            fontSize: 12, color: C.amberDark, textDecoration: 'underline',
          }}>
            Lançar essa despesa agora →
          </a>
        </div>
      </div>
    )
  }

  if (answered === 'no' || answered === 'later') {
    return (
      <div style={{
        background: C.greenBg, borderRadius: 16,
        padding: '14px 16px', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>✅</span>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.greenDark, margin: 0 }}>
          {answered === 'no' ? 'Ótimo! Continue no rumo certo.' : 'Tudo bem. Volte quando quiser registrar.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: C.purpleBg, borderRadius: 16,
      padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.purpleDeep }}>Pergunta do dia</span>
      </div>
      <p style={{ fontSize: 13, color: C.purpleDark, lineHeight: 1.5, margin: '0 0 12px' }}>
        Você teve algum gasto fora do previsto hoje?
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setAnswered('yes')}
          style={{
            flex: 1, background: C.purple, color: '#fff', border: 'none',
            borderRadius: 10, padding: '9px', fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 500,
          }}
        >
          Sim, tive
        </button>
        <button
          onClick={() => setAnswered('no')}
          style={{
            flex: 1, background: '#fff', color: C.purpleDeep,
            border: `1.5px solid ${C.purple}`,
            borderRadius: 10, padding: '9px', fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Não, ótimo!
        </button>
      </div>
      <button
        onClick={() => setAnswered('later')}
        style={{
          width: '100%', background: 'rgba(0,0,0,0.05)', color: C.textSec,
          border: 'none', borderRadius: 10, padding: '9px', fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Responder depois
      </button>
    </div>
  )
}
