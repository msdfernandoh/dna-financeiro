// =============================================================================
// /admin/configuracoes/caminhos-sonho/[id]/editar — Editar caminho
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • Apenas master pode editar
//   • unit_id NULL = global; preenchido = override por unidade
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

  const [{ data: path }, { data: rawUnits }] = await Promise.all([
    supabase
      .from('dream_path_settings')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('units')
      .select('id, name, slug')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name'),
  ])

  if (!path) notFound()

  const units = rawUnits ?? []

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
          unit_id:                path.unit_id,
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
          calculation_mode:                    path.calculation_mode,
          promo_active:                        path.promo_active,
          promo_label:                         path.promo_label,
          promo_starts_at:                     path.promo_starts_at,
          promo_ends_at:                       path.promo_ends_at,
          promo_admin_fee_rate:                path.promo_admin_fee_rate,
          promo_installment_amount:            path.promo_installment_amount,
          promo_reduced_installment_amount:    path.promo_reduced_installment_amount,
        }}
        mode="edit"
        units={units}
      />
    </AdminShell>
  )
}
