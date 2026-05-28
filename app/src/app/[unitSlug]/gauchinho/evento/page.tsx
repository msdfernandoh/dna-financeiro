// =============================================================================
// /[unitSlug]/gauchinho/evento — Landing page do Evento Construtora
//
// Server Component puro.
// Formulário de captação específico para o evento (tabela event_leads).
// NÃO usa o RegisterForm normal nem redireciona para o fluxo do DNA.
// =============================================================================

import type { Metadata } from 'next'
import { resolveUnit } from '@/lib/units'
import { C } from '@/app/components/ui'
import EventoLeadForm from './EventoLeadForm'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string }>
}

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { unitSlug } = await params
  return {
    title: 'Análise para pagamento do apartamento · Gauchinho Soluções Financeiras',
    description:
      'Cadastre-se para receber uma análise personalizada das melhores soluções para pagar a entrega do seu apartamento: consórcio, carta contemplada, financiamento ou crédito.',
    robots: 'noindex, nofollow',
    alternates: { canonical: `/${unitSlug}/gauchinho/evento` },
  }
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const WHATSAPP_NUMBER = '5566999126120'
const WHATSAPP_TEXT   = encodeURIComponent(
  'Olá! Me cadastrei no evento e quero entender as soluções para pagar a entrega do meu apartamento.',
)
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`

// ── Página ─────────────────────────────────────────────────────────────────────

export default async function GauchinhoEventoPage({ params }: Props) {
  const { unitSlug } = await params
  const unit = await resolveUnit(unitSlug)

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: C.bgApp,
      minHeight: '100dvh',
      color: C.text,
    }}>

      <style>{`
        @keyframes g-fade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        input, select, textarea { font-family: inherit; }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 1. HERO                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: 'linear-gradient(160deg, #0d0b1e 0%, #1a1547 55%, #0c0b1a 100%)',
        backgroundImage: [
          'linear-gradient(160deg, #0d0b1e 0%, #1a1547 55%, #0c0b1a 100%)',
          'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: 'cover, 28px 28px',
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: 48,
      }}>

        {/* Orbs */}
        <div style={{
          position: 'absolute', top: -120, right: -100, width: 360, height: 360,
          background: 'radial-gradient(circle, rgba(127,119,221,.3) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -80, width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(29,158,117,.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <header style={{
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          position: 'relative', zIndex: 2,
        }}>
          <a href={`/${unitSlug}/gauchinho`} style={{
            display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(127,119,221,0.2)',
              border: '1px solid rgba(127,119,221,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>🧬</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(196,191,255,0.95)' }}>
                DNA Financeiro
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {unit.city} · {unit.state}
              </div>
            </div>
          </a>
          <span style={{
            marginLeft: 'auto',
            background: 'rgba(239,159,39,0.2)',
            border: '1px solid rgba(239,159,39,0.35)',
            color: '#F5C86A',
            fontSize: 10, fontWeight: 600,
            padding: '4px 10px', borderRadius: 99,
          }}>
            Evento Construtora
          </span>
        </header>

        {/* Hero content */}
        <div style={{
          maxWidth: 480, margin: '0 auto',
          padding: '40px 24px 0',
          position: 'relative', zIndex: 2,
          animation: 'g-fade .5s ease both',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🏠</div>

          <span style={{
            display: 'inline-block',
            background: 'rgba(239,159,39,0.18)',
            border: '1px solid rgba(239,159,39,0.35)',
            color: '#F5C86A',
            fontSize: 11, fontWeight: 600,
            padding: '5px 14px', borderRadius: 99,
            letterSpacing: 0.5, textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            Gauchinho Soluções Financeiras
          </span>

          <h1 style={{
            fontSize: 28, fontWeight: 700, color: '#fff',
            lineHeight: 1.2, margin: '0 0 14px', letterSpacing: -0.3,
          }}>
            Receba uma análise para pagar a{' '}
            <span style={{
              background: 'linear-gradient(135deg, #C4BFFF 0%, #8F87E8 40%, #534AB7 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              entrega do seu apartamento
            </span>
          </h1>

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.7, margin: '0 auto',
            maxWidth: 360,
          }}>
            Preencha seus dados para avaliarmos as melhores soluções:{' '}
            <strong style={{ color: 'rgba(255,255,255,0.75)' }}>
              consórcio, carta contemplada, financiamento ou crédito.
            </strong>
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 2. BENEFÍCIOS                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '28px 20px 0', maxWidth: 480, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: 24,
        }}>
          {[
            { emoji: '⚡', text: 'Análise rápida' },
            { emoji: '🔒', text: 'Dados seguros' },
            { emoji: '🆓', text: 'Gratuito' },
          ].map(item => (
            <div key={item.text} style={{
              background: '#fff',
              borderRadius: 12,
              border: `0.5px solid ${C.border}`,
              padding: '10px 8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{item.emoji}</div>
              <p style={{ margin: 0, fontSize: 11, color: C.textSec, fontWeight: 500 }}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 3. FORMULÁRIO                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '0 20px 60px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: `0.5px solid ${C.border}`,
          padding: '24px 20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        }}>
          <EventoLeadForm unitSlug={unitSlug} whatsappUrl={WHATSAPP_URL} />
        </div>
      </section>

      {/* ── Compliance ── */}
      <footer style={{
        padding: '16px 20px 56px',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 10, color: C.textTer,
          lineHeight: 1.7, maxWidth: 420, margin: '0 auto',
        }}>
          Todas as análises são iniciais e educativas. Não representam aprovação de crédito,
          garantia de contemplação ou rentabilidade. Condições dependem de análise, contrato e
          administradora. Gauchinho Soluções Financeiras · DNA Financeiro · {unit.city}, {unit.state}
        </p>
      </footer>

      {/* ── Botão flutuante WhatsApp ── */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          color: '#fff', borderRadius: 99,
          padding: '14px 20px',
          fontSize: 14, fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 24px rgba(37,211,102,.5)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        💬 Falar com Gauchinho
      </a>
    </div>
  )
}
