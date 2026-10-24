import type { CardDef } from '../data/cards'
import type { PlayerState } from './types'

// Slider cards (CardDef.amount): which amounts are legal right now, and how a
// requested amount is snapped to one. The UI and the reducer both use these,
// so a slider can never offer a payment the reducer would refuse.

export type AmountRange = { min: number; max: number; step: number }

/** The legal range right now, or null if not even the minimum is affordable. */
export function amountRange(card: CardDef, state: PlayerState): AmountRange | null {
  const spec = card.amount
  if (!spec) return null
  const max = Math.floor(Math.min(spec.max, spec.limit(state)) / spec.step) * spec.step
  return max >= spec.min ? { min: spec.min, max, step: spec.step } : null
}

/** Snap a requested amount (or the card's default) into the legal range. */
export function resolveAmount(card: CardDef, state: PlayerState, requested?: number): number | undefined {
  const range = amountRange(card, state)
  if (!range) return undefined
  const wanted = requested ?? card.amount!.initial
  const snapped = Math.round(wanted / range.step) * range.step
  return Math.min(range.max, Math.max(range.min, snapped))
}
