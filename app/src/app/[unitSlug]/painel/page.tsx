import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'
import { PerguntaDia }       from './PerguntaDia'
import { FeaturedOppCard }   from './_FeaturedOppCard'
import { LeadBottomNav }     from '@/app/components/LeadBottomNav'

// ── Categorias de despesa ─────────────────────────────────────────────────────

const EXPENSE_CATS: Record<string, { emoji: string; label: string }> = {
  alimentacao: { emoji: '🍽️', label: 'Alimentação' },
  mercado:     { emoji: '🛒', label: 'Mercado' },
  transporte:  { emoji: '🚗', label: 'Transporte' },
  saude:       { emoji: '💊', label: 'Saúde' },
  educacao:    { emoji: '📚', label: 'Educação' },
  lazer:       { emoji: '🎮', label: 'Lazer' },
  dividas:     { emoji: '💳', label: 'Dívidas' },
  contas:      { emoji: '📄', label: 'Contas fixas' },
  outros:      { emoji: '📦', label: 'Outros' },
}

// ── Sonhos ────────────────────────────────────────────────────────────────────

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

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function initials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ unitSlug: string }>
}

export default async function PainelPage({ params }: Props) {
  const { unitSlug } = await params

  // 1. Cookie
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

  // 3. Buscar lead — valida unit_slug (impede cross-unit)
  let lead: {
    name: string
    main_dream: string | null
    monthly_income: number | null
    monthly_expenses: number | null
    city: string | null
    dna_progress: number | null
    unit_id: string
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('leads')
      .select('name, main_dream, monthly_income, monthly_expenses, city, dna_progress, unit_id')
      .eq('id', leadId)
      .eq('unit_slug', unitSlug)
      .is('deleted_at', null)
      .single()

    if (error || !data) redirect(`/${unitSlug}`)
    lead = data
  } catch {
    redirect(`/${unitSlug}`)
  }

  // 3b. Detecção de lead empresarial (via DNA answers — unit_id do banco)
  let isBusiness = false
  try {
    const supabaseBiz = createServerSupabaseClient()
    const { data: bizAns } = await supabaseBiz
      .from('dna_answers')
      .select('answer')
      .eq('lead_id', leadId!)
      .eq('unit_id', lead.unit_id)
      .eq('question_key', 'vinculo_trabalho')
      .single()
    isBusiness = ['empresario', 'pj', 'autonomo'].includes(bizAns?.answer ?? '')
  } catch { /* não é lead empresarial */ }

  // 3c. Progresso do DNA empresarial (se for lead de negócio)
  let bizProgress = 0
  if (isBusiness) {
    try {
      const supabaseBizP = createServerSupabaseClient()
      const { data: bizData } = await supabaseBizP
        .from('business_profiles')
        .select('biz_dna_progress')
        .eq('lead_id', leadId!)
        .eq('unit_id', lead.unit_id)
        .is('deleted_at', null)
        .single()
      bizProgress = bizData?.biz_dna_progress ?? 0
    } catch { /* sem perfil ainda */ }
  }

  // 4. Cálculos financeiros (unit_id usado apenas no servidor para queries)
  const income       = lead.monthly_income   ?? 0
  const expenses     = lead.monthly_expenses ?? 0
  const sobra        = income - expenses
  const limiteDiario = sobra > 0 ? sobra / 30 : 0
  const dnaProgress  = lead.dna_progress ?? 0

  const dream     = lead.main_dream ?? 'outro'
  const dreamInfo = DREAMS[dream] ?? DREAMS.outro
  const firstName = lead.name.split(' ')[0]
  const avatar    = initials(lead.name)

  // 5. Buscar despesas do mês corrente (para totais de hoje / semana / mês)
  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = `${today.slice(0, 7)}-01`
  const weekAgo      = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let recentExpenses: { amount: number; category: string; description: string | null; expense_date: string }[] = []
  let todayTotal = 0
  let weekTotal  = 0
  let monthTotal = 0
  try {
    const supabase2 = createServerSupabaseClient()
    const { data: expData } = await supabase2
      .from('expenses')
      .select('amount, category, description, expense_date')
      .eq('lead_id', leadId)
      .is('deleted_at', null)
      .gte('expense_date', firstOfMonth)
      .order('expense_date', { ascending: false })
      .order('created_at',   { ascending: false })
      .limit(100)
    recentExpenses = expData ?? []
    todayTotal = recentExpenses.filter(e => e.expense_date === today).reduce((s, e) => s + e.amount, 0)
    weekTotal  = recentExpenses.filter(e => e.expense_date >= weekAgo).reduce((s, e) => s + e.amount, 0)
    monthTotal = recentExpenses.reduce((s, e) => s + e.amount, 0)
  } catch { /* silently ignore */ }

  // 6. Investimentos do mês — universo separado, NUNCA soma com expenses
  let investedThisMonth = 0
  try {
    const supabase4 = createServerSupabaseClient()
    const { data: invData } = await supabase4
      .from('investments')
      .select('amount')
      .eq('lead_id', leadId)
      .is('deleted_at', null)
      .gte('investment_date', firstOfMonth)
    investedThisMonth = (invData ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0)
  } catch { /* silently ignore */ }

  // 7. Oportunidade em destaque (falha silenciosa → usa fallback por sonho)
  let featuredOppTitle:  string | null = null
  let featuredOppId:     string | null = null
  let featuredOppType:   string | null = null
  let featuredOppDream:  string | null = null
  let featuredCtaUrl:    string | null = null
  let featuredCtaLabel:  string | null = null
  try {
    const supabase3 = createServerSupabaseClient()
    const nowIso = new Date().toISOString()
    const { data: oppData } = await supabase3
      .from('opportunities')
      .select('id, title, type, target_dream, cta_url, cta_label')
      .eq('unit_id', lead.unit_id)               // ← unit_id do banco, nunca do browser
      .eq('active', true)
      .eq('featured', true)
      .is('deleted_at', null)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('position', { ascending: true })
      .limit(1)
      .single()
    featuredOppTitle  = oppData?.title        ?? null
    featuredOppId     = oppData?.id           ?? null
    featuredOppType   = oppData?.type         ?? null
    featuredOppDream  = oppData?.target_dream ?? null
    featuredCtaUrl    = oppData?.cta_url      ?? null
    featuredCtaLabel  = oppData?.cta_label    ?? null
  } catch { /* usa fallback abaixo */ }

  // Fallback de oportunidade por sonho
  const OPP_FALLBACK: Record<string, string> = {
    casa:      'Palestra: Como sair do aluguel com planejamento financeiro',
    carro:     'Simulação gratuita: Quanto falta para você comprar seu carro?',
    negocio:   'Guia gratuito: Abra seu negócio sem entrar em dívidas',
    viagem:    'Desafio: Guarde para sua viagem dos sonhos em 12 meses',
    reserva:   'Desafio: Crie sua reserva de emergência em 90 dias',
    faculdade: 'Como financiar sua faculdade sem comprometer o orçamento',
    reforma:   'Palestra: Planeje a reforma da sua casa sem dívidas',
    dividas:   'Programa completo de quitação de dívidas — reorganize agora',
    moto:      'Simulação: Quanto guardar por mês para comprar sua moto?',
  }
  const isFeaturedFallback = !featuredOppTitle
  const featuredTitle = featuredOppTitle
    ?? OPP_FALLBACK[dream]
    ?? 'Aula gratuita: Como organizar sua vida financeira em 30 dias'

  // Saudação por hora do servidor
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Análise de gastos x renda
  const spendRatio  = income > 0 ? monthTotal / income : 0
  const spendPct    = Math.min(Math.round(spendRatio * 100), 100)
  const spendStatus: 'controle' | 'atencao' | 'risco' =
    spendRatio < 0.8 ? 'controle' : spendRatio < 1 ? 'atencao' : 'risco'

  // ── Meu Dia Financeiro — status do dia, dica, métricas ───────────────────────

  type DayStatus = 'controle' | 'atencao' | 'alerta' | 'sem-renda'
  const dayStatus: DayStatus =
    income === 0                                          ? 'sem-renda'
    : limiteDiario > 0 && todayTotal > limiteDiario * 2  ? 'alerta'
    : limiteDiario > 0 && todayTotal > limiteDiario       ? 'atencao'
    : 'controle'

  const pctHoje       = limiteDiario > 0 ? Math.round((todayTotal / limiteDiario) * 100) : 0
  const saldoEstimado = income - monthTotal - investedThisMonth

  const DAY_STATUS_META = {
    controle:    {
      label: 'Dia sob controle ✅', icon: '✅', badge: 'Controle',
      color: C.greenDark, bg: C.greenBg,
      desc: todayTotal > 0
        ? `Você gastou ${fmtBRL(todayTotal)} hoje — dentro do limite diário.`
        : 'Nenhum gasto registrado hoje. Ótimo começo!',
    },
    atencao:     {
      label: 'Atenção nos gastos ⚠️', icon: '⚠️', badge: 'Atenção',
      color: C.amberDark, bg: C.amberBg,
      desc: `Hoje: ${fmtBRL(todayTotal)} · Limite: ${fmtBRL(limiteDiario)}. Você está acima do limite diário.`,
    },
    alerta:      {
      label: 'Alerta de gastos 🚨', icon: '🚨', badge: 'Alerta',
      color: C.coralDark, bg: C.coralBg,
      desc: `Hoje: ${fmtBRL(todayTotal)} — mais de 2× seu limite diário de ${fmtBRL(limiteDiario)}.`,
    },
    'sem-renda': {
      label: 'Renda não informada 💡', icon: '💡', badge: 'Pendente',
      color: C.purple, bg: C.purpleBg,
      desc: 'Complete o DNA Financeiro para acompanhar seu status diário.',
    },
  } as const
  const dayMeta = DAY_STATUS_META[dayStatus]

  type TipType = 'investido' | 'gastos-altos' | 'comprometimento' | 'sem-lancamento' | 'controle'
  const tipType: TipType =
    investedThisMonth > 0 && dayStatus === 'controle' ? 'investido'
    : dayStatus === 'alerta'  ? 'gastos-altos'
    : spendRatio >= 0.8       ? 'comprometimento'
    : monthTotal === 0        ? 'sem-lancamento'
    : 'controle'

  const TIP_META: Record<TipType, { emoji: string; text: string; color: string; bg: string }> = {
    investido:        { emoji: '💚', color: C.greenDark, bg: C.greenBg,
                        text: `Você está investindo e controlando! ${fmtBRL(investedThisMonth)} guardados este mês. Continue assim!` },
    'gastos-altos':   { emoji: '🚨', color: C.coralDark, bg: C.coralBg,
                        text: 'Seus gastos de hoje estão altos. Revise as despesas e evite compras não planejadas.' },
    comprometimento:  { emoji: '⚠️', color: C.amberDark, bg: C.amberBg,
                        text: `${spendPct}% da sua renda já foi comprometida. Cuidado para não extrapolar o orçamento.` },
    'sem-lancamento': { emoji: '📝', color: C.purple,    bg: C.purpleBg,
                        text: 'Lance sua primeira despesa do mês para acompanhar seu controle financeiro em tempo real.' },
    controle:         { emoji: '🎯', color: C.greenDark, bg: C.greenBg,
                        text: 'Você está no caminho certo! Mantenha o controle e registre todos os seus gastos.' },
  }
  const tipMeta = TIP_META[tipType]

  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: C.purple, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}>{avatar}</div>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* ── Saudação ── */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 2px' }}>{greeting} ☀️</p>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: 0 }}>
            {firstName}!
          </h1>
        </div>

        {/* ── DNA Progress ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, color: C.purple }}>🧬</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>DNA Financeiro</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.purple }}>{dnaProgress}%</span>
          </div>
          <div style={{ background: C.bgSecondary, borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              background: C.purple, height: '100%', borderRadius: 99,
              width: `${Math.max(dnaProgress, 3)}%`, transition: 'width 0.5s',
            }} />
          </div>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
            {dnaProgress >= 100
              ? '✅ DNA 100% completo — seu relatório está pronto!'
              : 'Complete mais informações para receber dicas melhores.'}
          </p>
          {dnaProgress < 100 ? (
            <a href={`/${unitSlug}/dna`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              marginTop: 10,
              background: C.purple, color: '#fff',
              borderRadius: 8, padding: '7px 14px',
              fontSize: 11, fontWeight: 600, textDecoration: 'none',
            }}>
              🧬 Continuar DNA ({dnaProgress}%) →
            </a>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <a href={`/${unitSlug}/relatorio`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: C.purple, color: '#fff',
                borderRadius: 8, padding: '7px 14px',
                fontSize: 11, fontWeight: 600, textDecoration: 'none',
              }}>
                📋 Ver relatório →
              </a>
              <a href={`/${unitSlug}/dna`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: C.bgSecondary, color: C.textSec,
                borderRadius: 8, padding: '7px 14px',
                fontSize: 11, fontWeight: 500, textDecoration: 'none',
              }}>
                🔄 Atualizar respostas
              </a>
            </div>
          )}
        </div>

        {/* ── Card: Minha Empresa (só para leads empresariais) ── */}
        {isBusiness && (
          <div style={{
            background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
            padding: '14px 16px', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: C.purpleBg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>🏢</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>Minha Empresa</p>
                <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>DNA Empresarial</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>{bizProgress}%</span>
            </div>
            <div style={{ background: C.bgSecondary, borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 99, background: C.purple,
                width: `${Math.max(bizProgress, 3)}%`, transition: 'width 0.5s',
              }} />
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textSec, lineHeight: 1.4 }}>
              {bizProgress >= 100
                ? '✅ Perfil empresarial completo — consultor pode analisar seu negócio.'
                : 'Complete o DNA do seu negócio para receber soluções personalizadas.'}
            </p>
            <a href={`/${unitSlug}/empresa`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: bizProgress >= 100 ? C.bgSecondary : C.purple,
              color: bizProgress >= 100 ? C.textSec : '#fff',
              borderRadius: 8, padding: '7px 14px',
              fontSize: 11, fontWeight: 600, textDecoration: 'none',
            }}>
              {bizProgress >= 100 ? '🔄 Revisar dados' : '🏢 Preencher dados da empresa →'}
            </a>
          </div>
        )}

        {/* ── Card: Relatório pronto (só aparece quando DNA = 100%) ── */}
        {dnaProgress >= 100 && (
          <div style={{
            background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDeep} 100%)`,
            borderRadius: 16, padding: '16px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: `0 4px 20px ${C.purple}40`,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: 'rgba(255,255,255,0.18)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>📋</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                Seu relatório está pronto!
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                Perfil, pontos fortes, plano de ação e oportunidades personalizadas.
              </p>
            </div>
            <a href={`/${unitSlug}/relatorio`} style={{
              flexShrink: 0,
              background: '#fff', color: C.purpleDeep,
              borderRadius: 10, padding: '8px 14px',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              Ver →
            </a>
          </div>
        )}

        {/* ── Meu Dia Financeiro ── */}
        <div style={{ marginBottom: 10 }}>

          {/* Cabeçalho da seção */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>📅</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Meu Dia Financeiro</span>
            </div>
            <span style={{ fontSize: 10, color: C.textSec, textTransform: 'capitalize' }}>{todayLabel}</span>
          </div>

          {/* Status do dia — card full-width */}
          <div style={{
            background: dayMeta.bg, borderRadius: 16,
            padding: '14px 16px', marginBottom: 8,
            border: `0.5px solid ${dayMeta.color}30`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: '#fff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                boxShadow: `0 2px 8px ${dayMeta.color}20`,
              }}>{dayMeta.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: dayMeta.color, margin: 0 }}>{dayMeta.label}</p>
                  <span style={{
                    background: dayMeta.color, color: '#fff',
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                  }}>{dayMeta.badge}</span>
                </div>
                <p style={{ fontSize: 11, color: dayMeta.color, margin: 0, lineHeight: 1.5 }}>{dayMeta.desc}</p>
                {pctHoje > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 99, height: 4, overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{
                        background: dayMeta.color, height: '100%', borderRadius: 99,
                        width: `${Math.min(pctHoje, 100)}%`, transition: 'width .4s',
                      }} />
                    </div>
                    <p style={{ fontSize: 9, color: dayMeta.color, margin: 0 }}>{pctHoje}% do limite diário utilizado</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 6 métricas — grid 3 colunas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
            <MetricChip
              label="Hoje"
              value={todayTotal > 0 ? fmtBRL(todayTotal) : '—'}
              color={limiteDiario > 0 && todayTotal > limiteDiario ? C.coralDark : C.text}
            />
            <MetricChip
              label="Semana"
              value={weekTotal > 0 ? fmtBRL(weekTotal) : '—'}
            />
            <MetricChip
              label="Mês"
              value={monthTotal > 0 ? fmtBRL(monthTotal) : '—'}
              color={spendStatus === 'risco' ? C.coralDark : C.text}
            />
            <MetricChip
              label="Investido"
              value={investedThisMonth > 0 ? fmtBRL(investedThisMonth) : '—'}
              color={investedThisMonth > 0 ? C.greenDark : C.textTer}
              bg={investedThisMonth > 0 ? C.greenBg : '#fff'}
            />
            <MetricChip
              label="Saldo est."
              value={income > 0 ? fmtBRL(saldoEstimado) : '—'}
              color={income > 0 ? (saldoEstimado >= 0 ? C.greenDark : C.coralDark) : C.textTer}
            />
            <MetricChip
              label="Limite/dia"
              value={limiteDiario > 0 ? fmtBRL(limiteDiario) : '—'}
              color={limiteDiario > 0 ? C.purple : C.textTer}
            />
          </div>

          {/* Dica do dia */}
          <div style={{
            background: tipMeta.bg, borderRadius: 14,
            padding: '12px 14px', marginBottom: 8,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{tipMeta.emoji}</span>
            <p style={{ fontSize: 12, color: tipMeta.color, margin: 0, lineHeight: 1.5 }}>{tipMeta.text}</p>
          </div>

          {/* Pergunta inteligente do dia */}
          <PerguntaDia unitSlug={unitSlug} />

          {/* Ações rápidas — 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 4 }}>
            <ActionBtn href={`/${unitSlug}/despesas/nova`} emoji="💸" label="Lançar despesa"    bg={C.coralBg}  color={C.coralDark}  />
            <ActionBtn href={`/${unitSlug}/investimentos`} emoji="💚" label="Registrar invest." bg={C.greenBg}  color={C.greenDark}  />
            <ActionBtn href={`/${unitSlug}/oportunidades`} emoji="🎯" label="Ver oportunidades" bg={C.amberBg}  color={C.amberDark}  />
            <ActionBtn href={`/${unitSlug}/relatorio`}     emoji="📋" label="Ver relatório"     bg={C.purpleBg} color={C.purpleDeep} />
          </div>
        </div>

        {/* ── Estou me pagando ── */}
        <div style={{
          background: investedThisMonth > 0
            ? `linear-gradient(135deg, ${C.greenBg} 0%, #e8faf0 100%)`
            : '#fff',
          borderRadius: 16, padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${investedThisMonth > 0 ? `${C.greenDark}20` : C.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: investedThisMonth > 0 ? '#fff' : C.greenBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            boxShadow: investedThisMonth > 0 ? `0 2px 8px ${C.greenDark}15` : 'none',
          }}>💚</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600,
              color: investedThisMonth > 0 ? C.greenDark : C.text,
            }}>
              {investedThisMonth > 0
                ? `Você se pagou ${fmtBRL(investedThisMonth)} este mês!`
                : 'Estou me pagando'}
            </p>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.4,
              color: investedThisMonth > 0 ? C.greenDark : C.textSec,
            }}>
              {investedThisMonth > 0
                ? `${income > 0 ? `${Math.round((investedThisMonth / income) * 100)}% da renda · ` : ''}Patrimônio crescendo.`
                : 'Separe algo para você antes de pagar as contas.'}
            </p>
          </div>
          <a href={`/${unitSlug}/investimentos`} style={{
            flexShrink: 0, textDecoration: 'none',
            background: investedThisMonth > 0 ? C.green : C.greenBg,
            color: investedThisMonth > 0 ? '#fff' : C.greenDark,
            borderRadius: 10, padding: '7px 13px',
            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            {investedThisMonth > 0 ? 'Ver →' : 'Registrar →'}
          </a>
        </div>

        {/* ── Sonho principal ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              background: C.amberBg, borderRadius: 10,
              width: 36, height: 36, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>{dreamInfo.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Seu sonho principal</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: '2px 0 0' }}>
                {dreamInfo.label}
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Faltam</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.amberDark, margin: 0 }}>
                definir meta
              </p>
            </div>
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.06)', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 5,
          }}>
            <div style={{ background: C.amber, height: '100%', borderRadius: 99, width: '5%' }} />
          </div>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
            Diagnóstico iniciado — próximo passo: definir sua meta financeira
          </p>
        </div>

        {/* ── Despesas recentes ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          padding: '14px 16px', marginBottom: 10,
          border: `0.5px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Despesas registradas</span>
            <a href={`/${unitSlug}/despesas/nova`} style={{ fontSize: 11, color: C.purple, textDecoration: 'none', fontWeight: 500 }}>
              + Lançar
            </a>
          </div>
          {monthTotal > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {todayTotal > 0 && (
                <span style={{ background: C.coralBg, color: C.coralDark, fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99 }}>
                  Hoje {fmtBRL(todayTotal)}
                </span>
              )}
              {weekTotal > 0 && (
                <span style={{ background: C.amberBg, color: C.amberDark, fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99 }}>
                  Semana {fmtBRL(weekTotal)}
                </span>
              )}
              <span style={{ background: C.purpleBg, color: C.purpleDeep, fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99 }}>
                Mês {fmtBRL(monthTotal)}
              </span>
            </div>
          )}

          {recentExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 22, margin: '0 0 6px' }}>📭</p>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
                Nenhuma despesa registrada ainda.
              </p>
              <p style={{ fontSize: 11, color: C.textTer, margin: '4px 0 0' }}>
                Lance sua primeira despesa para melhorar seu diagnóstico.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentExpenses.slice(0, 5).map((exp, i) => {
                const cat   = EXPENSE_CATS[exp.category] ?? { emoji: '📦', label: exp.category }
                const total = Math.min(recentExpenses.length, 5)
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    paddingBottom: i < total - 1 ? 8 : 0,
                    borderBottom: i < total - 1 ? `0.5px solid ${C.border}` : 'none',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, background: C.bgSecondary,
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>{cat.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{cat.label}</p>
                      {exp.description && (
                        <p style={{ fontSize: 11, color: C.textSec, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exp.description}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.coral, flexShrink: 0 }}>
                      -{fmtBRL(exp.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Oportunidade da semana ── */}
        <FeaturedOppCard
          unitSlug={unitSlug}
          title={featuredTitle}
          oppId={featuredOppId}
          oppType={featuredOppType}
          targetDream={featuredOppDream}
          isFallback={isFeaturedFallback}
          ctaUrl={featuredCtaUrl}
          ctaLabel={featuredCtaLabel}
        />

        {/* ── Conquista desbloqueada ── */}
        <div style={{
          background: C.amberBg, borderRadius: 16,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>🏆</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.amberDark, margin: '0 0 2px' }}>
              Conquista desbloqueada!
            </p>
            <p style={{ fontSize: 12, color: '#854F0B', margin: 0, lineHeight: 1.4 }}>
              Diagnóstico iniciado — Primeiro passo dado 🎉
            </p>
          </div>
          <span style={{
            background: C.amber, color: '#fff',
            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99, flexShrink: 0,
          }}>+50 pts</span>
        </div>

      </main>

      <LeadBottomNav unitSlug={unitSlug} isBusiness={isBusiness} />
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function MetricChip({ label, value, color = C.text, bg = '#fff' }: {
  label: string; value: string; color?: string; bg?: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 12,
      padding: '10px 8px', border: `0.5px solid ${C.border}`,
      textAlign: 'center',
    }}>
      <p style={{
        fontSize: 9, color: C.textSec, fontWeight: 500, margin: '0 0 3px',
        textTransform: 'uppercase', letterSpacing: '0.4px',
      }}>{label}</p>
      <p style={{
        fontSize: 13, fontWeight: 600, color, margin: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</p>
    </div>
  )
}

function ActionBtn({ href, emoji, label, bg, color }: {
  href: string; emoji: string; label: string; bg: string; color: string
}) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: bg, borderRadius: 13, padding: '12px 14px',
      textDecoration: 'none', border: `0.5px solid ${color}20`,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color, lineHeight: 1.2 }}>{label}</span>
    </a>
  )
}
