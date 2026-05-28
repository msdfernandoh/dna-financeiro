// =============================================================================
// GAUCHINHO SOLUÇÕES FINANCEIRAS — Landing Page
//
// Rota: /[unitSlug]/gauchinho
//
// Server Component puro — sem 'use client'.
// Todos os CTAs são <a> links. Captação de leads via fluxo existente do DNA.
//
// COMPLIANCE:
//   Toda linguagem segue as regras do produto:
//   - Sem promessa de aprovação de crédito
//   - Sem promessa de contemplação
//   - Sem promessa de rendimento garantido
//   - Usar sempre "simulação inicial", "conforme contrato/produto"
// =============================================================================

import { resolveUnit } from '@/lib/units'
import { C } from '@/app/components/ui'

// ── Configuração do parceiro ──────────────────────────────────────────────────
// ⚠️  Para trocar o WhatsApp: altere somente WHATSAPP_NUMBER (DDI+DDD+número, só dígitos)
const WHATSAPP_NUMBER = '5566999126120'
const WHATSAPP_TEXT   = encodeURIComponent(
  'Olá, vim pelo evento e quero simular meu sonho financeiro.',
)
const WHATSAPP_URL    = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string }>
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default async function GauchinhoPage({ params }: Props) {
  const { unitSlug } = await params
  const unit = await resolveUnit(unitSlug)

  const appUrl = `/${unitSlug}?utm_source=parceiro&utm_medium=evento&utm_campaign=gauchinho_evento&utm_content=pagina_gauchinho`

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: C.bgApp,
      minHeight: '100dvh',
      color: C.text,
    }}>

      {/* ── Animações globais ── */}
      <style>{`
        @keyframes g-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes g-pulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
        @keyframes g-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes g-fade  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 1. HERO PRINCIPAL                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: 'linear-gradient(160deg, #0d0b1e 0%, #1a1547 55%, #0c0b1a 100%)',
        backgroundImage: [
          'linear-gradient(160deg, #0d0b1e 0%, #1a1547 55%, #0c0b1a 100%)',
          'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: 'cover, 28px 28px',
        position: 'relative',
        overflow: 'hidden',
        padding: '0 0 60px',
      }}>

        {/* Orbs de luz */}
        <div style={{
          position:'absolute', top:-160, right:-120, width:400, height:400,
          background:'radial-gradient(circle, rgba(127,119,221,.35) 0%, transparent 65%)',
          animation:'g-pulse 6s ease-in-out infinite', pointerEvents:'none',
        }}/>
        <div style={{
          position:'absolute', bottom:-80, left:-100, width:360, height:360,
          background:'radial-gradient(circle, rgba(29,158,117,.2) 0%, transparent 65%)',
          animation:'g-pulse 7s ease-in-out infinite 1.5s', pointerEvents:'none',
        }}/>
        <div style={{
          position:'absolute', top:'45%', left:'60%', width:240, height:240,
          background:'radial-gradient(circle, rgba(239,159,39,.12) 0%, transparent 65%)',
          animation:'g-pulse 8s ease-in-out infinite 3s', pointerEvents:'none',
        }}/>

        {/* Header */}
        <header style={{
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          position: 'relative', zIndex: 2,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(127,119,221,0.2)',
            border: '1px solid rgba(127,119,221,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🧬</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(196,191,255,0.95)' }}>
              DNA Financeiro
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              {unit.city} · {unit.state}
            </div>
          </div>
          <span style={{
            marginLeft: 'auto',
            background: 'rgba(29,158,117,0.2)',
            border: '1px solid rgba(29,158,117,0.3)',
            color: '#4ECBA3',
            fontSize: 10, fontWeight: 600,
            padding: '4px 10px', borderRadius: 99,
          }}>
            Parceiro Oficial
          </span>
        </header>

        {/* Hero content */}
        <div style={{
          maxWidth: 480, margin: '0 auto',
          padding: '48px 24px 0',
          position: 'relative', zIndex: 2,
          animation: 'g-fade .5s ease both',
        }}>

          {/* Ícone flutuante */}
          <div style={{
            marginBottom: 28, textAlign: 'center',
            animation: 'g-float 3.5s ease-in-out infinite',
          }}>
            <div style={{
              display: 'inline-flex',
              width: 76, height: 76, borderRadius: 22,
              background: 'linear-gradient(135deg, rgba(127,119,221,.25), rgba(83,74,183,.15))',
              border: '1.5px solid rgba(127,119,221,.45)',
              alignItems: 'center', justifyContent: 'center', fontSize: 36,
              boxShadow: '0 0 0 10px rgba(127,119,221,.07), 0 0 50px rgba(127,119,221,.28)',
            }}>🤝</div>
          </div>

          {/* Badge de parceiro */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <span style={{
              display: 'inline-block',
              background: 'rgba(239,159,39,0.18)',
              border: '1px solid rgba(239,159,39,0.35)',
              color: '#F5C86A',
              fontSize: 11, fontWeight: 600,
              padding: '5px 14px', borderRadius: 99,
              letterSpacing: 0.5, textTransform: 'uppercase',
            }}>
              Gauchinho Soluções Financeiras
            </span>
          </div>

          <h1 style={{
            fontSize: 30, fontWeight: 700, color: '#fff',
            textAlign: 'center', lineHeight: 1.2,
            margin: '0 0 14px', letterSpacing: -0.5,
          }}>
            Realize seu sonho com{' '}
            <span style={{
              background: 'linear-gradient(135deg, #C4BFFF 0%, #8F87E8 40%, #534AB7 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              planejamento financeiro inteligente
            </span>
          </h1>

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.55)',
            textAlign: 'center', lineHeight: 1.7,
            margin: '0 auto 32px', maxWidth: 340,
          }}>
            Com o Gauchinho Soluções Financeiras, você compara caminhos como consórcio,
            financiamento, Plano Pontual e investimento para escolher a melhor estratégia
            para seu objetivo.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href={appUrl} style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              background: 'linear-gradient(135deg, #7F77DD 0%, #534AB7 100%)',
              color: '#fff', borderRadius: 14, padding: '16px 20px',
              fontSize: 16, fontWeight: 600,
              boxShadow: '0 4px 28px rgba(127,119,221,.5), inset 0 1px 0 rgba(255,255,255,.18)',
              letterSpacing: 0.2,
            }}>
              🎯 Simular meu sonho agora
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.8)',
              borderRadius: 14, padding: '15px 20px',
              fontSize: 15, fontWeight: 400,
            }}>
              💬 Falar com o Gauchinho
            </a>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 18 }}>
            🔒 Simulação gratuita · Sem compromisso · Atendimento consultivo
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 2. SOLUÇÕES                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '48px 20px', maxWidth: 480, margin: '0 auto' }}>

        <SectionLabel text="Soluções" />
        <h2 style={headingStyle}>O que o Gauchinho oferece</h2>
        <p style={subStyle}>Soluções para cada objetivo financeiro, com atendimento próximo e análise consultiva.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SOLUTIONS.map((s) => (
            <div key={s.title} style={{
              background: '#fff', borderRadius: 16,
              border: `0.5px solid ${C.border}`,
              padding: '18px 16px',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>{s.icon}</div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>
                  {s.title}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: C.textSec, lineHeight: 1.55 }}>
                  {s.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <a href={appUrl} style={primaryBtnStyle}>
            Simular meu caminho financeiro →
          </a>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 3. COMO FUNCIONA                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: '48px 20px',
        background: 'linear-gradient(160deg, #0f0d24 0%, #1a1547 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(127,119,221,.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}/>
        <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          <SectionLabel text="Como funciona" light />
          <h2 style={{ ...headingStyle, color: '#fff' }}>Do sonho ao caminho certo</h2>
          <p style={{ ...subStyle, color: 'rgba(255,255,255,0.5)' }}>
            Quatro etapas simples para você enxergar a melhor estratégia.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {HOW_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Linha vertical */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #7F77DD, #534AB7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#fff',
                    boxShadow: '0 4px 16px rgba(127,119,221,.4)',
                  }}>{i + 1}</div>
                  {i < HOW_STEPS.length - 1 && (
                    <div style={{
                      width: 2, flex: 1, minHeight: 24,
                      background: 'linear-gradient(to bottom, rgba(127,119,221,.5), rgba(127,119,221,.1))',
                      margin: '6px 0',
                    }}/>
                  )}
                </div>
                {/* Conteúdo */}
                <div style={{ paddingBottom: i < HOW_STEPS.length - 1 ? 20 : 0, paddingTop: 8 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    {step.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32 }}>
            <a href={appUrl} style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              background: 'linear-gradient(135deg, #7F77DD 0%, #534AB7 100%)',
              color: '#fff', borderRadius: 14, padding: '16px 20px',
              fontSize: 15, fontWeight: 600,
              boxShadow: '0 4px 24px rgba(127,119,221,.5)',
            }}>
              🎯 Iniciar minha simulação agora
            </a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 4. VANTAGENS DO CONSÓRCIO                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '48px 20px', maxWidth: 480, margin: '0 auto' }}>

        <SectionLabel text="Consórcio" />
        <h2 style={headingStyle}>Por que considerar o consórcio?</h2>
        <p style={subStyle}>
          Conheça as características do produto antes de decidir.
          Toda escolha deve ser baseada no seu momento financeiro.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CONSORTIUM_POINTS.map((point, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 14,
              border: `0.5px solid ${C.border}`,
              padding: '14px 16px',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: C.purpleBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>{point.icon}</span>
              <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                {point.text}
              </p>
            </div>
          ))}
        </div>

        {/* Aviso carta contemplada */}
        <div style={{
          background: C.amberBg, borderRadius: 14,
          border: `1px solid ${C.amber}30`,
          padding: '14px 16px',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: C.amberDark }}>
            💡 Sobre carta contemplada
          </p>
          <p style={{ margin: 0, fontSize: 12, color: C.amberDark, lineHeight: 1.6 }}>
            Em alguns cenários, uma carta contemplada pode ter procura no mercado e ser
            negociada com ágio. Essa possibilidade depende do produto, administradora,
            comprador, regras do grupo, situação da carta e negociação.{' '}
            <strong>Não é garantia de venda ou rentabilidade.</strong>
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 5. PLANO PONTUAL                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: '48px 20px',
        background: C.bgSecondary,
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

          <SectionLabel text="Plano Pontual" />
          <h2 style={headingStyle}>Uma alternativa para quem busca previsibilidade</h2>

          <div style={{
            background: '#fff', borderRadius: 20,
            border: `0.5px solid ${C.border}`,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          }}>
            {/* Header do card */}
            <div style={{
              background: 'linear-gradient(135deg, #7F77DD, #534AB7)',
              padding: '20px 20px 18px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Plano Pontual
              </p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                60 meses · Antecipação a partir do 6º mês
              </p>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textSec, lineHeight: 1.65 }}>
                O Plano Pontual é uma alternativa para quem busca previsibilidade. Ele trabalha com
                prazo total de <strong style={{ color: C.text }}>60 meses</strong> e regra de antecipação
                a partir do 6º mês, permitindo completar 24 parcelas pagas para buscar a concessão do
                crédito conforme regra do produto.
              </p>

              {/* Exemplo educativo */}
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Exemplo educativo
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {PONTUAL_ITEMS.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: 10,
                    background: i % 2 === 0 ? C.bgApp : '#fff',
                  }}>
                    <span style={{ fontSize: 12, color: C.textSec }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: item.highlight ? C.purpleDeep : C.text }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Aviso legal */}
              <div style={{
                background: C.bgApp, borderRadius: 10,
                padding: '12px 14px',
                border: `0.5px solid ${C.border}`,
              }}>
                <p style={{ margin: 0, fontSize: 11, color: C.textSec, lineHeight: 1.6 }}>
                  ⚠️ <strong>Simulação inicial.</strong> Condições, valores, correções e regras
                  dependem do contrato, produto e administradora.
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{
              ...primaryBtnStyle,
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              boxShadow: '0 4px 20px rgba(37,211,102,.3)',
            }}>
              💬 Entender o Plano Pontual com o Gauchinho
            </a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 6. SIMULE SEU SONHO                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '48px 20px', maxWidth: 480, margin: '0 auto' }}>

        <div style={{
          background: 'linear-gradient(135deg, #1a1547 0%, #0d0b1e 100%)',
          borderRadius: 24, padding: '32px 24px',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -60, width: 220, height: 220,
            background: 'radial-gradient(circle, rgba(127,119,221,.3) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}/>
          <div style={{
            position: 'absolute', bottom: -40, left: -40, width: 180, height: 180,
            background: 'radial-gradient(circle, rgba(29,158,117,.2) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}/>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 12px', lineHeight: 1.3 }}>
              Antes de escolher, simule.
            </h2>
            <p style={{
              fontSize: 14, color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.7, margin: '0 auto 24px', maxWidth: 300,
            }}>
              Descubra se faz mais sentido guardar, investir, financiar ou planejar por
              consórcio. O DNA Financeiro ajuda você a enxergar o caminho com mais clareza.
            </p>
            <a href={appUrl} style={{
              display: 'block', textDecoration: 'none',
              background: 'linear-gradient(135deg, #7F77DD 0%, #534AB7 100%)',
              color: '#fff', borderRadius: 14, padding: '16px 20px',
              fontSize: 16, fontWeight: 700,
              boxShadow: '0 4px 28px rgba(127,119,221,.6)',
            }}>
              Começar simulação gratuita →
            </a>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 14 }}>
              Grátis · Sem compromisso · Resultado em minutos
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 7. AUTORIDADE / PROVA SOCIAL                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: '48px 20px',
        background: C.bgSecondary,
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

          <SectionLabel text="Sobre o Gauchinho" />
          <h2 style={headingStyle}>Conte com quem entende de soluções financeiras</h2>
          <p style={subStyle}>
            O Gauchinho atua com atendimento próximo, análise consultiva e soluções para
            quem quer comprar, trocar, investir ou planejar o próximo passo financeiro.
          </p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {STATS.map((s, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 16,
                border: `0.5px solid ${C.border}`,
                padding: '18px 14px', textAlign: 'center',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.purpleDeep }}>
                  {s.value}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Depoimentos — placeholder */}
          <div style={{
            background: '#fff', borderRadius: 16,
            border: `1px dashed ${C.border}`,
            padding: '24px 20px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 20 }}>⭐</p>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: C.text }}>
              Em breve: histórias de clientes
            </p>
            <p style={{ margin: 0, fontSize: 13, color: C.textSec }}>
              Depoimentos de quem planejou e realizou com o Gauchinho.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 8. CAPTAÇÃO — REDIRECIONA PARA O FLUXO EXISTENTE DO DNA              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '48px 20px', maxWidth: 480, margin: '0 auto' }}>

        <SectionLabel text="Quero simular" />
        <h2 style={headingStyle}>Pronto para descobrir seu caminho?</h2>
        <p style={subStyle}>
          Informe seu sonho, sua renda e suas despesas. O DNA Financeiro analisa e
          compara os caminhos. O Gauchinho te ajuda a escolher.
        </p>

        <div style={{
          background: '#fff', borderRadius: 20,
          border: `0.5px solid ${C.border}`,
          padding: '24px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}>
          {/* O que o sistema analisa */}
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            O que você vai informar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {CAPTURE_ITEMS.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 12,
                background: C.bgApp,
                border: `0.5px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
              </div>
            ))}
          </div>

          <a href={appUrl} style={{
            ...primaryBtnStyle,
            fontSize: 16,
            fontWeight: 700,
          }}>
            🎯 Quero simular meu sonho
          </a>
          <p style={{ textAlign: 'center', fontSize: 11, color: C.textTer, marginTop: 10 }}>
            🔒 Gratuito · Seus dados são privados e seguros
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 9. BLOCO FINAL                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: '48px 20px 56px',
        background: 'linear-gradient(160deg, #0d0b1e 0%, #1a1547 100%)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <p style={{ fontSize: 32, marginBottom: 16 }}>🚀</p>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 12px', lineHeight: 1.3 }}>
            Seu próximo passo começa com planejamento
          </h2>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.7, margin: '0 0 32px',
          }}>
            Não escolha no escuro. Simule, compare e fale com quem pode te orientar.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href={appUrl} style={{
              display: 'block', textDecoration: 'none', textAlign: 'center',
              background: 'linear-gradient(135deg, #7F77DD 0%, #534AB7 100%)',
              color: '#fff', borderRadius: 14, padding: '16px 20px',
              fontSize: 16, fontWeight: 600,
              boxShadow: '0 4px 28px rgba(127,119,221,.5)',
            }}>
              Simular agora →
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{
              display: 'block', textDecoration: 'none', textAlign: 'center',
              background: 'rgba(37,211,102,0.15)',
              border: '1px solid rgba(37,211,102,0.3)',
              color: '#4ADE80',
              borderRadius: 14, padding: '15px 20px',
              fontSize: 15, fontWeight: 500,
            }}>
              💬 Chamar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* COMPLIANCE — Aviso legal discreto                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        padding: '24px 20px 88px',
        background: '#0a091a',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 10, color: 'rgba(255,255,255,0.2)',
          lineHeight: 1.7, maxWidth: 480, margin: '0 auto',
        }}>
          Todas as simulações são iniciais e educativas. Não representam aprovação de crédito,
          garantia de contemplação, garantia de venda de carta ou rentabilidade. Condições dependem
          de análise, contrato, administradora, mercado e regras do produto. Gauchinho Soluções
          Financeiras · DNA Financeiro · {unit.city}, {unit.state}
        </p>
      </footer>

      {/* ── Botão flutuante WhatsApp (mobile-first) ── */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          color: '#fff',
          borderRadius: 99,
          padding: '14px 22px',
          fontSize: 14,
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 24px rgba(37,211,102,.55), 0 2px 8px rgba(0,0,0,.25)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          letterSpacing: 0.2,
          whiteSpace: 'nowrap',
        }}
      >
        💬 Falar com Gauchinho
      </a>

    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SectionLabel({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      background: light ? 'rgba(127,119,221,0.2)' : C.purpleBg,
      color: light ? '#A89EFF' : C.purpleDeep,
      fontSize: 11, fontWeight: 600,
      padding: '5px 12px', borderRadius: 99,
      letterSpacing: 0.5, textTransform: 'uppercase',
      marginBottom: 12,
      border: light ? '1px solid rgba(127,119,221,0.3)' : 'none',
    }}>
      {text}
    </span>
  )
}

// ── Estilos compartilhados ─────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontSize: 22, fontWeight: 700, color: C.text,
  margin: '0 0 10px', lineHeight: 1.3,
}

const subStyle: React.CSSProperties = {
  fontSize: 13, color: C.textSec,
  lineHeight: 1.65, margin: '0 0 24px',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'block', textDecoration: 'none', textAlign: 'center',
  background: 'linear-gradient(135deg, #7F77DD 0%, #534AB7 100%)',
  color: '#fff', borderRadius: 14, padding: '16px 20px',
  fontSize: 15, fontWeight: 600,
  boxShadow: '0 4px 24px rgba(127,119,221,.4)',
}

// ── Dados estáticos ────────────────────────────────────────────────────────────

const SOLUTIONS = [
  {
    icon: '🚗',
    title: 'Consórcio de carro',
    text: 'Planeje a compra ou troca do seu veículo com parcelas acessíveis e análise dos melhores caminhos.',
    bg: '#FEF3E2',
  },
  {
    icon: '🏠',
    title: 'Consórcio de imóvel',
    text: 'Simule estratégias para casa própria, investimento imobiliário ou construção de patrimônio.',
    bg: '#E1F5EE',
  },
  {
    icon: '📅',
    title: 'Plano Pontual',
    text: 'Plano de 60 meses com regra de antecipação a partir do 6º mês, conforme condições do produto.',
    bg: C.purpleBg,
  },
  {
    icon: '🚛',
    title: 'Caminhão e frota',
    text: 'Planejamento para troca, aquisição ou expansão de veículos de trabalho.',
    bg: '#EFF6FF',
  },
  {
    icon: '💳',
    title: 'Financiamento e crédito',
    text: 'Compare alternativas de crédito e entenda o impacto das parcelas no seu orçamento.',
    bg: '#FEF3E2',
  },
  {
    icon: '🧬',
    title: 'Consultoria financeira',
    text: 'Organize sua renda, despesas e capacidade mensal antes de assumir um compromisso financeiro.',
    bg: C.greenBg,
  },
]

const HOW_STEPS = [
  {
    title: 'Você informa seu sonho',
    text: 'Carro, imóvel, caminhão, negócio, quitar dívidas ou aposentadoria imobiliária.',
  },
  {
    title: 'O DNA Financeiro analisa seu momento',
    text: 'Renda, despesas, sobra mensal, capacidade de parcela e objetivo.',
  },
  {
    title: 'O sistema compara os caminhos',
    text: 'Guardar, investir, financiamento, CDC, consórcio tradicional, consórcio com lance e Plano Pontual.',
  },
  {
    title: 'O Gauchinho te ajuda a escolher',
    text: 'Atendimento consultivo para entender qual caminho faz mais sentido para você.',
  },
]

const CONSORTIUM_POINTS = [
  { icon: '📆', text: 'Produto de planejamento de médio e longo prazo, sem juros sobre o crédito.' },
  { icon: '🎰', text: 'Possibilidade de contemplação por sorteio em assembleias mensais, conforme regras do grupo.' },
  { icon: '🏹', text: 'Possibilidade de oferta de lance para antecipar a contemplação, conforme regras do produto.' },
  { icon: '🔗', text: 'Possibilidade de lance embutido em alguns produtos, conforme contrato e administradora.' },
  { icon: '📈', text: 'Crédito atualizado conforme índice de reajuste previsto no contrato.' },
]

const PONTUAL_ITEMS = [
  { label: 'Crédito referência',          value: 'R$ 100.000', highlight: false },
  { label: 'Prazo total',                 value: '60 meses',   highlight: false },
  { label: 'Parcela referência',          value: 'R$ 2.148,24',highlight: true  },
  { label: 'Antecipação a partir do',     value: '6º mês',     highlight: false },
  { label: 'Parcelas antecipadas',        value: '18 parcelas', highlight: false },
  { label: 'Total para buscar crédito',   value: '24 parcelas', highlight: true  },
  { label: 'Saldo restante',              value: 'Redistribuído no prazo', highlight: false },
]

const STATS = [
  { value: '100%', label: 'Atendimento consultivo personalizado' },
  { value: '+6', label: 'Tipos de solução financeira' },
  { value: '60m', label: 'Prazo Plano Pontual' },
  { value: 'Grátis', label: 'Simulação no DNA Financeiro' },
]

const CAPTURE_ITEMS = [
  { icon: '😊', label: 'Seu nome e contato' },
  { icon: '🎯', label: 'Seu sonho principal' },
  { icon: '💰', label: 'Valor aproximado do sonho' },
  { icon: '📊', label: 'Renda e despesas mensais' },
  { icon: '📍', label: 'Sua cidade' },
]
