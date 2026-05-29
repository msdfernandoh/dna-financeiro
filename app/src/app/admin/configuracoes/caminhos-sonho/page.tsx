// =============================================================================
// /admin/configuracoes/caminhos-sonho — Lista de dream_path_settings
//
// SEGURANÇA:
//   • requireAdmin() valida sessão
//   • Apenas master pode acessar — outros roles recebem mensagem de permissão
//   • unit_id NULL = global; preenchido = override por unidade
//   • Filtros aplicados in-memory após fetch (unidade, dream_type, path_type, status)
// =============================================================================

import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { togglePathActive, deletePath } from './actions'
import { C }                          from '@/app/components/ui'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PathRow = {
  id:                     string
  unit_id:                string | null
  path_type:              string
  dream_type:             string | null
  dream_subtype:          string | null
  label:                  string
  description:            string | null
  active:                 boolean
  sort_order:             number
  default_amount:         number | null
  full_installment_amount: number | null
  term_months:            number | null
  created_at:             string
  updated_at:             string | null
}

// ── Labels legíveis ───────────────────────────────────────────────────────────

const PATH_TYPE_LABELS: Record<string, string> = {
  cash_saving:                 '💰 Guardar',
  investment:                  '📈 Investimento',
  financing:                   '🏦 Financiamento',
  cdc:                         '💳 CDC',
  investment_plus_cdc:         '📈+💳 Inv+CDC',
  consortium_traditional:      '🤝 Consórcio trad.',
  consortium_with_bid:         '🤝⚡ Consórcio lance',
  consortium_programmed_date:  '🎯 Plano Pontual',
}

const DREAM_TYPE_LABELS: Record<string, string> = {
  carro:                   'Carro',
  casa:                    'Casa',
  negocio:                 'Negócio',
  viagem:                  'Viagem',
  reserva:                 'Reserva',
  faculdade:               'Faculdade',
  reforma:                 'Reforma',
  dividas:                 'Dívidas',
  moto:                    'Moto',
  caminhao:                'Caminhão',
  aposentadoria_imobiliaria: 'Ap. Imob.',
  outro:                   'Outro',
}

function fmtBRL(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Página ────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    unit?:       string
    dream_type?: string
    path_type?:  string
    status?:     string
    q?:          string
    created?:    string
    updated?:    string
    deleted?:    string
  }>
}

export default async function CaminhosSonhoPage({ searchParams }: Props) {
  const params  = await searchParams
  const session = await requireAdmin()

  // Master only
  if (session.role !== 'master') {
    return (
      <AdminShell session={session} title="Caminhos do Sonho">
        <p style={{ color: C.textSec, fontSize: 14 }}>
          Apenas o master pode acessar as configurações de caminhos do sonho.
        </p>
      </AdminShell>
    )
  }

  const supabase = createServerSupabaseClient()

  const [{ data: rawPaths }, { data: rawUnits }] = await Promise.all([
    supabase
      .from('dream_path_settings')
      .select('id, unit_id, path_type, dream_type, dream_subtype, label, description, active, sort_order, default_amount, full_installment_amount, term_months, created_at, updated_at')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('path_type', { ascending: true }),
    supabase
      .from('units')
      .select('id, name, slug')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name'),
  ])

  const paths: PathRow[] = rawPaths ?? []
  const unitById = new Map(
    (rawUnits ?? []).map(u => [u.id, { name: u.name, slug: u.slug }]),
  )

  // ── Filtros ───────────────────────────────────────────────────────────────

  const filterUnit   = params.unit?.trim() || ''
  const filterDream  = params.dream_type?.trim() || ''
  const filterPath   = params.path_type?.trim()  || ''
  const filterStatus = params.status?.trim()      || ''
  const filterQ      = params.q?.trim().toLowerCase() || ''

  const filtered = paths.filter(p => {
    if (filterUnit === 'global' && p.unit_id !== null) return false
    if (filterUnit && filterUnit !== 'global' && p.unit_id !== filterUnit) return false
    if (filterDream  && p.dream_type !== filterDream)    return false
    if (filterPath   && p.path_type  !== filterPath)     return false
    if (filterStatus === 'active'   && !p.active)        return false
    if (filterStatus === 'inactive' &&  p.active)        return false
    if (filterQ && !p.label.toLowerCase().includes(filterQ) && !(p.dream_subtype ?? '').toLowerCase().includes(filterQ)) return false
    return true
  })

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const total  = paths.length
  const ativos = paths.filter(p => p.active).length

  // ── Toast ─────────────────────────────────────────────────────────────────

  const toast = params.created ? 'Caminho criado com sucesso!'
    : params.updated ? 'Alterações salvas com sucesso!'
    : params.deleted ? 'Caminho removido.'
    : null

  // ── Estilos ───────────────────────────────────────────────────────────────

  const filterInputStyle: React.CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '6px 10px', fontSize: 12, background: '#fff',
    color: C.text, fontFamily: 'inherit', outline: 'none',
    minWidth: 0,
  }

  const selectStyle: React.CSSProperties = {
    ...filterInputStyle, cursor: 'pointer', appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
    paddingRight: 24,
  }

  return (
    <AdminShell session={session} title="Caminhos do Sonho">

      {/* Toast */}
      {toast && (
        <div style={{
          background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#166534',
        }}>
          ✅ {toast}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',  value: total,  color: C.purple },
          { label: 'Ativos', value: ativos, color: '#166534' },
          { label: 'Inativos', value: total - ativos, color: C.textSec },
        ].map(k => (
          <div key={k.label} style={{
            background: '#fff', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '10px 16px', minWidth: 80,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.textSec }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros + botão novo */}
      <form method="GET" style={{
        display: 'flex', gap: 8, alignItems: 'center',
        flexWrap: 'wrap', marginBottom: 16,
      }}>
        <input
          name="q"
          type="text"
          defaultValue={filterQ}
          placeholder="Buscar por label…"
          style={{ ...filterInputStyle, flex: '1 1 160px' }}
        />

        <select name="unit" defaultValue={filterUnit} style={{ ...selectStyle, flex: '0 0 160px' }}>
          <option value="">Todas unidades</option>
          <option value="global">Global</option>
          {(rawUnits ?? []).map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select name="dream_type" defaultValue={filterDream} style={{ ...selectStyle, flex: '0 0 130px' }}>
          <option value="">Todos os sonhos</option>
          {Object.entries(DREAM_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select name="path_type" defaultValue={filterPath} style={{ ...selectStyle, flex: '0 0 150px' }}>
          <option value="">Todos os tipos</option>
          {Object.entries(PATH_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select name="status" defaultValue={filterStatus} style={{ ...selectStyle, flex: '0 0 110px' }}>
          <option value="">Todos status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>

        <button type="submit" style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: C.bgSecondary, color: C.textSec, border: `1px solid ${C.border}`,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Filtrar
        </button>

        <a href="/admin/configuracoes/caminhos-sonho/novo" style={{
          marginLeft: 'auto', padding: '6px 16px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, background: C.purple, color: '#fff',
          textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          + Novo caminho
        </a>
      </form>

      {/* Contagem */}
      <p style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
        {filtered.length} caminho{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 32, textAlign: 'center', color: C.textSec, fontSize: 14,
        }}>
          Nenhum caminho encontrado.{' '}
          <a href="/admin/configuracoes/caminhos-sonho/novo" style={{ color: C.purple }}>
            Criar novo
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => {
            const pathLabel  = PATH_TYPE_LABELS[p.path_type] ?? p.path_type
            const dreamLabel = p.dream_type ? (DREAM_TYPE_LABELS[p.dream_type] ?? p.dream_type) : 'Genérico'
            const unitMeta   = p.unit_id ? unitById.get(p.unit_id) : null

            return (
              <div key={p.id} style={{
                background: '#fff', border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '12px 14px',
                opacity: p.active ? 1 : 0.6,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {/* Linha 1: tipo + label + status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: C.purpleBg, color: C.purpleDeep, whiteSpace: 'nowrap',
                      }}>
                        {pathLabel}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: p.unit_id ? C.amberBg : C.bgSecondary,
                        color:      p.unit_id ? C.amberDark : C.textSec,
                        whiteSpace: 'nowrap',
                      }}>
                        {unitMeta ? `${unitMeta.name} · ${unitMeta.slug}` : 'Global'}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 99,
                        background: C.bgSecondary, color: C.textSec,
                      }}>
                        {dreamLabel}{p.dream_subtype ? ` / ${p.dream_subtype}` : ''}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                        background: p.active ? '#DCFCE7' : C.bgSecondary,
                        color:      p.active ? '#166534' : C.textSec,
                      }}>
                        {p.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                        {p.label}
                      </span>
                      {p.description && (
                        <span style={{ fontSize: 12, color: C.textSec, marginLeft: 6 }}>
                          — {p.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.textSec, flexShrink: 0, flexWrap: 'wrap' }}>
                    {p.term_months && (
                      <span><strong style={{ color: C.text }}>{p.term_months}m</strong> prazo</span>
                    )}
                    {p.default_amount && (
                      <span>base <strong style={{ color: C.text }}>{fmtBRL(p.default_amount)}</strong></span>
                    )}
                    {p.full_installment_amount && (
                      <span>parcela <strong style={{ color: C.text }}>{fmtBRL(p.full_installment_amount)}</strong></span>
                    )}
                    <span>ord. <strong style={{ color: C.text }}>{p.sort_order}</strong></span>
                    <span>atualiz. {fmtDate(p.updated_at ?? p.created_at)}</span>
                  </div>
                </div>

                {/* Linha 2: ações */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <a
                    href={`/admin/configuracoes/caminhos-sonho/${p.id}/editar`}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: C.purpleBg, color: C.purpleDeep,
                      textDecoration: 'none', border: `1px solid ${C.purple}30`,
                    }}
                  >
                    ✏️ Editar
                  </a>

                  <a
                    href={`/admin/configuracoes/caminhos-sonho/novo?duplicate=${p.id}`}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: C.bgSecondary, color: C.textSec,
                      textDecoration: 'none', border: `1px solid ${C.border}`,
                    }}
                  >
                    📋 Duplicar
                  </a>

                  <form action={togglePathActive.bind(null, p.id)} style={{ display: 'inline' }}>
                    <button type="submit" style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: C.bgSecondary, color: C.textSec,
                      border: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {p.active ? '⏸ Desativar' : '▶️ Ativar'}
                    </button>
                  </form>

                  <form action={deletePath.bind(null, p.id)} style={{ display: 'inline' }}>
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(`Remover "${p.label}"? Esta ação não pode ser desfeita.`)) {
                          e.preventDefault()
                        }
                      }}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                        background: '#FEF2F2', color: '#DC2626',
                        border: '1px solid #FCA5A5', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      🗑 Remover
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
