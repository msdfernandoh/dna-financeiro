// =============================================================================
// /admin/usuarios/novo — Criar novo usuário admin (master only)
// =============================================================================

import { redirect }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { UserForm }                   from '../_UserForm'
import { createAdminUser }            from '../actions'

export default async function NovoUsuarioPage() {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const supabase = createServerSupabaseClient()

  const { data: rawUnits } = await supabase
    .from('units')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  const units = (rawUnits ?? []).map(u => ({ id: u.id, name: u.name }))

  return (
    <AdminShell
      session={session}
      title="Novo usuário"
      back={{ href: '/admin/usuarios', label: 'Usuários' }}
    >
      <UserForm
        action={createAdminUser}
        mode="create"
        backHref="/admin/usuarios"
        units={units}
      />
    </AdminShell>
  )
}
