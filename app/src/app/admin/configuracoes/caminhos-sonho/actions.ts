'use server'

// =============================================================================
// DNA FINANCEIRO — SERVER ACTIONS: ADMIN DE CAMINHOS DO SONHO
//
// SEGURANÇA:
//   • requireAdmin() em toda ação — redireciona se não autenticado
//   • Apenas master pode criar, editar ou deletar (role !== 'master' → erro)
//   • unit_admin e unit_viewer são rejeitados
//   • unit_id NULL = global; preenchido = override por unidade
//   • Soft delete: deleted_at = NOW() + active = false
//   • Campos percent: usuário digita "40" → salva 0.40
//   • Campos moeda: aceita "2.148,24" ou "2148.24" → salva number
// =============================================================================

import { redirect }              from 'next/navigation'
import { requireAdmin }          from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PathType }         from '@/lib/dreamPlan'

// ── Resultado genérico de ação ────────────────────────────────────────────────

export type PathActionResult = {
  success: boolean
  error?:  string
  field?:  string
}

// ── path_types válidos ────────────────────────────────────────────────────────

const VALID_PATH_TYPES: PathType[] = [
  'cash_saving',
  'investment',
  'financing',
  'cdc',
  'investment_plus_cdc',
  'consortium_traditional',
  'consortium_with_bid',
  'consortium_programmed_date',
]

const VALID_DREAM_TYPES = [
  'carro', 'casa', 'negocio', 'viagem', 'reserva',
  'faculdade', 'reforma', 'dividas', 'moto',
  'caminhao', 'aposentadoria_imobiliaria', 'outro',
]

// BLOCO 1 — admin_fee_base: usar valores corretos do banco
const VALID_ADMIN_FEE_BASES = ['credit_value', 'invested_amount', 'financed_amount']

const UNIQUE_PATH_SCOPE_MESSAGE =
  'Já existe uma configuração para esta unidade, sonho, subtipo e caminho.'

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' ||
    (error.message?.includes('uidx_dream_path_unit_type_subtype_path') ?? false)
}

const VALID_CALCULATION_MODES = ['fixed', 'proportional', 'formula']

// ── Parsers ───────────────────────────────────────────────────────────────────

/** "2.148,24" → 2148.24 | "2148.24" → 2148.24 | "" → null */
function parseBRL(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null
  const clean = raw.trim().replace(/\./g, '').replace(',', '.')
  const val = parseFloat(clean)
  return isNaN(val) ? null : val
}

/** "40" → 0.40 | "0.40" → 0.40 | "" → null */
function parsePercent(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null
  const val = parseFloat(raw.trim().replace(',', '.'))
  if (isNaN(val)) return null
  return val > 1 ? val / 100 : val
}

/** "60" → 60 | "" → null */
function parseIntField(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null
  const val = parseInt(raw.trim(), 10)
  return isNaN(val) ? null : val
}

/** "2025-12-31T18:00" → ISO string | "" → null */
function parseDatetimeLocal(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null
  const iso = raw.trim() + ':00.000Z'
  const d   = new Date(iso)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ── Parse do FormData ─────────────────────────────────────────────────────────

function parsePathFormData(formData: FormData) {
  const path_type_raw   = formData.get('path_type')?.toString().trim()     ?? ''
  const dream_type_raw  = formData.get('dream_type')?.toString().trim()    ?? ''
  const dream_subtype   = formData.get('dream_subtype')?.toString().trim() || null
  const label           = formData.get('label')?.toString().trim()         ?? ''
  const description     = formData.get('description')?.toString().trim()   || null
  const sort_order      = parseIntField(formData.get('sort_order')?.toString() ?? null) ?? 0
  const active          = formData.get('active') === 'on'
  const show_capital_gain = formData.get('show_capital_gain') === 'on'
  const show_total_cost   = formData.get('show_total_cost')   === 'on'

  // Monetários
  const default_amount              = parseBRL(formData.get('default_amount')?.toString()              ?? null)
  const full_installment_amount     = parseBRL(formData.get('full_installment_amount')?.toString()     ?? null)
  const reduced_installment_amount  = parseBRL(formData.get('reduced_installment_amount')?.toString()  ?? null)

  // Prazo/inteiros
  const term_months                              = parseIntField(formData.get('term_months')?.toString()                              ?? null)
  const group_size                               = parseIntField(formData.get('group_size')?.toString()                               ?? null)
  const draws_per_month                          = parseIntField(formData.get('draws_per_month')?.toString()                          ?? null)
  const programmed_contemplation_month           = parseIntField(formData.get('programmed_contemplation_month')?.toString()           ?? null)
  const anticipation_start_month                 = parseIntField(formData.get('anticipation_start_month')?.toString()                 ?? null)
  const anticipation_installments                = parseIntField(formData.get('anticipation_installments')?.toString()                ?? null)
  const required_paid_installments_for_credit    = parseIntField(formData.get('required_paid_installments_for_credit')?.toString()    ?? null)

  // Percentuais
  const annual_return_rate           = parsePercent(formData.get('annual_return_rate')?.toString()           ?? null)
  const monthly_interest_rate        = parsePercent(formData.get('monthly_interest_rate')?.toString()        ?? null)
  const annual_interest_rate         = parsePercent(formData.get('annual_interest_rate')?.toString()         ?? null)
  const admin_fee_rate               = parsePercent(formData.get('admin_fee_rate')?.toString()               ?? null)
  const down_payment_percent         = parsePercent(formData.get('down_payment_percent')?.toString()         ?? null)
  const bid_percent                  = parsePercent(formData.get('bid_percent')?.toString()                  ?? null)
  const average_letter_premium_percent = parsePercent(formData.get('average_letter_premium_percent')?.toString() ?? null)

  // BLOCO 1 — admin_fee_base: validação com valores corretos do banco
  const admin_fee_base_raw = formData.get('admin_fee_base')?.toString().trim() || null
  const admin_fee_base = admin_fee_base_raw && VALID_ADMIN_FEE_BASES.includes(admin_fee_base_raw)
    ? admin_fee_base_raw : null

  // BLOCO 2 — calculation_mode
  const calc_mode_raw  = formData.get('calculation_mode')?.toString().trim() || null
  const calculation_mode = calc_mode_raw && VALID_CALCULATION_MODES.includes(calc_mode_raw)
    ? calc_mode_raw : null

  const path_type = VALID_PATH_TYPES.includes(path_type_raw as PathType)
    ? (path_type_raw as PathType)
    : null

  const dream_type = dream_type_raw && VALID_DREAM_TYPES.includes(dream_type_raw)
    ? dream_type_raw : null

  const unit_id_raw = formData.get('unit_id')?.toString().trim() ?? ''
  const unit_id = unit_id_raw && /^[0-9a-f-]{36}$/.test(unit_id_raw) ? unit_id_raw : null

  // BLOCO 3 — Promoção
  const promo_active                     = formData.get('promo_active') === 'on'
  const promo_label                      = formData.get('promo_label')?.toString().trim() || null
  const promo_starts_at                  = parseDatetimeLocal(formData.get('promo_starts_at')?.toString() ?? null)
  const promo_ends_at                    = parseDatetimeLocal(formData.get('promo_ends_at')?.toString()   ?? null)
  const promo_admin_fee_rate             = parsePercent(formData.get('promo_admin_fee_rate')?.toString()             ?? null)
  const promo_installment_amount         = parseBRL(formData.get('promo_installment_amount')?.toString()         ?? null)
  const promo_reduced_installment_amount = parseBRL(formData.get('promo_reduced_installment_amount')?.toString()  ?? null)

  return {
    path_type, dream_type, dream_subtype, label, description, sort_order, active,
    unit_id,
    show_capital_gain, show_total_cost,
    default_amount, full_installment_amount, reduced_installment_amount,
    term_months, group_size, draws_per_month,
    programmed_contemplation_month, anticipation_start_month,
    anticipation_installments, required_paid_installments_for_credit,
    annual_return_rate, monthly_interest_rate, annual_interest_rate,
    admin_fee_rate, admin_fee_base, down_payment_percent, bid_percent,
    average_letter_premium_percent,
    calculation_mode,
    promo_active, promo_label, promo_starts_at, promo_ends_at,
    promo_admin_fee_rate, promo_installment_amount, promo_reduced_installment_amount,
  }
}

// ── Criar caminho ─────────────────────────────────────────────────────────────

export async function createPath(
  _prev: PathActionResult | null,
  formData: FormData,
): Promise<PathActionResult> {
  const session = await requireAdmin()
  if (session.role !== 'master') {
    return { success: false, error: 'Apenas master pode criar caminhos do sonho.' }
  }

  const parsed = parsePathFormData(formData)

  if (!parsed.path_type) {
    return { success: false, error: 'Selecione um tipo de caminho.', field: 'path_type' }
  }
  if (!parsed.label || parsed.label.length < 2) {
    return { success: false, error: 'O rótulo é obrigatório (mín. 2 caracteres).', field: 'label' }
  }

  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from('dream_path_settings').insert({
    unit_id:                             parsed.unit_id,
    path_type:                           parsed.path_type,
    dream_type:                          parsed.dream_type,
    dream_subtype:                       parsed.dream_subtype,
    label:                               parsed.label,
    description:                         parsed.description,
    sort_order:                          parsed.sort_order,
    active:                              parsed.active,
    show_capital_gain:                   parsed.show_capital_gain,
    show_total_cost:                     parsed.show_total_cost,
    default_amount:                      parsed.default_amount,
    full_installment_amount:             parsed.full_installment_amount,
    reduced_installment_amount:          parsed.reduced_installment_amount,
    term_months:                         parsed.term_months,
    group_size:                          parsed.group_size,
    draws_per_month:                     parsed.draws_per_month,
    programmed_contemplation_month:      parsed.programmed_contemplation_month,
    anticipation_start_month:            parsed.anticipation_start_month,
    anticipation_installments:           parsed.anticipation_installments,
    required_paid_installments_for_credit: parsed.required_paid_installments_for_credit,
    annual_return_rate:                  parsed.annual_return_rate,
    monthly_interest_rate:               parsed.monthly_interest_rate,
    annual_interest_rate:                parsed.annual_interest_rate,
    admin_fee_rate:                      parsed.admin_fee_rate,
    admin_fee_base:                      parsed.admin_fee_base,
    down_payment_percent:                parsed.down_payment_percent,
    bid_percent:                         parsed.bid_percent,
    average_letter_premium_percent:      parsed.average_letter_premium_percent,
    calculation_mode:                    parsed.calculation_mode,
    promo_active:                        parsed.promo_active,
    promo_label:                         parsed.promo_label,
    promo_starts_at:                     parsed.promo_starts_at,
    promo_ends_at:                       parsed.promo_ends_at,
    promo_admin_fee_rate:                parsed.promo_admin_fee_rate,
    promo_installment_amount:            parsed.promo_installment_amount,
    promo_reduced_installment_amount:    parsed.promo_reduced_installment_amount,
  })

  if (error) {
    console.error('[createPath]', error.message)
    if (isUniqueViolation(error)) {
      return { success: false, error: UNIQUE_PATH_SCOPE_MESSAGE, field: 'unit_id' }
    }
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  redirect('/admin/configuracoes/caminhos-sonho?created=1')
}

// ── Atualizar caminho ─────────────────────────────────────────────────────────

export async function updatePath(
  id: string,
  _prev: PathActionResult | null,
  formData: FormData,
): Promise<PathActionResult> {
  const session = await requireAdmin()
  if (session.role !== 'master') {
    return { success: false, error: 'Apenas master pode editar caminhos do sonho.' }
  }
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return { success: false, error: 'ID inválido.' }
  }

  const parsed = parsePathFormData(formData)

  if (!parsed.path_type) {
    return { success: false, error: 'Selecione um tipo de caminho.', field: 'path_type' }
  }
  if (!parsed.label || parsed.label.length < 2) {
    return { success: false, error: 'O rótulo é obrigatório (mín. 2 caracteres).', field: 'label' }
  }

  const supabase = createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('dream_path_settings')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!existing) return { success: false, error: 'Caminho não encontrado.' }

  const { error } = await supabase
    .from('dream_path_settings')
    .update({
      unit_id:                             parsed.unit_id,
      path_type:                           parsed.path_type,
      dream_type:                          parsed.dream_type,
      dream_subtype:                       parsed.dream_subtype,
      label:                               parsed.label,
      description:                         parsed.description,
      sort_order:                          parsed.sort_order,
      active:                              parsed.active,
      show_capital_gain:                   parsed.show_capital_gain,
      show_total_cost:                     parsed.show_total_cost,
      default_amount:                      parsed.default_amount,
      full_installment_amount:             parsed.full_installment_amount,
      reduced_installment_amount:          parsed.reduced_installment_amount,
      term_months:                         parsed.term_months,
      group_size:                          parsed.group_size,
      draws_per_month:                     parsed.draws_per_month,
      programmed_contemplation_month:      parsed.programmed_contemplation_month,
      anticipation_start_month:            parsed.anticipation_start_month,
      anticipation_installments:           parsed.anticipation_installments,
      required_paid_installments_for_credit: parsed.required_paid_installments_for_credit,
      annual_return_rate:                  parsed.annual_return_rate,
      monthly_interest_rate:               parsed.monthly_interest_rate,
      annual_interest_rate:                parsed.annual_interest_rate,
      admin_fee_rate:                      parsed.admin_fee_rate,
      admin_fee_base:                      parsed.admin_fee_base,
      down_payment_percent:                parsed.down_payment_percent,
      bid_percent:                         parsed.bid_percent,
      average_letter_premium_percent:      parsed.average_letter_premium_percent,
      calculation_mode:                    parsed.calculation_mode,
      promo_active:                        parsed.promo_active,
      promo_label:                         parsed.promo_label,
      promo_starts_at:                     parsed.promo_starts_at,
      promo_ends_at:                       parsed.promo_ends_at,
      promo_admin_fee_rate:                parsed.promo_admin_fee_rate,
      promo_installment_amount:            parsed.promo_installment_amount,
      promo_reduced_installment_amount:    parsed.promo_reduced_installment_amount,
      updated_at:                          new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[updatePath]', error.message)
    if (isUniqueViolation(error)) {
      return { success: false, error: UNIQUE_PATH_SCOPE_MESSAGE, field: 'unit_id' }
    }
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  redirect('/admin/configuracoes/caminhos-sonho?updated=1')
}

// ── Toggle active ─────────────────────────────────────────────────────────────

export async function togglePathActive(id: string) {
  const session = await requireAdmin()
  if (session.role !== 'master') return
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return

  const supabase = createServerSupabaseClient()

  const { data: path } = await supabase
    .from('dream_path_settings')
    .select('id, active')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!path) return

  await supabase
    .from('dream_path_settings')
    .update({ active: !path.active, updated_at: new Date().toISOString() })
    .eq('id', id)

  redirect('/admin/configuracoes/caminhos-sonho')
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function deletePath(id: string) {
  const session = await requireAdmin()
  if (session.role !== 'master') return
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return

  const supabase = createServerSupabaseClient()

  const { data: path } = await supabase
    .from('dream_path_settings')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!path) return

  await supabase
    .from('dream_path_settings')
    .update({
      deleted_at: new Date().toISOString(),
      active:     false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  redirect('/admin/configuracoes/caminhos-sonho?deleted=1')
}
