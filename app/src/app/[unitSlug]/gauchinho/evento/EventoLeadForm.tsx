'use client'

// =============================================================================
// EventoLeadForm — Formulário do Evento Construtora
//
// Client Component. Envia POST para /api/[unitSlug]/eventos/gauchinho/leads.
// Após sucesso, exibe mensagem de confirmação.
// Não redireciona para o fluxo normal do DNA Financeiro.
// =============================================================================

import { useState }                  from 'react'
import type { CSSProperties } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Props {
  unitSlug:     string
  whatsappUrl:  string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

const INIT = {
  name:                        '',
  cpf:                         '',
  whatsapp:                    '',
  city:                        '',
  empreendimento:              '',
  torre:                       '',
  apartamento:                 '',
  valor_imovel:                '',
  valor_entrega:               '',
  valor_entrada_disponivel:    '',
  renda_aproximada:            '',
  melhor_horario_contato:      '',
  observacoes:                 '',
  precisa_financiamento:       false,
  interesse_consorcio:         false,
  interesse_carta_contemplada: false,
  interesse_credito:           false,
  interesse_plano_pontual:     false,
  interesse_nao_sei:           false,
  consent_contact:             false,
  consent_share_builder:       false,
}

// ── Máscaras ──────────────────────────────────────────────────────────────────

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3)  return d
  if (d.length <= 6)  return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9)  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCurrency(v: string): string {
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10)
  return (num / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseCurrency(v: string): number {
  if (!v) return 0
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
}

// ── Helpers de estilo ─────────────────────────────────────────────────────────

const purple     = '#7F77DD'
const purpleDeep = '#534AB7'
const purpleBg   = '#EEEDFE'
const green      = '#1D9E75'
const greenDark  = '#0F6E56'
const greenBg    = '#E1F5EE'
const border     = 'rgba(0,0,0,0.08)'
const text       = '#1A1A2E'
const textSec    = '#888'
const bgApp      = '#F5F4FB'
const amber      = '#EF9F27'
const amberBg    = '#FAEEDA'
const amberDark  = '#854F0B'

const inputStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${border}`,
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  outline: 'none',
  background: '#fff',
  color: text,
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: text,
  marginBottom: 5,
  display: 'block',
}

const fieldWrap: CSSProperties = {
  marginBottom: 14,
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function EventoLeadForm({ unitSlug, whatsappUrl }: Props) {
  const [form, setForm]     = useState({ ...INIT })
  const [status, setStatus] = useState<Status>('idle')
  const [errMsg, setErrMsg] = useState('')

  function setField(k: keyof typeof INIT, v: string | boolean) {
    setForm((prev: typeof INIT) => ({ ...prev, [k]: v }))
  }

  function toggleInterest(k: keyof typeof INIT) {
    if (k === 'interesse_nao_sei') {
      const next = !form.interesse_nao_sei
      setForm((prev: typeof INIT) => ({
        ...prev,
        interesse_nao_sei:           next,
        precisa_financiamento:       next ? false : prev.precisa_financiamento,
        interesse_consorcio:         next ? false : prev.interesse_consorcio,
        interesse_carta_contemplada: next ? false : prev.interesse_carta_contemplada,
        interesse_credito:           next ? false : prev.interesse_credito,
        interesse_plano_pontual:     next ? false : prev.interesse_plano_pontual,
      }))
      return
    }
    setForm((prev: typeof INIT) => ({
      ...prev,
      [k]: !prev[k as keyof typeof INIT],
      interesse_nao_sei: false,
    }))
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (!form.consent_contact) {
      setErrMsg('Autorize o contato para continuar.')
      return
    }
    setStatus('loading')
    setErrMsg('')

    try {
      const res = await fetch(`/api/${unitSlug}/eventos/gauchinho/leads`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:                        form.name.trim(),
          cpf:                         form.cpf.trim() || undefined,
          whatsapp:                    form.whatsapp.trim(),
          city:                        form.city.trim() || undefined,
          empreendimento:              form.empreendimento.trim() || undefined,
          torre:                       form.torre.trim() || undefined,
          apartamento:                 form.apartamento.trim() || undefined,
          valor_imovel:                form.valor_imovel ? parseCurrency(form.valor_imovel) : undefined,
          valor_entrega:               form.valor_entrega ? parseCurrency(form.valor_entrega) : undefined,
          valor_entrada_disponivel:    form.valor_entrada_disponivel ? parseCurrency(form.valor_entrada_disponivel) : undefined,
          renda_aproximada:            form.renda_aproximada ? parseCurrency(form.renda_aproximada) : undefined,
          melhor_horario_contato:      form.melhor_horario_contato || undefined,
          observacoes:                 form.observacoes.trim() || undefined,
          precisa_financiamento:       form.precisa_financiamento,
          interesse_consorcio:         form.interesse_consorcio,
          interesse_carta_contemplada: form.interesse_carta_contemplada,
          interesse_credito:           form.interesse_credito,
          interesse_plano_pontual:     form.interesse_plano_pontual,
          consent_contact:             true,
          consent_share_builder:       form.consent_share_builder,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrMsg(data.error ?? 'Erro ao enviar. Tente novamente.')
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setErrMsg('Erro de conexão. Verifique sua internet e tente novamente.')
      setStatus('error')
    }
  }

  // ── Tela de sucesso ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 20,
        border: `0.5px solid ${border}`,
        padding: '36px 24px',
        textAlign: 'center',
        maxWidth: 480,
        margin: '0 auto',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: text, margin: '0 0 10px', lineHeight: 1.3 }}>
          Cadastro realizado!
        </h2>
        <p style={{ fontSize: 14, color: textSec, lineHeight: 1.7, margin: '0 0 24px' }}>
          Recebemos seus dados. Nossa equipe vai analisar as melhores soluções
          para o pagamento do seu imóvel e entrar em contato em breve.
        </p>

        <div style={{
          background: greenBg,
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 20,
          textAlign: 'left',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: greenDark }}>
            O que acontece agora?
          </p>
          <p style={{ margin: 0, fontSize: 12, color: greenDark, lineHeight: 1.65 }}>
            Vamos avaliar seu perfil e entrar em contato para apresentar a melhor análise:
            consórcio, carta contemplada, financiamento ou crédito.
          </p>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            color: '#fff',
            borderRadius: 14,
            padding: '15px 20px',
            fontSize: 15,
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(37,211,102,.35)',
          }}
        >
          💬 Falar agora no WhatsApp
        </a>

        <p style={{ fontSize: 11, color: textSec, marginTop: 14 }}>
          Obrigado por se cadastrar. Até breve!
        </p>
      </div>
    )
  }

  const naoSei = form.interesse_nao_sei

  // ── Formulário ───────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* ── Dados pessoais ── */}
      <SectionTitle emoji="👤" text="Seus dados" />

      <div style={fieldWrap}>
        <label style={labelStyle}>Nome completo *</label>
        <input
          style={inputStyle}
          type="text"
          placeholder="Como você se chama?"
          value={form.name}
          onChange={(e: { target: { value: string } }) => setField('name', e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>WhatsApp *</label>
          <input
            style={inputStyle}
            type="tel"
            placeholder="(66) 99999-9999"
            value={form.whatsapp}
            onChange={(e: { target: { value: string } }) => setField('whatsapp', maskPhone(e.target.value))}
            required
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
        <div>
          <label style={labelStyle}>CPF <Opt /></label>
          <input
            style={inputStyle}
            type="text"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={(e: { target: { value: string } }) => setField('cpf', maskCPF(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Cidade</label>
        <input
          style={inputStyle}
          type="text"
          placeholder="Sua cidade"
          value={form.city}
          onChange={(e: { target: { value: string } }) => setField('city', e.target.value)}
          autoComplete="address-level2"
        />
      </div>

      {/* ── Dados do imóvel ── */}
      <SectionTitle emoji="🏠" text="Seu imóvel" />

      <div style={fieldWrap}>
        <label style={labelStyle}>Empreendimento</label>
        <input
          style={inputStyle}
          type="text"
          placeholder="Nome do empreendimento / condomínio"
          value={form.empreendimento}
          onChange={(e: { target: { value: string } }) => setField('empreendimento', e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Torre / Bloco <Opt /></label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Ex: Torre A"
            value={form.torre}
            onChange={(e: { target: { value: string } }) => setField('torre', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Apartamento <Opt /></label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Ex: 304"
            value={form.apartamento}
            onChange={(e: { target: { value: string } }) => setField('apartamento', e.target.value)}
          />
        </div>
      </div>

      {/* ── Valores ── */}
      <SectionTitle emoji="💰" text="Valores aproximados" />

      <div style={fieldWrap}>
        <label style={labelStyle}>Valor aproximado do imóvel</label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: textSec, pointerEvents: 'none',
          }}>R$</span>
          <input
            style={{ ...inputStyle, paddingLeft: 38 }}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={form.valor_imovel}
            onChange={(e: { target: { value: string } }) => setField('valor_imovel', maskCurrency(e.target.value))}
          />
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Valor que precisa pagar na entrega / chaves</label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: textSec, pointerEvents: 'none',
          }}>R$</span>
          <input
            style={{ ...inputStyle, paddingLeft: 38 }}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={form.valor_entrega}
            onChange={(e: { target: { value: string } }) => setField('valor_entrega', maskCurrency(e.target.value))}
          />
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Valor que já tem disponível</label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: textSec, pointerEvents: 'none',
          }}>R$</span>
          <input
            style={{ ...inputStyle, paddingLeft: 38 }}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={form.valor_entrada_disponivel}
            onChange={(e: { target: { value: string } }) => setField('valor_entrada_disponivel', maskCurrency(e.target.value))}
          />
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Renda familiar aproximada</label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: textSec, pointerEvents: 'none',
          }}>R$</span>
          <input
            style={{ ...inputStyle, paddingLeft: 38 }}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={form.renda_aproximada}
            onChange={(e: { target: { value: string } }) => setField('renda_aproximada', maskCurrency(e.target.value))}
          />
        </div>
      </div>

      {/* ── Melhor horário ── */}
      <div style={fieldWrap}>
        <label style={labelStyle}>Melhor horário para contato</label>
        <select
          style={{ ...inputStyle, appearance: 'none' as const, cursor: 'pointer' }}
          value={form.melhor_horario_contato}
          onChange={(e: { target: { value: string } }) => setField('melhor_horario_contato', e.target.value)}
        >
          <option value="">Selecione...</option>
          <option value="Manhã (8h–12h)">Manhã (8h–12h)</option>
          <option value="Tarde (12h–18h)">Tarde (12h–18h)</option>
          <option value="Noite (18h–21h)">Noite (18h–21h)</option>
          <option value="Qualquer horário">Qualquer horário</option>
        </select>
      </div>

      {/* ── Interesse ── */}
      <SectionTitle emoji="🎯" text="Qual solução tem interesse?" />

      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: `0.5px solid ${border}`,
        overflow: 'hidden',
        marginBottom: 14,
      }}>
        {[
          { key: 'precisa_financiamento',       label: 'Financiamento imobiliário', emoji: '🏦', desc: 'Crédito bancário para compra do imóvel' },
          { key: 'interesse_consorcio',          label: 'Consórcio',                emoji: '📅', desc: 'Compra programada sem juros' },
          { key: 'interesse_carta_contemplada',  label: 'Carta contemplada',        emoji: '💳', desc: 'Crédito já disponível para uso imediato' },
          { key: 'interesse_credito',            label: 'Crédito / empréstimo',     emoji: '💰', desc: 'Crédito pessoal ou FGTS' },
          { key: 'interesse_plano_pontual',      label: 'Plano Pontual',            emoji: '⚡', desc: 'Consórcio com prazo de 60 meses' },
          { key: 'interesse_nao_sei',            label: 'Ainda não sei',            emoji: '🤔', desc: 'Quero orientação para escolher a melhor opção' },
        ].map((item, i, arr) => {
          const isInterestKey = item.key !== 'interesse_nao_sei'
          const checked = form[item.key as keyof typeof INIT] as boolean
          const disabled = naoSei && isInterestKey

          return (
            <label
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 16px',
                borderBottom: i < arr.length - 1 ? `0.5px solid ${border}` : 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                background: checked ? purpleBg : '#fff',
                transition: 'background .15s',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => !disabled && toggleInterest(item.key as keyof typeof INIT)}
                disabled={disabled}
                style={{ width: 18, height: 18, accentColor: purple, flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
              />
              <span style={{ fontSize: 20, flexShrink: 0 }}>{item.emoji}</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: checked ? 600 : 400, color: checked ? purpleDeep : text }}>
                  {item.label}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: textSec }}>{item.desc}</p>
              </div>
            </label>
          )
        })}
      </div>

      {/* ── Observações ── */}
      <div style={fieldWrap}>
        <label style={labelStyle}>Observações <Opt /></label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          placeholder="Alguma informação adicional que queira compartilhar..."
          value={form.observacoes}
          onChange={(e: { target: { value: string } }) => setField('observacoes', e.target.value)}
          rows={3}
        />
      </div>

      {/* ── Consentimentos ── */}
      <SectionTitle emoji="🔒" text="Autorização" />

      <ConsentCheck
        checked={form.consent_contact}
        onChange={() => setField('consent_contact', !form.consent_contact)}
        required
        text="Autorizo receber contato sobre soluções financeiras para meu imóvel. *"
        color={green}
        bg={greenBg}
      />

      <ConsentCheck
        checked={form.consent_share_builder}
        onChange={() => setField('consent_share_builder', !form.consent_share_builder)}
        text="Autorizo o compartilhamento dos meus dados com a construtora/organização do evento para acompanhamento do atendimento."
        color={amber}
        bg={amberBg}
      />

      {/* ── Erro ── */}
      {(status === 'error' || errMsg) && (
        <div style={{
          background: '#FEE2E2',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 14,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: '#991B1B' }}>{errMsg}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          width: '100%',
          background: status === 'loading'
            ? 'rgba(127,119,221,0.5)'
            : `linear-gradient(135deg, ${purple} 0%, ${purpleDeep} 100%)`,
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '17px 20px',
          fontSize: 16,
          fontWeight: 700,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          boxShadow: status === 'loading' ? 'none' : '0 4px 28px rgba(127,119,221,.45)',
          transition: 'all .2s',
          letterSpacing: 0.2,
        }}
      >
        {status === 'loading' ? 'Enviando...' : 'Quero uma análise →'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: textSec, marginTop: 12 }}>
        🔒 Seus dados são privados e protegidos
      </p>
    </form>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SectionTitle({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 14px' }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: text, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: border }} />
    </div>
  )
}

function Opt() {
  return <span style={{ fontSize: 11, color: textSec, fontWeight: 400 }}>(opcional)</span>
}

function ConsentCheck({
  checked, onChange, required: req, text, color, bg,
}: {
  checked: boolean
  onChange: () => void
  required?: boolean
  text: string
  color: string
  bg: string
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      background: checked ? bg : '#fff',
      border: `1px solid ${checked ? color + '40' : border}`,
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 10,
      cursor: 'pointer',
      transition: 'all .15s',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        required={req}
        style={{ width: 18, height: 18, accentColor: color, flexShrink: 0, marginTop: 1, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 13, color: text, lineHeight: 1.55 }}>
        {text}
      </span>
    </label>
  )
}
