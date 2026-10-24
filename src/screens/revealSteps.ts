import { formatCompactMoney, formatMoney, formatPercent, formatRate } from '../engine/format'
import { MAX_DTI, MIN_CREDIT_SCORE, MIN_DOWN_PCT, type UnderwritingResult } from '../engine/underwrite'

// Turns an underwriting result into the lines the reveal shows one by one
// (docs/SPEC.md §3.3): credit gate, cash, DTI, the outcome, then the rate
// built tier by tier. Pure, so the screen only has to animate it.

export type RevealStep = {
  id: string
  title: string
  detail?: string
  status: 'pass' | 'fail' | 'warn' | 'rate'
}

export function revealSteps(result: UnderwritingResult, grossMonthlyIncome: number): RevealStep[] {
  const steps: RevealStep[] = []
  const { credit, atTarget, targetPrice } = result
  const target = formatCompactMoney(targetPrice)

  const creditPasses = credit.score >= MIN_CREDIT_SCORE
  steps.push({
    id: 'credit',
    title: `Credit score: ${credit.score}`,
    detail: creditPasses
      ? `Clears the ${MIN_CREDIT_SCORE} minimum.`
      : `Below the ${MIN_CREDIT_SCORE} minimum. The Underwriter stops here.`,
    status: creditPasses ? 'pass' : 'fail',
  })

  if (atTarget) {
    const cashPasses = atTarget.downPct >= MIN_DOWN_PCT
    steps.push({
      id: 'cash',
      title: `Cash for a ${target} home: ${formatPercent(atTarget.downPct, 1)} down`,
      detail: `${formatMoney(atTarget.closingCosts)} closing costs and ${formatMoney(atTarget.reservesRequired)} in reserves leave ${formatMoney(atTarget.downPayment)} for the down payment. The minimum is ${formatPercent(MIN_DOWN_PCT)}.`,
      status: cashPasses ? 'pass' : 'fail',
    })

    const dtiPasses = atTarget.dti <= MAX_DTI
    const debts = atTarget.dti * grossMonthlyIncome - atTarget.piti.total
    steps.push({
      id: 'dti',
      title: `Debt-to-income at ${target}: ${formatPercent(atTarget.dti, 1)}`,
      detail: `${formatMoney(debts)} in debts plus a ${formatMoney(atTarget.piti.total)} housing payment, on ${formatMoney(grossMonthlyIncome)} a month. The limit is ${formatPercent(MAX_DTI)}.`,
      status: dtiPasses ? 'pass' : 'fail',
    })
  }

  if (result.maxPrice === null) {
    steps.push({
      id: 'outcome',
      title: 'Application denied',
      detail: creditPasses ? 'No home price passes every check.' : undefined,
      status: 'fail',
    })
    return steps
  }

  steps.push({
    id: 'outcome',
    title: `Approved up to ${formatCompactMoney(result.maxPrice)}`,
    detail:
      result.outcome === 'APPROVED'
        ? `That covers your ${target} target.`
        : `${formatCompactMoney(targetPrice - result.maxPrice)} short of your ${target} target.`,
    status: result.outcome === 'APPROVED' ? 'pass' : 'warn',
  })

  const quote = result.quote!
  const { rate } = quote
  const downLabel = quote.downPct >= 0.2 ? '20%+ down' : quote.downPct >= 0.1 ? '10–20% down' : 'under 10% down'
  steps.push(
    { id: 'rate-base', title: `Base rate: ${formatRate(rate.base)}`, detail: "Today's market rate.", status: 'rate' },
    {
      id: 'rate-credit',
      title: `+ ${formatRate(rate.credit)} for a ${credit.score} score`,
      detail: rate.credit === 0 ? 'Top tier. No add-on.' : 'Lower scores pay more. 760+ pays nothing extra.',
      status: 'rate',
    },
    {
      id: 'rate-down',
      title: `+ ${formatRate(rate.downPayment)} for ${downLabel}`,
      detail: rate.downPayment === 0 ? 'No add-on at 20% down.' : 'Smaller down payments are riskier for the lender.',
      status: 'rate',
    },
    {
      id: 'rate-total',
      title: `Your rate: ${formatRate(rate.total)}`,
      detail: `On a ${formatCompactMoney(quote.price)} home.`,
      status: 'rate',
    },
  )
  return steps
}
