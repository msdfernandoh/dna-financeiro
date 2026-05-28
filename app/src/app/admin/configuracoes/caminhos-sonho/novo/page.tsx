// =============================================================================
// /admin/configuracoes/caminhos-sonho/novo — Criar caminho (+ duplicar)
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • Apenas master pode acessar
//
// ?duplicate=<id> → busca o registro e pré-preenche o formulário (sem o id)
// =============================================================================

import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { PathFormClient }             from '../_PathFormClient'
import { createPath }                 from '../actions'
import type { PathFormInitial }       from '../_PathFormClient'
import { C }                          from '@/app/components/ui'

interface Props {
  searchParams: Promise<{ duplicate?: string }>
}

export default async function NovoCaminhoPage({ searchParams }: Props) {
  const params  = await searchParams
  const session = await requireAdmin()

  if (session.role !== 'master') {
    return (
      <AdminShell
        session={session}
        title="Novo caminho"
        back={{ href: '/admin/configuracoes/caminhos-sonho', label: 'Caminhos do Sonho' }}
      >
        <p style={{ color: C.textSec, fontSize: 14 }}>
          Apenas o master pode criar caminhos do sonho.
        </p>
      </AdminShell>
    )
  }

  // ── Duplicar? ──────────────────────────────────────────────────────────────

  let initial: PathFormInitial = {}
  let isDuplicate = false

  const duplicateId = params.duplicate?.trim()

  if (duplicateId && /^[0-9a-f-]{36}$/.test(duplicateId)) {
    const supabase = createServerSupabaseClient()
    const { data: source } = await supabase
      .from('dream_path_settings')
      .select('*')
      .eq('id', duplicateId)
      .is('deleted_at', null)
      .single()

    if (source) {
      isDuplicate = true
      // Pré-preenche tudo menos o id — label ganha " (cópia)"
      initial = {
        path_type:              source.path_type,
        dream_type:             source.dream_type,
        dream_subtype:          source.dream_subtype,
        label:                  `${source.label} (cópia)`,
        description:            source.description,
        sort_order:             source.sort_order,
        active:                 false,   // cópia começa inativa
        show_capital_gain:      source.show_capital_gain,
        show_total_cost:        source.show_total_cost,
        default_amount:                      source.default_amount,
        full_installment_amount:             source.full_installment_amount,
        reduced_installment_amount:          source.reduced_installment_amount,
        term_months:                         source.term_months,
        group_size:                          source.group_size,
        draws_per_month:                     source.draws_per_month,
        programmed_contemplation_month:      source.programmed_contemplation_month,
        anticipation_start_month:            source.anticipation_start_month,
        anticipation_installments:           source.anticipation_installments,
        required_paid_installments_for_credit: source.required_paid_installments_for_credit,
        annual_return_rate:                  source.annual_return_rate,
        monthly_interest_rate:               source.monthly_interest_rate,
        annual_interest_rate:                source.annual_interest_rate,
        admin_fee_rate:                      source.admin_fee_rate,
        admin_fee_base:                      source.admin_fee_base,
        down_payment_percent:                source.down_payment_percent,
        bid_percent:                         source.bid_percent,
        average_letter_premium_percent:      source.average_letter_premium_percent,
      }
    }
  }

  return (
    <AdminShell
      session={session}
      title={isDuplicate ? 'Duplicar caminho' : 'Novo caminho'}
      back={{ href: '/admin/configuracoes/caminhos-sonho', label: 'Caminhos do Sonho' }}
    >
      {isDuplicate && (
        <div style={{
          background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400E',
        }}>
          📋 Duplicando registro. A cópia começa <strong>inativa</strong> — ative após revisar.
        </div>
      )}

      <PathFormClient
        action={createPath}
        initial={initial}
        mode="create"
      />
    </AdminShell>
  )
}
