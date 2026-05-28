// =============================================================================
// /admin/eventos/gauchinho — Lista de leads do evento Gauchinho x Construtora
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • masterOnly: redireciona se role !== 'master'
//   • Filtra sempre: event_key = 'gauchinho_construtora', deleted_at IS NULL
//   • Exportação Excel apenas com consent_share_builder = true (Route Handler)
// =============================================================================

import type { CSSProperties }         from 'react'
import { redirect }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '../../_AdminShell'
import { C }                          from '@/app/components/ui'
import type { EventLead }             from '@/types/database'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type LeadRow = Pick<EventLead,
  | 'id' | 'name' | 'whatsapp' | 'empreendimento' | 'torre' | 'apartamento'
  | 'valor_imovel' | 'precisa_financiamento' | 'interesse_consorcio'
  | 'interesse_carta_contemplada' | 'interesse_credito' | 'interesse_plano_pontual'
  | 'consent_share_builder' | 'consent_contact' | 'created_at'
>

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return phone
}

function waLink(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/55${d}`
}

function fmtBRL(v: number | null): string {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function interestsLabel(lead: LeadRow): string[] {
  const lst: string[] = []
  if (lead.precisa_financiamento)       lst.push('Financiamento')
  if (lead.interesse_consorcio)         lst.push('Consórcio')
  if (lead.interesse_carta_contemplada) lst.push('Carta contemplada')
  if (lead.interesse_credito)           lst.push('Crédito')
  if (lead.interesse_plano_pontual)     lst.push('Plano Pontual')
  return lst
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function AdminGauchinhoLeadsPage({ searchParams }: Props) {
  const session = await requireAdmin()

  // masterOnly
  if (session.role !== 'master') redirect('/admin')

  const supabase = createServerSupabaseClient()
  const sp       = await searchParams

  const q       = sp.q      ?? ''
  const emprF   = sp.empre  ?? ''
  const periodF = sp.period ?? ''
  const shareF  = sp.share  ?? ''  // 'sim' | 'nao' | ''

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: rawLeads } = await supabase
    .from('event_leads')
    .select(`
      id, name, whatsapp, empreendimento, torre, apartamento,
      valor_imovel,
      precisa_financiamento, interesse_consorcio,
      interesse_carta_contemplada, interesse_credito, interesse_plano_pontual,
      consent_share_builder, consent_contact,
      created_at
    `)
    .eq('event_key', 'gauchinho_construtora')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const allLeads = (rawLeads ?? []) as LeadRow[]

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const now         = Date.now()
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(now - 7 * 86_400_000)

  const kpi = {
    total:        allLeads.length,
    hoje:         allLeads.filter(l => new Date(l.created_at) >= todayStart).length,
    semana:       allLeads.filter(l => new Date(l.created_at) >= sevenDaysAgo).length,
    com_consent:  allLeads.filter(l => l.consent_share_builder).length,
    por_empre:    [...new Set(allLeads.map(l => l.empreendimento).filter(Boolean))].length,
  }

  // ── Empreendimentos únicos (para filtro) ───────────────────────────────────
  const empreendimentos = [...new Set(allLeads.map(l => l.empreendimento).filter(Boolean))] as string[]

  // ── Filtros in-memory ──────────────────────────────────────────────────────
  let leads = allLeads

  if (q) {
    const lq = q.toLowerCase().trim()
    leads = leads.filter(l =>
      l.name.toLowerCase().includes(lq) ||
      l.whatsapp.includes(lq.replace(/\D/g, '')) ||
      (l.empreendimento?.toLowerCase().includes(lq)) ||
      (l.apartamento?.toLowerCase().includes(lq)),
    )
  }
  if (emprF)           leads = leads.filter(l => l.empreendimento === emprF)
  if (shareF === 'sim') leads = leads.filter(l => l.consent_share_builder)
  if (shareF === 'nao') leads = leads.filter(l => !l.consent_share_builder)
  if (periodF === 'today') leads = leads.filter(l => new Date(l.created_at) >= todayStart)
  if (periodF === '7d')    leads = leads.filter(l => new Date(l.created_at) >= sevenDaysAgo)
  if (periodF === '30d')   leads = leads.filter(l => new Date(l.created_at) >= new Date(now - 30 * 86_400_000))

  const hasFilter = !!(q || emprF || shareF || periodF)

  // ── URL builder ────────────────────────────────────────────────────────────
  function buildUrl(extra: Record<string, string>): string {
    const merged = {
      ...(q       && { q }),
      ...(emprF   && { empre: emprF }),
      ...(shareF  && { share: shareF }),
      ...(periodF && { period: periodF }),
      ...extra,
    }
    const params = new URLSearchParams(merged)
    Array.from(params.entries()).forEach(([k, v]) => { if (!v) params.delete(k) })
    const qs = params.toString()
    return `/admin/eventos/gauchinho${qs ? `?${qs}` : ''}`
  }

  // ── Export URL (filtra consent_share_builder=true automaticamente) ─────────
  const exportUrl = '/api/admin/eventos/gauchinho/export'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminShell
      session={session}
      title="Gauchinho × Construtora"
      back={{ href: '/admin/eventos', label: 'Eventos' }}
    >

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
            🏗️ Gauchinho × Construtora
          </h1>
          <p style={{ fontSize: 12, color: C.textSec, margin: '3px 0 0' }}>
            {kpi.total} {kpi.total === 1 ? 'lead cadastrado' : 'leads cadastrados'} · event_key: gauchinho_construtora
          </p>
        </div>

        {/* Botão exportar Excel */}
        <a
          href={exportUrl}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1D7E4A', color: '#fff',
            border: 'none', borderRadius: 10,
            padding: '9px 16px', fontSize: 12, fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(29,126,74,.3)',
          }}
        >
          📥 Exportar Excel
        </a>
      </div>

      {/* ── Aviso exportação ── */}
      <div style={{
        background: C.greenBg, borderRadius: 10,
        border: `1px solid ${C.green}25`,
        padding: '10px 14px', marginBottom: 16,
      }}>
        <p style={{ margin: 0, fontSize: 11, color: C.greenDark, lineHeight: 1.5 }}>
          📥 <strong>Exportação Excel</strong> filtra automaticamente apenas leads com{' '}
          <strong>consentimento de compartilhamento com a construtora</strong> ({kpi.com_consent} de {kpi.total}).
        </p>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <KpiChip emoji="🧑‍🤝‍🧑" label="Total"    value={kpi.total}        href={buildUrl({})}                    active={!hasFilter} />
        <KpiChip emoji="🆕"       label="Hoje"     value={kpi.hoje}         href={buildUrl({ period: 'today' })}   active={periodF === 'today'} />
        <KpiChip emoji="📅"       label="7 dias"   value={kpi.semana}       href={buildUrl({ period: '7d' })}      active={periodF === '7d'} />
        <KpiChip emoji="✅"       label="Consent"  value={kpi.com_consent}  href={buildUrl({ share: 'sim' })}      active={shareF === 'sim'} />
        <KpiChip emoji="🏗️"      label="Empreend." value={kpi.por_empre}   href={buildUrl({})}                    active={false} />
      </div>

      {/* ── Filtro por empreendimento ── */}
      {empreendimentos.length > 0 && (
        <FilterRow label="Empreendimento">
          <a href={buildUrl({ empre: '' })} style={pill(!emprF)}>Todos</a>
          {empreendimentos.map(e => (
            <a key={e} href={buildUrl({ empre: e })} style={pill(emprF === e)}>{e}</a>
          ))}
        </FilterRow>
      )}

      {/* ── Filtro por consentimento ── */}
      <FilterRow label="Compartilhamento">
        <a href={buildUrl({ share: '' })}    style={pill(!shareF)}>Todos</a>
        <a href={buildUrl({ share: 'sim' })} style={pill(shareF === 'sim')}>✅ Com consentimento</a>
        <a href={buildUrl({ share: 'nao' })} style={pill(shareF === 'nao')}>❌ Sem consentimento</a>
      </FilterRow>

      {/* ── Filtro por período ── */}
      <FilterRow label="Período">
        <a href={buildUrl({ period: '' })}       style={pill(!periodF)}>Qualquer</a>
        <a href={buildUrl({ period: 'today' })}  style={pill(periodF === 'today')}>Hoje</a>
        <a href={buildUrl({ period: '7d' })}     style={pill(periodF === '7d')}>7 dias</a>
        <a href={buildUrl({ period: '30d' })}    style={pill(periodF === '30d')}>30 dias</a>
      </FilterRow>

      {/* ── Busca ── */}
      <form method="get" action="/admin/eventos/gauchinho" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {emprF   && <input type="hidden" name="empre"  value={emprF}   />}
        {shareF  && <input type="hidden" name="share"  value={shareF}  />}
        {periodF && <input type="hidden" name="period" value={periodF} />}

        <input
          type="search" name="q" defaultValue={q}
          placeholder="🔍 Buscar por nome, WhatsApp ou apartamento..."
          style={{
            flex: 1, minWidth: 200,
            border: `1px solid ${C.border}`, borderRadius: 10,
            padding: '9px 14px', fontSize: 13,
            fontFamily: 'inherit', outline: 'none', background: '#fff',
          }}
        />
        <button type="submit" style={{
          background: '#1B4F8A', color: '#fff', border: 'none',
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

      {/* ── Contador ── */}
      <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 10px', fontWeight: 500 }}>
        {leads.length === allLeads.length
          ? `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`
          : `${leads.length} de ${allLeads.length} (filtro aplicado)`}
      </p>

      {/* ── Lista de leads ── */}
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
            {hasFilter ? 'Ajuste os filtros.' : 'Ainda não há leads neste evento.'}
          </p>
          {hasFilter && (
            <a href="/admin/eventos/gauchinho" style={{
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
            const interests = interestsLabel(lead)
            return (
              <div key={lead.id} style={{
                background: '#fff', borderRadius: 14,
                border: `0.5px solid ${C.border}`, overflow: 'hidden',
              }}>
                {/* Faixa de empreendimento */}
                {lead.empreendimento && (
                  <div style={{ background: '#EBF2FA', padding: '4px 14px', borderBottom: `0.5px solid #BFCFE0` }}>
                    <span style={{ fontSize: 10, color: '#1B4F8A', fontWeight: 600 }}>
                      🏗️ {lead.empreendimento}
                      {lead.torre && <span> · Torre {lead.torre}</span>}
                      {lead.apartamento && <span> · Apto {lead.apartamento}</span>}
                    </span>
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>
                  {/* Linha 1: avatar + nome + badges + WhatsApp */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg, #1B4F8A20, #1B4F8A10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, fontWeight: 700, color: '#1B4F8A',
                    }}>
                      {lead.name.trim().charAt(0).toUpperCase()}
                    </div>

                    {/* Nome + info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{lead.name}</span>
                        {lead.consent_share_builder && (
                          <span style={{
                            background: C.greenBg, color: C.greenDark,
                            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                            textTransform: 'uppercase', letterSpacing: 0.3,
                          }}>✅ Exportável</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSec }}>
                        {fmtPhone(lead.whatsapp)}
                      </div>
                    </div>

                    {/* WhatsApp */}
                    <a
                      href={waLink(lead.whatsapp)}
                      target="_blank" rel="noopener noreferrer"
                      title="Abrir no WhatsApp"
                      style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: '#E7F7EE', border: '1px solid #C3EDD4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textDecoration: 'none', fontSize: 15,
                      }}
                    >💬</a>
                  </div>

                  {/* Valor do imóvel */}
                  {lead.valor_imovel && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{
                        background: '#FFF8E1', color: '#92620A',
                        fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                        border: '1px solid #F4A30030',
                      }}>
                        🏠 {fmtBRL(lead.valor_imovel)}
                      </span>
                    </div>
                  )}

                  {/* Interesses */}
                  {interests.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                      {interests.map(i => (
                        <span key={i} style={{
                          background: '#EBF2FA', color: '#1B4F8A',
                          fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 500,
                        }}>{i}</span>
                      ))}
                    </div>
                  )}

                  {/* Data + link */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.textSec }}>
                      📅 {fmtDate(lead.created_at)} às {fmtTime(lead.created_at)}
                    </span>
                    <a href={`/admin/eventos/gauchinho/${lead.id}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '5px 11px', fontSize: 11,
                      textDecoration: 'none', color: C.textSec, background: '#fff',
                      fontWeight: 500, whiteSpace: 'nowrap',
                    }}>
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

// ── Sub-componentes ───────────────────────────────────────────────────────────

function pill(active: boolean): CSSProperties {
  return {
    display: 'inline-block',
    border:       active ? `1.5px solid #1B4F8A` : `1px solid ${C.border}`,
    borderRadius: 99, padding: '4px 10px',
    fontSize: 11, textDecoration: 'none',
    background: active ? '#EBF2FA' : '#fff',
    color:      active ? '#1B4F8A' : C.textSec,
    fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap',
  }
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
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
      background: active ? '#EBF2FA' : '#fff',
      border: active ? `1.5px solid #1B4F8A40` : `0.5px solid ${C.border}`,
      borderRadius: 10, padding: '7px 12px',
      textDecoration: 'none', transition: 'all .15s',
    }}>
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: active ? '#1B4F8A' : C.text, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: active ? '#1B4F8A' : C.textSec, fontWeight: 500, marginTop: 1 }}>
          {label}
        </div>
      </div>
    </a>
  )
}
