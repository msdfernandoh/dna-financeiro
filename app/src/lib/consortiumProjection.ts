// =============================================================================
// Projeção de crédito de consórcio — simulação inicial (não garantia)
// =============================================================================

import { futureValue, annualToMonthlyRate } from '@/lib/dreamPlan'
import type { DreamPathSetting } from '@/lib/dreamPlan'

export const DEFAULT_CREDIT_ADJ_ANNUAL = 0.08

export const CONSORTIUM_STRATEGY_YEARS = [3, 5, 7, 10, 15, 18] as const

export const APPLY_VS_CREDIT_YEARS = [1, 3, 5, 7, 10, 15, 18] as const

export function resolveCreditAdjustmentAnnual(
  path: Pick<DreamPathSetting, 'credit_adjustment_rate_annual'>,
): number {
  const r = path.credit_adjustment_rate_annual
  return r != null && r >= 0 ? r : DEFAULT_CREDIT_ADJ_ANNUAL
}

/** credito_futuro = credito_inicial * (1 + taxa)^anos */
export function projectedCredit(
  creditInitial: number,
  annualRate: number,
  years: number,
): number {
  if (creditInitial <= 0 || years <= 0) return creditInitial
  return creditInitial * Math.pow(1 + annualRate, years)
}

/** credito_inicial_necessario = valor_sonho / (1 + taxa)^anos */
export function initialCreditForDream(
  dreamAmount: number,
  annualRate: number,
  years: number,
): number {
  if (dreamAmount <= 0 || years <= 0) return dreamAmount
  return dreamAmount / Math.pow(1 + annualRate, years)
}

export function scalePathInstallment(
  base: number | null,
  defaultAmount: number | null,
  creditAmount: number,
  mode?: string | null,
): number | null {
  if (base === null) return null
  const m = mode ?? 'proportional'
  if (m === 'fixed') return base
  if (!defaultAmount || defaultAmount <= 0) return base
  return base * creditAmount / defaultAmount
}

export function installmentFitsBudget(installment: number | null, sobra: number): boolean {
  if (installment === null || sobra <= 0) return false
  return installment <= sobra
}

export type StrategyHorizonRow = {
  years: number
  initialNeeded: number
  installment: number | null
  projected: number
  fits: boolean
}

export function buildStrategyHorizonRows(
  path: DreamPathSetting,
  dreamAmount: number,
  sobra: number,
  annualRate: number,
): StrategyHorizonRow[] {
  const mode = path.calculation_mode ?? null
  const base =
    path.reduced_installment_amount ?? path.full_installment_amount

  return CONSORTIUM_STRATEGY_YEARS.map(years => {
    const initialNeeded = initialCreditForDream(dreamAmount, annualRate, years)
    const installment   = scalePathInstallment(
      base,
      path.default_amount,
      initialNeeded,
      mode,
    )
    const projected = projectedCredit(initialNeeded, annualRate, years)
    return {
      years,
      initialNeeded,
      installment,
      projected,
      fits: installmentFitsBudget(installment, sobra),
    }
  })
}

export type AffordableCreditOption = {
  id: string
  label: string
  contractedCredit: number
  installment: number | null
  projected5y: number
  gapToDream: number
  fits: boolean
}

export function buildAffordableCreditOptions(
  path: DreamPathSetting,
  dreamAmount: number,
  sobra: number,
  annualRate: number,
): AffordableCreditOption[] {
  const mode = path.calculation_mode ?? null
  const base =
    path.reduced_installment_amount ?? path.full_installment_amount
  const defaultAmount = path.default_amount

  const options: AffordableCreditOption[] = []

  if (sobra > 0 && base != null && defaultAmount && defaultAmount > 0) {
    const m = mode ?? 'proportional'
    const fromBudget =
      m === 'fixed'
        ? defaultAmount
        : (sobra * defaultAmount) / base
    if (fromBudget > 0) {
      const inst = scalePathInstallment(base, defaultAmount, fromBudget, mode)
      options.push({
        id: 'budget',
        label: 'Com base na parcela que cabe hoje',
        contractedCredit: fromBudget,
        installment: inst,
        projected5y: projectedCredit(fromBudget, annualRate, 5),
        gapToDream: dreamAmount - projectedCredit(fromBudget, annualRate, 5),
        fits: installmentFitsBudget(inst, sobra),
      })
    }
  }

  for (const pct of [
    { id: 'p80', label: 'Carta 20% menor que o sonho', factor: 0.8 },
    { id: 'p70', label: 'Carta 30% menor que o sonho', factor: 0.7 },
    { id: 'p60', label: 'Carta 40% menor que o sonho', factor: 0.6 },
  ]) {
    const credit = dreamAmount * pct.factor
    const inst   = scalePathInstallment(base, defaultAmount, credit, mode)
    options.push({
      id: pct.id,
      label: pct.label,
      contractedCredit: credit,
      installment: inst,
      projected5y: projectedCredit(credit, annualRate, 5),
      gapToDream: dreamAmount - projectedCredit(credit, annualRate, 5),
      fits: installmentFitsBudget(inst, sobra),
    })
  }

  return options
}

export type ApplyVsCreditRow = {
  years: number
  months: number
  valorAplicado: number
  saldoAplicacao: number
  rendimentoAplicacao: number
  creditoProjetado: number
  correcaoCredito: number
  valorPagoConsorcio: number
  diffPoderCompra: number
}

export function buildApplyVsCreditRows(
  dreamAmount: number,
  safeMonthly: number,
  investmentPath: DreamPathSetting,
  consortiumPath: DreamPathSetting,
): ApplyVsCreditRow[] {
  const annualInv = investmentPath.annual_return_rate ?? 0.12
  const mInv      = annualToMonthlyRate(annualInv)
  const adjRate   = resolveCreditAdjustmentAnnual(consortiumPath)
  const mode      = consortiumPath.calculation_mode ?? null
  const consBase  =
    consortiumPath.reduced_installment_amount ??
    consortiumPath.full_installment_amount

  const creditInitial = dreamAmount

  return APPLY_VS_CREDIT_YEARS.map(years => {
    const months = years * 12
    const valorAplicado = safeMonthly * months
    const saldoAplicacao = futureValue(safeMonthly, months, mInv)
    const rendimentoAplicacao = saldoAplicacao - valorAplicado
    const creditoProjetado = projectedCredit(creditInitial, adjRate, years)
    const correcaoCredito = creditoProjetado - creditInitial
    const parcelaFull = scalePathInstallment(
      consBase,
      consortiumPath.default_amount,
      creditInitial,
      mode,
    )
    const valorPagoConsorcio =
      parcelaFull !== null ? parcelaFull * months : 0
    const diffPoderCompra = creditoProjetado - saldoAplicacao

    return {
      years,
      months,
      valorAplicado,
      saldoAplicacao,
      rendimentoAplicacao,
      creditoProjetado,
      correcaoCredito,
      valorPagoConsorcio,
      diffPoderCompra,
    }
  })
}
