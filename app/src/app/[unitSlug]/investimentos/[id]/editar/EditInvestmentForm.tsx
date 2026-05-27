'use client'

// =============================================================================
// EditInvestmentForm — formulário pré-preenchido para edição de investimento
//
// Campos editáveis: valor, tipo, descrição, data, recorrente, valor atual, retorno
// O ID do investimento vai como campo hidden — ownership validada no servidor
// Investments e expenses são universos separados — NUNCA somados
// =============================================================================

import { useActionState, useState } from 'react'
import type { UpdateInvestmentResult } from '@/types/database'
import { C } from '@/app/components/ui'

// ── Dados ─────────────────────────────────────────────────────────────────────

const INVESTMENT_TYPES = [
  { value: 'poupanca',            emoji: '🐷',  label: 'Poupança' },
  { value: 'reserva_emergencia',  emoji: '🆘',  label: 'Reserva' },
  { value: 'renda_fixa',          emoji: '📊',  label: 'Renda Fixa' },
  { value: 'acoes',               emoji: '📈',  label: 'Ações' },
  { value: 'fundos_imobiliarios', emoji: '🏢',  label: 'Fundos' },
  { value: 'cripto',              emoji: '₿',   label: 'Cripto' },
  { value: 'imovel',              emoji: '🏠',  label: 'Imóvel' },
  { value: 'consorcio',           emoji: '🤝',  label: 'Consórcio' },
  { value: 'veiculo',             emoji: '🚗',  label: 'Veículo' },
  { value: 'previdencia',         emoji: '🏦',  label: 'Previdência' },
  { value: 'negocio',             emoji: '🏪',  label: 'Negócio' },
  { value: 'curso',               emoji: '📚',  label: 'Educação' },
  { value: 'equipamento',         emoji: '🔧',  label: 'Equipamento' },
  { value: 'outro',               emoji: '💰',  label: 'Outro' },
] as const

type InvType = typeof INVESTMENT_TYPES[number]['value']

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtCents(digits: string): string {
  const n = parseInt(digits || '0', 10)
  return (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toCentsDigits(amount: number): string {
  return Math.round(amount * 100).toString()
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Investment {
  id:              string
  amount:          number
  investment_type: string
  description:     string | null
  investment_date: string
  is_recurring:    boolean
  current_value:   number | null
  expected_return: number | null
}

interface Props {
  investment:   Investment
  updateAction: (prev: UpdateInvestmentResult | null, fd: FormData) => Promise<UpdateInvestmentResult>
  cancelHref:   string
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EditInvestmentForm({ investment, updateAction, cancelHref }: Props) {
  const [state, formAction, isPending] = useActionState(updateAction, null)

  const [amountDigits,  setAmount]     = useState(toCentsDigits(investment.amount))
  const [selectedType,  setType]       = useState<InvType | ''>(
    INVESTMENT_TYPES.some(t => t.value === investment.investment_type)
      ? investment.investment_type as InvType
      : ''
  )
  const [description,   setDesc]       = useState(investment.description ?? '')
  const [date,          setDate]       = useState(investment.investment_date)
  const [isRecurring,   setRecurring]  = useState(investment.is_recurring)
  const [showAdvanced,  setShowAdv]    = useState(
    investment.current_value !== null || investment.expected_return !== null
  )
  const [currentValue,  setCurrentVal] = useState(
    investment.current_value !== null ? String(investment.current_value).replace('.', ',') : ''
  )
  const [expectedRet,   setExpRet]     = useState(
    investment.expected_return !== null ? String(investment.expected_return).replace('.', ',') : ''
  )

  const amountDisplay = fmtCents(amountDigits)
  const amountValue   = amountDigits ? amountDisplay : ''
  const today         = new Date().toISOString().split('T')[0]
  const canSubmit     = !!amountDigits && !!selectedType

  return (
    <form action={formAction} noValidate>
      {/* ID do investimento — ownership validada no servidor */}
      <input type="hidden" name="id"              value={investment.id} />
      <input type="hidden" name="amount"           value={amountValue} />
      <input type="hidden" name="investment_type"  value={selectedType} />
      <input type="hidden" name="investment_date"  value={date} />
      <input type="hidden" name="is_recurring"     value={String(isRecurring)} />
      <input type="hidden" name="current_value"    value={currentValue} />
      <input type="hidden" name="expected_return"  value={expectedRet} />

      {/* ── Valor ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `0.5px solid ${state?.success === false && state.field === 'amount' ? C.coral : C.border}`,
        padding: '20px 20px 16px', marginBottom: 10,
      }}>
        <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 10px', textAlign: 'center' }}>
          Valor do investimento
        </p>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, color: C.textSec, fontWeight: 400 }}>R$ </span>
          <span style={{
            fontSize: 48, fontWeight: 500, letterSpacing: -1,
            color: amountDigits ? C.greenDark : C.textTer,
          }}>
            {amountDigits ? amountDisplay : '0,00'}
          </span>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={amountDigits ? `R$ ${amountDisplay}` : ''}
          onChange={e => setAmount(e.target.value.replace(/\D/g, '').slice(0, 9))}
          placeholder="R$ 0,00"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.bgApp, border: `0.5px solid rgba(0,0,0,0.1)`,
            borderRadius: 10, padding: '10px 12px',
            fontSize: 15, fontFamily: 'inherit', color: C.text,
            outline: 'none', textAlign: 'center', fontWeight: 500,
          }}
        />
        {state?.success === false && state.field === 'amount' && (
          <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0', textAlign: 'center' }}>{state.error}</p>
        )}
      </div>

      {/* ── Tipo ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `0.5px solid ${state?.success === false && state.field === 'investment_type' ? C.coral : C.border}`,
        padding: '14px', marginBottom: 10,
      }}>
        <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 10px' }}>
          Tipo de investimento
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {INVESTMENT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              style={{
                border: selectedType === t.value ? `1.5px solid ${C.green}` : `1.5px solid ${C.border}`,
                borderRadius: 12, padding: '10px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer',
                background: selectedType === t.value ? C.greenBg : '#fff',
                fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 18 }}>{t.emoji}</span>
              <span style={{
                fontSize: 9, textAlign: 'center', lineHeight: 1.3,
                color: selectedType === t.value ? C.greenDark : C.textSec,
                fontWeight: selectedType === t.value ? 700 : 400,
              }}>{t.label}</span>
            </button>
          ))}
        </div>
        {state?.success === false && state.field === 'investment_type' && (
          <p style={{ color: C.coral, fontSize: 12, margin: '6px 0 0' }}>{state.error}</p>
        )}
      </div>

      {/* ── Recorrente ── */}
      <div style={{
        background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
        padding: '14px', marginBottom: 10,
      }}>
        <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 8px' }}>
          Aporte recorrente?
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { v: false, label: 'Não, foi único', emoji: '1️⃣' },
            { v: true,  label: 'Sim, todo mês',  emoji: '🔄' },
          ].map(opt => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setRecurring(opt.v)}
              style={{
                flex: 1,
                border: isRecurring === opt.v ? `1.5px solid ${C.purple}` : `1.5px solid ${C.border}`,
                borderRadius: 12, padding: '10px 8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer',
                background: isRecurring === opt.v ? C.purpleBg : '#fff',
                fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 18 }}>{opt.emoji}</span>
              <span style={{
                fontSize: 11,
                color: isRecurring === opt.v ? C.purpleDeep : C.textSec,
                fontWeight: isRecurring === opt.v ? 600 : 400,
              }}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Descrição ── */}
      <div style={{
        background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
        padding: '14px', marginBottom: 10,
      }}>
        <label style={{ fontSize: 11, color: C.textSec, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Descrição <span style={{ color: C.textTer }}>(opcional)</span>
        </label>
        <input
          type="text"
          name="description"
          value={description}
          onChange={e => setDesc(e.target.value)}
          placeholder="Ex: CDB Nubank, Tesouro Selic, Poupança mensal..."
          maxLength={120}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.bgApp, border: `0.5px solid rgba(0,0,0,0.1)`,
            borderRadius: 10, padding: '10px 12px',
            fontSize: 14, fontFamily: 'inherit', color: C.text, outline: 'none',
          }}
        />
      </div>

      {/* ── Data ── */}
      <div style={{
        background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
        padding: '14px', marginBottom: 10,
      }}>
        <label style={{ fontSize: 11, color: C.textSec, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Data do aporte
        </label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          max={today}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.bgApp, border: `0.5px solid rgba(0,0,0,0.1)`,
            borderRadius: 10, padding: '10px 12px',
            fontSize: 14, fontFamily: 'inherit', color: C.text, outline: 'none',
          }}
        />
      </div>

      {/* ── Avançado ── */}
      <button
        type="button"
        onClick={() => setShowAdv(v => !v)}
        style={{
          width: '100%', background: 'none',
          border: `0.5px dashed ${C.border}`,
          borderRadius: 12, padding: '10px',
          cursor: 'pointer', fontSize: 12, color: C.textSec,
          fontFamily: 'inherit', marginBottom: showAdvanced ? 0 : 16,
        }}
      >
        {showAdvanced ? '▲ Ocultar campos avançados' : '▼ Informações avançadas (valor atual, retorno esperado)'}
      </button>

      {showAdvanced && (
        <div style={{ marginTop: 10, marginBottom: 16 }}>
          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
            padding: '14px', marginBottom: 10,
          }}>
            <label style={{ fontSize: 11, color: C.textSec, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Valor atual do ativo{' '}
              <span style={{ color: C.textTer }}>(para renda variável — opcional)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={currentValue}
              onChange={e => setCurrentVal(e.target.value)}
              placeholder="Ex: 1500,00"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.bgApp,
                border: `0.5px solid ${state?.success === false && state.field === 'current_value' ? C.coral : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 10, padding: '10px 12px',
                fontSize: 14, fontFamily: 'inherit', color: C.text, outline: 'none',
              }}
            />
            {state?.success === false && state.field === 'current_value' && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{state.error}</p>
            )}
          </div>

          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
            padding: '14px',
          }}>
            <label style={{ fontSize: 11, color: C.textSec, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Retorno esperado ao ano{' '}
              <span style={{ color: C.textTer }}>(% — opcional)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={expectedRet}
              onChange={e => setExpRet(e.target.value)}
              placeholder="Ex: 12,5"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.bgApp,
                border: `0.5px solid ${state?.success === false && state.field === 'expected_return' ? C.coral : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 10, padding: '10px 12px',
                fontSize: 14, fontFamily: 'inherit', color: C.text, outline: 'none',
              }}
            />
            {state?.success === false && state.field === 'expected_return' && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{state.error}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Erro geral ── */}
      {state?.success === false && !state.field && (
        <div style={{
          background: C.coralBg, borderRadius: 12,
          padding: '12px 14px', marginBottom: 12,
          color: C.coralDark, fontSize: 13,
        }}>⚠️ {state.error}</div>
      )}

      {/* ── Botões ── */}
      <button
        type="submit"
        disabled={isPending || !canSubmit}
        style={{
          width: '100%', border: 'none', borderRadius: 14, padding: '16px',
          fontSize: 15, fontWeight: 600,
          cursor: isPending || !canSubmit ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background .2s',
          background: isPending || !canSubmit ? 'rgba(0,0,0,0.10)' : C.green,
          color: isPending || !canSubmit ? C.textSec : '#fff',
          marginBottom: 10,
        }}
      >
        {isPending ? 'Salvando...' : '✅ Salvar alterações'}
      </button>

      <a
        href={cancelHref}
        style={{
          display: 'block', textAlign: 'center',
          fontSize: 13, color: C.textSec, textDecoration: 'none',
          padding: '10px',
        }}
      >
        Cancelar
      </a>
    </form>
  )
}
