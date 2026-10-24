// Mortgage math: monthly payment, PITI and rate tiers. See docs/SPEC.md §6.3–6.4.
// Rates are in percent (6.25 means 6.25%); down payment shares are fractions (0.2 = 20%).

export const LOAN_TERM_MONTHS = 30 * 12
const TAXES_AND_INSURANCE_MONTHLY_PCT = 0.0015 // of price, per month
const PMI_ANNUAL_PCT = 0.007 // of loan, per year, when down < 20%
export const PMI_FREE_DOWN_PCT = 0.2

/** Standard amortizing payment (principal + interest) for a fixed-rate loan. */
export function monthlyPrincipalAndInterest(loan: number, annualRatePct: number): number {
  const r = annualRatePct / 100 / 12
  if (r === 0) return loan / LOAN_TERM_MONTHS
  return (loan * r) / (1 - (1 + r) ** -LOAN_TERM_MONTHS)
}

export type PitiBreakdown = {
  principalAndInterest: number
  taxesAndInsurance: number
  pmi: number
  total: number
}

/** Full monthly housing payment: principal, interest, taxes, insurance and PMI. */
export function piti(price: number, downPct: number, annualRatePct: number): PitiBreakdown {
  const loan = price * (1 - downPct)
  const principalAndInterest = monthlyPrincipalAndInterest(loan, annualRatePct)
  const taxesAndInsurance = price * TAXES_AND_INSURANCE_MONTHLY_PCT
  const pmi = downPct < PMI_FREE_DOWN_PCT ? (loan * PMI_ANNUAL_PCT) / 12 : 0
  return {
    principalAndInterest,
    taxesAndInsurance,
    pmi,
    total: principalAndInterest + taxesAndInsurance + pmi,
  }
}

/** Interest paid over the full 30-year term if the loan runs to the end. */
export function totalInterest(loan: number, annualRatePct: number): number {
  return monthlyPrincipalAndInterest(loan, annualRatePct) * LOAN_TERM_MONTHS - loan
}

// Rate add-on by minimum credit score, best tier first.
const CREDIT_TIERS: { minScore: number; adjustment: number }[] = [
  { minScore: 760, adjustment: 0 },
  { minScore: 740, adjustment: 0.125 },
  { minScore: 720, adjustment: 0.25 },
  { minScore: 700, adjustment: 0.375 },
  { minScore: 680, adjustment: 0.5 },
  { minScore: 660, adjustment: 0.75 },
  { minScore: 640, adjustment: 1.0 },
  { minScore: 620, adjustment: 1.25 },
]

export function creditAdjustment(score: number): number {
  const tier = CREDIT_TIERS.find((t) => score >= t.minScore)
  // Below 620 the loan is denied before pricing; the worst tier keeps the
  // function total so previews never see undefined.
  return tier ? tier.adjustment : 1.25
}

export function downPaymentAdjustment(downPct: number): number {
  if (downPct >= 0.2) return 0
  if (downPct >= 0.1) return 0.125
  // Under 3% is rejected by underwriting, so 3–9.99% is the last real tier.
  return 0.25
}

export type RateBreakdown = {
  base: number
  credit: number
  downPayment: number
  total: number
}

/** The rate built tier by tier, as shown on the underwriting reveal. */
export function rateFor(baseRate: number, score: number, downPct: number): RateBreakdown {
  const credit = creditAdjustment(score)
  const downPayment = downPaymentAdjustment(downPct)
  return { base: baseRate, credit, downPayment, total: baseRate + credit + downPayment }
}
