'use client'

// =============================================================================
// EditDreamForm — formulário de refinamento do sonho principal
// =============================================================================

import { useActionState } from 'react'
import { C } from '@/app/components/ui'
import type { UpdateDreamResult } from '@/types/database'

// ── Dados de subtipo por tipo de sonho ───────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: number) {
  return v > 0 ? String(Math.round(v)) : ''
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Dream {
  id: string
  dream_type: string
  dream_subtype: string | null
  target_amount: number
  target_label: string | null
  monthly_contribution: number
  saved_amount: number
}

interface Props {
  dream: Dream
  unitSlug: string
  updateAction: (prev: UpdateDreamResult | null, fd: FormData) => Promise<UpdateDreamResult>
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EditDreamForm({ dream, unitSlug, updateAction }: Props) {
  const [state, action, isPending] = useActionState(updateAction, null)

  const dreamInfo  = DREAM_LABELS[dream.dream_type] ?? DREAM_LABELS.outro
  const subtypes   = DREAM_SUBTYPES[dream.dream_type] ?? []

  return (
    <form action={action}>
      <input type="hidden" name="id" value={dream.id} />

      {/* ── Identidade do sonho (não editável) ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `0.5px solid ${C.border}`,
        padding: '16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: C.amberBg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>
          {dreamInfo.emoji}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>Refinando o sonho</p>
          <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: C.text }}>
            {dreamInfo.label}
          </p>
        </div>
      </div>

      {/* ── Erro global ── */}
      {state && !state.success && !state.field && (
        <div style={{
          background: C.coralBg, borderRadius: 12, padding: '12px 14px',
          marginBottom: 12, fontSize: 13, color: C.coralDark, fontWeight: 600,
        }}>
          ⚠️ {state.error}
        </div>
      )}

      {/* ── Subtipo (se existir para este dream_type) ── */}
      {subtypes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            Como você pretende realizar?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subtypes.map(st => (
              <label key={st.value} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#fff', borderRadius: 10,
                border: `0.5px solid ${C.border}`,
                padding: '12px 14px', cursor: 'pointer',
              }}>
                <input
                  type="radio"
                  name="dream_subtype"
                  value={st.value}
                  defaultChecked={dream.dream_subtype === st.value}
                  style={{ accentColor: C.amber, width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: C.text }}>{st.label}</span>
              </label>
            ))}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', borderRadius: 10,
              border: `0.5px solid ${C.border}`,
              padding: '12px 14px', cursor: 'pointer',
            }}>
              <input
                type="radio"
                name="dream_subtype"
                value=""
                defaultChecked={!dream.dream_subtype}
                style={{ accentColor: C.amber, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: C.textSec }}>Não definido ainda</span>
            </label>
          </div>
        </div>
      )}

      {/* ── Valor-alvo ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Valor-alvo (R$) *
        </label>
        <input
          type="number"
          name="target_amount"
          defaultValue={Math.round(dream.target_amount)}
          min={1}
          step={1}
          required
          style={{
            width: '100%', boxSizing: 'border-box',
            border: state?.success === false && state.field === 'target_amount'
              ? `1.5px solid ${C.coral}` : `1px solid ${C.border}`,
            borderRadius: 10, padding: '14px',
            fontSize: 16, fontWeight: 600, color: C.text,
            background: '#fff', outline: 'none',
            fontFamily: 'inherit',
          }}
          placeholder="Ex: 50000"
        />
        {state?.success === false && state.field === 'target_amount' && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.coralDark }}>{state.error}</p>
        )}
      </div>

      {/* ── Label personalizado ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Nome da meta (opcional)
        </label>
        <input
          type="text"
          name="target_label"
          defaultValue={dream.target_label ?? ''}
          maxLength={60}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px',
            fontSize: 14, color: C.text, background: '#fff', outline: 'none',
            fontFamily: 'inherit',
          }}
          placeholder="Ex: R$ 50.000 · Carro popular 2025"
        />
        <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textTer }}>
          Como você quer exibir o valor-alvo
        </p>
      </div>

      {/* ── Contribuição mensal ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Quanto você já separa por mês? (R$)
        </label>
        <input
          type="number"
          name="monthly_contribution"
          defaultValue={fmtNum(dream.monthly_contribution)}
          min={0}
          step={1}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px',
            fontSize: 14, color: C.text, background: '#fff', outline: 'none',
            fontFamily: 'inherit',
          }}
          placeholder="0"
        />
      </div>

      {/* ── Já guardado ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Quanto você já tem guardado? (R$)
        </label>
        <input
          type="number"
          name="saved_amount"
          defaultValue={fmtNum(dream.saved_amount)}
          min={0}
          step={1}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px',
            fontSize: 14, color: C.text, background: '#fff', outline: 'none',
            fontFamily: 'inherit',
          }}
          placeholder="0"
        />
      </div>

      {/* ── Ações ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            width: '100%', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
            background: isPending ? C.amberBg : C.amber,
            color: isPending ? C.amberDark : '#fff',
            borderRadius: 14, padding: '16px',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          {isPending ? 'Salvando...' : '✅ Salvar refinamento'}
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
