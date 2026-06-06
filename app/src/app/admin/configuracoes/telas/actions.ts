'use server'

// =============================================================================
// Admin Configuração de Telas — Server Actions
//
// SEGURANÇA:
//   • requireAdmin() em toda ação
//   • unit_viewer não pode criar/editar/deletar blocos
//   • unit_admin só opera em blocos da sua própria unidade
//   • master pode criar blocos globais (unit_id = null) ou por unidade
//   • allowed_blocks da unidade é respeitado na criação
// =============================================================================

import { redirect }              from 'next/navigation'
import { requireAdmin }          from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type BlockActionResult = {
  success: boolean
  error?:  string
  field?:  string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const VALID_PAGES = ['diagnostic', 'painel', 'relatorio'] as const
type PageType = typeof VALID_PAGES[number]

const VALID_BLOCK_TYPES = [
  'financial_profile', 'dream_simulation', 'financial_numbers',
  'ai_recommendation', 'alert_section', 'action_buttons', 'smart_guidance',
  'cash_saving', 'investment',
  'consortium_traditional', 'consortium_with_bid', 'consortium_programmed_date',
  'financing', 'cdc', 'comparison', 'opportunity',
] as const

// ── Parsers ───────────────────────────────────────────────────────────────────

function parsePct(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null
  const v = parseFloat(raw.trim().replace(',', '.'))
  return isNaN(v) ? null : (v > 1 ? v / 100 : v)
}

function parseIntF(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null
  const v = parseInt(raw.trim(), 10)
  return isNaN(v) ? null : v
}

/** Monta o JSONB config a partir do FormData por block_type */
function buildConfig(blockType: string, fd: FormData): Record<string, unknown> {
  const str  = (k: string) => fd.get(k)?.toString().trim() || null
  const bool = (k: string) => fd.get(k) === 'on'
  const num  = (k: string) => parseIntF(fd.get(k)?.toString() ?? null)
  const pct  = (k: string) => parsePct(fd.get(k)?.toString() ?? null)

  const PATH_BLOCKS = [
    'cash_saving','investment','consortium_traditional','consortium_with_bid',
    'consortium_programmed_date','financing','cdc',
  ]

  if (PATH_BLOCKS.includes(blockType)) {
    return {
      show_full_installment:    bool('show_full_installment'),
      show_reduced_installment: bool('show_reduced_installment'),
      show_down_payment:        bool('show_down_payment'),
      show_term:                bool('show_term'),
      show_total_cost:          bool('show_total_cost'),
    }
  }

  if (blockType === 'smart_guidance') {
    return {
      gap_threshold:       pct('gap_threshold')       ?? 0.30,
      suggest_alternative: bool('suggest_alternative'),
      alternative_percent: pct('alternative_percent') ?? 0.40,
      extra_income_url:    str('extra_income_url')    ?? '/oportunidades',
      adjust_dream_url:    str('adjust_dream_url')    ?? '/sonho/trocar',
    }
  }

  if (blockType === 'comparison') {
    return {
      path_a: str('path_a') ?? 'cash_saving',
      path_b: str('path_b') ?? 'financing',
      title:  str('comp_title') ?? 'Qual caminho é melhor para você?',
    }
  }

  if (blockType === 'opportunity') {
    return {
      mode:          str('opp_mode') ?? 'fixed',
      rotation_days: num('rotation_days') ?? 7,
      cta_url:       str('cta_url'),
      api_url:       str('api_url'),
    }
  }

  return {}
}

// ── Verificar se block_type está na lista de permitidos da unidade ─────────────

async function isBlockAllowed(
  unitId:    string | null,
  blockType: string,
): Promise<boolean> {
  if (!unitId) return true  // global blocks: sem restrição
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('units')
    .select('allowed_blocks')
    .eq('id', unitId)
    .is('deleted_at', null)
    .single()
  if (!data) return false
  const allowed = (data as { allowed_blocks?: string[] | null }).allowed_blocks
  if (!allowed || allowed.length === 0) return true  // null = sem restrição
  return allowed.includes(blockType)
}

// ── createBlock ───────────────────────────────────────────────────────────────

export async function createBlock(
  _prev:    BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') {
    return { success: false, error: 'Sem permissão para configurar telas.' }
  }

  const rawPage      = formData.get('page')?.toString().trim()
  const rawBlockType = formData.get('block_type')?.toString().trim()
  const sortOrder    = parseInt(formData.get('sort_order')?.toString() ?? '0', 10)
  const active       = formData.get('active') === 'on'

  if (!rawPage || !(VALID_PAGES as readonly string[]).includes(rawPage)) {
    return { success: false, error: 'Selecione uma tela válida.', field: 'page' }
  }
  if (!rawBlockType || !(VALID_BLOCK_TYPES as readonly string[]).includes(rawBlockType)) {
    return { success: false, error: 'Selecione um tipo de bloco válido.', field: 'block_type' }
  }

  // Resolve unit_id
  let unitId: string | null = null
  if (session.role === 'master') {
    const raw = formData.get('unit_id')?.toString().trim()
    unitId = raw && /^[0-9a-f-]{36}$/.test(raw) ? raw : null
  } else {
    unitId = session.unitId!
  }

  // Verificar allowed_blocks
  const allowed = await isBlockAllowed(unitId, rawBlockType)
  if (!allowed) {
    return { success: false, error: 'Este tipo de bloco não está liberado para esta unidade.' }
  }

  // path_settings_id (opcional)
  const rawPath = formData.get('path_settings_id')?.toString().trim()
  const pathSettingsId = rawPath && /^[0-9a-f-]{36}$/.test(rawPath) ? rawPath : null

  const config = buildConfig(rawBlockType, formData)

  const supabase = createServerSupabaseClient()

  const { error } = await supabase.from('page_blocks').insert({
    unit_id:          unitId,
    page:             rawPage as PageType,
    block_type:       rawBlockType,
    active,
    sort_order:       isNaN(sortOrder) ? 0 : sortOrder,
    path_settings_id: pathSettingsId,
    config,
  })

  if (error) {
    console.error('[createBlock]', error.message)
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um bloco deste tipo para esta tela e unidade.' }
    }
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  const unitParam = unitId ? `&unit_id=${unitId}` : ''
  redirect(`/admin/configuracoes/telas?page=${rawPage}${unitParam}&created=1`)
}

// ── updateBlock ───────────────────────────────────────────────────────────────

export async function updateBlock(
  blockId:  string,
  _prev:    BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') {
    return { success: false, error: 'Sem permissão.' }
  }
  if (!blockId || !/^[0-9a-f-]{36}$/.test(blockId)) {
    return { success: false, error: 'Bloco inválido.' }
  }

  const supabase = createServerSupabaseClient()

  // Verifica que o bloco existe e pertence à unidade correta
  let q = supabase.from('page_blocks').select('id, unit_id, block_type, page').eq('id', blockId)
  const { data: existing } = await q.single()
  if (!existing) return { success: false, error: 'Bloco não encontrado.' }

  if (session.role !== 'master') {
    const b = existing as { unit_id?: string | null }
    if (b.unit_id !== session.unitId) {
      return { success: false, error: 'Sem permissão para editar este bloco.' }
    }
  }

  const sortOrder = parseInt(formData.get('sort_order')?.toString() ?? '0', 10)
  const active    = formData.get('active') === 'on'
  const blockType = (existing as { block_type: string }).block_type

  const rawPath = formData.get('path_settings_id')?.toString().trim()
  const pathSettingsId = rawPath && /^[0-9a-f-]{36}$/.test(rawPath) ? rawPath : null

  const config = buildConfig(blockType, formData)

  const { error } = await supabase
    .from('page_blocks')
    .update({
      active,
      sort_order:       isNaN(sortOrder) ? 0 : sortOrder,
      path_settings_id: pathSettingsId,
      config,
    })
    .eq('id', blockId)

  if (error) {
    console.error('[updateBlock]', error.message)
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  const page      = (existing as { page: string }).page
  const unitId    = (existing as { unit_id?: string | null }).unit_id
  const unitParam = unitId ? `&unit_id=${unitId}` : ''
  redirect(`/admin/configuracoes/telas?page=${page}${unitParam}&updated=1`)
}

// ── toggleBlockActive ─────────────────────────────────────────────────────────

export async function toggleBlockActive(blockId: string) {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') return
  if (!blockId || !/^[0-9a-f-]{36}$/.test(blockId)) return

  const supabase = createServerSupabaseClient()
  const { data: block } = await supabase
    .from('page_blocks')
    .select('id, active, unit_id, page')
    .eq('id', blockId)
    .single()

  if (!block) return
  const b = block as { active: boolean; unit_id?: string | null; page: string }

  if (session.role !== 'master' && b.unit_id !== session.unitId) return

  await supabase
    .from('page_blocks')
    .update({ active: !b.active })
    .eq('id', blockId)

  const unitParam = b.unit_id ? `&unit_id=${b.unit_id}` : ''
  redirect(`/admin/configuracoes/telas?page=${b.page}${unitParam}`)
}

// ── deleteBlock ───────────────────────────────────────────────────────────────

export async function deleteBlock(blockId: string) {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') return
  if (!blockId || !/^[0-9a-f-]{36}$/.test(blockId)) return

  const supabase = createServerSupabaseClient()
  const { data: block } = await supabase
    .from('page_blocks')
    .select('id, unit_id, page')
    .eq('id', blockId)
    .single()

  if (!block) return
  const b = block as { unit_id?: string | null; page: string }

  if (session.role !== 'master' && b.unit_id !== session.unitId) return

  await supabase.from('page_blocks').delete().eq('id', blockId)

  const unitParam = b.unit_id ? `&unit_id=${b.unit_id}` : ''
  redirect(`/admin/configuracoes/telas?page=${b.page}${unitParam}&deleted=1`)
}

// ── moveBlock (swap sort_order) ───────────────────────────────────────────────

export async function moveBlock(blockId: string, direction: 'up' | 'down') {
  const session = await requireAdmin()
  if (session.role === 'unit_viewer') return
  if (!blockId || !/^[0-9a-f-]{36}$/.test(blockId)) return

  const supabase = createServerSupabaseClient()
  const { data: current } = await supabase
    .from('page_blocks')
    .select('id, sort_order, unit_id, page')
    .eq('id', blockId)
    .single()

  if (!current) return
  const c = current as { id: string; sort_order: number; unit_id?: string | null; page: string }

  if (session.role !== 'master' && c.unit_id !== session.unitId) return

  // Encontrar bloco vizinho
  const neighborQ = supabase
    .from('page_blocks')
    .select('id, sort_order')
    .eq('page', c.page)
    .order('sort_order', { ascending: direction === 'up' })

  if (c.unit_id) {
    neighborQ.eq('unit_id', c.unit_id)
  } else {
    neighborQ.is('unit_id', null)
  }

  if (direction === 'up') {
    neighborQ.lt('sort_order', c.sort_order)
  } else {
    neighborQ.gt('sort_order', c.sort_order)
  }

  const { data: neighbors } = await neighborQ.limit(1)
  if (!neighbors || neighbors.length === 0) {
    const unitParam = c.unit_id ? `&unit_id=${c.unit_id}` : ''
    redirect(`/admin/configuracoes/telas?page=${c.page}${unitParam}`)
    return
  }

  const neighbor = neighbors[0] as { id: string; sort_order: number }

  // Trocar sort_orders
  await supabase.from('page_blocks').update({ sort_order: neighbor.sort_order }).eq('id', c.id)
  await supabase.from('page_blocks').update({ sort_order: c.sort_order }).eq('id', neighbor.id)

  const unitParam = c.unit_id ? `&unit_id=${c.unit_id}` : ''
  redirect(`/admin/configuracoes/telas?page=${c.page}${unitParam}`)
}
