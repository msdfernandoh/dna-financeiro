// =============================================================================
// /admin/unidades/nova — Criar nova unidade (master only)
// =============================================================================

import { redirect }     from 'next/navigation'
import { requireAdmin } from '@/lib/supabase/admin'
import { AdminShell }   from '@/app/admin/_AdminShell'
import { UnitForm }     from '../_UnitForm'
import { createUnit }   from '../actions'

export default async function NovaUnidadePage() {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

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
      />
    </AdminShell>
  )
}
