// =============================================================================
// /[unitSlug]/relatorio — Relatório DNA Financeiro
//
// SEGURANÇA:
//   • lead_id resolvido do cookie HttpOnly (dna_lead_token) — nunca do browser
//   • unit_slug validado contra o banco
//   • unit_id e lead_id não chegam ao frontend
//   • Relatório gerado com regras locais — sem IA externa
//   • Dados de outros usuários inacessíveis (validação por unit_slug + lead_id)
// =============================================================================

import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { C } from '@/app/components/ui'

interface Props {
  params: Promise<{ unitSlug: string }>
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const DREAMS: Record<string, { label: string; emoji: string; mensagem: string; proximoPasso: string }> = {
  carro: {
    label: 'Carro próprio', emoji: '🚗',
    mensagem: 'Ter seu próprio carro representa liberdade e praticidade no dia a dia. Com planejamento consistente, esse sonho pode ser realidade muito mais rápido do que parece.',
    proximoPasso: 'Pesquise o valor do carro desejado, calcule quanto pode guardar por mês e simule em quantos meses você chega lá. Cada depósito mensal é um passo.',
  },
  casa: {
    label: 'Casa própria', emoji: '🏠',
    mensagem: 'Ter a sua própria casa é uma das conquistas mais importantes da vida. Com disciplina e foco, você pode transformar esse sonho em realidade.',
    proximoPasso: 'Pesquise linhas de crédito imobiliário, calcule a entrada necessária e defina uma meta de poupança mensal. Cada real guardado é um passo mais perto.',
  },
  negocio: {
    label: 'Negócio próprio', emoji: '🏪',
    mensagem: 'Empreender é um caminho poderoso para a independência financeira. Com as finanças pessoais organizadas, você terá a base certa para crescer.',
    proximoPasso: 'Reserve um fundo de emergência pessoal antes de investir no negócio. Participe de eventos de empreendedorismo e busque mentoria de quem já trilhou esse caminho.',
  },
  viagem: {
    label: 'Viagem dos sonhos', emoji: '✈️',
    mensagem: 'Uma viagem bem planejada cabe no orçamento de qualquer pessoa. O segredo é definir destino, custo e prazo — e guardar mês a mês.',
    proximoPasso: 'Defina o destino, pesquise o custo total da viagem e divida pelo número de meses até a data. Guarde esse valor mensalmente em uma conta separada.',
  },
  reserva: {
    label: 'Reserva de emergência', emoji: '🐷',
    mensagem: 'Ter uma reserva é o alicerce de toda vida financeira saudável. Com ela, imprevistos não viram dívidas — e você pode avançar para outros sonhos com segurança.',
    proximoPasso: 'Meta: 3 a 6 meses dos seus gastos mensais. Comece com R$ 50 por mês e aumente gradualmente. Automatize o depósito para não esquecer.',
  },
  faculdade: {
    label: 'Faculdade', emoji: '🎓',
    mensagem: 'Investir em educação é um dos retornos mais sólidos que existem. Com planejamento, o acesso ao ensino superior está ao seu alcance.',
    proximoPasso: 'Pesquise bolsas (ProUni, FIES, privadas), calcule o custo total e planeje a economia mensal necessária. Conhecimento é o único ativo que ninguém te tira.',
  },
  reforma: {
    label: 'Reforma da casa', emoji: '🔨',
    mensagem: 'Transformar o espaço onde você vive melhora qualidade de vida e pode valorizar seu patrimônio. Um sonho realizável por etapas com planejamento.',
    proximoPasso: 'Faça um orçamento das reformas prioritárias, divida por etapas e comece pela mais urgente. Guarde um valor fixo por mês destinado só para isso.',
  },
  dividas: {
    label: 'Quitar dívidas', emoji: '💳',
    mensagem: 'Quitar suas dívidas é o passo mais libertador que você pode dar. Sem juros pesando no orçamento, sua renda vai render muito mais e abrir espaço para outros sonhos.',
    proximoPasso: 'Liste todas as dívidas com suas taxas de juros. Priorize pagar as mais caras primeiro (método avalanche) e negocie melhores condições — muitos credores aceitam.',
  },
  moto: {
    label: 'Moto', emoji: '🏍️',
    mensagem: 'Uma moto pode representar muito mais que transporte — é independência, economia e qualidade de vida no dia a dia. Com planejamento, você chega lá.',
    proximoPasso: 'Calcule o valor da moto desejada, pesquise custos de seguro e manutenção, e defina quanto guardar mensalmente para realizar esse sonho.',
  },
  outro: {
    label: 'Sonho pessoal', emoji: '⭐',
    mensagem: 'Ter um objetivo claro é o primeiro passo para realizá-lo. Agora é hora de dar um número e um prazo para esse sonho.',
    proximoPasso: 'Defina um valor estimado, estabeleça um prazo e calcule quanto guardar por mês. Comece com qualquer valor — o importante é começar.',
  },
}

const EXPENSE_CATS: Record<string, { emoji: string; label: string; dica: string }> = {
  alimentacao: { emoji: '🍽️', label: 'Alimentação',  dica: 'Planejar refeições semanais e cozinhar em casa pode reduzir até 30% dos gastos com comida.' },
  mercado:     { emoji: '🛒', label: 'Mercado',      dica: 'Fazer lista antes de ir ao mercado e evitar compras por impulso economiza de 15 a 25% por mês.' },
  transporte:  { emoji: '🚗', label: 'Transporte',   dica: 'Combinar caronas, revisar seguros e usar transporte público em dias alternados pode gerar boa economia.' },
  saude:       { emoji: '💊', label: 'Saúde',        dica: 'Pesquise farmácias populares, genéricos e planos coletivos — podem custar 40% menos que individuais.' },
  educacao:    { emoji: '📚', label: 'Educação',     dica: 'Busque bolsas e cursos gratuitos. Investir em conhecimento tem retorno certo — só escolha com critério.' },
  lazer:       { emoji: '🎮', label: 'Lazer',        dica: 'Lazer não precisa ser caro. Priorize opções gratuitas ou de baixo custo sem abrir mão da qualidade de vida.' },
  dividas:     { emoji: '💳', label: 'Dívidas',      dica: 'Renegociar parcelas e evitar o crédito rotativo pode reduzir os juros drasticamente.' },
  contas:      { emoji: '📄', label: 'Contas fixas', dica: 'Revise assinaturas e serviços que você não usa mais. Pequenas economias fixas somam bastante no fim do mês.' },
  outros:      { emoji: '📦', label: 'Outros',       dica: 'Classifique melhor esses gastos — identificar a categoria certa ajuda a encontrar onde cortar.' },
}

const HABILIDADES_LABELS: Record<string, string> = {
  culinaria:       '🍳 Culinária',
  costura_moda:    '🧵 Costura / Moda',
  beleza_estetica: '💅 Beleza / Estética',
  tecnologia_ti:   '💻 Tecnologia / TI',
  design:          '🎨 Design',
  aulas_cursos:    '📚 Aulas / Cursos',
  motorista:       '🚗 Motorista / App',
  entregas:        '📦 Entregas',
  artesanato:      '🎁 Artesanato',
  vendas:          '🛒 Vendas',
  outro:           '📌 Outra habilidade',
}

const BARREIRA_LABELS: Record<string, string> = {
  falta_dinheiro:     'Falta de dinheiro',
  dividas:            'Dívidas',
  falta_disciplina:   'Falta de disciplina',
  falta_conhecimento: 'Falta de conhecimento',
  renda_instavel:     'Renda instável',
  falta_tempo:        'Falta de tempo',
}

const PRAZO_LABELS: Record<string, string> = {
  menos_1_ano:   'Menos de 1 ano',
  de_1_a_3_anos: 'Entre 1 e 3 anos',
  de_3_a_5_anos: 'Entre 3 e 5 anos',
  mais_5_anos:   'Mais de 5 anos',
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS E PERFIS
// ═══════════════════════════════════════════════════════════════════════════════

interface ProfileDef {
  label: string; emoji: string; color: string; bg: string; barColor: string; desc: string
}

const PROFILES: Record<string, ProfileDef> = {
  atencao: {
    label: 'Atenção Financeira', emoji: '🚨',
    color: C.coralDark, bg: C.coralBg, barColor: C.coral,
    desc: 'Sua situação exige atenção agora. Isso não é fraqueza — é o momento certo de buscar apoio e dar os primeiros passos concretos. Com o acompanhamento certo, a virada é totalmente possível.',
  },
  reorganizacao: {
    label: 'Em Reorganização', emoji: '🔄',
    color: C.amberDark, bg: C.amberBg, barColor: C.amber,
    desc: 'Você está em transição. Sentiu que as coisas podem melhorar e veio buscar clareza — isso já é muito! Com disciplina e um plano claro, a reorganização financeira é totalmente possível.',
  },
  evolucao: {
    label: 'Em Evolução', emoji: '📈',
    color: C.purpleDeep, bg: C.purpleBg, barColor: C.purple,
    desc: 'Você já deu os passos iniciais e está avançando. O momento agora é consolidar bons hábitos, criar metas mais arrojadas e acelerar seu progresso.',
  },
  potencial: {
    label: 'Bom Potencial', emoji: '💡',
    color: C.greenDark, bg: C.greenBg, barColor: C.green,
    desc: 'Sua base financeira está firme e você tem potencial real de crescimento. Com estratégia e consistência, pode acelerar muito sua evolução patrimonial.',
  },
  realizador: {
    label: 'Realizador em Construção', emoji: '🏆',
    color: C.greenDark, bg: C.greenBg, barColor: C.green,
    desc: 'Excelente! Você tem as bases para construir um futuro financeiro próspero. O próximo nível é otimizar, investir com estratégia e multiplicar seus resultados.',
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES PURAS (sem IA — apenas regras locais)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateProfile(
  ans:    Record<string, string>,
  income: number,
  sobra:  number,
): ProfileDef {
  let score = 0

  const scoring: Record<string, Record<string, number>> = {
    situacao_financeira:        { tranquila: 4, controlada: 3, apertada: 2, endividada: 1, critica: 0 },
    controla_gastos:            { sim_sempre: 3, as_vezes: 2, raramente: 1, nao: 0 },
    tem_reserva:                { sim_suficiente: 3, sim_pequena: 2, nao_mas_quero: 1, nao: 0 },
    tem_dividas:                { nao: 3, sim_consigo_pagar: 2, sim_apertado: 1, sim_nao_consigo_pagar: 0 },
    comprometimento_financeiro: { muito: 3, moderado: 2, pouco: 1, preciso_ajuda: 0 },
  }

  for (const [key, map] of Object.entries(scoring)) {
    const v = ans[key]
    score += v ? (map[v] ?? 1) : 1   // default 1 se não respondeu
  }

  // Ajuste financeiro (renda informada no cadastro)
  if (income > 0) {
    if (sobra < 0)               score -= 2
    else if (sobra > income * 0.2) score += 1
  }

  if (score <= 3)  return PROFILES.atencao
  if (score <= 7)  return PROFILES.reorganizacao
  if (score <= 11) return PROFILES.evolucao
  if (score <= 14) return PROFILES.potencial
  return PROFILES.realizador
}

interface Item { emoji: string; title: string; desc: string }

function generateStrengths(
  ans:        Record<string, string>,
  income:     number,
  sobra:      number,
  monthTotal: number,
  hasDream:   boolean,
  dnaProgress:number,
): Item[] {
  const list: Item[] = []

  if (dnaProgress >= 80)
    list.push({ emoji: '🧬', title: 'Autoconhecimento financeiro',
      desc: 'Você se dispôs a analisar sua realidade financeira. Esse primeiro passo é o mais difícil — e você já deu.' })

  if (hasDream)
    list.push({ emoji: '🎯', title: 'Sonho definido',
      desc: 'Ter um objetivo claro é essencial para o progresso. Você já sabe onde quer chegar — agora é traçar o caminho.' })

  if (monthTotal > 0)
    list.push({ emoji: '📊', title: 'Controle ativo de gastos',
      desc: 'Você está registrando suas despesas. Quem controla seus gastos tem o poder de mudá-los.' })

  if (income > 0 && sobra > 0)
    list.push({ emoji: '✅', title: 'Equilíbrio de caixa',
      desc: `Sua renda cobre suas despesas fixas${sobra > income * 0.15 ? ' e ainda sobra um bom valor' : ''}. Esse saldo é sua alavanca para sonhos maiores.` })

  const re = ans.interesse_renda_extra
  if (re === 'sim_urgente' || re === 'sim_oportunidade')
    list.push({ emoji: '🚀', title: 'Visão de crescimento',
      desc: 'Você está aberto a oportunidades de renda extra. Quem busca crescer, encontra caminhos.' })

  const cg = ans.controla_gastos
  if (cg === 'sim_sempre' || cg === 'as_vezes')
    list.push({ emoji: '📋', title: 'Consciência financeira',
      desc: 'Você já tem o hábito de acompanhar seus gastos — isso é mais valioso do que parece.' })

  const comp = ans.comprometimento_financeiro
  if (comp === 'muito' || comp === 'moderado')
    list.push({ emoji: '💪', title: 'Comprometimento real',
      desc: 'Você está comprometido com sua saúde financeira. Esse é o combustível de qualquer transformação.' })

  const res = ans.tem_reserva
  if (res === 'sim_suficiente' || res === 'sim_pequena')
    list.push({ emoji: '🐷', title: 'Reserva iniciada',
      desc: 'Ter qualquer reserva já te coloca à frente da maioria. Agora é aumentá-la progressivamente.' })

  if (list.length < 2)
    list.push({ emoji: '🌱', title: 'Iniciativa de mudança',
      desc: 'Você buscou o DNA Financeiro. Isso mostra que você quer mudar sua realidade — e esse é o começo de tudo.' })

  return list.slice(0, 6)
}

function generateWeaknesses(
  ans:        Record<string, string>,
  income:     number,
  sobra:      number,
  monthTotal: number,
): Item[] {
  const list: Item[] = []

  const td = ans.tem_dividas
  if (td === 'sim_apertado' || td === 'sim_nao_consigo_pagar')
    list.push({ emoji: '💳', title: 'Dívidas pesando no orçamento',
      desc: 'Suas parcelas estão comprometendo boa parte da renda. Renegociar e criar um plano de quitação é urgente.' })

  if (income > 0 && sobra < 0)
    list.push({ emoji: '📉', title: 'Gastos acima da renda',
      desc: 'Suas despesas declaradas superam a renda. Isso exige revisão imediata do orçamento.' })
  else if (income > 0 && sobra >= 0 && sobra < income * 0.1)
    list.push({ emoji: '⚠️', title: 'Margem muito reduzida',
      desc: 'A sobra mensal está muito pequena. Qualquer imprevisto pode desequilibrar as contas.' })

  const sf = ans.situacao_financeira
  if (sf === 'critica' || sf === 'endividada')
    list.push({ emoji: '🚨', title: 'Situação financeira crítica',
      desc: 'Sua situação requer ações imediatas. Priorize quitar as dívidas mais caras e corte gastos não essenciais.' })

  const res = ans.tem_reserva
  if (res === 'nao' || res === 'nao_mas_quero')
    list.push({ emoji: '🆘', title: 'Sem reserva de emergência',
      desc: 'Sem reserva, qualquer imprevisto pode gerar novas dívidas. Criar uma é a prioridade número 1.' })

  const cg = ans.controla_gastos
  if (cg === 'nao' || cg === 'raramente')
    list.push({ emoji: '📋', title: 'Controle de gastos insuficiente',
      desc: 'Quem não acompanha seus gastos não sabe onde pode economizar. Lance despesas no app para ter visibilidade.' })

  const prazo = ans.prazo_sonho_principal
  if (!prazo || prazo === 'mais_5_anos')
    list.push({ emoji: '🎯', title: 'Sonho sem prazo definido',
      desc: 'Sonhos sem prazo ficam sendo sonhos. Defina quando você quer chegar lá e calcule o valor mensal necessário.' })

  if (income > 0 && monthTotal > 0 && monthTotal > income * 0.85)
    list.push({ emoji: '🔥', title: 'Gastos mensais elevados',
      desc: 'Seus lançamentos deste mês já representam mais de 85% da sua renda. Revise as categorias de maior impacto.' })

  if (list.length === 0)
    list.push({ emoji: '📌', title: 'Continue monitorando',
      desc: 'Sua situação está sob controle, mas consistência é a chave. Acompanhe os gastos todo mês.' })

  return list.slice(0, 5)
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATADORES
// ═══════════════════════════════════════════════════════════════════════════════

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function taxaPoupanca(income: number, sobra: number) {
  if (!income || income === 0) return null
  const pct = Math.round((sobra / income) * 100)
  if (pct <= 0)  return { pct, label: 'Negativa', color: C.coralDark, bg: C.coralBg }
  if (pct <= 10) return { pct, label: 'Baixa',    color: C.amberDark, bg: C.amberBg }
  if (pct <= 25) return { pct, label: 'Boa',      color: C.purpleDeep, bg: C.purpleBg }
  return              { pct, label: 'Excelente', color: C.greenDark,  bg: C.greenBg }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default async function RelatorioPage({ params }: Props) {
  const { unitSlug } = await params

  // ── 1. Cookie → leadId ────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) redirect(`/${unitSlug}`)

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error()
  } catch {
    redirect(`/${unitSlug}`)
  }

  const supabase = createServerSupabaseClient()

  // ── 2. Lead (valida unit_slug → cross-unit protection) ────────────────────
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('name, main_dream, monthly_income, monthly_expenses, city, dna_progress, unit_id, created_at')
    .eq('id', leadId)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadErr || !lead) redirect(`/${unitSlug}`)

  // ── 3. Unidade ────────────────────────────────────────────────────────────
  const { data: unit } = await supabase
    .from('units')
    .select('name, city, state, primary_color')
    .eq('slug', unitSlug)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!unit) redirect(`/${unitSlug}`)

  // ── 4. DNA Answers ────────────────────────────────────────────────────────
  const ans: Record<string, string> = {}
  try {
    const { data: dnaData } = await supabase
      .from('dna_answers')
      .select('question_key, answer')
      .eq('lead_id', leadId)
    for (const row of dnaData ?? []) ans[row.question_key] = row.answer
  } catch { /* relatório sem respostas DNA — mostra dados parciais */ }

  // ── 5. Despesas do mês ────────────────────────────────────────────────────
  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = `${today.slice(0, 7)}-01`
  const weekAgo      = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let monthExpenses: { amount: number; category: string; expense_date: string }[] = []
  try {
    const { data } = await supabase
      .from('expenses')
      .select('amount, category, expense_date')
      .eq('lead_id', leadId)
      .is('deleted_at', null)
      .gte('expense_date', firstOfMonth)
      .limit(200)
    monthExpenses = data ?? []
  } catch { /* silently ignore */ }

  const monthTotal  = monthExpenses.reduce((s, e) => s + e.amount, 0)
  const todayTotal  = monthExpenses.filter(e => e.expense_date === today).reduce((s, e) => s + e.amount, 0)
  const weekTotal   = monthExpenses.filter(e => e.expense_date >= weekAgo).reduce((s, e) => s + e.amount, 0)

  // Agrupamento por categoria (top 3)
  const catTotals: Record<string, number> = {}
  for (const e of monthExpenses) {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount
  }
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // ── 6. Cálculos ───────────────────────────────────────────────────────────
  const income      = lead.monthly_income   ?? 0
  const expenses    = lead.monthly_expenses ?? 0
  const sobra       = income - expenses
  const limDiario   = sobra > 0 ? sobra / 30 : 0
  const dnaProgress = lead.dna_progress ?? 0
  const dream       = lead.main_dream ?? 'outro'
  const dreamInfo   = DREAMS[dream] ?? DREAMS.outro
  const firstName   = lead.name.split(' ')[0]
  const taxa        = taxaPoupanca(income, sobra)

  const profile   = calculateProfile(ans, income, sobra)
  const strengths = generateStrengths(ans, income, sobra, monthTotal, !!lead.main_dream, dnaProgress)
  const weaknesses = generateWeaknesses(ans, income, sobra, monthTotal)

  const habilidades    = (ans.habilidades ?? '').split(',').filter(Boolean)
  const wantsRendaExtra = ['sim_urgente', 'sim_oportunidade'].includes(ans.interesse_renda_extra ?? '')
  const prazoLabel      = PRAZO_LABELS[ans.prazo_sonho_principal ?? ''] ?? null
  const barreira        = ans.barreira_principal

  const primary = unit.primary_color ? `#${unit.primary_color.replace('#', '')}` : C.purple
  const generated = fmtDate(new Date())

  // ── Ratio de gastos reais para barra ──────────────────────────────────────
  const spendRatio = income > 0 && monthTotal > 0 ? Math.min(monthTotal / income, 1) : 0
  const spendPct   = Math.round(spendRatio * 100)

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
          <div style={{ fontWeight: 600, fontSize: 14, color: primary }}>DNA Financeiro</div>
          <div style={{ fontSize: 11, color: C.textSec }}>{unit.city} · {unit.state}</div>
        </div>
        <a href={`/${unitSlug}/painel`} style={{
          marginLeft: 'auto', fontSize: 12, color: C.textSec,
          textDecoration: 'none', padding: '5px 10px',
          border: `0.5px solid ${C.border}`, borderRadius: 8,
        }}>← Painel</a>
      </header>

      <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* ── CAPA ── */}
        <div style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${C.purpleDeep} 100%)`,
          borderRadius: 20, padding: '24px 20px 20px',
          marginBottom: 12, position: 'relative', overflow: 'hidden',
        }}>
          {/* Detalhe decorativo */}
          <div style={{
            position: 'absolute', top: -20, right: -20,
            width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: -10,
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }} />

          <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
            🧬 Relatório DNA Financeiro
          </p>
          <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            {lead.name}
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {unit.city} · {unit.state}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>DNA Financeiro</p>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                <div style={{
                  background: '#fff', height: '100%', borderRadius: 99,
                  width: `${Math.max(dnaProgress, 3)}%`, transition: 'width 0.5s',
                }} />
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: 10,
              padding: '6px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{dnaProgress}%</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>DNA</div>
            </div>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            Gerado em {generated}
          </p>
        </div>

        {/* Aviso se DNA incompleto */}
        {dnaProgress < 100 && (
          <div style={{
            background: C.amberBg, borderRadius: 14,
            padding: '12px 14px', marginBottom: 12,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: C.amberDark }}>
                DNA {dnaProgress}% completo
              </p>
              <p style={{ margin: 0, fontSize: 11, color: C.amberDark, lineHeight: 1.5 }}>
                Complete as etapas restantes para um relatório ainda mais preciso e personalizado.{' '}
                <a href={`/${unitSlug}/dna`} style={{ color: C.purpleDeep, fontWeight: 600, textDecoration: 'none' }}>
                  Completar agora →
                </a>
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 1 — PERFIL FINANCEIRO
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="🧬" title="Seu Perfil Financeiro" />
        <div style={{
          background: profile.bg, borderRadius: 18,
          padding: '20px', marginBottom: 12,
          border: `1.5px solid ${profile.color}20`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: '#fff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              boxShadow: `0 2px 12px ${profile.color}20`,
            }}>{profile.emoji}</div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, color: profile.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Seu perfil
              </p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: profile.color }}>
                {profile.label}
              </p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: profile.color, lineHeight: 1.6 }}>
            {profile.desc}
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 2 — RESUMO FINANCEIRO
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="💰" title="Resumo Financeiro" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <FinTile label="Renda aproximada"    value={income > 0 ? fmtBRL(income) : '—'}   />
          <FinTile label="Despesas do cadastro" value={expenses > 0 ? fmtBRL(expenses) : '—'} valueColor={expenses > income && income > 0 ? C.coral : C.text} />
          <FinTile
            label="Sobra estimada"
            value={income > 0 ? fmtBRL(sobra) : '—'}
            valueColor={sobra >= 0 ? C.greenDark : C.coralDark}
            bg={sobra >= 0 ? C.greenBg : C.coralBg}
          />
          <FinTile label="Limite saudável/dia" value={limDiario > 0 ? fmtBRL(limDiario) : '—'} valueColor={C.purpleDeep} />
        </div>

        {taxa && (
          <div style={{
            background: taxa.bg, borderRadius: 14,
            padding: '12px 14px', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, color: C.textSec }}>Taxa de poupança estimada</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: taxa.color }}>
                {taxa.pct > 0 ? `${taxa.pct}%` : `${taxa.pct}%`} da renda
              </p>
            </div>
            <span style={{ background: '#fff', color: taxa.color, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99 }}>
              {taxa.label}
            </span>
          </div>
        )}

        {/* Gastos reais do mês */}
        {(monthTotal > 0 || todayTotal > 0) && (
          <div style={{
            background: '#fff', borderRadius: 14,
            padding: '14px', marginBottom: 12,
            border: `0.5px solid ${C.border}`,
          }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: C.text }}>
              📊 Gastos registrados no app
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {todayTotal > 0 && (
                <Chip label={`Hoje ${fmtBRL(todayTotal)}`} color={C.coralDark} bg={C.coralBg} />
              )}
              {weekTotal > 0 && (
                <Chip label={`Semana ${fmtBRL(weekTotal)}`} color={C.amberDark} bg={C.amberBg} />
              )}
              <Chip label={`Mês ${fmtBRL(monthTotal)}`} color={C.purpleDeep} bg={C.purpleBg} />
            </div>
            {income > 0 && spendPct > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{
                    background: spendPct > 90 ? C.coral : spendPct > 70 ? C.amber : C.green,
                    height: '100%', borderRadius: 99, width: `${spendPct}%`,
                  }} />
                </div>
                <p style={{ margin: 0, fontSize: 10, color: C.textSec }}>
                  {spendPct}% da renda utilizada este mês
                </p>
              </div>
            )}
          </div>
        )}

        {monthTotal === 0 && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: '14px 14px',
            marginBottom: 12, border: `0.5px solid ${C.border}`, textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: C.textSec }}>📭 Nenhuma despesa registrada este mês</p>
            <a href={`/${unitSlug}/despesas/nova`} style={{ fontSize: 12, color: C.purple, fontWeight: 600, textDecoration: 'none' }}>
              Lançar minha primeira despesa →
            </a>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 3 — SONHO PRINCIPAL
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="✨" title="Seu Sonho Principal" />
        <div style={{
          background: C.amberBg, borderRadius: 18,
          padding: '18px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: '#fff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>{dreamInfo.emoji}</div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 10, color: C.amberDark, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Objetivo de vida
              </p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.amberDark }}>
                {dreamInfo.label}
              </p>
              {prazoLabel && (
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#854F0B' }}>
                  Prazo desejado: {prazoLabel}
                </p>
              )}
            </div>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#854F0B', lineHeight: 1.6 }}>
            {dreamInfo.mensagem}
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.6)', borderRadius: 12,
            padding: '12px', borderLeft: `3px solid ${C.amber}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: C.amberDark }}>
              🎯 Próximo passo recomendado
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#854F0B', lineHeight: 1.5 }}>
              {dreamInfo.proximoPasso}
            </p>
          </div>

          {barreira && (
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#854F0B' }}>
              <strong>Maior barreira identificada:</strong>{' '}
              {BARREIRA_LABELS[barreira] ?? barreira}
            </p>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 4 — PONTOS FORTES
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="💪" title="Pontos Fortes" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {strengths.map((s, i) => (
            <ItemCard key={i} emoji={s.emoji} title={s.title} desc={s.desc} accentColor={C.greenDark} accentBg={C.greenBg} />
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 5 — PONTOS DE ATENÇÃO
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="⚠️" title="Pontos de Atenção" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {weaknesses.map((w, i) => (
            <ItemCard key={i} emoji={w.emoji} title={w.title} desc={w.desc} accentColor={C.coralDark} accentBg={C.coralBg} />
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 6 — OPORTUNIDADES DE ECONOMIA
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="💡" title="Oportunidades de Economia" />
        {topCats.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {topCats.map(([cat, total], i) => {
              const info = EXPENSE_CATS[cat] ?? { emoji: '📦', label: cat, dica: 'Analise esses gastos e veja onde é possível reduzir.' }
              const pct  = monthTotal > 0 ? Math.round((total / monthTotal) * 100) : 0
              return (
                <div key={i} style={{
                  background: '#fff', borderRadius: 14,
                  padding: '14px', border: `0.5px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{info.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{info.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.coral }}>{fmtBRL(total)}</span>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 99, height: 4, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ background: C.coral, height: '100%', borderRadius: 99, width: `${pct}%` }} />
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textSec }}>{pct}% do total do mês</p>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: C.textSec, lineHeight: 1.5, paddingTop: 8, borderTop: `0.5px solid ${C.border}` }}>
                    💡 {info.dica}
                  </p>
                </div>
              )
            })}
            {limDiario > 0 && (
              <div style={{
                background: C.purpleBg, borderRadius: 14,
                padding: '12px 14px',
              }}>
                <p style={{ margin: 0, fontSize: 12, color: C.purpleDeep, lineHeight: 1.5 }}>
                  🎯 <strong>Dica prática:</strong> Reduzir apenas{' '}
                  <strong>{fmtBRL(Math.min(limDiario * 0.5, 20))} por dia</strong>{' '}
                  pode gerar até{' '}
                  <strong>{fmtBRL(Math.min(limDiario * 0.5, 20) * 30)}</strong> extras no mês para seu sonho.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 14, padding: '20px', marginBottom: 12,
            border: `0.5px solid ${C.border}`, textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 20 }}>📊</p>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: C.text, fontWeight: 500 }}>
              Lance despesas para ver suas oportunidades de economia
            </p>
            <p style={{ margin: 0, fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>
              Com seus gastos registrados, identificamos onde cortar sem comprometer sua qualidade de vida.
            </p>
            <a href={`/${unitSlug}/despesas/nova`} style={{
              display: 'inline-block', marginTop: 12,
              background: C.purple, color: '#fff',
              borderRadius: 10, padding: '8px 18px',
              fontSize: 12, fontWeight: 500, textDecoration: 'none',
            }}>
              Lançar despesa →
            </a>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 7 — RENDA EXTRA
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="🚀" title="Oportunidades de Renda Extra" />
        {wantsRendaExtra ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              background: '#fff', borderRadius: 14,
              padding: '14px', marginBottom: 8,
              border: `0.5px solid ${C.border}`,
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: C.text }}>
                💼 Suas habilidades identificadas
              </p>
              {habilidades.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {habilidades.map(h => (
                    <span key={h} style={{
                      background: C.purpleBg, color: C.purpleDeep,
                      fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 99,
                    }}>
                      {HABILIDADES_LABELS[h] ?? h}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>
                  Nenhuma habilidade cadastrada ainda. Complete o DNA para receber sugestões personalizadas.
                </p>
              )}
              {ans.disponibilidade_horas && (
                <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textSec }}>
                  ⏱ Disponibilidade:{' '}
                  {{
                    menos_5h:    'Menos de 5h por semana',
                    de_5_a_10h:  'Entre 5h e 10h por semana',
                    de_10_a_20h: 'Entre 10h e 20h por semana',
                    mais_20h:    'Mais de 20h por semana',
                    sem_tempo:   'Sem tempo disponível no momento',
                  }[ans.disponibilidade_horas] ?? ans.disponibilidade_horas}
                </p>
              )}
            </div>
            <div style={{
              background: C.greenBg, borderRadius: 14,
              padding: '14px', border: `0.5px solid ${C.greenDark}20`,
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: C.greenDark }}>
                🎯 Próximos passos para gerar renda extra
              </p>
              {[
                'Acesse a seção de Oportunidades no painel para ver vagas alinhadas ao seu perfil.',
                'Cadastre seu portfólio ou serviço — comece com sua habilidade mais forte.',
                'Defina um preço mínimo por hora ou por serviço e divulgue para sua rede próxima.',
                'Considere plataformas como iFood, Uber, Freelancer ou Workana, dependendo do seu perfil.',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < 3 ? 8 : 0 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', background: C.green,
                    color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <p style={{ margin: 0, fontSize: 12, color: C.greenDark, lineHeight: 1.5 }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 14, padding: '18px', marginBottom: 12,
            border: `0.5px solid ${C.border}`,
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: C.text }}>
              💡 Já pensou em uma fonte de renda extra?
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
              Mesmo sem urgência, ter uma segunda fonte de renda é uma das melhores estratégias financeiras.
              Muitas pessoas ganham 20-50% a mais com habilidades que já têm.
            </p>
            <a href={`/${unitSlug}/dna`} style={{
              display: 'inline-block', background: C.purpleBg, color: C.purpleDeep,
              borderRadius: 10, padding: '8px 16px',
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}>
              Cadastrar minhas habilidades →
            </a>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 8 — PLANO 7 DIAS
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="📅" title="Plano de Ação — 7 Dias" />
        <div style={{
          background: '#fff', borderRadius: 14,
          padding: '14px', marginBottom: 12,
          border: `0.5px solid ${C.border}`,
        }}>
          {[
            { emoji: '📊', day: 'Dia 1', action: 'Lance todas as despesas de hoje no app — crie o hábito do controle diário.' },
            { emoji: '🎯', day: 'Dia 2', action: 'Defina sua meta de economia mensal com base na sobra estimada.' },
            { emoji: '🔍', day: 'Dia 3', action: 'Revise os gastos por categoria e identifique a maior oportunidade de corte.' },
            { emoji: '✂️', day: 'Dia 4', action: 'Escolha uma despesa para reduzir ou eliminar esta semana.' },
            { emoji: '🚀', day: 'Dia 5', action: 'Acesse a seção de Oportunidades e marque interesse em pelo menos uma.' },
            { emoji: '✨', day: 'Dia 6', action: 'Escreva em 3 frases o que você quer em 1 ano. Clareza gera ação.' },
            { emoji: '🏠', day: 'Dia 7', action: 'Volte ao painel, revise seu progresso e planeje a próxima semana.' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              paddingBottom: i < 6 ? 10 : 0,
              borderBottom: i < 6 ? `0.5px solid ${C.border}` : 'none',
              marginBottom: i < 6 ? 10 : 0,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: C.purpleBg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>{item.emoji}</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: C.purple }}>{item.day}</p>
                <p style={{ margin: 0, fontSize: 12, color: C.text, lineHeight: 1.5 }}>{item.action}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 9 — PLANO 30 DIAS
        ═══════════════════════════════════════════════════════════════════════ */}
        <SectionTitle emoji="🗓️" title="Plano de Ação — 30 Dias" />
        <div style={{
          background: `linear-gradient(135deg, ${C.purpleBg} 0%, ${C.greenBg} 100%)`,
          borderRadius: 14, padding: '14px', marginBottom: 12,
        }}>
          {[
            { emoji: '📊', title: 'Controle semanal', desc: 'Toda semana, revise seus gastos e compare com a semana anterior. Tendências aparecem só com acompanhamento.' },
            { emoji: '✂️', title: 'Corte o maior gasto', desc: `Foque em reduzir${topCats[0] ? ` ${EXPENSE_CATS[topCats[0][0]]?.label ?? topCats[0][0]}` : ' sua maior categoria de gasto'}. Um corte de 20% nessa área já faz diferença.` },
            { emoji: '🐷', title: 'Crie ou amplie a reserva', desc: 'Separe um valor fixo assim que receber. Comece com qualquer quantia — o hábito vale mais que o valor.' },
            { emoji: '🎯', title: 'Simule o caminho até o sonho', desc: `Calcule: se guardar ${income > 0 ? fmtBRL(sobra > 0 ? Math.round(sobra * 0.3) : 100) : 'um valor fixo'} por mês, em quantos meses chega no seu ${dreamInfo.label.toLowerCase()}?` },
            { emoji: '💬', title: 'Converse com seu consultor', desc: 'Uma conversa com seu consultor DNA pode acelerar muito seus resultados. Ele conhece casos como o seu.' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              paddingBottom: i < 4 ? 12 : 0,
              borderBottom: i < 4 ? `0.5px solid rgba(0,0,0,0.07)` : 'none',
              marginBottom: i < 4 ? 12 : 0,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.emoji}</span>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: C.purpleDeep }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: C.text, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            BOTÕES DE AÇÃO
        ═══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <a href={`/${unitSlug}/painel`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: C.purple, color: '#fff', borderRadius: 14, padding: '15px 20px',
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
            boxShadow: `0 4px 20px ${C.purple}40`,
          }}>
            🏠 Voltar ao Painel
          </a>

          <a href={`/${unitSlug}/dna`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: C.purpleBg, color: C.purpleDeep, borderRadius: 14, padding: '15px 20px',
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
            border: `1.5px solid ${C.purple}30`,
          }}>
            🧬 Melhorar meu DNA
          </a>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Gerar PDF — em breve */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 4,
              background: 'rgba(0,0,0,0.04)', borderRadius: 14, padding: '14px 12px',
              border: `1px dashed ${C.border}`, cursor: 'not-allowed',
              position: 'relative',
            }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textSec }}>Gerar PDF</span>
              <span style={{
                position: 'absolute', top: 8, right: 8,
                background: C.amberBg, color: C.amberDark,
                fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
              }}>EM BREVE</span>
            </div>

            {/* Falar com consultor */}
            <a href={`/${unitSlug}/painel`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 4,
              background: C.greenBg, borderRadius: 14, padding: '14px 12px',
              textDecoration: 'none', border: `0.5px solid ${C.greenDark}20`,
            }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.greenDark }}>Falar com consultor</span>
            </a>
          </div>
        </div>

        {/* Rodapé */}
        <p style={{ textAlign: 'center', fontSize: 10, color: C.textTer, marginTop: 24, lineHeight: 1.5 }}>
          🔒 Relatório privado e confidencial · DNA Financeiro<br />
          Gerado localmente com base nas suas informações · {generated}
        </p>

      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════════

function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 10px' }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

function FinTile({
  label, value, valueColor = C.text, bg = '#fff',
}: {
  label: string; value: string; valueColor?: string; bg?: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 14,
      padding: '12px 13px', border: `0.5px solid ${C.border}`,
    }}>
      <p style={{ fontSize: 10, color: C.textSec, margin: '0 0 4px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 600, color: valueColor, margin: 0 }}>{value}</p>
    </div>
  )
}

function ItemCard({
  emoji, title, desc, accentColor, accentBg,
}: {
  emoji: string; title: string; desc: string; accentColor: string; accentBg: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      padding: '13px', border: `0.5px solid ${C.border}`,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: accentBg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: accentColor }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  )
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      background: bg, color, fontSize: 11, fontWeight: 600,
      padding: '4px 11px', borderRadius: 99,
    }}>{label}</span>
  )
}
