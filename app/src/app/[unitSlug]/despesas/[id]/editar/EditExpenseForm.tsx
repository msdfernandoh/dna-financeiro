'use client'

// =============================================================================
// EditExpenseForm — formulário pré-preenchido para edição de despesa
//
// Campos editáveis: valor, categoria, descrição, data
// O ID da despesa vai como campo hidden — ownership validada no servidor
// =============================================================================

import { useActionState, useState } from 'react'
import type { UpdateExpenseResult } from '@/types/database'
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

type Category = typeof CATEGORIES[number]['value']

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtCents(digits: string): string {
  const n = parseInt(digits || '0', 10)
  return (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toCentsDigits(amount: number): string {
  // amount: 49.90 → "4990"
  return Math.round(amount * 100).toString()
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Expense {
  id: string
  amount: number
  category: string
  description: string | null
  expense_date: string
}

interface Props {
  expense:      Expense
  updateAction: (prev: UpdateExpenseResult | null, fd: FormData) => Promise<UpdateExpenseResult>
  cancelHref:   string
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EditExpenseForm({ expense, updateAction, cancelHref }: Props) {
  const [state, formAction, isPending] = useActionState(updateAction, null)

  const [amountDigits, setAmount] = useState(toCentsDigits(expense.amount))
  const [category,     setCategory] = useState<Category | ''>(
    CATEGORIES.some(c => c.value === expense.category) ? expense.category as Category : ''
  )
  const [description, setDesc] = useState(expense.description ?? '')
  const [date,        setDate]  = useState(expense.expense_date)

  const amountDisplay = fmtCents(amountDigits)
  const amountValue   = amountDigits ? amountDisplay : ''
  const today         = new Date().toISOString().split('T')[0]
  const canSubmit     = !!amountDigits && !!category

  return (
    <form action={formAction} noValidate>
      {/* ID da despesa — ownership validada no servidor */}
      <input type="hidden" name="id"     value={expense.id} />
      <input type="hidden" name="amount" value={amountValue} />

      {/* ── Valor ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `0.5px solid ${state?.success === false && state.field === 'amount' ? C.coral : C.border}`,
        padding: '20px 20px 16px', marginBottom: 10,
      }}>
        <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 10px', textAlign: 'center' }}>
          Valor da despesa
        </p>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, color: C.textSec, fontWeight: 400 }}>R$ </span>
          <span style={{
            fontSize: 48, fontWeight: 500, letterSpacing: -1,
            color: amountDigits ? C.coralDark : C.textTer,
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

      {/* ── Categoria ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `0.5px solid ${state?.success === false && state.field === 'category' ? C.coral : C.border}`,
        padding: '14px', marginBottom: 10,
      }}>
        <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 10px' }}>
          Categoria
        </p>
        {/* Hidden field para enviar a categoria */}
        <input type="hidden" name="category" value={category} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              style={{
                border: category === c.value ? `1.5px solid ${C.coral}` : `1.5px solid ${C.border}`,
                borderRadius: 12, padding: '10px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer',
                background: category === c.value ? C.coralBg : '#fff',
                fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 18 }}>{c.emoji}</span>
              <span style={{
                fontSize: 9, textAlign: 'center', lineHeight: 1.3,
                color: category === c.value ? C.coralDark : C.textSec,
                fontWeight: category === c.value ? 700 : 400,
              }}>{c.label}</span>
            </button>
          ))}
        </div>
        {state?.success === false && state.field === 'category' && (
          <p style={{ color: C.coral, fontSize: 12, margin: '6px 0 0' }}>{state.error}</p>
        )}
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
          placeholder="Ex: Almoço restaurante, Mercado semanal..."
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
          Data da despesa
        </label>
        <input
          type="date"
          name="expense_date"
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
          background: isPending || !canSubmit ? 'rgba(0,0,0,0.10)' : C.coral,
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
