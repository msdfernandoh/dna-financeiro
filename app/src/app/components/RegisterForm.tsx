'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { UnitPublic, CreateLeadResult } from '@/types/database'
import { C } from './ui'

// ── Dream options (12-item grid) ─────────────────────────────────────────────

const DREAM_OPTIONS = [
  { dreamKey: 'carro_comprar',             mainDream: 'carro',                    label: 'Carro próprio',           emoji: '🚗' },
  { dreamKey: 'carro_trocar',              mainDream: 'carro',                    label: 'Trocar de carro',          emoji: '🔄' },
  { dreamKey: 'casa',                      mainDream: 'casa',                     label: 'Casa própria',             emoji: '🏠' },
  { dreamKey: 'dividas',                   mainDream: 'dividas',                  label: 'Quitar dívidas',           emoji: '💳' },
  { dreamKey: 'negocio',                   mainDream: 'negocio',                  label: 'Negócio próprio',          emoji: '🏪' },
  { dreamKey: 'caminhao',                  mainDream: 'caminhao',                 label: 'Caminhão próprio',         emoji: '🚛' },
  { dreamKey: 'aposentadoria_imobiliaria', mainDream: 'aposentadoria_imobiliaria',label: 'Aposent. imobiliária',     emoji: '🏦' },
  { dreamKey: 'reserva',                   mainDream: 'reserva',                  label: 'Reserva de emergência',    emoji: '🐷' },
  { dreamKey: 'faculdade',                 mainDream: 'faculdade',                label: 'Faculdade',                emoji: '🎓' },
  { dreamKey: 'viagem',                    mainDream: 'viagem',                   label: 'Viagem dos sonhos',        emoji: '✈️' },
  { dreamKey: 'reforma',                   mainDream: 'reforma',                  label: 'Reforma da casa',          emoji: '🔨' },
  { dreamKey: 'moto',                      mainDream: 'moto',                     label: 'Moto',                     emoji: '🏍️' },
] as const

type DreamKey = (typeof DREAM_OPTIONS)[number]['dreamKey']

// ── Subtypes (perguntas de qualificação) ────────────────────────────────────

const DREAM_SUBTYPES: Partial<Record<DreamKey, { value: string; label: string }[]>> = {
  carro_comprar: [
    { value: 'financiado',     label: 'Quero financiar' },
    { value: 'a_vista',        label: 'Quero pagar à vista' },
    { value: 'consorcio',      label: 'Prefiro consórcio' },
  ],
  carro_trocar: [
    { value: 'entrada_carro',  label: 'Usar meu carro como entrada' },
    { value: 'vender_comprar', label: 'Vender e comprar outro' },
    { value: 'financiar_novo', label: 'Financiar o novo' },
  ],
  casa: [
    { value: 'comprar_pronta', label: 'Comprar pronta' },
    { value: 'construir',      label: 'Construir' },
    { value: 'financiamento',  label: 'Financiamento habitacional' },
  ],
  caminhao: [
    { value: 'renda_autonoma', label: 'Para renda autônoma (frete)' },
    { value: 'empresa',        label: 'Para minha empresa' },
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
    { value: 'cartao',      label: 'Cartão de crédito' },
    { value: 'emprestimo',  label: 'Empréstimo / cheque especial' },
    { value: 'varias',      label: 'Várias dívidas ao mesmo tempo' },
  ],
}

// ── Sugestões de valor por tipo ──────────────────────────────────────────────

const DREAM_AMOUNTS: Partial<Record<DreamKey, { label: string; value: number }[]>> = {
  carro_comprar:             [{ label: 'R$ 30.000', value: 30000 }, { label: 'R$ 50.000', value: 50000 }, { label: 'R$ 80.000', value: 80000 }],
  carro_trocar:              [{ label: 'R$ 20.000', value: 20000 }, { label: 'R$ 40.000', value: 40000 }, { label: 'R$ 60.000', value: 60000 }],
  casa:                      [{ label: 'R$ 150.000', value: 150000 }, { label: 'R$ 250.000', value: 250000 }, { label: 'R$ 400.000', value: 400000 }],
  caminhao:                  [{ label: 'R$ 100.000', value: 100000 }, { label: 'R$ 180.000', value: 180000 }, { label: 'R$ 300.000', value: 300000 }],
  aposentadoria_imobiliaria: [{ label: 'R$ 100.000', value: 100000 }, { label: 'R$ 200.000', value: 200000 }, { label: 'R$ 500.000', value: 500000 }],
  negocio:                   [{ label: 'R$ 20.000', value: 20000 }, { label: 'R$ 50.000', value: 50000 }, { label: 'R$ 100.000', value: 100000 }],
  dividas:                   [{ label: 'R$ 5.000', value: 5000 }, { label: 'R$ 15.000', value: 15000 }, { label: 'R$ 30.000', value: 30000 }],
  reserva:                   [{ label: 'R$ 5.000', value: 5000 }, { label: 'R$ 10.000', value: 10000 }, { label: 'R$ 20.000', value: 20000 }],
  faculdade:                 [{ label: 'R$ 5.000', value: 5000 }, { label: 'R$ 15.000', value: 15000 }, { label: 'R$ 30.000', value: 30000 }],
  viagem:                    [{ label: 'R$ 5.000', value: 5000 }, { label: 'R$ 10.000', value: 10000 }, { label: 'R$ 20.000', value: 20000 }],
  reforma:                   [{ label: 'R$ 10.000', value: 10000 }, { label: 'R$ 25.000', value: 25000 }, { label: 'R$ 50.000', value: 50000 }],
  moto:                      [{ label: 'R$ 8.000', value: 8000 }, { label: 'R$ 15.000', value: 15000 }, { label: 'R$ 25.000', value: 25000 }],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RegisterFormProps {
  unit: UnitPublic
  createLeadAction: (prevState: CreateLeadResult | null, formData: FormData) => Promise<CreateLeadResult>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RegisterForm({ unit, createLeadAction }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(createLeadAction, null)

  const [step, setStep] = useState<'welcome' | 'dream' | 'subtype' | 'amount' | 'form'>('welcome')
  const [selectedKey,    setSelectedKey]    = useState<DreamKey | ''>('')
  const [selectedSubtype, setSelectedSubtype] = useState('')
  const [selectedAmountLabel, setSelectedAmountLabel] = useState('')   // label do botão escolhido
  const [selectedAmountNum,   setSelectedAmountNum]   = useState(0)    // valor numérico
  const [customAmount, setCustomAmount] = useState('')                  // input livre
  const [intentEmpress, setIntentEmpress] = useState(false)
  const [income,   setIncome]   = useState('')
  const [expenses, setExpenses] = useState('')
  const [phone, setPhone]       = useState('')
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

  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const primary = unit.primary_color ? `#${unit.primary_color.replace('#', '')}` : C.purple

  // Dados do sonho selecionado
  const selectedOption = DREAM_OPTIONS.find(d => d.dreamKey === selectedKey)
  const mainDream      = selectedOption?.mainDream ?? ''
  const hasSubtype     = selectedKey ? selectedKey in DREAM_SUBTYPES : false

  // Valor efetivo para enviar ao servidor
  const effectiveAmountNum   = selectedAmountLabel === 'custom' ? parseAmount(customAmount) : selectedAmountNum
  const effectiveAmountLabel = selectedAmountLabel === 'custom' ? (customAmount || 'Outro valor') : selectedAmountLabel
  const canProceedAmount     = effectiveAmountNum > 0

  // Progresso
  const PROGRESS_MAP: Record<string, number> = { dream: 20, subtype: 45, amount: 65, form: 82 }
  const progress = PROGRESS_MAP[step] ?? 0

  // ── Tela de boas-vindas ──────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div ref={topRef} style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        minHeight: '100dvh', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'linear-gradient(160deg, #0d0b1e 0%, #1a1547 55%, #0c0b1a 100%)',
        backgroundImage: [
          'linear-gradient(160deg, #0d0b1e 0%, #1a1547 55%, #0c0b1a 100%)',
          'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: 'cover, 28px 28px',
      }}>
        <style>{`
          @keyframes dna-pulse {
            0%,100%{opacity:.55;transform:scale(1)}
            50%{opacity:1;transform:scale(1.08)}
          }
          @keyframes dna-float {
            0%,100%{transform:translateY(0)}
            50%{transform:translateY(-9px)}
          }
          @keyframes dna-glow-spin {
            from{transform:rotate(0deg)}
            to{transform:rotate(360deg)}
          }
        `}</style>

        {/* Orbs de luz */}
        <div style={{
          position:'absolute', top:-140, right:-100, width:420, height:420,
          background:'radial-gradient(circle, rgba(127,119,221,.38) 0%, transparent 65%)',
          animation:'dna-pulse 5s ease-in-out infinite', pointerEvents:'none',
        }}/>
        <div style={{
          position:'absolute', bottom:-100, left:-120, width:380, height:380,
          background:'radial-gradient(circle, rgba(29,158,117,.22) 0%, transparent 65%)',
          animation:'dna-pulse 6s ease-in-out infinite 1.5s', pointerEvents:'none',
        }}/>
        <div style={{
          position:'absolute', top:'38%', left:'55%', width:260, height:260,
          background:'radial-gradient(circle, rgba(239,159,39,.12) 0%, transparent 65%)',
          animation:'dna-pulse 7s ease-in-out infinite 3s', pointerEvents:'none',
        }}/>

        {/* Conteúdo */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', padding:'52px 24px 40px',
          position:'relative', zIndex:1, width:'100%', maxWidth:420,
        }}>

          {/* Ícone com anel de glow */}
          <div style={{
            position:'relative', marginBottom:28,
            animation:'dna-float 3.5s ease-in-out infinite',
          }}>
            <div style={{
              position:'absolute', inset:-10,
              background:'conic-gradient(from 0deg, rgba(127,119,221,0), rgba(127,119,221,.6), rgba(29,158,117,.4), rgba(127,119,221,0))',
              borderRadius:'50%', animation:'dna-glow-spin 4s linear infinite', filter:'blur(4px)',
            }}/>
            <div style={{
              width:80, height:80, borderRadius:24,
              background:'linear-gradient(135deg, rgba(127,119,221,.22), rgba(83,74,183,.12))',
              border:'1.5px solid rgba(127,119,221,.45)',
              backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:40,
              position:'relative',
              boxShadow:'0 0 0 10px rgba(127,119,221,.07), 0 0 60px rgba(127,119,221,.3)',
            }}>🧬</div>
          </div>

          {/* Título */}
          <h1 style={{
            fontSize:38, fontWeight:700, color:'#fff', textAlign:'center',
            lineHeight:1.15, margin:'0 0 6px', letterSpacing:-0.8,
          }}>
            DNA
            <br/>
            <span style={{
              background:'linear-gradient(135deg, #C4BFFF 0%, #8F87E8 40%, #534AB7 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
            }}>Financeiro</span>
          </h1>

          <p style={{
            fontSize:14, color:'rgba(255,255,255,.52)', textAlign:'center',
            lineHeight:1.7, margin:'0 0 30px', maxWidth:270,
          }}>
            Seu consultor financeiro com IA para organizar sua vida, conquistar sonhos e encontrar oportunidades.
          </p>

          {/* Card glassmorphism com features */}
          <div style={{
            width:'100%',
            background:'rgba(255,255,255,.055)',
            border:'1px solid rgba(255,255,255,.1)',
            borderRadius:20, overflow:'hidden',
            backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
            boxShadow:'0 8px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.09)',
            marginBottom:24,
          }}>
            {([
              { icon:'📊', text:'Diagnóstico financeiro personalizado',  accent:'rgba(127,119,221,.22)', tc:'#A89EFF' },
              { icon:'🎯', text:'Plano real para conquistar seus sonhos', accent:'rgba(127,119,221,.22)', tc:'#A89EFF' },
              { icon:'💰', text:'Oportunidades de renda extra',          accent:'rgba(29,158,117,.2)',   tc:'#4ECBA3' },
            ] as const).map(({ icon, text, accent, tc }, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:14, padding:'15px 18px',
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,.07)' : 'none',
              }}>
                <div style={{
                  width:36, height:36, borderRadius:10, background:accent, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:17,
                }}>{icon}</div>
                <span style={{ fontSize:14, color:tc, fontWeight:500 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Botões */}
          <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
            <button
              type="button"
              onClick={() => setStep('dream')}
              style={{
                width:'100%', border:'none', borderRadius:14, padding:'16px',
                fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                background:'linear-gradient(135deg, #7F77DD 0%, #534AB7 100%)',
                color:'#fff',
                boxShadow:'0 4px 28px rgba(127,119,221,.5), inset 0 1px 0 rgba(255,255,255,.18)',
                letterSpacing:0.2,
              }}
            >
              Começar minha jornada
            </button>
            <a
              href={`/${unit.slug}/entrar`}
              style={{
                display:'block', width:'100%', borderRadius:14, padding:'16px',
                fontSize:15, fontWeight:400, cursor:'pointer', fontFamily:'inherit',
                background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.6)',
                border:'1px solid rgba(255,255,255,.13)',
                textDecoration:'none', textAlign:'center', boxSizing:'border-box',
              }}
            >
              Já tenho conta — entrar
            </a>
          </div>

          <p style={{ fontSize:11, color:'rgba(255,255,255,.22)', marginTop:18, textAlign:'center' }}>
            🔒 Gratuito · Seguro · Sem compromisso
          </p>
        </div>
      </div>
    )
  }

  // ── Layout compartilhado das etapas ──────────────────────────────────────

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
          <span style={{ fontSize: 11, color: C.textSec }}>Diagnóstico gratuito</span>
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

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP: DREAM SELECTION                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
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

            {/* 3-column dream grid (12 items) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {DREAM_OPTIONS.map((d) => (
                <button
                  key={d.dreamKey}
                  type="button"
                  onClick={() => setSelectedKey(d.dreamKey)}
                  style={{
                    border: selectedKey === d.dreamKey
                      ? `1.5px solid ${primary}`
                      : `1.5px solid ${C.border}`,
                    borderRadius: 14, padding: '12px 6px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    cursor: 'pointer',
                    background: selectedKey === d.dreamKey ? C.purpleBg : '#fff',
                    transition: 'all .15s',
                    minHeight: 80, fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 24 }}>{d.emoji}</span>
                  <span style={{
                    fontSize: 10, textAlign: 'center', lineHeight: 1.3,
                    color: selectedKey === d.dreamKey ? C.purpleDeep : C.textSec,
                    fontWeight: selectedKey === d.dreamKey ? 600 : 400,
                  }}>{d.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!selectedKey}
              onClick={() => {
                if (!selectedKey) return
                if (selectedKey in DREAM_SUBTYPES) {
                  setSelectedSubtype('')
                  setStep('subtype')
                } else {
                  setStep('amount')
                }
              }}
              style={{
                width: '100%',
                background: selectedKey ? primary : 'rgba(0,0,0,0.1)',
                color: selectedKey ? '#fff' : C.textSec,
                border: 'none', borderRadius: 12, padding: '14px',
                fontSize: 15, fontWeight: 500,
                cursor: selectedKey ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'background .2s',
                marginBottom: 8,
              }}
            >
              Esse é meu sonho! →
            </button>

            {/* ── DNA Empresarial CTA ── */}
            <div style={{
              marginTop: 20,
              border: `1px dashed ${C.border}`,
              borderRadius: 14, padding: '14px 16px',
              background: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: '#EFF6FF', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>🏢</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>Tem CNPJ?</p>
                  <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>DNA Empresarial para MEIs e PMEs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedKey('negocio')
                  setIntentEmpress(true)
                  setStep('form')
                }}
                style={{
                  width: '100%', border: `1px solid #3B82F6`, borderRadius: 10,
                  padding: '10px 14px', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: '#EFF6FF', color: '#1D4ED8',
                  transition: 'all .15s',
                }}
              >
                Fazer DNA Empresarial →
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 12 }}>
              🔒 Seus dados são privados e seguros
            </p>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP: SUBTYPE                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 'subtype' && selectedKey && selectedOption && (
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

            {/* Sonho badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: C.purpleBg, borderRadius: 12,
              padding: '10px 14px', marginBottom: 20,
            }}>
              <span style={{ fontSize: 20 }}>{selectedOption.emoji}</span>
              <div>
                <p style={{ fontSize: 10, color: primary, fontWeight: 600, margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: 0.4 }}>Sonho selecionado</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.purpleDeep, margin: 0 }}>{selectedOption.label}</p>
              </div>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>
              Como você pretende realizar esse sonho?
            </h2>
            <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 16px', lineHeight: 1.5 }}>
              Isso ajuda seu consultor a personalizar o diagnóstico.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {(DREAM_SUBTYPES[selectedKey] ?? []).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedSubtype(opt.value)}
                  style={{
                    border: selectedSubtype === opt.value
                      ? `1.5px solid ${primary}`
                      : `1.5px solid ${C.border}`,
                    borderRadius: 12, padding: '13px 16px',
                    textAlign: 'left', cursor: 'pointer',
                    background: selectedSubtype === opt.value ? C.purpleBg : '#fff',
                    fontFamily: 'inherit', transition: 'all .15s',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selectedSubtype === opt.value ? primary : C.border}`,
                    background: selectedSubtype === opt.value ? primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedSubtype === opt.value && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    )}
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: selectedSubtype === opt.value ? 600 : 400,
                    color: selectedSubtype === opt.value ? C.purpleDeep : C.text,
                  }}>{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!selectedSubtype}
              onClick={() => selectedSubtype && setStep('amount')}
              style={{
                width: '100%',
                background: selectedSubtype ? primary : 'rgba(0,0,0,0.1)',
                color: selectedSubtype ? '#fff' : C.textSec,
                border: 'none', borderRadius: 12, padding: '14px',
                fontSize: 15, fontWeight: 500,
                cursor: selectedSubtype ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'background .2s',
              }}
            >
              Continuar →
            </button>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP: AMOUNT                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 'amount' && selectedKey && selectedOption && (
          <>
            <button
              type="button"
              onClick={() => setStep(hasSubtype ? 'subtype' : 'dream')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.textSec, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 16, padding: 0, fontFamily: 'inherit',
              }}
            >
              ← Voltar
            </button>

            {/* Sonho badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: C.purpleBg, borderRadius: 12,
              padding: '10px 14px', marginBottom: 20,
            }}>
              <span style={{ fontSize: 20 }}>{selectedOption.emoji}</span>
              <div>
                <p style={{ fontSize: 10, color: primary, fontWeight: 600, margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: 0.4 }}>Sonho selecionado</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.purpleDeep, margin: 0 }}>{selectedOption.label}</p>
              </div>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>
              Qual o valor estimado desse sonho?
            </h2>
            <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 16px', lineHeight: 1.5 }}>
              Valor aproximado — não precisa ser exato. Isso ajuda a montar seu plano.
            </p>

            {/* Botões de valor sugerido */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {(DREAM_AMOUNTS[selectedKey] ?? []).map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setSelectedAmountLabel(opt.label)
                    setSelectedAmountNum(opt.value)
                    setCustomAmount('')
                  }}
                  style={{
                    border: selectedAmountLabel === opt.label
                      ? `1.5px solid ${primary}`
                      : `1.5px solid ${C.border}`,
                    borderRadius: 12, padding: '12px 8px',
                    textAlign: 'center', cursor: 'pointer',
                    background: selectedAmountLabel === opt.label ? C.purpleBg : '#fff',
                    fontFamily: 'inherit', transition: 'all .15s',
                  }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: selectedAmountLabel === opt.label ? 700 : 500,
                    color: selectedAmountLabel === opt.label ? C.purpleDeep : C.text,
                  }}>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Input livre */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Outro valor
              </label>
              <div style={{ position: 'relative' }}>
                <span style={prefixSt}>R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 45.000,00"
                  value={customAmount}
                  onChange={e => {
                    setCustomAmount(e.target.value)
                    setSelectedAmountLabel('custom')
                    setSelectedAmountNum(0)
                  }}
                  style={{ ...inputSt, paddingLeft: 44, borderColor: selectedAmountLabel === 'custom' && customAmount ? primary : C.border }}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!canProceedAmount}
              onClick={() => canProceedAmount && setStep('form')}
              style={{
                width: '100%',
                background: canProceedAmount ? primary : 'rgba(0,0,0,0.1)',
                color: canProceedAmount ? '#fff' : C.textSec,
                border: 'none', borderRadius: 12, padding: '14px',
                fontSize: 15, fontWeight: 500,
                cursor: canProceedAmount ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'background .2s',
              }}
            >
              Continuar →
            </button>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP: FORM                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 'form' && (
          <>
            <button
              type="button"
              onClick={() => {
                if (intentEmpress) {
                  setIntentEmpress(false)
                  setStep('dream')
                } else {
                  setStep('amount')
                }
              }}
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

            {/* Resumo do sonho selecionado */}
            {selectedOption && (
              <div style={{
                background: intentEmpress ? '#EFF6FF' : C.purpleBg,
                border: `1px solid ${intentEmpress ? '#BFDBFE' : C.purpleBg}`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>{intentEmpress ? '🏢' : selectedOption.emoji}</span>
                <div>
                  <p style={{ fontSize: 10, color: intentEmpress ? '#1D4ED8' : primary, fontWeight: 600, margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {intentEmpress ? 'DNA Empresarial' : 'Seu sonho'}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: intentEmpress ? '#1E3A8A' : C.purpleDeep, margin: 0 }}>
                    {intentEmpress ? 'Diagnóstico para sua empresa' : selectedOption.label}
                    {!intentEmpress && effectiveAmountLabel && (
                      <span style={{ fontWeight: 400, color: primary }}> · {effectiveAmountLabel}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Form card */}
            <div style={{
              background: '#fff', borderRadius: 16,
              border: `0.5px solid ${C.border}`, padding: '16px',
            }}>
              <form action={formAction} noValidate>
                {/* Campos hidden — nunca vêm do servidor, sempre do estado do cliente */}
                <input type="hidden" name="main_dream"            value={mainDream} />
                <input type="hidden" name="dream_subtype"         value={selectedSubtype} />
                <input type="hidden" name="dream_target_amount"   value={effectiveAmountNum > 0 ? String(effectiveAmountNum) : ''} />
                <input type="hidden" name="dream_target_label"    value={effectiveAmountLabel} />
                <input type="hidden" name="intencao_empresa"      value={intentEmpress ? '1' : ''} />
                <input type="hidden" name="utm_source"            value={utms.utm_source} />
                <input type="hidden" name="utm_medium"            value={utms.utm_medium} />
                <input type="hidden" name="utm_campaign"          value={utms.utm_campaign} />
                <input type="hidden" name="utm_term"              value={utms.utm_term} />
                <input type="hidden" name="utm_content"           value={utms.utm_content} />

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

                {/* Botão de acesso — aparece quando o telefone já está cadastrado */}
                {state?.success === false && state.duplicate && (
                  <div style={{ marginTop: -6, marginBottom: 14, textAlign: 'center' }}>
                    <a
                      href={`/${unit.slug}/entrar`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13, fontWeight: 600, color: C.purpleDeep,
                        background: C.purpleBg, textDecoration: 'none',
                        padding: '10px 18px', borderRadius: 10,
                        border: `1.5px solid ${C.purple}40`,
                      }}
                    >
                      🔑 Entrar na minha conta →
                    </a>
                  </div>
                )}

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
                      value={income}
                      onChange={e => setIncome(e.target.value)}
                      placeholder="Ex: 2.500,00" required
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
                      value={expenses}
                      onChange={e => setExpenses(e.target.value)}
                      placeholder="Ex: 1.800,00" required
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
