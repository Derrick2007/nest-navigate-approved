import { buildDeck, CARDS } from '../data/cards'
import { ALL_EVENTS, EVENTS } from '../data/events'
import { createInitialState } from '../data/initialState'
import { amountRange, resolveAmount } from './amounts'
import { drawDraftOffer, takeDraft } from './draft'
import { addLog, chargeToCard } from './effects'
import { formatMoney } from './format'
import { createRng, pickWeighted, shuffle, type Rng } from './rng'
import type { CardId, PlayerState } from './types'

// The month loop and the game reducer. See docs/SPEC.md §7.
//
// Each step is a plain PlayerState -> PlayerState function so the preview
// (milestone 4) can run the exact same rules on a copy of the state.
// Invalid moves return the state unchanged instead of throwing.

export const MONTHS = 12
export const HAND_SIZE = 5
export const ENERGY_PER_MONTH = 3
const CARD_INTEREST_MONTHLY = 0.02 // 24% APR
const LOWER_CARD_INTEREST_MONTHLY = 0.01 // after "Call to Lower Your APR"
const INSTALLMENT_PRINCIPAL_SHARE = 0.6 // simplified: 60% of each payment reduces the balance

/** Run `step` with an Rng built from the state, then save the generator's new position. */
function withRng(state: PlayerState, step: (state: PlayerState, rng: Rng) => PlayerState): PlayerState {
  const rng = createRng(state.rngState)
  const next = step(state, rng)
  return { ...next, rngState: rng.state }
}

const setFlag = (state: PlayerState, flag: string): PlayerState => ({
  ...state,
  flags: { ...state.flags, [flag]: true },
})

// ---------------------------------------------------------------------------
// Start of month: paycheck, life event, new hand.

export function payday(state: PlayerState): PlayerState {
  return {
    ...state,
    cash: state.cash + state.monthlySurplus + state.unverifiedIncome,
    accounts: state.accounts.map((a) => ({ ...a, ageYears: a.ageYears + 1 / 12 })),
  }
}

function drawEvent(state: PlayerState, rng: Rng): PlayerState {
  const eligible = ALL_EVENTS.filter((e) => {
    const [from, to] = e.months ?? [1, MONTHS]
    // No immediate repeats: last month's event can't come straight back.
    return state.month >= from && state.month <= to && e.id !== state.event?.eventId
  })
  const def = pickWeighted(eligible, (e) => e.weight, rng)
  if (def.effect) {
    const applied = def.effect(setFlag(state, `event:${def.id}`), rng)
    return { ...applied, event: { eventId: def.id, resolved: true } }
  }
  return { ...state, event: { eventId: def.id, resolved: false } }
}

function drawHand(state: PlayerState, rng: Rng): PlayerState {
  let deck = [...state.deck]
  let discard = [...state.discard]
  const hand: CardId[] = []
  while (hand.length < HAND_SIZE) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      deck = shuffle(discard, rng)
      discard = []
    }
    hand.push(deck.shift()!)
  }
  // A side gig eats a weekend every month; skipping a big life event burns you out for one.
  const energy = Math.max(0, ENERGY_PER_MONTH - (state.flags.sideGig ? 1 : 0) - (state.flags.roommate ? 1 : 0) - (state.flags.burnout ? 1 : 0))
  return { ...state, hand, deck, discard, energy, flags: { ...state.flags, burnout: false } }
}

export function startMonth(state: PlayerState): PlayerState {
  return withRng(payday(state), (s, rng) => drawHand(drawEvent(s, rng), rng))
}

export function newRun(seed: number): PlayerState {
  const initial = createInitialState(seed)
  const shuffled = withRng(initial, (s, rng) => ({ ...s, deck: shuffle(buildDeck(), rng) }))
  return startMonth(shuffled)
}

// ---------------------------------------------------------------------------
// During the month: resolve the event, play cards.

export function awaitingEventChoice(state: PlayerState): boolean {
  return state.event !== null && !state.event.resolved
}

export function resolveEvent(state: PlayerState, choiceId: string): PlayerState {
  if (!state.event || state.event.resolved) return state
  const def = EVENTS[state.event.eventId]
  const choice = def.choices?.find((c) => c.id === choiceId)
  if (!choice) return state
  const resolved = withRng(setFlag(state, `event:${def.id}:${choice.id}`), choice.apply)
  return { ...resolved, event: { eventId: def.id, resolved: true } }
}

/** Why this card can't be played right now, or null if it can. */
export function cardUnavailableReason(state: PlayerState, cardId: CardId): string | null {
  const card = CARDS[cardId]
  if (awaitingEventChoice(state)) return 'Deal with this month’s event first'
  if (card.cost > state.energy) return 'Not enough energy left this month'
  const own = card.unavailable?.(state) ?? null
  if (own) return own
  // A slider card also needs at least its smallest step to be affordable.
  if (card.amount && !amountRange(card, state)) return 'Not enough to make the smallest payment'
  return null
}

/** Play the card at `handIndex`. For slider cards, `amount` is snapped to a legal value first. */
export function playCard(state: PlayerState, handIndex: number, amount?: number): PlayerState {
  const cardId = state.hand[handIndex]
  if (cardId === undefined || cardUnavailableReason(state, cardId) !== null) return state
  const card = CARDS[cardId]
  // Resolved against the state before paying, so the cash check is the one the player saw.
  const chosen = resolveAmount(card, state, amount)
  const paid: PlayerState = {
    ...setFlag(state, `card:${cardId}`),
    energy: state.energy - card.cost,
    hand: state.hand.filter((_, i) => i !== handIndex),
    // "Once" cards leave the game instead of going to the discard pile.
    discard: card.once ? state.discard : [...state.discard, cardId],
  }
  return withRng(paid, (s, rng) => card.play(s, rng, chosen))
}

// ---------------------------------------------------------------------------
// End of month: interest, loan paydown, overdraft.

/** This month's card interest at current balances (0% cards excluded, lowered APR applied). */
export function monthlyCardInterest(state: PlayerState): number {
  const standard = state.flags.lowerApr ? LOWER_CARD_INTEREST_MONTHLY : CARD_INTEREST_MONTHLY
  return state.accounts
    .filter((a) => a.open && a.kind === 'revolving')
    .reduce((sum, a) => sum + a.balance * (a.interestRate ?? standard), 0)
}

function accrueInterest(state: PlayerState): PlayerState {
  // Card interest is paid from cash, as if the minimum payment covers it, so
  // balances hold steady. Carrying a balance costs money every month instead
  // of silently compounding the player past a utilization tier.
  const interest = monthlyCardInterest(state)
  const accounts = state.accounts.map((a) => {
    if (!a.open || a.kind === 'revolving') return a
    const balance = Math.max(0, a.balance - INSTALLMENT_PRINCIPAL_SHARE * (a.monthlyPayment ?? 0))
    // A loan that reaches zero is paid off and stops counting toward DTI.
    return { ...a, balance, open: balance > 0 }
  })
  const next = { ...state, cash: state.cash - interest, accounts }
  return interest >= 1 ? addLog(next, `Card interest paid: ${formatMoney(interest)}.`) : next
}

function coverOverdraft(state: PlayerState): PlayerState {
  if (state.cash >= 0) return state
  const shortfall = -state.cash
  const { state: charged, unpaid } = chargeToCard({ ...state, cash: 0 }, shortfall)
  const covered = shortfall - unpaid
  let next = covered > 0 ? addLog(charged, `Short on cash: ${formatMoney(covered)} went onto a card.`) : charged
  if (unpaid > 0) {
    // Simplification: the unpaid amount is written off, but the lender sees it.
    next = state.flags.autopay
      ? addLog(next, 'Autopay covered your minimum payments, so nothing was reported late.')
      : addLog({ ...next, missedPayments: next.missedPayments + 1 }, 'You missed a payment. It will show on your credit report.')
  }
  return next
}

export function endMonth(state: PlayerState): PlayerState {
  if (awaitingEventChoice(state)) return state
  const discarded = { ...state, hand: [], discard: [...state.discard, ...state.hand] }
  return coverOverdraft(accrueInterest(discarded))
}

// ---------------------------------------------------------------------------
// The game reducer used by React (see hooks/useGame.ts).

export type GameState =
  | { phase: 'start' }
  | { phase: 'playing'; player: PlayerState }
  // Between months: pick one of player.draftOffer to add to the deck.
  | { phase: 'draft'; player: PlayerState }
  // After month 12: the step-by-step reveal, then the result. The underwriting
  // result is derived from `player` by underwrite(), never stored.
  | { phase: 'underwriting' | 'result'; player: PlayerState }

export type GameAction =
  | { type: 'START'; seed: number }
  | { type: 'RESOLVE_EVENT'; choiceId: string }
  | { type: 'PLAY_CARD'; handIndex: number; amount?: number }
  | { type: 'END_MONTH' }
  | { type: 'DRAFT_PICK'; cardId: CardId | null }
  | { type: 'SHOW_RESULT' }
  | { type: 'RESTART' }

export const initialGameState: GameState = { phase: 'start' }

export function gameReducer(game: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      return { phase: 'playing', player: newRun(action.seed) }
    case 'RESTART':
      return initialGameState
    case 'SHOW_RESULT':
      return game.phase === 'underwriting' ? { phase: 'result', player: game.player } : game
  }

  if (game.phase === 'draft') {
    if (action.type !== 'DRAFT_PICK') return game
    const picked = takeDraft(game.player, action.cardId)
    if (picked === game.player) return game
    return { phase: 'playing', player: startMonth({ ...picked, month: picked.month + 1 }) }
  }

  if (game.phase !== 'playing') return game
  const { player } = game

  switch (action.type) {
    case 'DRAFT_PICK':
      return game
    case 'RESOLVE_EVENT':
      return { phase: 'playing', player: resolveEvent(player, action.choiceId) }
    case 'PLAY_CARD':
      return { phase: 'playing', player: playCard(player, action.handIndex, action.amount) }
    case 'END_MONTH': {
      if (awaitingEventChoice(player)) return game
      const ended = endMonth(player)
      if (ended.month >= MONTHS) return { phase: 'underwriting', player: ended }
      const offered = withRng(ended, (s, rng) => ({ ...s, draftOffer: drawDraftOffer(s, rng) }))
      // Nothing left to offer: go straight to next month.
      if (offered.draftOffer.length === 0) {
        return { phase: 'playing', player: startMonth({ ...offered, month: offered.month + 1 }) }
      }
      return { phase: 'draft', player: offered }
    }
  }
}
