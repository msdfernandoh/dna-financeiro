// =============================================================================
// /admin/unidades/nova — Criar nova unidade (master only)
// =============================================================================

import { redirect }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { UnitForm }                   from '../_UnitForm'
import { createUnit }                 from '../actions'

export default async function NovaUnidadePage() {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  // Busca unidades cidade para o select de unidade pai
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('units')
    .select('id, name, city, state')
    .eq('unit_type', 'city')
    .eq('active', true)
    .is('deleted_at', null)
    .order('name')
  const cityUnits = data ?? []

  return (
    <AdminShell
      session={session}
      title="Nova unidade"
      back={{ href: '/admin/unidades', label: 'Unidades' }}
    >
      <UnitForm
        action={createUnit}
        mode="create"
        backHref="/admin/unidades"
        cityUnits={cityUnits}
      />
    </AdminShell>
  )
}
