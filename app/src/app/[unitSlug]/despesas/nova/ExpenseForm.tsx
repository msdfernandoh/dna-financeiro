'use client'

import { useActionState, useState } from 'react'
import type { CreateExpenseResult } from '@/types/database'
import { C } from '@/app/components/ui'

// ── Dados ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação',  emoji: '🍽️' },
  { value: 'mercado',     label: 'Mercado',       emoji: '🛒' },
  { value: 'transporte',  label: 'Transporte',    emoji: '🚗' },
  { value: 'saude',       label: 'Saúde',         emoji: '💊' },
  { value: 'educacao',    label: 'Educação',      emoji: '📚' },
  { value: 'lazer',       label: 'Lazer',         emoji: '🎮' },
  { value: 'dividas',     label: 'Dívidas',       emoji: '💳' },
  { value: 'contas',      label: 'Contas fixas',  emoji: '📄' },
  { value: 'outros',      label: 'Outros',        emoji: '📦' },
] as const

const PAYMENT_METHODS = [
  { value: 'pix',      label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito',   label: 'Débito' },
  { value: 'credito',  label: 'Crédito' },
  { value: 'boleto',   label: 'Boleto' },
]

type Mode = 'manual' | 'voice' | 'photo'

// ── Formatador (ATM-style: últimos 2 dígitos = centavos) ─────────────────────

function fmtCents(digits: string): string {
  const n = parseInt(digits || '0', 10)
  return (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  unitSlug: string
  today: string
  createExpenseAction: (prev: CreateExpenseResult | null, fd: FormData) => Promise<CreateExpenseResult>
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ExpenseForm({ unitSlug, today, createExpenseAction }: Props) {
  const [state, formAction, isPending] = useActionState(createExpenseAction, null)

  const [mode,            setMode]     = useState<Mode>('manual')
  const [amountDigits,    setAmount]   = useState('')
  const [selectedCat,     setCat]      = useState('')
  const [selectedPayment, setPayment]  = useState('')
  const [description,     setDesc]     = useState('')
  const [expenseDate,     setDate]     = useState(today)

  const amountDisplay = fmtCents(amountDigits)
  const amountValue   = amountDigits ? amountDisplay : ''

  return (
    <>
      {/* ── Seleção de modo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <ModeCard
          emoji="⌨️" label="Digitar" badge="Recomendado" badgeBg={C.greenBg} badgeColor={C.greenDark}
          active={mode === 'manual'} onClick={() => setMode('manual')}
        />
        <ModeCard
          emoji="🎤" label="Voz" badge="IA Beta" badgeBg={C.purpleBg} badgeColor={C.purpleDeep}
          active={false} disabled
          onClick={() => {}}
        />
        <ModeCard
          emoji="📷" label="Foto" badge="IA Beta" badgeBg={C.purpleBg} badgeColor={C.purpleDeep}
          active={false} disabled
          onClick={() => {}}
        />
      </div>

      {/* ── Formulário manual ── */}
      {mode === 'manual' && (
        <form action={formAction} noValidate>
          {/* Hidden fields que carregam o estado do componente */}
          <input type="hidden" name="amount"          value={amountValue} />
          <input type="hidden" name="category"        value={selectedCat} />
          <input type="hidden" name="payment_method"  value={selectedPayment} />
          <input type="hidden" name="expense_date"    value={expenseDate} />

          {/* ── Valor ── */}
          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
            padding: '20px 20px 16px', marginBottom: 10,
          }}>
            <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 10px', textAlign: 'center' }}>
              Quanto você gastou?
            </p>
            {/* Big display */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 15, color: C.textSec, fontWeight: 400 }}>R$ </span>
              <span style={{
                fontSize: 48, fontWeight: 500, letterSpacing: -1,
                color: amountDigits ? C.text : C.textTer,
              }}>
                {amountDigits ? amountDisplay : '0,00'}
              </span>
            </div>
            {/* Input oculto visualmente mas acessível — aceita apenas dígitos */}
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                inputMode="numeric"
                value={amountDigits}
                onChange={e => setAmount(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="Digite o valor em centavos (ex: 4550 = R$ 45,50)"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.bgApp, border: `0.5px solid ${state?.success === false && state.field === 'amount' ? C.coral : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 10, padding: '10px 12px',
                  fontSize: 13, fontFamily: 'inherit', color: C.text,
                  outline: 'none', textAlign: 'center',
                }}
              />
            </div>
            {state?.success === false && state.field === 'amount' && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0', textAlign: 'center' }}>{state.error}</p>
            )}
          </div>

          {/* ── Categoria ── */}
          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${state?.success === false && state.field === 'category' ? C.coral : C.border}`,
            padding: '14px', marginBottom: 10,
          }}>
            <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 10px' }}>Categoria</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCat(cat.value)}
                  style={{
                    border: selectedCat === cat.value ? `1.5px solid ${C.purple}` : `1.5px solid ${C.border}`,
                    borderRadius: 12, padding: '10px 4px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    cursor: 'pointer',
                    background: selectedCat === cat.value ? C.purpleBg : '#fff',
                    fontFamily: 'inherit', transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                  <span style={{
                    fontSize: 10, textAlign: 'center', lineHeight: 1.3,
                    color: selectedCat === cat.value ? C.purpleDeep : C.textSec,
                    fontWeight: selectedCat === cat.value ? 500 : 400,
                  }}>{cat.label}</span>
                </button>
              ))}
            </div>
            {state?.success === false && state.field === 'category' && (
              <p style={{ color: C.coral, fontSize: 12, margin: '6px 0 0' }}>{state.error}</p>
            )}
          </div>

          {/* ── Descrição opcional ── */}
          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
            padding: '14px', marginBottom: 10,
          }}>
            <label style={{ fontSize: 11, color: C.textSec, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Descrição <span style={{ color: C.textTer }}>(opcional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Ex: Almoço, farmácia, Uber..."
              maxLength={120}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.bgApp, border: `0.5px solid rgba(0,0,0,0.1)`,
                borderRadius: 10, padding: '10px 12px',
                fontSize: 14, fontFamily: 'inherit', color: C.text, outline: 'none',
              }}
            />
          </div>

          {/* ── Forma de pagamento ── */}
          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
            padding: '14px', marginBottom: 10,
          }}>
            <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 8px' }}>
              Forma de pagamento <span style={{ color: C.textTer }}>(opcional)</span>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setPayment(prev => prev === pm.value ? '' : pm.value)}
                  style={{
                    border: selectedPayment === pm.value ? `1.5px solid ${C.purple}` : `1.5px solid ${C.border}`,
                    borderRadius: 99, padding: '6px 14px',
                    fontSize: 13, cursor: 'pointer',
                    background: selectedPayment === pm.value ? C.purpleBg : '#fff',
                    color: selectedPayment === pm.value ? C.purpleDeep : C.textSec,
                    fontFamily: 'inherit', fontWeight: selectedPayment === pm.value ? 500 : 400,
                    transition: 'all .15s',
                  }}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Data ── */}
          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
            padding: '14px', marginBottom: 16,
          }}>
            <label style={{ fontSize: 11, color: C.textSec, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Data da despesa
            </label>
            <input
              type="date"
              value={expenseDate}
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

          {/* ── Erro geral ── */}
          {state?.success === false && !state.field && (
            <div style={{
              background: C.coralBg, borderRadius: 12,
              padding: '12px 14px', marginBottom: 12,
              color: C.coralDark, fontSize: 13,
            }}>⚠️ {state.error}</div>
          )}

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={isPending || !amountDigits || !selectedCat}
            style={{
              width: '100%', border: 'none', borderRadius: 14, padding: '16px',
              fontSize: 15, fontWeight: 500, cursor: isPending || !amountDigits || !selectedCat ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background .2s',
              background: isPending || !amountDigits || !selectedCat
                ? 'rgba(0,0,0,0.12)' : C.purple,
              color: isPending || !amountDigits || !selectedCat ? C.textSec : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isPending ? (<><Spinner /> Salvando...</>) : '✓ Registrar despesa'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 10 }}>
            🔒 Seus dados financeiros são privados
          </p>
        </form>
      )}

      {/* ── IA Beta placeholder ── */}
      {mode !== 'manual' && (
        <div style={{
          background: C.purpleBg, borderRadius: 16,
          padding: '24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 20, margin: '0 0 8px' }}>
            {mode === 'voice' ? '🎤' : '📷'}
          </p>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.purpleDeep, margin: '0 0 4px' }}>
            {mode === 'voice' ? 'Lançamento por voz' : 'Lançamento por foto'}
          </p>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 14px', lineHeight: 1.5 }}>
            Em breve você poderá registrar despesas{' '}
            {mode === 'voice' ? 'falando naturalmente' : 'fotografando o comprovante'}.
          </p>
          <button
            type="button"
            onClick={() => setMode('manual')}
            style={{
              background: C.purple, color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 20px', fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            Digitar manualmente
          </button>
        </div>
      )}
    </>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function ModeCard({ emoji, label, badge, badgeBg, badgeColor, active, disabled, onClick }: {
  emoji: string; label: string; badge: string; badgeBg: string; badgeColor: string
  active: boolean; disabled?: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: active ? `1.5px solid ${C.purple}` : `1.5px solid ${C.border}`,
        borderRadius: 14, padding: '12px 6px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        cursor: disabled ? 'default' : 'pointer',
        background: active ? C.purpleBg : '#fff',
        fontFamily: 'inherit', opacity: disabled ? 0.6 : 1, transition: 'all .15s',
        minHeight: 90,
      }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{
        fontSize: 11, fontWeight: active ? 500 : 400, color: active ? C.purpleDeep : C.textSec,
      }}>{label}</span>
      <span style={{
        fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 99,
        background: badgeBg, color: badgeColor,
      }}>{badge}</span>
    </button>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
      <path d="M12 2a10 10 0 0 1 10 10" style={{ animation: 'spin .8s linear infinite', transformOrigin: 'center' }} />
    </svg>
  )
}
