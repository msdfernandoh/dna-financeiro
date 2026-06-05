// =============================================================================
// /admin/unidades/[id]/editar — Editar unidade (master only)
//
// SEGURANÇA:
//   • requireAdmin() → master only
//   • updateUnit recebe unitId no servidor — nunca do FormData
// =============================================================================

import { notFound, redirect }             from 'next/navigation'
import { requireAdmin }                   from '@/lib/supabase/admin'
import { createServerSupabaseClient }     from '@/lib/supabase/server'
import { AdminShell }                     from '@/app/admin/_AdminShell'
import { UnitForm }                       from '../../_UnitForm'
import { updateUnit }                     from '../../actions'
import { C }                              from '@/app/components/ui'

interface Props {
  params: Promise<{ id: string }>
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default async function EditarUnidadePage({ params }: Props) {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const { id } = await params
  const supabase = createServerSupabaseClient()

  // ── Buscar unidade com novos campos ─────────────────────────────────────────
  const { data: unit } = await supabase
    .from('units')
    .select(`
      id, name, slug, city, state, unit_status, billing_plan, plan,
      logo_url, primary_color, contact_name, contact_email, contact_phone, notes,
      unit_type, parent_unit_id, allowed_blocks
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!unit) notFound()

  // ── Buscar todas as unidades cidade para o select de pai ──────────────────
  const { data: cityUnitsRaw } = await supabase
    .from('units')
    .select('id, name, city, state')
    .eq('unit_type', 'city')
    .eq('active', true)
    .is('deleted_at', null)
    .neq('id', id)         // não pode ser pai de si mesmo
    .order('name')
  const cityUnits = cityUnitsRaw ?? []

  // ── Stats de leads ────────────────────────────────────────────────────────
  // Leads diretamente nesta unidade (sem consultor, para city)
  const { count: leadsDirectCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', id)
    .is('deleted_at', null)

  // Para unidades cidade: leads nos consultores filhos
  const { count: leadsConsultantCount } = unit.unit_type === 'city'
    ? await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .in('unit_id', (
          await supabase
            .from('units')
            .select('id')
            .eq('parent_unit_id', id)
            .is('deleted_at', null)
            .then(r => r.data?.map(u => u.id) ?? [])
        ))
        .is('deleted_at', null)
    : { count: null }

  // Consultores filhos (só para cidades)
  const { count: consultantCount } = unit.unit_type === 'city'
    ? await supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('parent_unit_id', id)
        .is('deleted_at', null)
    : { count: null }

  // Negócios fechados desta unidade
  const { count: dealsCount, data: dealsSums } = await supabase
    .from('deals')
    .select('sale_amount, gain_amount')
    .eq('unit_id', id)
    .eq('status', 'won')

  const totalSales  = (dealsSums ?? []).reduce((s, d) => s + (d.sale_amount ?? 0), 0)
  const totalGain   = (dealsSums ?? []).reduce((s, d) => s + (d.gain_amount  ?? 0), 0)

  // ── Bind da action ────────────────────────────────────────────────────────
  const boundUpdate = updateUnit.bind(null, unit.id)

  return (
    <AdminShell
      session={session}
      title={unit.name}
      back={{ href: '/admin/unidades', label: 'Unidades' }}
    >

      {/* ── Stats da unidade ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: unit.unit_type === 'city'
          ? 'repeat(4, 1fr)'
          : 'repeat(3, 1fr)',
        gap: 8, marginBottom: 16,
      }}>
        {/* Leads diretos (sem consultor para city, total para consultant) */}
        <StatCard
          label={unit.unit_type === 'city' ? 'Sem consultor' : 'Leads'}
          value={String(leadsDirectCount ?? 0)}
          color={unit.unit_type === 'city' && (leadsDirectCount ?? 0) > 0 ? C.amberDark : C.purpleDeep}
          bg={unit.unit_type === 'city' && (leadsDirectCount ?? 0) > 0 ? C.amberBg : C.purpleBg}
          hint={unit.unit_type === 'city' ? 'Podem ser direcionados' : 'Total no app'}
        />

        {/* Leads em consultores (só city) */}
        {unit.unit_type === 'city' && (
          <StatCard
            label="Com consultor"
            value={String(leadsConsultantCount ?? 0)}
            color={C.greenDark}
            bg={C.greenBg}
            hint="Em consultores filhos"
          />
        )}

        {/* Consultores filhos (só city) */}
        {unit.unit_type === 'city' && (
          <StatCard
            label="Consultores"
            value={String(consultantCount ?? 0)}
            color={C.purpleDeep}
            bg={C.purpleBg}
            hint="Vinculados a esta cidade"
          />
        )}

        {/* Negócios fechados */}
        <StatCard
          label="Negócios fechados"
          value={String(dealsCount ?? 0)}
          color={C.greenDark}
          bg={C.greenBg}
          hint={totalSales > 0 ? `${fmtBRL(totalSales)} vendido` : 'Nenhum ainda'}
        />

        {/* Ganho total */}
        {totalGain > 0 && (
          <StatCard
            label="Ganho total"
            value={fmtBRL(totalGain)}
            color={C.amberDark}
            bg={C.amberBg}
            hint="Comissões registradas"
          />
        )}
      </div>

      {/* Link rápido para leads sem consultor (city only) */}
      {unit.unit_type === 'city' && (leadsDirectCount ?? 0) > 0 && (
        <div style={{
          background: C.amberBg, borderRadius: 10,
          padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: `1px solid ${C.amber}30`,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.amberDark }}>
              ⚡ {leadsDirectCount} lead{leadsDirectCount !== 1 ? 's' : ''} sem consultor
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.amberDark }}>
              Esses leads podem ser direcionados para um consultor via lista de leads.
            </p>
          </div>
          <a
            href={`/admin/leads?unit_id=${id}`}
            style={{
              fontSize: 12, fontWeight: 600, color: C.amberDark,
              textDecoration: 'none', whiteSpace: 'nowrap',
              padding: '6px 12px', borderRadius: 8, background: '#fff',
              border: `1px solid ${C.amber}40`,
            }}
          >
            Ver leads →
          </a>
        </div>
      )}

      {/* ── Formulário ── */}
      <UnitForm
        action={boundUpdate}
        mode="edit"
        backHref="/admin/unidades"
        cityUnits={cityUnits}
        defaultValues={{
          name:           unit.name,
          slug:           unit.slug,
          city:           unit.city,
          state:          unit.state,
          contact_name:   unit.contact_name,
          contact_email:  unit.contact_email,
          contact_phone:  unit.contact_phone ?? '',
          unit_status:    unit.unit_status,
          billing_plan:   unit.billing_plan,
          plan:           unit.plan,
          logo_url:       unit.logo_url ?? '',
          primary_color:  unit.primary_color ?? '',
          notes:          unit.notes ?? '',
          unit_type:      unit.unit_type ?? 'city',
          parent_unit_id: unit.parent_unit_id ?? null,
          allowed_blocks: unit.allowed_blocks ?? null,
        }}
      />
    </AdminShell>
  )
}

// ── Sub-componente ────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, bg, hint,
}: {
  label: string; value: string; color: string; bg: string; hint: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '10px 12px',
      border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color, opacity: 0.7, marginTop: 2 }}>{hint}</div>
    </div>
  )
}
