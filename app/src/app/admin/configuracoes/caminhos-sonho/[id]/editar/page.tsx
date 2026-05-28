// =============================================================================
// /admin/configuracoes/caminhos-sonho/[id]/editar — Editar caminho
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • Apenas master pode editar
//   • dream_path_settings é tabela global (sem unit_id)
// =============================================================================

import { notFound }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { PathFormClient }             from '../../_PathFormClient'
import { updatePath }                 from '../../actions'
import { C }                          from '@/app/components/ui'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarCaminhoPage({ params }: Props) {
  const { id }   = await params
  const session  = await requireAdmin()

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) notFound()

  if (session.role !== 'master') {
    return (
      <AdminShell
        session={session}
        title="Editar caminho"
        back={{ href: '/admin/configuracoes/caminhos-sonho', label: 'Caminhos do Sonho' }}
      >
        <p style={{ color: C.textSec, fontSize: 14 }}>
          Apenas o master pode editar caminhos do sonho.
        </p>
      </AdminShell>
    )
  }

  const supabase = createServerSupabaseClient()

  const { data: path } = await supabase
    .from('dream_path_settings')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!path) notFound()

  const boundAction = updatePath.bind(null, id)

  return (
    <AdminShell
      session={session}
      title={`Editar: ${path.label}`}
      back={{ href: '/admin/configuracoes/caminhos-sonho', label: 'Caminhos do Sonho' }}
    >
      <PathFormClient
        action={boundAction}
        initial={{
          path_type:              path.path_type,
          dream_type:             path.dream_type,
          dream_subtype:          path.dream_subtype,
          label:                  path.label,
          description:            path.description,
          sort_order:             path.sort_order,
          active:                 path.active,
          show_capital_gain:      path.show_capital_gain,
          show_total_cost:        path.show_total_cost,
          default_amount:                      path.default_amount,
          full_installment_amount:             path.full_installment_amount,
          reduced_installment_amount:          path.reduced_installment_amount,
          term_months:                         path.term_months,
          group_size:                          path.group_size,
          draws_per_month:                     path.draws_per_month,
          programmed_contemplation_month:      path.programmed_contemplation_month,
          anticipation_start_month:            path.anticipation_start_month,
          anticipation_installments:           path.anticipation_installments,
          required_paid_installments_for_credit: path.required_paid_installments_for_credit,
          annual_return_rate:                  path.annual_return_rate,
          monthly_interest_rate:               path.monthly_interest_rate,
          annual_interest_rate:                path.annual_interest_rate,
          admin_fee_rate:                      path.admin_fee_rate,
          admin_fee_base:                      path.admin_fee_base,
          down_payment_percent:                path.down_payment_percent,
          bid_percent:                         path.bid_percent,
          average_letter_premium_percent:      path.average_letter_premium_percent,
        }}
        mode="edit"
      />
    </AdminShell>
  )
}
