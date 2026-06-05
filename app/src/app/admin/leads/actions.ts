'use server'

// =============================================================================
// /admin/leads — Server Actions
//
// createDeal:   registra negócio fechado vinculado a um lead
// reassignLead: move o lead de uma unidade cidade para um consultor filho
//
// SEGURANÇA:
//   • requireAdmin() em toda ação
//   • unit_viewer não pode criar/editar deals nem reatribuir leads
//   • unit_admin só opera em leads da sua própria unidade
//   • lead_id validado contra unit_id — impede cross-unit
// =============================================================================

import { redirect }              from 'next/navigation'
import { requireAdmin }          from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type LeadActionResult = {
  success: boolean
  error?:  string
  field?:  string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const VALID_STATUSES      = ['won', 'lost', 'pending'] as const
const VALID_PRODUCT_TYPES = ['consorcio', 'financiamento', 'cdc', 'investment', 'imovel', 'outro'] as const

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseBRL(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null
  const clean = raw.trim().replace(/\./g, '').replace(',', '.')
  const val   = parseFloat(clean)
  return isNaN(val) ? null : val
}

// ── createDeal ────────────────────────────────────────────────────────────────

export async function createDeal(
  leadId:   string,
  _prev:    LeadActionResult | null,
  formData: FormData,
): Promise<LeadActionResult> {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') {
    return { success: false, error: 'Sem permissão para registrar negócios.' }
  }
  if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) {
    return { success: false, error: 'Lead inválido.' }
  }

  const supabase = createServerSupabaseClient()

  // Confirma que o lead pertence à unidade do admin
  let leadQ = supabase
    .from('leads')
    .select('id, unit_id')
    .eq('id', leadId)
    .is('deleted_at', null)
  if (session.role !== 'master') {
    leadQ = leadQ.eq('unit_id', session.unitId!)
  }
  const { data: lead } = await leadQ.single()
  if (!lead) return { success: false, error: 'Lead não encontrado.' }

  const rawStatus  = formData.get('status')?.toString()       || 'won'
  const rawProduct = formData.get('product_type')?.toString() || null

  const status       = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'won'
  const product_type = rawProduct && (VALID_PRODUCT_TYPES as readonly string[]).includes(rawProduct) ? rawProduct : null
  const sale_amount  = parseBRL(formData.get('sale_amount')?.toString() ?? null)
  const gain_amount  = parseBRL(formData.get('gain_amount')?.toString()  ?? null)
  const notes        = formData.get('notes')?.toString().trim() || null

  const { error } = await supabase.from('deals').insert({
    lead_id:       leadId,
    unit_id:       lead.unit_id,
    consultant_id: session.profileId,
    status,
    product_type,
    sale_amount,
    gain_amount,
    notes,
    closed_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[createDeal]', error.message)
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  redirect(`/admin/leads/${leadId}?deal_created=1`)
}

// ── reassignLead ──────────────────────────────────────────────────────────────

export async function reassignLead(
  leadId:   string,
  _prev:    LeadActionResult | null,
  formData: FormData,
): Promise<LeadActionResult> {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') {
    return { success: false, error: 'Sem permissão.' }
  }
  if (!leadId || !/^[0-9a-f-]{36}$/.test(leadId)) {
    return { success: false, error: 'Lead inválido.' }
  }

  const new_unit_id = formData.get('new_unit_id')?.toString().trim()
  if (!new_unit_id || !/^[0-9a-f-]{36}$/.test(new_unit_id)) {
    return { success: false, error: 'Selecione um consultor.', field: 'new_unit_id' }
  }

  const supabase = createServerSupabaseClient()

  // Confirma que o lead existe e pertence à unidade
  let leadQ = supabase
    .from('leads')
    .select('id, unit_id')
    .eq('id', leadId)
    .is('deleted_at', null)
  if (session.role !== 'master') {
    leadQ = leadQ.eq('unit_id', session.unitId!)
  }
  const { data: lead } = await leadQ.single()
  if (!lead) return { success: false, error: 'Lead não encontrado.' }

  // Confirma que o destino é uma unidade válida e não deletada
  const { data: targetUnit } = await supabase
    .from('units')
    .select('id, unit_type, parent_unit_id')
    .eq('id', new_unit_id)
    .is('deleted_at', null)
    .single()
  if (!targetUnit) return { success: false, error: 'Consultor não encontrado.' }

  const { error } = await supabase
    .from('leads')
    .update({ unit_id: new_unit_id })
    .eq('id', leadId)

  if (error) {
    console.error('[reassignLead]', error.message)
    return { success: false, error: 'Erro ao reatribuir. Tente novamente.' }
  }

  redirect(`/admin/leads/${leadId}?reassigned=1`)
}

/**
 * Versão sem _prev para uso direto em <form action> de Server Components.
 * Usada na seção de reatribuição dentro do perfil do lead.
 */
export async function reassignLeadDirect(leadId: string, formData: FormData): Promise<void> {
  await reassignLead(leadId, null, formData)
}
