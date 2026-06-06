// =============================================================================
// /admin/configuracoes/telas/[id]/editar — Editar bloco
// =============================================================================

import { notFound }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { BlockFormClient }            from '../../_BlockFormClient'
import { updateBlock }                from '../../actions'
import { C }                          from '@/app/components/ui'
import type { PathSettingOption, UnitOption, BlockFormInitial } from '../../_BlockFormClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarBlockPage({ params }: Props) {
  const { id }   = await params
  const session  = await requireAdmin()

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) notFound()

  if (session.role === 'unit_viewer') {
    return (
      <AdminShell session={session} title="Editar bloco"
        back={{ href: '/admin/configuracoes/telas', label: 'Telas' }}>
        <p style={{ color: C.textSec, fontSize: 14 }}>Sem permissão.</p>
      </AdminShell>
    )
  }

  const supabase = createServerSupabaseClient()

  // Buscar bloco
  const { data: block } = await supabase
    .from('page_blocks')
    .select('id, unit_id, page, block_type, active, sort_order, path_settings_id, config')
    .eq('id', id)
    .single()

  if (!block) notFound()

  const b = block as {
    id: string; unit_id: string | null; page: string; block_type: string
    active: boolean; sort_order: number; path_settings_id: string | null
    config: Record<string, unknown>
  }

  // Segurança: unit_admin só edita seus próprios blocos
  if (session.role !== 'master' && b.unit_id !== session.unitId) notFound()

  // Buscar unidades (master)
  let units: UnitOption[] = []
  if (session.role === 'master') {
    const { data } = await supabase
      .from('units').select('id, name').eq('active', true).is('deleted_at', null).order('name')
    units = data ?? []
  }

  // Buscar dream_path_settings
  const { data: psRaw } = await supabase
    .from('dream_path_settings')
    .select('id, label, dream_type, path_type')
    .eq('active', true).is('deleted_at', null).order('sort_order')
  const pathSettings: PathSettingOption[] = (psRaw ?? []).map(p => ({
    id: p.id, label: p.label, dream_type: p.dream_type, path_type: p.path_type,
  }))

  // Desempacotar config para os campos do form
  const cfg = b.config ?? {}
  const initial: BlockFormInitial = {
    id:              b.id,
    unit_id:         b.unit_id,
    page:            b.page,
    block_type:      b.block_type,
    active:          b.active,
    sort_order:      b.sort_order,
    path_settings_id: b.path_settings_id,
    // path blocks
    show_full_installment:    (cfg.show_full_installment    as boolean | undefined) ?? true,
    show_reduced_installment: (cfg.show_reduced_installment as boolean | undefined) ?? true,
    show_down_payment:        (cfg.show_down_payment        as boolean | undefined) ?? true,
    show_term:                (cfg.show_term                as boolean | undefined) ?? true,
    show_total_cost:          (cfg.show_total_cost          as boolean | undefined) ?? false,
    // smart_guidance
    gap_threshold:       (cfg.gap_threshold       as number | undefined) ?? null,
    suggest_alternative: (cfg.suggest_alternative as boolean | undefined) ?? true,
    alternative_percent: (cfg.alternative_percent as number | undefined) ?? null,
    extra_income_url:    (cfg.extra_income_url    as string | undefined) ?? null,
    adjust_dream_url:    (cfg.adjust_dream_url    as string | undefined) ?? null,
    // comparison
    path_a:      (cfg.path_a as string | undefined) ?? null,
    path_b:      (cfg.path_b as string | undefined) ?? null,
    comp_title:  (cfg.title  as string | undefined) ?? null,
    // opportunity
    opp_mode:      (cfg.mode          as string | undefined) ?? 'fixed',
    rotation_days: (cfg.rotation_days as number | undefined) ?? null,
    cta_url:       (cfg.cta_url       as string | undefined) ?? null,
    api_url:       (cfg.api_url       as string | undefined) ?? null,
  }

  const backHref = `/admin/configuracoes/telas?page=${b.page}${b.unit_id ? `&unit_id=${b.unit_id}` : ''}`
  const boundUpdate = updateBlock.bind(null, id)

  return (
    <AdminShell
      session={session}
      title="Editar bloco"
      back={{ href: backHref, label: 'Configuração de Telas' }}
    >
      <BlockFormClient
        action={boundUpdate}
        initial={initial}
        mode="edit"
        backHref={backHref}
        units={units}
        pathSettings={pathSettings}
        isMaster={session.role === 'master'}
      />
    </AdminShell>
  )
}
