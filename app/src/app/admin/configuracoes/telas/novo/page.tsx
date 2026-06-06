// =============================================================================
// /admin/configuracoes/telas/novo — Adicionar bloco
// =============================================================================

import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { BlockFormClient }            from '../_BlockFormClient'
import { createBlock }                from '../actions'
import { C }                          from '@/app/components/ui'
import type { PathSettingOption, UnitOption } from '../_BlockFormClient'

interface Props {
  searchParams: Promise<{ page?: string; unit_id?: string }>
}

export default async function NovoBlockPage({ searchParams }: Props) {
  const params  = await searchParams
  const session = await requireAdmin()

  if (session.role === 'unit_viewer') {
    return (
      <AdminShell session={session} title="Adicionar bloco"
        back={{ href: '/admin/configuracoes/telas', label: 'Telas' }}>
        <p style={{ color: C.textSec, fontSize: 14 }}>Sem permissão.</p>
      </AdminShell>
    )
  }

  const supabase  = createServerSupabaseClient()
  const initPage  = params.page    || 'diagnostic'
  const initUnit  = params.unit_id || ''

  // Buscar unidades (master)
  let units: UnitOption[] = []
  if (session.role === 'master') {
    const { data } = await supabase
      .from('units')
      .select('id, name')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name')
    units = data ?? []
  }

  // Buscar dream_path_settings para vínculos de caminho
  const { data: psRaw } = await supabase
    .from('dream_path_settings')
    .select('id, label, dream_type, path_type')
    .eq('active', true)
    .is('deleted_at', null)
    .order('sort_order')
  const pathSettings: PathSettingOption[] = (psRaw ?? []).map(p => ({
    id:         p.id,
    label:      p.label,
    dream_type: p.dream_type,
    path_type:  p.path_type,
  }))

  const backHref = `/admin/configuracoes/telas?page=${initPage}${initUnit ? `&unit_id=${initUnit}` : ''}`

  return (
    <AdminShell
      session={session}
      title="Adicionar bloco"
      back={{ href: backHref, label: 'Configuração de Telas' }}
    >
      <BlockFormClient
        action={createBlock}
        initial={{ page: initPage, unit_id: initUnit || null, active: true, sort_order: 10 }}
        mode="create"
        backHref={backHref}
        units={units}
        pathSettings={pathSettings}
        isMaster={session.role === 'master'}
      />
    </AdminShell>
  )
}
