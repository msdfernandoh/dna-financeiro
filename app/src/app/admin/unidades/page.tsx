// =============================================================================
// /admin/unidades — Lista de Unidades (master only)
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • Apenas master pode acessar — outros são redirecionados
//   • Dados internos (notes, billing_plan) nunca expostos fora desta página
// =============================================================================

import { redirect }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { C }                          from '@/app/components/ui'
import { CopyButton }                 from './_CopyButton'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type UnitRow = {
  id:           string
  name:         string
  slug:         string
  city:         string
  state:        string
  unit_status:  string
  billing_plan: string
  plan:         string
  contact_name: string
  contact_email:string
  active:       boolean
  created_at:   string
}

// ── Metadados ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: '✅ Ativa',     bg: C.greenBg,     color: C.greenDark  },
  paused:    { label: '⏸️ Pausada',   bg: C.amberBg,     color: C.amberDark  },
  cancelled: { label: '❌ Cancelada', bg: C.coralBg,     color: C.coralDark  },
}

const BILLING_META: Record<string, { label: string; bg: string; color: string }> = {
  gratis:   { label: 'Grátis',   bg: C.bgSecondary, color: C.textSec   },
  piloto:   { label: 'Piloto',   bg: C.purpleBg,    color: C.purpleDeep},
  mensal:   { label: 'Mensal',   bg: C.greenBg,     color: C.greenDark  },
  anual:    { label: 'Anual',    bg: C.amberBg,     color: C.amberDark  },
  franquia: { label: 'Franquia', bg: '#FDF4FF',     color: '#7E22CE'   },
}

const PLAN_META: Record<string, { label: string }> = {
  basic:    { label: 'Basic'    },
  standard: { label: 'Standard' },
  premium:  { label: 'Premium'  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AdminUnidadesPage({ searchParams }: Props) {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const sp = await searchParams
  const toast = sp.created ? '✓ Unidade criada com sucesso!'
    : sp.updated ? '✓ Unidade atualizada!'
    : null

  const supabase = createServerSupabaseClient()

  // Busca unidades + contagens em paralelo
  const [{ data: rawUnits }, { data: leadCounts }, { data: adminCounts }] = await Promise.all([
    supabase
      .from('units')
      .select('id, name, slug, city, state, unit_status, billing_plan, plan, contact_name, contact_email, active, created_at')
      .is('deleted_at', null)
      .order('name'),
    // Contagem de leads por unidade
    supabase
      .from('leads')
      .select('unit_id')
      .is('deleted_at', null),
    // Contagem de admins por unidade
    supabase
      .from('profiles')
      .select('unit_id')
      .not('unit_id', 'is', null),
  ])

  const units: UnitRow[] = (rawUnits ?? []) as UnitRow[]

  // Mapas de contagem
  const leadsPerUnit: Record<string, number> = {}
  for (const row of leadCounts ?? []) {
    if (!row.unit_id) continue
    leadsPerUnit[row.unit_id] = (leadsPerUnit[row.unit_id] ?? 0) + 1
  }

  const adminsPerUnit: Record<string, number> = {}
  for (const row of adminCounts ?? []) {
    if (!row.unit_id) continue
    adminsPerUnit[row.unit_id] = (adminsPerUnit[row.unit_id] ?? 0) + 1
  }

  // KPIs
  const kpi = {
    total:     units.length,
    active:    units.filter(u => u.unit_status === 'active').length,
    paused:    units.filter(u => u.unit_status === 'paused').length,
    cancelled: units.filter(u => u.unit_status === 'cancelled').length,
  }

  return (
    <AdminShell session={session} title="Unidades">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          background: C.greenBg, borderRadius: 10,
          padding: '10px 14px', marginBottom: 16,
          color: C.greenDark, fontSize: 13, fontWeight: 500,
        }}>
          {toast}
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12,
        marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
            Unidades
          </h1>
          <p style={{ fontSize: 12, color: C.textSec, margin: '3px 0 0' }}>
            {kpi.total} cadastradas · {kpi.active} ativas
          </p>
        </div>
        <a href="/admin/unidades/nova" style={{
          background: C.purple, color: '#fff', textDecoration: 'none',
          borderRadius: 10, padding: '9px 16px',
          fontSize: 13, fontWeight: 600, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + Nova unidade
        </a>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <KpiChip emoji="🏢" label="Total"     value={kpi.total}     bg="#F8F8F8"   color={C.text}      />
        <KpiChip emoji="✅" label="Ativas"    value={kpi.active}    bg={C.greenBg} color={C.greenDark} />
        <KpiChip emoji="⏸️" label="Pausadas"  value={kpi.paused}    bg={C.amberBg} color={C.amberDark} />
        <KpiChip emoji="❌" label="Canceladas" value={kpi.cancelled} bg={C.coralBg} color={C.coralDark} />
      </div>

      {/* ── Lista ── */}
      {units.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
          padding: '40px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>🏢</p>
          <p style={{ fontSize: 14, color: C.text, fontWeight: 500, margin: '0 0 16px' }}>
            Nenhuma unidade cadastrada.
          </p>
          <a href="/admin/unidades/nova" style={{
            display: 'inline-block', background: C.purple, color: '#fff',
            borderRadius: 10, padding: '9px 18px',
            fontSize: 13, fontWeight: 500, textDecoration: 'none',
          }}>
            + Criar primeira unidade
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {units.map(unit => {
            const stMeta   = STATUS_META[unit.unit_status]   ?? STATUS_META.cancelled
            const billMeta = BILLING_META[unit.billing_plan] ?? BILLING_META.gratis
            const planMeta = PLAN_META[unit.plan]            ?? PLAN_META.basic
            const nLeads   = leadsPerUnit[unit.id]  ?? 0
            const nAdmins  = adminsPerUnit[unit.id] ?? 0

            return (
              <div key={unit.id} style={{
                background: '#fff', borderRadius: 14,
                border: `0.5px solid ${unit.unit_status === 'active' ? C.border : '#E5E7EB'}`,
                overflow: 'hidden',
                opacity: unit.unit_status === 'cancelled' ? 0.75 : 1,
              }}>
                {/* ── Barra de status ── */}
                <div style={{
                  background: stMeta.bg, padding: '5px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: stMeta.color }}>
                    {stMeta.label}
                  </span>
                  <span style={{ fontSize: 10, color: C.textTer }}>
                    desde {fmtDate(unit.created_at)}
                  </span>
                </div>

                {/* ── Corpo ── */}
                <div style={{ padding: '12px 14px' }}>

                  {/* Linha 1: badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                    <span style={{
                      background: billMeta.bg, color: billMeta.color,
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {billMeta.label}
                    </span>
                    <span style={{
                      background: C.bgSecondary, color: C.textSec,
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {planMeta.label}
                    </span>
                    <span style={{
                      background: nLeads > 0 ? C.purpleBg : C.bgSecondary,
                      color: nLeads > 0 ? C.purpleDeep : C.textSec,
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                    }}>
                      👥 {nLeads} lead{nLeads !== 1 ? 's' : ''}
                    </span>
                    <span style={{
                      background: nAdmins > 0 ? C.greenBg : C.bgSecondary,
                      color: nAdmins > 0 ? C.greenDark : C.textSec,
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                    }}>
                      👤 {nAdmins} admin{nAdmins !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Nome + cidade */}
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>
                    {unit.name}
                  </p>
                  <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 8px' }}>
                    📍 {unit.city}, {unit.state}
                  </p>

                  {/* Slug copiável */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: C.bgApp, borderRadius: 8, padding: '6px 10px',
                    marginBottom: 10,
                  }}>
                    <span style={{ fontSize: 11, color: C.textSec, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🔗 /{unit.slug}
                    </span>
                    <CopyButton text={`${unit.slug}`} label="Copiar slug" />
                  </div>

                  {/* Responsável */}
                  <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 10px' }}>
                    👤 {unit.contact_name} · {unit.contact_email}
                  </p>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a href={`/admin/unidades/${unit.id}/editar`} style={btnStyle}>
                      ✏️ Editar
                    </a>
                    <a
                      href={`/${unit.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...btnStyle, color: C.purpleDeep, borderColor: `${C.purple}40`, background: C.purpleBg }}
                    >
                      👁️ Ver no app
                    </a>
                    <a href={`/admin/leads?unit=${unit.id}`} style={btnStyle}>
                      👥 Ver leads
                    </a>
                    <a href={`/admin/usuarios?unit=${unit.id}`} style={btnStyle}>
                      👤 Ver usuários
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '5px 11px', fontSize: 11,
  textDecoration: 'none', color: C.textSec, background: '#fff',
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: 3,
  whiteSpace: 'nowrap',
}

function KpiChip({ emoji, label, value, bg, color }: {
  emoji: string; label: string; value: number; bg: string; color: string
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, border: `0.5px solid ${C.border}`,
      borderRadius: 10, padding: '7px 12px',
    }}>
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color, fontWeight: 500, marginTop: 1, opacity: 0.8 }}>{label}</div>
      </div>
    </div>
  )
}
