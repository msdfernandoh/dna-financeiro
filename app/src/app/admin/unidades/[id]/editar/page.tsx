// =============================================================================
// /admin/unidades/[id]/editar — Editar unidade (master only)
//
// SEGURANÇA:
//   • requireAdmin() → master only
//   • updateUnit recebe unitId no servidor — nunca do FormData
// =============================================================================

import { notFound, redirect } from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { UnitForm }                   from '../../_UnitForm'
import { updateUnit }                 from '../../actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarUnidadePage({ params }: Props) {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: unit } = await supabase
    .from('units')
    .select('id, name, slug, city, state, unit_status, billing_plan, plan, logo_url, primary_color, contact_name, contact_email, contact_phone, notes')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!unit) notFound()

  // Vincula o Server Action com o unitId resolvido no servidor
  const boundUpdate = updateUnit.bind(null, unit.id)

  return (
    <AdminShell
      session={session}
      title={unit.name}
      back={{ href: '/admin/unidades', label: 'Unidades' }}
    >
      <UnitForm
        action={boundUpdate}
        mode="edit"
        backHref="/admin/unidades"
        defaultValues={{
          name:          unit.name,
          slug:          unit.slug,
          city:          unit.city,
          state:         unit.state,
          contact_name:  unit.contact_name,
          contact_email: unit.contact_email,
          contact_phone: unit.contact_phone ?? '',
          unit_status:   unit.unit_status,
          billing_plan:  unit.billing_plan,
          plan:          unit.plan,
          logo_url:      unit.logo_url ?? '',
          primary_color: unit.primary_color ?? '',
          notes:         unit.notes ?? '',
        }}
      />
    </AdminShell>
  )
}
