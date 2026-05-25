// =============================================================================
// /admin/leads/[id] — Perfil 360 do lead
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • UUID validado antes de qualquer query
//   • unit_admin e unit_viewer: eq(unit_id) impede acesso cross-unit
//   • unit_viewer: monthly_income, monthly_expenses, source_url, utm_* NÃO selecionados
//   • unit_viewer: NÃO vê registros individuais de investimentos; apenas faixa
//   • Expenses: categorias agregadas para todos; registros individuais nunca exibidos
//   • dna_answers: lidas via service_role (bypassa RLS) — aplicamos unit_id no filter
//   • unit_id nunca exposto no HTML/URL visível
// =============================================================================

import { notFound }                   from 'next/navigation'
import type { ReactNode }              from 'react'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '../../_AdminShell'
import { C }                          from '@/app/components/ui'

// ── Constantes ────────────────────────────────────────────────────────────────

const DREAM_LABELS: Record<string, string> = {
  casa:          'Casa própria',
  carro:         'Carro',
  negocio:       'Negócio',
  viagem:        'Viagem',
  dividas:       'Quitar dívidas',
  educacao:      'Educação',
  aposentadoria: 'Aposentadoria',
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  new:         { label: 'Novo',         bg: C.bgSecondary, color: C.textSec    },
  in_progress: { label: 'Em progresso', bg: C.amberBg,     color: C.amberDark  },
  qualified:   { label: 'Qualificado',  bg: C.greenBg,     color: C.greenDark  },
  converted:   { label: 'Convertido',   bg: C.purpleBg,    color: C.purpleDeep },
  inactive:    { label: 'Inativo',      bg: '#FEE2E2',     color: '#991B1B'    },
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Realidade', 2: 'Trabalho', 3: 'Dívidas',
  4: 'Renda extra', 5: 'Formação', 6: 'Sonhos',
}

const DNA_STEP_META: Record<string, { emoji: string; label: string; order: number }> = {
  realidade:   { emoji: '🏠', label: 'Realidade financeira',       order: 1 },
  trabalho:    { emoji: '💼', label: 'Trabalho e renda',           order: 2 },
  dividas:     { emoji: '⚠️', label: 'Dívidas e compromissos',    order: 3 },
  renda_extra: { emoji: '💰', label: 'Renda extra',                order: 4 },
  formacao:    { emoji: '🎓', label: 'Formação e desenvolvimento', order: 5 },
  sonhos:      { emoji: '🎯', label: 'Sonhos e objetivos',         order: 6 },
}

const HIGHLIGHT_QUESTION_KEYS = new Set([
  'situacao_financeira', 'tem_reserva', 'tem_dividas',
  'interesse_renda_extra', 'prazo_sonho_principal', 'comprometimento_financeiro',
])

// Labels traduzidos para cada resposta (baseado nas opções do DnaForm)
const ANSWER_LABELS: Record<string, Record<string, string>> = {
  situacao_financeira:       { tranquila: '😌 Tranquila', controlada: '✅ Controlada', apertada: '😰 Apertada', endividada: '😟 Endividada', critica: '🚨 Crítica' },
  controla_gastos:           { sim_sempre: 'Sim, sempre', as_vezes: 'Às vezes', raramente: 'Raramente', nao: 'Não controla' },
  tem_reserva:               { sim_suficiente: '✅ Sim, suficiente (6+ meses)', sim_pequena: 'Sim, pequena', nao_mas_quero: 'Não, mas quer criar', nao: 'Não tem' },
  vinculo_trabalho:          { clt: '🏢 CLT', pj: '📄 PJ / Prestador', autonomo: '🤝 Autônomo', empresario: '🏭 Empresário', desempregado: '🔎 Desempregado', outro: 'Outro' },
  estabilidade_renda:        { sempre_estavel: 'Sempre estável', maioria_estavel: 'Maioria estável', muito_variavel: 'Muito variável', sem_renda: 'Sem renda' },
  satisfacao_trabalho:       { muito_satisfeito: '🌟 Muito satisfeito', satisfeito: '😊 Satisfeito', insatisfeito: '😐 Insatisfeito', muito_insatisfeito: '😞 Muito insatisfeito' },
  tem_dividas:               { nao: '✅ Não tem dívidas', sim_consigo_pagar: '😌 Sim, consegue pagar', sim_apertado: '😰 Sim, está apertado', sim_nao_consigo_pagar: '🚨 Não consegue pagar' },
  tipo_divida:               { cartao_credito: 'Cartão', emprestimo: 'Empréstimo', financiamento: 'Financiamento', cheque_especial: 'Cheque especial', consignado: 'Consignado', familia_amigos: 'Família/amigos', outro: 'Outro' },
  preocupacao_divida:        { juros_altos: '📈 Juros altos', prazo_longo: '📅 Prazo longo', valor_total: '💸 Valor total', nao_sei_por_onde: '🤯 Não sabe por onde começar', nao_tenho: '✅ Sem preocupação' },
  interesse_renda_extra:     { sim_urgente: '🔥 Sim, urgente', sim_oportunidade: '✅ Sim, se aparecer', talvez: '🤔 Talvez', nao: '❌ Não' },
  habilidades:               { culinaria: '🍳 Culinária', costura_moda: '🧵 Costura', beleza_estetica: '💅 Beleza', tecnologia_ti: '💻 Tecnologia', design: '🎨 Design', aulas_cursos: '📚 Aulas', motorista: '🚗 Motorista', entregas: '📦 Entregas', artesanato: '🎁 Artesanato', vendas: '🛒 Vendas', outro: '📌 Outro' },
  disponibilidade_horas:     { menos_5h: 'Menos de 5h', de_5_a_10h: '5–10h', de_10_a_20h: '10–20h', mais_20h: 'Mais de 20h', sem_tempo: 'Sem tempo' },
  escolaridade:              { fundamental: 'Ensino Fundamental', medio: 'Ensino Médio', tecnico: 'Técnico', superior_incompleto: 'Superior Incompleto', superior: 'Superior', pos_graduacao: 'Pós-graduação' },
  interesse_capacitacao:     { sim_gratuito: '✅ Sim, gratuitos', sim_acessivel: '📖 Sim, se acessível', talvez_futuro: '🤔 Talvez', nao: '❌ Não' },
  area_interesse_formacao:   { financas: '💰 Finanças', tecnologia: '💻 Tecnologia', marketing: '📣 Marketing', gestao: '📊 Gestão', saude: '❤️ Saúde', beleza: '💅 Beleza', gastronomia: '🍽️ Gastronomia', idiomas: '🌍 Idiomas', outro: '📌 Outro' },
  prazo_sonho_principal:     { menos_1_ano: '⚡ Menos de 1 ano', de_1_a_3_anos: '📅 1–3 anos', de_3_a_5_anos: '🎯 3–5 anos', mais_5_anos: '🌱 Mais de 5 anos' },
  barreira_principal:        { falta_dinheiro: '💸 Falta de dinheiro', dividas: '💳 Dívidas', falta_disciplina: '🧠 Falta de disciplina', falta_conhecimento: '📖 Falta de conhecimento', renda_instavel: '📉 Renda instável', falta_tempo: '⏰ Falta de tempo' },
  comprometimento_financeiro:{ muito: '🔥 Muito comprometido', moderado: '✅ Moderadamente', pouco: '🌱 Ainda pouco', preciso_ajuda: '🙋 Precisa de ajuda' },
}

const INV_TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
  poupanca:            { emoji: '🐷', label: 'Poupança'              },
  reserva_emergencia:  { emoji: '🆘', label: 'Reserva de Emergência' },
  renda_fixa:          { emoji: '📊', label: 'Renda Fixa'            },
  acoes:               { emoji: '📈', label: 'Ações'                 },
  fundos_imobiliarios: { emoji: '🏢', label: 'Fundos Imobiliários'   },
  cripto:              { emoji: '₿',  label: 'Criptomoedas'          },
  imovel:              { emoji: '🏠', label: 'Imóvel'                },
  consorcio:           { emoji: '🤝', label: 'Consórcio'             },
  veiculo:             { emoji: '🚗', label: 'Veículo'               },
  previdencia:         { emoji: '🏦', label: 'Previdência'           },
  negocio:             { emoji: '🏪', label: 'Negócio'               },
  curso:               { emoji: '📚', label: 'Educação'              },
  equipamento:         { emoji: '🔧', label: 'Equipamento'           },
  outro:               { emoji: '💰', label: 'Outro'                 },
}

const EXPENSE_CATS: Record<string, { emoji: string; label: string }> = {
  alimentacao: { emoji: '🍽️', label: 'Alimentação'  },
  mercado:     { emoji: '🛒', label: 'Mercado'       },
  transporte:  { emoji: '🚗', label: 'Transporte'    },
  saude:       { emoji: '💊', label: 'Saúde'         },
  educacao:    { emoji: '📚', label: 'Educação'      },
  lazer:       { emoji: '🎮', label: 'Lazer'         },
  dividas:     { emoji: '💳', label: 'Dívidas'       },
  contas:      { emoji: '📄', label: 'Contas fixas'  },
  outros:      { emoji: '📦', label: 'Outros'        },
}

const INTERACTION_META: Record<string, { label: string; emoji: string; color: string }> = {
  view:                { label: 'Visualizou',           emoji: '👁️', color: C.textSec    },
  click:               { label: 'Clicou',               emoji: '🖱️', color: C.textSec    },
  interest:            { label: 'Demonstrou interesse', emoji: '💡', color: C.amberDark  },
  save:                { label: 'Salvou',               emoji: '🔖', color: C.purpleDeep },
  unsave:              { label: 'Removeu dos salvos',   emoji: '🗑️', color: C.textSec    },
  external_link_click: { label: 'Acessou link externo', emoji: '🔗', color: C.greenDark  },
  contact_request:     { label: 'Pediu contato',        emoji: '📞', color: C.greenDark  },
}

const SOURCE_LABELS: Record<string, string> = {
  painel:        'Painel',
  oportunidades: 'Lista de oportunidades',
  detalhe:       'Detalhe da oportunidade',
  fallback:      'Sugestão personalizada',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Cuiaba',
  })
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff  = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1)  return 'agora mesmo'
  if (hours < 24) return `${hours}h atrás`
  if (days === 1) return 'ontem'
  if (days < 7)   return `${days} dias atrás`
  if (days < 30)  return `${Math.floor(days / 7)} semanas atrás`
  const months = Math.floor(days / 30)
  return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function waLink(phone: string): string {
  const d   = phone.replace(/\D/g, '')
  const num = d.startsWith('55') ? d : `55${d}`
  return `https://wa.me/${num}`
}

function incomeRange(income: number | null | undefined): string {
  if (income == null) return 'Não informada'
  if (income < 2000)  return 'Até R$ 2.000'
  if (income < 4000)  return 'R$ 2.000 – R$ 4.000'
  if (income < 7000)  return 'R$ 4.000 – R$ 7.000'
  return 'Acima de R$ 7.000'
}

// Traduz valor de resposta para label legível
function fmtDnaAnswer(questionKey: string, answer: string, answerType: string): string {
  const labels = ANSWER_LABELS[questionKey]
  if (answerType === 'multiselect') {
    return answer.split(',').filter(Boolean)
      .map(v => labels?.[v.trim()] ?? v.trim().replace(/_/g, ' '))
      .join(' · ')
  }
  return labels?.[answer] ?? answer.replace(/_/g, ' ')
}

// Recomendação comercial baseada no perfil do lead
function getCommercialRec(
  status: string,
  hasInvestment: boolean,
  interestCount: number,
  dnaMap: Record<string, string>,
  dnaProgress: number,
): string {
  if (status === 'converted') return 'Lead convertido. Focar em engajamento e cross-sell de novos produtos.'
  if (status === 'qualified') return 'Lead qualificado. Priorizar contato de fechamento nas próximas 24h.'
  if (hasInvestment) return 'Lead investindo ativamente. Apresentar oportunidades de crescimento de patrimônio.'
  const debtAnswer = dnaMap['tem_dividas'] ?? ''
  if (['sim_apertado', 'sim_nao_consigo_pagar'].includes(debtAnswer)) {
    return 'Lead com dívidas críticas. Apresentar programa de reorganização financeira urgente.'
  }
  const extraRenda = dnaMap['interesse_renda_extra'] ?? ''
  if (['sim_urgente', 'sim_oportunidade'].includes(extraRenda)) {
    return 'Quer renda extra. Apresentar oportunidades compatíveis com as habilidades declaradas.'
  }
  if (interestCount > 0) return 'Lead engajado com oportunidades. Manter acompanhamento proativo.'
  if (dnaProgress < 50)  return 'DNA incompleto. Incentivar conclusão para diagnóstico mais preciso.'
  return 'Lead ativo. Continuar engajamento e acompanhar próximo acesso.'
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type LeadFull = {
  id:               string
  name:             string
  phone:            string
  email:            string | null
  city:             string | null
  main_dream:       string | null
  dna_progress:     number
  dna_stage:        number
  status:           string
  last_seen_at:     string | null
  created_at:       string
  unit_id:          string
  unit_slug:        string
  campaign_slug:    string | null
  device_type:      string | null
  campaigns?:       { name: string } | null
  // canSeeSensitive only:
  monthly_income?:  number | null
  monthly_expenses?:number | null
  source_url?:      string | null
  utm_source?:      string | null
  utm_medium?:      string | null
  utm_campaign?:    string | null
}

type Interaction = {
  id:                string
  interaction_type:  string
  source:            string
  opportunity_title: string
  opportunity_type:  string | null
  target_dream:      string | null
  created_at:        string
}

type InvRow = {
  id: string; amount: number; investment_type: string;
  description: string | null; investment_date: string; is_recurring: boolean
}

type DnaAnswer = {
  step_key:     string
  question_key: string
  question_text:string
  answer:       string
  answer_type:  string
  answered_at:  string
}

type ExpRow = { amount: number; category: string; expense_date: string }

// ── Página ────────────────────────────────────────────────────────────────────

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: leadId } = await params
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()

  // Validação de formato UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(leadId)) {
    notFound()
  }

  const canSeeSensitive = session.role !== 'unit_viewer'

  // ── 1. Fetch lead ──────────────────────────────────────────────────────────
  const baseCols  = 'id, name, phone, email, city, main_dream, dna_progress, dna_stage, status, last_seen_at, created_at, unit_id, unit_slug, campaign_slug, device_type, campaigns(name)'
  const extraCols = ', monthly_income, monthly_expenses, source_url, utm_source, utm_medium, utm_campaign'
  const selectCols = canSeeSensitive ? `${baseCols}${extraCols}` : baseCols

  let leadQ = supabase
    .from('leads')
    .select(selectCols)
    .eq('id', leadId)
    .is('deleted_at', null)

  if (session.role !== 'master') {
    leadQ = leadQ.eq('unit_id', session.unitId!)
  }

  const { data: leadRaw } = await leadQ.single()
  if (!leadRaw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lead = leadRaw as unknown as LeadFull

  // ── 2. DNA Answers ─────────────────────────────────────────────────────────
  // service_role bypassa RLS — aplicamos unit_id do lead (proteção cross-unit)
  let dnaAnswers: DnaAnswer[] = []
  try {
    const { data } = await supabase
      .from('dna_answers')
      .select('step_key, question_key, question_text, answer, answer_type, answered_at')
      .eq('lead_id', leadId)
      .eq('unit_id', lead.unit_id)
      .order('answered_at', { ascending: true })
    dnaAnswers = (data ?? []) as DnaAnswer[]
  } catch { /* silently ignore */ }

  // Agrupar por step_key e montar mapa de respostas
  const dnaByStep: Record<string, DnaAnswer[]> = {}
  const dnaMap: Record<string, string> = {}
  for (const a of dnaAnswers) {
    if (!dnaByStep[a.step_key]) dnaByStep[a.step_key] = []
    dnaByStep[a.step_key].push(a)
    dnaMap[a.question_key] = a.answer
  }

  // ── 3. Interações com oportunidades ───────────────────────────────────────
  let interactions: Interaction[] = []
  try {
    const { data } = await supabase
      .from('opportunity_interactions')
      .select('id, interaction_type, source, opportunity_title, opportunity_type, target_dream, created_at')
      .eq('lead_id', leadId)
      .eq('unit_id', lead.unit_id)
      .order('created_at', { ascending: false })
      .limit(50)
    interactions = (data ?? []) as Interaction[]
  } catch { /* tabela pode não existir em dev */ }

  // ── 4. Expenses do mês atual ──────────────────────────────────────────────
  // service_role bypassa RLS — nunca exibimos registros individuais
  const today        = new Date().toISOString().split('T')[0]
  const firstOfMonth = `${today.slice(0, 7)}-01`
  const weekAgo      = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let monthExpenses: ExpRow[] = []
  let todayExpTotal  = 0
  let weekExpTotal   = 0
  let monthExpTotal  = 0
  const catTotals: Record<string, { total: number; count: number }> = {}

  try {
    const { data } = await supabase
      .from('expenses')
      .select('amount, category, expense_date')
      .eq('lead_id', leadId)
      .eq('unit_id', lead.unit_id)
      .is('deleted_at', null)
      .gte('expense_date', firstOfMonth)
      .order('expense_date', { ascending: false })
      .limit(200)
    monthExpenses = (data ?? []) as ExpRow[]
    monthExpTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
    todayExpTotal = monthExpenses.filter(e => e.expense_date === today).reduce((s, e) => s + e.amount, 0)
    weekExpTotal  = monthExpenses.filter(e => e.expense_date >= weekAgo).reduce((s, e) => s + e.amount, 0)
    for (const e of monthExpenses) {
      if (!catTotals[e.category]) catTotals[e.category] = { total: 0, count: 0 }
      catTotals[e.category].total += e.amount
      catTotals[e.category].count += 1
    }
  } catch { /* silently ignore */ }

  // ── 5. Investimentos ──────────────────────────────────────────────────────
  let investments: InvRow[]  = []
  let investedThisMonth      = 0
  let totalInvested          = 0

  try {
    if (canSeeSensitive) {
      const { data } = await supabase
        .from('investments')
        .select('id, amount, investment_type, description, investment_date, is_recurring')
        .eq('lead_id', leadId)
        .eq('unit_id', lead.unit_id)
        .is('deleted_at', null)
        .order('investment_date', { ascending: false })
        .order('created_at',      { ascending: false })
        .limit(20)
      investments       = (data ?? []) as InvRow[]
      totalInvested     = investments.reduce((s, i) => s + i.amount, 0)
      investedThisMonth = investments
        .filter(i => i.investment_date >= firstOfMonth)
        .reduce((s, i) => s + i.amount, 0)
    } else {
      const { data } = await supabase
        .from('investments')
        .select('amount')
        .eq('lead_id', leadId)
        .eq('unit_id', lead.unit_id)
        .is('deleted_at', null)
        .gte('investment_date', firstOfMonth)
        .limit(50)
      investedThisMonth = (data ?? []).reduce((s: number, i: { amount: number }) => s + i.amount, 0)
    }
  } catch { /* silently ignore */ }

  // Agregados de investimentos
  const income    = canSeeSensitive ? (lead.monthly_income ?? 0) : 0
  const investPct = income > 0 && investedThisMonth > 0
    ? Math.round((investedThisMonth / income) * 100) : 0

  const invTypeTotals: Record<string, number> = {}
  for (const inv of investments) {
    invTypeTotals[inv.investment_type] = (invTypeTotals[inv.investment_type] ?? 0) + inv.amount
  }
  const topTypeKey   = Object.entries(invTypeTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topTypeInfo  = topTypeKey ? INV_TYPE_LABELS[topTypeKey] : null
  const hasRecurring = investments.some(i => i.is_recurring)

  // ── 6. Nome da unidade (master only) ──────────────────────────────────────
  let unitName = ''
  if (session.role === 'master') {
    const { data: unit } = await supabase
      .from('units').select('name').eq('id', lead.unit_id).single()
    unitName = unit?.name ?? lead.unit_slug
  }

  // ── Derivações ─────────────────────────────────────────────────────────────
  const sMeta        = STATUS_META[lead.status] ?? STATUS_META.new
  const dreamLabel   = DREAM_LABELS[lead.main_dream ?? ''] ?? lead.main_dream ?? '—'
  const campaignName = (lead.campaigns as { name: string } | null)?.name ?? lead.campaign_slug ?? '—'
  const stageName    = STAGE_LABELS[lead.dna_stage] ?? `Etapa ${lead.dna_stage}`
  const range        = canSeeSensitive ? incomeRange(lead.monthly_income) : null

  // Insight de investimento comercial
  type InsightDef = { emoji: string; text: string; color: string; bg: string }
  let invInsight: InsightDef | null = null
  if (canSeeSensitive) {
    if (investedThisMonth > 0 && income > 0 && investPct >= 10) {
      invInsight = { emoji: '🏆', color: C.greenDark, bg: C.greenBg,
        text: `Boa disciplina de planejamento — ${investPct}% da renda investida este mês.` }
    } else if (investedThisMonth > 0) {
      invInsight = { emoji: '📈', color: C.purpleDeep, bg: C.purpleBg,
        text: 'Lead demonstra comportamento de construção de patrimônio.' }
    } else if (income > 0) {
      invInsight = { emoji: '💡', color: C.amberDark, bg: C.amberBg,
        text: 'Renda declarada, sem investimentos registrados. Oportunidade para apresentar reserva ou planejamento patrimonial.' }
    }
    if (totalInvested > 0 && (lead.main_dream === 'carro' || lead.main_dream === 'casa')) {
      invInsight = { emoji: '🎯', color: C.amberDark, bg: C.amberBg,
        text: `Sonha com ${DREAM_LABELS[lead.main_dream ?? ''] ?? 'imóvel/veículo'} e já tem patrimônio registrado. Ótima abertura para oportunidade ligada ao sonho principal.` }
    }
  }

  // Gasto x renda
  const spendRatio  = income > 0 ? monthExpTotal / income : 0
  const spendPct    = Math.min(Math.round(spendRatio * 100), 999)
  const spendStatus = spendRatio < 0.8 ? 'controle' : spendRatio < 1 ? 'atencao' : 'risco'
  const SPEND_META  = {
    controle: { label: 'Dentro do controle', color: C.greenDark, bg: C.greenBg },
    atencao:  { label: 'Atenção',            color: C.amberDark, bg: C.amberBg },
    risco:    { label: 'Risco de comprometimento', color: C.coralDark, bg: C.coralBg },
  }
  const spendMeta = SPEND_META[spendStatus]

  // Recomendação comercial
  const lastInterest   = interactions.find(i => i.interaction_type === 'interest')
  const interestCount  = interactions.filter(i => ['interest', 'contact_request'].includes(i.interaction_type)).length
  const commercialRec  = getCommercialRec(
    lead.status,
    investedThisMonth > 0 || investments.length > 0,
    interestCount,
    dnaMap,
    lead.dna_progress,
  )

  // Categorias de despesa ordenadas por total
  const sortedCats = Object.entries(catTotals)
    .sort((a, b) => b[1].total - a[1].total)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AdminShell
      session={session}
      title={lead.name}
      back={{ href: '/admin/leads', label: 'Leads' }}
    >

      {/* ════════════════════════════════════════════
          PARTE A — Cabeçalho
      ════════════════════════════════════════════ */}
      <div style={{
        background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
        padding: '16px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>

          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.purple}25, ${C.purpleDeep}15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: C.purpleDeep, userSelect: 'none',
          }}>
            {lead.name.trim().charAt(0).toUpperCase()}
          </div>

          {/* Dados principais */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
                {lead.name}
              </h1>
              <span style={{
                background: sMeta.bg, color: sMeta.color,
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                textTransform: 'uppercase', letterSpacing: 0.3,
              }}>
                {sMeta.label}
              </span>
              {lead.dna_progress === 100 && (
                <span style={{
                  background: C.purpleBg, color: C.purpleDeep,
                  fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                }}>
                  🧬 DNA Completo
                </span>
              )}
              {unitName && (
                <span style={{
                  background: C.bgSecondary, color: C.textSec,
                  fontSize: 9, padding: '2px 8px', borderRadius: 99,
                }}>
                  📍 {unitName}
                </span>
              )}
            </div>

            <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 2px' }}>
              {fmtPhone(lead.phone)}
              {lead.email && <span> · {lead.email}</span>}
            </p>
            <p style={{ fontSize: 12, color: C.textTer, margin: '0 0 4px' }}>
              {[lead.city, `Cadastro: ${fmtRelative(lead.created_at)}`, lead.last_seen_at ? `Visto ${fmtRelative(lead.last_seen_at)}` : null]
                .filter(Boolean).join(' · ')}
            </p>
            <p style={{ fontSize: 11, color: C.textTer, margin: 0 }}>
              🧬 DNA {lead.dna_progress}% · {stageName}
              {lead.dna_progress < 100 ? ` · Próxima: ${STAGE_LABELS[lead.dna_stage + 1] ?? '—'}` : ' ✅'}
            </p>
          </div>

          {/* Ações rápidas */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
            <a
              href={waLink(lead.phone)}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#25D366', color: '#fff',
                borderRadius: 10, padding: '9px 16px',
                fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              💬 WhatsApp
            </a>

            {lead.dna_progress >= 100 && (
              <a
                href={`/${lead.unit_slug}/relatorio`}
                target="_blank" rel="noopener noreferrer"
                title="Abre o relatório do lead (requer sessão do lead)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${C.purple}40`, borderRadius: 10,
                  padding: '9px 14px', fontSize: 12,
                  textDecoration: 'none', color: C.purpleDeep,
                  background: C.purpleBg, whiteSpace: 'nowrap',
                }}
              >
                📋 Ver relatório
              </a>
            )}

            {lastInterest && (
              <a
                href={`/${lead.unit_slug}/oportunidades`}
                target="_blank" rel="noopener noreferrer"
                title={`Interesse: ${lastInterest.opportunity_title}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '9px 14px', fontSize: 12,
                  textDecoration: 'none', color: C.textSec, background: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                🎯 Ver oportunidades
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          PARTE B — Resumo do atendimento
      ════════════════════════════════════════════ */}
      <Section title="Resumo do atendimento" emoji="📊">
        <InfoGrid>
          <InfoItem label="Sonho principal" value={dreamLabel} />
          {range && <InfoItem label="Faixa de renda" value={range} />}
          <InfoItem label="Cidade"      value={lead.city ?? '—'} />
          <InfoItem label="Dispositivo" value={lead.device_type ?? '—'} />
          <InfoItem
            label="Despesas este mês"
            value={monthExpenses.length > 0 ? `${monthExpenses.length} lançamento${monthExpenses.length > 1 ? 's' : ''}` : 'Nenhuma'}
          />
          <InfoItem
            label="Investindo este mês"
            value={investedThisMonth > 0 ? (canSeeSensitive ? fmtBRL(investedThisMonth) : 'Sim') : 'Não'}
          />
          <InfoItem
            label="Oportunidades"
            value={interactions.length > 0 ? `${interactions.length} interaç${interactions.length > 1 ? 'ões' : 'ão'}` : 'Nenhuma'}
          />
          <InfoItem
            label="Campanha"
            value={campaignName}
          />
        </InfoGrid>

        {/* Barra DNA */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>
              DNA Financeiro · Etapa {lead.dna_stage}/6
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: lead.dna_progress === 100 ? C.greenDark : C.textSec }}>
              {lead.dna_progress}%
            </span>
          </div>
          <div style={{ height: 7, background: C.bgSecondary, borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${lead.dna_progress}%`,
              background: lead.dna_progress === 100 ? C.green : lead.dna_progress >= 50 ? C.purple : C.amber,
            }} />
          </div>
        </div>

        {/* Recomendação comercial */}
        <div style={{
          background: C.bgSecondary, borderRadius: 12,
          padding: '10px 14px', marginTop: 4,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>💼</span>
          <div>
            <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
              Recomendação comercial
            </div>
            <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.5 }}>
              {commercialRec}
            </p>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════
          PARTE C — DNA Respondido
      ════════════════════════════════════════════ */}
      <Section title="DNA Financeiro respondido" emoji="🧬">
        {dnaAnswers.length === 0 ? (
          <div style={{ background: C.bgSecondary, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 4px', fontWeight: 500 }}>
              Nenhuma resposta do DNA registrada
            </p>
            <p style={{ fontSize: 11, color: C.textTer, margin: 0 }}>
              Este lead ainda não respondeu nenhuma etapa do DNA Financeiro.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['realidade', 'trabalho', 'dividas', 'renda_extra', 'formacao', 'sonhos'] as const).map(stepKey => {
              const meta     = DNA_STEP_META[stepKey]
              const stepAns  = dnaByStep[stepKey] ?? []
              const answered = stepAns.length > 0

              return (
                <div key={stepKey} style={{
                  borderRadius: 12,
                  border: answered
                    ? `0.5px solid ${C.border}`
                    : `1px dashed ${C.border}`,
                  overflow: 'hidden',
                }}>
                  {/* Cabeçalho da etapa */}
                  <div style={{
                    background: answered ? C.bgSecondary : '#FAFAFA',
                    padding: '8px 12px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 15 }}>{meta.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: answered ? C.text : C.textSec, flex: 1 }}>
                      {meta.label}
                    </span>
                    {answered ? (
                      <span style={{
                        background: C.greenBg, color: C.greenDark,
                        fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                      }}>
                        ✓ {stepAns.length} {stepAns.length === 1 ? 'resposta' : 'respostas'}
                      </span>
                    ) : (
                      <span style={{
                        background: C.bgSecondary, color: C.textTer,
                        fontSize: 9, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
                      }}>
                        Não respondido
                      </span>
                    )}
                  </div>

                  {/* Respostas */}
                  {answered && (
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {stepAns.map(a => {
                        const isHighlight = HIGHLIGHT_QUESTION_KEYS.has(a.question_key)
                        const formattedAnswer = fmtDnaAnswer(a.question_key, a.answer, a.answer_type)
                        return (
                          <div key={a.question_key} style={{
                            background: isHighlight ? C.purpleBg : '#fff',
                            borderRadius: 8,
                            padding: '8px 10px',
                            border: isHighlight ? `0.5px solid ${C.purple}20` : `0.5px solid ${C.border}`,
                          }}>
                            <div style={{
                              fontSize: 10, color: C.textSec, marginBottom: 3, lineHeight: 1.4,
                              fontWeight: isHighlight ? 600 : 400,
                            }}>
                              {a.question_text}
                            </div>
                            {a.answer_type === 'multiselect' ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                {a.answer.split(',').filter(Boolean).map(v => (
                                  <span key={v} style={{
                                    background: isHighlight ? C.purple : C.bgSecondary,
                                    color: isHighlight ? '#fff' : C.text,
                                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                                  }}>
                                    {ANSWER_LABELS[a.question_key]?.[v.trim()] ?? v.trim().replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{
                                fontSize: 12, fontWeight: 700,
                                color: isHighlight ? C.purpleDeep : C.text,
                              }}>
                                {formattedAnswer}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ════════════════════════════════════════════
          PARTE D — Resumo financeiro
      ════════════════════════════════════════════ */}
      <Section title="Resumo financeiro" emoji="💸">
        {/* KPIs de despesa */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8, marginBottom: 14,
        }}>
          {canSeeSensitive && (
            <FinKpi label="Renda declarada"    value={lead.monthly_income ? fmtBRL(lead.monthly_income) : '—'} />
          )}
          {canSeeSensitive && (
            <FinKpi label="Despesas declaradas" value={lead.monthly_expenses ? fmtBRL(lead.monthly_expenses) : '—'} />
          )}
          <FinKpi label="Gastos este mês" value={monthExpTotal > 0 ? fmtBRL(monthExpTotal) : 'R$ 0'} />
          <FinKpi label="Gastos hoje"     value={todayExpTotal > 0 ? fmtBRL(todayExpTotal) : 'R$ 0'} />
          <FinKpi label="Gastos semana"   value={weekExpTotal > 0 ? fmtBRL(weekExpTotal) : 'R$ 0'} />
          {canSeeSensitive && income > 0 && (
            <FinKpi
              label="Comprometido"
              value={`${spendPct}%`}
              color={spendStatus === 'controle' ? C.greenDark : spendStatus === 'atencao' ? C.amberDark : C.coralDark}
              bg={spendMeta.bg}
            />
          )}
          {canSeeSensitive && income > 0 && (
            <FinKpi
              label="Sobra estimada"
              value={fmtBRL(Math.max(income - monthExpTotal, 0))}
              color={income - monthExpTotal > 0 ? C.greenDark : C.coralDark}
            />
          )}
        </div>

        {/* Status de comprometimento */}
        {canSeeSensitive && income > 0 && (
          <div style={{
            background: spendMeta.bg, borderRadius: 10,
            padding: '8px 12px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>
              {spendStatus === 'controle' ? '✅' : spendStatus === 'atencao' ? '⚠️' : '🚨'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: spendMeta.color }}>
              {spendMeta.label}
              {spendPct > 0 && ` — ${spendPct}% da renda comprometida`}
            </span>
          </div>
        )}

        {/* Despesas por categoria */}
        {sortedCats.length > 0 ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Por categoria — este mês
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedCats.map(([cat, { total, count }]) => {
                const catMeta = EXPENSE_CATS[cat] ?? { emoji: '📦', label: cat }
                const pct     = monthExpTotal > 0 ? Math.round((total / monthExpTotal) * 100) : 0
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, width: 22, flexShrink: 0 }}>{catMeta.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>
                          {catMeta.label}
                          <span style={{ fontSize: 10, color: C.textTer, marginLeft: 5 }}>
                            ({count} {count === 1 ? 'lançamento' : 'lançamentos'})
                          </span>
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', marginLeft: 8 }}>
                          {fmtBRL(total)} <span style={{ fontSize: 10, color: C.textSec, fontWeight: 400 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 4, background: C.bgSecondary, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: C.purple, width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
            Nenhuma despesa registrada este mês.
          </p>
        )}
      </Section>

      {/* ════════════════════════════════════════════
          PARTE E — Investimentos e Patrimônio
      ════════════════════════════════════════════ */}
      <Section title="Investimentos e Patrimônio" emoji="💚">
        {!canSeeSensitive ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              background: investedThisMonth > 0 ? C.greenBg : C.bgSecondary,
              borderRadius: 10, padding: '10px 16px',
            }}>
              <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>
                Investe este mês
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: investedThisMonth > 0 ? C.greenDark : C.textSec }}>
                {investedThisMonth > 0 ? 'Sim ✓' : 'Não'}
              </div>
            </div>
            {investedThisMonth > 0 && (
              <div style={{ background: C.bgSecondary, borderRadius: 10, padding: '10px 16px' }}>
                <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>
                  Faixa de investimento
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textSec }}>
                  {investedThisMonth < 100 ? 'Baixo' : investedThisMonth < 500 ? 'Médio' : 'Alto'}
                </div>
              </div>
            )}
          </div>
        ) : investments.length === 0 ? (
          <div style={{ background: C.bgSecondary, borderRadius: 10, padding: '18px', textAlign: 'center' }}>
            <p style={{ fontSize: 20, margin: '0 0 6px' }}>💚</p>
            <p style={{ fontSize: 13, color: C.text, fontWeight: 500, margin: '0 0 4px' }}>
              Nenhum investimento registrado
            </p>
            <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.5 }}>
              Oportunidade para apresentar educação financeira ou planejamento patrimonial.
            </p>
            {invInsight && (
              <div style={{
                background: invInsight.bg, borderRadius: 10, padding: '10px 14px', marginTop: 12,
                display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left',
              }}>
                <span style={{ fontSize: 16 }}>{invInsight.emoji}</span>
                <p style={{ fontSize: 12, color: invInsight.color, margin: 0, lineHeight: 1.5 }}>{invInsight.text}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 8, marginBottom: 12,
            }}>
              <InvKpi label="Investido este mês"  value={investedThisMonth > 0 ? fmtBRL(investedThisMonth) : '—'} color={investedThisMonth > 0 ? C.greenDark : C.textTer} bg={investedThisMonth > 0 ? C.greenBg : '#fff'} />
              <InvKpi label="Total registrado"     value={totalInvested > 0 ? fmtBRL(totalInvested) : '—'} color={C.purpleDeep} />
              <InvKpi label="% da renda"           value={investPct > 0 ? `${investPct}%` : '—'} color={investPct >= 10 ? C.greenDark : investPct > 0 ? C.amberDark : C.textTer} />
              <InvKpi label="Recorrente"           value={hasRecurring ? 'Sim ✓' : 'Não'} color={hasRecurring ? C.greenDark : C.textSec} bg={hasRecurring ? C.greenBg : '#fff'} />
            </div>

            {topTypeInfo && (
              <div style={{
                background: C.greenBg, borderRadius: 12, padding: '10px 14px', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 10, border: `0.5px solid ${C.greenDark}20`,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{topTypeInfo.emoji}</span>
                <div>
                  <div style={{ fontSize: 10, color: C.greenDark, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>
                    Principal tipo
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.greenDark }}>{topTypeInfo.label}</div>
                </div>
              </div>
            )}

            {invInsight && (
              <div style={{
                background: invInsight.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 12,
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 16 }}>{invInsight.emoji}</span>
                <p style={{ fontSize: 12, color: invInsight.color, margin: 0, lineHeight: 1.5 }}>{invInsight.text}</p>
              </div>
            )}

            {/* Últimos 3 investimentos */}
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
              Últimos registros
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {investments.slice(0, 3).map(inv => {
                const typeInfo = INV_TYPE_LABELS[inv.investment_type] ?? { emoji: '💰', label: inv.investment_type }
                return (
                  <div key={inv.id} style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    background: C.bgSecondary, borderRadius: 10, padding: '9px 12px',
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{typeInfo.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                        {typeInfo.label}
                        {inv.is_recurring && (
                          <span style={{ background: C.greenBg, color: C.greenDark, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, marginLeft: 6 }}>
                            RECORRENTE
                          </span>
                        )}
                      </div>
                      {inv.description && (
                        <div style={{ fontSize: 11, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inv.description}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: C.textTer, marginTop: 1 }}>
                        {fmtDateShort(inv.investment_date)}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.greenDark, flexShrink: 0 }}>
                      {fmtBRL(inv.amount)}
                    </span>
                  </div>
                )
              })}
              {investments.length > 3 && (
                <p style={{ fontSize: 11, color: C.textSec, margin: '4px 0 0', textAlign: 'center' }}>
                  + {investments.length - 3} registro{investments.length - 3 > 1 ? 's' : ''} anterior{investments.length - 3 > 1 ? 'es' : ''}
                </p>
              )}
            </div>
          </>
        )}
      </Section>

      {/* ════════════════════════════════════════════
          PARTE F — Interações com oportunidades
      ════════════════════════════════════════════ */}
      <Section title="Interações com oportunidades" emoji="🎯">
        {interactions.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
            Este lead ainda não interagiu com nenhuma oportunidade.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 10px' }}>
              {interactions.length} {interactions.length === 1 ? 'interação' : 'interações'} registradas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {interactions.map(i => {
                const meta    = INTERACTION_META[i.interaction_type] ?? { label: i.interaction_type, emoji: '📌', color: C.textSec }
                const dreamLbl = i.target_dream ? (DREAM_LABELS[i.target_dream] ?? i.target_dream) : null
                return (
                  <div key={i.id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    background: C.bgSecondary, borderRadius: 10, padding: '9px 12px',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{meta.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 3 }}>
                        {i.opportunity_title}
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{
                          background: '#fff', border: `0.5px solid ${C.border}`,
                          borderRadius: 6, padding: '1px 7px',
                          fontSize: 10, fontWeight: 600, color: meta.color,
                        }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 10, color: C.textSec }}>
                          via {SOURCE_LABELS[i.source] ?? i.source}
                        </span>
                        {dreamLbl && (
                          <span style={{ background: C.amberBg, color: C.amberDark, fontSize: 9, padding: '1px 6px', borderRadius: 6 }}>
                            {dreamLbl}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: C.textTer, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {fmtRelative(i.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Section>

      {/* ════════════════════════════════════════════
          PARTE G — Origem e campanha
      ════════════════════════════════════════════ */}
      <Section title="Origem e campanha" emoji="📍">
        <InfoGrid>
          <InfoItem label="Campanha"            value={campaignName} />
          <InfoItem label="Cadastrou em"        value={fmtDate(lead.created_at)} />
          <InfoItem label="Último acesso"       value={lead.last_seen_at ? fmtDate(lead.last_seen_at) : '—'} />
          <InfoItem label="Tempo desde cadastro" value={fmtRelative(lead.created_at)} />
          {lead.device_type && <InfoItem label="Dispositivo" value={lead.device_type} />}
        </InfoGrid>

        {/* UTM params — canSeeSensitive only */}
        {canSeeSensitive && (lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
              UTM / Rastreamento
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lead.utm_source && (
                <span style={{ background: C.bgSecondary, color: C.textSec, fontSize: 11, padding: '3px 9px', borderRadius: 8 }}>
                  source: {lead.utm_source}
                </span>
              )}
              {lead.utm_medium && (
                <span style={{ background: C.bgSecondary, color: C.textSec, fontSize: 11, padding: '3px 9px', borderRadius: 8 }}>
                  medium: {lead.utm_medium}
                </span>
              )}
              {lead.utm_campaign && (
                <span style={{ background: C.bgSecondary, color: C.textSec, fontSize: 11, padding: '3px 9px', borderRadius: 8 }}>
                  campaign: {lead.utm_campaign}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Source URL — canSeeSensitive only */}
        {canSeeSensitive && lead.source_url && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              URL de origem:
            </span>
            <p style={{
              fontSize: 11, color: C.textSec, margin: '3px 0 0',
              wordBreak: 'break-all', background: C.bgSecondary,
              borderRadius: 8, padding: '6px 10px',
            }}>
              {lead.source_url}
            </p>
          </div>
        )}
      </Section>

      {/* ════════════════════════════════════════════
          PARTE H — Histórico resumido
      ════════════════════════════════════════════ */}
      <Section title="Histórico" emoji="📅">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { emoji: '📝', label: 'Cadastro realizado', date: lead.created_at, done: true },
            lead.dna_progress > 0 && lead.dna_progress < 100
              ? { emoji: '🧬', label: `DNA ${lead.dna_progress}% preenchido — até etapa ${stageName}`, date: null, done: false }
              : null,
            lead.dna_progress >= 100
              ? { emoji: '🧬', label: 'DNA Financeiro 100% completo', date: null, done: true, highlight: true }
              : null,
            monthExpenses.length > 0
              ? { emoji: '💸', label: `${monthExpenses.length} despesa${monthExpenses.length > 1 ? 's' : ''} lançada${monthExpenses.length > 1 ? 's' : ''} este mês`, date: null, done: true }
              : { emoji: '💸', label: 'Nenhuma despesa lançada', date: null, done: false },
            investments.length > 0 || investedThisMonth > 0
              ? { emoji: '💚', label: 'Investindo — registrou patrimônio', date: null, done: true, highlight: true }
              : { emoji: '💚', label: 'Sem investimentos registrados', date: null, done: false },
            interactions.find(i => i.interaction_type === 'contact_request')
              ? { emoji: '📞', label: `Pediu contato — ${interactions.find(i => i.interaction_type === 'contact_request')?.opportunity_title ?? ''}`, date: interactions.find(i => i.interaction_type === 'contact_request')?.created_at ?? null, done: true, highlight: true }
              : interactions.find(i => i.interaction_type === 'interest')
              ? { emoji: '💡', label: 'Demonstrou interesse em oportunidade', date: interactions.find(i => i.interaction_type === 'interest')?.created_at ?? null, done: true }
              : interactions.length > 0
              ? { emoji: '👁️', label: `${interactions.length} visualizaç${interactions.length > 1 ? 'ões' : 'ão'} de oportunidades`, date: null, done: false }
              : null,
            lead.last_seen_at
              ? { emoji: '👁️', label: 'Último acesso ao app', date: lead.last_seen_at, done: true }
              : null,
          ].filter(Boolean).map((event, idx) => {
            if (!event) return null
            return (
              <div key={idx} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                paddingBottom: 10,
                borderLeft: `2px solid ${event.done ? (event.highlight ? C.green : C.purple) : C.border}`,
                marginLeft: 8, paddingLeft: 14,
                position: 'relative',
              }}>
                {/* Ponto na timeline */}
                <div style={{
                  position: 'absolute', left: -9, top: 1,
                  width: 16, height: 16, borderRadius: '50%',
                  background: event.done ? (event.highlight ? C.green : C.purple) : C.bgSecondary,
                  border: `2px solid #fff`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, color: '#fff', fontWeight: 800,
                }}>
                  {event.done ? '✓' : '·'}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 0 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: event.highlight ? 700 : 500,
                    color: event.done ? C.text : C.textTer,
                  }}>
                    {event.emoji} {event.label}
                  </span>
                  {event.date && (
                    <span style={{ fontSize: 10, color: C.textTer, marginLeft: 8 }}>
                      {fmtRelative(event.date)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Observações (em breve) ── */}
      <Section title="Observações do consultor" emoji="📝">
        <div style={{ background: C.bgSecondary, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 4px', fontWeight: 500 }}>Em breve</p>
          <p style={{ fontSize: 12, color: C.textTer, margin: 0 }}>
            Anotações e histórico de contato do consultor serão exibidos aqui.
          </p>
        </div>
      </Section>

    </AdminShell>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function Section({ title, emoji, children }: { title: string; emoji: string; children: ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
      padding: '14px 16px', marginBottom: 12,
    }}>
      <h2 style={{
        fontSize: 13, fontWeight: 700, color: C.text,
        margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {emoji} {title}
      </h2>
      {children}
    </div>
  )
}

function InfoGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px 20px' }}>
      {children}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  )
}

function FinKpi({ label, value, color = C.text, bg = '#fff' }: { label: string; value: string; color?: string; bg?: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function InvKpi({ label, value, color = C.text, bg = '#fff' }: { label: string; value: string; color?: string; bg?: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
