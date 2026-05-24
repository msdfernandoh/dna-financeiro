// =============================================================================
// /admin/leads/[id] — Detalhe de um lead
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • UUID validado antes de qualquer query
//   • unit_admin e unit_viewer: eq(unit_id) impede acesso cross-unit
//   • unit_viewer: colunas sensíveis (monthly_income, source_url) NÃO selecionadas
//   • unit_viewer: NÃO vê despesas individuais nem respostas brutas do DNA
//   • Interações filtradas por unit_id do lead (não da sessão) — dupla proteção
//   • unit_id nunca exposto no HTML/URL visível do usuário
// =============================================================================

import { notFound }                   from 'next/navigation'
import type { ReactNode }              from 'react'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '../../_AdminShell'
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

const STAGE_LABELS: Record<number, string> = {
  1: 'Realidade',
  2: 'Trabalho',
  3: 'Dívidas',
  4: 'Renda extra',
  5: 'Formação',
  6: 'Sonhos',
}

const INTERACTION_META: Record<string, { label: string; emoji: string; color: string }> = {
  view:                { label: 'Visualizou',           emoji: '👁️',  color: C.textSec    },
  click:               { label: 'Clicou',               emoji: '🖱️',  color: C.textSec    },
  interest:            { label: 'Demonstrou interesse', emoji: '💡',  color: C.amberDark  },
  save:                { label: 'Salvou',               emoji: '🔖',  color: C.purpleDeep },
  unsave:              { label: 'Removeu dos salvos',   emoji: '🗑️',  color: C.textSec    },
  external_link_click: { label: 'Acessou link externo', emoji: '🔗',  color: C.greenDark  },
  contact_request:     { label: 'Pediu contato',        emoji: '📞',  color: C.greenDark  },
}

const SOURCE_LABELS: Record<string, string> = {
  painel:       'Painel',
  oportunidades: 'Lista de oportunidades',
  detalhe:      'Detalhe da oportunidade',
  fallback:     'Sugestão personalizada',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Cuiaba',
  })
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff  = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1)  return 'agora mesmo'
  if (hours < 24) return `${hours}h atrás`
  if (days === 1) return 'ontem'
  if (days < 7)   return `${days} dias atrás`
  if (days < 30)  return `${Math.floor(days / 7)} semanas atrás`
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

function incomeRange(income: number | null | undefined): string {
  if (income == null) return 'Não informado'
  if (income < 2000)  return 'Até R$ 2.000'
  if (income < 4000)  return 'R$ 2.000 – R$ 4.000'
  if (income < 7000)  return 'R$ 4.000 – R$ 7.000'
  return 'Acima de R$ 7.000'
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type LeadFull = {
  id:            string
  name:          string
  phone:         string
  email:         string | null
  city:          string | null
  main_dream:    string | null
  dna_progress:  number
  dna_stage:     number
  status:        string
  last_seen_at:  string | null
  created_at:    string
  unit_id:       string
  unit_slug:     string
  campaign_slug: string | null
  device_type:   string | null
  // Apenas para unit_admin / master:
  monthly_income?: number | null
  source_url?:     string | null
  // Join com campaigns:
  campaigns?: { name: string } | null
}

type Interaction = {
  id:                string
  interaction_type:  string
  source:            string
  opportunity_title: string
  opportunity_type:  string | null
  target_dream:      string | null
  created_at:        string
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: leadId } = await params
  const session  = await requireAdmin()
  const supabase = createServerSupabaseClient()

  // Validação de formato UUID (previne ataques de enumeração)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(leadId)) {
    notFound()
  }

  // ── Fetch lead ─────────────────────────────────────────────────────────────
  // unit_viewer: sem monthly_income nem source_url (resposta igual ao commercial_summary)
  // unit_admin / master: inclui monthly_income para exibir income_range e source_url

  const canSeeSensitive = session.role !== 'unit_viewer'

  const baseCols   = 'id, name, phone, email, city, main_dream, dna_progress, dna_stage, status, last_seen_at, created_at, unit_id, unit_slug, campaign_slug, device_type, campaigns(name)'
  const extraCols  = ', monthly_income, source_url'
  const selectCols = canSeeSensitive ? `${baseCols}${extraCols}` : baseCols

  let leadQ = supabase
    .from('leads')
    .select(selectCols)
    .eq('id', leadId)
    .is('deleted_at', null)

  // Proteção cross-unit: unit_admin e unit_viewer só acessam a própria unidade
  if (session.role !== 'master') {
    leadQ = leadQ.eq('unit_id', session.unitId!)
  }

  const { data: leadRaw } = await leadQ.single()
  if (!leadRaw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lead = leadRaw as unknown as LeadFull

  // ── Fetch interações com oportunidades ─────────────────────────────────────
  // Filtradas por lead_id E unit_id do lead — dupla proteção cross-unit

  let interactions: Interaction[] = []
  try {
    const { data } = await supabase
      .from('opportunity_interactions')
      .select('id, interaction_type, source, opportunity_title, opportunity_type, target_dream, created_at')
      .eq('lead_id', leadId)
      .eq('unit_id', lead.unit_id)   // ← proteção cross-unit via unit_id do lead
      .order('created_at', { ascending: false })
      .limit(50)
    interactions = (data ?? []) as Interaction[]
  } catch {
    // Tabela pode não existir em env de desenvolvimento
  }

  // ── Fetch nome da unidade (master only) ────────────────────────────────────
  let unitName = ''
  if (session.role === 'master') {
    const { data: unit } = await supabase
      .from('units').select('name').eq('id', lead.unit_id).single()
    unitName = unit?.name ?? lead.unit_slug
  }

  // ── Derivações ─────────────────────────────────────────────────────────────
  const sMeta        = STATUS_META[lead.status] ?? STATUS_META.new
  const dreamLabel   = DREAM_LABELS[lead.main_dream ?? ''] ?? lead.main_dream ?? '—'
  const campaignName = (lead.campaigns as { name: string } | null)?.name ?? lead.campaign_slug ?? '—'
  const stageName    = STAGE_LABELS[lead.dna_stage] ?? `Etapa ${lead.dna_stage}`
  const range        = canSeeSensitive ? incomeRange(lead.monthly_income) : null

  // Última oportunidade de interesse (para ação rápida)
  const lastInterest = interactions.find(i => i.interaction_type === 'interest')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AdminShell
      session={session}
      title={lead.name}
      back={{ href: '/admin/leads', label: 'Leads' }}
    >

      {/* ── Header / Cartão do lead ── */}
      <div style={{
        background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
        padding: '16px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>

          {/* Avatar */}
          <div style={{
            width: 54, height: 54, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.purple}25, ${C.purpleDeep}15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: C.purpleDeep, userSelect: 'none',
          }}>
            {lead.name.trim().charAt(0).toUpperCase()}
          </div>

          {/* Dados principais */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>
                {lead.name}
              </h1>
              <span style={{
                background: sMeta.bg, color: sMeta.color,
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                textTransform: 'uppercase', letterSpacing: 0.3,
              }}>
                {sMeta.label}
              </span>
              {lead.dna_progress === 100 && (
                <span style={{
                  background: C.purpleBg, color: C.purpleDeep,
                  fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                }}>
                  🧬 DNA Completo
                </span>
              )}
              {unitName && (
                <span style={{
                  background: C.bgSecondary, color: C.textSec,
                  fontSize: 9, padding: '2px 8px', borderRadius: 99,
                }}>
                  📍 {unitName}
                </span>
              )}
            </div>

            <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 2px' }}>
              {fmtPhone(lead.phone)}
              {lead.email && <span> · {lead.email}</span>}
            </p>
            {lead.city && (
              <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
                📍 {lead.city}
              </p>
            )}
          </div>

          {/* Ações rápidas */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
            <a
              href={waLink(lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#25D366', color: '#fff',
                borderRadius: 10, padding: '9px 16px',
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              💬 WhatsApp
            </a>

            {lastInterest && (
              <a
                href={`/${lead.unit_slug}/oportunidades`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Interesse: ${lastInterest.opportunity_title}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '9px 14px', fontSize: 12,
                  textDecoration: 'none', color: C.textSec, background: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                🎯 Ver oportunidades
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Perfil comercial ── */}
      <Section title="Perfil comercial" emoji="📊">
        <InfoGrid>
          <InfoItem label="Sonho principal" value={dreamLabel} />
          {range && <InfoItem label="Faixa de renda"  value={range} />}
          <InfoItem label="Cidade"          value={lead.city ?? '—'} />
          <InfoItem label="Dispositivo"     value={lead.device_type ?? '—'} />
        </InfoGrid>

        {/* Barra de progresso DNA */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 5,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>
              DNA Financeiro · {stageName}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: lead.dna_progress === 100 ? C.greenDark : C.textSec,
            }}>
              {lead.dna_progress}%
            </span>
          </div>
          <div style={{ height: 8, background: C.bgSecondary, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${lead.dna_progress}%`,
              background: lead.dna_progress === 100
                ? C.green : lead.dna_progress >= 50 ? C.purple : C.amber,
              transition: 'width .3s',
            }} />
          </div>
          {lead.dna_progress < 100 && (
            <p style={{ fontSize: 11, color: C.textSec, margin: '5px 0 0' }}>
              Etapa atual: <b>{stageName}</b>
              {lead.dna_stage < 6 && ` · Próxima: ${STAGE_LABELS[lead.dna_stage + 1] ?? '—'}`}
            </p>
          )}
        </div>
      </Section>

      {/* ── Origem ── */}
      <Section title="Origem" emoji="📍">
        <InfoGrid>
          <InfoItem label="Campanha"      value={campaignName} />
          <InfoItem label="Cadastrou em"  value={fmtDate(lead.created_at)} />
          <InfoItem label="Último acesso" value={lead.last_seen_at ? fmtDate(lead.last_seen_at) : '—'} />
          <InfoItem label="Tempo desde cadastro" value={fmtRelative(lead.created_at)} />
        </InfoGrid>
        {canSeeSensitive && lead.source_url && (
          <div style={{ marginTop: 10 }}>
            <span style={{
              fontSize: 10, color: C.textSec, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              URL de origem:
            </span>
            <p style={{
              fontSize: 11, color: C.textSec,
              margin: '3px 0 0', wordBreak: 'break-all',
              background: C.bgSecondary, borderRadius: 8,
              padding: '6px 10px',
            }}>
              {lead.source_url}
            </p>
          </div>
        )}
      </Section>

      {/* ── Interações com oportunidades ── */}
      <Section title="Interações com oportunidades" emoji="🎯">
        {interactions.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
            Este lead ainda não interagiu com nenhuma oportunidade.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 10px' }}>
              {interactions.length} {interactions.length === 1 ? 'interação' : 'interações'} registradas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {interactions.map(i => {
                const meta = INTERACTION_META[i.interaction_type] ?? {
                  label: i.interaction_type, emoji: '📌', color: C.textSec,
                }
                const dreamLbl = i.target_dream
                  ? DREAM_LABELS[i.target_dream] ?? i.target_dream
                  : null

                return (
                  <div key={i.id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    background: C.bgSecondary, borderRadius: 10, padding: '9px 12px',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>
                      {meta.emoji}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 3 }}>
                        {i.opportunity_title}
                      </div>
                      <div style={{
                        display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center',
                      }}>
                        <span style={{
                          background: '#fff', border: `0.5px solid ${C.border}`,
                          borderRadius: 6, padding: '1px 7px',
                          fontSize: 10, fontWeight: 600, color: meta.color,
                        }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 10, color: C.textSec }}>
                          via {SOURCE_LABELS[i.source] ?? i.source}
                        </span>
                        {dreamLbl && (
                          <span style={{
                            background: C.amberBg, color: C.amberDark,
                            fontSize: 9, padding: '1px 6px', borderRadius: 6,
                          }}>
                            {dreamLbl}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: C.textTer, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {fmtRelative(i.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Section>

      {/* ── Observações (em breve) ── */}
      <Section title="Observações" emoji="📝">
        <div style={{
          background: C.bgSecondary, borderRadius: 10,
          padding: '14px 16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 4px', fontWeight: 500 }}>
            Em breve
          </p>
          <p style={{ fontSize: 12, color: C.textTer, margin: 0 }}>
            Seu consultor poderá deixar anotações e histórico de contato aqui.
          </p>
        </div>
      </Section>

    </AdminShell>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function Section({
  title, emoji, children,
}: {
  title: string; emoji: string; children: ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: `0.5px solid ${C.border}`,
      padding: '14px 16px', marginBottom: 12,
    }}>
      <h2 style={{
        fontSize: 13, fontWeight: 700, color: C.text,
        margin: '0 0 12px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {emoji} {title}
      </h2>
      {children}
    </div>
  )
}

function InfoGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '10px 20px',
    }}>
      {children}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: C.textSec, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  )
}
