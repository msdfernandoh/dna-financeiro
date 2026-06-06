// =============================================================================
// /admin/configuracoes/telas — Gerenciar blocos por tela e unidade
//
// SEGURANÇA:
//   • requireAdmin()
//   • unit_admin: vê e edita apenas blocos da sua unidade
//   • master: vê todos, filtra por unidade
//   • unit_viewer: acesso negado
// =============================================================================

import { redirect }                   from 'next/navigation'
import { requireAdmin }               from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminShell }                 from '@/app/admin/_AdminShell'
import { C }                          from '@/app/components/ui'
import { toggleBlockActive, deleteBlock, moveBlock } from './actions'

// ── Labels ────────────────────────────────────────────────────────────────────

const PAGE_LABELS: Record<string, { label: string; emoji: string }> = {
  diagnostic: { label: 'Diagnóstico Inicial', emoji: '🩺' },
  painel:     { label: 'Painel do usuário',   emoji: '📊' },
  relatorio:  { label: 'Relatório DNA',       emoji: '📋' },
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  financial_profile:          '💳 Perfil financeiro',
  dream_simulation:           '🎯 Simulação de acumulação',
  financial_numbers:          '💰 Renda e Despesas',
  smart_guidance:             '🧭 Orientação inteligente',
  ai_recommendation:          '🤖 Recomendação IA',
  alert_section:              '⚠️ Ponto de atenção',
  action_buttons:             '🔘 Botões de ação',
  cash_saving:                '🐷 Poupança / guardar',
  investment:                 '📈 Investimento',
  consortium_traditional:     '🤝 Consórcio tradicional',
  consortium_with_bid:        '🎯 Consórcio com lance',
  consortium_programmed_date: '📅 Plano Pontual',
  financing:                  '🏦 Financiamento',
  cdc:                        '💳 CDC',
  comparison:                 '⚖️ Comparativo',
  opportunity:                '🎯 Oportunidade',
}

type BlockRow = {
  id:           string
  block_type:   string
  active:       boolean
  sort_order:   number
  page:         string
  unit_id:      string | null
  path_settings_id: string | null
  config:       Record<string, unknown>
}

interface Props {
  searchParams: Promise<{
    page?:    string
    unit_id?: string
    created?: string
    updated?: string
    deleted?: string
  }>
}

export default async function TelasPage({ searchParams }: Props) {
  const params  = await searchParams
  const session = await requireAdmin()

  if (session.role === 'unit_viewer') {
    return (
      <AdminShell session={session} title="Configuração de Telas">
        <p style={{ color: C.textSec, fontSize: 14 }}>
          Visualizadores não podem configurar telas.
        </p>
      </AdminShell>
    )
  }

  const supabase       = createServerSupabaseClient()
  const selectedPage   = params.page    || 'diagnostic'
  const selectedUnit   = params.unit_id?.trim() || ''

  // Resolve unit_id para a query
  const queryUnitId = session.role === 'master'
    ? (selectedUnit || null)
    : session.unitId!

  // ── Buscar blocos ──────────────────────────────────────────────────────────
  let blocksQ = supabase
    .from('page_blocks')
    .select('id, block_type, active, sort_order, page, unit_id, path_settings_id, config')
    .eq('page', selectedPage)
    .order('sort_order')

  if (queryUnitId) {
    blocksQ = blocksQ.eq('unit_id', queryUnitId)
  } else {
    blocksQ = blocksQ.is('unit_id', null)
  }

  const { data: blocksRaw } = await blocksQ
  const blocks = (blocksRaw ?? []) as BlockRow[]

  // ── Buscar unidades (master) ───────────────────────────────────────────────
  let units: { id: string; name: string; allowed_blocks: string[] | null }[] = []
  if (session.role === 'master') {
    const { data } = await supabase
      .from('units')
      .select('id, name, allowed_blocks')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name')
    units = (data as typeof units) ?? []
  }

  // Allowed blocks para a unidade selecionada
  const selectedUnitData = units.find(u => u.id === selectedUnit)
  const allowedBlocks: string[] | null = session.role === 'master'
    ? (selectedUnitData?.allowed_blocks ?? null)
    : null  // unit_admin: allowed_blocks checado no server action

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toast = params.created ? 'Bloco adicionado!'
    : params.updated ? 'Bloco atualizado!'
    : params.deleted ? 'Bloco removido.'
    : null

  // ── Build href para novo bloco ─────────────────────────────────────────────
  const newBlockHref = `/admin/configuracoes/telas/novo?page=${selectedPage}${selectedUnit ? `&unit_id=${selectedUnit}` : ''}`

  const editBlockHref = (id: string) =>
    `/admin/configuracoes/telas/${id}/editar`

  // ── Estilos ────────────────────────────────────────────────────────────────
  const tabSt = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 8, fontSize: 12,
    fontWeight: active ? 700 : 400,
    background: active ? C.purple : '#fff',
    color:      active ? '#fff'   : C.textSec,
    textDecoration: 'none',
    border: `1px solid ${active ? C.purple : C.border}`,
    whiteSpace: 'nowrap' as const,
  })

  const actionBtnSt: React.CSSProperties = {
    padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`,
    background: C.bgSecondary, color: C.textSec,
  }

  const unitQuery = selectedUnit ? `&unit_id=${selectedUnit}` : ''

  return (
    <AdminShell session={session} title="Configuração de Telas">

      {/* Toast */}
      {toast && (
        <div style={{
          background: C.greenBg, border: `1px solid ${C.greenDark}30`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 12,
          fontSize: 13, color: C.greenDark,
        }}>
          ✅ {toast}
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>

        {/* Tabs de tela */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(PAGE_LABELS).map(([pg, { label, emoji }]) => (
            <a
              key={pg}
              href={`?page=${pg}${unitQuery}`}
              style={tabSt(selectedPage === pg)}
            >
              {emoji} {label}
            </a>
          ))}
        </div>

        {/* Seletor de unidade (master) */}
        {session.role === 'master' && (
          <form method="GET" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="hidden" name="page" value={selectedPage} />
            <select
              name="unit_id"
              defaultValue={selectedUnit}
              style={{
                border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '5px 10px', fontSize: 12, background: '#fff',
                color: C.text, fontFamily: 'inherit', outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
                paddingRight: 24,
              }}
            >
              <option value="">🌐 Global (todas)</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button type="submit" style={actionBtnSt}>Filtrar</button>
          </form>
        )}

        {/* Botão adicionar */}
        <a
          href={newBlockHref}
          style={{
            marginLeft: 'auto', padding: '6px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, background: C.purple, color: '#fff',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          + Adicionar bloco
        </a>
      </div>

      {/* ── Info scope ── */}
      <div style={{
        background: C.bgSecondary, borderRadius: 8,
        padding: '8px 12px', marginBottom: 14,
        fontSize: 12, color: C.textSec,
      }}>
        {session.role === 'master' && !selectedUnit && (
          <span>🌐 Exibindo blocos <strong>globais</strong> — valem para todas as unidades</span>
        )}
        {session.role === 'master' && selectedUnit && (
          <span>🏢 Exibindo blocos da unidade: <strong>{selectedUnitData?.name ?? selectedUnit}</strong></span>
        )}
        {session.role !== 'master' && (
          <span>🏢 Blocos configurados para <strong>sua unidade</strong></span>
        )}
        {allowedBlocks && allowedBlocks.length > 0 && (
          <span style={{ marginLeft: 10, color: C.purple }}>
            • {allowedBlocks.length} tipo{allowedBlocks.length !== 1 ? 's' : ''} liberado{allowedBlocks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Lista de blocos ── */}
      {blocks.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
          padding: '32px', textAlign: 'center', color: C.textSec,
        }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>
            {PAGE_LABELS[selectedPage]?.emoji ?? '🖥️'}
          </p>
          <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>
            Nenhum bloco configurado para {PAGE_LABELS[selectedPage]?.label ?? selectedPage}
          </p>
          <p style={{ fontSize: 12, margin: '0 0 16px' }}>
            Adicione blocos para personalizar o que aparece nesta tela.
          </p>
          <a href={newBlockHref} style={{
            display: 'inline-block', padding: '10px 20px', borderRadius: 10,
            background: C.purple, color: '#fff', fontSize: 13,
            fontWeight: 600, textDecoration: 'none',
          }}>
            + Adicionar primeiro bloco
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {blocks.map((block, idx) => {
            const typeLabel = BLOCK_TYPE_LABELS[block.block_type] ?? block.block_type

            return (
              <div key={block.id} style={{
                background: '#fff', borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: '12px 14px',
                opacity: block.active ? 1 : 0.55,
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                {/* Ordem */}
                <span style={{
                  fontSize: 11, color: C.textTer, fontWeight: 700,
                  minWidth: 22, textAlign: 'center',
                }}>
                  #{block.sort_order}
                </span>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                    {typeLabel}
                  </span>
                  {!block.active && (
                    <span style={{
                      marginLeft: 8, fontSize: 9, padding: '1px 6px',
                      borderRadius: 99, background: C.bgSecondary, color: C.textSec,
                    }}>
                      INATIVO
                    </span>
                  )}
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {/* Mover */}
                  {idx > 0 && (
                    <form action={moveBlock.bind(null, block.id, 'up')}>
                      <button type="submit" style={actionBtnSt} title="Mover para cima">↑</button>
                    </form>
                  )}
                  {idx < blocks.length - 1 && (
                    <form action={moveBlock.bind(null, block.id, 'down')}>
                      <button type="submit" style={actionBtnSt} title="Mover para baixo">↓</button>
                    </form>
                  )}

                  {/* Editar */}
                  <a href={editBlockHref(block.id)} style={{
                    ...actionBtnSt, textDecoration: 'none',
                    background: C.purpleBg, color: C.purpleDeep,
                    border: `1px solid ${C.purple}30`,
                  }}>
                    ✏️ Editar
                  </a>

                  {/* Toggle ativo */}
                  <form action={toggleBlockActive.bind(null, block.id)}>
                    <button type="submit" style={actionBtnSt}>
                      {block.active ? '⏸ Desativar' : '▶️ Ativar'}
                    </button>
                  </form>

                  {/* Deletar */}
                  <form action={deleteBlock.bind(null, block.id)}>
                    <button
                      type="submit"
                      onClick={e => {
                        if (!confirm(`Remover bloco "${typeLabel}"?`)) e.preventDefault()
                      }}
                      style={{ ...actionBtnSt, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}
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

      {/* Dica */}
      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 10,
        background: C.purpleBg, border: `1px solid ${C.purple}20`,
        fontSize: 12, color: C.purpleDeep, lineHeight: 1.6,
      }}>
        💡 <strong>Dica:</strong> Os blocos são exibidos ao lead na ordem configurada (menor # primeiro).
        Use ↑↓ para reordenar. Blocos inativos não aparecem para o usuário.
        Blocos globais valem para todas as unidades — os específicos sobrepõem.
      </div>

    </AdminShell>
  )
}
