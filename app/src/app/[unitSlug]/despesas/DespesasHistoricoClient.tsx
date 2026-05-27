'use client'

// =============================================================================
// DespesasHistoricoClient — lista de despesas com editar e excluir inline
//
// SEGURANÇA:
//   • deleteAction é uma server action vinculada ao unitSlug no servidor
//   • O id da despesa viaja no FormData mas ownership é validada no servidor
//     (WHERE id + lead_id + unit_id)
//   • Nunca expõe lead_id nem unit_id
// =============================================================================

import { useState } from 'react'
import { C } from '@/app/components/ui'

type Expense = {
  id: string
  amount: number
  category: string
  description: string | null
  expense_date: string
}

interface Props {
  unitSlug:    string
  expenses:    Expense[]
  deleteAction: (formData: FormData) => Promise<void>
  expenseCats: Record<string, { emoji: string; label: string }>
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function DespesasHistoricoClient({ unitSlug, expenses, deleteAction, expenseCats }: Props) {
  // ID da despesa em modo de confirmação de exclusão
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (expenses.length === 0) {
    return (
      <div style={{
        background: '#fff', borderRadius: 16, padding: '32px 20px',
        border: `0.5px solid ${C.border}`, textAlign: 'center',
      }}>
        <p style={{ fontSize: 28, margin: '0 0 10px' }}>📭</p>
        <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: '0 0 4px' }}>
          Nenhuma despesa neste período
        </p>
        <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 16px' }}>
          Mude o filtro ou lance sua primeira despesa.
        </p>
        <a href={`/${unitSlug}/despesas/nova`} style={{
          display: 'inline-block',
          background: C.coral, color: '#fff',
          borderRadius: 10, padding: '10px 20px',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          💸 Lançar despesa
        </a>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: `0.5px solid ${C.border}`,
      overflow: 'hidden',
    }}>
      {expenses.map((exp, i) => {
        const cat    = expenseCats[exp.category] ?? { emoji: '📦', label: exp.category }
        const isLast = i === expenses.length - 1
        const isConfirm  = confirmId === exp.id
        const isDeleting = deletingId === exp.id

        return (
          <div key={exp.id} style={{
            borderBottom: isLast ? 'none' : `0.5px solid ${C.border}`,
            background: isConfirm ? '#FFF7F7' : '#fff',
            transition: 'background .15s',
          }}>
            {/* ── Linha principal ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
            }}>
              {/* Ícone da categoria */}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: isConfirm ? '#FEE2E2' : C.bgApp,
                flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 17,
              }}>
                {cat.emoji}
              </div>

              {/* Dados da despesa */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.text }}>
                  {cat.label}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: C.textSec }}>
                  {fmtDate(exp.expense_date)}
                  {exp.description ? ` · ${exp.description}` : ''}
                </p>
              </div>

              {/* Valor */}
              <span style={{
                fontSize: 14, fontWeight: 700, color: C.coralDark,
                flexShrink: 0,
              }}>
                -{fmtBRL(exp.amount)}
              </span>
            </div>

            {/* ── Botões de ação ── */}
            {!isConfirm ? (
              <div style={{
                display: 'flex', gap: 0,
                borderTop: `0.5px solid ${C.border}`,
              }}>
                {/* Editar */}
                <a
                  href={`/${unitSlug}/despesas/${exp.id}/editar`}
                  style={{
                    flex: 1, textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '8px',
                    fontSize: 12, fontWeight: 500, color: C.purple,
                    borderRight: `0.5px solid ${C.border}`,
                  }}
                >
                  ✏️ Editar
                </a>

                {/* Excluir */}
                <button
                  type="button"
                  onClick={() => setConfirmId(exp.id)}
                  style={{
                    flex: 1, border: 'none', background: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '8px',
                    fontSize: 12, fontWeight: 500, color: C.coralDark,
                    fontFamily: 'inherit',
                  }}
                >
                  🗑️ Excluir
                </button>
              </div>
            ) : (
              /* ── Confirmação de exclusão ── */
              <div style={{
                borderTop: `0.5px solid #FCA5A5`,
                padding: '10px 14px',
                background: '#FFF7F7',
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: C.coralDark, fontWeight: 500 }}>
                  Tem certeza que deseja excluir esta despesa?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Cancelar */}
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    style={{
                      flex: 1, border: `0.5px solid ${C.border}`,
                      background: '#fff', borderRadius: 8,
                      padding: '8px', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, color: C.textSec,
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancelar
                  </button>

                  {/* Confirmar exclusão — form com server action */}
                  <form
                    action={async (fd) => {
                      setDeletingId(exp.id)
                      await deleteAction(fd)
                    }}
                    style={{ flex: 1 }}
                  >
                    <input type="hidden" name="id" value={exp.id} />
                    <button
                      type="submit"
                      disabled={isDeleting}
                      style={{
                        width: '100%', border: 'none',
                        background: isDeleting ? '#FDA4A4' : C.coral,
                        color: '#fff', borderRadius: 8,
                        padding: '8px', cursor: isDeleting ? 'not-allowed' : 'pointer',
                        fontSize: 12, fontWeight: 600,
                        fontFamily: 'inherit',
                      }}
                    >
                      {isDeleting ? 'Excluindo...' : '🗑️ Sim, excluir'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
