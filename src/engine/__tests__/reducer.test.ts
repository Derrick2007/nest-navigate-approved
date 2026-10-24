import { describe, expect, it } from 'vitest'
import { buildDeck, CARDS } from '../../data/cards'
import { EVENTS } from '../../data/events'
import { findAccount } from '../effects'
import {
  awaitingEventChoice,
  cardUnavailableReason,
  endMonth,
  ENERGY_PER_MONTH,
  gameReducer,
  HAND_SIZE,
  newRun,
  payday,
  playCard,
  resolveEvent,
  type GameAction,
  type GameState,
} from '../reducer'
import { createRng } from '../rng'
import type { PlayerState } from '../types'
import { underwrite } from '../underwrite'
import { startState } from './helpers'

/** Drive a whole run with a simple policy: pick a choice, play what you can, end the month, take a draft card. */
function playThrough(seed: number, pick: (options: number) => number = () => 0): GameState[] {
  const history: GameState[] = []
  let game = gameReducer({ phase: 'start' }, { type: 'START', seed })
  const step = (action: GameAction) => {
    game = gameReducer(game, action)
    history.push(game)
  }
  while (game.phase === 'playing' || game.phase === 'draft') {
    const { player } = game
    if (game.phase === 'draft') {
      step({ type: 'DRAFT_PICK', cardId: player.draftOffer[pick(player.draftOffer.length)] })
      continue
    }
    if (awaitingEventChoice(player)) {
      const choices = EVENTS[player.event!.eventId].choices!
      step({ type: 'RESOLVE_EVENT', choiceId: choices[pick(choices.length)].id })
      continue
    }
    const playable = player.hand.findIndex((id) => cardUnavailableReason(player, id) === null)
    step(playable >= 0 ? { type: 'PLAY_CARD', handIndex: playable } : { type: 'END_MONTH' })
  }
  return history
}

const finalPlayer = (history: GameState[]): PlayerState => {
  const last = history.at(-1)!
  if (last.phase === 'start') throw new Error('run never started')
  return last.player
}

describe('a new run', () => {
  it('starts month 1 with an event and a full hand', () => {
    const run = newRun(42)
    expect(run.month).toBe(1)
    expect(run.event).not.toBeNull()
    expect(run.hand).toHaveLength(HAND_SIZE)
    expect(run.energy).toBe(ENERGY_PER_MONTH)
    expect(run.deck).toHaveLength(buildDeck().length - HAND_SIZE)
  })

  it('pays the monthly surplus and ages every account by a month', () => {
    const paid = payday(startState())
    expect(paid.cash).toBe(22_000 + 550)
    expect(findAccount(paid, 'old_faithful')?.ageYears).toBeCloseTo(8 + 1 / 12)
  })
})

describe('determinism', () => {
  it('replays the same game from the same seed and actions', () => {
    expect(playThrough(1234)).toEqual(playThrough(1234))
  })

  it('plays a different game from a different seed', () => {
    expect(finalPlayer(playThrough(1)).log).not.toEqual(finalPlayer(playThrough(2)).log)
  })
})

describe('playing cards', () => {
  // A run whose event is already handled, with a known hand.
  const ready = (hand: PlayerState['hand']): PlayerState => ({
    ...newRun(7),
    event: { eventId: 'quiet', resolved: true },
    hand,
  })

  it('spends energy and moves the card to the discard pile', () => {
    const after = playCard(ready(['meal_prep']), 0)
    expect(after.energy).toBe(ENERGY_PER_MONTH - 1)
    expect(after.hand).toEqual([])
    expect(after.discard.at(-1)).toBe('meal_prep')
  })

  it('removes a once card from the game', () => {
    const before = ready(['autopay'])
    const after = playCard(before, 0)
    expect(after.flags.autopay).toBe(true)
    expect(after.discard).toEqual(before.discard)
  })

  it('refuses a card that costs more energy than is left', () => {
    const tired = { ...ready(['sell_stuff']), energy: 1 }
    expect(playCard(tired, 0)).toBe(tired)
  })

  it('records played cards for the lesson picker', () => {
    expect(playCard(ready(['side_gig']), 0).flags['card:side_gig']).toBe(true)
  })
})

describe('events', () => {
  const waiting = (): PlayerState => ({ ...newRun(7), event: { eventId: 'medical', resolved: false } })

  it('blocks cards and the end of the month until a choice is made', () => {
    const state = waiting()
    expect(playCard(state, 0)).toBe(state)
    expect(endMonth(state)).toBe(state)
    expect(cardUnavailableReason(state, state.hand[0])).toMatch(/event/)
  })

  it('applies the chosen option', () => {
    const state = waiting()
    expect(resolveEvent(state, 'cash').cash).toBe(state.cash - 1_200)
    // The Rewards Card only has $1,000 of room, so the last $200 comes out of cash.
    const onCard = resolveEvent(state, 'card')
    expect(findAccount(onCard, 'rewards')?.balance).toBe(3_000)
    expect(onCard.cash).toBe(state.cash - 200)
    expect(onCard.event?.resolved).toBe(true)
  })

  it('ignores an unknown choice', () => {
    const state = waiting()
    expect(resolveEvent(state, 'nope')).toBe(state)
  })

  it('never repeats back to back and keeps the furniture deal to months 8–12', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const months = playThrough(seed)
        .filter((g) => g.phase === 'playing')
        .map((g) => g.player)
      const eventByMonth = new Map(months.map((p) => [p.month, p.event!.eventId]))
      for (let m = 2; m <= 12; m++) expect(eventByMonth.get(m)).not.toBe(eventByMonth.get(m - 1))
      for (const [month, id] of eventByMonth) if (id === 'furniture_promo') expect(month).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('end of month', () => {
  const resolved = (change: Partial<PlayerState> = {}): PlayerState => ({
    ...newRun(7),
    event: { eventId: 'quiet', resolved: true },
    ...change,
  })

  it('pays 2% card interest from cash and pays down installment loans', () => {
    const before = resolved()
    const after = endMonth(before)
    // Interest on $4,500 of card balances comes out of cash; balances hold steady.
    expect(after.cash).toBeCloseTo(before.cash - 90)
    expect(findAccount(after, 'old_faithful')?.balance).toBe(2_500)
    expect(findAccount(after, 'car')?.balance).toBeCloseTo(9_000 - 0.6 * 380)
    expect(after.hand).toEqual([])
  })

  it('moves a cash shortfall onto the card with the most room', () => {
    const after = endMonth(resolved({ cash: -500 }))
    expect(after.cash).toBe(0)
    // -$500 plus $90 of interest; the Rewards Card had $1,000 of room, Old Faithful only $500.
    expect(findAccount(after, 'rewards')?.balance).toBeCloseTo(2_000 + 590)
    expect(after.missedPayments).toBe(1)
  })

  it('reports a missed payment when no card has room', () => {
    const after = endMonth(resolved({ cash: -10_000 }))
    expect(after.cash).toBe(0)
    expect(after.missedPayments).toBe(2)
  })

  it('autopay prevents the missed payment', () => {
    const after = endMonth(resolved({ cash: -10_000, flags: { autopay: true } }))
    expect(after.missedPayments).toBe(1)
  })
})

describe('a full run', () => {
  it('finishes after month 12 and can be underwritten', () => {
    const history = playThrough(99)
    const last = history.at(-1)!
    expect(last.phase).toBe('underwriting')
    const player = finalPlayer(history)
    expect(player.month).toBe(12)
    expect(['APPROVED', 'APPROVED_SMALLER', 'DENIED']).toContain(underwrite(player).outcome)
  })

  it('ignores moves after the game is over', () => {
    const last = playThrough(99).at(-1)!
    expect(gameReducer(last, { type: 'END_MONTH' })).toBe(last)
    expect(gameReducer(last, { type: 'RESTART' })).toEqual({ phase: 'start' })
  })

  it('moves from the underwriting reveal to the result', () => {
    const last = playThrough(99).at(-1)!
    const result = gameReducer(last, { type: 'SHOW_RESULT' })
    expect(result.phase).toBe('result')
    // Only the reveal can advance to the result.
    expect(gameReducer(result, { type: 'SHOW_RESULT' })).toBe(result)
  })

  it('keeps the state sane across many random runs', () => {
    const totalCards = buildDeck().length
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed * 7919)
      const history = playThrough(seed, (n) => Math.floor(rng.next() * n))
      for (const game of history) {
        if (game.phase === 'start') continue
        const p = game.player
        expect(Number.isFinite(p.cash)).toBe(true)
        expect(p.cash).toBeGreaterThanOrEqual(-100_000)
        expect(p.energy).toBeGreaterThanOrEqual(0)
        expect(p.hand.length).toBeLessThanOrEqual(HAND_SIZE)
        // Every card (starting or drafted) is in the deck, hand or discard, or was a once card that got played.
        const removed = Object.values(CARDS).filter((c) => c.once && p.flags[`card:${c.id}`]).length
        const drafted = p.log.filter((e) => e.text.startsWith('Added ')).length
        expect(p.deck.length + p.hand.length + p.discard.length + removed).toBe(totalCards + drafted)
      }
      expect(history.at(-1)!.phase).toBe('underwriting')
    }
  })
})
