// =============================================================================
// Dream Plan — helpers compartilhados entre páginas do usuário e admin
//
// Cálculos simples, sem rendimento composto nem taxa de juros.
// Isso é uma simulação inicial — plano detalhado vem de dream_plan_settings.
// =============================================================================

/** Mapeamento subtipo-valor → label legível */
export const SUBTYPE_LABELS: Record<string, string> = {
  // carro_comprar
  financiado:       'Financiado',
  a_vista:          'À vista',
  consorcio:        'Consórcio',
  // carro_trocar
  entrada_carro:    'Usar carro como entrada',
  vender_comprar:   'Vender e comprar outro',
  financiar_novo:   'Financiar o novo',
  // casa
  comprar_pronta:   'Comprar pronta',
  construir:        'Construir',
  financiamento:    'Financiamento habitacional',
  // caminhao
  renda_autonoma:   'Renda autônoma (frete)',
  empresa:          'Para empresa',
  ampliar_frota:    'Ampliar frota atual',
  // aposentadoria_imobiliaria
  comprar_alugar:   'Comprar para alugar',
  construir_alugar: 'Construir para alugar',
  revenda:          'Revenda de imóveis',
  // negocio
  abrir_zero:       'Abrir do zero',
  franquia:         'Franquia',
  ampliar_atual:    'Ampliar negócio atual',
  // dividas
  cartao:           'Cartão de crédito',
  emprestimo:       'Empréstimo / cheque especial',
  varias:           'Várias dívidas ao mesmo tempo',
}

export function formatDreamSubtype(subtype: string | null | undefined): string | null {
  if (!subtype) return null
  return SUBTYPE_LABELS[subtype] ?? subtype.replace(/_/g, ' ')
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export type GoalStatus = 'confortavel' | 'possivel' | 'dificil'

export const GOAL_STATUS_META: Record<GoalStatus, { label: string; color: string; bg: string }> = {
  confortavel: { label: 'Meta confortável',             color: '#166534', bg: '#DCFCE7' },
  possivel:    { label: 'Possível com ajustes',         color: '#92400E', bg: '#FEF3C7' },
  dificil:     { label: 'Exige renda extra ou mais prazo', color: '#991B1B', bg: '#FEE2E2' },
}

/** Configuração de plano vinda de dream_plan_settings (global, sem unit_id) */
export type PlanSettings = {
  term_months:                number | null
  full_installment_amount:    number | null
  reduced_installment_amount: number | null
  full_installment_rate:      number | null
  reduced_installment_rate:   number | null
}

/** Status da parcela sugerida relativo à sobra mensal do lead */
export type InstallmentStatus = 'confortavel' | 'possivel' | 'nao_cabe' | 'reorganizar'

export const INSTALLMENT_STATUS_META: Record<InstallmentStatus, {
  label: string; color: string; bg: string; emoji: string
}> = {
  confortavel: { label: 'Cabe com conforto',           color: '#166534', bg: '#DCFCE7', emoji: '✅' },
  possivel:    { label: 'Cabe com ajustes',             color: '#92400E', bg: '#FEF3C7', emoji: '⚠️' },
  nao_cabe:    { label: 'Ainda não cabe na renda',      color: '#991B1B', bg: '#FEE2E2', emoji: '🚨' },
  reorganizar: { label: 'Reorganize as finanças antes', color: '#7C3AED', bg: '#EDE9FE', emoji: '🔄' },
}

export interface DreamPlan {
  target:  number
  sobra:   number
  /** Acumulado com sobra atual em cada prazo */
  em12:  number; em24: number; em36: number; em60: number
  /** Mensal necessário para bater a meta em cada prazo */
  need12: number; need24: number; need36: number; need60: number
  status12: GoalStatus; status24: GoalStatus; status36: GoalStatus; status60: GoalStatus
  /** Menor prazo (meses) que a sobra atual atinge a meta. null se sobra <= 0 */
  bestMonths: number | null
  // ── Campos do plano sugerido (dream_plan_settings) ─────────────────────────
  /** true quando dream_plan_settings foi encontrado para este tipo de sonho */
  hasPlanSettings:          boolean
  /** Prazo sugerido em meses (null quando não configurado) */
  suggestedTerm:            number | null
  /** Parcela cheia sugerida (null quando não configurado) */
  fullInstallment:          number | null
  /** Parcela reduzida sugerida (null quando não configurado) */
  reducedInstallment:       number | null
  /** Status da parcela cheia em relação à sobra atual */
  fullInstallmentStatus:    InstallmentStatus | null
  /** Status da parcela reduzida em relação à sobra atual */
  reducedInstallmentStatus: InstallmentStatus | null
}

function goalStatus(sobra: number, need: number): GoalStatus {
  if (sobra <= 0) return 'dificil'
  const gap = need - sobra
  if (gap <= 0)           return 'confortavel'
  if (gap / need <= 0.30) return 'possivel'
  return 'dificil'
}

/** Avalia se a parcela cabe confortavelmente na sobra mensal */
function installmentStatus(installment: number | null, sobra: number): InstallmentStatus | null {
  if (installment === null) return null
  if (sobra <= 0)           return 'reorganizar'
  const ratio = installment / sobra
  if (ratio <= 0.30)        return 'confortavel'
  if (ratio <= 0.50)        return 'possivel'
  return 'nao_cabe'
}

export function calculateDreamPlan(
  target: number,
  sobra:  number,
  planSettings?: PlanSettings | null,
): DreamPlan {
  const need12 = target / 12
  const need24 = target / 24
  const need36 = target / 36
  const need60 = target / 60

  const hasPlanSettings      = !!planSettings
  const suggestedTerm        = planSettings?.term_months                ?? null
  const fullInstallment      = planSettings?.full_installment_amount    ?? null
  const reducedInstallment   = planSettings?.reduced_installment_amount ?? null

  return {
    target, sobra,
    em12: sobra * 12, em24: sobra * 24, em36: sobra * 36, em60: sobra * 60,
    need12, need24, need36, need60,
    status12: goalStatus(sobra, need12),
    status24: goalStatus(sobra, need24),
    status36: goalStatus(sobra, need36),
    status60: goalStatus(sobra, need60),
    bestMonths: sobra > 0 ? Math.ceil(target / sobra) : null,
    hasPlanSettings,
    suggestedTerm,
    fullInstallment,
    reducedInstallment,
    fullInstallmentStatus:    installmentStatus(fullInstallment,    sobra),
    reducedInstallmentStatus: installmentStatus(reducedInstallment, sobra),
  }
}

/** Formata um número como moeda BRL sem centavos */
export function fmtBRLPlan(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// =============================================================================
// Dream Path Settings — tipos e helpers para caminhos dinâmicos do banco
// =============================================================================

export type PathType =
  | 'cash_saving'
  | 'investment'
  | 'financing'
  | 'cdc'
  | 'investment_plus_cdc'
  | 'consortium_traditional'
  | 'consortium_with_bid'
  | 'consortium_programmed_date'

export interface DreamPathSetting {
  path_type: PathType
  dream_subtype: string | null
  label: string
  description: string | null
  sort_order: number
  show_capital_gain: boolean
  show_total_cost: boolean
  default_amount: number | null
  term_months: number | null
  annual_return_rate: number | null
  monthly_interest_rate: number | null
  annual_interest_rate: number | null
  admin_fee_rate: number | null
  admin_fee_base: string | null
  down_payment_percent: number | null
  bid_percent: number | null
  programmed_contemplation_month: number | null
  anticipation_start_month: number | null
  anticipation_installments: number | null
  full_installment_amount: number | null
  reduced_installment_amount: number | null
  // ── Campos do Plano Pontual e Carta Contemplada ────────────────────────────
  /** Tamanho do grupo (ex: 180 participantes) */
  group_size: number | null
  /** Sorteios por mês (ex: 1) */
  draws_per_month: number | null
  /** Total de parcelas pagas para buscar a carta de crédito (ex: 24 = 6 + 18) */
  required_paid_installments_for_credit: number | null
  /** Ágio médio de carta contemplada como decimal (ex: 0.40 = 40%). Não é garantia. */
  average_letter_premium_percent: number | null
  // ── Modo de cálculo ────────────────────────────────────────────────────────
  /** 'fixed' | 'proportional' | 'formula' | null (padrão: proportional) */
  calculation_mode: string | null
  // ── Promoção ───────────────────────────────────────────────────────────────
  promo_active:                     boolean | null
  promo_label:                      string  | null
  promo_starts_at:                  string  | null
  promo_ends_at:                    string  | null
  promo_admin_fee_rate:             number  | null
  promo_installment_amount:         number  | null
  promo_reduced_installment_amount: number  | null
}

/**
 * Deduplica caminhos por path_type.
 * Para o mesmo path_type, o registro específico (dream_subtype bate com o sonho)
 * vence o genérico (dream_subtype null).
 */
export function resolvePaths(
  paths: DreamPathSetting[],
  dreamSubtype: string | null,
): DreamPathSetting[] {
  const map = new Map<PathType, DreamPathSetting>()
  for (const path of paths) {
    const existing = map.get(path.path_type)
    if (!existing) {
      map.set(path.path_type, path)
    } else {
      const incomingIsSpecific = path.dream_subtype !== null && path.dream_subtype === dreamSubtype
      const existingIsGeneric  = existing.dream_subtype === null
      if (incomingIsSpecific && existingIsGeneric) {
        map.set(path.path_type, path)
      }
    }
  }
  return [...map.values()].sort((a, b) => a.sort_order - b.sort_order)
}

/** Taxa anual → taxa mensal equivalente: (1 + r_a)^(1/12) − 1 */
export function annualToMonthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1
}

/** Valor futuro de aportes mensais com juros compostos */
export function futureValue(monthly: number, months: number, rate: number): number {
  if (monthly <= 0) return 0
  if (rate === 0)   return monthly * months
  return monthly * ((Math.pow(1 + rate, months) - 1) / rate)
}

/** Parcela de financiamento — fórmula PMT */
export function calcInstallment(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months
  const factor = Math.pow(1 + monthlyRate, months)
  return principal * monthlyRate * factor / (factor - 1)
}

/** Avalia se uma parcela cabe na sobra mensal do lead */
export function evalInstallmentStatus(
  installment: number | null,
  sobra: number,
): InstallmentStatus | null {
  if (installment === null) return null
  if (sobra <= 0)           return 'reorganizar'
  const ratio = installment / sobra
  if (ratio <= 0.30) return 'confortavel'
  if (ratio <= 0.50) return 'possivel'
  return 'nao_cabe'
}
