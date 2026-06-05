import type { ReactNode } from 'react'
import { C } from '@/app/components/ui'
import { fmtBRLPlan, type DreamPathSetting } from '@/lib/dreamPlan'
import {
  buildAffordableCreditOptions,
  buildApplyVsCreditRows,
  buildStrategyHorizonRows,
  resolveCreditAdjustmentAnnual,
} from '@/lib/consortiumProjection'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const CONSORTIUM_SIM_DISCLAIMER =
  'Simulação inicial. A correção do crédito depende do índice, contrato, administradora e regras do produto. ' +
  'Não representa garantia de valorização, contemplação ou aprovação.'

type SmallerLetterProps = {
  path: DreamPathSetting
  dreamAmount: number
  sobra: number
  fullInstallment: number | null
}

export function ConsortiumSmallerLetterBlock({
  path,
  dreamAmount,
  sobra,
  fullInstallment,
}: SmallerLetterProps): ReactNode {
  if (!path.default_amount || !(path.full_installment_amount ?? path.reduced_installment_amount)) {
    return null
  }

  const annualRate = resolveCreditAdjustmentAnnual(path)
  const annualPct  = Math.round(annualRate * 100)
  const rows       = buildStrategyHorizonRows(path, dreamAmount, sobra, annualRate)
  const options    = buildAffordableCreditOptions(path, dreamAmount, sobra, annualRate)

  const fullDoesNotFit =
    fullInstallment !== null && sobra > 0 && fullInstallment > sobra

  const example5 = rows.find(r => r.years === 5)

  return (
    <div style={{
      background: C.bgApp, borderRadius: 12, padding: '14px 12px',
      border: `0.5px solid ${C.border}`, marginBottom: 8,
    }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.text }}>
        {fullDoesNotFit
          ? '💡 E se você começar com uma carta menor que cabe no bolso?'
          : '💡 Estratégia: carta menor + correção estimada do crédito'}
      </p>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: C.textSec, lineHeight: 1.55 }}>
        A correção estimada do crédito pode ampliar seu poder de compra ao longo do tempo.
        {example5 && (
          <>
            {' '}Para chegar perto de {fmtBRL(dreamAmount)} em 5 anos com correção estimada de {annualPct}% a.a.,
            a carta inicial teria que ser próxima de {fmtBRL(Math.round(example5.initialNeeded))}.
          </>
        )}
      </p>

      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase' }}>
        Projeção por prazo
      </p>
      <div style={{ overflowX: 'auto', marginBottom: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, minWidth: 320 }}>
          <thead>
            <tr style={{ background: C.bgSecondary }}>
              {['Prazo', 'Carta inicial', 'Parcela est.', 'Crédito projetado', 'Status'].map(h => (
                <th key={h} style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 600, color: C.textSec }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.years} style={{ borderTop: `0.5px solid ${C.border}` }}>
                <td style={{ padding: '6px 4px', color: C.text }}>{r.years} anos</td>
                <td style={{ padding: '6px 4px', color: C.text }}>{fmtBRL(r.initialNeeded)}</td>
                <td style={{ padding: '6px 4px', color: C.text }}>
                  {r.installment != null ? `${fmtBRL(r.installment)}/mês` : '—'}
                </td>
                <td style={{ padding: '6px 4px', color: C.text }}>{fmtBRL(r.projected)}</td>
                <td style={{ padding: '6px 4px', color: r.fits ? C.greenDark : C.amberDark, fontWeight: 600 }}>
                  {r.fits ? 'Cabe melhor' : 'Ainda exige ajuste'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase' }}>
        Cartas que podem caber no seu bolso
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {options.map(opt => (
          <div key={opt.id} style={{
            background: '#fff', borderRadius: 8, padding: '8px 10px',
            border: `0.5px solid ${opt.fits ? C.greenDark + '40' : C.border}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: C.text }}>{opt.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9, color: C.textSec }}>
              <span>Carta: <strong style={{ color: C.text }}>{fmtBRL(opt.contractedCredit)}</strong></span>
              <span>Parcela: <strong style={{ color: C.text }}>{opt.installment != null ? fmtBRLPlan(opt.installment) + '/mês' : '—'}</strong></span>
              <span>Crédito proj. 5a: <strong style={{ color: C.text }}>{fmtBRL(opt.projected5y)}</strong></span>
              <span>Gap p/ sonho: <strong style={{ color: C.text }}>{opt.gapToDream <= 0 ? '✅' : fmtBRL(opt.gapToDream)}</strong></span>
            </div>
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 9, color: C.textTer, lineHeight: 1.45 }}>
        ⚠️ {CONSORTIUM_SIM_DISCLAIMER}
      </p>
    </div>
  )
}

const COMPARE_DISCLAIMER =
  'Simulação inicial. O rendimento da aplicação não é garantido e depende do produto escolhido. ' +
  'A correção do crédito do consórcio depende do índice, contrato, administradora e regras do plano. ' +
  'Não representa garantia de contemplação, aprovação ou valorização.'

type CompareProps = {
  dreamAmount: number
  safeMonthly: number
  investmentPath: DreamPathSetting
  consortiumPath: DreamPathSetting
}

export function ApplicationVsConsortiumBlock({
  dreamAmount,
  safeMonthly,
  investmentPath,
  consortiumPath,
}: CompareProps): ReactNode {
  const rows = buildApplyVsCreditRows(dreamAmount, safeMonthly, investmentPath, consortiumPath)

  if (safeMonthly <= 0) {
    return (
      <div style={{
        background: C.purpleBg, borderRadius: 16, border: `0.5px solid ${C.purple}20`,
        padding: '16px', marginBottom: 8,
      }}>
        <p style={{ margin: 0, fontSize: 12, color: C.purpleDeep }}>
          Libere uma sobra mensal para comparar aplicação x crédito corrigido.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: C.purpleBg, borderRadius: 16,
      border: `0.5px solid ${C.purple}20`,
      padding: '14px 12px', marginBottom: 8,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: C.purpleDeep }}>
        📊 Aplicação x Crédito corrigido
      </p>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: C.purpleDeep, lineHeight: 1.5 }}>
        No investimento, o saldo cresce sobre o que você aplica. No consórcio, a correção estimada
        incide sobre o crédito contratado ({fmtBRL(dreamAmount)}), não sobre o total pago em parcelas.
      </p>

      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 10, padding: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8, minWidth: 520 }}>
          <thead>
            <tr style={{ background: C.bgSecondary }}>
              {[
                'Prazo',
                'Valor aplicado',
                'Saldo na aplicação',
                'Rend. da aplicação',
                'Crédito projetado',
                'Correção est. crédito',
                'Dif. poder de compra',
              ].map(h => (
                <th key={h} style={{ padding: '5px 3px', textAlign: 'left', fontWeight: 600, color: C.textSec }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.years} style={{ borderTop: `0.5px solid ${C.border}` }}>
                <td style={{ padding: '5px 3px', color: C.text }}>{r.years}a</td>
                <td style={{ padding: '5px 3px' }}>{fmtBRL(r.valorAplicado)}</td>
                <td style={{ padding: '5px 3px' }}>{fmtBRL(r.saldoAplicacao)}</td>
                <td style={{ padding: '5px 3px' }}>{fmtBRL(r.rendimentoAplicacao)}</td>
                <td style={{ padding: '5px 3px' }}>{fmtBRL(r.creditoProjetado)}</td>
                <td style={{ padding: '5px 3px' }}>{fmtBRL(r.correcaoCredito)}</td>
                <td style={{
                  padding: '5px 3px',
                  fontWeight: 600,
                  color: r.diffPoderCompra >= 0 ? C.greenDark : C.coralDark,
                }}>
                  {r.diffPoderCompra >= 0 ? '+' : ''}{fmtBRL(r.diffPoderCompra)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 9, color: C.purpleDeep, lineHeight: 1.45 }}>
        ⚠️ {COMPARE_DISCLAIMER}
      </p>
    </div>
  )
}
