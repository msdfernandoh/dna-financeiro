'use client'

// =============================================================================
// TrocarSonhoClient — histórico de sonhos + tornar principal + novo sonho
// =============================================================================

import { useState, useActionState } from 'react'
import { C } from '@/app/components/ui'
import type { CreateDreamResult } from '@/types/database'

// ── Dados ─────────────────────────────────────────────────────────────────────

const DREAM_LIST: { value: string; label: string; emoji: string }[] = [
  { value: 'carro',                     label: 'Carro próprio',             emoji: '🚗' },
  { value: 'casa',                       label: 'Casa própria',              emoji: '🏠' },
  { value: 'moto',                       label: 'Moto',                      emoji: '🏍️' },
  { value: 'caminhao',                   label: 'Caminhão próprio',          emoji: '🚛' },
  { value: 'negocio',                    label: 'Negócio próprio',           emoji: '🏪' },
  { value: 'viagem',                     label: 'Viagem dos sonhos',         emoji: '✈️' },
  { value: 'reserva',                    label: 'Reserva de emergência',     emoji: '🐷' },
  { value: 'faculdade',                  label: 'Faculdade',                 emoji: '🎓' },
  { value: 'reforma',                    label: 'Reforma da casa',           emoji: '🔨' },
  { value: 'dividas',                    label: 'Quitar dívidas',            emoji: '💳' },
  { value: 'aposentadoria_imobiliaria',  label: 'Aposentadoria imobiliária', emoji: '🏦' },
  { value: 'outro',                      label: 'Outro sonho',               emoji: '⭐' },
]

const DREAM_SUBTYPES: Record<string, { value: string; label: string }[]> = {
  carro: [
    { value: 'financiado',     label: 'Financiado' },
    { value: 'a_vista',        label: 'À vista' },
    { value: 'consorcio',      label: 'Consórcio' },
    { value: 'financiar_novo', label: 'Financiar novo' },
    { value: 'entrada_carro',  label: 'Usar carro como entrada' },
    { value: 'vender_comprar', label: 'Vender e comprar outro' },
  ],
  casa: [
    { value: 'comprar_pronta', label: 'Comprar pronta' },
    { value: 'construir',      label: 'Construir' },
    { value: 'financiamento',  label: 'Financiamento habitacional' },
  ],
  caminhao: [
    { value: 'renda_autonoma', label: 'Renda autônoma (frete)' },
    { value: 'empresa',        label: 'Para empresa' },
    { value: 'ampliar_frota',  label: 'Ampliar frota atual' },
  ],
  aposentadoria_imobiliaria: [
    { value: 'comprar_alugar',   label: 'Comprar para alugar' },
    { value: 'construir_alugar', label: 'Construir para alugar' },
    { value: 'revenda',          label: 'Revenda de imóveis' },
  ],
  negocio: [
    { value: 'abrir_zero',    label: 'Abrir do zero' },
    { value: 'franquia',      label: 'Franquia' },
    { value: 'ampliar_atual', label: 'Ampliar negócio atual' },
  ],
  dividas: [
    { value: 'cartao',     label: 'Cartão de crédito' },
    { value: 'emprestimo', label: 'Empréstimo / cheque especial' },
    { value: 'varias',     label: 'Várias dívidas ao mesmo tempo' },
  ],
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

// ── Props ─────────────────────────────────────────────────────────────────────

type DreamRow = {
  id:            string
  dream_type:    string
  dream_subtype: string | null
  target_amount: number
  target_label:  string | null
  is_primary:    boolean
  status:        string
  achieved_at:   string | null
}

interface Props {
  unitSlug:          string
  allDreams:         DreamRow[]
  setPrimaryAction:  (fd: FormData) => Promise<void>
  createDreamAction: (prev: CreateDreamResult | null, fd: FormData) => Promise<CreateDreamResult>
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TrocarSonhoClient({ unitSlug, allDreams, setPrimaryAction, createDreamAction }: Props) {
  const [showForm, setShowForm]       = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [makePrimary, setMakePrimary]  = useState(true)
  const [createState, createAction, isCreating] = useActionState(createDreamAction, null)

  const primaryDream  = allDreams.find(d => d.is_primary && d.status === 'active')
  const otherActive   = allDreams.filter(d => !d.is_primary && d.status === 'active')
  const achieved      = allDreams.filter(d => d.status === 'achieved')

  const subtypes = DREAM_SUBTYPES[selectedType] ?? []

  function dreamLabel(d: DreamRow) {
    const info = DREAM_LIST.find(x => x.value === d.dream_type) ?? { label: d.dream_type, emoji: '⭐' }
    return info
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Sonho atual ── */}
      {primaryDream && (
        <section>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.text }}>
            Sonho atual
          </p>
          <div style={{
            background: '#fff', borderRadius: 14,
            border: `0.5px solid ${C.greenDark}40`,
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: C.amberBg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              {dreamLabel(primaryDream).emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
                {dreamLabel(primaryDream).label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textSec }}>
                {primaryDream.target_label ?? fmtBRL(primaryDream.target_amount)}
              </p>
            </div>
            <span style={{
              background: C.greenBg, color: C.greenDark,
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
              flexShrink: 0,
            }}>
              ✓ Principal
            </span>
          </div>
        </section>
      )}

      {/* ── Outros sonhos ativos ── */}
      {otherActive.length > 0 && (
        <section>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.text }}>
            Outros sonhos — clique para tornar principal
          </p>
          <div style={{
            background: '#fff', borderRadius: 14,
            border: `0.5px solid ${C.border}`, overflow: 'hidden',
          }}>
            {otherActive.map((d, i) => (
              <div key={d.id} style={{
                borderBottom: i < otherActive.length - 1 ? `0.5px solid ${C.border}` : 'none',
              }}>
                {/* Info do sonho */}
                <div style={{
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: C.purpleBg, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {dreamLabel(d).emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>
                      {dreamLabel(d).label}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSec }}>
                      {d.target_label ?? fmtBRL(d.target_amount)}
                    </p>
                  </div>
                </div>

                {/* Botão "Tornar principal" */}
                <form action={setPrimaryAction} style={{ borderTop: `0.5px solid ${C.border}` }}>
                  <input type="hidden" name="dream_id" value={d.id} />
                  <button
                    type="submit"
                    style={{
                      width: '100%', border: 'none', cursor: 'pointer',
                      background: C.purpleBg, color: C.purpleDeep,
                      padding: '13px 16px',
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    🔄 Tornar este meu sonho principal
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Sonhos conquistados (histórico) ── */}
      {achieved.length > 0 && (
        <section>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.text }}>
            🏆 Sonhos conquistados
          </p>
          <div style={{
            background: '#fff', borderRadius: 14,
            border: `0.5px solid ${C.border}`, overflow: 'hidden',
          }}>
            {achieved.map((d, i) => (
              <div key={d.id} style={{
                padding: '14px 16px',
                borderBottom: i < achieved.length - 1 ? `0.5px solid ${C.border}` : 'none',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: C.amberBg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>
                  {dreamLabel(d).emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>
                    {dreamLabel(d).label}
                  </p>
                  {d.achieved_at && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSec }}>
                      Conquistado em {fmtDate(d.achieved_at)}
                    </p>
                  )}
                </div>
                <span style={{
                  background: C.amberBg, color: C.amberDark,
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                  flexShrink: 0,
                }}>🏆</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Separator ── */}
      <div style={{ borderTop: `0.5px solid ${C.border}`, margin: '4px 0' }} />

      {/* ── Testar novo sonho ── */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            width: '100%', border: `0.5px dashed ${C.border}`,
            background: '#fff', borderRadius: 14, cursor: 'pointer',
            padding: '18px', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>➕</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.purpleDeep }}>
            Testar novo sonho
          </span>
        </button>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 16,
          border: `0.5px solid ${C.purple}30`,
          padding: '18px',
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: C.text }}>
            ➕ Novo sonho
          </p>

          {createState?.success === false && !createState.field && (
            <div style={{
              background: C.coralBg, borderRadius: 10, padding: '10px 12px',
              marginBottom: 12, fontSize: 12, color: C.coralDark, fontWeight: 600,
            }}>
              ⚠️ {createState.error}
            </div>
          )}

          <form action={createAction}>

            {/* Tipo de sonho */}
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: C.text }}>
              Qual é o sonho? *
            </p>
            {createState?.success === false && createState.field === 'dream_type' && (
              <p style={{ margin: '0 0 6px', fontSize: 11, color: C.coralDark }}>{createState.error}</p>
            )}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: 6, marginBottom: 14,
            }}>
              {DREAM_LIST.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setSelectedType(d.value)}
                  style={{
                    border: selectedType === d.value
                      ? `2px solid ${C.purple}` : `0.5px solid ${C.border}`,
                    background: selectedType === d.value ? C.purpleBg : '#fff',
                    borderRadius: 10, padding: '10px 6px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4, fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{d.emoji}</span>
                  <span style={{
                    fontSize: 9, color: selectedType === d.value ? C.purpleDeep : C.textSec,
                    fontWeight: selectedType === d.value ? 700 : 400,
                    textAlign: 'center', lineHeight: 1.3,
                  }}>
                    {d.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Campo hidden para dream_type */}
            <input type="hidden" name="dream_type" value={selectedType} />

            {/* Subtipo (condicional) */}
            {selectedType && subtypes.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Como pretende realizar?
                </label>
                <select
                  name="dream_subtype"
                  style={{
                    width: '100%', border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: '12px 14px',
                    fontSize: 13, color: C.text, background: '#fff',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                >
                  <option value="">Não definido ainda</option>
                  {subtypes.map(st => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Valor-alvo */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Valor-alvo (R$) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                name="target_amount"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: createState?.success === false && createState.field === 'target_amount'
                    ? `1.5px solid ${C.coral}` : `1px solid ${C.border}`,
                  borderRadius: 10, padding: '14px',
                  fontSize: 16, fontWeight: 600, color: C.text,
                  background: '#fff', outline: 'none', fontFamily: 'inherit',
                }}
                placeholder="Ex: 500.000 ou 750000"
              />
              {createState?.success === false && createState.field === 'target_amount' && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: C.coralDark }}>{createState.error}</p>
              )}
            </div>

            {/* Tornar principal */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: C.purpleBg, borderRadius: 10,
              padding: '12px 14px', marginBottom: 14, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                name="make_primary"
                value="true"
                checked={makePrimary}
                onChange={e => setMakePrimary(e.target.checked)}
                style={{ accentColor: C.purple, width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.purpleDeep }}>
                Tornar este meu sonho principal agora
              </span>
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setSelectedType('') }}
                style={{
                  flex: 1, border: `0.5px solid ${C.border}`,
                  background: C.bgApp, borderRadius: 12, cursor: 'pointer',
                  padding: '13px', fontSize: 13, fontWeight: 600, color: C.textSec,
                  fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating || !selectedType}
                style={{
                  flex: 2, border: 'none', cursor: (isCreating || !selectedType) ? 'not-allowed' : 'pointer',
                  background: (isCreating || !selectedType) ? C.purpleBg : C.purple,
                  color: (isCreating || !selectedType) ? C.purpleDeep : '#fff',
                  borderRadius: 12, padding: '13px',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                {isCreating ? 'Salvando...' : '➕ Adicionar sonho'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
