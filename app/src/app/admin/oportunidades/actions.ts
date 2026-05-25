'use server'

// =============================================================================
// DNA FINANCEIRO — SERVER ACTIONS: ADMIN DE OPORTUNIDADES
//
// SEGURANÇA:
//   • requireAdmin() em toda ação — redireciona se não autenticado
//   • unit_admin só opera em opps da sua própria unit
//   • unit_viewer não pode criar, editar ou deletar
//   • unit_id NUNCA vem do FormData de master sem validação de existência no banco
//   • created_by é sempre o profileId do admin autenticado
//   • Soft delete: deleted_at = NOW() + active = false
// =============================================================================

import { redirect }  from 'next/navigation'
import { requireAdmin } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AdminOppResult, OppType } from '@/types/database'

// ── Constantes válidas ────────────────────────────────────────────────────────

const VALID_TYPES: OppType[] = ['event', 'course', 'challenge', 'job', 'banner', 'partner']

const VALID_DREAMS = [
  'carro', 'casa', 'negocio', 'viagem', 'reserva',
  'faculdade', 'reforma', 'dividas', 'moto', 'outro',
]

// Perfis empresariais válidos para target_profile
const VALID_PROFILES: string[] = [
  'empresario', 'mei', 'autonomo_informal',
  'paga_aluguel', 'quer_ponto_proprio',
  'tem_frota', 'renovar_frota',
  'precisa_capital', 'tem_garantia',
  'precisa_equipamento', 'precisa_marketing',
  'sem_conta_pj',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converte valor de input datetime-local ("YYYY-MM-DDTHH:MM") para ISO UTC.
 * Trata o valor como UTC (sem conversão de fuso).
 * Retorna null se vazio ou inválido.
 */
function parseDatetimeLocal(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null
  // datetime-local omite segundos: "2024-12-25T10:00" → adiciona ":00.000Z"
  const iso = raw.trim() + ':00.000Z'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return date.toISOString()
}

function parseOppFormData(formData: FormData) {
  const title       = formData.get('title')?.toString().trim()       ?? ''
  const description = formData.get('description')?.toString().trim() || null
  const cta_label   = formData.get('cta_label')?.toString().trim()   || null
  const cta_url     = formData.get('cta_url')?.toString().trim()     || null
  const rawDream    = formData.get('target_dream')?.toString().trim()
  const target_dream = rawDream && VALID_DREAMS.includes(rawDream) ? rawDream : null
  const rawProfile   = formData.get('target_profile')?.toString().trim()
  const target_profile = rawProfile && VALID_PROFILES.includes(rawProfile) ? rawProfile : null
  const featured    = formData.get('featured') === 'on'
  const active      = formData.get('active') === 'on'
  const position    = parseInt(formData.get('position')?.toString() ?? '0', 10)
  const rawType     = formData.get('type')?.toString() ?? ''
  const type        = VALID_TYPES.includes(rawType as OppType) ? (rawType as OppType) : null

  // Período de exibição (UTC)
  const starts_at = parseDatetimeLocal(formData.get('starts_at')?.toString() ?? null)
  const ends_at   = parseDatetimeLocal(formData.get('ends_at')?.toString()   ?? null)

  return { title, description, cta_label, cta_url, target_dream, target_profile, featured, active, position, type, starts_at, ends_at }
}

// ── Criar oportunidade ────────────────────────────────────────────────────────

export async function createOpportunity(
  _prev: AdminOppResult | null,
  formData: FormData,
): Promise<AdminOppResult> {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') {
    return { success: false, error: 'Sem permissão para criar oportunidades.' }
  }

  const parsed = parseOppFormData(formData)

  if (!parsed.title || parsed.title.length < 3) {
    return { success: false, error: 'O título é obrigatório (mín. 3 caracteres).', field: 'title' }
  }
  if (!parsed.type) {
    return { success: false, error: 'Selecione um tipo.', field: 'type' }
  }
  if (parsed.starts_at && parsed.ends_at && parsed.starts_at >= parsed.ends_at) {
    return { success: false, error: 'O início deve ser anterior ao fim.', field: 'period' }
  }

  const supabase = createServerSupabaseClient()

  // Resolve unit_id: master pode escolher via form; unit_admin usa o seu
  let unit_id: string
  if (session.role === 'master') {
    const rawUnitId = formData.get('unit_id')?.toString().trim() ?? ''
    if (!rawUnitId || !/^[0-9a-f-]{36}$/.test(rawUnitId)) {
      return { success: false, error: 'Selecione uma unidade.', field: 'unit_id' }
    }
    // Valida que a unit existe e está ativa
    const { data: unit } = await supabase
      .from('units')
      .select('id')
      .eq('id', rawUnitId)
      .eq('active', true)
      .is('deleted_at', null)
      .single()
    if (!unit) return { success: false, error: 'Unidade inválida.', field: 'unit_id' }
    unit_id = rawUnitId
  } else {
    if (!session.unitId) return { success: false, error: 'Unidade não encontrada.' }
    unit_id = session.unitId
  }

  const { error } = await supabase.from('opportunities').insert({
    unit_id,
    type:         parsed.type,
    title:        parsed.title,
    description:  parsed.description,
    cta_label:    parsed.cta_label,
    cta_url:      parsed.cta_url,
    target_dream:   parsed.target_dream,
    target_profile: parsed.target_profile,
    featured:       parsed.featured,
    active:         parsed.active,
    position:       isNaN(parsed.position) ? 0 : parsed.position,
    starts_at:      parsed.starts_at,
    ends_at:        parsed.ends_at,
    created_by:     session.profileId,   // ← sempre do token, nunca do form
  })

  if (error) {
    console.error('[createOpportunity]', error.message)
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  redirect('/admin/oportunidades?created=1')
}

// ── Atualizar oportunidade ────────────────────────────────────────────────────

export async function updateOpportunity(
  id: string,
  _prev: AdminOppResult | null,
  formData: FormData,
): Promise<AdminOppResult> {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') {
    return { success: false, error: 'Sem permissão para editar oportunidades.' }
  }

  const parsed = parseOppFormData(formData)

  if (!parsed.title || parsed.title.length < 3) {
    return { success: false, error: 'O título é obrigatório (mín. 3 caracteres).', field: 'title' }
  }
  if (!parsed.type) {
    return { success: false, error: 'Selecione um tipo.', field: 'type' }
  }
  if (parsed.starts_at && parsed.ends_at && parsed.starts_at >= parsed.ends_at) {
    return { success: false, error: 'O início deve ser anterior ao fim.', field: 'period' }
  }
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return { success: false, error: 'ID inválido.' }
  }

  const supabase = createServerSupabaseClient()

  // unit_admin deve ter unitId — sem ele não pode editar
  if (session.role !== 'master' && !session.unitId) {
    return { success: false, error: 'Unidade não encontrada.' }
  }

  // Verifica que a opp pertence à unit correta (impede cross-unit)
  let checkQuery = supabase
    .from('opportunities')
    .select('id, unit_id')
    .eq('id', id)
    .is('deleted_at', null)

  if (session.role !== 'master') {
    checkQuery = checkQuery.eq('unit_id', session.unitId!)  // unitId verificado acima
  }

  const { data: existing } = await checkQuery.single()
  if (!existing) return { success: false, error: 'Oportunidade não encontrada.' }

  const { error } = await supabase
    .from('opportunities')
    .update({
      type:         parsed.type,
      title:        parsed.title,
      description:  parsed.description,
      cta_label:    parsed.cta_label,
      cta_url:      parsed.cta_url,
      target_dream:   parsed.target_dream,
      target_profile: parsed.target_profile,
      featured:       parsed.featured,
      active:         parsed.active,
      position:       isNaN(parsed.position) ? 0 : parsed.position,
      starts_at:      parsed.starts_at,
      ends_at:        parsed.ends_at,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[updateOpportunity]', error.message)
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  redirect('/admin/oportunidades?updated=1')
}

// ── Toggle active ─────────────────────────────────────────────────────────────

export async function toggleOppActive(id: string) {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') return
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return

  // unit_admin deve ter unitId — se não tiver, rejeita silenciosamente
  if (session.role !== 'master' && !session.unitId) return

  const supabase = createServerSupabaseClient()

  let q = supabase
    .from('opportunities')
    .select('id, active')
    .eq('id', id)
    .is('deleted_at', null)

  if (session.role !== 'master') {
    q = q.eq('unit_id', session.unitId!)  // unitId verificado acima
  }

  const { data: opp } = await q.single()
  if (!opp) return

  await supabase
    .from('opportunities')
    .update({ active: !opp.active, updated_at: new Date().toISOString() })
    .eq('id', id)

  redirect('/admin/oportunidades')
}

// ── Toggle featured ───────────────────────────────────────────────────────────

export async function toggleOppFeatured(id: string) {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') return
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return

  if (session.role !== 'master' && !session.unitId) return

  const supabase = createServerSupabaseClient()

  let q = supabase
    .from('opportunities')
    .select('id, featured')
    .eq('id', id)
    .is('deleted_at', null)

  if (session.role !== 'master') {
    q = q.eq('unit_id', session.unitId!)
  }

  const { data: opp } = await q.single()
  if (!opp) return

  await supabase
    .from('opportunities')
    .update({ featured: !opp.featured, updated_at: new Date().toISOString() })
    .eq('id', id)

  redirect('/admin/oportunidades')
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function deleteOpportunity(id: string) {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') return
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return

  if (session.role !== 'master' && !session.unitId) return

  const supabase = createServerSupabaseClient()

  let q = supabase
    .from('opportunities')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)

  if (session.role !== 'master') {
    q = q.eq('unit_id', session.unitId!)
  }

  const { data: opp } = await q.single()
  if (!opp) return

  await supabase
    .from('opportunities')
    .update({
      deleted_at: new Date().toISOString(),
      active:     false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  redirect('/admin/oportunidades?deleted=1')
}
