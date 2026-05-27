'use client'

// =============================================================================
// Investimentos — Client Component
// Formulário de lançamento + histórico de aportes (com editar e excluir)
// =============================================================================

import { useActionState, useState } from 'react'
import type { CreateInvestmentResult } from '@/types/database'
import { C } from '@/app/components/ui'

// ── Tipos de investimento ─────────────────────────────────────────────────────

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

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

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
  unitSlug:               string
  investments:            Investment[]
  income:                 number
  showSuccess:            boolean
  showEdited:             boolean
  showDeleted:            boolean
  createInvestmentAction: (prev: CreateInvestmentResult | null, fd: FormData) => Promise<CreateInvestmentResult>
  deleteInvestmentAction: (fd: FormData) => Promise<void>
}

// ── Componente ────────────────────────────────────────────────────────────────

export function InvestimentosClient({
  unitSlug, investments, income, showSuccess, showEdited, showDeleted,
  createInvestmentAction, deleteInvestmentAction,
}: Props) {
  const [state, formAction, isPending] = useActionState(createInvestmentAction, null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId,      setDeletingId]      = useState<string | null>(null)

  const [amountDigits,  setAmount]     = useState('')
  const [selectedType,  setType]       = useState<InvType | ''>('')
  const [description,   setDesc]       = useState('')
  const [date,          setDate]       = useState(new Date().toISOString().split('T')[0])
  const [isRecurring,   setRecurring]  = useState(false)
  const [showAdvanced,  setShowAdv]    = useState(false)
  const [currentValue,  setCurrentVal] = useState('')
  const [expectedRet,   setExpRet]     = useState('')

  const amountDisplay = fmtCents(amountDigits)
  const amountValue   = amountDigits ? amountDisplay : ''
  const today         = new Date().toISOString().split('T')[0]
  const canSubmit     = !!amountDigits && !!selectedType

  return (
    <>
      {/* ── Banners de feedback ── */}
      {showSuccess && (
        <div style={{
          background: C.greenBg, borderRadius: 14, padding: '14px 16px',
          marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center',
          border: `0.5px solid ${C.greenDark}30`,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>✅</span>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.greenDark }}>
              Investimento registrado!
            </p>
            <p style={{ margin: 0, fontSize: 11, color: C.greenDark }}>
              Você se pagou. Continue construindo seu futuro. 🌱
            </p>
          </div>
        </div>
      )}

      {showEdited && (
        <div style={{
          background: C.purpleBg, borderRadius: 14, padding: '12px 14px',
          marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center',
          border: `0.5px solid ${C.purple}30`,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>✏️</span>
          <div>
            <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: C.purple }}>
              Investimento atualizado
            </p>
            <p style={{ margin: 0, fontSize: 11, color: C.purple }}>
              As alterações foram salvas com sucesso.
            </p>
          </div>
        </div>
      )}

      {showDeleted && (
        <div style={{
          background: C.greenBg, borderRadius: 14, padding: '12px 14px',
          marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center',
          border: `0.5px solid ${C.greenDark}30`,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>✅</span>
          <div>
            <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 700, color: C.greenDark }}>
              Investimento excluído
            </p>
            <p style={{ margin: 0, fontSize: 11, color: C.greenDark }}>
              O lançamento foi removido com sucesso.
            </p>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          FORMULÁRIO
      ─────────────────────────────────────────────────────────────────────── */}
      <form action={formAction} noValidate>

        {/* Hidden fields com estado do componente */}
        <input type="hidden" name="amount"          value={amountValue} />
        <input type="hidden" name="investment_type" value={selectedType} />
        <input type="hidden" name="investment_date" value={date} />
        <input type="hidden" name="is_recurring"    value={String(isRecurring)} />
        <input type="hidden" name="current_value"   value={currentValue} />
        <input type="hidden" name="expected_return" value={expectedRet} />

        {/* ── Valor ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          border: `0.5px solid ${state?.success === false && state.field === 'amount' ? C.coral : C.border}`,
          padding: '20px 20px 16px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 10px', textAlign: 'center' }}>
            Quanto você investiu?
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

        {/* ── Tipo de investimento ── */}
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

        {/* ── Recorrente? ── */}
        <div style={{
          background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
          padding: '14px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 8px' }}>
            Aporte recorrente?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: false, label: 'Não, foi único',  emoji: '1️⃣' },
              { v: true,  label: 'Sim, todo mês',   emoji: '🔄' },
            ].map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setRecurring(opt.v)}
                style={{
                  flex: 1, border: isRecurring === opt.v ? `1.5px solid ${C.purple}` : `1.5px solid ${C.border}`,
                  borderRadius: 12, padding: '10px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  cursor: 'pointer',
                  background: isRecurring === opt.v ? C.purpleBg : '#fff',
                  fontFamily: 'inherit', transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                <span style={{
                  fontSize: 11, color: isRecurring === opt.v ? C.purpleDeep : C.textSec,
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

        {/* ── Opções avançadas (toggle) ── */}
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

        {/* ── Submit ── */}
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
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 6,
          }}
        >
          {isPending ? (<><Spinner /> Salvando...</>) : '💚 Registrar investimento'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 6, marginBottom: 24 }}>
          🔒 Seus dados financeiros são privados
        </p>
      </form>

      {/* ──────────────────────────────────────────────────────────────────────
          HISTÓRICO DE APORTES
      ─────────────────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        padding: '14px 16px', border: `0.5px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>
            Histórico de aportes
          </p>
          {investments.length > 0 && (
            <span style={{
              background: C.greenBg, color: C.greenDark,
              fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 99,
            }}>
              {investments.length} {investments.length === 1 ? 'registro' : 'registros'}
            </span>
          )}
        </div>

        {investments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 22, margin: '0 0 8px' }}>🌱</p>
            <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 4px' }}>
              Nenhum aporte registrado ainda.
            </p>
            <p style={{ fontSize: 11, color: C.textTer, margin: 0 }}>
              Registre seu primeiro investimento acima e comece a construir seu futuro!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {investments.map((inv, i) => {
              const typeInfo    = INVESTMENT_TYPES.find(t => t.value === inv.investment_type)
              const isLast      = i === investments.length - 1
              const valorDif    = inv.current_value !== null && inv.current_value !== inv.amount
                ? inv.current_value - inv.amount
                : null
              const isConfirm   = confirmDeleteId === inv.id
              const isDeleting  = deletingId === inv.id

              return (
                <div key={inv.id} style={{
                  borderBottom: isLast ? 'none' : `0.5px solid ${C.border}`,
                  background: isConfirm ? '#F0FDF4' : '#fff',
                  borderRadius: isLast ? '0 0 16px 16px' : 0,
                  transition: 'background .15s',
                }}>
                  {/* ── Linha principal ── */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 11,
                      background: isConfirm ? '#DCFCE7' : C.greenBg,
                      flexShrink: 0, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18, marginTop: 1,
                    }}>
                      {typeInfo?.emoji ?? '💰'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                          {typeInfo?.label ?? inv.investment_type}
                        </span>
                        {inv.is_recurring && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                            background: C.purpleBg, color: C.purpleDeep,
                          }}>🔄 RECORRENTE</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: C.textSec, margin: '2px 0 0' }}>
                        {fmtDate(inv.investment_date)}
                        {inv.description ? ` · ${inv.description}` : ''}
                      </p>
                      {valorDif !== null && (
                        <p style={{
                          fontSize: 10, margin: '2px 0 0',
                          color: valorDif >= 0 ? C.greenDark : C.coralDark,
                        }}>
                          Valor atual: {fmtBRL(inv.current_value!)}
                          {' '}({valorDif >= 0 ? '+' : ''}{fmtBRL(valorDif)})
                        </p>
                      )}
                      {inv.expected_return !== null && (
                        <p style={{ fontSize: 10, color: C.textTer, margin: '1px 0 0' }}>
                          Retorno esperado: {inv.expected_return}% a.a.
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.greenDark, flexShrink: 0, paddingTop: 2 }}>
                      +{fmtBRL(inv.amount)}
                    </span>
                  </div>

                  {/* ── Botões de ação ── */}
                  {!isConfirm ? (
                    <div style={{
                      display: 'flex',
                      borderTop: `0.5px solid ${C.border}`,
                    }}>
                      <a
                        href={`/${unitSlug}/investimentos/${inv.id}/editar`}
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
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(inv.id)}
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
                      borderTop: `0.5px solid ${C.greenDark}30`,
                      padding: '10px 14px',
                      background: '#F0FDF4',
                    }}>
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: C.greenDark, fontWeight: 500 }}>
                        Tem certeza que deseja excluir este investimento?
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
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
                        <form
                          action={async (fd) => {
                            setDeletingId(inv.id)
                            await deleteInvestmentAction(fd)
                          }}
                          style={{ flex: 1 }}
                        >
                          <input type="hidden" name="id" value={inv.id} />
                          <button
                            type="submit"
                            disabled={isDeleting}
                            style={{
                              width: '100%', border: 'none',
                              background: isDeleting ? C.greenBg : C.green,
                              color: isDeleting ? C.greenDark : '#fff',
                              borderRadius: 8, padding: '8px',
                              cursor: isDeleting ? 'not-allowed' : 'pointer',
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
        )}
      </div>
    </>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
      <path d="M12 2a10 10 0 0 1 10 10" style={{ animation: 'spin .8s linear infinite', transformOrigin: 'center' }} />
    </svg>
  )
}
