'use client'

// =============================================================================
// DNA FINANCEIRO — FORMULÁRIO DE CADASTRO
// Client Component — renderizado no browser
//
// SEGURANÇA:
//   • Não conhece unit_id — recebe apenas UnitPublic
//   • A Server Action recebe unit_id via .bind() feito no Server Component
//   • UTMs são lidos de window.location.search e enviados como hidden fields
//   • Nunca tenta resolver unidade ou injetar qualquer ID de segurança
// =============================================================================

import { useActionState, useEffect, useRef, useState } from 'react'
import type { UnitPublic, CreateLeadResult } from '@/types/database'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DREAMS = [
  { value: 'carro',     label: 'Carro próprio',          emoji: '🚗' },
  { value: 'casa',      label: 'Casa própria',           emoji: '🏠' },
  { value: 'negocio',   label: 'Negócio próprio',        emoji: '🏪' },
  { value: 'viagem',    label: 'Viagem dos sonhos',       emoji: '✈️' },
  { value: 'reserva',   label: 'Reserva de emergência',  emoji: '🐷' },
  { value: 'faculdade', label: 'Faculdade',               emoji: '🎓' },
  { value: 'reforma',   label: 'Reforma da casa',         emoji: '🔨' },
  { value: 'dividas',   label: 'Quitar dívidas',          emoji: '💳' },
  { value: 'moto',      label: 'Moto',                    emoji: '🏍️' },
  { value: 'outro',     label: 'Outro sonho',             emoji: '⭐' },
] as const

type DreamValue = (typeof DREAMS)[number]['value']

// ---------------------------------------------------------------------------
// Formatação de moeda
// ---------------------------------------------------------------------------

function formatCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseCurrencyToFloat(formatted: string): string {
  // Converte "3.500,00" → "3500.00" para o servidor
  return formatted.replace(/\./g, '').replace(',', '.')
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegisterFormProps {
  unit: UnitPublic
  // Server Action com unit_slug e unit_id já vinculados via .bind()
  createLeadAction: (
    prevState: CreateLeadResult | null,
    formData: FormData,
  ) => Promise<CreateLeadResult>
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function RegisterForm({ unit, createLeadAction }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(createLeadAction, null)

  // Estado local do formulário
  const [selectedDream, setSelectedDream] = useState<DreamValue | ''>('')
  const [incomeDisplay, setIncomeDisplay]   = useState('')
  const [expenseDisplay, setExpenseDisplay] = useState('')
  const [phone, setPhone] = useState('')
  const [step, setStep]   = useState<'dream' | 'form'>('dream')

  // Captura UTMs da URL para enviar como hidden fields
  const [utms, setUtms] = useState({
    utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '',
  })

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setUtms({
      utm_source:   p.get('utm_source')   ?? '',
      utm_medium:   p.get('utm_medium')   ?? '',
      utm_campaign: p.get('utm_campaign') ?? '',
      utm_term:     p.get('utm_term')     ?? '',
      utm_content:  p.get('utm_content')  ?? '',
    })
  }, [])

  // Rola para topo ao mudar de etapa
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  // Cor primária da unidade (padrão roxo do DNA Financeiro)
  const primary = unit.primary_color
    ? `#${unit.primary_color.replace('#', '')}`
    : '#7F77DD'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={topRef}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: '#F5F4FB', minHeight: '100dvh' }}
    >
      {/* ── Cabeçalho ── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #EEEDFE',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#EEEDFE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>🧬</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: primary }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: '#999' }}>{unit.city} · {unit.state}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            background: '#E1F5EE', color: '#0F6E56',
            fontSize: 11, fontWeight: 600,
            padding: '3px 10px', borderRadius: 99,
          }}>Grátis</span>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* ── Etapa 1: escolha do sonho ── */}
        {step === 'dream' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', lineHeight: 1.25, margin: '0 0 10px' }}>
                Em 2 minutos você descobre<br />quanto pode guardar por mês
              </h1>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Diagnóstico financeiro gratuito e personalizado para {unit.city}.
              </p>
            </div>

            <p style={{ fontWeight: 700, fontSize: 14, color: '#333', marginBottom: 12 }}>
              Qual é o seu maior sonho?
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {DREAMS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setSelectedDream(d.value)}
                  style={{
                    border: selectedDream === d.value
                      ? `2px solid ${primary}`
                      : '1.5px solid #E8E8E8',
                    borderRadius: 14,
                    padding: '14px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    background: selectedDream === d.value ? '#EEEDFE' : '#fff',
                    transition: 'all .15s',
                    minHeight: 60,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{d.emoji}</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: selectedDream === d.value ? primary : '#444',
                    lineHeight: 1.3,
                  }}>{d.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!selectedDream}
              onClick={() => selectedDream && setStep('form')}
              style={{
                width: '100%',
                background: selectedDream ? primary : '#DDD',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                padding: '16px',
                fontSize: 16,
                fontWeight: 700,
                cursor: selectedDream ? 'pointer' : 'not-allowed',
                transition: 'background .2s',
              }}
            >
              Esse é meu sonho! →
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#BBB', marginTop: 12 }}>
              🔒 Seus dados são privados e seguros
            </p>
          </>
        )}

        {/* ── Etapa 2: formulário de cadastro ── */}
        {step === 'form' && (
          <>
            <button
              type="button"
              onClick={() => setStep('dream')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#999', fontSize: 13, display: 'flex', alignItems: 'center',
                gap: 6, marginBottom: 20, padding: 0, fontFamily: 'inherit',
              }}
            >
              ← Voltar
            </button>

            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A2E', margin: '0 0 6px' }}>
                Quase lá!
              </h2>
              <p style={{ color: '#666', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Só o essencial — leva menos de 1 minuto.
              </p>
            </div>

            {/* Sonho selecionado */}
            {selectedDream && (() => {
              const dream = DREAMS.find(d => d.value === selectedDream)!
              return (
                <div style={{
                  background: '#EEEDFE', borderRadius: 12,
                  padding: '12px 14px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>{dream.emoji}</span>
                  <div>
                    <p style={{ fontSize: 11, color: '#7F77DD', fontWeight: 600, margin: '0 0 1px' }}>Seu sonho</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#3C3489', margin: 0 }}>{dream.label}</p>
                  </div>
                </div>
              )
            })()}

            <form action={formAction} noValidate>
              {/* Hidden fields — resolvidos pelo servidor / capturados do client */}
              <input type="hidden" name="main_dream"    value={selectedDream} />
              <input type="hidden" name="utm_source"    value={utms.utm_source} />
              <input type="hidden" name="utm_medium"    value={utms.utm_medium} />
              <input type="hidden" name="utm_campaign"  value={utms.utm_campaign} />
              <input type="hidden" name="utm_term"      value={utms.utm_term} />
              <input type="hidden" name="utm_content"   value={utms.utm_content} />
              {/* ⚠️  Nunca adicionar unit_id ou campaign_id aqui */}

              {/* Nome */}
              <Field label="Seu nome" error={state?.success === false && state.field === 'name' ? state.error : undefined}>
                <input
                  name="name"
                  type="text"
                  placeholder="Ex: Maria Silva"
                  autoComplete="name"
                  required
                  style={inputStyle}
                />
              </Field>

              {/* Telefone */}
              <Field label="Telefone com DDD" error={state?.success === false && state.field === 'phone' ? state.error : undefined}>
                <input
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(65) 99999-9999"
                  autoComplete="tel"
                  inputMode="numeric"
                  required
                  style={inputStyle}
                />
              </Field>

              {/* Cidade */}
              <Field label="Sua cidade" error={state?.success === false && state.field === 'city' ? state.error : undefined}>
                <input
                  name="city"
                  type="text"
                  placeholder="Ex: Sinop"
                  autoComplete="address-level2"
                  defaultValue={unit.city}
                  required
                  style={inputStyle}
                />
              </Field>

              {/* Renda */}
              <Field
                label="Renda mensal aproximada"
                hint="Valor aproximado — não precisa ser exato"
                error={state?.success === false && state.field === 'monthly_income' ? state.error : undefined}
              >
                <div style={{ position: 'relative' }}>
                  <span style={prefixStyle}>R$</span>
                  <input
                    name="monthly_income"
                    type="text"
                    value={incomeDisplay}
                    onChange={e => setIncomeDisplay(formatCurrency(e.target.value))}
                    onBlur={e => {
                      // Submete o valor como float no hidden field
                      e.currentTarget.value = parseCurrencyToFloat(incomeDisplay)
                    }}
                    placeholder="3.500,00"
                    inputMode="numeric"
                    required
                    style={{ ...inputStyle, paddingLeft: 44 }}
                  />
                </div>
              </Field>

              {/* Despesas */}
              <Field
                label="Despesas mensais aproximadas"
                hint="Some aluguel, alimentação, transporte e outros gastos fixos"
                error={state?.success === false && state.field === 'monthly_expenses' ? state.error : undefined}
              >
                <div style={{ position: 'relative' }}>
                  <span style={prefixStyle}>R$</span>
                  <input
                    name="monthly_expenses"
                    type="text"
                    value={expenseDisplay}
                    onChange={e => setExpenseDisplay(formatCurrency(e.target.value))}
                    onBlur={e => {
                      e.currentTarget.value = parseCurrencyToFloat(expenseDisplay)
                    }}
                    placeholder="2.800,00"
                    inputMode="numeric"
                    required
                    style={{ ...inputStyle, paddingLeft: 44 }}
                  />
                </div>
              </Field>

              {/* Consentimentos */}
              <div style={{ marginBottom: 20 }}>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" name="consent_diagnosis" required style={{ marginTop: 2, accentColor: primary, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                    Li e concordo com a{' '}
                    <a href="/privacidade" target="_blank" style={{ color: primary }}>Política de Privacidade</a>
                    {' '}e autorizo o DNA Financeiro a usar meus dados para gerar meu diagnóstico.
                    <strong style={{ color: '#D85A30' }}> *</strong>
                  </span>
                </label>
                {state?.success === false && state.field === 'consent_diagnosis' && (
                  <p style={errorStyle}>{state.error}</p>
                )}

                <label style={{ ...checkboxLabelStyle, marginTop: 12 }}>
                  <input type="checkbox" name="consent_communications" style={{ marginTop: 2, accentColor: primary, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                    Quero receber dicas, oportunidades e notificações e aceito ser contactado pelo consultor da minha unidade.
                  </span>
                </label>
              </div>

              {/* Erro geral */}
              {state?.success === false && !state.field && (
                <div style={{
                  background: '#FAECE7', borderRadius: 10, padding: '12px 14px',
                  marginBottom: 16, color: '#993C1D', fontSize: 13,
                }}>
                  ⚠️ {state.error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                style={{
                  width: '100%',
                  background: isPending ? '#B0ABDD' : primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '16px',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  transition: 'background .2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isPending ? (
                  <>
                    <Spinner />
                    Salvando seu perfil...
                  </>
                ) : (
                  'Ver meu diagnóstico grátis →'
                )}
              </button>

              <p style={{ textAlign: 'center', fontSize: 11, color: '#BBB', marginTop: 12 }}>
                🔒 Seus dados são privados. Não vendemos informações.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes e estilos
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#fff',
  border: '1.5px solid #E8E8E8',
  borderRadius: 12,
  padding: '13px 14px',
  fontSize: 15,
  fontFamily: 'inherit',
  color: '#1A1A2E',
  outline: 'none',
  transition: 'border .15s',
  boxSizing: 'border-box',
}

const prefixStyle: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#999',
  fontSize: 15,
  fontWeight: 600,
  pointerEvents: 'none',
}

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  cursor: 'pointer',
}

const errorStyle: React.CSSProperties = {
  color: '#D85A30',
  fontSize: 12,
  marginTop: 5,
  margin: '5px 0 0',
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#333', marginBottom: 6 }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontSize: 12, color: '#999', margin: '-4px 0 6px' }}>{hint}</p>
      )}
      {children}
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  )
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
      <path d="M12 2a10 10 0 0 1 10 10" style={{ animation: 'spin .8s linear infinite', transformOrigin: 'center' }} />
    </svg>
  )
}
