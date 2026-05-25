'use server'

// =============================================================================
// /admin/unidades — Server Actions: criar e editar unidades
//
// SEGURANÇA:
//   • requireAdmin() valida sessão — redireciona se não autenticado
//   • Apenas master pode criar ou editar unidades
//   • slug validado contra palavras reservadas e unicidade no banco
//   • active é derivado de unit_status — nunca aceito do FormData
//   • service_role apenas no servidor
// =============================================================================

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type UnitFormResult =
  | { success: true }
  | { success: false; error: string; field?: string }

// ── Constantes ────────────────────────────────────────────────────────────────

const RESERVED_SLUGS = [
  'admin', 'api', 'login', 'logout', 'dashboard', 'master', 'suporte',
  'www', 'app', 'static', 'sobre', 'privacidade', 'termos', 'contato',
  'assets', 'media', 'files', 'cdn',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFormData(fd: FormData) {
  const str  = (key: string) => (fd.get(key)?.toString() ?? '').trim()
  const strN = (key: string) => str(key) || null
  return {
    name:          str('name'),
    slug:          str('slug').toLowerCase(),
    city:          str('city'),
    state:         str('state').toUpperCase(),
    contact_name:  str('contact_name'),
    contact_email: str('contact_email').toLowerCase(),
    contact_phone: strN('contact_phone'),
    unit_status:   str('unit_status') || 'active',
    billing_plan:  str('billing_plan') || 'gratis',
    plan:          str('plan') || 'basic',
    logo_url:      strN('logo_url'),
    primary_color: strN('primary_color')?.replace('#', '') ?? null,
    notes:         strN('notes'),
  }
}

function validate(data: ReturnType<typeof parseFormData>): UnitFormResult | null {
  if (!data.name || data.name.length < 2)
    return { success: false, error: 'Informe o nome da unidade.', field: 'name' }
  if (data.name.length > 120)
    return { success: false, error: 'Nome muito longo (máx. 120 caracteres).', field: 'name' }

  if (!data.slug || data.slug.length < 3)
    return { success: false, error: 'Slug muito curto (mín. 3 caracteres).', field: 'slug' }
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(data.slug))
    return { success: false, error: 'Slug inválido. Use letras minúsculas, números e hífens (ex: lucas-do-rio-verde).', field: 'slug' }
  if (RESERVED_SLUGS.includes(data.slug))
    return { success: false, error: `"${data.slug}" é uma palavra reservada. Escolha outro slug.`, field: 'slug' }

  if (!data.city || data.city.length < 2)
    return { success: false, error: 'Informe a cidade.', field: 'city' }
  if (!/^[A-Z]{2}$/.test(data.state))
    return { success: false, error: 'Estado inválido. Use 2 letras maiúsculas (ex: MT).', field: 'state' }
  if (!data.contact_name)
    return { success: false, error: 'Informe o nome do responsável.', field: 'contact_name' }
  if (!data.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email))
    return { success: false, error: 'E-mail inválido.', field: 'contact_email' }
  if (!['active', 'paused', 'cancelled'].includes(data.unit_status))
    return { success: false, error: 'Status inválido.', field: 'unit_status' }
  if (!['gratis', 'piloto', 'mensal', 'anual', 'franquia'].includes(data.billing_plan))
    return { success: false, error: 'Plano comercial inválido.', field: 'billing_plan' }
  if (!['basic', 'standard', 'premium'].includes(data.plan))
    return { success: false, error: 'Plano de funcionalidades inválido.', field: 'plan' }
  if (data.primary_color && !/^[0-9a-fA-F]{6}$/.test(data.primary_color))
    return { success: false, error: 'Cor inválida. Use 6 caracteres hex sem # (ex: 7F77DD).', field: 'primary_color' }
  return null
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createUnit(
  _prev: UnitFormResult | null,
  formData: FormData,
): Promise<UnitFormResult> {
  const session = await requireAdmin()
  if (session.role !== 'master') return { success: false, error: 'Sem permissão.' }

  const data  = parseFormData(formData)
  const error = validate(data)
  if (error) return error

  const supabase = createServerSupabaseClient()

  // Verifica unicidade do slug
  const { data: dup } = await supabase
    .from('units').select('id').eq('slug', data.slug).is('deleted_at', null).single()
  if (dup) return { success: false, error: 'Este slug já está em uso. Escolha outro.', field: 'slug' }

  // active é sempre derivado de unit_status — nunca do FormData
  const active = data.unit_status === 'active'

  const { error: dbErr } = await supabase.from('units').insert({
    name: data.name, slug: data.slug, city: data.city, state: data.state,
    contact_name: data.contact_name, contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    unit_status: data.unit_status as 'active' | 'paused' | 'cancelled',
    billing_plan: data.billing_plan as 'gratis' | 'piloto' | 'mensal' | 'anual' | 'franquia',
    plan: data.plan as 'basic' | 'standard' | 'premium',
    logo_url: data.logo_url, primary_color: data.primary_color,
    notes: data.notes, active,
  })

  if (dbErr) {
    console.error('[createUnit]', dbErr.message)
    if (dbErr.code === '23505') return { success: false, error: 'Este slug já está em uso.', field: 'slug' }
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  redirect('/admin/unidades?created=1')
}

export async function updateUnit(
  unitId: string,
  _prev: UnitFormResult | null,
  formData: FormData,
): Promise<UnitFormResult> {
  const session = await requireAdmin()
  if (session.role !== 'master') return { success: false, error: 'Sem permissão.' }

  const data  = parseFormData(formData)
  const error = validate(data)
  if (error) return error

  const supabase = createServerSupabaseClient()

  // Verifica unicidade do slug — ignora a própria unidade
  const { data: dup } = await supabase
    .from('units').select('id').eq('slug', data.slug).neq('id', unitId).is('deleted_at', null).single()
  if (dup) return { success: false, error: 'Este slug já está em uso. Escolha outro.', field: 'slug' }

  const active = data.unit_status === 'active'

  const { error: dbErr } = await supabase.from('units').update({
    name: data.name, slug: data.slug, city: data.city, state: data.state,
    contact_name: data.contact_name, contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    unit_status: data.unit_status as 'active' | 'paused' | 'cancelled',
    billing_plan: data.billing_plan as 'gratis' | 'piloto' | 'mensal' | 'anual' | 'franquia',
    plan: data.plan as 'basic' | 'standard' | 'premium',
    logo_url: data.logo_url, primary_color: data.primary_color,
    notes: data.notes, active,
  }).eq('id', unitId)

  if (dbErr) {
    console.error('[updateUnit]', dbErr.message)
    if (dbErr.code === '23505') return { success: false, error: 'Este slug já está em uso.', field: 'slug' }
    return { success: false, error: 'Erro ao salvar. Tente novamente.' }
  }

  redirect('/admin/unidades?updated=1')
}
