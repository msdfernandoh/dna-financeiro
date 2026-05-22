'use client'

import { useState } from 'react'
import { C } from '@/app/components/ui'

// =============================================================================
// Registrar interação (fire-and-forget — não bloqueia UX em caso de falha)
// unit_id e lead_id são resolvidos server-side pelo cookie dna_lead_token
// =============================================================================

async function recordInteraction(
  unitSlug:        string,
  opp:             OppCard,
  interactionType: 'interest' | 'save' | 'unsave' | 'click',
  metadata:        Record<string, unknown> = {},
): Promise<void> {
  // Fallback: opportunity_id = null, source = 'fallback'
  // Real:     opportunity_id = opp.id, source = 'oportunidades'
  const source = opp.isReal ? 'oportunidades' : 'fallback'
  try {
    await fetch(`/api/${unitSlug}/opportunities/interactions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        opportunity_id:    opp.isReal ? opp.id : null,
        opportunity_type:  opp.type,
        opportunity_title: opp.title,
        interaction_type:  interactionType,
        source,
        target_dream:      opp.target_dream,
        metadata,
      }),
    })
  } catch {
    // Silencioso — não interrompe o fluxo do usuário
  }
}

// =============================================================================
// Tipos
// =============================================================================

export interface OppCard {
  id:           string
  type:         'event' | 'course' | 'challenge' | 'job' | 'banner' | 'partner'
  title:        string
  description:  string
  cta_label:    string
  cta_url:      string | null
  target_dream: string | null
  featured:     boolean
  isReal:       boolean
}

// =============================================================================
// Metadados de tipo
// =============================================================================

const TYPE_META: Record<OppCard['type'], { label: string; emoji: string; badgeBg: string; badgeColor: string }> = {
  event:     { label: 'Evento',       emoji: '📅', badgeBg: C.purpleBg,    badgeColor: C.purpleDeep },
  course:    { label: 'Educação',     emoji: '📚', badgeBg: C.greenBg,     badgeColor: C.greenDark  },
  challenge: { label: 'Desafio',      emoji: '🎯', badgeBg: C.amberBg,     badgeColor: C.amberDark  },
  job:       { label: 'Renda extra',  emoji: '💼', badgeBg: C.purpleBg,    badgeColor: C.purpleDeep },
  banner:    { label: 'Parceiro',     emoji: '🤝', badgeBg: C.bgSecondary, badgeColor: C.textSec    },
  partner:   { label: 'Parceiro',     emoji: '🤝', badgeBg: C.bgSecondary, badgeColor: C.textSec    },
}

// =============================================================================
// Abas
// =============================================================================

type TabKey = 'todos' | 'job' | 'event' | 'sonho' | 'educacao'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'todos',    label: 'Para você'         },
  { key: 'job',      label: 'Renda extra'        },
  { key: 'event',    label: 'Eventos'            },
  { key: 'sonho',    label: 'Seu sonho'          },
  { key: 'educacao', label: 'Educação financeira' },
]

function filterByTab(opps: OppCard[], tab: TabKey, dream: string): OppCard[] {
  switch (tab) {
    case 'todos':
      return opps
    case 'job':
      return opps.filter(o => o.type === 'job')
    case 'event':
      return opps.filter(o => o.type === 'event')
    case 'sonho':
      return opps.filter(o => o.target_dream === dream || o.target_dream === 'dividas')
    case 'educacao':
      return opps.filter(o => o.type === 'course' || o.type === 'challenge')
    default:
      return opps
  }
}

// =============================================================================
// Props
// =============================================================================

interface Props {
  opportunities: OppCard[]
  leadDream:     string
  unitSlug:      string
  hasRealData:   boolean
}

// =============================================================================
// Componente principal
// =============================================================================

export function OpportunitiesClient({ opportunities, leadDream, unitSlug, hasRealData }: Props) {
  const [activeTab,  setActiveTab]  = useState<TabKey>('todos')
  const [interested, setInterested] = useState<Record<string, boolean>>({})
  const [saved,      setSaved]      = useState<Record<string, boolean>>({})

  const filtered = filterByTab(opportunities, activeTab, leadDream)

  return (
    <>
      {/* ── Aviso de fallback (apenas em dev ou quando não há dados reais) ── */}
      {!hasRealData && (
        <div style={{
          background: C.amberBg, borderRadius: 12, padding: '10px 14px',
          marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
          <p style={{ margin: 0, fontSize: 12, color: C.amberDark, lineHeight: 1.5 }}>
            Oportunidades personalizadas com base no seu perfil. Em breve seu consultor adicionará mais opções para você.
          </p>
        </div>
      )}

      {/* ── Abas ── */}
      <div style={{
        display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 14,
        paddingBottom: 4, scrollbarWidth: 'none',
      }}>
        {TABS.map(tab => {
          const count = filterByTab(opportunities, tab.key, leadDream).length
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                flexShrink: 0,
                border: isActive ? `1.5px solid ${C.purple}` : `1.5px solid ${C.border}`,
                borderRadius: 99, padding: '6px 14px',
                fontSize: 12, cursor: 'pointer',
                background: isActive ? C.purple : '#fff',
                color: isActive ? '#fff' : C.textSec,
                fontFamily: 'inherit', fontWeight: isActive ? 600 : 400,
                whiteSpace: 'nowrap', transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : C.bgSecondary,
                  color: isActive ? '#fff' : C.textSec,
                  fontSize: 10, fontWeight: 700,
                  borderRadius: 99, padding: '0 5px', minWidth: 16, textAlign: 'center',
                }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Cards ── */}
      {filtered.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
          padding: '32px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>🔎</p>
          <p style={{ fontSize: 14, color: C.text, fontWeight: 500, margin: '0 0 4px' }}>
            Nenhuma oportunidade nessa categoria ainda.
          </p>
          <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
            Tente outra aba ou complete seu DNA para receber sugestões melhores.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(opp => (
            <OppCardComponent
              key={opp.id}
              opp={opp}
              unitSlug={unitSlug}
              isInterested={!!interested[opp.id]}
              isSaved={!!saved[opp.id]}
              onInterest={() => {
                const wasInterested = !!interested[opp.id]
                setInterested(prev => ({ ...prev, [opp.id]: true }))
                // Registra apenas na primeira vez (não desfaz interesse)
                if (!wasInterested) {
                  recordInteraction(unitSlug, opp, 'interest', { tab: activeTab })
                }
              }}
              onSave={() => {
                const wasSaved = !!saved[opp.id]
                setSaved(prev => ({ ...prev, [opp.id]: !prev[opp.id] }))
                recordInteraction(unitSlug, opp, wasSaved ? 'unsave' : 'save', { tab: activeTab })
              }}
            />
          ))}
        </div>
      )}

      {/* ── CTA final ── */}
      <div style={{
        background: C.purpleBg, borderRadius: 16,
        padding: '16px', marginTop: 20, textAlign: 'center',
      }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.purpleDeep, margin: '0 0 4px' }}>
          🧬 Quer oportunidades ainda mais personalizadas?
        </p>
        <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 12px', lineHeight: 1.5 }}>
          Complete seu DNA Financeiro e receba sugestões sob medida para o seu perfil.
        </p>
        <a href={`/${unitSlug}/dna`} style={{
          display: 'inline-block',
          background: C.purple, color: '#fff',
          borderRadius: 10, padding: '10px 20px',
          fontSize: 13, fontWeight: 500, textDecoration: 'none',
        }}>
          Completar meu DNA →
        </a>
      </div>
    </>
  )
}

// =============================================================================
// Card individual
// =============================================================================

function OppCardComponent({
  opp, unitSlug, isInterested, isSaved, onInterest, onSave,
}: {
  opp:          OppCard
  unitSlug:     string
  isInterested: boolean
  isSaved:      boolean
  onInterest:   () => void
  onSave:       () => void
}) {
  const meta = TYPE_META[opp.type]

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: `0.5px solid ${opp.featured ? C.purple : C.border}`,
      overflow: 'hidden',
      boxShadow: opp.featured ? `0 0 0 1px ${C.purple}20, 0 4px 20px ${C.purple}12` : 'none',
    }}>
      {/* Badge featured */}
      {opp.featured && (
        <div style={{
          background: `linear-gradient(90deg, ${C.purple}, ${C.purpleDeep})`,
          padding: '5px 14px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 10 }}>⭐</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}>
            DESTAQUE DA SEMANA
          </span>
        </div>
      )}

      <div style={{ padding: '14px' }}>
        {/* Tipo + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            background: meta.badgeBg, color: meta.badgeColor,
            fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {meta.emoji} {meta.label}
          </span>
          {opp.target_dream && (
            <span style={{
              background: C.amberBg, color: C.amberDark,
              fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 99,
            }}>
              Seu sonho
            </span>
          )}
          {!opp.isReal && (
            <span style={{
              background: C.bgSecondary, color: C.textSec,
              fontSize: 9, padding: '2px 7px', borderRadius: 99, marginLeft: 'auto',
            }}>
              Em breve
            </span>
          )}
        </div>

        {/* Título e descrição */}
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 6px', lineHeight: 1.4 }}>
          {opp.title}
        </h3>
        <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 14px', lineHeight: 1.6 }}>
          {opp.description}
        </p>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

          {/* CTA principal */}
          {opp.cta_url ? (
            <a
              href={opp.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordInteraction(unitSlug, opp, 'click')}
              style={{
                flex: 1, minWidth: 120,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: C.purple, color: '#fff',
                borderRadius: 10, padding: '9px 14px',
                fontSize: 12, fontWeight: 500, textDecoration: 'none',
              }}
            >
              {opp.cta_label}
            </a>
          ) : (
            <button
              type="button"
              onClick={onInterest}
              style={{
                flex: 1, minWidth: 120,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: isInterested ? C.greenBg : C.purple,
                color: isInterested ? C.greenDark : '#fff',
                border: 'none', borderRadius: 10, padding: '9px 14px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              {isInterested ? '✓ Tenho interesse' : opp.cta_label}
            </button>
          )}

          {/* Salvar */}
          <button
            type="button"
            onClick={onSave}
            title={isSaved ? 'Remover dos salvos' : 'Salvar oportunidade'}
            style={{
              width: 38, height: 38, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${isSaved ? C.amber : C.border}`,
              borderRadius: 10, background: isSaved ? C.amberBg : '#fff',
              cursor: 'pointer', fontSize: 16, transition: 'all .15s',
            }}
          >
            {isSaved ? '🔖' : '🔖'}
          </button>

          {/* Falar com consultor */}
          <a
            href={`/${unitSlug}/painel`}
            style={{
              width: 38, height: 38, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${C.border}`,
              borderRadius: 10, background: '#fff',
              textDecoration: 'none', fontSize: 16, transition: 'all .15s',
            }}
            title="Falar com consultor"
          >
            💬
          </a>
        </div>
      </div>
    </div>
  )
}
