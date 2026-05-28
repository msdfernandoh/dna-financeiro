// =============================================================================
// /[unitSlug]/gauchinho/evento — Formulário de cadastro do evento Gauchinho x Construtora
//
// Server Component puro — resolve unit no servidor, renderiza EventoForm.
// Sem 'use client'. Sem unit_id exposto ao browser.
// =============================================================================

import { resolveUnit } from '@/lib/units'
import { EventoForm }  from './EventoForm'

// ── Paleta Gauchinho ──────────────────────────────────────────────────────────
const BLUE  = '#1B4F8A'
const GOLD  = '#F4A300'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string }>
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function GauchinhoEventoPage({ params }: Props) {
  const { unitSlug } = await params
  const unit = await resolveUnit(unitSlug)

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: '#F1F5F9',
      minHeight: '100dvh',
      color: '#1A2332',
    }}>

      {/* ── Header ── */}
      <header style={{
        background: BLUE,
        padding: '0 20px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: 480, margin: '0 auto',
          height: 56,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Voltar */}
          <a
            href={`/${unitSlug}/gauchinho`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(255,255,255,0.12)',
              color: '#fff', textDecoration: 'none', fontSize: 16, flexShrink: 0,
            }}
          >
            ←
          </a>

          {/* Logo DNA */}
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            flexShrink: 0,
          }}>🧬</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              Gauchinho Soluções Financeiras
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
              Análise do apartamento · {unit.city}
            </div>
          </div>

          {/* Badge evento */}
          <span style={{
            background: GOLD,
            color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '3px 8px', borderRadius: 99,
            letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 0,
          }}>
            Evento
          </span>
        </div>
      </header>

      {/* ── Hero banner ── */}
      <div style={{
        background: `linear-gradient(160deg, ${BLUE} 0%, #0F3060 100%)`,
        padding: '28px 20px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Orb decorativo */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 200, height: 200,
          background: `radial-gradient(circle, ${GOLD}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Badge dourado */}
          <div style={{ marginBottom: 14 }}>
            <span style={{
              display: 'inline-block',
              background: `${GOLD}20`,
              border: `1px solid ${GOLD}50`,
              color: GOLD,
              fontSize: 11, fontWeight: 600,
              padding: '5px 12px', borderRadius: 99, letterSpacing: 0.4,
            }}>
              🏗️ Análise Gratuita · Evento Exclusivo
            </span>
          </div>

          <h1 style={{
            fontSize: 24, fontWeight: 700, color: '#fff',
            margin: '0 0 10px', lineHeight: 1.3,
          }}>
            Deixe seu contato e receba a{' '}
            <span style={{ color: GOLD }}>análise do seu apartamento</span>
          </h1>

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.65, margin: 0,
          }}>
            Nossa equipe analisa o melhor caminho para você realizar a compra:
            financiamento, consórcio, Plano Pontual ou carta contemplada.
          </p>
        </div>
      </div>

      {/* ── Formulário ── */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Card do formulário */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '0.5px solid #E2E8F0',
          padding: '24px 20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          marginBottom: 20,
        }}>
          <EventoForm unitSlug={unitSlug} unitCity={unit.city} />
        </div>

        {/* Compliance */}
        <p style={{
          fontSize: 10, color: '#94A3B8',
          textAlign: 'center', lineHeight: 1.7,
          margin: 0,
        }}>
          🔒 Seus dados são tratados com sigilo e utilizados apenas para a análise
          solicitada. Conforme LGPD (Lei 13.709/2018).<br />
          Gauchinho Soluções Financeiras · DNA Financeiro · {unit.city}, {unit.state}
        </p>
      </div>

    </div>
  )
}
