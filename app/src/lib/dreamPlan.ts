// =============================================================================
// Dream Plan — helpers compartilhados entre páginas do usuário e admin
//
// Cálculos simples, sem rendimento composto nem taxa de juros.
// Isso é uma simulação inicial — plano detalhado vem em dream_plan_settings.
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
}

function goalStatus(sobra: number, need: number): GoalStatus {
  if (sobra <= 0) return 'dificil'
  const gap = need - sobra
  if (gap <= 0)           return 'confortavel'
  if (gap / need <= 0.30) return 'possivel'
  return 'dificil'
}

export function calculateDreamPlan(target: number, sobra: number): DreamPlan {
  const need12 = target / 12
  const need24 = target / 24
  const need36 = target / 36
  const need60 = target / 60
  return {
    target, sobra,
    em12: sobra * 12, em24: sobra * 24, em36: sobra * 36, em60: sobra * 60,
    need12, need24, need36, need60,
    status12: goalStatus(sobra, need12),
    status24: goalStatus(sobra, need24),
    status36: goalStatus(sobra, need36),
    status60: goalStatus(sobra, need60),
    bestMonths: sobra > 0 ? Math.ceil(target / sobra) : null,
  }
}

/** Formata um número como moeda BRL sem centavos */
export function fmtBRLPlan(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
