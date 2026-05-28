// =============================================================================
// /admin/eventos/gauchinho/leads — Lista de leads do evento construtora
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • masterOnly: unit_admin e unit_viewer são redirecionados para /admin
//   • event_leads é isolado da tabela leads normal
// =============================================================================

import type { CSSProperties, ReactNode } from 'react'
import { redirect }                  from 'next/navigation'
import { requireAdmin }              from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                from '@/app/admin/_AdminShell'
import { C }                         from '@/app/components/ui'
import { SituacaoSelect }            from './_SituacaoSelect'

export const metadata = { title: 'Leads Evento Construtora · Admin DNA Financeiro' }

// ── Tipo do registro ──────────────────────────────────────────────────────────

type EventLeadRow = {
  id:                          string
  name:                        string
  whatsapp:                    string
  city:                        string | null
  empreendimento:              string | null
  torre:                       string | null
  apartamento:                 string | null
  valor_imovel:                number | null
  valor_entrega:               number | null
  valor_entrada_disponivel:    number | null
  renda_aproximada:            number | null
  precisa_financiamento:       boolean | null
  interesse_consorcio:         boolean | null
  interesse_carta_contemplada: boolean | null
  interesse_credito:           boolean | null
  interesse_plano_pontual:     boolean | null
  melhor_horario_contato:      string | null
  consent_share_builder:       boolean
  consent_contact:             boolean
  situacao:                    string
  created_at:                  string
  unit_id:                     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function waLink(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7)  return `${days} dias atrás`
  return `${Math.floor(days / 7)} sem. atrás`
}

function interestsOf(l: EventLeadRow): string[] {
  const r: string[] = []
  if (l.precisa_financiamento)       r.push('Financiamento')
  if (l.interesse_consorcio)         r.push('Consórcio')
  if (l.interesse_carta_contemplada) r.push('Carta contemplada')
  if (l.interesse_credito)           r.push('Crédito')
  if (l.interesse_plano_pontual)     r.push('Plano Pontual')
  return r
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AdminGauchinhoLeadsPage({ searchParams }: Props) {
  const session = await requireAdmin()
  if (session.role !== 'master') redirect('/admin')

  const supabase = createServerSupabaseClient()
  const sp       = await searchParams

  const q         = sp.q        ?? ''
  const periodF   = sp.period   ?? ''
  const interesseF = sp.interesse ?? ''
  const consentF  = sp.consent  ?? ''

  // ── Query DB ──────────────────────────────────────────────────────────────
  const { data: allRaw } = await supabase
    .from('event_leads')
    .select([
      'id', 'name', 'whatsapp', 'city', 'empreendimento', 'torre', 'apartamento',
      'valor_imovel', 'valor_entrega', 'valor_entrada_disponivel', 'renda_aproximada',
      'precisa_financiamento', 'interesse_consorcio', 'interesse_carta_contemplada',
      'interesse_credito', 'interesse_plano_pontual',
      'melhor_horario_contato', 'consent_share_builder', 'consent_contact',
      'situacao', 'created_at', 'unit_id',
    ].join(', '))
    .eq('event_key', 'gauchinho_construtora')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  const allLeads = (allRaw ?? []) as EventLeadRow[]

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const todayStart   = new Date(); todayStart.setHours(0, 0, 0, 0)

  const kpi = {
    total:        allLeads.length,
    hoje:         allLeads.filter(l => new Date(l.created_at) >= todayStart).length,
    construtora:  allLeads.filter(l => l.consent_share_builder).length,
    financiamento: allLeads.filter(l => l.precisa_financiamento).length,
    consorcio:    allLeads.filter(l => l.interesse_consorcio).length,
    carta:        allLeads.filter(l => l.interesse_carta_contemplada).length,
  }

  // ── Filtros in-memory ─────────────────────────────────────────────────────
  let leads = allLeads

  if (q) {
    const lq  = q.toLowerCase()
    const lqD = q.replace(/\D/g, '')
    leads = leads.filter(l =>
      l.name.toLowerCase().includes(lq) ||
      (lqD && l.whatsapp.replace(/\D/g, '').includes(lqD)),
    )
  }

  const now = Date.now()
  if (periodF === 'today') leads = leads.filter(l => new Date(l.created_at) >= todayStart)
  if (periodF === '7d')    leads = leads.filter(l => new Date(l.created_at) >= new Date(now - 7 * 86_400_000))
  if (periodF === '30d')   leads = leads.filter(l => new Date(l.created_at) >= new Date(now - 30 * 86_400_000))

  if (interesseF === 'financiamento') leads = leads.filter(l => l.precisa_financiamento)
  if (interesseF === 'consorcio')     leads = leads.filter(l => l.interesse_consorcio)
  if (interesseF === 'carta')         leads = leads.filter(l => l.interesse_carta_contemplada)
  if (interesseF === 'credito')       leads = leads.filter(l => l.interesse_credito)
  if (interesseF === 'pontual')       leads = leads.filter(l => l.interesse_plano_pontual)

  if (consentF === 'construtora')   leads = leads.filter(l => l.consent_share_builder)
  if (consentF === 'sem_consent')   leads = leads.filter(l => !l.consent_share_builder)

  // ── URL builder ───────────────────────────────────────────────────────────
  function buildUrl(extra: Record<string, string>): string {
    const merged: Record<string, string> = {
      ...(q          && { q }),
      ...(periodF    && { period:    periodF    }),
      ...(interesseF && { interesse: interesseF }),
      ...(consentF   && { consent:   consentF   }),
      ...extra,
    }
    const params = new URLSearchParams(merged)
    Array.from(params.entries()).forEach(([k, v]) => { if (!v) params.delete(k) })
    const qs = params.toString()
    return `/admin/eventos/gauchinho/leads${qs ? `?${qs}` : ''}`
  }

  const hasFilter = !!(q || periodF || interesseF || consentF)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminShell
      session={session}
      title="Leads · Evento Construtora"
      back={{ href: '/admin/eventos', label: 'Eventos' }}
    >

      {/* Cabeçalho */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
          🏠 Evento Construtora — Gauchinho
        </h1>
        <p style={{ fontSize: 12, color: C.textSec, margin: '3px 0 0' }}>
          {kpi.total} {kpi.total === 1 ? 'lead cadastrado' : 'leads cadastrados'} · Evento gauchinho_construtora
        </p>
      </div>

      {/* KPI chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <KpiChip emoji="👥" label="Total"             value={kpi.total}         href={buildUrl({ period: '', interesse: '', consent: '' })} active={!hasFilter} />
        <KpiChip emoji="🆕" label="Hoje"              value={kpi.hoje}          href={buildUrl({ period: 'today' })}                        active={periodF === 'today'} />
        <KpiChip emoji="🏗️" label="p/ Construtora"   value={kpi.construtora}   href={buildUrl({ consent: 'construtora' })}                 active={consentF === 'construtora'} />
        <KpiChip emoji="🏦" label="Financiamento"    value={kpi.financiamento} href={buildUrl({ interesse: 'financiamento' })}             active={interesseF === 'financiamento'} />
        <KpiChip emoji="📅" label="Consórcio"        value={kpi.consorcio}     href={buildUrl({ interesse: 'consorcio' })}                 active={interesseF === 'consorcio'} />
        <KpiChip emoji="💳" label="Carta contempl."  value={kpi.carta}         href={buildUrl({ interesse: 'carta' })}                    active={interesseF === 'carta'} />
      </div>

      {/* Filtro período */}
      <FilterRow label="Período">
        <a href={buildUrl({ period: '' })}      style={pill(!periodF)}>Qualquer</a>
        <a href={buildUrl({ period: 'today' })} style={pill(periodF === 'today')}>Hoje</a>
        <a href={buildUrl({ period: '7d' })}    style={pill(periodF === '7d')}>7 dias</a>
        <a href={buildUrl({ period: '30d' })}   style={pill(periodF === '30d')}>30 dias</a>
      </FilterRow>

      {/* Filtro interesse */}
      <FilterRow label="Interesse">
        <a href={buildUrl({ interesse: '' })}               style={pill(!interesseF)}>Todos</a>
        <a href={buildUrl({ interesse: 'financiamento' })}  style={pill(interesseF === 'financiamento')}>Financiamento</a>
        <a href={buildUrl({ interesse: 'consorcio' })}      style={pill(interesseF === 'consorcio')}>Consórcio</a>
        <a href={buildUrl({ interesse: 'carta' })}          style={pill(interesseF === 'carta')}>Carta contempl.</a>
        <a href={buildUrl({ interesse: 'credito' })}        style={pill(interesseF === 'credito')}>Crédito</a>
        <a href={buildUrl({ interesse: 'pontual' })}        style={pill(interesseF === 'pontual')}>Plano Pontual</a>
      </FilterRow>

      {/* Filtro consentimento */}
      <FilterRow label="Construtora">
        <a href={buildUrl({ consent: '' })}                style={pill(!consentF)}>Todos</a>
        <a href={buildUrl({ consent: 'construtora' })}     style={pill(consentF === 'construtora')}>Com consentimento</a>
        <a href={buildUrl({ consent: 'sem_consent' })}     style={pill(consentF === 'sem_consent')}>Sem consentimento</a>
      </FilterRow>

      {/* Busca */}
      <form method="get" action="/admin/eventos/gauchinho/leads"
        style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {periodF    && <input type="hidden" name="period"    value={periodF}    />}
        {interesseF && <input type="hidden" name="interesse" value={interesseF} />}
        {consentF   && <input type="hidden" name="consent"   value={consentF}   />}
        <input
          type="search" name="q" defaultValue={q}
          placeholder="🔍 Buscar por nome ou WhatsApp..."
          style={{
            flex: 1, minWidth: 200,
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '9px 14px', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', background: '#fff',
          }}
        />
        <button type="submit" style={{
          background: C.purple, color: '#fff', border: 'none',
          borderRadius: 10, padding: '9px 18px',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Buscar
        </button>
        {q && <a href={buildUrl({ q: '' })} style={{
          display: 'flex', alignItems: 'center',
          border: `1px solid ${C.border}`, borderRadius: 10,
          padding: '9px 14px', fontSize: 13,
          textDecoration: 'none', color: C.textSec, background: '#fff',
        }}>✕</a>}
      </form>

      {/* Exportar + contador */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: C.textSec, margin: 0, fontWeight: 500 }}>
          {leads.length === allLeads.length
            ? `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`
            : `${leads.length} de ${allLeads.length} (filtro aplicado)`}
        </p>
        <a
          href="/api/admin/eventos/gauchinho/export"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
            color: '#fff', borderRadius: 10,
            padding: '8px 16px', fontSize: 12, fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(29,158,117,.3)',
          }}
        >
          📥 Exportar Excel para construtora
        </a>
      </div>

      {/* Aviso sobre exportação */}
      <div style={{
        background: '#FAEEDA', borderRadius: 10,
        padding: '10px 14px', marginBottom: 14,
        border: '1px solid rgba(239,159,39,0.3)',
      }}>
        <p style={{ margin: 0, fontSize: 11, color: C.amberDark }}>
          ⚠️ A exportação Excel inclui apenas leads com <strong>consentimento para compartilhamento com a construtora</strong>{' '}
          ({kpi.construtora} lead{kpi.construtora !== 1 ? 's' : ''}).
        </p>
      </div>

      {/* Lista */}
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
            {hasFilter ? 'Ajuste os filtros ou limpe a busca.' : 'Ainda não há leads cadastrados para este evento.'}
          </p>
          {hasFilter && (
            <a href="/admin/eventos/gauchinho/leads" style={{
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
            const interests = interestsOf(lead)
            return (
              <div key={lead.id} style={{
                background: '#fff',
                borderRadius: 14,
                border: `0.5px solid ${C.border}`,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px' }}>

                  {/* Linha 1: nome + badges + WA */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.purple}25, ${C.purpleDeep}15)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: C.purpleDeep,
                    }}>
                      {lead.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{lead.name}</span>
                        {lead.consent_share_builder && (
                          <span style={{
                            background: C.greenBg, color: C.greenDark,
                            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                          }}>🏗️ Construtora</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                        {fmtPhone(lead.whatsapp)}
                        {lead.city && <span> · {lead.city}</span>}
                      </div>
                    </div>
                    <a href={waLink(lead.whatsapp)} target="_blank" rel="noopener noreferrer"
                      title="WhatsApp"
                      style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: '#E7F7EE', border: '1px solid #C3EDD4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textDecoration: 'none', fontSize: 14,
                      }}>💬</a>
                  </div>

                  {/* Empreendimento */}
                  {lead.empreendimento && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{
                        background: C.amberBg, color: C.amberDark,
                        fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                      }}>
                        🏢 {lead.empreendimento}
                        {lead.apartamento && ` · Apto ${lead.apartamento}`}
                      </span>
                    </div>
                  )}

                  {/* Valores */}
                  {(lead.valor_entrega || lead.valor_imovel) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {lead.valor_imovel && (
                        <span style={{
                          background: C.bgSecondary, color: C.textSec,
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                        }}>Imóvel: {fmtBRL(lead.valor_imovel)}</span>
                      )}
                      {lead.valor_entrega && (
                        <span style={{
                          background: '#FEE2E2', color: '#991B1B',
                          fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                        }}>Entrega: {fmtBRL(lead.valor_entrega)}</span>
                      )}
                      {lead.valor_entrada_disponivel && (
                        <span style={{
                          background: C.greenBg, color: C.greenDark,
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                        }}>Tem: {fmtBRL(lead.valor_entrada_disponivel)}</span>
                      )}
                    </div>
                  )}

                  {/* Interesses */}
                  {interests.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                      {interests.map(i => (
                        <span key={i} style={{
                          background: C.purpleBg, color: C.purpleDeep,
                          fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                        }}>
                          {i}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Situação */}
                  <div style={{ marginBottom: 8 }}>
                    <SituacaoSelect leadId={lead.id} initial={lead.situacao} />
                  </div>

                  {/* Linha de rodapé */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 10, color: C.textSec }}>
                      📅 {fmtRelative(lead.created_at)} — {fmtDate(lead.created_at)}
                    </span>
                    <a href={`/admin/eventos/gauchinho/leads/${lead.id}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '5px 11px', fontSize: 11,
                      textDecoration: 'none', color: C.textSec, background: '#fff',
                      fontWeight: 500, whiteSpace: 'nowrap',
                    }}>
                      📎 Ver detalhes →
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

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 10, color: C.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 }}>
        {label}:
      </span>
      {children}
    </div>
  )
}

function KpiChip({ emoji, label, value, href, active }: {
  emoji: string; label: string; value: number; href: string; active: boolean
}) {
  return (
    <a href={href} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: active ? C.purpleBg : '#fff',
      border: active ? `1.5px solid ${C.purple}40` : `0.5px solid ${C.border}`,
      borderRadius: 10, padding: '7px 12px', textDecoration: 'none',
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
