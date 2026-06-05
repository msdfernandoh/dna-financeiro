// =============================================================================
// /admin/resultados — Dashboard de ROI do consultor / master
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • master: vê todos os deals + filtro por unidade
//   • unit_admin: vê apenas deals da sua unidade
//   • unit_viewer: vê apenas totais (sem valores individuais)
//   • Valores monetários individuais nunca expostos a unit_viewer
// =============================================================================

import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { C }                          from '@/app/components/ui'

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Helpers de período ────────────────────────────────────────────────────────

function getPeriodRange(period: string): { start: string; end: string; label: string } {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()

  switch (period) {
    case 'last_month': {
      const d = new Date(year, month - 1, 1)
      return {
        start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        end:   `${year}-${String(month + 1).padStart(2, '0')}-01`,
        label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      }
    }
    case 'year': {
      return {
        start: `${year}-01-01`,
        end:   `${year + 1}-01-01`,
        label: `${year}`,
      }
    }
    case 'all': {
      return { start: '2000-01-01', end: '2100-01-01', label: 'Todo o período' }
    }
    default: { // 'month' = este mês
      return {
        start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        end:   `${year}-${String(month + 2).padStart(2, '0')}-01`.replace('-13-', '-01-').replace(`${year}-`, month === 11 ? `${year + 1}-` : `${year}-`),
        label: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      }
    }
  }
}

// ── Labels ────────────────────────────────────────────────────────────────────

const PRODUCT_LABELS: Record<string, { label: string; emoji: string }> = {
  consorcio:     { label: 'Consórcio',     emoji: '🤝' },
  financiamento: { label: 'Financiamento', emoji: '🏦' },
  cdc:           { label: 'CDC',           emoji: '💳' },
  investment:    { label: 'Investimento',  emoji: '📈' },
  imovel:        { label: 'Imóvel',        emoji: '🏠' },
  outro:         { label: 'Outro',         emoji: '📦' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  won:     { label: '✅ Fechado',      color: C.greenDark,   bg: C.greenBg  },
  lost:    { label: '❌ Perdido',      color: '#991B1B',     bg: '#FEF2F2'  },
  pending: { label: '⏳ Em andamento', color: C.amberDark,   bg: C.amberBg  },
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type DealFull = {
  id:           string
  status:       string
  product_type: string | null
  sale_amount:  number | null
  gain_amount:  number | null
  closed_at:    string | null
  notes:        string | null
  lead_id:      string
  unit_id:      string
  // joins
  leads?:       { name: string; phone: string } | null
  units?:       { name: string } | null
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    period?:  string
    unit_id?: string
    product?: string
    status?:  string
  }>
}

export default async function ResultadosPage({ searchParams }: Props) {
  const params  = await searchParams
  const session = await requireAdmin()
  const supabase = createServerSupabaseClient()

  const canSeeSensitive = session.role !== 'unit_viewer'
  const period    = params.period  || 'month'
  const filterUnit    = params.unit_id?.trim() || ''
  const filterProduct = params.product?.trim() || ''
  const filterStatus  = params.status?.trim()  || ''

  const { start, end, label: periodLabel } = getPeriodRange(period)

  // ── Buscar todas as unidades (master) ──────────────────────────────────────
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

  // ── Buscar deals no período ────────────────────────────────────────────────
  let dealsQ = supabase
    .from('deals')
    .select('id, status, product_type, sale_amount, gain_amount, closed_at, notes, lead_id, unit_id, leads(name, phone), units(name)')
    .gte('closed_at', start)
    .lt('closed_at', end)
    .order('closed_at', { ascending: false })

  if (session.role !== 'master') {
    dealsQ = dealsQ.eq('unit_id', session.unitId!)
  } else if (filterUnit) {
    dealsQ = dealsQ.eq('unit_id', filterUnit)
  }

  const { data: rawDeals } = await dealsQ
  const allDeals = (rawDeals ?? []) as unknown as DealFull[]

  // ── Filtros in-memory ──────────────────────────────────────────────────────
  const deals = allDeals.filter(d => {
    if (filterProduct && d.product_type !== filterProduct) return false
    if (filterStatus  && d.status        !== filterStatus)  return false
    return true
  })

  const wonDeals = deals.filter(d => d.status === 'won')

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalDeals       = deals.length
  const totalWon         = wonDeals.length
  const totalSales       = wonDeals.reduce((s, d) => s + (d.sale_amount ?? 0), 0)
  const totalGain        = wonDeals.reduce((s, d) => s + (d.gain_amount  ?? 0), 0)
  const avgSale          = totalWon > 0 ? totalSales / totalWon : 0
  const avgGain          = totalWon > 0 ? totalGain  / totalWon : 0

  // Leads únicos que geraram deal
  const uniqueLeads = new Set(wonDeals.map(d => d.lead_id)).size

  // Breakdown por produto
  const byProduct: Record<string, { count: number; sales: number; gain: number }> = {}
  for (const d of wonDeals) {
    const key = d.product_type ?? 'outro'
    if (!byProduct[key]) byProduct[key] = { count: 0, sales: 0, gain: 0 }
    byProduct[key].count++
    byProduct[key].sales += d.sale_amount ?? 0
    byProduct[key].gain  += d.gain_amount  ?? 0
  }
  const productRows = Object.entries(byProduct).sort((a, b) => b[1].sales - a[1].sales)
  const maxProductSales = productRows[0]?.[1].sales ?? 1

  // Breakdown por unidade (master only)
  const byUnit: Record<string, { name: string; count: number; sales: number; gain: number }> = {}
  if (session.role === 'master') {
    for (const d of wonDeals) {
      const key  = d.unit_id
      const name = (d.units as { name?: string } | null)?.name ?? key
      if (!byUnit[key]) byUnit[key] = { name, count: 0, sales: 0, gain: 0 }
      byUnit[key].count++
      byUnit[key].sales += d.sale_amount ?? 0
      byUnit[key].gain  += d.gain_amount  ?? 0
    }
  }
  const unitRows = Object.entries(byUnit).sort((a, b) => b[1].sales - a[1].sales)

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectSt: React.CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '6px 10px', fontSize: 12, background: '#fff',
    color: C.text, fontFamily: 'inherit', outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
    paddingRight: 24,
  }

  return (
    <AdminShell session={session} title="Resultados">

      {/* ── Filtros de período ── */}
      <form method="GET" style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        alignItems: 'center', marginBottom: 16,
      }}>
        {/* Período */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          {[
            { value: 'month',      label: 'Este mês'  },
            { value: 'last_month', label: 'Mês ant.'  },
            { value: 'year',       label: 'Este ano'  },
            { value: 'all',        label: 'Tudo'      },
          ].map(opt => (
            <a
              key={opt.value}
              href={`?period=${opt.value}${filterUnit ? `&unit_id=${filterUnit}` : ''}${filterProduct ? `&product=${filterProduct}` : ''}${filterStatus ? `&status=${filterStatus}` : ''}`}
              style={{
                padding: '6px 12px', fontSize: 12, textDecoration: 'none',
                background: period === opt.value ? C.purple : '#fff',
                color:      period === opt.value ? '#fff'   : C.textSec,
                fontWeight: period === opt.value ? 600      : 400,
                borderRight: `1px solid ${C.border}`,
              }}
            >
              {opt.label}
            </a>
          ))}
        </div>

        {/* Unidade (master) */}
        {session.role === 'master' && (
          <select
            name="unit_id"
            defaultValue={filterUnit}
            onChange={() => (document.querySelector('form') as HTMLFormElement)?.submit()}
            style={selectSt}
          >
            <option value="">Todas as unidades</option>
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        {/* Produto */}
        <select name="product" defaultValue={filterProduct} style={selectSt}>
          <option value="">Todos os produtos</option>
          {Object.entries(PRODUCT_LABELS).map(([v, { label, emoji }]) => (
            <option key={v} value={v}>{emoji} {label}</option>
          ))}
        </select>

        {/* Status */}
        <select name="status" defaultValue={filterStatus} style={selectSt}>
          <option value="">Todos os status</option>
          <option value="won">✅ Fechados</option>
          <option value="pending">⏳ Em andamento</option>
          <option value="lost">❌ Perdidos</option>
        </select>

        <button type="submit" style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12,
          background: C.bgSecondary, color: C.textSec,
          border: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Filtrar
        </button>

        {/* Período label */}
        <span style={{ fontSize: 12, color: C.textTer, marginLeft: 'auto' }}>
          📅 {periodLabel}
        </span>
      </form>

      {/* ── KPIs principais ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10, marginBottom: 16,
      }}>
        <KpiCard
          label="Total vendido"
          value={canSeeSensitive ? fmtBRL(totalSales) : '—'}
          sub={`${totalWon} negócio${totalWon !== 1 ? 's' : ''}`}
          color={C.greenDark} bg={C.greenBg}
          emoji="💰"
        />
        <KpiCard
          label="Meu ganho"
          value={canSeeSensitive ? fmtBRL(totalGain) : '—'}
          sub={totalWon > 0 && canSeeSensitive ? `média ${fmtBRL(avgGain)}` : ''}
          color={C.amberDark} bg={C.amberBg}
          emoji="🎯"
        />
        <KpiCard
          label="Negócios fechados"
          value={String(totalWon)}
          sub={`${totalDeals} total (c/ perdidos)`}
          color={C.purpleDeep} bg={C.purpleBg}
          emoji="🤝"
        />
        <KpiCard
          label="Leads convertidos"
          value={String(uniqueLeads)}
          sub="leads únicos c/ venda"
          color={C.purpleDeep} bg={C.purpleBg}
          emoji="👥"
        />
        {canSeeSensitive && avgSale > 0 && (
          <KpiCard
            label="Ticket médio"
            value={fmtBRL(avgSale)}
            sub="por negócio fechado"
            color={C.greenDark} bg={C.greenBg}
            emoji="📊"
          />
        )}
      </div>

      {/* ── Breakdown por produto ── */}
      {productRows.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: '16px', marginBottom: 12,
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.text }}>
            📦 Por produto
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {productRows.map(([key, { count, sales, gain }]) => {
              const meta = PRODUCT_LABELS[key] ?? { label: key, emoji: '📦' }
              const barPct = maxProductSales > 0 ? Math.round((sales / maxProductSales) * 100) : 0
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {meta.emoji} {meta.label}
                      <span style={{ fontSize: 11, color: C.textSec, fontWeight: 400, marginLeft: 6 }}>
                        {count} negócio{count !== 1 ? 's' : ''}
                      </span>
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      {canSeeSensitive && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.greenDark }}>
                          {fmtBRL(sales)}
                        </span>
                      )}
                      {canSeeSensitive && gain > 0 && (
                        <span style={{ fontSize: 11, color: C.amberDark, marginLeft: 8 }}>
                          ganho {fmtBRL(gain)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 6, background: C.bgSecondary, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, width: `${barPct}%`,
                      background: `linear-gradient(90deg, ${C.purple}, ${C.purpleDeep})`,
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Breakdown por unidade (master only) ── */}
      {session.role === 'master' && unitRows.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: '16px', marginBottom: 12,
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.text }}>
            🏢 Por unidade
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unitRows.map(([, { name, count, sales, gain }]) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 8, background: C.bgSecondary,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                  {name}
                  <span style={{ fontSize: 11, color: C.textSec, fontWeight: 400, marginLeft: 6 }}>
                    {count} negócio{count !== 1 ? 's' : ''}
                  </span>
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.greenDark }}>
                    {fmtBRL(sales)}
                  </span>
                  {gain > 0 && (
                    <span style={{ fontSize: 11, color: C.amberDark, marginLeft: 8 }}>
                      ganho {fmtBRL(gain)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lista de negócios ── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
            🤝 Negócios — {deals.length} encontrado{deals.length !== 1 ? 's' : ''}
          </p>
        </div>

        {deals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: C.textSec }}>
            <p style={{ fontSize: 20, margin: '0 0 8px' }}>🤝</p>
            <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>
              Nenhum negócio neste período
            </p>
            <p style={{ fontSize: 12, margin: 0 }}>
              Registre negócios fechados na tela de cada lead.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deals.map(deal => {
              const sMeta   = STATUS_META[deal.status] ?? STATUS_META.won
              const pMeta   = PRODUCT_LABELS[deal.product_type ?? 'outro'] ?? { label: 'Outro', emoji: '📦' }
              const leadName = (deal.leads as { name?: string } | null)?.name ?? '—'
              const unitName = (deal.units as { name?: string } | null)?.name

              return (
                <div key={deal.id} style={{
                  borderRadius: 12, border: `1px solid ${C.border}`,
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  {/* Lead + produto */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                        background: sMeta.bg, color: sMeta.color,
                      }}>
                        {sMeta.label}
                      </span>
                      <span style={{ fontSize: 12, color: C.textSec }}>
                        {pMeta.emoji} {pMeta.label}
                      </span>
                    </div>
                    <a
                      href={`/admin/leads/${deal.lead_id}`}
                      style={{ fontSize: 14, fontWeight: 600, color: C.text, textDecoration: 'none' }}
                    >
                      {leadName}
                    </a>
                    {session.role === 'master' && unitName && (
                      <span style={{ fontSize: 11, color: C.textSec, display: 'block' }}>{unitName}</span>
                    )}
                  </div>

                  {/* Valores */}
                  {canSeeSensitive ? (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      {deal.sale_amount != null && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: C.textSec, fontWeight: 500 }}>Venda</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.greenDark }}>
                            {fmtBRL(deal.sale_amount)}
                          </div>
                        </div>
                      )}
                      {deal.gain_amount != null && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: C.textSec, fontWeight: 500 }}>Ganho</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.amberDark }}>
                            {fmtBRL(deal.gain_amount)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: C.textSec }}>Valores protegidos</span>
                  )}

                  {/* Data */}
                  <div style={{ fontSize: 11, color: C.textTer, flexShrink: 0 }}>
                    {fmtDate(deal.closed_at)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </AdminShell>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, bg, emoji,
}: {
  label: string
  value: string
  sub:   string
  color: string
  bg:    string
  emoji: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: '12px 14px',
      border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.1, marginBottom: 3 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 2 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 10, color, opacity: 0.7 }}>{sub}</div>
      )}
    </div>
  )
}
