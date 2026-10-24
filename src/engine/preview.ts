import { CARDS } from '../data/cards'
import { resolveAmount } from './amounts'
import type { EventChoice } from '../data/events'
import { creditScore, utilization } from './credit'
import { endMonth, monthlyCardInterest } from './reducer'
import type { Rng } from './rng'
import type { CardId, PlayerState } from './types'
import { monthlyDebts, underwrite } from './underwrite'

// Previews: what a card or choice would change, before the player commits.
// Each preview runs the real effect on the current state and compares the
// numbers before and after, so preview numbers can never drift from the rules.

export type StatKey = 'maxPrice' | 'score' | 'dti' | 'utilization' | 'cash' | 'monthlySavings'

/** The numbers the player watches. maxPrice is 0 when the Underwriter would deny. */
export type StatSnapshot = Record<StatKey, number>

export function snapshot(state: PlayerState): StatSnapshot {
  return {
    maxPrice: underwrite(state).maxPrice ?? 0,
    score: creditScore(state),
    // Debts before any mortgage. The 43% limit applies once housing is added.
    dti: monthlyDebts(state) / state.grossMonthlyIncome,
    utilization: utilization(state),
    cash: state.cash,
    // What actually lands in cash each month: card interest comes out of it, so
    // paying down cards or cutting the APR shows up here as a monthly gain.
    monthlySavings: state.monthlySurplus + state.unverifiedIncome - monthlyCardInterest(state),
  }
}

const HIGHER_IS_BETTER: Record<StatKey, boolean> = {
  maxPrice: true,
  score: true,
  dti: false,
  utilization: false,
  cash: true,
  monthlySavings: true,
}

// Changes smaller than this are rounding noise, not something to show.
const NOISE: Record<StatKey, number> = {
  maxPrice: 1,
  score: 0.5,
  dti: 0.0005,
  utilization: 0.0005,
  cash: 1,
  monthlySavings: 1,
}

const DISPLAY_ORDER: StatKey[] = ['maxPrice', 'score', 'dti', 'utilization', 'cash', 'monthlySavings']

export type Delta = {
  stat: StatKey
  before: number
  after: number
  /** null when the number doesn't move. */
  good: boolean | null
}

/**
 * Every stat that moved, in display order. Max home price is always included,
 * because "this doesn't change what you can buy" is often the lesson.
 */
export function diffSnapshots(before: StatSnapshot, after: StatSnapshot): Delta[] {
  return DISPLAY_ORDER.flatMap((stat) => {
    const change = after[stat] - before[stat]
    const moved = Math.abs(change) >= NOISE[stat]
    if (!moved && stat !== 'maxPrice') return []
    const good = moved ? change > 0 === HIGHER_IS_BETTER[stat] : null
    return [{ stat, before: before[stat], after: after[stat], good }]
  })
}

// chance() succeeds when next() < odds, so a generator that always returns 0
// previews the success case. The card shows its odds next to the preview, and
// the real roll still happens on play, so the preview never leaks the outcome.
const successRng: Rng = { next: () => 0, state: 0 }

/** For slider cards, pass the amount on the slider; it's snapped exactly as playing would. */
export function previewCard(state: PlayerState, cardId: CardId, base = snapshot(state), amount?: number): Delta[] {
  const card = CARDS[cardId]
  return diffSnapshots(base, snapshot(card.play(state, successRng, resolveAmount(card, state, amount))))
}

export function previewChoice(state: PlayerState, choice: EventChoice, base = snapshot(state)): Delta[] {
  return diffSnapshots(base, snapshot(choice.apply(state, successRng)))
}

/** What ending the month will do: card interest, loan paydown, any overdraft. */
export function previewEndMonth(state: PlayerState, base = snapshot(state)): Delta[] {
  return diffSnapshots(base, snapshot(endMonth(state)))
}
