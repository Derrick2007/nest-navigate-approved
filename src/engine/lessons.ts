import { CARDS } from '../data/cards'
import { EVENTS } from '../data/events'
import { utilization } from './credit'
import { formatPercent } from './format'
import type { CardId, EventId, PlayerState } from './types'

// Picks up to three lessons for the result screen from what the player
// actually did (docs/SPEC.md §10). Lesson text lives with the cards and
// events in src/data; this file only decides which ones matter most.

export type Lesson = {
  /** The card or event that taught it. */
  source: string
  text: string
}

export const MAX_LESSONS = 3

const fromCard = (id: CardId): Lesson => ({ source: CARDS[id].name, text: CARDS[id].lesson ?? '' })
const fromEvent = (id: EventId): Lesson => ({ source: EVENTS[id].name, text: EVENTS[id].lesson ?? '' })

const played = (state: PlayerState, id: CardId) => state.flags[`card:${id}`] === true
const chose = (state: PlayerState, id: EventId, choice: string) => state.flags[`event:${id}:${choice}`] === true

/**
 * Candidate lessons, highest impact first. The first few are the big
 * "wait, really?" moments the game is built around.
 */
const CANDIDATES: ((state: PlayerState) => Lesson | null)[] = [
  (s) => (played(s, 'close_old') ? fromCard('close_old') : null),
  (s) => (played(s, 'side_gig') ? fromCard('side_gig') : null),
  (s) => (played(s, 'pay_off_car') ? fromCard('pay_off_car') : null),
  (s) => (chose(s, 'car_trouble', 'finance') ? fromEvent('car_trouble') : null),
  (s) => (chose(s, 'furniture_promo', 'finance') ? fromEvent('furniture_promo') : null),
  (s) => {
    if (played(s, 'balance_blitz')) return fromCard('balance_blitz')
    if (played(s, 'pay_card_1k')) return fromCard('pay_card_1k')
    // Never touched the cards but finished with high utilization: still worth saying.
    const ratio = utilization(s)
    if (ratio > 0.3) {
      return {
        source: 'Card utilization',
        text: `You finished at ${formatPercent(ratio)} utilization. Getting under 30% is one of the fastest ways to raise a score.`,
      }
    }
    return null
  },
  (s) => (played(s, 'extra_car') ? fromCard('extra_car') : null),
  (s) => (chose(s, 'card_offer', 'accept') ? fromEvent('card_offer') : null),
]

export function pickLessons(state: PlayerState): Lesson[] {
  const specific = CANDIDATES.map((candidate) => candidate(state)).filter((l): l is Lesson => l !== null)
  // Then any other card the player played that has a lesson, in deck order.
  const taken = new Set(specific.map((l) => l.source))
  const rest = Object.values(CARDS)
    .filter((card) => card.lesson && played(state, card.id) && !taken.has(card.name))
    .map((card) => fromCard(card.id))
  return [...specific, ...rest].slice(0, MAX_LESSONS)
}
