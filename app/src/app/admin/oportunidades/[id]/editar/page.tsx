// =============================================================================
// /admin/oportunidades/[id]/editar — Editar oportunidade
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • unit_admin só edita opps da sua própria unidade (query com .eq('unit_id'))
//   • master pode editar qualquer opp (sem filtro de unidade)
// =============================================================================

import { notFound }                 from 'next/navigation'
import { requireAdmin }             from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }               from '@/app/admin/_AdminShell'
import { OppFormClient }            from '../../_OppFormClient'
import { updateOpportunity }        from '../../actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarOportunidadePage({ params }: Props) {
  const { id }   = await params
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()

  // Validar id
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) notFound()

  // unit_viewer não pode editar
  if (session.role === 'unit_viewer') {
    return (
      <AdminShell
        session={session}
        title="Editar oportunidade"
        back={{ href: '/admin/oportunidades', label: 'Oportunidades' }}
      >
        <p style={{ color: '#888', fontSize: 14 }}>
          Você não tem permissão para editar oportunidades.
        </p>
      </AdminShell>
    )
  }

  // Buscar a opp (com filtro de unidade para unit_admin)
  let query = supabase
    .from('opportunities')
    .select('id, unit_id, type, title, description, cta_label, cta_url, target_dream, featured, active, position, starts_at, ends_at')
    .eq('id', id)
    .is('deleted_at', null)

  if (session.role !== 'master' && session.unitId) {
    query = query.eq('unit_id', session.unitId)
  }

  const { data: opp } = await query.single()
  if (!opp) notFound()

  // Units (apenas para master)
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

  // Bind do id na action
  const boundAction = updateOpportunity.bind(null, id)

  return (
    <AdminShell
      session={session}
      title="Editar oportunidade"
      back={{ href: '/admin/oportunidades', label: 'Oportunidades' }}
    >
      <OppFormClient
        action={boundAction}
        initial={{
          id:           opp.id,
          unit_id:      opp.unit_id,
          type:         opp.type,
          title:        opp.title,
          description:  opp.description,
          cta_label:    opp.cta_label,
          cta_url:      opp.cta_url,
          target_dream: opp.target_dream,
          featured:     opp.featured,
          active:       opp.active,
          position:     opp.position,
          starts_at:    opp.starts_at ?? null,
          ends_at:      opp.ends_at   ?? null,
        }}
        units={units}
        isMaster={session.role === 'master'}
        unitId={session.unitId ?? undefined}
        mode="edit"
      />
    </AdminShell>
  )
}
