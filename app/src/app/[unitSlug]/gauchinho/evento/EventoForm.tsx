'use client'

// =============================================================================
// EventoForm — Formulário público do evento Gauchinho x Construtora
//
// Client Component: usa useActionState para feedback do Server Action.
// 3 etapas progressivas — mobile-first, tema Gauchinho (azul + dourado).
// Todos os inputs são renderizados sempre no DOM (CSS show/hide por step),
// garantindo que os valores estejam presentes no FormData ao submeter.
// =============================================================================

import { useActionState, useState }   from 'react'
import { submitEventoLead, type EventoFormState } from './actions'

// ── Paleta Gauchinho ──────────────────────────────────────────────────────────
const G = {
  blue:       '#1B4F8A',
  blueMid:    '#2563A8',
  blueLight:  '#EBF2FA',
  blueBorder: '#BFCFE0',
  gold:       '#F4A300',
  goldLight:  '#FFF8E1',
  goldBorder: '#F4A30040',
  text:       '#1A2332',
  textSec:    '#5A6A7E',
  textTer:    '#94A3B8',
  border:     '#E2E8F0',
  bg:         '#F8FAFC',
  white:      '#FFFFFF',
  green:      '#1D9E75',
  greenLight: '#E8F7F2',
  error:      '#DC2626',
  errorLight: '#FEF2F2',
} as const

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  unitSlug:  string
  unitCity?: string
}

// ── Tipos internos ────────────────────────────────────────────────────────────

interface FormValues {
  name:                        string
  whatsapp:                    string
  cpf:                         string
  empreendimento:              string
  torre:                       string
  apartamento:                 string
  valor_imovel:                string
  valor_entrega:               string
  valor_entrada_disponivel:    string
  renda_aproximada:            string
  precisa_financiamento:       boolean
  interesse_consorcio:         boolean
  interesse_carta_contemplada: boolean
  interesse_credito:           boolean
  interesse_plano_pontual:     boolean
  melhor_horario_contato:      string
  observacoes:                 string
  consent_share_builder:       boolean
  consent_contact:             boolean
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EventoForm({ unitSlug, unitCity }: Props) {
  const [step, setStep]         = useState<1 | 2 | 3>(1)
  const [localErrors, setLocalErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  const [v, setV] = useState<FormValues>({
    name: '', whatsapp: '', cpf: '',
    empreendimento: '', torre: '', apartamento: '',
    valor_imovel: '', valor_entrega: '', valor_entrada_disponivel: '', renda_aproximada: '',
    precisa_financiamento: false, interesse_consorcio: false,
    interesse_carta_contemplada: false, interesse_credito: false,
    interesse_plano_pontual: false,
    melhor_horario_contato: '', observacoes: '',
    consent_share_builder: false, consent_contact: false,
  })

  // Bind server action com unitSlug
  const boundAction = submitEventoLead.bind(null, unitSlug)
  const [serverState, formAction, isPending] = useActionState<EventoFormState, FormData>(boundAction, null)

  // ── Validação step 1 ────────────────────────────────────────────────────────
  function validateStep1(): boolean {
    const errs: Partial<Record<keyof FormValues, string>> = {}
    if (!v.name.trim() || v.name.trim().length < 2) {
      errs.name = 'Nome é obrigatório.'
    }
    const wpp = v.whatsapp.replace(/\D/g, '')
    if (wpp.length < 10 || wpp.length > 11) {
      errs.whatsapp = 'Informe DDD + número. Ex: 66999001234'
    }
    setLocalErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNext() {
    if (step === 1) { if (validateStep1()) setStep(2) }
    else if (step === 2) { setStep(3) }
  }

  function handleBack() {
    setLocalErrors({})
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  // ── Tela de sucesso ─────────────────────────────────────────────────────────
  if (serverState?.success) {
    return (
      <div style={{
        background: G.white, borderRadius: 20,
        border: `1px solid ${G.greenLight}`,
        padding: '40px 24px', textAlign: 'center',
        boxShadow: '0 4px 24px rgba(29,158,117,.12)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
          background: G.greenLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: G.text, margin: '0 0 10px' }}>
          Cadastro realizado!
        </h2>
        <p style={{ fontSize: 14, color: G.textSec, lineHeight: 1.7, margin: '0 0 24px', maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
          Recebemos suas informações. O Gauchinho entrará em contato para apresentar as melhores opções para o seu apartamento.
        </p>
        <div style={{
          background: G.goldLight, borderRadius: 12,
          border: `1px solid ${G.goldBorder}`,
          padding: '14px 18px', marginBottom: 24,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: G.text, lineHeight: 1.6 }}>
            📱 Fique de olho no <strong>WhatsApp</strong>.<br />
            Atendimento: <strong>{unitCity ?? 'sua cidade'}</strong>
          </p>
        </div>
        <a
          href={`/${unitSlug}/gauchinho`}
          style={{
            display: 'inline-block', textDecoration: 'none',
            background: G.blue, color: G.white,
            borderRadius: 12, padding: '12px 24px',
            fontSize: 14, fontWeight: 600,
          }}
        >
          ← Voltar para o Gauchinho
        </a>
      </div>
    )
  }

  // ── Indicador de progresso ──────────────────────────────────────────────────
  const STEPS = [
    { n: 1, label: 'Contato'     },
    { n: 2, label: 'Apartamento' },
    { n: 3, label: 'Interesses'  },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <form action={formAction} style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Hidden inputs: carregam TODOS os valores do estado ao submeter ── */}
      <input type="hidden" name="name"                        value={v.name} />
      <input type="hidden" name="whatsapp"                    value={v.whatsapp.replace(/\D/g, '')} />
      <input type="hidden" name="cpf"                         value={v.cpf.replace(/\D/g, '')} />
      <input type="hidden" name="empreendimento"              value={v.empreendimento} />
      <input type="hidden" name="torre"                       value={v.torre} />
      <input type="hidden" name="apartamento"                 value={v.apartamento} />
      <input type="hidden" name="valor_imovel"                value={v.valor_imovel} />
      <input type="hidden" name="valor_entrega"               value={v.valor_entrega} />
      <input type="hidden" name="valor_entrada_disponivel"    value={v.valor_entrada_disponivel} />
      <input type="hidden" name="renda_aproximada"            value={v.renda_aproximada} />
      <input type="hidden" name="precisa_financiamento"       value={String(v.precisa_financiamento)} />
      <input type="hidden" name="interesse_consorcio"         value={String(v.interesse_consorcio)} />
      <input type="hidden" name="interesse_carta_contemplada" value={String(v.interesse_carta_contemplada)} />
      <input type="hidden" name="interesse_credito"           value={String(v.interesse_credito)} />
      <input type="hidden" name="interesse_plano_pontual"     value={String(v.interesse_plano_pontual)} />
      <input type="hidden" name="melhor_horario_contato"      value={v.melhor_horario_contato} />
      <input type="hidden" name="observacoes"                 value={v.observacoes} />
      <input type="hidden" name="consent_share_builder"       value={String(v.consent_share_builder)} />
      <input type="hidden" name="consent_contact"             value={String(v.consent_contact)} />

      {/* ── Stepper ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: step === s.n
                  ? G.blue
                  : step > s.n ? G.green : G.border,
                color: step >= s.n ? G.white : G.textTer,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: step > s.n ? 14 : 13, fontWeight: 700,
                flexShrink: 0, transition: 'all .2s',
              }}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 500,
                color: step === s.n ? G.blue : step > s.n ? G.green : G.textTer,
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 4px',
                background: step > s.n
                  ? `linear-gradient(90deg, ${G.green}, ${G.green})`
                  : G.border,
                marginBottom: 16, transition: 'all .2s',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1 — Contato                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: step === 1 ? 'block' : 'none' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: G.text, marginBottom: 4 }}>
            🙋 Quem é você?
          </div>
          <p style={{ fontSize: 13, color: G.textSec, margin: 0 }}>
            Começamos com o básico. Leva menos de 30 segundos.
          </p>
        </div>

        <Field label="Nome completo *" error={localErrors.name}>
          <input
            type="text"
            placeholder="Seu nome completo"
            value={v.name}
            onChange={e => setV(x => ({ ...x, name: e.target.value }))}
            autoComplete="name"
            style={inputStyle(!!localErrors.name)}
          />
        </Field>

        <Field
          label="WhatsApp com DDD *"
          error={localErrors.whatsapp}
          hint="Ex: 66 99900-1234"
        >
          <input
            type="tel"
            placeholder="(66) 99900-1234"
            value={v.whatsapp}
            onChange={e => setV(x => ({ ...x, whatsapp: e.target.value }))}
            autoComplete="tel"
            maxLength={16}
            style={inputStyle(!!localErrors.whatsapp)}
          />
        </Field>

        <Field label="CPF (opcional)" hint="Se quiser agilizar a análise de crédito">
          <input
            type="text"
            placeholder="000.000.000-00"
            value={v.cpf}
            onChange={e => setV(x => ({ ...x, cpf: e.target.value }))}
            inputMode="numeric"
            maxLength={14}
            style={inputStyle(false)}
          />
        </Field>

        <button
          type="button"
          onClick={handleNext}
          style={primaryBtn}
        >
          Próximo — Dados do apartamento →
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2 — Apartamento                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: step === 2 ? 'block' : 'none' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: G.text, marginBottom: 4 }}>
            🏗️ Seu apartamento
          </div>
          <p style={{ fontSize: 13, color: G.textSec, margin: 0 }}>
            Preencha o que souber. Todos os campos são opcionais aqui.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Empreendimento">
            <input
              type="text"
              placeholder="Nome do empreendimento"
              value={v.empreendimento}
              onChange={e => setV(x => ({ ...x, empreendimento: e.target.value }))}
              style={inputStyle(false)}
            />
          </Field>
          <Field label="Torre / Bloco">
            <input
              type="text"
              placeholder="Ex: A"
              value={v.torre}
              onChange={e => setV(x => ({ ...x, torre: e.target.value }))}
              style={inputStyle(false)}
            />
          </Field>
        </div>

        <Field label="Número do apartamento">
          <input
            type="text"
            placeholder="Ex: 304"
            value={v.apartamento}
            onChange={e => setV(x => ({ ...x, apartamento: e.target.value }))}
            style={inputStyle(false)}
          />
        </Field>

        <div style={{
          background: G.goldLight, borderRadius: 12,
          border: `1px solid ${G.goldBorder}`,
          padding: '12px 14px', marginBottom: 16,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: '#92620A', fontWeight: 500 }}>
            💡 Valores aproximados — ajudam a calcular o melhor caminho
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Valor do imóvel">
            <input
              type="text"
              placeholder="R$ 0,00"
              value={v.valor_imovel}
              onChange={e => setV(x => ({ ...x, valor_imovel: e.target.value }))}
              inputMode="numeric"
              style={inputStyle(false)}
            />
          </Field>
          <Field label="Valor de entrega">
            <input
              type="text"
              placeholder="R$ 0,00"
              value={v.valor_entrega}
              onChange={e => setV(x => ({ ...x, valor_entrega: e.target.value }))}
              inputMode="numeric"
              style={inputStyle(false)}
            />
          </Field>
          <Field label="Entrada disponível">
            <input
              type="text"
              placeholder="R$ 0,00"
              value={v.valor_entrada_disponivel}
              onChange={e => setV(x => ({ ...x, valor_entrada_disponivel: e.target.value }))}
              inputMode="numeric"
              style={inputStyle(false)}
            />
          </Field>
          <Field label="Renda aproximada">
            <input
              type="text"
              placeholder="R$ 0,00/mês"
              value={v.renda_aproximada}
              onChange={e => setV(x => ({ ...x, renda_aproximada: e.target.value }))}
              inputMode="numeric"
              style={inputStyle(false)}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" onClick={handleBack} style={backBtn}>
            ← Voltar
          </button>
          <button type="button" onClick={handleNext} style={{ ...primaryBtn, flex: 1 }}>
            Próximo — Interesses →
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STEP 3 — Interesses + LGPD                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: step === 3 ? 'block' : 'none' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: G.text, marginBottom: 4 }}>
            💬 O que te interessa?
          </div>
          <p style={{ fontSize: 13, color: G.textSec, margin: 0 }}>
            Marque tudo que se aplica ao seu momento.
          </p>
        </div>

        {/* Interesses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'precisa_financiamento'       as keyof FormValues, label: '🏦 Precisa de financiamento imobiliário' },
            { key: 'interesse_consorcio'          as keyof FormValues, label: '🤝 Quer entender o consórcio imobiliário' },
            { key: 'interesse_carta_contemplada'  as keyof FormValues, label: '🎯 Quer saber sobre carta contemplada' },
            { key: 'interesse_credito'            as keyof FormValues, label: '💳 Precisa de crédito para complemento' },
            { key: 'interesse_plano_pontual'      as keyof FormValues, label: '📅 Quer conhecer o Plano Pontual' },
          ].map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: v[key] ? G.blueLight : G.white,
                border: `1.5px solid ${v[key] ? G.blueBorder : G.border}`,
                borderRadius: 12, padding: '13px 14px',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <input
                type="checkbox"
                checked={v[key] as boolean}
                onChange={e => setV(x => ({ ...x, [key]: e.target.checked }))}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: G.blue, flexShrink: 0 }}
              />
              <span style={{ fontSize: 14, color: G.text, lineHeight: 1.4 }}>{label}</span>
            </label>
          ))}
        </div>

        <Field label="Melhor horário para contato" hint="Ex: manhã, tarde, após 18h">
          <select
            value={v.melhor_horario_contato}
            onChange={e => setV(x => ({ ...x, melhor_horario_contato: e.target.value }))}
            style={{ ...inputStyle(false), color: v.melhor_horario_contato ? G.text : G.textTer }}
          >
            <option value="">Sem preferência</option>
            <option value="manhã">Manhã (8h – 12h)</option>
            <option value="tarde">Tarde (12h – 18h)</option>
            <option value="noite">Noite (18h – 21h)</option>
            <option value="qualquer">Qualquer horário</option>
          </select>
        </Field>

        <Field label="Observações">
          <textarea
            placeholder="Alguma dúvida ou situação específica que o Gauchinho deva saber?"
            value={v.observacoes}
            onChange={e => setV(x => ({ ...x, observacoes: e.target.value }))}
            rows={3}
            style={{
              ...inputStyle(false),
              resize: 'vertical', minHeight: 80, lineHeight: 1.6,
            }}
          />
        </Field>

        {/* LGPD */}
        <div style={{
          background: G.bg, borderRadius: 14,
          border: `1px solid ${G.border}`,
          padding: '16px', marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            🔒 Consentimentos (LGPD)
          </p>

          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={v.consent_contact}
              onChange={e => setV(x => ({ ...x, consent_contact: e.target.checked }))}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: G.blue, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: G.text, lineHeight: 1.55 }}>
              <strong>Autorizo o Gauchinho Soluções Financeiras</strong> a entrar em contato comigo
              para apresentar soluções financeiras para o meu apartamento.
            </span>
          </label>

          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={v.consent_share_builder}
              onChange={e => setV(x => ({ ...x, consent_share_builder: e.target.checked }))}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: G.gold, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: G.text, lineHeight: 1.55 }}>
              <strong>Autorizo o compartilhamento dos meus dados com a construtora</strong> para
              análise de viabilidade do meu apartamento.
            </span>
          </label>
        </div>

        {/* Erro do servidor */}
        {serverState && !serverState.success && (
          <div style={{
            background: G.errorLight, border: `1px solid ${G.error}20`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 16,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: G.error }}>
              ⚠️ {serverState.error}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={handleBack} style={backBtn}>
            ← Voltar
          </button>
          <button
            type="submit"
            disabled={isPending || !v.consent_contact}
            style={{
              ...primaryBtn,
              flex: 1,
              opacity: isPending || !v.consent_contact ? 0.6 : 1,
              cursor:  isPending || !v.consent_contact ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Enviando...' : '✅ Enviar cadastro'}
          </button>
        </div>

        {!v.consent_contact && (
          <p style={{ textAlign: 'center', fontSize: 11, color: G.textTer, marginTop: 8 }}>
            Aceite o consentimento de contato para finalizar.
          </p>
        )}
      </div>

    </form>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Field({
  label, children, error, hint,
}: {
  label: string
  children: React.ReactNode
  error?: string
  hint?: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 600,
        color: error ? G.error : G.text, marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: G.textTer }}>{hint}</p>
      )}
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: G.error }}>{error}</p>
      )}
    </div>
  )
}

// ── Estilos compartilhados ────────────────────────────────────────────────────

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    border: `1.5px solid ${hasError ? G.error : G.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    outline: 'none',
    background: hasError ? G.errorLight : G.white,
    color: G.text,
    boxSizing: 'border-box',
  }
}

const primaryBtn: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'center',
  background: `linear-gradient(135deg, ${G.blue} 0%, ${G.blueMid} 100%)`,
  color: G.white,
  border: 'none',
  borderRadius: 12,
  padding: '15px 20px',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  boxShadow: `0 4px 20px ${G.blue}40`,
  letterSpacing: 0.2,
}

const backBtn: React.CSSProperties = {
  background: 'transparent',
  color: G.textSec,
  border: `1.5px solid ${G.border}`,
  borderRadius: 12,
  padding: '15px 18px',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  whiteSpace: 'nowrap',
}
