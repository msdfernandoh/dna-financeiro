// =============================================================================
// /admin/leads — Lista de leads por unidade
//
// SEGURANÇA:
//   • requireAdmin() valida sessão — redireciona se não autenticado
//   • master vê todos os leads (sem filtro de unidade)
//   • unit_admin vê apenas leads da sua unidade (eq unit_id)
//   • unit_viewer vê apenas leads da sua unidade (eq unit_id)
//   • Nenhuma coluna sensível (monthly_income, expenses, UTMs, consent) é selecionada
//   • KPIs calculados do set completo (pré-filtro in-memory)
//   • unit_id não é exposto no frontend (apenas unit_slug para exibição)
// =============================================================================

import type { CSSProperties }        from 'react'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '../_AdminShell'
import { C }                          from '@/app/components/ui'

// ── Constantes ────────────────────────────────────────────────────────────────

const DREAM_LABELS: Record<string, string> = {
  casa:          'Casa própria',
  carro:         'Carro',
  negocio:       'Negócio',
  viagem:        'Viagem',
  dividas:       'Quitar dívidas',
  educacao:      'Educação',
  aposentadoria: 'Aposentadoria',
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  new:         { label: 'Novo',         bg: C.bgSecondary, color: C.textSec    },
  in_progress: { label: 'Em progresso', bg: C.amberBg,     color: C.amberDark  },
  qualified:   { label: 'Qualificado',  bg: C.greenBg,     color: C.greenDark  },
  converted:   { label: 'Convertido',   bg: C.purpleBg,    color: C.purpleDeep },
  inactive:    { label: 'Inativo',      bg: '#FEE2E2',     color: '#991B1B'    },
}

// ── Tipo do registro da query ──────────────────────────────────────────────────

type LeadRow = {
  id:           string
  name:         string
  phone:        string
  city:         string | null
  main_dream:   string | null
  dna_progress: number
  status:       string
  last_seen_at: string | null
  created_at:   string
  unit_id:      string    // nunca exposto no HTML — usado apenas para lookup de nome
  unit_slug:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7)  return `${days} dias atrás`
  if (days < 30) return `${Math.floor(days / 7)} semanas atrás`
  const months = Math.floor(days / 30)
  return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function waLink(phone: string): string {
  const d   = phone.replace(/\D/g, '')
  const num = d.startsWith('55') ? d : `55${d}`
  return `https://wa.me/${num}`
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AdminLeadsPage({ searchParams }: Props) {
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()
  const sp       = await searchParams

  const q       = sp.q      ?? ''
  const dreamF  = sp.dream  ?? ''
  const statusF = sp.status ?? ''
  const dnaF    = sp.dna    ?? ''     // 'complete' | 'incomplete'
  const periodF = sp.period ?? ''     // 'today' | '7d' | '30d'
  const unitF   = session.role === 'master' ? (sp.unit ?? '') : ''

  // ── Query DB: apenas filtro de unidade (segurança) ─────────────────────────
  // Todos os outros filtros são aplicados in-memory para KPIs corretos.
  // Colunas sensíveis (monthly_income, expenses, UTMs, consent) NÃO são selecionadas.

  let dbQ = supabase
    .from('leads')
    .select('id, name, phone, city, main_dream, dna_progress, status, last_seen_at, created_at, unit_id, unit_slug')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (session.role !== 'master') {
    // unit_admin e unit_viewer: apenas a própria unidade
    dbQ = dbQ.eq('unit_id', session.unitId!)
  } else if (unitF) {
    // master filtrado por slug de unidade — resolve unit_id via banco
    const { data: tu } = await supabase
      .from('units').select('id').eq('slug', unitF).is('deleted_at', null).single()
    if (tu) dbQ = dbQ.eq('unit_id', tu.id)
  }

  const { data: allLeadsRaw } = await dbQ
  const allLeads = (allLeadsRaw ?? []) as LeadRow[]

  // ── KPIs do set completo (antes dos filtros in-memory) ────────────────────

  const now          = Date.now()
  const todayStart   = new Date(); todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(now - 7 * 86_400_000)

  const kpi = {
    total:        allLeads.length,
    hoje:         allLeads.filter(l => new Date(l.created_at) >= todayStart).length,
    sete_dias:    allLeads.filter(l => new Date(l.created_at) >= sevenDaysAgo).length,
    dna_ok:       allLeads.filter(l => l.dna_progress === 100).length,
    qualificados: allLeads.filter(l => l.status === 'qualified' || l.status === 'converted').length,
  }

  // ── Filtros in-memory ──────────────────────────────────────────────────────

  let leads = allLeads

  if (q) {
    const lq = q.toLowerCase()
    const lqD = q.replace(/\D/g, '')
    leads = leads.filter(l =>
      l.name.toLowerCase().includes(lq) ||
      (lqD && l.phone.replace(/\D/g, '').includes(lqD)) ||
      l.phone.includes(lq),
    )
  }
  if (dreamF)                  leads = leads.filter(l => l.main_dream === dreamF)
  if (statusF)                 leads = leads.filter(l => l.status     === statusF)
  if (dnaF === 'complete')     leads = leads.filter(l => l.dna_progress === 100)
  if (dnaF === 'incomplete')   leads = leads.filter(l => l.dna_progress < 100)
  if (periodF === 'today')     leads = leads.filter(l => new Date(l.created_at) >= todayStart)
  if (periodF === '7d')        leads = leads.filter(l => new Date(l.created_at) >= sevenDaysAgo)
  if (periodF === '30d')       leads = leads.filter(l => new Date(l.created_at) >= new Date(now - 30 * 86_400_000))

  // ── Units: id → nome (master only) ────────────────────────────────────────

  const unitNames: Record<string, string> = {}
  let unitsList: { id: string; name: string; slug: string }[] = []

  if (session.role === 'master') {
    const { data: units } = await supabase
      .from('units').select('id, name, slug')
      .eq('active', true).is('deleted_at', null).order('name')
    for (const u of units ?? []) unitNames[u.id] = u.name
    unitsList = units ?? []
  }

  // ── URL builder (preserva filtros ao navegar) ─────────────────────────────

  function buildUrl(extra: Record<string, string>): string {
    const merged: Record<string, string> = {
      ...(q       && { q }),
      ...(dreamF  && { dream:  dreamF  }),
      ...(statusF && { status: statusF }),
      ...(dnaF    && { dna:    dnaF    }),
      ...(periodF && { period: periodF }),
      ...(unitF && session.role === 'master' && { unit: unitF }),
      ...extra,
    }
    const params = new URLSearchParams(merged)
    Array.from(params.entries()).forEach(([k, v]) => { if (!v) params.delete(k) })
    const qs = params.toString()
    return `/admin/leads${qs ? `?${qs}` : ''}`
  }

  const hasAnyFilter = !!(q || dreamF || statusF || dnaF || periodF)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AdminShell session={session} title="Leads">

      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
          Leads
        </h1>
        <p style={{ fontSize: 12, color: C.textSec, margin: '3px 0 0' }}>
          {kpi.total} {kpi.total === 1 ? 'lead cadastrado' : 'leads cadastrados'}
          {session.role === 'master' && !unitF && ' · todas as unidades'}
          {unitF && ` · ${unitsList.find(u => u.slug === unitF)?.name ?? unitF}`}
        </p>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <KpiChip emoji="👥" label="Total"          value={kpi.total}        href="/admin/leads"                       active={!hasAnyFilter && !unitF} />
        <KpiChip emoji="🆕" label="Hoje"           value={kpi.hoje}         href={buildUrl({ period: 'today' })}      active={periodF === 'today'}     />
        <KpiChip emoji="📅" label="Últimos 7 dias" value={kpi.sete_dias}    href={buildUrl({ period: '7d' })}         active={periodF === '7d'}        />
        <KpiChip emoji="🧬" label="DNA completo"   value={kpi.dna_ok}       href={buildUrl({ dna: 'complete' })}      active={dnaF === 'complete'}     />
        <KpiChip emoji="⭐" label="Qualificados"   value={kpi.qualificados} href={buildUrl({ status: 'qualified' })}  active={statusF === 'qualified'} />
      </div>

      {/* ── Filtro por unidade (master only) ── */}
      {session.role === 'master' && (
        <FilterRow label="Unidade">
          <a href={buildUrl({ unit: '' })} style={pill(!unitF)}>Todas</a>
          {unitsList.map(u => (
            <a key={u.id} href={buildUrl({ unit: u.slug })} style={pill(unitF === u.slug)}>
              {u.name}
            </a>
          ))}
        </FilterRow>
      )}

      {/* ── Filtro por sonho ── */}
      <FilterRow label="Sonho">
        <a href={buildUrl({ dream: '' })} style={pill(!dreamF)}>Todos</a>
        {Object.entries(DREAM_LABELS).map(([k, v]) => (
          <a key={k} href={buildUrl({ dream: k })} style={pill(dreamF === k)}>{v}</a>
        ))}
      </FilterRow>

      {/* ── Filtro por status ── */}
      <FilterRow label="Status">
        <a href={buildUrl({ status: '' })} style={pill(!statusF)}>Todos</a>
        {Object.entries(STATUS_META).map(([k, v]) => (
          <a key={k} href={buildUrl({ status: k })} style={pill(statusF === k)}>{v.label}</a>
        ))}
      </FilterRow>

      {/* ── Filtro por DNA + período (mesma linha) ── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <FilterRow label="DNA" inline>
          <a href={buildUrl({ dna: '' })}           style={pill(!dnaF)}>Todos</a>
          <a href={buildUrl({ dna: 'complete' })}   style={pill(dnaF === 'complete')}>Completo</a>
          <a href={buildUrl({ dna: 'incomplete' })} style={pill(dnaF === 'incomplete')}>Incompleto</a>
        </FilterRow>
        <FilterRow label="Período" inline>
          <a href={buildUrl({ period: '' })}      style={pill(!periodF)}>Qualquer</a>
          <a href={buildUrl({ period: 'today' })} style={pill(periodF === 'today')}>Hoje</a>
          <a href={buildUrl({ period: '7d' })}    style={pill(periodF === '7d')}>7 dias</a>
          <a href={buildUrl({ period: '30d' })}   style={pill(periodF === '30d')}>30 dias</a>
        </FilterRow>
      </div>

      {/* ── Busca por nome / telefone ── */}
      <form method="get" action="/admin/leads" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Preserva filtros ativos como hidden fields */}
        {dreamF  && <input type="hidden" name="dream"  value={dreamF}  />}
        {statusF && <input type="hidden" name="status" value={statusF} />}
        {dnaF    && <input type="hidden" name="dna"    value={dnaF}    />}
        {periodF && <input type="hidden" name="period" value={periodF} />}
        {unitF   && <input type="hidden" name="unit"   value={unitF}   />}

        <input
          type="search" name="q" defaultValue={q}
          placeholder="🔍 Buscar por nome ou telefone..."
          style={{
            flex: 1, minWidth: 200,
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '9px 14px', fontSize: 13,
            fontFamily: 'inherit', outline: 'none', background: '#fff',
          }}
        />
        <button type="submit" style={{
          background: C.purple, color: '#fff', border: 'none',
          borderRadius: 10, padding: '9px 18px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Buscar
        </button>
        {q && (
          <a href={buildUrl({ q: '' })} style={{
            display: 'flex', alignItems: 'center',
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '9px 14px', fontSize: 13,
            textDecoration: 'none', color: C.textSec, background: '#fff',
          }}>✕</a>
        )}
      </form>

      {/* ── Contador de resultados ── */}
      <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 10px', fontWeight: 500 }}>
        {leads.length === allLeads.length
          ? `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`
          : `${leads.length} de ${allLeads.length} (filtro aplicado)`}
        {q && <span> · busca: <b>&quot;{q}&quot;</b></span>}
      </p>

      {/* ── Lista ── */}
      {leads.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
          padding: '40px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>🔍</p>
          <p style={{ fontSize: 14, color: C.text, fontWeight: 500, margin: '0 0 4px' }}>
            Nenhum lead encontrado.
          </p>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 16px' }}>
            {hasAnyFilter ? 'Ajuste os filtros ou limpe a busca.' : 'Ainda não há leads cadastrados.'}
          </p>
          {hasAnyFilter && (
            <a href="/admin/leads" style={{
              display: 'inline-block', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '8px 16px',
              fontSize: 12, textDecoration: 'none', color: C.textSec,
            }}>
              ✕ Limpar filtros
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leads.map(lead => {
            const sMeta     = STATUS_META[lead.status] ?? STATUS_META.new
            const dreamLbl  = DREAM_LABELS[lead.main_dream ?? ''] ?? lead.main_dream ?? null
            const unitName  = unitNames[lead.unit_id]

            return (
              <div key={lead.id} style={{
                background: '#fff', borderRadius: 14,
                border: `0.5px solid ${C.border}`, overflow: 'hidden',
              }}>

                {/* Barra de unidade (master only) */}
                {session.role === 'master' && unitName && (
                  <div style={{ background: C.bgSecondary, padding: '4px 14px' }}>
                    <span style={{ fontSize: 10, color: C.textSec, fontWeight: 500 }}>
                      📍 {unitName}
                    </span>
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>

                  {/* Linha 1: avatar + nome + status + WhatsApp */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>

                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.purple}25, ${C.purpleDeep}15)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, fontWeight: 700, color: C.purpleDeep,
                      userSelect: 'none',
                    }}>
                      {lead.name.trim().charAt(0).toUpperCase()}
                    </div>

                    {/* Nome + info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                          {lead.name}
                        </span>
                        <span style={{
                          background: sMeta.bg, color: sMeta.color,
                          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                          textTransform: 'uppercase', letterSpacing: 0.3,
                        }}>
                          {sMeta.label}
                        </span>
                        {lead.dna_progress === 100 && (
                          <span style={{
                            background: C.purpleBg, color: C.purpleDeep,
                            fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                          }}>
                            🧬 DNA Completo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSec, marginTop: 3 }}>
                        {fmtPhone(lead.phone)}
                        {lead.city && <span> · {lead.city}</span>}
                      </div>
                    </div>

                    {/* WhatsApp */}
                    <a
                      href={waLink(lead.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no WhatsApp"
                      style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: '#E7F7EE', border: '1px solid #C3EDD4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textDecoration: 'none', fontSize: 15,
                      }}
                    >
                      💬
                    </a>
                  </div>

                  {/* Linha 2: sonho + barra de DNA */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    {dreamLbl && (
                      <span style={{
                        background: C.amberBg, color: C.amberDark,
                        fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                      }}>
                        🌟 {dreamLbl}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 80 }}>
                      <div style={{
                        flex: 1, height: 5, background: C.bgSecondary,
                        borderRadius: 99, overflow: 'hidden', maxWidth: 90,
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${lead.dna_progress}%`,
                          background: lead.dna_progress === 100
                            ? C.green : lead.dna_progress >= 50 ? C.purple : C.amber,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: C.textSec, whiteSpace: 'nowrap' }}>
                        DNA {lead.dna_progress}%
                      </span>
                    </div>
                  </div>

                  {/* Linha 3: datas + link para detalhe */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: C.textSec }}>
                        📅 Cadastrou {fmtRelative(lead.created_at)}
                      </span>
                      {lead.last_seen_at && (
                        <span style={{ fontSize: 10, color: C.textSec }}>
                          👁️ Visto {fmtRelative(lead.last_seen_at)}
                        </span>
                      )}
                    </div>
                    <a
                      href={`/admin/leads/${lead.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: '5px 11px', fontSize: 11,
                        textDecoration: 'none', color: C.textSec, background: '#fff',
                        fontWeight: 500, whiteSpace: 'nowrap',
                      }}
                    >
                      Ver detalhes →
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

// ── Sub-componentes ──────────────────────────────────────────────────────────

function pill(active: boolean): CSSProperties {
  return {
    display: 'inline-block',
    border:      active ? `1.5px solid ${C.purple}` : `1px solid ${C.border}`,
    borderRadius: 99, padding: '4px 10px',
    fontSize: 11, textDecoration: 'none',
    background: active ? C.purpleBg : '#fff',
    color:      active ? C.purpleDeep : C.textSec,
    fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap',
  }
}

function FilterRow({
  label, children, inline = false,
}: {
  label: string; children: React.ReactNode; inline?: boolean
}) {
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
      marginBottom: inline ? 0 : 10,
    }}>
      <span style={{
        fontSize: 10, color: C.textSec, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0,
      }}>
        {label}:
      </span>
      {children}
    </div>
  )
}

function KpiChip({
  emoji, label, value, href, active,
}: {
  emoji: string; label: string; value: number; href: string; active: boolean
}) {
  return (
    <a href={href} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: active ? C.purpleBg : '#fff',
      border: active ? `1.5px solid ${C.purple}40` : `0.5px solid ${C.border}`,
      borderRadius: 10, padding: '7px 12px',
      textDecoration: 'none', transition: 'all .15s',
    }}>
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: active ? C.purpleDeep : C.text, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: active ? C.purpleDeep : C.textSec, fontWeight: 500, marginTop: 1 }}>
          {label}
        </div>
      </div>
    </a>
  )
}
