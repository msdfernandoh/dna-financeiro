// =============================================================================
// /admin/usuarios/[id]/editar — Editar usuário admin (master only)
//
// SEGURANÇA:
//   • requireAdmin() → master only
//   • updateAdminUser e resetAdminPassword recebem userId no servidor
//   • Nunca via FormData ou URL params não verificados
// =============================================================================

import { notFound, redirect }         from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { UserForm }                   from '../../_UserForm'
import { updateAdminUser, resetAdminPassword } from '../../actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarUsuarioPage({ params }: Props) {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const [{ data: profile }, { data: rawUnits }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, phone, role, unit_id, active')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('units')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ])

  if (!profile) notFound()

  const units = (rawUnits ?? []).map(u => ({ id: u.id, name: u.name }))

  // Vincula Server Actions com o userId resolvido no servidor
  const boundUpdate = updateAdminUser.bind(null, profile.id)
  const boundReset  = resetAdminPassword.bind(null, profile.id)

  return (
    <AdminShell
      session={session}
      title={profile.name}
      back={{ href: '/admin/usuarios', label: 'Usuários' }}
    >
      <UserForm
        action={boundUpdate}
        resetAction={boundReset}
        mode="edit"
        backHref="/admin/usuarios"
        units={units}
        defaultValues={{
          name:    profile.name,
          email:   profile.email,
          phone:   profile.phone ?? '',
          role:    profile.role,
          unit_id: profile.unit_id ?? '',
          active:  profile.active,
        }}
      />
    </AdminShell>
  )
}
