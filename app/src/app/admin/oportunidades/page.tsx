// =============================================================================
// /admin/oportunidades — Lista de oportunidades (admin) — v2
//
// SEGURANÇA:
//   • requireAdmin() valida sessão — redireciona se não autenticado
//   • unit_admin só vê opps da sua própria unidade (filtro via DB)
//   • master vê todas (filtro por unidade via URL param)
//   • Filtros de tipo/status/período/link/destaque/busca → in-memory após fetch
//   • KPIs calculados do set completo (pré-filtro in-memory)
// =============================================================================

import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { toggleOppActive, toggleOppFeatured, deleteOpportunity } from './actions'
import { DeleteOppButton }            from './_DeleteButton'
import { C }                          from '@/app/components/ui'
import type { OppType, OppPeriodStatus } from '@/types/database'

// ── Tipo do registro da query ─────────────────────────────────────────────────

type RawOpp = {
  id:          string
  unit_id:     string
  type:        OppType
  title:       string
  featured:    boolean
  active:      boolean
  position:    number
  starts_at:   string | null
  ends_at:     string | null
  cta_url:     string | null
  image_url:   string | null
  created_at:  string
}

// ── Status de período ─────────────────────────────────────────────────────────

function getPeriodStatus(starts_at: string | null, ends_at: string | null): OppPeriodStatus {
  if (!starts_at && !ends_at) return 'no-period'
  const now = Date.now()
  if (ends_at   && new Date(ends_at).getTime()   < now) return 'expired'
  if (starts_at && new Date(starts_at).getTime() > now) return 'scheduled'
  return 'active'
}

// ── Visibilidade para o usuário final ─────────────────────────────────────────
// Explica por que uma opp aparece ou não aparece no app público

type Visibility = {
  visible: boolean
  label:   string
  color:   string
  bg:      string
}

function getVisibility(opp: RawOpp): Visibility {
  if (!opp.active) {
    return { visible: false, label: 'Inativa',            color: C.textSec,   bg: C.bgSecondary }
  }
  const ps = getPeriodStatus(opp.starts_at, opp.ends_at)
  if (ps === 'expired') {
    return { visible: false, label: 'Período expirado',   color: C.coralDark, bg: C.coralBg }
  }
  if (ps === 'scheduled') {
    return { visible: false, label: 'Ainda não começou',  color: '#4338CA',   bg: '#EEF2FF'  }
  }
  return   { visible: true,  label: 'Visível no app ✓',  color: C.greenDark, bg: C.greenBg  }
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

const PERIOD_META: Record<OppPeriodStatus, { label: string; bg: string; color: string }> = {
  'no-period': { label: '∞ Sem período', bg: '#F5F5F5', color: '#888'    },
  'scheduled': { label: '🕐 Programada', bg: '#EEF2FF', color: '#4338CA' },
  'active':    { label: '🟢 Vigente',    bg: '#F0FDF4', color: '#166534' },
  'expired':   { label: '⛔ Expirada',   bg: '#FEF2F2', color: '#991B1B' },
}

// ── Helpers de formatação ─────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba',
  })
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AdminOppsPage({ searchParams }: Props) {
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()
  const sp       = await searchParams

  // ── URL params ──
  const filterType    = sp.type   ?? ''
  const filterActive  = sp.active ?? ''   // '1' | '0' | ''
  const filterPeriod  = sp.period ?? ''   // 'no-period' | 'scheduled' | 'active' | 'expired'
  const filterUnit    = session.role === 'master' ? (sp.unit ?? '') : (session.unitId ?? '')
  const filterLink    = sp.link   ?? ''   // '1' = tem link | '0' = sem link
  const filterFeat    = sp.feat   ?? ''   // '1' = destaque | '0' = sem destaque
  const searchQuery   = sp.q      ?? ''

  // ── Query DB: apenas filtro de unidade (segurança) ──
  // Todos os outros filtros são aplicados in-memory para permitir KPIs corretos
  let dbQuery = supabase
    .from('opportunities')
    .select('id, unit_id, type, title, featured, active, position, starts_at, ends_at, cta_url, image_url, created_at')
    .is('deleted_at', null)
    .order('position',   { ascending: true  })
    .order('created_at', { ascending: false })
    .limit(300)

  if (session.role !== 'master') {
    // unit_admin e unit_viewer: apenas a própria unidade
    if (session.unitId) dbQuery = dbQuery.eq('unit_id', session.unitId)
  } else if (filterUnit) {
    // master com filtro de unidade ativo
    dbQuery = dbQuery.eq('unit_id', filterUnit)
  }

  const { data: rawOpps } = await dbQuery
  const allOpps: RawOpp[] = (rawOpps ?? []) as RawOpp[]

  // ── KPIs calculados do set completo (pré-filtro in-memory) ──
  const kpi = {
    total:     allOpps.length,
    active:    allOpps.filter(o => o.active && getPeriodStatus(o.starts_at, o.ends_at) === 'active').length,
    inactive:  allOpps.filter(o => !o.active).length,
    scheduled: allOpps.filter(o => getPeriodStatus(o.starts_at, o.ends_at) === 'scheduled').length,
    expired:   allOpps.filter(o => getPeriodStatus(o.starts_at, o.ends_at) === 'expired').length,
    noLink:    allOpps.filter(o => !o.cta_url).length,
    featured:  allOpps.filter(o => o.featured).length,
    visible:   allOpps.filter(o => getVisibility(o).visible).length,
  }

  // ── Filtros in-memory ──
  let opps = allOpps

  if (filterType)          opps = opps.filter(o => o.type     === filterType)
  if (filterActive === '1') opps = opps.filter(o =>  o.active)
  if (filterActive === '0') opps = opps.filter(o => !o.active)
  if (filterLink   === '1') opps = opps.filter(o =>  !!o.cta_url)
  if (filterLink   === '0') opps = opps.filter(o => !o.cta_url)
  if (filterFeat   === '1') opps = opps.filter(o =>  o.featured)
  if (filterFeat   === '0') opps = opps.filter(o => !o.featured)
  if (filterPeriod)         opps = opps.filter(o => getPeriodStatus(o.starts_at, o.ends_at) === filterPeriod)
  if (searchQuery)          opps = opps.filter(o => o.title.toLowerCase().includes(searchQuery.toLowerCase()))

  // ── Units: id → name + slug (para exibição e "Ver no app") ──
  const { data: unitsData } = await supabase
    .from('units')
    .select('id, name, slug')
    .eq('active', true)
    .is('deleted_at', null)
    .order('name')

  const unitNames:  Record<string, string> = {}
  const unitSlugs:  Record<string, string> = {}
  const unitsList: { id: string; name: string }[] = []

  for (const u of unitsData ?? []) {
    unitNames[u.id] = u.name
    unitSlugs[u.id] = u.slug
    unitsList.push({ id: u.id, name: u.name })
  }

  // ── Contadores de interação ──
  const interestCounts: Record<string, number> = {}
  const clickCounts:    Record<string, number> = {}
  try {
    let cq = supabase
      .from('opportunity_interactions')
      .select('opportunity_id, interaction_type')
      .not('opportunity_id', 'is', null)
      .in('interaction_type', ['interest', 'click'])
    if (filterUnit)            cq = cq.eq('unit_id', filterUnit)
    else if (session.unitId)   cq = cq.eq('unit_id', session.unitId)
    const { data: counts } = await cq
    for (const row of counts ?? []) {
      if (!row.opportunity_id) continue
      if (row.interaction_type === 'interest') {
        interestCounts[row.opportunity_id] = (interestCounts[row.opportunity_id] ?? 0) + 1
      } else {
        clickCounts[row.opportunity_id] = (clickCounts[row.opportunity_id] ?? 0) + 1
      }
    }
  } catch { /* tabela ainda não criada — exibe zero */ }

  // ── Toast ──
  const toast = sp.created ? '✓ Oportunidade criada com sucesso!'
    : sp.updated ? '✓ Oportunidade atualizada!'
    : sp.deleted ? '✓ Oportunidade removida.'
    : null

  const canEdit = session.role !== 'unit_viewer'

  // ── Todos os filtros para passar como extra aos selects ──
  const allFiltersBase = {
    unit:   filterUnit,
    type:   filterType,
    active: filterActive,
    period: filterPeriod,
    link:   filterLink,
    feat:   filterFeat,
    q:      searchQuery,
  }

  const hasAnyFilter = !!(filterType || filterActive || filterPeriod || filterLink || filterFeat || searchQuery)

  return (
    <AdminShell session={session} title="Oportunidades">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          background: C.greenBg, borderRadius: 10,
          padding: '10px 14px', marginBottom: 16,
          color: C.greenDark, fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast}
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
            Oportunidades
          </h1>
          <p style={{ fontSize: 12, color: C.textSec, margin: '3px 0 0' }}>
            {kpi.total} cadastradas · {kpi.visible} visíveis agora para os leads
            {session.role === 'master' && !filterUnit && <span> · todas as unidades</span>}
          </p>
        </div>
        {canEdit && (
          <a href="/admin/oportunidades/nova" style={{
            background: C.purple, color: '#fff', textDecoration: 'none',
            borderRadius: 10, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            + Nova oportunidade
          </a>
        )}
      </div>

      {/* ── KPI chips ── */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16,
      }}>
        <KpiChip
          emoji="📋" label="Total"
          value={kpi.total}
          href={buildBase(filterUnit)}
          active={!hasAnyFilter}
          bg="#F8F8F8" color={C.text}
        />
        <KpiChip
          emoji="✅" label="Ativas"
          value={kpi.active}
          href={buildBase(filterUnit) + '?period=active&active=1'}
          active={filterPeriod === 'active' && filterActive === '1'}
          bg={C.greenBg} color={C.greenDark}
        />
        <KpiChip
          emoji="🕐" label="Programadas"
          value={kpi.scheduled}
          href={buildBase(filterUnit) + '?period=scheduled'}
          active={filterPeriod === 'scheduled'}
          bg="#EEF2FF" color="#4338CA"
        />
        <KpiChip
          emoji="⛔" label="Expiradas"
          value={kpi.expired}
          href={buildBase(filterUnit) + '?period=expired'}
          active={filterPeriod === 'expired'}
          bg={C.coralBg} color={C.coralDark}
        />
        <KpiChip
          emoji="🔗" label="Sem link"
          value={kpi.noLink}
          href={buildBase(filterUnit) + '?link=0'}
          active={filterLink === '0'}
          bg={C.amberBg} color={C.amberDark}
        />
        <KpiChip
          emoji="⭐" label="Destaques"
          value={kpi.featured}
          href={buildBase(filterUnit) + '?feat=1'}
          active={filterFeat === '1'}
          bg={C.purpleBg} color={C.purpleDeep}
        />
      </div>

      {/* ── Filtros ── */}
      <div style={{
        background: '#fff', borderRadius: 14, border: `0.5px solid ${C.border}`,
        padding: '12px 14px', marginBottom: 12,
      }}>

        {/* Linha 1: Busca + limpar */}
        <form
          method="get"
          action="/admin/oportunidades"
          style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}
        >
          {/* Preserva todos os filtros ativos ao submeter busca */}
          {filterUnit   && <input type="hidden" name="unit"   value={filterUnit}   />}
          {filterType   && <input type="hidden" name="type"   value={filterType}   />}
          {filterActive && <input type="hidden" name="active" value={filterActive} />}
          {filterPeriod && <input type="hidden" name="period" value={filterPeriod} />}
          {filterLink   && <input type="hidden" name="link"   value={filterLink}   />}
          {filterFeat   && <input type="hidden" name="feat"   value={filterFeat}   />}

          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="🔎  Buscar por título..."
            style={{
              flex: 1, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '7px 12px', fontSize: 12, outline: 'none',
              fontFamily: 'inherit', color: C.text, background: C.bgApp,
              minWidth: 0,
            }}
          />
          <button type="submit" style={{
            background: C.purple, color: '#fff', border: 'none',
            borderRadius: 8, padding: '7px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0,
          }}>
            Buscar
          </button>
          {hasAnyFilter && (
            <a href={buildBase(filterUnit)} style={{
              border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '6px 12px', fontSize: 11,
              textDecoration: 'none', color: C.textSec, background: '#fff',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              ✕ Limpar
            </a>
          )}
        </form>

        {/* Linha 2: Selects de filtro */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Unidade (master only) */}
          {session.role === 'master' && (
            <FilterSelect
              label="Unidade"
              paramName="unit"
              current={filterUnit}
              options={[
                { value: '', label: 'Todas' },
                ...unitsList.map(u => ({ value: u.id, label: u.name })),
              ]}
              extra={{ ...allFiltersBase, unit: '' }}
            />
          )}

          {/* Tipo */}
          <FilterSelect
            label="Tipo"
            paramName="type"
            current={filterType}
            options={[
              { value: '',          label: 'Todos tipos'  },
              { value: 'event',     label: '📅 Evento'    },
              { value: 'course',    label: '📚 Educação'  },
              { value: 'challenge', label: '🎯 Desafio'   },
              { value: 'job',       label: '💼 Renda ext' },
              { value: 'banner',    label: '📣 Banner'    },
              { value: 'partner',   label: '🤝 Parceiro'  },
            ]}
            extra={{ ...allFiltersBase, type: '' }}
          />

          {/* Ativo */}
          <FilterSelect
            label="Ativo"
            paramName="active"
            current={filterActive}
            options={[
              { value: '',  label: 'Todos'     },
              { value: '1', label: '✅ Ativo'   },
              { value: '0', label: '⬜ Inativo' },
            ]}
            extra={{ ...allFiltersBase, active: '' }}
          />

          {/* Período */}
          <FilterSelect
            label="Período"
            paramName="period"
            current={filterPeriod}
            options={[
              { value: '',           label: 'Qualquer'     },
              { value: 'active',     label: '🟢 Vigente'   },
              { value: 'scheduled',  label: '🕐 Programada'},
              { value: 'expired',    label: '⛔ Expirada'  },
              { value: 'no-period',  label: '∞ Sem período'},
            ]}
            extra={{ ...allFiltersBase, period: '' }}
          />

          {/* Link */}
          <FilterSelect
            label="Link"
            paramName="link"
            current={filterLink}
            options={[
              { value: '',  label: 'Todos'     },
              { value: '1', label: '🔗 Tem link'},
              { value: '0', label: '❌ Sem link'},
            ]}
            extra={{ ...allFiltersBase, link: '' }}
          />

          {/* Destaque */}
          <FilterSelect
            label="Destaque"
            paramName="feat"
            current={filterFeat}
            options={[
              { value: '',  label: 'Todos'      },
              { value: '1', label: '⭐ Destaque'},
              { value: '0', label: '☆ Normal'  },
            ]}
            extra={{ ...allFiltersBase, feat: '' }}
          />
        </div>
      </div>

      {/* ── Contador de resultados ── */}
      <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 10px', fontWeight: 500 }}>
        {opps.length === allOpps.length
          ? `${opps.length} oportunidades`
          : `${opps.length} de ${allOpps.length} exibidas (filtro aplicado)`}
        {searchQuery && <span> · busca: <b>"{searchQuery}"</b></span>}
      </p>

      {/* ── Lista ── */}
      {opps.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
          padding: '40px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>📭</p>
          <p style={{ fontSize: 14, color: C.text, fontWeight: 500, margin: '0 0 4px' }}>
            Nenhuma oportunidade encontrada.
          </p>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 16px' }}>
            {hasAnyFilter ? 'Ajuste os filtros ou limpe a busca.' : 'Crie a primeira oportunidade.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {hasAnyFilter && (
              <a href={buildBase(filterUnit)} style={{
                display: 'inline-block', border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '8px 16px',
                fontSize: 12, textDecoration: 'none', color: C.textSec,
              }}>
                ✕ Limpar filtros
              </a>
            )}
            {canEdit && (
              <a href="/admin/oportunidades/nova" style={{
                display: 'inline-block', background: C.purple, color: '#fff',
                borderRadius: 10, padding: '9px 18px',
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}>
                + Nova oportunidade
              </a>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opps.map(opp => {
            const meta       = TYPE_META[opp.type] ?? TYPE_META.banner
            const periodSt   = getPeriodStatus(opp.starts_at, opp.ends_at)
            const periodMeta = PERIOD_META[periodSt]
            const vis        = getVisibility(opp)
            const unitSlug   = unitSlugs[opp.unit_id] ?? ''
            const unitName   = unitNames[opp.unit_id]

            const nInterest  = interestCounts[opp.id] ?? 0
            const nClick     = clickCounts[opp.id]    ?? 0

            return (
              <div key={opp.id} style={{
                background: '#fff', borderRadius: 14,
                border: `0.5px solid ${opp.featured ? C.purple : vis.visible ? C.border : '#E5E7EB'}`,
                overflow: 'hidden',
                opacity: opp.active ? 1 : 0.82,
              }}>
                {/* ── Barra de status de visibilidade ── */}
                <div style={{
                  background: vis.bg, padding: '5px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: vis.color }}>
                    {vis.visible ? '👁️' : '🚫'} {vis.label}
                  </span>
                  {!vis.visible && (
                    <span style={{ fontSize: 10, color: vis.color, opacity: 0.8 }}>
                      {!opp.active && 'Ative para exibir'}
                      {opp.active && periodSt === 'expired'   && 'Edite o período de exibição'}
                      {opp.active && periodSt === 'scheduled' && `Começa em ${fmtDate(opp.starts_at)}`}
                    </span>
                  )}
                </div>

                {/* ── Corpo do card ── */}
                <div style={{ padding: '12px 14px' }}>

                  {/* Linha 1: badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                    {/* Tipo */}
                    <span style={{
                      background: meta.bg, color: meta.color,
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {meta.emoji} {meta.label}
                    </span>

                    {/* Período */}
                    <span style={{
                      background: periodMeta.bg, color: periodMeta.color,
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {periodMeta.label}
                    </span>

                    {/* Destaque */}
                    {opp.featured && (
                      <span style={{
                        background: C.amberBg, color: C.amberDark,
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      }}>
                        ⭐ Destaque
                      </span>
                    )}

                    {/* Tem link */}
                    <span style={{
                      background: opp.cta_url ? C.greenBg   : C.coralBg,
                      color:      opp.cta_url ? C.greenDark : C.coralDark,
                      fontSize: 10, padding: '2px 8px', borderRadius: 99,
                    }}>
                      {opp.cta_url ? '🔗 Link' : '❌ Sem link'}
                    </span>

                    {/* Tem imagem */}
                    {opp.image_url && (
                      <span style={{
                        background: C.purpleBg, color: C.purpleDeep,
                        fontSize: 10, padding: '2px 8px', borderRadius: 99,
                      }}>
                        🖼️ Imagem
                      </span>
                    )}

                    {/* Unidade (master) */}
                    {session.role === 'master' && unitName && (
                      <span style={{
                        background: C.bgSecondary, color: C.textSec,
                        fontSize: 10, padding: '2px 8px', borderRadius: 99,
                        marginLeft: 'auto',
                      }}>
                        📍 {unitName}
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <p style={{
                    fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 6px',
                    lineHeight: 1.4,
                  }}>
                    {opp.title}
                  </p>

                  {/* Meta: posição + período */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: C.textTer }}>
                      Pos. {opp.position}
                    </span>
                    {opp.starts_at && (
                      <span style={{ fontSize: 11, color: C.textTer }}>
                        De {fmtDate(opp.starts_at)}
                      </span>
                    )}
                    {opp.ends_at && (
                      <span style={{ fontSize: 11, color: opp.active && periodSt === 'expired' ? C.coralDark : C.textTer }}>
                        Até {fmtDate(opp.ends_at)}
                      </span>
                    )}
                  </div>

                  {/* Interações */}
                  {(nInterest > 0 || nClick > 0) && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {nInterest > 0 && (
                        <span style={{
                          fontSize: 11, color: C.greenDark, background: C.greenBg,
                          padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                        }}>
                          ✋ {nInterest} interesse{nInterest !== 1 ? 's' : ''}
                        </span>
                      )}
                      {nClick > 0 && (
                        <span style={{
                          fontSize: 11, color: C.purpleDeep, background: C.purpleBg,
                          padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                        }}>
                          🔗 {nClick} clique{nClick !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ações */}
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>

                      {/* Editar */}
                      <a href={`/admin/oportunidades/${opp.id}/editar`} style={btnStyle}>
                        ✏️ Editar
                      </a>

                      {/* Ver no app */}
                      {unitSlug && (
                        <a
                          href={`/${unitSlug}/oportunidades/${opp.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver como o lead vê"
                          style={{ ...btnStyle, color: C.purpleDeep, borderColor: C.purpleBg, background: C.purpleBg }}
                        >
                          👁️ Ver no app
                        </a>
                      )}

                      {/* Toggle ativo */}
                      <form action={toggleOppActive.bind(null, opp.id)} style={{ display: 'contents' }}>
                        <button type="submit" style={btnStyle}>
                          {opp.active ? '⬜ Desativar' : '✅ Ativar'}
                        </button>
                      </form>

                      {/* Toggle destaque */}
                      <form action={toggleOppFeatured.bind(null, opp.id)} style={{ display: 'contents' }}>
                        <button type="submit" style={btnStyle}>
                          {opp.featured ? '☆ Remover destaque' : '⭐ Destacar'}
                        </button>
                      </form>

                      {/* Deletar */}
                      <DeleteOppButton action={deleteOpportunity.bind(null, opp.id)} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}

// ── Helpers de URL ────────────────────────────────────────────────────────────

function buildBase(unitId: string): string {
  return unitId ? `/admin/oportunidades?unit=${unitId}` : '/admin/oportunidades'
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

// ── KPI Chip ──────────────────────────────────────────────────────────────────

function KpiChip({
  emoji, label, value, href, active, bg, color,
}: {
  emoji: string; label: string; value: number; href: string
  active: boolean; bg: string; color: string
}) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: active ? bg : '#fff',
        border: active ? `1.5px solid ${color}40` : `0.5px solid ${C.border}`,
        borderRadius: 10, padding: '7px 12px',
        textDecoration: 'none', transition: 'all .15s',
      }}
    >
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: active ? color : C.text, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: active ? color : C.textSec, fontWeight: 500, marginTop: 1 }}>
          {label}
        </div>
      </div>
    </a>
  )
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

function FilterSelect({
  label, paramName, current, options, extra,
}: {
  label:     string
  paramName: string
  current:   string
  options:   { value: string; label: string }[]
  extra:     Record<string, string>
}) {
  function buildUrl(value: string) {
    const params = new URLSearchParams({ ...extra, [paramName]: value })
    Array.from(params.entries()).forEach(([k, v]) => { if (!v) params.delete(k) })
    const qs = params.toString()
    return `/admin/oportunidades${qs ? `?${qs}` : ''}`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 10, color: C.textSec, fontWeight: 600, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}:
      </span>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <a
            key={opt.value}
            href={buildUrl(opt.value)}
            style={{
              border: current === opt.value
                ? `1.5px solid ${C.purple}` : `1px solid ${C.border}`,
              borderRadius: 99, padding: '4px 9px',
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
