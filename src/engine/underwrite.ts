import { creditBreakdown, type CreditBreakdown } from './credit'
import {
  PMI_FREE_DOWN_PCT,
  piti,
  rateFor,
  totalInterest,
  type PitiBreakdown,
  type RateBreakdown,
} from './mortgage'
import type { Account, PlayerState } from './types'

// The Underwriter: how much house the player qualifies for and at what rate.
// See docs/SPEC.md §6.2 and §6.5. Simplified for teaching, not real lending rules.

export const MIN_CREDIT_SCORE = 620
export const MAX_DTI = 0.43
export const MIN_DOWN_PCT = 0.03
const CLOSING_COST_PCT = 0.03
const RESERVE_MONTHS = 2
const REVOLVING_MIN_PAYMENT_PCT = 0.03
const SEARCH_MIN_PRICE = 100_000
const SEARCH_MAX_PRICE = 800_000
const SEARCH_STEP = 1_000
// "Approved for less" still counts as close when within 15% of the target.
const NEAR_TARGET_SHARE = 0.85
// The what-if on the result screen: same player, better score.
export const WHAT_IF_SCORE_BUMP = 40

export type Constraint = 'cash' | 'dti'
export type DenialReason = 'credit' | Constraint
export type Outcome = 'APPROVED' | 'APPROVED_SMALLER' | 'DENIED'

/** Monthly payment a lender counts for one account. */
export function accountPayment(account: Account): number {
  if (!account.open) return 0
  if (account.kind === 'revolving') return account.balance * REVOLVING_MIN_PAYMENT_PCT
  return account.monthlyPayment ?? 0
}

/** Sum of monthly debt payments. Rent is not a debt and is not included. */
export function monthlyDebts(state: PlayerState): number {
  return state.accounts.reduce((sum, a) => sum + accountPayment(a), 0)
}

/** Debt-to-income ratio with a given housing payment. Unverified income never counts. */
export function dti(state: PlayerState, housingPayment: number): number {
  return (monthlyDebts(state) + housingPayment) / state.grossMonthlyIncome
}

/** The handful of numbers a lender actually reads, pulled out of game state. */
export type BorrowerProfile = {
  cash: number
  grossMonthlyIncome: number
  monthlyDebts: number
  score: number
  baseRate: number
}

export function borrowerProfile(state: PlayerState): BorrowerProfile {
  return {
    cash: state.cash,
    grossMonthlyIncome: state.grossMonthlyIncome,
    monthlyDebts: monthlyDebts(state),
    score: creditBreakdown(state).score,
    baseRate: state.baseRate,
  }
}

export type PriceCheck = {
  price: number
  closingCosts: number
  reservesRequired: number
  downPct: number
  downPayment: number
  loanAmount: number
  rate: RateBreakdown
  piti: PitiBreakdown
  dti: number
  failReason: Constraint | null
}

// Fixed-point steps for down payment: PITI depends on the down payment (via
// PMI and the rate tier), and the cash left for the down payment depends on
// PITI (via required reserves). A few rounds settle it to well under a dollar.
const DOWN_PAYMENT_ITERATIONS = 5

/** Can this borrower buy at this price? Returns the full breakdown either way. */
export function checkPrice(profile: BorrowerProfile, price: number): PriceCheck {
  const closingCosts = price * CLOSING_COST_PCT
  const cashForDown = (reserves: number) =>
    Math.min(PMI_FREE_DOWN_PCT, Math.max(0, (profile.cash - closingCosts - reserves) / price))

  let downPct = cashForDown(0)
  for (let i = 0; i < DOWN_PAYMENT_ITERATIONS; i++) {
    const rate = rateFor(profile.baseRate, profile.score, downPct)
    downPct = cashForDown(RESERVE_MONTHS * piti(price, downPct, rate.total).total)
  }

  const rate = rateFor(profile.baseRate, profile.score, downPct)
  const payment = piti(price, downPct, rate.total)
  const reservesRequired = RESERVE_MONTHS * payment.total
  const ratio = (profile.monthlyDebts + payment.total) / profile.grossMonthlyIncome

  let failReason: Constraint | null = null
  if (downPct < MIN_DOWN_PCT) failReason = 'cash'
  else if (ratio > MAX_DTI) failReason = 'dti'

  return {
    price,
    closingCosts,
    reservesRequired,
    downPct,
    downPayment: price * downPct,
    loanAmount: price * (1 - downPct),
    rate,
    piti: payment,
    dti: ratio,
    failReason,
  }
}

export type LoanQuote = PriceCheck & { totalInterest: number }

function quote(profile: BorrowerProfile, price: number): LoanQuote {
  const check = checkPrice(profile, price)
  return { ...check, totalInterest: totalInterest(check.loanAmount, check.rate.total) }
}

export type UnderwritingResult = {
  credit: CreditBreakdown
  outcome: Outcome
  denialReason: DenialReason | null
  /** Approved, but for less than 85% of the target price. */
  farBelowTarget: boolean
  targetPrice: number
  maxPrice: number | null
  /** What stopped the next $1,000 step up. The key teaching fact on the result screen. */
  bindingConstraint: Constraint | null
  /** The target price checked line by line, for the reveal. Null when credit fails first. */
  atTarget: PriceCheck | null
  /** Loan at the target price, or at maxPrice if that is lower. */
  quote: LoanQuote | null
  /** The same loan with a score 40 points higher. */
  whatIf: LoanQuote | null
}

export function underwrite(state: PlayerState): UnderwritingResult {
  const credit = creditBreakdown(state)
  const profile = borrowerProfile(state)
  const denied = (denialReason: DenialReason, atTarget: PriceCheck | null): UnderwritingResult => ({
    credit,
    outcome: 'DENIED',
    denialReason,
    farBelowTarget: false,
    targetPrice: state.targetPrice,
    maxPrice: null,
    bindingConstraint: denialReason === 'credit' ? null : denialReason,
    atTarget,
    quote: null,
    whatIf: null,
  })

  if (credit.score < MIN_CREDIT_SCORE) return denied('credit', null)

  const atTarget = checkPrice(profile, state.targetPrice)

  // Scan every price and keep the highest one that passes. A scan (rather than
  // a binary search) stays correct even where tier jumps make passing prices
  // non-contiguous, and 701 checks is trivially cheap.
  let maxPrice: number | null = null
  let bindingConstraint: Constraint | null = null
  let firstFailure: Constraint | null = null
  for (let price = SEARCH_MIN_PRICE; price <= SEARCH_MAX_PRICE; price += SEARCH_STEP) {
    const check = checkPrice(profile, price)
    if (check.failReason === null) {
      maxPrice = price
      bindingConstraint = null
    } else {
      firstFailure ??= check.failReason
      // Remember why the step right after the best price so far failed.
      if (maxPrice === price - SEARCH_STEP) bindingConstraint = check.failReason
    }
  }

  if (maxPrice === null) return denied(firstFailure ?? 'cash', atTarget)

  const quotePrice = Math.min(state.targetPrice, maxPrice)
  const betterScore = Math.min(850, profile.score + WHAT_IF_SCORE_BUMP)

  return {
    credit,
    outcome: maxPrice >= state.targetPrice ? 'APPROVED' : 'APPROVED_SMALLER',
    denialReason: null,
    farBelowTarget: maxPrice < NEAR_TARGET_SHARE * state.targetPrice,
    targetPrice: state.targetPrice,
    maxPrice,
    bindingConstraint,
    atTarget,
    quote: quote(profile, quotePrice),
    whatIf: quote({ ...profile, score: betterScore }, quotePrice),
  }
}
