// =============================================================================
// /admin/oportunidades/nova — Criar oportunidade
// =============================================================================

import { requireAdmin }             from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }               from '@/app/admin/_AdminShell'
import { OppFormClient }            from '../_OppFormClient'
import { createOpportunity }        from '../actions'

export default async function NovaOportunidadePage() {
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()

  // unit_viewer não pode criar
  if (session.role === 'unit_viewer') {
    return (
      <AdminShell
        session={session}
        title="Nova oportunidade"
        back={{ href: '/admin/oportunidades', label: 'Oportunidades' }}
      >
        <p style={{ color: '#888', fontSize: 14 }}>
          Você não tem permissão para criar oportunidades.
        </p>
      </AdminShell>
    )
  }

  // Units (apenas para master — unit_admin usa o próprio unitId)
  let units: { id: string; name: string }[] = []
  if (session.role === 'master') {
    const { data } = await supabase
      .from('units')
      .select('id, name')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name')
    units = data ?? []
  }

  return (
    <AdminShell
      session={session}
      title="Nova oportunidade"
      back={{ href: '/admin/oportunidades', label: 'Oportunidades' }}
    >
      <OppFormClient
        action={createOpportunity}
        units={units}
        isMaster={session.role === 'master'}
        unitId={session.unitId ?? undefined}
        mode="create"
      />
    </AdminShell>
  )
}
