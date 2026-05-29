'use client'

// =============================================================================
// _PathFormClient — Formulário de criação/edição de dream_path_settings
//
// Seções condicionais:
//   • "Consórcio" só para consortium_*
//   • "Lance" só para consortium_with_bid
//   • "Carta contemplada" só para consortium_*
//   • "Plano Pontual" só para consortium_programmed_date
//   • "Taxas e juros" só para financing / cdc / investment_plus_cdc
//   • "Investimento" só para investment / investment_plus_cdc
//   • "Promoção" para todos os tipos (exibida quando promo_active marcado)
//
// Campos monetários: type="text" inputMode="decimal" — parser no server action
// Campos percentuais: usuário digita "40" (= 40%) — server salva 0.40
// admin_fee_base: valores do banco = credit_value | invested_amount | financed_amount
// calculation_mode: fixed | proportional | formula (BLOCO 2)
// =============================================================================

import { useActionState, useState } from 'react'
import { C } from '@/app/components/ui'
import type { PathActionResult } from './actions'
import type { PathType } from '@/lib/dreamPlan'

// ── Dados iniciais passados do Server Component ───────────────────────────────

export type PathFormUnitOption = {
  id:   string
  name: string
  slug: string
}

export type PathFormInitial = {
  id?:                    string
  unit_id?:               string | null
  path_type?:             PathType | null
  dream_type?:            string | null
  dream_subtype?:         string | null
  label?:                 string | null
  description?:           string | null
  sort_order?:            number | null
  active?:                boolean | null
  show_capital_gain?:     boolean | null
  show_total_cost?:       boolean | null
  calculation_mode?:      string | null
  // Monetários
  default_amount?:                 number | null
  full_installment_amount?:        number | null
  reduced_installment_amount?:     number | null
  // Prazos/inteiros
  term_months?:                                number | null
  group_size?:                                 number | null
  draws_per_month?:                            number | null
  programmed_contemplation_month?:             number | null
  anticipation_start_month?:                   number | null
  anticipation_installments?:                  number | null
  required_paid_installments_for_credit?:      number | null
  // Percentuais
  annual_return_rate?:             number | null
  monthly_interest_rate?:          number | null
  annual_interest_rate?:           number | null
  admin_fee_rate?:                 number | null
  admin_fee_base?:                 string | null
  down_payment_percent?:           number | null
  bid_percent?:                    number | null
  average_letter_premium_percent?: number | null
  // Promoção (BLOCO 3)
  promo_active?:                     boolean | null
  promo_label?:                      string  | null
  promo_starts_at?:                  string  | null
  promo_ends_at?:                    string  | null
  promo_admin_fee_rate?:             number  | null
  promo_installment_amount?:         number  | null
  promo_reduced_installment_amount?: number  | null
}

interface Props {
  action:  (prev: PathActionResult | null, formData: FormData) => Promise<PathActionResult>
  initial: PathFormInitial
  mode:    'create' | 'edit'
  units:   PathFormUnitOption[]
}

// ── Helpers de exibição ───────────────────────────────────────────────────────

/** DB guarda 0.40 → exibe "40" */
function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return ''
  return String(Math.round(val * 10000) / 100)
}

/** DB guarda 2148.24 → exibe "2148,24" (BRL) */
function fmtBRLEdit(val: number | null | undefined): string {
  if (val === null || val === undefined) return ''
  return val.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** ISO string → "YYYY-MM-DDTHH:MM" para input datetime-local */
function fmtDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

// ── Estilos inline reutilizáveis ──────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '8px 10px', fontSize: 13, background: '#fff',
  color: C.text, fontFamily: 'inherit', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4,
}

const sectionStyle: React.CSSProperties = {
  background: '#fff', border: `1px solid ${C.border}`,
  borderRadius: 12, padding: '16px 16px 12px', marginBottom: 12,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: C.textSec,
  textTransform: 'uppercase', letterSpacing: 0.5,
  marginBottom: 12, paddingBottom: 8,
  borderBottom: `1px solid ${C.bgSecondary}`,
}

const grid2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
}

const grid3: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
}

const hintStyle: React.CSSProperties = {
  fontSize: 10, color: C.textTer, marginTop: 3, lineHeight: 1.4,
}

// ── Opções ────────────────────────────────────────────────────────────────────

const PATH_TYPE_OPTIONS: { value: PathType; label: string }[] = [
  { value: 'cash_saving',                label: 'Poupança / guardar dinheiro' },
  { value: 'investment',                 label: 'Investimento' },
  { value: 'financing',                  label: 'Financiamento' },
  { value: 'cdc',                        label: 'CDC' },
  { value: 'investment_plus_cdc',        label: 'Investimento + CDC' },
  { value: 'consortium_traditional',     label: 'Consórcio tradicional' },
  { value: 'consortium_with_bid',        label: 'Consórcio com lance' },
  { value: 'consortium_programmed_date', label: 'Consórcio data programada (Plano Pontual)' },
]

const DREAM_TYPE_OPTIONS = [
  { value: '', label: '— Todos os sonhos (genérico) —' },
  { value: 'carro',                  label: 'Carro' },
  { value: 'casa',                   label: 'Casa' },
  { value: 'negocio',                label: 'Negócio' },
  { value: 'viagem',                 label: 'Viagem' },
  { value: 'reserva',                label: 'Reserva' },
  { value: 'faculdade',              label: 'Faculdade' },
  { value: 'reforma',                label: 'Reforma' },
  { value: 'dividas',                label: 'Dívidas' },
  { value: 'moto',                   label: 'Moto' },
  { value: 'caminhao',               label: 'Caminhão' },
  { value: 'aposentadoria_imobiliaria', label: 'Aposentadoria imobiliária' },
  { value: 'outro',                  label: 'Outro' },
]

// BLOCO 1 — valores corrigidos para bater com o CHECK constraint do banco
const ADMIN_FEE_BASE_OPTIONS = [
  { value: '',                label: '— Não informado —' },
  { value: 'credit_value',   label: 'Sobre o crédito total' },
  { value: 'invested_amount', label: 'Sobre o valor investido' },
  { value: 'financed_amount', label: 'Sobre o valor financiado' },
]

// BLOCO 2 — calculation_mode
const CALCULATION_MODE_OPTIONS = [
  { value: '',             label: '— Padrão (proportional) —' },
  { value: 'fixed',        label: 'fixed — usar parcela exata (sem escalar)' },
  { value: 'proportional', label: 'proportional — escalar por target/default' },
  { value: 'formula',      label: 'formula — calcular PMT via taxa e prazo' },
]

// ── Sub-componentes locais ────────────────────────────────────────────────────

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ ...sectionStyle, borderColor: accent ?? C.border }}>
      <div style={{ ...sectionTitleStyle, color: accent ?? C.textSec }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function PathFormClient({ action, initial, mode, units }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  const [pathType, setPathType]   = useState<PathType | ''>(initial.path_type ?? '')
  const [promoOpen, setPromoOpen] = useState(initial.promo_active ?? false)

  const isConsortium = (
    pathType === 'consortium_traditional' ||
    pathType === 'consortium_with_bid' ||
    pathType === 'consortium_programmed_date'
  )
  const isProgrammedDate = pathType === 'consortium_programmed_date'
  const isFinancing      = pathType === 'financing' || pathType === 'cdc' || pathType === 'investment_plus_cdc'
  const isInvestment     = pathType === 'investment' || pathType === 'investment_plus_cdc'

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    paddingRight: 28,
  }

  const checkboxRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 8, background: C.bgApp,
    border: `1px solid ${C.border}`, cursor: 'pointer',
    fontSize: 13, color: C.text,
  }

  return (
    <form action={formAction}>

      {/* ── Erro global ── */}
      {state && !state.success && !state.field && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991B1B',
        }}>
          {state.error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. IDENTIFICAÇÃO */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Section title="1. Identificação">
        <div style={{ marginBottom: 10 }}>
          <Field
            label="Unidade"
            hint="Global vale para todas; unidade específica sobrescreve o global no /sonho"
          >
            <select
              name="unit_id"
              defaultValue={initial.unit_id ?? ''}
              style={{
                ...selectStyle,
                borderColor: state?.field === 'unit_id' ? '#EF4444' : C.border,
              }}
            >
              <option value="">Global (todas as unidades)</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.slug})
                </option>
              ))}
            </select>
            {state?.field === 'unit_id' && (
              <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{state.error}</p>
            )}
          </Field>
        </div>

        <div style={{ ...grid2, marginBottom: 10 }}>
          <Field label="Tipo de caminho *" hint="Define a lógica de cálculo">
            <select
              name="path_type"
              value={pathType}
              onChange={e => setPathType(e.target.value as PathType | '')}
              style={{ ...selectStyle, borderColor: state?.field === 'path_type' ? '#EF4444' : C.border }}
              required
            >
              <option value="">— Selecione —</option>
              {PATH_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {state?.field === 'path_type' && (
              <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{state.error}</p>
            )}
          </Field>

          <Field label="Tipo de sonho" hint="Vazio = genérico (vale para todos)">
            <select
              name="dream_type"
              defaultValue={initial.dream_type ?? ''}
              style={selectStyle}
            >
              {DREAM_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ ...grid2, marginBottom: 10 }}>
          <Field label="Subtipo do sonho" hint="Ex: financiado, a_vista — vazio para genérico">
            <input
              name="dream_subtype"
              type="text"
              defaultValue={initial.dream_subtype ?? ''}
              placeholder="Ex: financiado"
              style={inputStyle}
            />
          </Field>

          <Field label="Ordem de exibição" hint="Menor número aparece primeiro">
            <input
              name="sort_order"
              type="number"
              defaultValue={initial.sort_order ?? 0}
              min={0}
              step={1}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Rótulo (label) *" hint="Título do card no /sonho">
          <input
            name="label"
            type="text"
            defaultValue={initial.label ?? ''}
            placeholder="Ex: Consórcio tradicional"
            style={{ ...inputStyle, borderColor: state?.field === 'label' ? '#EF4444' : C.border }}
            required
          />
          {state?.field === 'label' && (
            <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{state.error}</p>
          )}
        </Field>

        <div style={{ marginTop: 10 }}>
          <Field label="Descrição" hint="Subtítulo opcional abaixo do label">
            <textarea
              name="description"
              defaultValue={initial.description ?? ''}
              placeholder="Breve descrição do caminho"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. STATUS E VISIBILIDADE */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Section title="2. Status e visibilidade">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              name="active"
              defaultChecked={initial.active ?? true}
              style={{ width: 16, height: 16, accentColor: C.purple }}
            />
            <span>Ativo — exibir no /sonho para o usuário</span>
          </label>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              name="show_capital_gain"
              defaultChecked={initial.show_capital_gain ?? false}
              style={{ width: 16, height: 16, accentColor: C.purple }}
            />
            <span>Exibir ganho de capital no card</span>
          </label>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              name="show_total_cost"
              defaultChecked={initial.show_total_cost ?? false}
              style={{ width: 16, height: 16, accentColor: C.purple }}
            />
            <span>Exibir custo total no card</span>
          </label>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. VALORES DE REFERÊNCIA + MODO DE CÁLCULO */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Section title="3. Valores de referência">
        {/* BLOCO 2 — calculation_mode */}
        <div style={{ marginBottom: 12 }}>
          <Field
            label="Modo de cálculo da parcela"
            hint="fixed = usar valor exato do banco; proportional = escalar por target/default; formula = calcular PMT pela taxa e prazo"
          >
            <select
              name="calculation_mode"
              defaultValue={initial.calculation_mode ?? ''}
              style={selectStyle}
            >
              {CALCULATION_MODE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <p style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
          Parcelas e valor padrão são usados como base de cálculo.
          No modo <strong>proportional</strong> (padrão), são escalados proporcionalmente ao sonho do usuário.
          No modo <strong>fixed</strong>, os valores são usados exatamente como cadastrados.
          No modo <strong>formula</strong>, a parcela é calculada via PMT com a taxa e prazo.
        </p>

        <div style={{ ...grid3, marginBottom: 10 }}>
          <Field label="Valor padrão (base)" hint="Meta de referência das parcelas abaixo">
            <input
              name="default_amount"
              type="text"
              inputMode="decimal"
              defaultValue={fmtBRLEdit(initial.default_amount)}
              placeholder="Ex: 100000"
              style={inputStyle}
            />
          </Field>

          <Field label="Parcela cheia" hint="Parcela base para a meta padrão">
            <input
              name="full_installment_amount"
              type="text"
              inputMode="decimal"
              defaultValue={fmtBRLEdit(initial.full_installment_amount)}
              placeholder="Ex: 2148,24"
              style={inputStyle}
            />
          </Field>

          <Field label="Parcela reduzida" hint="Parcela com desconto / lance / bid">
            <input
              name="reduced_installment_amount"
              type="text"
              inputMode="decimal"
              defaultValue={fmtBRLEdit(initial.reduced_installment_amount)}
              placeholder="Ex: 1800"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={grid2}>
          <Field label="Prazo (meses)" hint="Duração total do plano em meses">
            <input
              name="term_months"
              type="number"
              defaultValue={initial.term_months ?? ''}
              placeholder="Ex: 60"
              min={1}
              style={inputStyle}
            />
          </Field>

          <Field label="Entrada (%)" hint="Digite 20 para 20%. Percentual de entrada">
            <input
              name="down_payment_percent"
              type="text"
              inputMode="decimal"
              defaultValue={fmtPct(initial.down_payment_percent)}
              placeholder="Ex: 20"
              style={inputStyle}
            />
          </Field>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. TAXAS E JUROS (financing / cdc / investment_plus_cdc) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isFinancing && (
        <Section title="4. Taxas e juros (financiamento / CDC)">
          <div style={grid3}>
            <Field label="Taxa mensal (%)" hint="Digite 1.5 para 1,5% a.m.">
              <input
                name="monthly_interest_rate"
                type="text"
                inputMode="decimal"
                defaultValue={fmtPct(initial.monthly_interest_rate)}
                placeholder="Ex: 1.5"
                style={inputStyle}
              />
            </Field>

            <Field label="Taxa anual (%)" hint="Digite 19.56 para 19,56% a.a.">
              <input
                name="annual_interest_rate"
                type="text"
                inputMode="decimal"
                defaultValue={fmtPct(initial.annual_interest_rate)}
                placeholder="Ex: 19.56"
                style={inputStyle}
              />
            </Field>

            <Field label="Taxa admin. (%)" hint="Taxa de administração">
              <input
                name="admin_fee_rate"
                type="text"
                inputMode="decimal"
                defaultValue={fmtPct(initial.admin_fee_rate)}
                placeholder="Ex: 2"
                style={inputStyle}
              />
            </Field>

            <Field label="Base da taxa admin.">
              {/* BLOCO 1 — valores corrigidos: credit_value | invested_amount | financed_amount */}
              <select
                name="admin_fee_base"
                defaultValue={initial.admin_fee_base ?? ''}
                style={selectStyle}
              >
                {ADMIN_FEE_BASE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. INVESTIMENTO */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isInvestment && (
        <Section title="5. Investimento">
          <div style={grid2}>
            <Field label="Rentabilidade anual (%)" hint="Digite 10 para 10% a.a.">
              <input
                name="annual_return_rate"
                type="text"
                inputMode="decimal"
                defaultValue={fmtPct(initial.annual_return_rate)}
                placeholder="Ex: 10"
                style={inputStyle}
              />
            </Field>
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. CONSÓRCIO — estrutura do grupo */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isConsortium && (
        <Section title="6. Consórcio — estrutura do grupo">
          <div style={grid3}>
            <Field label="Tamanho do grupo" hint="Nº total de participantes (ex: 180)">
              <input
                name="group_size"
                type="number"
                defaultValue={initial.group_size ?? ''}
                placeholder="Ex: 180"
                min={1}
                style={inputStyle}
              />
            </Field>

            <Field label="Sorteios/mês" hint="Cartas sorteadas por mês">
              <input
                name="draws_per_month"
                type="number"
                defaultValue={initial.draws_per_month ?? ''}
                placeholder="Ex: 1"
                min={1}
                style={inputStyle}
              />
            </Field>

            <Field label="Taxa admin. (%)" hint="Ex: 17 para 17% sobre o crédito total">
              <input
                name="admin_fee_rate"
                type="text"
                inputMode="decimal"
                defaultValue={fmtPct(initial.admin_fee_rate)}
                placeholder="Ex: 17"
                style={inputStyle}
              />
            </Field>

            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Base da taxa admin.">
                {/* BLOCO 1 — valores corrigidos */}
                <select
                  name="admin_fee_base"
                  defaultValue={initial.admin_fee_base ?? ''}
                  style={selectStyle}
                >
                  {ADMIN_FEE_BASE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {pathType === 'consortium_with_bid' && (
            <div style={{ marginTop: 10 }}>
              <Field label="Lance fixo (%)" hint="Ex: 30 para lance de 30% do crédito">
                <input
                  name="bid_percent"
                  type="text"
                  inputMode="decimal"
                  defaultValue={fmtPct(initial.bid_percent)}
                  placeholder="Ex: 30"
                  style={{ ...inputStyle, maxWidth: 200 }}
                />
              </Field>
            </div>
          )}
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 7. CARTA CONTEMPLADA (consórcio) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isConsortium && (
        <Section title="7. Carta contemplada — potencial de venda">
          <p style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
            Ágio médio estimado. Não é garantia de venda. Exibido como &quot;potencial de recebimento&quot;.
          </p>
          <Field label="Ágio médio estimado (%)" hint="Ex: 40 para 40%. Exibido como estimativa — não é garantia.">
            <input
              name="average_letter_premium_percent"
              type="text"
              inputMode="decimal"
              defaultValue={fmtPct(initial.average_letter_premium_percent)}
              placeholder="Ex: 40"
              style={{ ...inputStyle, maxWidth: 200 }}
            />
          </Field>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 8. PLANO PONTUAL (apenas consortium_programmed_date) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isProgrammedDate && (
        <Section title="8. Plano Pontual — antecipação programada">
          <p style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
            Define contemplação programada e as fases de antecipação do Plano Pontual.
          </p>
          <div style={{ ...grid2, marginBottom: 10 }}>
            <Field label="Contemplação programada (mês)" hint="Ex: 24 → carta no 24º mês">
              <input
                name="programmed_contemplation_month"
                type="number"
                defaultValue={initial.programmed_contemplation_month ?? ''}
                placeholder="Ex: 24"
                min={1}
                style={inputStyle}
              />
            </Field>

            <Field label="Início das antecipações (mês)" hint="Ex: 6 → antecipa a partir do 6º mês">
              <input
                name="anticipation_start_month"
                type="number"
                defaultValue={initial.anticipation_start_month ?? ''}
                placeholder="Ex: 6"
                min={1}
                style={inputStyle}
              />
            </Field>

            <Field label="Parcelas antecipadas" hint="Ex: 18 → antecipa 18 parcelas">
              <input
                name="anticipation_installments"
                type="number"
                defaultValue={initial.anticipation_installments ?? ''}
                placeholder="Ex: 18"
                min={1}
                style={inputStyle}
              />
            </Field>

            <Field label="Parcelas pagas p/ buscar carta" hint="Ex: 24 = 6 normais + 18 antecipadas">
              <input
                name="required_paid_installments_for_credit"
                type="number"
                defaultValue={initial.required_paid_installments_for_credit ?? ''}
                placeholder="Ex: 24"
                min={1}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400E',
          }}>
            <strong>Fórmula da nova parcela:</strong><br />
            saldoRestante = parcela × (prazo − parcelas_pagas)<br />
            mesesRestantes = prazo − início_antecipação<br />
            novaParcela = saldoRestante ÷ mesesRestantes
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 9. PROMOÇÃO (BLOCO 3) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Section title="9. Promoção por período" accent={promoOpen ? '#C2410C' : undefined}>
        <p style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
          Quando ativa e dentro do período, a promoção substitui os valores normais no /sonho.
          Exibe badge <strong>🔥 Condição promocional ativa</strong> para o usuário.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ ...checkboxRowStyle, borderColor: promoOpen ? '#FED7AA' : C.border }}>
            <input
              type="checkbox"
              name="promo_active"
              checked={promoOpen}
              onChange={e => setPromoOpen(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#C2410C' }}
            />
            <span>🔥 Promoção ativa — exibir condições especiais no /sonho</span>
          </label>
        </div>

        {promoOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Nome da promoção" hint="Ex: Feirão de Julho — exibido no badge do usuário">
              <input
                name="promo_label"
                type="text"
                defaultValue={initial.promo_label ?? ''}
                placeholder="Ex: Feirão de Julho"
                style={inputStyle}
              />
            </Field>

            <div style={grid2}>
              <Field label="Início da promoção" hint="Deixe vazio para sem restrição de início">
                <input
                  name="promo_starts_at"
                  type="datetime-local"
                  defaultValue={fmtDatetimeLocal(initial.promo_starts_at)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Fim da promoção" hint="Deixe vazio para sem data de expiração">
                <input
                  name="promo_ends_at"
                  type="datetime-local"
                  defaultValue={fmtDatetimeLocal(initial.promo_ends_at)}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ ...grid3 }}>
              <Field label="Parcela promocional" hint="Substitui parcela cheia durante a promoção">
                <input
                  name="promo_installment_amount"
                  type="text"
                  inputMode="decimal"
                  defaultValue={fmtBRLEdit(initial.promo_installment_amount)}
                  placeholder="Ex: 1500"
                  style={inputStyle}
                />
              </Field>

              <Field label="Parcela reduzida promo." hint="Substitui parcela reduzida durante a promoção">
                <input
                  name="promo_reduced_installment_amount"
                  type="text"
                  inputMode="decimal"
                  defaultValue={fmtBRLEdit(initial.promo_reduced_installment_amount)}
                  placeholder="Ex: 1200"
                  style={inputStyle}
                />
              </Field>

              <Field label="Taxa admin. promo. (%)" hint="Ex: 15 para 15% — substitui durante a promoção">
                <input
                  name="promo_admin_fee_rate"
                  type="text"
                  inputMode="decimal"
                  defaultValue={fmtPct(initial.promo_admin_fee_rate)}
                  placeholder="Ex: 15"
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{
              background: '#FFF7ED', border: '1px solid #FED7AA',
              borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#C2410C',
            }}>
              ⚠️ A promoção substitui os valores de parcela durante o período.
              O modo de cálculo (<strong>calculation_mode</strong>) continua sendo aplicado às parcelas promocionais.
              Promoção não altera parcelas do Plano Pontual que dependem de fórmula interna.
            </div>
          </div>
        )}

        {!promoOpen && (
          <p style={{ fontSize: 12, color: C.textTer, margin: 0 }}>
            Marque a caixa acima para exibir campos de promoção.
          </p>
        )}
      </Section>

      {/* ── Ações ── */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '12px 0', marginTop: 4,
      }}>
        <a
          href="/admin/configuracoes/caminhos-sonho"
          style={{
            padding: '10px 20px', borderRadius: 8, fontSize: 13,
            background: C.bgSecondary, color: C.textSec,
            textDecoration: 'none', fontWeight: 500,
            border: `1px solid ${C.border}`,
          }}
        >
          Cancelar
        </a>

        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: isPending ? C.bgSecondary : C.purple,
            color: isPending ? C.textSec : '#fff',
            border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all .15s',
          }}
        >
          {isPending
            ? 'Salvando…'
            : mode === 'edit' ? 'Salvar alterações' : 'Criar caminho'
          }
        </button>
      </div>

    </form>
  )
}
