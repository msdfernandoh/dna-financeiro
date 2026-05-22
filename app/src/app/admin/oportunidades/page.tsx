// =============================================================================
// /admin/oportunidades — Lista de oportunidades (admin)
//
// SEGURANÇA:
//   • requireAdmin() valida sessão — redireciona se não autenticado
//   • unit_admin só vê opps da sua própria unidade
//   • master vê todas (filtro por unidade via URL)
//   • Filtros: type, active, unit_id — todos via URL params (sem body)
// =============================================================================

import { requireAdmin }             from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }               from '@/app/admin/_AdminShell'
import { toggleOppActive, toggleOppFeatured, deleteOpportunity } from './actions'
import { DeleteOppButton }          from './_DeleteButton'
import { C }                        from '@/app/components/ui'
import type { OppType, OppPeriodStatus } from '@/types/database'

// ── Helpers de período ────────────────────────────────────────────────────────

function getPeriodStatus(starts_at: string | null, ends_at: string | null): OppPeriodStatus {
  if (!starts_at && !ends_at) return 'no-period'
  const now = Date.now()
  if (ends_at && new Date(ends_at).getTime() < now) return 'expired'
  if (starts_at && new Date(starts_at).getTime() > now) return 'scheduled'
  return 'active'
}

const PERIOD_META: Record<OppPeriodStatus, { label: string; bg: string; color: string }> = {
  'no-period': { label: '∞ Sem período',  bg: '#F5F5F5',    color: '#888'    },
  'scheduled': { label: '🕐 Programada',  bg: '#EEF2FF',    color: '#4338CA' },
  'active':    { label: '🟢 Vigente',     bg: '#F0FDF4',    color: '#166534' },
  'expired':   { label: '⛔ Expirada',    bg: '#FEF2F2',    color: '#991B1B' },
}

// ── Metadados de tipo ─────────────────────────────────────────────────────────

const TYPE_META: Record<OppType, { label: string; emoji: string; bg: string; color: string }> = {
  event:     { label: 'Evento',      emoji: '📅', bg: C.purpleBg,    color: C.purpleDeep },
  course:    { label: 'Educação',    emoji: '📚', bg: C.greenBg,     color: C.greenDark  },
  challenge: { label: 'Desafio',     emoji: '🎯', bg: C.amberBg,     color: C.amberDark  },
  job:       { label: 'Renda extra', emoji: '💼', bg: C.purpleBg,    color: C.purpleDeep },
  banner:    { label: 'Banner',      emoji: '📣', bg: C.bgSecondary, color: C.textSec    },
  partner:   { label: 'Parceiro',    emoji: '🤝', bg: C.bgSecondary, color: C.textSec    },
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AdminOppsPage({ searchParams }: Props) {
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()
  const sp       = await searchParams

  // ── Filtros da URL ──
  const filterType   = sp.type   ?? ''
  const filterActive = sp.active ?? ''   // '1' | '0' | ''
  const filterPeriod = sp.period ?? ''   // 'no-period' | 'scheduled' | 'active' | 'expired' | ''
  const filterUnit   = session.role === 'master' ? (sp.unit ?? '') : (session.unitId ?? '')

  // ── Query de oportunidades ──
  let query = supabase
    .from('opportunities')
    .select('id, unit_id, type, title, featured, active, position, starts_at, ends_at, created_at')
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)

  if (filterUnit)   query = query.eq('unit_id', filterUnit)
  if (filterType)   query = query.eq('type', filterType)
  if (filterActive === '1') query = query.eq('active', true)
  if (filterActive === '0') query = query.eq('active', false)

  // unit_admin sempre filtrado pela sua unidade
  if (session.role !== 'master' && session.unitId) {
    query = query.eq('unit_id', session.unitId)
  }

  const { data: rawOpps } = await query

  // ── Filtro de período (em memória — computed a partir de starts_at/ends_at) ──
  const opps = filterPeriod
    ? (rawOpps ?? []).filter(o => {
        const status = getPeriodStatus(
          (o as Record<string, string | null>).starts_at ?? null,
          (o as Record<string, string | null>).ends_at   ?? null,
        )
        return status === filterPeriod
      })
    : (rawOpps ?? [])

  // ── Units (apenas para master) ──
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

  // ── Map de unit_id → name para exibição ──
  const unitNames: Record<string, string> = {}
  for (const u of units) unitNames[u.id] = u.name

  // ── Contadores de interesse e clique por oportunidade ──
  // Uma query agregada: evita N+1. Falha silenciosa (tabela pode não existir ainda).
  const interestCounts: Record<string, number> = {}
  const clickCounts:    Record<string, number> = {}
  try {
    const unitFilter = session.role === 'master' ? filterUnit : (session.unitId ?? '')
    let cQuery = supabase
      .from('opportunity_interactions')
      .select('opportunity_id, interaction_type')
      .not('opportunity_id', 'is', null)
      .in('interaction_type', ['interest', 'click'])
    if (unitFilter) cQuery = cQuery.eq('unit_id', unitFilter)
    const { data: counts } = await cQuery
    for (const row of counts ?? []) {
      if (!row.opportunity_id) continue
      if (row.interaction_type === 'interest') {
        interestCounts[row.opportunity_id] = (interestCounts[row.opportunity_id] ?? 0) + 1
      } else if (row.interaction_type === 'click') {
        clickCounts[row.opportunity_id] = (clickCounts[row.opportunity_id] ?? 0) + 1
      }
    }
  } catch { /* tabela ainda não criada — exibe sem contadores */ }

  // ── Toast (feedback pós-ação) ──
  const toast = sp.created ? 'Oportunidade criada com sucesso! ✓'
    : sp.updated ? 'Oportunidade atualizada! ✓'
    : sp.deleted ? 'Oportunidade removida. ✓'
    : null

  const canEdit = session.role !== 'unit_viewer'

  return (
    <AdminShell session={session} title="Oportunidades">

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

      {/* ── Header da página ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            Oportunidades
          </h1>
          <p style={{ fontSize: 12, color: C.textSec, margin: '2px 0 0' }}>
            {opps?.length ?? 0} cadastradas
          </p>
        </div>
        {canEdit && (
          <a
            href="/admin/oportunidades/nova"
            style={{
              background: C.purple, color: '#fff', textDecoration: 'none',
              borderRadius: 10, padding: '9px 16px',
              fontSize: 13, fontWeight: 600, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            + Nova oportunidade
          </a>
        )}
      </div>

      {/* ── Filtros ── */}
      <div style={{
        background: '#fff', borderRadius: 14, border: `0.5px solid ${C.border}`,
        padding: '12px 14px', marginBottom: 16,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>

        {/* Filtro por unidade (master) */}
        {session.role === 'master' && (
          <FilterSelect
            label="Unidade"
            paramName="unit"
            current={filterUnit}
            options={[{ value: '', label: 'Todas unidades' }, ...units.map(u => ({ value: u.id, label: u.name }))]}
            extra={{ type: filterType, active: filterActive, period: filterPeriod }}
          />
        )}

        {/* Filtro por tipo */}
        <FilterSelect
          label="Tipo"
          paramName="type"
          current={filterType}
          options={[
            { value: '',          label: 'Todos os tipos'   },
            { value: 'event',     label: '📅 Evento'        },
            { value: 'course',    label: '📚 Educação'      },
            { value: 'challenge', label: '🎯 Desafio'       },
            { value: 'job',       label: '💼 Renda extra'   },
            { value: 'banner',    label: '📣 Banner'        },
            { value: 'partner',   label: '🤝 Parceiro'      },
          ]}
          extra={{ unit: filterUnit, active: filterActive, period: filterPeriod }}
        />

        {/* Filtro por status ativo */}
        <FilterSelect
          label="Status"
          paramName="active"
          current={filterActive}
          options={[
            { value: '',  label: 'Todos'    },
            { value: '1', label: '✅ Ativo'  },
            { value: '0', label: '⬜ Inativo'},
          ]}
          extra={{ unit: filterUnit, type: filterType, period: filterPeriod }}
        />

        {/* Filtro por período */}
        <FilterSelect
          label="Período"
          paramName="period"
          current={filterPeriod}
          options={[
            { value: '',           label: 'Todos'        },
            { value: 'active',     label: '🟢 Vigente'   },
            { value: 'scheduled',  label: '🕐 Programada'},
            { value: 'expired',    label: '⛔ Expirada'  },
            { value: 'no-period',  label: '∞ Sem período'},
          ]}
          extra={{ unit: filterUnit, type: filterType, active: filterActive }}
        />
      </div>

      {/* ── Lista ── */}
      {!opps || opps.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
          padding: '40px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>📭</p>
          <p style={{ fontSize: 14, color: C.text, fontWeight: 500, margin: '0 0 4px' }}>
            Nenhuma oportunidade encontrada.
          </p>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 16px' }}>
            {filterType || filterActive ? 'Tente ajustar os filtros.' : 'Crie a primeira oportunidade.'}
          </p>
          {canEdit && (
            <a
              href="/admin/oportunidades/nova"
              style={{
                display: 'inline-block', background: C.purple, color: '#fff',
                borderRadius: 10, padding: '10px 20px',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}
            >
              + Nova oportunidade
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opps.map(opp => {
            const meta       = TYPE_META[opp.type as OppType] ?? TYPE_META.banner
            const oppRaw     = opp as Record<string, string | null | boolean | number>
            const periodSt   = getPeriodStatus(
              (oppRaw.starts_at as string | null) ?? null,
              (oppRaw.ends_at   as string | null) ?? null,
            )
            const periodMeta = PERIOD_META[periodSt]
            return (
              <div
                key={opp.id}
                style={{
                  background: '#fff', borderRadius: 14,
                  border: `0.5px solid ${opp.featured ? C.purple : C.border}`,
                  padding: '14px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {/* Info principal */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{
                      background: meta.bg, color: meta.color,
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {meta.emoji} {meta.label}
                    </span>
                    {opp.featured && (
                      <span style={{
                        background: C.amberBg, color: C.amberDark,
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      }}>
                        ⭐ Destaque
                      </span>
                    )}
                    {!opp.active && (
                      <span style={{
                        background: C.bgSecondary, color: C.textSec,
                        fontSize: 10, padding: '2px 8px', borderRadius: 99,
                      }}>
                        Inativa
                      </span>
                    )}
                    {/* Badge de período */}
                    <span style={{
                      background: periodMeta.bg, color: periodMeta.color,
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {periodMeta.label}
                    </span>
                    {session.role === 'master' && unitNames[opp.unit_id] && (
                      <span style={{
                        background: C.bgSecondary, color: C.textSec,
                        fontSize: 10, padding: '2px 8px', borderRadius: 99, marginLeft: 'auto',
                      }}>
                        {unitNames[opp.unit_id]}
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 3px',
                    opacity: opp.active ? 1 : 0.6,
                  }}>
                    {opp.title}
                  </p>
                  <p style={{ fontSize: 11, color: C.textTer, margin: '0 0 4px' }}>
                    Posição {opp.position}
                    {(oppRaw.starts_at || oppRaw.ends_at) && (
                      <span style={{ marginLeft: 8 }}>
                        {oppRaw.starts_at ? `de ${(oppRaw.starts_at as string).slice(0, 16).replace('T', ' ')} UTC` : ''}
                        {oppRaw.ends_at   ? ` até ${(oppRaw.ends_at as string).slice(0, 16).replace('T', ' ')} UTC` : ''}
                      </span>
                    )}
                  </p>
                  {/* Contadores de interação */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(interestCounts[opp.id] ?? 0) > 0 && (
                      <span style={{ fontSize: 10, color: C.greenDark, background: C.greenBg, padding: '1px 7px', borderRadius: 99 }}>
                        ✋ {interestCounts[opp.id]} interesse{interestCounts[opp.id] !== 1 ? 's' : ''}
                      </span>
                    )}
                    {(clickCounts[opp.id] ?? 0) > 0 && (
                      <span style={{ fontSize: 10, color: C.purpleDeep, background: C.purpleBg, padding: '1px 7px', borderRadius: 99 }}>
                        🔗 {clickCounts[opp.id]} clique{clickCounts[opp.id] !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                {canEdit && (
                  <div style={{ display: 'flex', gap: 7, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Editar */}
                    <a
                      href={`/admin/oportunidades/${opp.id}/editar`}
                      style={{
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: '5px 12px', fontSize: 12,
                        textDecoration: 'none', color: C.textSec, background: '#fff',
                        fontWeight: 500,
                      }}
                    >
                      ✏️ Editar
                    </a>

                    {/* Toggle ativo */}
                    <form action={toggleOppActive.bind(null, opp.id)}>
                      <button type="submit" style={{
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: '5px 12px', fontSize: 12,
                        cursor: 'pointer', background: '#fff', color: C.textSec,
                        fontFamily: 'inherit', fontWeight: 500,
                      }}>
                        {opp.active ? '⬜ Desativar' : '✅ Ativar'}
                      </button>
                    </form>

                    {/* Toggle destaque */}
                    <form action={toggleOppFeatured.bind(null, opp.id)}>
                      <button type="submit" style={{
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: '5px 12px', fontSize: 12,
                        cursor: 'pointer', background: '#fff', color: C.textSec,
                        fontFamily: 'inherit', fontWeight: 500,
                      }}>
                        {opp.featured ? '☆ Remover destaque' : '⭐ Destacar'}
                      </button>
                    </form>

                    {/* Deletar — Client Component para permitir confirm() */}
                    <DeleteOppButton action={deleteOpportunity.bind(null, opp.id)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

function FilterSelect({
  label, paramName, current, options, extra,
}: {
  label: string
  paramName: string
  current: string
  options: { value: string; label: string }[]
  extra: Record<string, string>
}) {
  // Gera a URL com os filtros atualizados
  function buildUrl(value: string) {
    const params = new URLSearchParams({ ...extra, [paramName]: value })
    // Remove params vazios
    Array.from(params.entries()).forEach(([k, v]) => { if (!v) params.delete(k) })
    const qs = params.toString()
    return `/admin/oportunidades${qs ? `?${qs}` : ''}`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontSize: 11, color: C.textSec, fontWeight: 500, flexShrink: 0 }}>{label}:</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <a
            key={opt.value}
            href={buildUrl(opt.value)}
            style={{
              border: current === opt.value
                ? `1.5px solid ${C.purple}` : `1px solid ${C.border}`,
              borderRadius: 99, padding: '4px 10px',
              fontSize: 11, textDecoration: 'none',
              background: current === opt.value ? C.purpleBg : '#fff',
              color: current === opt.value ? C.purpleDeep : C.textSec,
              fontWeight: current === opt.value ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </a>
        ))}
      </div>
    </div>
  )
}
