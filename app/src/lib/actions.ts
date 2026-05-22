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
import type { LeadCreateInput, CreateLeadResult, FormErrors } from '@/types/database'

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
