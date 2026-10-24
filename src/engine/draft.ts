import { CARDS, type CardDef } from '../data/cards'
import { addLog } from './effects'
import type { Rng } from './rng'
import type { CardId, PlayerState } from './types'

// The monthly draft: after each month the player adds one of three cards to
// their deck. See docs/SPEC.md §8.

export const DRAFT_SIZE = 3

const owns = (state: PlayerState, id: CardId) =>
  state.deck.includes(id) || state.hand.includes(id) || state.discard.includes(id)

/**
 * Could this card ever be played from here? Checks the card's own conditions
 * with unlimited cash and energy, so only lasting reasons count (a closed car
 * loan, nothing to dispute), not a short month.
 */
const couldEverPlay = (card: CardDef, state: PlayerState) =>
  !card.unavailable?.({ ...state, cash: Number.POSITIVE_INFINITY, energy: Number.POSITIVE_INFINITY })

/** Cards that can be offered now: never a one-time card the player already has or has used. */
export function draftPool(state: PlayerState): CardDef[] {
  return Object.values(CARDS).filter((card) => {
    if ((card.draftWeight ?? 1) <= 0) return false
    if (card.once && (owns(state, card.id) || state.flags[`card:${card.id}`])) return false
    return couldEverPlay(card, state)
  })
}

/** Up to three different cards, weighted by draftWeight, drawn from the seeded rng. */
export function drawDraftOffer(state: PlayerState, rng: Rng): CardId[] {
  const pool = [...draftPool(state)]
  const offer: CardId[] = []
  while (offer.length < DRAFT_SIZE && pool.length > 0) {
    const total = pool.reduce((sum, c) => sum + (c.draftWeight ?? 1), 0)
    let roll = rng.next() * total
    const index = pool.findIndex((c) => (roll -= c.draftWeight ?? 1) < 0)
    const [picked] = pool.splice(index === -1 ? pool.length - 1 : index, 1)
    offer.push(picked.id)
  }
  return offer
}

/**
 * Take one offered card, or skip with null. A taken card goes on top of the
 * deck, so it is in next month's hand.
 */
export function takeDraft(state: PlayerState, cardId: CardId | null): PlayerState {
  if (cardId !== null && !state.draftOffer.includes(cardId)) return state
  const cleared = { ...state, draftOffer: [] }
  if (cardId === null) return addLog(cleared, 'Skipped this month’s new cards.')
  return addLog(
    { ...cleared, deck: [cardId, ...state.deck], flags: { ...state.flags, [`draft:${cardId}`]: true } },
    `Added ${CARDS[cardId].name} to your deck. It's in next month's hand.`,
  )
}
