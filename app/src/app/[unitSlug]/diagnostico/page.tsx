import type { CSSProperties } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'

// ── Dados dos sonhos ──────────────────────────────────────────────────────────

const DREAMS: Record<string, { label: string; emoji: string }> = {
  carro:     { label: 'Carro próprio',         emoji: '🚗' },
  casa:      { label: 'Casa própria',          emoji: '🏠' },
  negocio:   { label: 'Negócio próprio',       emoji: '🏪' },
  viagem:    { label: 'Viagem dos sonhos',      emoji: '✈️' },
  reserva:   { label: 'Reserva de emergência', emoji: '🐷' },
  faculdade: { label: 'Faculdade',              emoji: '🎓' },
  reforma:   { label: 'Reforma da casa',        emoji: '🔨' },
  dividas:   { label: 'Quitar dívidas',         emoji: '💳' },
  moto:      { label: 'Moto',                   emoji: '🏍️' },
  outro:     { label: 'Outro sonho',            emoji: '⭐' },
}

// ── Recomendações por sonho ────────────────────────────────────────────────────

const RECOMENDACOES: Record<string, string> = {
  carro:     'Com sua sobra mensal atual, já é possível montar um plano para aproximar você do seu carro sem comprometer sua rotina.',
  casa:      'Seu primeiro passo é organizar a sobra mensal e entender quanto pode ser direcionado para uma conquista maior.',
  negocio:   'Com disciplina financeira, você pode separar uma parte da sobra para construir o capital inicial do seu negócio.',
  viagem:    'Definindo um valor mensal para poupar, sua viagem dos sonhos pode ser mais próxima do que parece.',
  reserva:   'Uma reserva de emergência garante segurança e tranquilidade. Vamos calcular quanto você precisa guardar por mês.',
  faculdade: 'Investir em educação é uma das melhores formas de aumentar sua renda futura. Vamos planejar juntos.',
  reforma:   'Com planejamento, cada mês você pode se aproximar da reforma sem comprometer as despesas essenciais.',
  dividas:   'O foco inicial deve ser identificar quais despesas podem ser reduzidas e priorizar dívidas com maior impacto.',
  moto:      'Com um plano de poupança mensal, sua moto pode ser uma realidade mais cedo do que você imagina.',
  outro:     'Seu sonho merece um plano personalizado. Vamos juntos descobrir o caminho mais inteligente para chegar lá.',
}

// ── Perfil financeiro ──────────────────────────────────────────────────────────

type Perfil = 'Atenção financeira' | 'Em reorganização' | 'Em evolução' | 'Bom potencial'

interface PerfilInfo {
  label: Perfil
  descricao: string
  color: string
  bg: string
  badgeBg: string
  badgeColor: string
}

function calcPerfil(sobra: number, income: number): PerfilInfo {
  const taxa = income > 0 ? (sobra / income) * 100 : -Infinity

  if (sobra < 0) return {
    label: 'Atenção financeira',
    descricao: 'Suas despesas estão acima da sua renda. O foco agora é identificar cortes para recuperar o equilíbrio.',
    color: C.coralDark, bg: C.coralBg, badgeBg: C.coral, badgeColor: '#fff',
  }
  if (taxa < 10) return {
    label: 'Em reorganização',
    descricao: 'Você tem uma sobra pequena. Com pequenos ajustes, é possível ampliar sua capacidade de poupança.',
    color: C.amberDark, bg: C.amberBg, badgeBg: C.amberBg, badgeColor: C.amberDark,
  }
  if (taxa <= 20) return {
    label: 'Em evolução',
    descricao: 'Você está no caminho certo. Sua taxa de poupança é saudável e pode crescer ainda mais.',
    color: C.purpleDeep, bg: C.purpleBg, badgeBg: C.purpleBg, badgeColor: C.purpleDeep,
  }
  return {
    label: 'Bom potencial',
    descricao: 'Excelente! Você tem uma sobra expressiva. O próximo passo é direcionar esse valor com inteligência.',
    color: C.greenDark, bg: C.greenBg, badgeBg: C.greenBg, badgeColor: C.greenDark,
  }
}

// ── Formatadores ───────────────────────────────────────────────────────────────

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtPct(value: number): string {
  return `${Math.abs(value).toFixed(1).replace('.', ',')}%`
}

// ── Página ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function DiagnosticoPage({ params }: Props) {
  const { unitSlug } = await params

  // 1. Ler cookie do lead
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  // 2. Decodificar token → lead_id
  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 3. Buscar dados do lead — valida unit_slug para impedir acesso cross-unit
  let lead: {
    name: string
    main_dream: string | null
    monthly_income: number | null
    monthly_expenses: number | null
    city: string | null
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('leads')
      .select('name, main_dream, monthly_income, monthly_expenses, city')
      .eq('id', leadId)
      .eq('unit_slug', unitSlug)
      .is('deleted_at', null)
      .single()

    if (error || !data) redirect(`/${unitSlug}`)
    lead = data
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 4. Cálculos financeiros
  const income       = lead.monthly_income   ?? 0
  const expenses     = lead.monthly_expenses ?? 0
  const sobra        = income - expenses
  const taxa         = income > 0 ? (sobra / income) * 100 : 0
  const limiteDiario = sobra > 0 ? sobra / 30 : 0
  const expensesPct  = income > 0 ? (expenses / income) * 100 : 0

  // 5. Perfil e recomendação
  const perfil       = calcPerfil(sobra, income)
  const dream        = lead.main_dream ?? 'outro'
  const dreamInfo    = DREAMS[dream] ?? DREAMS.outro
  const recomendacao = sobra < 0
    ? 'Antes de acelerar seu sonho, vamos encontrar pequenos ajustes para recuperar o equilíbrio financeiro.'
    : (RECOMENDACOES[dream] ?? RECOMENDACOES.outro)

  const firstName = lead.name.split(' ')[0]

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bgApp, minHeight: '100dvh' }}>

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
          <div style={{ fontWeight: 600, fontSize: 14, color: C.purple }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: C.textSec }}>{lead.city ?? unitSlug}</div>
        </div>
        <span style={{
          marginLeft: 'auto', background: perfil.badgeBg, color: perfil.badgeColor,
          fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
        }}>{perfil.label}</span>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 48px' }}>

        {/* ── Hero ── */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: C.purple, fontWeight: 600, margin: '0 0 2px' }}>
            Olá, {firstName}! 👋
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: C.text, lineHeight: 1.3, margin: '0 0 4px' }}>
            Seu diagnóstico inicial
          </h1>
          <p style={{ color: C.textSec, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            Com base no que você informou, nossa IA calculou:
          </p>
        </div>

        {/* ── Perfil financeiro + mini-stats ── */}
        <div style={{
          background: C.purpleBg, borderRadius: 16,
          padding: 16, marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.purpleDark }}>Perfil financeiro</span>
            <span style={{
              background: perfil.badgeBg, color: perfil.badgeColor,
              fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
              border: `1px solid ${perfil.color}33`,
            }}>{perfil.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <MiniStat
              label="Sobra mensal"
              value={fmtBRL(sobra)}
              valueColor={sobra >= 0 ? C.green : C.coral}
            />
            <MiniStat
              label="Taxa de poupança"
              value={sobra >= 0 ? fmtPct(taxa) : '—'}
              valueColor={sobra >= 0 ? C.green : C.textSec}
            />
          </div>
          {limiteDiario > 0 && (
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: C.purpleDeep }}>
                Limite saudável por dia: <strong>{fmtBRL(limiteDiario)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* ── Card do sonho ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              background: C.amberBg, borderRadius: 10,
              width: 36, height: 36, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>{dreamInfo.emoji}</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: C.text }}>
                Seu sonho: {dreamInfo.label}
              </p>
              <p style={{ fontSize: 11, color: C.textSec, margin: '2px 0 0' }}>
                Continue para definir sua meta de valor
              </p>
            </div>
          </div>
          {/* barra de progresso indicativa */}
          <div style={{
            background: 'rgba(0,0,0,0.06)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 6,
          }}>
            <div style={{
              background: C.amber, height: '100%', borderRadius: 99, width: '8%', transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: C.textSec }}>Diagnóstico inicial completo</span>
            <span style={{ fontSize: 11, color: C.amberDark, fontWeight: 500 }}>Próximo: definir meta</span>
          </div>
        </div>

        {/* ── Renda e Despesas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <InfoCard label="Renda mensal" value={fmtBRL(income)} />
          <InfoCard label="Despesas mensais" value={fmtBRL(expenses)} valueColor={C.coral} />
        </div>

        {/* ── Recomendação da IA ── */}
        <div style={{
          background: C.greenBg, borderRadius: 14,
          padding: 14, marginBottom: 10,
        }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: C.greenDark, margin: '0 0 6px' }}>
            ✨ Recomendação da IA
          </p>
          <p style={{ fontSize: 12, color: C.greenDark, lineHeight: 1.5, margin: 0 }}>
            {recomendacao}
          </p>
        </div>

        {/* ── Ponto de atenção (condicional) ── */}
        {(sobra < 0 || expensesPct > 70) && (
          <div style={{
            background: C.coralBg, borderRadius: 14,
            padding: 14, marginBottom: 16,
          }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.coralDark, margin: '0 0 4px' }}>
              ⚠️ Ponto de atenção
            </p>
            <p style={{ fontSize: 12, color: C.coralDark, lineHeight: 1.5, margin: 0 }}>
              {sobra < 0
                ? 'Suas despesas estão acima da sua renda. Vamos identificar onde é possível ajustar.'
                : `Suas despesas representam ${fmtPct(expensesPct)} da renda. O ideal é estar abaixo de 70%.`}
            </p>
          </div>
        )}

        {/* ── Botões ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: sobra < 0 || expensesPct > 70 ? 0 : 6 }}>
          <a href={`/${unitSlug}/painel`} style={btnPrimary}>
            Ver meu painel →
          </a>
          <a href={`/${unitSlug}`} style={btnSecondary}>
            Melhorar meu diagnóstico
          </a>
          <a href={`/${unitSlug}/despesas`} style={btnSecondary}>
            Cadastrar uma despesa
          </a>
        </div>

      </main>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function MiniStat({ label, value, valueColor = C.text }: {
  label: string; value: string; valueColor?: string
}) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.5)',
      borderRadius: 12, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 17, fontWeight: 500, color: valueColor }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function InfoCard({ label, value, valueColor = C.text }: {
  label: string; value: string; valueColor?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      padding: '12px 14px', border: `0.5px solid ${C.border}`,
    }}>
      <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500, margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 500, color: valueColor, margin: 0 }}>{value}</p>
    </div>
  )
}

const btnPrimary: CSSProperties = {
  display: 'block', textAlign: 'center', textDecoration: 'none',
  background: C.purple, color: '#fff',
  borderRadius: 12, padding: '14px 20px',
  fontSize: 15, fontWeight: 500,
}

const btnSecondary: CSSProperties = {
  display: 'block', textAlign: 'center', textDecoration: 'none',
  background: C.purpleBg, color: C.purpleDeep,
  borderRadius: 12, padding: '14px 20px',
  fontSize: 15, fontWeight: 500,
}
