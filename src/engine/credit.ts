import type { PlayerState } from './types'

// Simplified FICO-style score, 300–850. See docs/SPEC.md §6.1.
// The five components roughly follow FICO's published weights, which is the
// point of showing them to the player.

export type CreditBreakdown = {
  paymentHistory: number // ~35%
  utilization: number // ~30%
  age: number // ~15%
  newCredit: number // ~10%
  mix: number // ~10%
  score: number
}

const BASE_SCORE = 300

// Upper bounds for each utilization band and the points it earns.
const UTILIZATION_TIERS: { maxRatio: number; points: number }[] = [
  { maxRatio: 0.1, points: 165 },
  { maxRatio: 0.3, points: 140 },
  { maxRatio: 0.5, points: 100 },
  { maxRatio: 0.75, points: 60 },
]
const UTILIZATION_FLOOR_POINTS = 30

/** Revolving balances ÷ revolving limits, counting open cards only. */
export function utilization(state: PlayerState): number {
  const cards = state.accounts.filter((a) => a.open && a.kind === 'revolving')
  const balance = cards.reduce((sum, a) => sum + a.balance, 0)
  const limit = cards.reduce((sum, a) => sum + (a.limit ?? 0), 0)
  // No open card means nothing is being used; the missing card is penalised
  // by the credit mix component instead.
  return limit === 0 ? 0 : balance / limit
}

/**
 * How much to pay down, spread across open cards, to bring utilization to
 * `ratio`. Used to mark the 30% and 10% lines on payment sliders.
 */
export function paydownToReach(state: PlayerState, ratio: number): number {
  const cards = state.accounts.filter((a) => a.open && a.kind === 'revolving')
  const balance = cards.reduce((sum, a) => sum + a.balance, 0)
  const limit = cards.reduce((sum, a) => sum + (a.limit ?? 0), 0)
  return Math.max(0, balance - ratio * limit)
}

export function utilizationPoints(ratio: number): number {
  const tier = UTILIZATION_TIERS.find((t) => ratio <= t.maxRatio)
  return tier ? tier.points : UTILIZATION_FLOOR_POINTS
}

export function averageAccountAge(state: PlayerState): number {
  const open = state.accounts.filter((a) => a.open)
  if (open.length === 0) return 0
  return open.reduce((sum, a) => sum + a.ageYears, 0) / open.length
}

export function creditBreakdown(state: PlayerState): CreditBreakdown {
  const open = state.accounts.filter((a) => a.open)
  const hasRevolving = open.some((a) => a.kind === 'revolving')
  const hasInstallment = open.some((a) => a.kind === 'installment')

  // Reported rent adds on-time history (Report Your Rent).
  const paymentHistory = Math.max(0, 192 * (1 - 0.15 * state.missedPayments)) + (state.flags.rentReporting ? 15 : 0)
  const utilizationPts = utilizationPoints(utilization(state))
  const age = Math.min(82, averageAccountAge(state) * 8)
  // Like FICO, new credit counts inquiries and accounts opened in the last year.
  const recentAccounts = open.filter((a) => a.ageYears < 1).length
  const newCredit = Math.max(0, 55 - 15 * state.hardInquiries - 10 * recentAccounts)
  const mix = hasRevolving && hasInstallment ? 55 : 30

  const raw = BASE_SCORE + paymentHistory + utilizationPts + age + newCredit + mix
  return {
    paymentHistory,
    utilization: utilizationPts,
    age,
    newCredit,
    mix,
    score: Math.round(Math.min(850, Math.max(300, raw))),
  }
}

export function creditScore(state: PlayerState): number {
  return creditBreakdown(state).score
}
