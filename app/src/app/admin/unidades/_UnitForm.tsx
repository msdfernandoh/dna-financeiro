'use client'

// =============================================================================
// Formulário compartilhado: Criar / Editar Unidade
// Client Component — useActionState, inline styles (padrão do projeto)
// =============================================================================

import { useActionState, useState } from 'react'
import type { CSSProperties } from 'react'
import { C } from '@/app/components/ui'
import type { UnitFormResult } from './actions'

// ── Estados brasileiros ───────────────────────────────────────────────────────

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

// ── Metadados ─────────────────────────────────────────────────────────────────

const UNIT_STATUS_OPTIONS = [
  { value: 'active',    label: '✅ Ativa',     desc: 'Visível e operacional' },
  { value: 'paused',    label: '⏸️ Pausada',   desc: 'Suspensa temporariamente' },
  { value: 'cancelled', label: '❌ Cancelada', desc: 'Contrato encerrado' },
]

const BILLING_PLAN_OPTIONS = [
  { value: 'gratis',    label: '🆓 Grátis'   },
  { value: 'piloto',    label: '🧪 Piloto'   },
  { value: 'mensal',    label: '📅 Mensal'   },
  { value: 'anual',     label: '📆 Anual'    },
  { value: 'franquia',  label: '🏢 Franquia' },
]

const PLAN_OPTIONS = [
  { value: 'basic',    label: '⚙️ Basic',    desc: 'Funcionalidades essenciais' },
  { value: 'standard', label: '🚀 Standard', desc: 'Padrão completo'            },
  { value: 'premium',  label: '💎 Premium',  desc: 'Acesso a tudo'              },
]

// ── Estilos ───────────────────────────────────────────────────────────────────

const inputSt: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `0.5px solid ${C.border}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 13,
  fontFamily: 'inherit', color: C.text, background: '#fff',
  outline: 'none',
}

const labelSt: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.textSec, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4,
}

const cardSt: CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: `0.5px solid ${C.border}`,
  padding: '16px', marginBottom: 12,
}

const sectionTitleSt: CSSProperties = {
  fontSize: 12, fontWeight: 700, color: C.purple,
  margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5,
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface UnitDefaultValues {
  name:           string
  slug:           string
  city:           string
  state:          string
  contact_name:   string
  contact_email:  string
  contact_phone:  string
  unit_status:    string
  billing_plan:   string
  plan:           string
  logo_url:       string
  primary_color:  string
  notes:          string
  // Novos campos
  unit_type?:      string | null
  parent_unit_id?: string | null
  allowed_blocks?: string[] | null
}

export type CityUnitOption = { id: string; name: string; city: string; state: string }

interface Props {
  action:        (prev: UnitFormResult | null, fd: FormData) => Promise<UnitFormResult>
  defaultValues?: Partial<UnitDefaultValues>
  mode:          'create' | 'edit'
  backHref:      string
  cityUnits?:    CityUnitOption[]  // lista de unidades cidade para o select de pai
}

// ── Blocos disponíveis ────────────────────────────────────────────────────────

const BLOCK_GROUPS = [
  {
    title: 'Estruturais (sempre disponíveis)',
    hint:  'Recomendado manter todos ativos',
    blocks: [
      { value: 'financial_profile',   label: 'Perfil financeiro'       },
      { value: 'dream_simulation',    label: 'Simulação de acumulação' },
      { value: 'financial_numbers',   label: 'Renda e Despesas'        },
      { value: 'smart_guidance',      label: 'Orientação inteligente'  },
      { value: 'ai_recommendation',   label: 'Recomendação da IA'      },
      { value: 'alert_section',       label: 'Ponto de atenção'        },
      { value: 'action_buttons',      label: 'Botões de ação'          },
    ],
  },
  {
    title: 'Caminhos financeiros',
    hint:  'Libere os produtos que o consultor pode oferecer',
    blocks: [
      { value: 'cash_saving',                  label: '💰 Poupança / guardar'        },
      { value: 'investment',                   label: '📈 Investimento'              },
      { value: 'consortium_traditional',       label: '🤝 Consórcio tradicional'     },
      { value: 'consortium_with_bid',          label: '🤝⚡ Consórcio com lance'     },
      { value: 'consortium_programmed_date',   label: '🎯 Plano Pontual'             },
      { value: 'financing',                    label: '🏦 Financiamento'             },
      { value: 'cdc',                          label: '💳 CDC'                       },
    ],
  },
  {
    title: 'Blocos especiais',
    hint:  'Comparativo e oportunidades',
    blocks: [
      { value: 'comparison',  label: '⚖️ Comparativo de caminhos' },
      { value: 'opportunity', label: '🎯 Oportunidade em destaque' },
    ],
  },
]

// ── Componente ────────────────────────────────────────────────────────────────

export function UnitForm({ action, defaultValues: dv = {}, mode, backHref, cityUnits = [] }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  // Preview da cor primária
  const [colorPreview, setColorPreview]       = useState(dv.primary_color ?? '')
  // Status selecionado — controlado para atualizar visual dos cards
  const [selectedStatus, setSelectedStatus]   = useState(dv.unit_status ?? 'active')
  // Tipo de unidade
  const [unitType, setUnitType]               = useState(dv.unit_type ?? 'city')
  // Blocos permitidos — null = sem restrição
  const [noRestriction, setNoRestriction]     = useState(
    dv.allowed_blocks == null || dv.allowed_blocks.length === 0
  )
  const [checkedBlocks, setCheckedBlocks]     = useState<Set<string>>(
    new Set(dv.allowed_blocks ?? [])
  )

  const toggleBlock = (value: string) => {
    setCheckedBlocks(prev => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  // Helper para detectar erro por field
  const fieldError = (field: string) =>
    state?.success === false && state.field === field ? state.error : null

  return (
    <form action={formAction} noValidate>

      {/* ══ IDENTIFICAÇÃO ════════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={sectionTitleSt}>🏢 Identificação</p>

        {/* Nome */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt} htmlFor="name">
            Nome da unidade <span style={{ color: C.coral }}>*</span>
          </label>
          <input
            id="name" name="name" type="text"
            required maxLength={120}
            defaultValue={dv.name ?? ''}
            placeholder="Ex: DNA Financeiro Lucas do Rio Verde"
            style={{ ...inputSt, borderColor: fieldError('name') ? C.coral : C.border }}
          />
          {fieldError('name') && (
            <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('name')}</p>
          )}
        </div>

        {/* Slug */}
        <div>
          <label style={labelSt} htmlFor="slug">
            Slug (URL da unidade) <span style={{ color: C.coral }}>*</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textSec, flexShrink: 0 }}>dnafinanceiro.com/</span>
            <input
              id="slug" name="slug" type="text"
              required maxLength={50}
              defaultValue={dv.slug ?? ''}
              placeholder="lucas-do-rio-verde"
              style={{ ...inputSt, flex: 1, borderColor: fieldError('slug') ? C.coral : C.border }}
            />
          </div>
          <p style={{ fontSize: 10, color: C.textTer, margin: '4px 0 0' }}>
            Apenas letras minúsculas, números e hífens. Mín. 3, máx. 50 caracteres.
          </p>
          {fieldError('slug') && (
            <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('slug')}</p>
          )}
        </div>
      </div>

      {/* ══ TIPO DE UNIDADE ══════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={sectionTitleSt}>🏗️ Tipo de Unidade</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { value: 'city',       label: '🏙️ Cidade',     desc: 'Unidade geográfica aberta — leads sem consultor ficam aqui' },
            { value: 'consultant', label: '🤝 Consultor',  desc: 'Consultor ou corretor com assinatura individual' },
            { value: 'agency',     label: '🏢 Agência',    desc: 'Imobiliária, administradora ou agência de consórcio' },
          ].map(opt => (
            <label key={opt.value} style={{ flex: 1, minWidth: 140, cursor: 'pointer' }}>
              <input
                type="radio" name="unit_type" value={opt.value}
                checked={unitType === opt.value}
                onChange={() => setUnitType(opt.value)}
                style={{ position: 'absolute', opacity: 0, width: 0 }}
              />
              <div style={{
                border: `1.5px solid ${unitType === opt.value ? C.purple : C.border}`,
                borderRadius: 10, padding: '8px 10px',
                background: unitType === opt.value ? C.purpleBg : '#fff',
                transition: 'all .15s',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: unitType === opt.value ? C.purpleDeep : C.text }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 10, color: C.textSec, marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Unidade pai — só para consultor/agência */}
        {(unitType === 'consultant' || unitType === 'agency') && (
          <div>
            <label style={labelSt} htmlFor="parent_unit_id">
              Cidade (unidade pai) <span style={{ color: C.coral }}>*</span>
            </label>
            <select
              id="parent_unit_id" name="parent_unit_id"
              defaultValue={dv.parent_unit_id ?? ''}
              style={{ ...inputSt, borderColor: fieldError('parent_unit_id') ? C.coral : C.border }}
            >
              <option value="">— Selecione a cidade —</option>
              {cityUnits.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.city}/{u.state})
                </option>
              ))}
            </select>
            {fieldError('parent_unit_id') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('parent_unit_id')}</p>
            )}
            <p style={{ fontSize: 10, color: C.textTer, margin: '4px 0 0' }}>
              Leads que se cadastrarem sem código de consultor vão para a unidade cidade.
            </p>
          </div>
        )}
      </div>

      {/* ══ BLOCOS PERMITIDOS ════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={sectionTitleSt}>🧩 Blocos Permitidos</p>
        <p style={{ fontSize: 12, color: C.textSec, margin: '0 0 12px', lineHeight: 1.5 }}>
          Define quais blocos esta unidade pode configurar nas telas (Diagnóstico, Painel, Relatório).
          Blocos não permitidos não aparecem no configurador de telas desta unidade.
        </p>

        <label style={{ ...inputSt, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', padding: '10px 12px' }}>
          <input
            type="checkbox"
            checked={noRestriction}
            onChange={e => setNoRestriction(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: C.purple }}
          />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
              Sem restrição — todos os blocos disponíveis
            </span>
            <div style={{ fontSize: 10, color: C.textSec }}>
              Padrão para unidades cidade. Desmarque para escolher blocos específicos.
            </div>
          </div>
        </label>

        {!noRestriction && BLOCK_GROUPS.map(group => (
          <div key={group.title} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textSec, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {group.title}
            </p>
            <p style={{ fontSize: 10, color: C.textTer, margin: '0 0 8px' }}>{group.hint}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {group.blocks.map(b => (
                <label key={b.value} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                  background: checkedBlocks.has(b.value) ? C.purpleBg : C.bgSecondary,
                  border: `1px solid ${checkedBlocks.has(b.value) ? C.purple + '40' : C.border}`,
                  fontSize: 12, color: checkedBlocks.has(b.value) ? C.purpleDeep : C.text,
                  transition: 'all .1s',
                }}>
                  <input
                    type="checkbox"
                    name="allowed_blocks"
                    value={b.value}
                    checked={checkedBlocks.has(b.value)}
                    onChange={() => toggleBlock(b.value)}
                    style={{ width: 14, height: 14, accentColor: C.purple }}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Hidden input para sinalizar "sem restrição" quando marcado */}
        {noRestriction && (
          <input type="hidden" name="allowed_blocks" value="" />
        )}
      </div>

      {/* ══ LOCALIZAÇÃO ══════════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={sectionTitleSt}>📍 Localização</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>

          {/* Cidade */}
          <div>
            <label style={labelSt} htmlFor="city">
              Cidade <span style={{ color: C.coral }}>*</span>
            </label>
            <input
              id="city" name="city" type="text"
              required maxLength={100}
              defaultValue={dv.city ?? ''}
              placeholder="Lucas do Rio Verde"
              style={{ ...inputSt, borderColor: fieldError('city') ? C.coral : C.border }}
            />
            {fieldError('city') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('city')}</p>
            )}
          </div>

          {/* Estado */}
          <div style={{ minWidth: 90 }}>
            <label style={labelSt} htmlFor="state">
              Estado <span style={{ color: C.coral }}>*</span>
            </label>
            <select
              id="state" name="state"
              defaultValue={dv.state ?? ''}
              style={{ ...inputSt, borderColor: fieldError('state') ? C.coral : C.border }}
            >
              <option value="">UF</option>
              {BR_STATES.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            {fieldError('state') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('state')}</p>
            )}
          </div>
        </div>
      </div>

      {/* ══ CONTATO ══════════════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={sectionTitleSt}>👤 Responsável / Contato</p>

        {/* Nome do responsável */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt} htmlFor="contact_name">
            Nome do responsável <span style={{ color: C.coral }}>*</span>
          </label>
          <input
            id="contact_name" name="contact_name" type="text"
            required maxLength={120}
            defaultValue={dv.contact_name ?? ''}
            placeholder="João Silva"
            style={{ ...inputSt, borderColor: fieldError('contact_name') ? C.coral : C.border }}
          />
          {fieldError('contact_name') && (
            <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('contact_name')}</p>
          )}
        </div>

        {/* Email + Telefone lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelSt} htmlFor="contact_email">
              E-mail <span style={{ color: C.coral }}>*</span>
            </label>
            <input
              id="contact_email" name="contact_email" type="email"
              required maxLength={200}
              defaultValue={dv.contact_email ?? ''}
              placeholder="joao@exemplo.com"
              style={{ ...inputSt, borderColor: fieldError('contact_email') ? C.coral : C.border }}
            />
            {fieldError('contact_email') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('contact_email')}</p>
            )}
          </div>
          <div>
            <label style={labelSt} htmlFor="contact_phone">
              Telefone <span style={{ color: C.textTer }}>(opcional)</span>
            </label>
            <input
              id="contact_phone" name="contact_phone" type="text"
              inputMode="tel" maxLength={20}
              defaultValue={dv.contact_phone ?? ''}
              placeholder="(65) 99999-1234"
              style={inputSt}
            />
          </div>
        </div>
      </div>

      {/* ══ STATUS / PLANOS ══════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={sectionTitleSt}>📋 Status e Planos</p>

        {/* Status operacional */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>
            Status operacional <span style={{ color: C.coral }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {UNIT_STATUS_OPTIONS.map(opt => (
              <label key={opt.value} style={{ flex: 1, minWidth: 120, cursor: 'pointer' }}>
                <input
                  type="radio" name="unit_status" value={opt.value}
                  checked={selectedStatus === opt.value}
                  onChange={() => setSelectedStatus(opt.value)}
                  style={{ position: 'absolute', opacity: 0, width: 0 }}
                />
                <StatusCard label={opt.label} desc={opt.desc} isActive={selectedStatus === opt.value} />
              </label>
            ))}
          </div>
          {fieldError('unit_status') && (
            <p style={{ color: C.coral, fontSize: 12, margin: '6px 0 0' }}>{fieldError('unit_status')}</p>
          )}
        </div>

        {/* Plano comercial + plano de funcionalidades lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelSt} htmlFor="billing_plan">
              Plano comercial <span style={{ color: C.coral }}>*</span>
            </label>
            <select
              id="billing_plan" name="billing_plan"
              defaultValue={dv.billing_plan ?? 'gratis'}
              style={{ ...inputSt, borderColor: fieldError('billing_plan') ? C.coral : C.border }}
            >
              {BILLING_PLAN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {fieldError('billing_plan') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('billing_plan')}</p>
            )}
          </div>
          <div>
            <label style={labelSt} htmlFor="plan">
              Plano de funcionalidades <span style={{ color: C.coral }}>*</span>
            </label>
            <select
              id="plan" name="plan"
              defaultValue={dv.plan ?? 'basic'}
              style={{ ...inputSt, borderColor: fieldError('plan') ? C.coral : C.border }}
            >
              {PLAN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
              ))}
            </select>
            {fieldError('plan') && (
              <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('plan')}</p>
            )}
          </div>
        </div>
      </div>

      {/* ══ PERSONALIZAÇÃO ═══════════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <p style={sectionTitleSt}>🎨 Personalização (opcional)</p>

        {/* Logo URL */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt} htmlFor="logo_url">URL do logo</label>
          <input
            id="logo_url" name="logo_url" type="url"
            defaultValue={dv.logo_url ?? ''}
            placeholder="https://..."
            style={inputSt}
          />
        </div>

        {/* Cor primária */}
        <div>
          <label style={labelSt} htmlFor="primary_color">
            Cor primária <span style={{ color: C.textTer }}>(hex sem #)</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="primary_color" name="primary_color" type="text"
              maxLength={6}
              defaultValue={dv.primary_color ?? ''}
              placeholder="7F77DD"
              onChange={e => setColorPreview(e.target.value.replace('#', ''))}
              style={{ ...inputSt, flex: 1, borderColor: fieldError('primary_color') ? C.coral : C.border }}
            />
            {/* Swatch de preview */}
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: colorPreview.match(/^[0-9a-fA-F]{6}$/)
                ? `#${colorPreview}`
                : C.bgSecondary,
              border: `1px solid ${C.border}`,
            }} />
          </div>
          {fieldError('primary_color') && (
            <p style={{ color: C.coral, fontSize: 12, margin: '4px 0 0' }}>{fieldError('primary_color')}</p>
          )}
        </div>
      </div>

      {/* ══ OBSERVAÇÕES INTERNAS ═════════════════════════════════════════════════ */}
      <div style={cardSt}>
        <label style={labelSt} htmlFor="notes">
          📝 Observações internas <span style={{ color: C.textTer }}>(só master vê)</span>
        </label>
        <textarea
          id="notes" name="notes"
          rows={3} maxLength={2000}
          defaultValue={dv.notes ?? ''}
          placeholder="Histórico, acordos, observações de suporte..."
          style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      {/* ══ ERRO GERAL ═══════════════════════════════════════════════════════════ */}
      {state?.success === false && !state.field && (
        <div style={{
          background: C.coralBg, borderRadius: 12,
          padding: '12px 14px', marginBottom: 12,
          color: C.coralDark, fontSize: 13,
        }}>
          ⚠️ {state.error}
        </div>
      )}

      {/* ══ BOTÕES ═══════════════════════════════════════════════════════════════ */}
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
          type="submit"
          disabled={isPending}
          style={{
            flex: 1, border: 'none', borderRadius: 12,
            padding: '12px 20px', fontSize: 13, fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            background: isPending ? 'rgba(0,0,0,0.12)' : C.purple,
            color: isPending ? C.textSec : '#fff',
            fontFamily: 'inherit', transition: 'background .2s',
          }}
        >
          {isPending
            ? 'Salvando...'
            : mode === 'create' ? '✓ Criar unidade' : '✓ Salvar alterações'}
        </button>
      </div>
    </form>
  )
}

// ── Sub-componente: card de status ────────────────────────────────────────────

function StatusCard({
  label, desc, isActive,
}: {
  label: string; desc: string; isActive: boolean
}) {
  return (
    <div style={{
      border: `1.5px solid ${isActive ? C.purple : C.border}`,
      borderRadius: 10, padding: '8px 10px',
      background: isActive ? C.purpleBg : '#fff',
      transition: 'all .15s',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? C.purpleDeep : C.text }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>{desc}</div>
    </div>
  )
}
