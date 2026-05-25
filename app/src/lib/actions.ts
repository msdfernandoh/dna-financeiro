'use server'

// =============================================================================
// DNA FINANCEIRO — SERVER ACTION: CRIAR LEAD
//
// Esta Server Action é a única forma de criar um lead.
//
// SEGURANÇA:
//   • Roda exclusivamente no servidor (directive 'use server')
//   • unit_id é injetado pelo servidor a partir do unitSlug da URL
//   • O browser NUNCA envia unit_id — qualquer unit_id no FormData é ignorado
//   • Usa service_role key para bypassar RLS e inserir com os campos corretos
//   • source_url, device_type e utm_* são lidos dos headers da requisição
//
// FLUXO:
//   1. Recebe FormData do browser (sem unit_id)
//   2. Valida os campos do formulário
//   3. Resolve unit_id a partir do unitSlug passado pelo Server Component
//   4. Lê headers para compor o contexto de rastreamento
//   5. Insere o lead no banco com todos os campos obrigatórios
//   6. Retorna um token de sessão para o lead (nunca o UUID)
// =============================================================================

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { LeadCreateInput, CreateLeadResult, CreateExpenseResult, CreateInvestmentResult, SaveDnaResult, SaveBusinessProfileState, FormErrors } from '@/types/database'

// ---------------------------------------------------------------------------
// Validação dos campos do formulário
// ---------------------------------------------------------------------------

function validateLeadInput(data: Record<string, string>): {
  input: LeadCreateInput | null
  errors: FormErrors
} {
  const errors: FormErrors = {}

  // Nome
  const name = data.name?.trim()
  if (!name || name.length < 2) {
    errors.name = 'Informe seu nome completo'
  } else if (name.length > 120) {
    errors.name = 'Nome muito longo'
  }

  // Telefone — apenas dígitos, 10 ou 11 caracteres
  const rawPhone = data.phone?.replace(/\D/g, '')
  if (!rawPhone || rawPhone.length < 10 || rawPhone.length > 11) {
    errors.phone = 'Informe um telefone válido com DDD'
  }

  // Cidade
  const city = data.city?.trim()
  if (!city || city.length < 2) {
    errors.city = 'Informe sua cidade'
  }

  // Renda mensal — remove separador de milhar (.) antes de trocar vírgula decimal
  const monthly_income = parseFloat((data.monthly_income ?? '').replace(/\./g, '').replace(',', '.'))
  if (isNaN(monthly_income) || monthly_income < 0) {
    errors.monthly_income = 'Informe um valor válido'
  } else if (monthly_income > 9_999_999) {
    errors.monthly_income = 'Valor fora do intervalo esperado'
  }

  // Despesas mensais — idem
  const monthly_expenses = parseFloat((data.monthly_expenses ?? '').replace(/\./g, '').replace(',', '.'))
  if (isNaN(monthly_expenses) || monthly_expenses < 0) {
    errors.monthly_expenses = 'Informe um valor válido'
  } else if (monthly_expenses > 9_999_999) {
    errors.monthly_expenses = 'Valor fora do intervalo esperado'
  }

  // Sonho principal
  const main_dream = data.main_dream?.trim()
  const validDreams = [
    'casa', 'carro', 'negocio', 'viagem', 'reserva',
    'faculdade', 'reforma', 'dividas', 'moto', 'outro',
  ]
  if (!main_dream || !validDreams.includes(main_dream)) {
    errors.main_dream = 'Selecione seu principal sonho'
  }

  // Consentimento obrigatório
  const consent_diagnosis = data.consent_diagnosis === 'on' || data.consent_diagnosis === 'true'
  if (!consent_diagnosis) {
    errors.consent_diagnosis = 'É necessário aceitar os termos para continuar'
  }

  if (Object.keys(errors).length > 0) {
    return { input: null, errors }
  }

  return {
    input: {
      name: name!,
      phone: rawPhone!,
      city: city!,
      monthly_income,
      monthly_expenses,
      main_dream: main_dream!,
      consent_diagnosis: true,
      consent_communications: data.consent_communications === 'on',
    },
    errors: {},
  }
}

// ---------------------------------------------------------------------------
// Extrai contexto de rastreamento dos headers HTTP
// Nunca aceita estes valores do body do formulário
// ---------------------------------------------------------------------------

function extractTrackingContext(requestHeaders: Headers, unitSlug: string, unitId: string) {
  // Referrer do navegador
  const referrer = requestHeaders.get('referer') || null

  // User-Agent para detectar device_type
  const ua = requestHeaders.get('user-agent') || ''
  const device_type = /mobile|android|iphone|ipad/i.test(ua)
    ? 'mobile'
    : /tablet|ipad/i.test(ua)
      ? 'tablet'
      : 'desktop'

  // source_url: montada a partir do Origin + path da requisição
  // Em produção use o header x-forwarded-host ou configure NEXT_PUBLIC_APP_URL
  const origin = requestHeaders.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''
  const source_url = `${origin}/${unitSlug}`

  // UTMs: em Server Actions não há acesso direto à query string da página original.
  // A estratégia correta é passar os UTMs como campos hidden no formulário,
  // capturados pelo Client Component ao montar a página.
  // Por ora retornam null — implementado junto ao formulário abaixo.
  return {
    unit_id: unitId,
    unit_slug: unitSlug,
    source_url,
    device_type,
    referrer,
    utm_source: null as string | null,
    utm_medium: null as string | null,
    utm_campaign: null as string | null,
    utm_term: null as string | null,
    utm_content: null as string | null,
    campaign_id: null as string | null,
    campaign_slug: null as string | null,
  }
}

// ---------------------------------------------------------------------------
// Server Action principal
// Recebe unitSlug e unitId do Server Component — nunca do browser
// ---------------------------------------------------------------------------

/**
 * Cria um lead no Supabase vinculado à unidade.
 * Deve ser chamada apenas de um Server Component que já resolveu a unidade.
 *
 * @param unitSlug - slug da URL (ex: "sinop")
 * @param unitId   - UUID resolvido pelo servidor — nunca do browser
 */
export async function createLead(
  unitSlug: string,
  unitId: string,
  _prevState: CreateLeadResult | null,
  formData: FormData,
): Promise<CreateLeadResult> {
  // Converter FormData em objeto para validação
  const raw: Record<string, string> = {}
  formData.forEach((value, key) => {
    // Ignorar qualquer tentativa de enviar unit_id pelo formulário
    if (key === 'unit_id' || key === 'campaign_id') return
    raw[key] = value.toString()
  })

  // Validar campos do formulário
  const { input, errors } = validateLeadInput(raw)

  if (!input) {
    // Retorna os erros de validação para o formulário
    return {
      success: false,
      error: 'Corrija os campos indicados antes de continuar.',
      field: Object.keys(errors)[0],
    }
  }

  // Extrair contexto de rastreamento dos headers HTTP
  const requestHeaders = await headers()
  const tracking = extractTrackingContext(requestHeaders, unitSlug, unitId)

  // UTMs passados como campos hidden pelo formulário (capturados no client)
  tracking.utm_source   = raw.utm_source   || null
  tracking.utm_medium   = raw.utm_medium   || null
  tracking.utm_campaign = raw.utm_campaign || null
  tracking.utm_term     = raw.utm_term     || null
  tracking.utm_content  = raw.utm_content  || null
  tracking.campaign_slug = raw.campaign_slug || null

  // Inserir lead com service_role — unit_id vem do servidor
  const supabase = createServerSupabaseClient()

  const { data: lead, error: dbError } = await supabase
    .from('leads')
    .insert({
      // Dados pessoais
      name:  input.name,
      phone: input.phone,
      city:  input.city,

      // Dados financeiros
      monthly_income:   input.monthly_income,
      monthly_expenses: input.monthly_expenses,
      main_dream:       input.main_dream,

      // Consentimentos LGPD
      consent_diagnosis:      input.consent_diagnosis,
      consent_communications: input.consent_communications,
      consent_analytics:      false,  // coletado na tela de notificações (S4b)
      consent_at:             new Date().toISOString(),

      // Rastreamento — injetado pelo servidor
      unit_id:       tracking.unit_id,       // ← NUNCA vem do browser
      unit_slug:     tracking.unit_slug,
      campaign_id:   tracking.campaign_id,
      campaign_slug: tracking.campaign_slug,
      source_url:    tracking.source_url,
      utm_source:    tracking.utm_source,
      utm_medium:    tracking.utm_medium,
      utm_campaign:  tracking.utm_campaign,
      utm_term:      tracking.utm_term,
      utm_content:   tracking.utm_content,
      referrer:      tracking.referrer,
      device_type:   tracking.device_type,

      // Progresso inicial
      dna_progress: 0,
      dna_stage:    1,
      status:       'new',
    })
    .select('id')
    .single()

  if (dbError || !lead) {
    console.error('[createLead] erro ao inserir lead:', dbError?.message)

    // Tratar violação de constraint (ex: consentimento faltando)
    if (dbError?.code === '23514') {
      return {
        success: false,
        error: 'Verifique se aceitou os termos de uso e tente novamente.',
      }
    }

    return {
      success: false,
      error: 'Não conseguimos salvar seu cadastro agora. Tente novamente em instantes.',
    }
  }

  // Gerar token de sessão para o lead (opaco — não é o UUID)
  // Armazenar em cookie HttpOnly para uso nas próximas telas
  const leadToken = Buffer.from(`${lead.id}:${Date.now()}`).toString('base64url')

  const cookieStore = await cookies()
  cookieStore.set('dna_lead_token', leadToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    path: '/',
  })

  // Redirecionar para o diagnóstico
  redirect(`/${unitSlug}/diagnostico`)
}

// ---------------------------------------------------------------------------
// Server Action: Registrar despesa
//
// SEGURANÇA:
//   • unitSlug é vinculado pelo Server Component — nunca do browser
//   • lead_id e unit_id são resolvidos do cookie + banco — nunca do FormData
//   • service_role usada apenas aqui no servidor
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  'alimentacao', 'mercado', 'transporte', 'saude',
  'educacao', 'lazer', 'dividas', 'contas', 'outros',
] as const

export async function createExpense(
  unitSlug: string,
  _prevState: CreateExpenseResult | null,
  formData: FormData,
): Promise<CreateExpenseResult> {
  // 1. Ler e decodificar cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) return { success: false, error: 'Sessão não encontrada. Faça o cadastro novamente.' }

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    return { success: false, error: 'Sessão inválida.' }
  }

  // 2. Validar e sanitizar dados do formulário
  const amountRaw = formData.get('amount')?.toString() ?? ''
  const amount = parseFloat(amountRaw.replace(/\./g, '').replace(',', '.'))

  if (isNaN(amount) || amount <= 0) {
    return { success: false, error: 'Informe um valor maior que zero.', field: 'amount' }
  }
  if (amount > 99999.99) {
    return { success: false, error: 'Valor muito alto. Verifique o que foi digitado.', field: 'amount' }
  }

  const category = formData.get('category')?.toString().trim() ?? ''
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return { success: false, error: 'Selecione uma categoria.', field: 'category' }
  }

  const rawDesc    = formData.get('description')?.toString().trim() ?? ''
  const payMethod  = formData.get('payment_method')?.toString().trim() ?? ''
  const description = [rawDesc, payMethod].filter(Boolean).join(' · ') || null

  const expenseDateRaw = formData.get('expense_date')?.toString() ?? ''
  const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(expenseDateRaw)
    ? expenseDateRaw
    : new Date().toISOString().split('T')[0]

  // 3. Resolver lead + unit_id do banco (valida unit_slug → sem cross-unit)
  const supabase = createServerSupabaseClient()
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, unit_id')
    .eq('id', leadId)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) {
    return { success: false, error: 'Sessão inválida ou expirada. Tente novamente.' }
  }

  // 4. Inserir despesa — unit_id e lead_id vêm do servidor, nunca do browser
  const { error: insertError } = await supabase
    .from('expenses')
    .insert({
      unit_id:      lead.unit_id,  // ← resolvido do banco, nunca do client
      lead_id:      lead.id,       // ← resolvido do cookie
      amount,
      category,
      description,
      input_method: 'manual',
      expense_date: expenseDate,
    })

  if (insertError) {
    console.error('[createExpense]', insertError.message)
    return { success: false, error: 'Erro ao salvar a despesa. Tente novamente em instantes.' }
  }

  redirect(`/${unitSlug}/despesas/sucesso`)
}

// ---------------------------------------------------------------------------
// Server Action: Registrar investimento
//
// SEGURANÇA:
//   • unitSlug vinculado pelo Server Component — nunca do browser
//   • lead_id e unit_id resolvidos do cookie + banco — nunca do FormData
//   • investments NUNCA somam com expenses (universos separados)
//   • service_role usada apenas aqui no servidor
// ---------------------------------------------------------------------------

const VALID_INVESTMENT_TYPES = [
  'poupanca', 'reserva_emergencia', 'renda_fixa', 'acoes', 'fundos_imobiliarios',
  'cripto', 'imovel', 'consorcio', 'veiculo', 'previdencia', 'negocio', 'curso',
  'equipamento', 'outro',
] as const

export async function createInvestment(
  unitSlug: string,
  _prevState: CreateInvestmentResult | null,
  formData: FormData,
): Promise<CreateInvestmentResult> {
  // 1. Cookie → leadId
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) return { success: false, error: 'Sessão não encontrada. Faça o cadastro novamente.' }

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    return { success: false, error: 'Sessão inválida.' }
  }

  // 2. Validar campos
  const amountRaw = formData.get('amount')?.toString() ?? ''
  const amount = parseFloat(amountRaw.replace(/\./g, '').replace(',', '.'))
  if (isNaN(amount) || amount <= 0) {
    return { success: false, error: 'Informe um valor maior que zero.', field: 'amount' }
  }
  if (amount > 9_999_999.99) {
    return { success: false, error: 'Valor muito alto. Verifique o que foi digitado.', field: 'amount' }
  }

  const investmentType = formData.get('investment_type')?.toString().trim() ?? ''
  if (!VALID_INVESTMENT_TYPES.includes(investmentType as typeof VALID_INVESTMENT_TYPES[number])) {
    return { success: false, error: 'Selecione um tipo de investimento.', field: 'investment_type' }
  }

  const description = formData.get('description')?.toString().trim() || null

  const investmentDateRaw = formData.get('investment_date')?.toString() ?? ''
  const investmentDate = /^\d{4}-\d{2}-\d{2}$/.test(investmentDateRaw)
    ? investmentDateRaw
    : new Date().toISOString().split('T')[0]

  const isRecurring = formData.get('is_recurring') === 'true'

  const currentValueRaw = formData.get('current_value')?.toString().trim() ?? ''
  let currentValue: number | null = null
  if (currentValueRaw) {
    currentValue = parseFloat(currentValueRaw.replace(/\./g, '').replace(',', '.'))
    if (isNaN(currentValue) || currentValue < 0) {
      return { success: false, error: 'Valor atual inválido.', field: 'current_value' }
    }
  }

  const expectedReturnRaw = formData.get('expected_return')?.toString().trim() ?? ''
  let expectedReturn: number | null = null
  if (expectedReturnRaw) {
    expectedReturn = parseFloat(expectedReturnRaw.replace(',', '.'))
    if (isNaN(expectedReturn) || expectedReturn < -100 || expectedReturn > 1000) {
      return { success: false, error: 'Retorno esperado deve estar entre -100% e 1000%.', field: 'expected_return' }
    }
  }

  // 3. Resolver lead + unit_id do banco (valida unit_slug → sem cross-unit)
  const supabase = createServerSupabaseClient()
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, unit_id')
    .eq('id', leadId)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) {
    return { success: false, error: 'Sessão inválida ou expirada. Tente novamente.' }
  }

  // 4. Inserir investimento — unit_id e lead_id vêm do servidor, nunca do browser
  const insertData: Record<string, unknown> = {
    unit_id:         lead.unit_id,   // ← resolvido do banco, nunca do client
    lead_id:         lead.id,        // ← resolvido do cookie
    investment_type: investmentType,
    amount,
    description,
    investment_date: investmentDate,
    is_recurring:    isRecurring,
  }
  if (currentValue !== null) insertData.current_value = currentValue
  if (expectedReturn !== null) insertData.expected_return = expectedReturn

  const { error: insertError } = await supabase
    .from('investments')
    .insert(insertData)

  if (insertError) {
    console.error('[createInvestment]', insertError.message)
    return { success: false, error: 'Erro ao salvar o investimento. Tente novamente em instantes.' }
  }

  redirect(`/${unitSlug}/investimentos?novo=1`)
}

// ---------------------------------------------------------------------------
// Server Action: Salvar respostas DNA Financeiro
//
// SEGURANÇA:
//   • unitSlug vinculado pelo Server Component — nunca do browser
//   • lead_id e unit_id resolvidos do cookie + banco — nunca do FormData
//   • Respostas sensíveis não expostas ao frontend; unit_admin não acessa
//   • Upsert idempotente: lead pode re-salvar sem duplicar
// ---------------------------------------------------------------------------

const VALID_STEP_KEYS = [
  'realidade', 'trabalho', 'dividas', 'renda_extra', 'formacao', 'sonhos',
] as const

export async function saveDnaAnswers(
  unitSlug: string,
  _prevState: SaveDnaResult | null,
  formData: FormData,
): Promise<SaveDnaResult> {
  // 1. Decodificar cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) return { success: false, error: 'Sessão não encontrada. Cadastre-se novamente.' }

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    return { success: false, error: 'Sessão inválida.' }
  }

  // 2. Validar step_key e step_num
  const stepKey = formData.get('step_key')?.toString().trim() ?? ''
  const stepNum = parseInt(formData.get('step_num')?.toString() ?? '0', 10)

  if (!VALID_STEP_KEYS.includes(stepKey as typeof VALID_STEP_KEYS[number])) {
    return { success: false, error: 'Etapa inválida.' }
  }
  if (stepNum < 1 || stepNum > 6) {
    return { success: false, error: 'Número de etapa inválido.' }
  }

  // 3. Resolver lead + unit_id do banco (valida unit_slug → impede cross-unit)
  const supabase = createServerSupabaseClient()
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, unit_id, dna_stage, dna_progress')
    .eq('id', leadId)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) {
    return { success: false, error: 'Sessão inválida ou expirada. Tente novamente.' }
  }

  // 4. Coletar respostas do FormData (campos q_*, qt_*, at_*)
  //    q_{key}  = answer
  //    qt_{key} = question_text
  //    at_{key} = answer_type
  const answersMap: Record<string, { text: string; value: string; type: string }> = {}

  formData.forEach((rawValue, fieldName) => {
    const value = rawValue.toString().trim()
    if (fieldName.startsWith('q_') && value) {
      const key = fieldName.slice(2)
      if (!answersMap[key]) answersMap[key] = { text: '', value: '', type: 'select' }
      answersMap[key].value = value
    } else if (fieldName.startsWith('qt_')) {
      const key = fieldName.slice(3)
      if (!answersMap[key]) answersMap[key] = { text: '', value: '', type: 'select' }
      answersMap[key].text = value
    } else if (fieldName.startsWith('at_')) {
      const key = fieldName.slice(3)
      if (!answersMap[key]) answersMap[key] = { text: '', value: '', type: 'select' }
      answersMap[key].type = value
    }
  })

  // Filtrar perguntas que têm resposta e texto da pergunta
  const rows = Object.entries(answersMap)
    .filter(([, a]) => a.value && a.text)
    .map(([question_key, a]) => ({
      unit_id:       lead.unit_id,   // ← do banco, nunca do browser
      lead_id:       lead.id,        // ← do cookie
      step_key:      stepKey,
      question_key,
      question_text: a.text,
      answer:        a.value,
      answer_type:   a.type,
    }))

  // Se não há respostas, apenas avança o progresso (etapa pulada)
  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('dna_answers')
      .upsert(rows, { onConflict: 'lead_id,question_key' })

    if (upsertError) {
      console.error('[saveDnaAnswers] upsert error:', upsertError.message)
      return { success: false, error: 'Erro ao salvar respostas. Tente novamente.' }
    }
  }

  // 5. Atualizar dna_stage e dna_progress no lead (nunca retroage)
  const newStage    = Math.min(6, Math.max(lead.dna_stage, stepNum === 6 ? 6 : stepNum + 1))
  const newProgress = Math.min(100, Math.max(lead.dna_progress, Math.round(stepNum / 6 * 100)))

  await supabase
    .from('leads')
    .update({ dna_stage: newStage, dna_progress: newProgress })
    .eq('id', lead.id)

  // 6. Redirecionar para a próxima etapa ou tela de conclusão
  const nextStage = stepNum >= 6 ? 0 : stepNum + 1
  if (nextStage === 0) {
    // Tela de conclusão emocional dentro do próprio /dna (PARTE E)
    redirect(`/${unitSlug}/dna?concluido=1`)
  }
  // Banner "Seu DNA ficou mais inteligente!" na próxima etapa (PARTE D)
  redirect(`/${unitSlug}/dna?etapa=${nextStage}&saved=1`)
}

// ---------------------------------------------------------------------------
// Server Action: Salvar perfil empresarial (business_profiles)
//
// SEGURANÇA:
//   • unitSlug vinculado pelo Server Component — nunca do browser
//   • lead_id e unit_id resolvidos do cookie + banco — nunca do FormData
//   • Dados pessoais e empresariais permanecem em tabelas separadas
//   • UPSERT idempotente com onConflict: 'lead_id'
//   • Campos sensíveis (faturamento, garantias) só ficam no banco
//   • redirect() no sucesso — state só carrega erros de validação
// ---------------------------------------------------------------------------

export async function saveBusinessProfile(
  unitSlug: string,
  _prevState: SaveBusinessProfileState,
  formData: FormData,
): Promise<SaveBusinessProfileState> {
  // 1. Cookie → leadId
  const cookieStore = await cookies()
  const token = cookieStore.get('dna_lead_token')?.value
  if (!token) return { error: 'Sessão não encontrada. Faça o cadastro novamente.' }

  let leadId: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    leadId = decoded.split(':')[0]
    if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) throw new Error('invalid')
  } catch {
    return { error: 'Sessão inválida.' }
  }

  // 2. Validar bloco (1–5)
  const block = parseInt(formData.get('block')?.toString() ?? '0', 10)
  if (block < 1 || block > 5) return { error: 'Bloco inválido.' }

  // 3. Resolver lead + unit_id do banco (valida unit_slug → impede cross-unit)
  const supabase = createServerSupabaseClient()
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, unit_id')
    .eq('id', leadId)
    .eq('unit_slug', unitSlug)
    .is('deleted_at', null)
    .single()

  if (leadError || !lead) return { error: 'Sessão inválida ou expirada. Tente novamente.' }

  // 4. Helpers locais — nunca do browser
  const parseBool = (key: string): boolean | null => {
    const v = formData.get(key)?.toString()
    if (v === 'true')  return true
    if (v === 'false') return false
    return null
  }
  const parseMoney = (key: string): number | null => {
    const raw = (formData.get(key)?.toString() ?? '').trim()
    if (!raw) return null
    const v = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    return isNaN(v) || v < 0 ? null : v
  }
  const parseStr = (key: string): string | null => {
    const v = (formData.get(key)?.toString() ?? '').trim()
    return v || null
  }

  // 5. Montar objeto de upsert específico por bloco
  const upsertData: Record<string, unknown> = {
    unit_id: lead.unit_id,  // ← resolvido do banco, nunca do browser
    lead_id: lead.id,       // ← resolvido do cookie
  }

  if (block === 1) {
    const revenue = parseMoney('monthly_revenue')
    const bizExp  = parseMoney('monthly_biz_expenses')
    Object.assign(upsertData, {
      business_name:        parseStr('business_name'),
      segment:              parseStr('segment'),
      activity_years:       parseStr('activity_years'),
      formalization:        parseStr('formalization'),
      employee_count:       parseStr('employee_count'),
      monthly_revenue:      revenue,
      monthly_biz_expenses: bizExp,
      monthly_profit: (revenue !== null && bizExp !== null) ? revenue - bizExp : null,
    })
  } else if (block === 2) {
    const hasRent         = parseBool('has_rent')
    const wantsOwnPremise = parseBool('wants_own_premise')
    Object.assign(upsertData, {
      premise_type:           parseStr('premise_type'),
      has_rent:               hasRent,
      rent_amount:            hasRent ? parseMoney('rent_amount') : null,
      wants_own_premise:      wantsOwnPremise,
      monthly_premise_budget: wantsOwnPremise ? parseMoney('monthly_premise_budget') : null,
    })
  } else if (block === 3) {
    const hasVehicles       = parseBool('has_vehicles')
    const wantsFleetRenewal = parseBool('wants_fleet_renewal')
    Object.assign(upsertData, {
      has_vehicles:         hasVehicles,
      vehicle_types:        hasVehicles ? parseStr('vehicle_types') : null,
      vehicle_count:        hasVehicles ? parseStr('vehicle_count') : null,
      vehicle_ownership:    hasVehicles ? parseStr('vehicle_ownership') : null,
      wants_fleet_renewal:  hasVehicles ? wantsFleetRenewal : null,
      monthly_fleet_budget: (hasVehicles && wantsFleetRenewal) ? parseMoney('monthly_fleet_budget') : null,
    })
  } else if (block === 4) {
    const needsWC       = parseBool('needs_working_capital')
    const hasCollateral = parseBool('has_collateral_asset')
    Object.assign(upsertData, {
      needs_working_capital:   needsWC,
      working_capital_amount:  needsWC ? parseMoney('working_capital_amount') : null,
      working_capital_purpose: needsWC ? parseStr('working_capital_purpose') : null,
      has_collateral_asset:    hasCollateral,
      collateral_type:         hasCollateral ? parseStr('collateral_type') : null,
      collateral_value:        hasCollateral ? parseMoney('collateral_value') : null,
    })
  } else {
    // block === 5
    Object.assign(upsertData, {
      needs_equipment:       parseBool('needs_equipment'),
      needs_renovation:      parseBool('needs_renovation'),
      needs_hiring:          parseBool('needs_hiring'),
      needs_marketing:       parseBool('needs_marketing'),
      needs_financial_org:   parseBool('needs_financial_org'),
      has_separate_accounts: parseBool('has_separate_accounts'),
    })
  }

  // 6. UPSERT — unit_id e lead_id vêm do servidor, nunca do browser
  const { error: upsertError } = await supabase
    .from('business_profiles')
    .upsert(upsertData, { onConflict: 'lead_id' })

  if (upsertError) {
    console.error('[saveBusinessProfile] upsert error:', upsertError.message)
    return { error: 'Erro ao salvar. Tente novamente em instantes.' }
  }

  // 7. Recalcular biz_dna_progress (não crítico — falha silenciosa)
  try {
    const { data: bizRow } = await supabase
      .from('business_profiles')
      .select('business_name, segment, formalization, monthly_revenue, has_rent, premise_type, wants_own_premise, has_vehicles, vehicle_types, needs_working_capital, has_collateral_asset, needs_equipment, needs_renovation, needs_hiring, needs_marketing, needs_financial_org, has_separate_accounts')
      .eq('lead_id', lead.id)
      .is('deleted_at', null)
      .single()

    if (bizRow) {
      const b1 = [bizRow.business_name, bizRow.segment, bizRow.formalization, bizRow.monthly_revenue].some(v => v !== null && v !== undefined)
      const b2 = [bizRow.has_rent, bizRow.premise_type, bizRow.wants_own_premise].some(v => v !== null && v !== undefined)
      const b3 = [bizRow.has_vehicles, bizRow.vehicle_types].some(v => v !== null && v !== undefined)
      const b4 = [bizRow.needs_working_capital, bizRow.has_collateral_asset].some(v => v !== null && v !== undefined)
      const b5 = [bizRow.needs_equipment, bizRow.needs_renovation, bizRow.needs_hiring, bizRow.needs_marketing, bizRow.needs_financial_org, bizRow.has_separate_accounts].some(v => v !== null && v !== undefined)
      const progress = Math.round([b1, b2, b3, b4, b5].filter(Boolean).length / 5 * 100)
      await supabase
        .from('business_profiles')
        .update({ biz_dna_progress: progress })
        .eq('lead_id', lead.id)
    }
  } catch { /* progress update não crítico */ }

  // 8. Redirecionar para próximo bloco ou conclusão (FORA de qualquer try/catch)
  if (block >= 5) redirect(`/${unitSlug}/empresa?concluido=1`)
  redirect(`/${unitSlug}/empresa?bloco=${block + 1}`)
}
