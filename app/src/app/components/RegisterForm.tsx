'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { UnitPublic, CreateLeadResult } from '@/types/database'
import { C } from './ui'

// ── Dream data ─────────────────────────────────────────────────────────────────
const DREAMS = [
  { value: 'carro',     label: 'Carro próprio',         emoji: '🚗' },
  { value: 'casa',      label: 'Casa própria',          emoji: '🏠' },
  { value: 'negocio',   label: 'Negócio próprio',       emoji: '🏪' },
  { value: 'viagem',    label: 'Viagem dos sonhos',      emoji: '✈️' },
  { value: 'reserva',   label: 'Reserva de emergência', emoji: '🐷' },
  { value: 'faculdade', label: 'Faculdade',              emoji: '🎓' },
  { value: 'reforma',   label: 'Reforma da casa',        emoji: '🔨' },
  { value: 'dividas',   label: 'Quitar dívidas',         emoji: '💳' },
  { value: 'moto',      label: 'Moto',                   emoji: '🏍️' },
] as const

type DreamValue = (typeof DREAMS)[number]['value']

// ── Formatters ────────────────────────────────────────────────────────────────
function formatCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function parseCurrencyToFloat(formatted: string): string {
  return formatted.replace(/\./g, '').replace(',', '.')
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface RegisterFormProps {
  unit: UnitPublic
  createLeadAction: (prevState: CreateLeadResult | null, formData: FormData) => Promise<CreateLeadResult>
}

// ── Component ─────────────────────────────────────────────────────────────────
export function RegisterForm({ unit, createLeadAction }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(createLeadAction, null)

  const [selectedDream, setSelectedDream] = useState<DreamValue | ''>('')
  const [incomeDisplay,  setIncomeDisplay]  = useState('')
  const [expenseDisplay, setExpenseDisplay] = useState('')
  const [phone, setPhone]   = useState('')
  const [step,  setStep]    = useState<'dream' | 'form'>('dream')
  const [utms,  setUtms]    = useState({
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

  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const primary = unit.primary_color ? `#${unit.primary_color.replace('#', '')}` : C.purple
  const progress = step === 'dream' ? 33 : 66

  return (
    <div ref={topRef} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: `0.5px solid ${C.purpleBg}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: C.purpleBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>🧬</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: primary }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: C.textSec }}>{unit.city} · {unit.state}</div>
        </div>
        <span style={{
          marginLeft: 'auto', background: C.greenBg, color: C.greenDark,
          fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
        }}>Grátis</span>
      </header>

      {/* ── Progress bar ── */}
      <div style={{ background: '#fff', padding: '10px 20px 12px', borderBottom: `0.5px solid ${C.purpleBg}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: C.textSec }}>Etapa {step === 'dream' ? '1' : '2'} de 2</span>
          <span style={{ fontSize: 11, color: primary, fontWeight: 500 }}>{progress}%</span>
        </div>
        <div style={{ background: C.bgSecondary, borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div style={{
            background: primary, height: '100%', borderRadius: 99,
            width: `${progress}%`, transition: 'width .3s',
          }} />
        </div>
      </div>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 48px' }}>

        {/* ── Step 1: Escolha do sonho ── */}
        {step === 'dream' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 20, fontWeight: 500, color: C.text, lineHeight: 1.35, margin: '0 0 6px' }}>
                Em 2 minutos você descobre<br />quanto pode guardar por mês
              </h1>
              <p style={{ color: C.textSec, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                Diagnóstico financeiro gratuito e personalizado para {unit.city}.
              </p>
            </div>

            <p style={{ fontWeight: 500, fontSize: 13, color: C.text, marginBottom: 10 }}>
              Qual é o seu maior sonho?
            </p>

            {/* 3-column dream grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {DREAMS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setSelectedDream(d.value)}
                  style={{
                    border: selectedDream === d.value
                      ? `1.5px solid ${primary}`
                      : `1.5px solid ${C.border}`,
                    borderRadius: 14, padding: '12px 6px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    cursor: 'pointer',
                    background: selectedDream === d.value ? C.purpleBg : '#fff',
                    transition: 'all .15s',
                    minHeight: 80, fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 24 }}>{d.emoji}</span>
                  <span style={{
                    fontSize: 11, textAlign: 'center', lineHeight: 1.3,
                    color: selectedDream === d.value ? C.purpleDeep : C.textSec,
                    fontWeight: selectedDream === d.value ? 500 : 400,
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
                background: selectedDream ? primary : 'rgba(0,0,0,0.1)',
                color: selectedDream ? '#fff' : C.textSec,
                border: 'none', borderRadius: 12, padding: '14px',
                fontSize: 15, fontWeight: 500,
                cursor: selectedDream ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'background .2s',
              }}
            >
              Esse é meu sonho! →
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 10 }}>
              🔒 Seus dados são privados e seguros
            </p>
          </>
        )}

        {/* ── Step 2: Formulário ── */}
        {step === 'form' && (
          <>
            <button
              type="button"
              onClick={() => setStep('dream')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.textSec, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 16, padding: 0, fontFamily: 'inherit',
              }}
            >
              ← Voltar
            </button>

            <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: '0 0 4px' }}>Quase lá!</h2>
            <p style={{ color: C.textSec, fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
              Só o essencial — leva menos de 1 minuto.
            </p>

            {/* Sonho selecionado */}
            {selectedDream && (() => {
              const dream = DREAMS.find(d => d.value === selectedDream)!
              return (
                <div style={{
                  background: C.purpleBg, borderRadius: 12,
                  padding: '12px 14px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>{dream.emoji}</span>
                  <div>
                    <p style={{ fontSize: 10, color: primary, fontWeight: 500, margin: '0 0 1px' }}>Seu sonho</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.purpleDark, margin: 0 }}>{dream.label}</p>
                  </div>
                </div>
              )
            })()}

            {/* Form card */}
            <div style={{
              background: '#fff', borderRadius: 16,
              border: `0.5px solid ${C.border}`, padding: '16px',
            }}>
              <form action={formAction} noValidate>
                <input type="hidden" name="main_dream"    value={selectedDream} />
                <input type="hidden" name="utm_source"    value={utms.utm_source} />
                <input type="hidden" name="utm_medium"    value={utms.utm_medium} />
                <input type="hidden" name="utm_campaign"  value={utms.utm_campaign} />
                <input type="hidden" name="utm_term"      value={utms.utm_term} />
                <input type="hidden" name="utm_content"   value={utms.utm_content} />

                <Field label="Seu nome" error={state?.success === false && state.field === 'name' ? state.error : undefined}>
                  <input name="name" type="text" placeholder="Ex: Maria Silva"
                    autoComplete="name" required style={inputSt} />
                </Field>

                <Field label="Telefone com DDD" error={state?.success === false && state.field === 'phone' ? state.error : undefined}>
                  <input name="phone" type="tel" value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))}
                    placeholder="(65) 99999-9999"
                    autoComplete="tel" inputMode="numeric" required style={inputSt} />
                </Field>

                <Field label="Sua cidade" error={state?.success === false && state.field === 'city' ? state.error : undefined}>
                  <input name="city" type="text" placeholder="Ex: Sinop"
                    autoComplete="address-level2" defaultValue={unit.city}
                    required style={inputSt} />
                </Field>

                <Field
                  label="Renda mensal aproximada"
                  hint="Valor aproximado — não precisa ser exato"
                  error={state?.success === false && state.field === 'monthly_income' ? state.error : undefined}
                >
                  <div style={{ position: 'relative' }}>
                    <span style={prefixSt}>R$</span>
                    <input name="monthly_income" type="text"
                      value={incomeDisplay}
                      onChange={e => setIncomeDisplay(formatCurrency(e.target.value))}
                      onBlur={e => { e.currentTarget.value = parseCurrencyToFloat(incomeDisplay) }}
                      placeholder="3.500,00" inputMode="numeric" required
                      style={{ ...inputSt, paddingLeft: 44 }} />
                  </div>
                </Field>

                <Field
                  label="Despesas mensais aproximadas"
                  hint="Aluguel, alimentação, transporte e gastos fixos"
                  error={state?.success === false && state.field === 'monthly_expenses' ? state.error : undefined}
                >
                  <div style={{ position: 'relative' }}>
                    <span style={prefixSt}>R$</span>
                    <input name="monthly_expenses" type="text"
                      value={expenseDisplay}
                      onChange={e => setExpenseDisplay(formatCurrency(e.target.value))}
                      onBlur={e => { e.currentTarget.value = parseCurrencyToFloat(expenseDisplay) }}
                      placeholder="2.800,00" inputMode="numeric" required
                      style={{ ...inputSt, paddingLeft: 44 }} />
                  </div>
                </Field>

                {/* Consentimentos */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" name="consent_diagnosis" required
                      style={{ marginTop: 3, accentColor: primary, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                      Li e concordo com a{' '}
                      <a href="/privacidade" target="_blank" style={{ color: primary }}>Política de Privacidade</a>
                      {' '}e autorizo o uso dos meus dados para gerar meu diagnóstico.
                      <strong style={{ color: C.coral }}> *</strong>
                    </span>
                  </label>
                  {state?.success === false && state.field === 'consent_diagnosis' && (
                    <p style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{state.error}</p>
                  )}

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 10 }}>
                    <input type="checkbox" name="consent_communications"
                      style={{ marginTop: 3, accentColor: primary, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
                      Quero receber dicas e ser contactado pelo consultor da minha unidade.
                    </span>
                  </label>
                </div>

                {state?.success === false && !state.field && (
                  <div style={{
                    background: C.coralBg, borderRadius: 10,
                    padding: '12px 14px', marginBottom: 12,
                    color: C.coralDark, fontSize: 13,
                  }}>
                    ⚠️ {state.error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    width: '100%',
                    background: isPending ? 'rgba(127,119,221,0.5)' : primary,
                    color: '#fff', border: 'none', borderRadius: 12,
                    padding: '14px', fontSize: 15, fontWeight: 500,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'background .2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {isPending ? (<><Spinner /> Salvando seu perfil...</>) : 'Ver meu diagnóstico grátis →'}
                </button>

                <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 10 }}>
                  🔒 Não vendemos seus dados
                </p>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', background: C.bgApp,
  border: `0.5px solid rgba(0,0,0,0.1)`,
  borderRadius: 10, padding: '12px',
  fontSize: 15, fontFamily: 'inherit', color: C.text,
  outline: 'none', boxSizing: 'border-box',
}

const prefixSt: React.CSSProperties = {
  position: 'absolute', left: 14, top: '50%',
  transform: 'translateY(-50%)',
  color: '#999', fontSize: 15, fontWeight: 500, pointerEvents: 'none',
}

function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontWeight: 500, fontSize: 12, color: '#555', marginBottom: 5 }}>
        {label}
      </label>
      {hint && <p style={{ fontSize: 11, color: C.textTer, margin: '-3px 0 5px' }}>{hint}</p>}
      {children}
      {error && <p style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  )
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
      <path d="M12 2a10 10 0 0 1 10 10"
        style={{ animation: 'spin .8s linear infinite', transformOrigin: 'center' }} />
    </svg>
  )
}
