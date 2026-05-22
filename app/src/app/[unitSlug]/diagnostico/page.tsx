import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CSSProperties } from 'react'

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
}

function calcPerfil(sobra: number, income: number): PerfilInfo {
  const taxa = income > 0 ? (sobra / income) * 100 : -Infinity

  if (sobra < 0) return {
    label: 'Atenção financeira',
    descricao: 'Suas despesas estão acima da sua renda. O foco agora é identificar cortes para recuperar o equilíbrio.',
    color: '#C0392B', bg: '#FDECEA',
  }
  if (taxa < 10) return {
    label: 'Em reorganização',
    descricao: 'Você tem uma sobra pequena. Com pequenos ajustes, é possível ampliar sua capacidade de poupança.',
    color: '#B7770D', bg: '#FEF9E7',
  }
  if (taxa <= 20) return {
    label: 'Em evolução',
    descricao: 'Você está no caminho certo. Sua taxa de poupança é saudável e pode crescer ainda mais.',
    color: '#1A6EA8', bg: '#EBF5FB',
  }
  return {
    label: 'Bom potencial',
    descricao: 'Excelente! Você tem uma sobra expressiva. O próximo passo é direcionar esse valor com inteligência.',
    color: '#1E8449', bg: '#EAFAF1',
  }
}

// ── Formatadores ───────────────────────────────────────────────────────────────

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
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

  // 3. Buscar dados do lead — só os campos que exibimos
  //    Valida unit_slug para impedir que lead de outra unidade acesse este diagnóstico
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

  // 5. Perfil e recomendação
  const perfil       = calcPerfil(sobra, income)
  const dream        = lead.main_dream ?? 'outro'
  const dreamInfo    = DREAMS[dream] ?? DREAMS.outro
  const recomendacao = sobra < 0
    ? 'Antes de acelerar seu sonho, vamos encontrar pequenos ajustes para recuperar o equilíbrio financeiro.'
    : (RECOMENDACOES[dream] ?? RECOMENDACOES.outro)

  const firstName = lead.name.split(' ')[0]
  const primary   = '#7F77DD'

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: '#F5F4FB', minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #EEEDFE',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        gap: 10, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: '#EEEDFE',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>🧬</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: primary }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: '#999' }}>{lead.city ?? unitSlug}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            background: perfil.bg, color: perfil.color,
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
          }}>{perfil.label}</span>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* ── Hero ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: primary, fontWeight: 600, margin: '0 0 4px' }}>
            Olá, {firstName}! 👋
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', lineHeight: 1.25, margin: '0 0 8px' }}>
            Seu diagnóstico inicial está pronto
          </h1>
          <p style={{ color: '#999', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Conforme você usar o app, seu diagnóstico ficará cada vez mais preciso e personalizado.
          </p>
        </div>

        {/* ── Sonho ── */}
        <div style={{
          background: '#EEEDFE', borderRadius: 16,
          padding: '16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>{dreamInfo.emoji}</div>
          <div>
            <p style={{ fontSize: 11, color: '#7F77DD', fontWeight: 600, margin: '0 0 2px' }}>Seu sonho principal</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#3C3489', margin: 0 }}>{dreamInfo.label}</p>
          </div>
        </div>

        {/* ── Renda e Despesas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <InfoCard label="Renda mensal" value={fmtBRL(income)} />
          <InfoCard label="Despesas mensais" value={fmtBRL(expenses)} />
        </div>

        {/* ── Sobra + Taxa ── */}
        <div style={{
          background: sobra >= 0 ? '#EAFAF1' : '#FDECEA',
          borderRadius: 16, padding: '16px 18px', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 600, margin: '0 0 2px' }}>Sobra mensal</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: sobra >= 0 ? '#1E8449' : '#C0392B', margin: 0 }}>
              {fmtBRL(sobra)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 600, margin: '0 0 2px' }}>Taxa de poupança</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: sobra >= 0 ? '#1E8449' : '#C0392B', margin: 0 }}>
              {sobra >= 0 ? fmtPct(taxa) : '—'}
            </p>
          </div>
        </div>

        {/* ── Limite diário (só se positivo) ── */}
        {limiteDiario > 0 && (
          <div style={{
            background: '#fff', borderRadius: 16,
            padding: '14px 18px', marginBottom: 10,
            border: '1.5px solid #EEEDFE',
          }}>
            <p style={{ fontSize: 11, color: '#AAA', fontWeight: 600, margin: '0 0 2px' }}>Limite saudável por dia</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: primary, margin: '0 0 2px' }}>
              {fmtBRL(limiteDiario)}
            </p>
            <p style={{ fontSize: 11, color: '#BBB', margin: 0 }}>
              Valor de referência para manter seu equilíbrio mensal.
            </p>
          </div>
        )}

        {/* ── Perfil financeiro ── */}
        <div style={{
          background: perfil.bg, borderRadius: 16,
          padding: '16px 18px', marginBottom: 10,
          border: `1.5px solid ${perfil.color}33`,
        }}>
          <p style={{ fontSize: 11, color: perfil.color, fontWeight: 700, margin: '0 0 2px' }}>Perfil financeiro</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: perfil.color, margin: '0 0 6px' }}>{perfil.label}</p>
          <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.5 }}>{perfil.descricao}</p>
        </div>

        {/* ── Recomendação ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '18px', marginBottom: 28,
          border: '1.5px solid #EEEDFE',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <p style={{ fontSize: 12, color: primary, fontWeight: 700, margin: 0 }}>
              Recomendação do DNA Financeiro
            </p>
          </div>
          <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6, margin: 0 }}>{recomendacao}</p>
        </div>

        {/* ── Botões ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={`/${unitSlug}/painel`} style={btnPrimary(primary)}>
            Ir para meu painel →
          </a>
          <a href={`/${unitSlug}`} style={btnSecondary(primary)}>
            Melhorar meu diagnóstico
          </a>
          <a href={`/${unitSlug}/despesas`} style={btnSecondary(primary)}>
            Cadastrar uma despesa
          </a>
        </div>

      </main>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      padding: '14px 16px', border: '1.5px solid #EEEDFE',
    }}>
      <p style={{ fontSize: 11, color: '#AAA', fontWeight: 600, margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>{value}</p>
    </div>
  )
}

function btnPrimary(color: string): CSSProperties {
  return {
    display: 'block', textAlign: 'center', textDecoration: 'none',
    background: color, color: '#fff',
    borderRadius: 14, padding: '15px 20px',
    fontSize: 15, fontWeight: 700,
  }
}

function btnSecondary(color: string): CSSProperties {
  return {
    display: 'block', textAlign: 'center', textDecoration: 'none',
    background: '#EEEDFE', color: color,
    borderRadius: 14, padding: '15px 20px',
    fontSize: 15, fontWeight: 600,
  }
}
