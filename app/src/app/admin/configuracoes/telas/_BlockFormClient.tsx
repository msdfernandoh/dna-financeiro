'use client'

// =============================================================================
// _BlockFormClient — Formulário criar/editar bloco de tela
// Seções condicionais por block_type:
//   • Blocos de caminho: visibilidade dos campos (parcela, entrada, prazo)
//   • smart_guidance: limiar, sugestão de sonho alternativo, links
//   • comparison: dois caminhos + título
//   • opportunity: modo fixed/rotativo, CTA URL, API URL
// =============================================================================

import { useActionState, useState } from 'react'
import { C } from '@/app/components/ui'
import type { BlockActionResult } from './actions'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type BlockFormInitial = {
  id?:              string
  unit_id?:         string | null
  page?:            string | null
  block_type?:      string | null
  active?:          boolean | null
  sort_order?:      number | null
  path_settings_id?: string | null
  // config flattened
  show_full_installment?:    boolean
  show_reduced_installment?: boolean
  show_down_payment?:        boolean
  show_term?:                boolean
  show_total_cost?:          boolean
  gap_threshold?:            number | null
  suggest_alternative?:      boolean
  alternative_percent?:      number | null
  extra_income_url?:         string | null
  adjust_dream_url?:         string | null
  path_a?:                   string | null
  path_b?:                   string | null
  comp_title?:               string | null
  opp_mode?:                 string | null
  rotation_days?:            number | null
  cta_url?:                  string | null
  api_url?:                  string | null
}

export type PathSettingOption = { id: string; label: string; dream_type: string | null; path_type: string }
export type UnitOption        = { id: string; name: string }

interface Props {
  action:        (prev: BlockActionResult | null, fd: FormData) => Promise<BlockActionResult>
  initial:       BlockFormInitial
  mode:          'create' | 'edit'
  backHref:      string
  units?:        UnitOption[]          // master only
  pathSettings?: PathSettingOption[]   // para blocos de caminho
  isMaster:      boolean
}

// ── Constantes ────────────────────────────────────────────────────────────────

const PAGE_OPTIONS = [
  { value: 'diagnostic', label: '🩺 Diagnóstico Inicial' },
  { value: 'painel',     label: '📊 Painel do usuário'   },
  { value: 'relatorio',  label: '📋 Relatório DNA'        },
]

const BLOCK_TYPE_OPTIONS = [
  { group: 'Estruturais',           value: 'financial_profile',          label: '💳 Perfil financeiro'           },
  { group: 'Estruturais',           value: 'dream_simulation',           label: '🎯 Simulação de acumulação'     },
  { group: 'Estruturais',           value: 'financial_numbers',          label: '💰 Renda e Despesas'            },
  { group: 'Estruturais',           value: 'smart_guidance',             label: '🧭 Orientação inteligente'      },
  { group: 'Estruturais',           value: 'ai_recommendation',          label: '🤖 Recomendação IA'             },
  { group: 'Estruturais',           value: 'alert_section',              label: '⚠️ Ponto de atenção'           },
  { group: 'Estruturais',           value: 'action_buttons',             label: '🔘 Botões de ação'              },
  { group: 'Caminhos Financeiros',  value: 'cash_saving',                label: '🐷 Poupança / guardar'          },
  { group: 'Caminhos Financeiros',  value: 'investment',                 label: '📈 Investimento'                },
  { group: 'Caminhos Financeiros',  value: 'consortium_traditional',     label: '🤝 Consórcio tradicional'      },
  { group: 'Caminhos Financeiros',  value: 'consortium_with_bid',        label: '🎯 Consórcio com lance'         },
  { group: 'Caminhos Financeiros',  value: 'consortium_programmed_date', label: '📅 Plano Pontual'               },
  { group: 'Caminhos Financeiros',  value: 'financing',                  label: '🏦 Financiamento'               },
  { group: 'Caminhos Financeiros',  value: 'cdc',                        label: '💳 CDC'                        },
  { group: 'Especiais',             value: 'comparison',                 label: '⚖️ Comparativo'                },
  { group: 'Especiais',             value: 'opportunity',                label: '🎯 Oportunidade'               },
]

const PATH_TYPE_LABELS: Record<string, string> = {
  cash_saving: 'Poupança', investment: 'Investimento', financing: 'Financiamento',
  cdc: 'CDC', investment_plus_cdc: 'Investimento+CDC',
  consortium_traditional: 'Consórcio trad.', consortium_with_bid: 'Consórcio lance',
  consortium_programmed_date: 'Plano Pontual',
}

const PATH_BLOCKS = [
  'cash_saving','investment','consortium_traditional','consortium_with_bid',
  'consortium_programmed_date','financing','cdc',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null) return ''
  return String(Math.round(v * 10000) / 100)
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '8px 10px', fontSize: 13, background: '#fff',
  color: C.text, fontFamily: 'inherit', outline: 'none',
}

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.textSec, marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: 0.4,
}

const cardSt: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: `1px solid ${C.border}`,
  padding: '16px', marginBottom: 12,
}

const titleSt: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: C.purple,
  margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5,
}

const checkRowSt: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 10px', borderRadius: 8, background: C.bgApp,
  border: `1px solid ${C.border}`, cursor: 'pointer',
  fontSize: 12, color: C.text,
}

const selectSt: React.CSSProperties = {
  ...inputSt, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  paddingRight: 28,
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

// ── Componente ────────────────────────────────────────────────────────────────

export function BlockFormClient({
  action, initial, mode, backHref, units = [], pathSettings = [], isMaster,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [blockType, setBlockType]      = useState(initial.block_type ?? '')
  const [page,      setPage]           = useState(initial.page       ?? 'diagnostic')

  const isPathBlock    = PATH_BLOCKS.includes(blockType)
  const isGuidance     = blockType === 'smart_guidance'
  const isComparison   = blockType === 'comparison'
  const isOpportunity  = blockType === 'opportunity'

  // Filtrar path_settings pelo tipo do bloco selecionado
  const relevantPaths = pathSettings.filter(p => p.path_type === blockType)

  return (
    <form action={formAction} noValidate>

      {state && !state.success && !state.field && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991B1B',
        }}>
          {state.error}
        </div>
      )}

      {/* ══ IDENTIFICAÇÃO ════════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={titleSt}>🖥️ Identificação</p>

        {/* Tela */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Tela <span style={{ color: '#EF4444' }}>*</span></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PAGE_OPTIONS.map(opt => (
              <label key={opt.value} style={{
                flex: 1, minWidth: 130, cursor: 'pointer',
                display: 'block',
              }}>
                <input
                  type="radio" name="page" value={opt.value}
                  checked={page === opt.value}
                  onChange={() => setPage(opt.value)}
                  style={{ position: 'absolute', opacity: 0, width: 0 }}
                  disabled={mode === 'edit'}
                />
                <div style={{
                  border: `1.5px solid ${page === opt.value ? C.purple : C.border}`,
                  borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                  background: page === opt.value ? C.purpleBg : '#fff',
                  fontSize: 12, fontWeight: page === opt.value ? 700 : 400,
                  color: page === opt.value ? C.purpleDeep : C.textSec,
                  transition: 'all .15s',
                  opacity: mode === 'edit' ? 0.6 : 1,
                }}>
                  {opt.label}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Tipo do bloco */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Tipo de bloco <span style={{ color: '#EF4444' }}>*</span></label>
          <select
            name="block_type"
            value={blockType}
            onChange={e => setBlockType(e.target.value)}
            style={{ ...selectSt, borderColor: state?.field === 'block_type' ? '#EF4444' : C.border }}
            disabled={mode === 'edit'}
          >
            <option value="">— Selecione —</option>
            {['Estruturais', 'Caminhos Financeiros', 'Especiais'].map(group => (
              <optgroup key={group} label={group}>
                {BLOCK_TYPE_OPTIONS.filter(o => o.group === group).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {state?.field === 'block_type' && (
            <p style={{ color: '#EF4444', fontSize: 11, marginTop: 3 }}>{state.error}</p>
          )}
          {mode === 'edit' && (
            <p style={{ fontSize: 10, color: C.textTer, marginTop: 3 }}>
              Tipo de bloco não pode ser alterado após criação.
            </p>
          )}
        </div>

        {/* Unidade (master only) */}
        {isMaster && mode === 'create' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Unidade</label>
            <select name="unit_id" defaultValue={initial.unit_id ?? ''} style={selectSt}>
              <option value="">— Global (todas as unidades) —</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <p style={{ fontSize: 10, color: C.textTer, marginTop: 3 }}>
              Global vale para todas as unidades. Específico sobrepõe o global.
            </p>
          </div>
        )}

        <div style={grid2}>
          <div>
            <label style={labelSt}>Ordem de exibição</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={initial.sort_order ?? 0}
              min={0} step={1}
              style={inputSt}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={checkRowSt}>
            <input
              type="checkbox" name="active"
              defaultChecked={initial.active ?? true}
              style={{ width: 16, height: 16, accentColor: C.purple }}
            />
            <span>Ativo — exibir nesta tela para o usuário</span>
          </label>
        </div>
      </div>

      {/* ══ CAMINHO FINANCEIRO ════════════════════════════════════════════════ */}
      {isPathBlock && (
        <div style={cardSt}>
          <p style={titleSt}>💰 Configuração do bloco de caminho</p>

          {/* Vínculo com dream_path_settings */}
          {relevantPaths.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Caminho vinculado (dream_path_settings)</label>
              <select name="path_settings_id" defaultValue={initial.path_settings_id ?? ''} style={selectSt}>
                <option value="">— Usar cálculo automático por sonho —</option>
                {relevantPaths.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.dream_type ? `(${p.dream_type})` : '(genérico)'}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 10, color: C.textTer, marginTop: 3 }}>
                Se vazio, o sistema busca automaticamente o caminho certo para o sonho do lead.
              </p>
            </div>
          )}

          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 10px' }}>
            Defina quais componentes aparecem no card deste bloco:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'show_full_installment',    label: 'Parcela cheia',     def: initial.show_full_installment    ?? true  },
              { name: 'show_reduced_installment', label: 'Parcela reduzida',  def: initial.show_reduced_installment ?? true  },
              { name: 'show_down_payment',        label: 'Entrada (%)',       def: initial.show_down_payment        ?? true  },
              { name: 'show_term',                label: 'Prazo (meses)',     def: initial.show_term                ?? true  },
              { name: 'show_total_cost',          label: 'Custo total',       def: initial.show_total_cost          ?? false },
            ].map(f => (
              <label key={f.name} style={checkRowSt}>
                <input
                  type="checkbox" name={f.name}
                  defaultChecked={f.def}
                  style={{ width: 16, height: 16, accentColor: C.purple }}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ══ ORIENTAÇÃO INTELIGENTE ═══════════════════════════════════════════ */}
      {isGuidance && (
        <div style={cardSt}>
          <p style={titleSt}>🧭 Orientação inteligente</p>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 12px', lineHeight: 1.5 }}>
            Analisa o gap do lead e exibe uma de 3 mensagens: tem condição, falta pouco, precisa reorganizar.
          </p>

          <div style={{ ...grid2, marginBottom: 12 }}>
            <div>
              <label style={labelSt}>Limiar "falta pouco" (%)</label>
              <input
                name="gap_threshold" type="text" inputMode="decimal"
                defaultValue={fmtPct(initial.gap_threshold) || '30'}
                placeholder="Ex: 30"
                style={inputSt}
              />
              <p style={{ fontSize: 10, color: C.textTer, marginTop: 3 }}>
                30 = gap de até 30% da parcela é considerado &quot;falta pouco&quot;
              </p>
            </div>
            <div>
              <label style={labelSt}>Sonho alternativo (%)</label>
              <input
                name="alternative_percent" type="text" inputMode="decimal"
                defaultValue={fmtPct(initial.alternative_percent) || '40'}
                placeholder="Ex: 40"
                style={inputSt}
              />
              <p style={{ fontSize: 10, color: C.textTer, marginTop: 3 }}>
                40 = sugere sonho com 40% do valor original
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={checkRowSt}>
              <input
                type="checkbox" name="suggest_alternative"
                defaultChecked={initial.suggest_alternative ?? true}
                style={{ width: 16, height: 16, accentColor: C.purple }}
              />
              <span>Sugerir versão mais acessível do sonho quando gap é grande</span>
            </label>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Link &quot;gerar renda extra&quot;</label>
            <input
              name="extra_income_url" type="text"
              defaultValue={initial.extra_income_url ?? '/oportunidades'}
              placeholder="/oportunidades"
              style={inputSt}
            />
          </div>
          <div>
            <label style={labelSt}>Link &quot;ajustar meu sonho&quot;</label>
            <input
              name="adjust_dream_url" type="text"
              defaultValue={initial.adjust_dream_url ?? '/sonho/trocar'}
              placeholder="/sonho/trocar"
              style={inputSt}
            />
          </div>
        </div>
      )}

      {/* ══ COMPARATIVO ══════════════════════════════════════════════════════ */}
      {isComparison && (
        <div style={cardSt}>
          <p style={titleSt}>⚖️ Bloco comparativo</p>
          <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 12px' }}>
            Exibe dois caminhos lado a lado para o usuário comparar.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>Título do bloco</label>
            <input
              name="comp_title" type="text"
              defaultValue={initial.comp_title ?? 'Qual caminho é melhor para você?'}
              style={inputSt}
            />
          </div>

          <div style={grid2}>
            <div>
              <label style={labelSt}>Caminho A</label>
              <select name="path_a" defaultValue={initial.path_a ?? 'cash_saving'} style={selectSt}>
                {Object.entries(PATH_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Caminho B</label>
              <select name="path_b" defaultValue={initial.path_b ?? 'financing'} style={selectSt}>
                {Object.entries(PATH_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ══ OPORTUNIDADE ═════════════════════════════════════════════════════ */}
      {isOpportunity && (
        <div style={cardSt}>
          <p style={titleSt}>🎯 Bloco de oportunidade</p>

          <div style={{ marginBottom: 12 }}>
            <label style={labelSt}>Modo de exibição</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'fixed',    label: '📌 Fixo',    desc: 'Sempre a mesma oportunidade'             },
                { value: 'rotative', label: '🔄 Rotativo', desc: 'Troca a cada N dias (pool de opps)'     },
              ].map(opt => (
                <label key={opt.value} style={{ flex: 1, cursor: 'pointer' }}>
                  <input
                    type="radio" name="opp_mode"
                    value={opt.value}
                    defaultChecked={(initial.opp_mode ?? 'fixed') === opt.value}
                    style={{ position: 'absolute', opacity: 0, width: 0 }}
                  />
                  <div style={{
                    border: `1.5px solid ${C.border}`, borderRadius: 10,
                    padding: '8px 10px',
                    fontSize: 12, color: C.textSec,
                  }}>
                    <div style={{ fontWeight: 600, color: C.text }}>{opt.label}</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Rotação a cada (dias)</label>
            <input
              name="rotation_days" type="number"
              defaultValue={initial.rotation_days ?? 7}
              min={1} style={{ ...inputSt, maxWidth: 120 }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Link da oportunidade (CTA)</label>
            <input
              name="cta_url" type="text"
              defaultValue={initial.cta_url ?? ''}
              placeholder="https://... ou /[slug]/oportunidades"
              style={inputSt}
            />
            <p style={{ fontSize: 10, color: C.textTer, marginTop: 3 }}>
              Botão &quot;Ver oportunidade&quot; apontará para este link.
            </p>
          </div>

          <div>
            <label style={labelSt}>API URL (opcional — app de diárias)</label>
            <input
              name="api_url" type="text"
              defaultValue={initial.api_url ?? ''}
              placeholder="https://api.minhaapp.com.br/oportunidade"
              style={inputSt}
            />
            <p style={{ fontSize: 10, color: C.textTer, marginTop: 3 }}>
              Se preenchido, o servidor buscará dados em tempo real. Deixe vazio para usar dados estáticos.
            </p>
          </div>
        </div>
      )}

      {/* ══ BOTÕES ═══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <a
          href={backHref}
          style={{
            padding: '12px 20px', borderRadius: 12, fontSize: 13,
            border: `1px solid ${C.border}`, textDecoration: 'none',
            color: C.textSec, background: '#fff', fontWeight: 500,
          }}
        >
          Cancelar
        </a>
        <button
          type="submit" disabled={isPending}
          style={{
            flex: 1, border: 'none', borderRadius: 12,
            padding: '12px 20px', fontSize: 13, fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            background: isPending ? C.bgSecondary : C.purple,
            color: isPending ? C.textSec : '#fff',
            fontFamily: 'inherit', transition: 'background .2s',
          }}
        >
          {isPending
            ? 'Salvando...'
            : mode === 'create' ? '✓ Adicionar bloco' : '✓ Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
