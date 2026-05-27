'use client'

// =============================================================================
// ConquistadoForm — formulário de conquista do sonho financeiro
// =============================================================================

import { useState } from 'react'
import { C } from '@/app/components/ui'

// ── Métodos de conquista ──────────────────────────────────────────────────────

const ACHIEVED_METHODS = [
  { value: 'poupanca',                              label: '🐷 Poupança direta' },
  { value: 'investimento',                           label: '📈 Investimento' },
  { value: 'financiamento',                          label: '🏦 Financiamento' },
  { value: 'cdc',                                   label: '💳 CDC / Crédito direto' },
  { value: 'consorcio',                             label: '🤝 Consórcio' },
  { value: 'consorcio_com_lance',                   label: '🎯 Consórcio com lance' },
  { value: 'consorcio_com_data_de_contemplação',    label: '📅 Consórcio com data de contemplação' },
  { value: 'outro',                                 label: '⭐ Outro' },
]

// ── Dados dos sonhos ──────────────────────────────────────────────────────────

const DREAM_LABELS: Record<string, { label: string; emoji: string }> = {
  carro:                     { label: 'Carro próprio',             emoji: '🚗' },
  casa:                      { label: 'Casa própria',              emoji: '🏠' },
  negocio:                   { label: 'Negócio próprio',           emoji: '🏪' },
  viagem:                    { label: 'Viagem dos sonhos',         emoji: '✈️' },
  reserva:                   { label: 'Reserva de emergência',     emoji: '🐷' },
  faculdade:                 { label: 'Faculdade',                 emoji: '🎓' },
  reforma:                   { label: 'Reforma da casa',           emoji: '🔨' },
  dividas:                   { label: 'Quitar dívidas',            emoji: '💳' },
  moto:                      { label: 'Moto',                      emoji: '🏍️' },
  caminhao:                  { label: 'Caminhão próprio',          emoji: '🚛' },
  aposentadoria_imobiliaria: { label: 'Aposentadoria imobiliária', emoji: '🏦' },
  outro:                     { label: 'Outro sonho',               emoji: '⭐' },
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Dream {
  id:            string
  dream_type:    string
  dream_subtype: string | null
  target_amount: number
  target_label:  string | null
}

interface Props {
  dream:              Dream
  unitSlug:           string
  markAchievedAction: (fd: FormData) => Promise<void>
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ConquistadoForm({ dream, unitSlug, markAchievedAction }: Props) {
  const [selectedMethod, setSelectedMethod] = useState('')
  const [testimonial, setTestimonial]       = useState('')
  const [allowPublic, setAllowPublic]       = useState(false)
  const [isPending, setIsPending]           = useState(false)

  const dreamInfo  = DREAM_LABELS[dream.dream_type] ?? DREAM_LABELS.outro
  const hasTestimonial = testimonial.trim().length >= 10

  return (
    <form
      action={async (fd) => {
        setIsPending(true)
        await markAchievedAction(fd)
      }}
    >
      <input type="hidden" name="id" value={dream.id} />
      <input type="hidden" name="allow_public_case" value={allowPublic && hasTestimonial ? 'true' : 'false'} />

      {/* ── Banner de parabéns ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.amber} 0%, #C27D1A 100%)`,
        borderRadius: 20, padding: '20px', marginBottom: 16,
        display: 'flex', gap: 14, alignItems: 'center',
        boxShadow: `0 6px 24px ${C.amber}40`,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(255,255,255,0.2)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          {dreamInfo.emoji}
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#fff' }}>
            Você está marcando como conquistado:
          </p>
          <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: '#fff' }}>
            {dreamInfo.label}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            Meta original: {dream.target_label ?? fmtBRL(dream.target_amount)}
          </p>
        </div>
      </div>

      {/* ── Valor real alcançado ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Valor real que você alcançou (R$) — opcional
        </label>
        <input
          type="number"
          name="achieved_amount"
          defaultValue={Math.round(dream.target_amount)}
          min={0}
          step={1}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px',
            fontSize: 16, fontWeight: 600, color: C.text,
            background: '#fff', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textTer }}>
          Pode ser diferente da meta original — comprou mais barato ou mais caro, por exemplo.
        </p>
      </div>

      {/* ── Como realizou ── */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: C.text }}>
          Como você realizou o sonho? *
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ACHIEVED_METHODS.map(m => (
            <label key={m.value} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: selectedMethod === m.value ? C.amberBg : '#fff',
              borderRadius: 10,
              border: selectedMethod === m.value
                ? `1.5px solid ${C.amber}` : `0.5px solid ${C.border}`,
              padding: '12px 14px', cursor: 'pointer',
              transition: 'all .1s',
            }}>
              <input
                type="radio"
                name="achieved_method"
                value={m.value}
                required
                onChange={() => setSelectedMethod(m.value)}
                style={{ accentColor: C.amber, width: 16, height: 16 }}
              />
              <span style={{
                fontSize: 13,
                color: selectedMethod === m.value ? C.amberDark : C.text,
                fontWeight: selectedMethod === m.value ? 600 : 400,
              }}>
                {m.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Depoimento ── */}
      <div style={{ marginBottom: hasTestimonial ? 10 : 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Conte sua história — opcional
        </label>
        <textarea
          name="testimonial"
          rows={4}
          value={testimonial}
          onChange={e => {
            setTestimonial(e.target.value)
            if (!e.target.value.trim()) setAllowPublic(false)
          }}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px',
            fontSize: 13, color: C.text, background: '#fff',
            resize: 'vertical', fontFamily: 'inherit', outline: 'none', lineHeight: 1.6,
          }}
          placeholder="Ex: Juntei durante 18 meses poupando R$ 600 por mês. Comprei meu carro à vista em janeiro de 2026. Valeu muito a pena!"
        />
        <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textTer }}>
          {testimonial.length}/500 caracteres
        </p>
      </div>

      {/* ── Autorização de caso público (só aparece com depoimento) ── */}
      {hasTestimonial && (
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: allowPublic ? C.greenBg : C.purpleBg,
          borderRadius: 12, padding: '14px', marginBottom: 16,
          cursor: 'pointer',
          border: allowPublic ? `0.5px solid ${C.greenDark}30` : `0.5px solid ${C.purple}20`,
        }}>
          <input
            type="checkbox"
            checked={allowPublic}
            onChange={e => setAllowPublic(e.target.checked)}
            style={{ accentColor: C.green, width: 18, height: 18, marginTop: 1, flexShrink: 0 }}
          />
          <div>
            <p style={{
              margin: '0 0 2px', fontSize: 13, fontWeight: 700,
              color: allowPublic ? C.greenDark : C.purpleDeep,
            }}>
              Posso usar seu relato como inspiração para outros?
            </p>
            <p style={{ margin: 0, fontSize: 11, color: allowPublic ? C.greenDark : C.purpleDeep, lineHeight: 1.5 }}>
              Seu nome não será exibido sem sua autorização. Você pode revogar a qualquer momento.
            </p>
          </div>
        </label>
      )}

      {/* ── Aviso de ação irreversível ── */}
      <div style={{
        background: C.coralBg, borderRadius: 10,
        padding: '10px 12px', marginBottom: 16,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: 11, color: C.coralDark, lineHeight: 1.5 }}>
          Ao confirmar, este sonho sairá do painel ativo e ficará no histórico de conquistas.
          Se tiver outros sonhos cadastrados, o próximo ativo será promovido automaticamente.
        </p>
      </div>

      {/* ── Botões ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="submit"
          disabled={isPending || !selectedMethod}
          style={{
            width: '100%', border: 'none',
            cursor: (isPending || !selectedMethod) ? 'not-allowed' : 'pointer',
            background: (isPending || !selectedMethod) ? C.amberBg : C.amber,
            color: (isPending || !selectedMethod) ? C.amberDark : '#fff',
            borderRadius: 14, padding: '16px',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          {isPending ? 'Registrando...' : '🏆 Confirmar conquista'}
        </button>

        <a href={`/${unitSlug}/sonho`} style={{
          display: 'block', textAlign: 'center', textDecoration: 'none',
          background: C.bgApp, border: `0.5px solid ${C.border}`,
          borderRadius: 14, padding: '14px',
          fontSize: 13, fontWeight: 500, color: C.textSec,
        }}>
          Cancelar
        </a>
      </div>
    </form>
  )
}
