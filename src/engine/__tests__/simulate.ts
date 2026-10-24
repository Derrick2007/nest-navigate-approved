import { EVENTS } from '../../data/events'
import { snapshot } from '../preview'
import { awaitingEventChoice, cardUnavailableReason, gameReducer, MONTHS, type GameState } from '../reducer'
import { createRng } from '../rng'
import type { PlayerState } from '../types'
import { underwrite, type UnderwritingResult } from '../underwrite'

// Plays whole runs with simple automated strategies, for balance tests and
// tuning (docs/SPEC.md §13 milestone 6). Not used by the game itself.

type Decision = { type: 'choice'; choiceId: string } | { type: 'card'; handIndex: number } | { type: 'end' }

export type Strategy = (player: PlayerState, seed: number, step: number) => Decision

const CAUTIOUS_CHOICES = ['cash', 'skip', 'decline', 'pass']

/** Never plays a card; takes the cautious option on every event. The "do nothing" player. */
export const idle: Strategy = (player) => {
  if (awaitingEventChoice(player)) {
    const choices = EVENTS[player.event!.eventId].choices!
    return { type: 'choice', choiceId: (choices.find((c) => CAUTIOUS_CHOICES.includes(c.id)) ?? choices[0]).id }
  }
  return { type: 'end' }
}

/** Picks uniformly among legal moves, including ending the month early. A new player clicking around. */
export const random: Strategy = (player, seed, step) => {
  const rng = createRng(seed * 31 + step)
  if (awaitingEventChoice(player)) {
    const choices = EVENTS[player.event!.eventId].choices!
    return { type: 'choice', choiceId: choices[Math.floor(rng.next() * choices.length)].id }
  }
  const playable = player.hand.flatMap((id, i) => (cardUnavailableReason(player, id) === null ? [i] : []))
  const pick = Math.floor(rng.next() * (playable.length + 1))
  return pick < playable.length ? { type: 'card', handIndex: playable[pick] } : { type: 'end' }
}

/**
 * Judges a state by the house it would buy at the end of the year: max price
 * with this month's savings rate projected forward. Simple, but it values
 * a side gig or cheaper rent, not only instant changes.
 */
function projectedMaxPrice(player: PlayerState): number {
  const monthsLeft = MONTHS - player.month
  const savings = snapshot(player).monthlySavings
  return underwrite({ ...player, cash: player.cash + monthsLeft * savings }).maxPrice ?? 0
}

/** One-step lookahead on projected max price. A thoughtful player who reads the previews. */
export const greedy: Strategy = (player) => {
  if (awaitingEventChoice(player)) {
    const choices = EVENTS[player.event!.eventId].choices!
    const best = choices
      .map((c) => ({ id: c.id, value: projectedMaxPrice(c.apply(player, createRng(0))) }))
      .sort((a, b) => b.value - a.value)[0]
    return { type: 'choice', choiceId: best.id }
  }
  const now = projectedMaxPrice(player)
  const options = player.hand.flatMap((id, handIndex) => {
    if (cardUnavailableReason(player, id) !== null) return []
    const after = gameReducer({ phase: 'playing', player }, { type: 'PLAY_CARD', handIndex })
    return after.phase === 'playing' ? [{ handIndex, value: projectedMaxPrice(after.player) }] : []
  })
  const best = options.sort((a, b) => b.value - a.value)[0]
  return best && best.value > now ? { type: 'card', handIndex: best.handIndex } : { type: 'end' }
}

export type RunSummary = { seed: number; player: PlayerState; result: UnderwritingResult }

export function simulate(strategy: Strategy, seed: number): RunSummary {
  let game: GameState = gameReducer({ phase: 'start' }, { type: 'START', seed })
  for (let step = 0; game.phase === 'playing'; step++) {
    const decision = strategy(game.player, seed, step)
    game = gameReducer(
      game,
      decision.type === 'choice'
        ? { type: 'RESOLVE_EVENT', choiceId: decision.choiceId }
        : decision.type === 'card'
          ? { type: 'PLAY_CARD', handIndex: decision.handIndex }
          : { type: 'END_MONTH' },
    )
  }
  if (game.phase === 'start') throw new Error('run never started')
  return { seed, player: game.player, result: underwrite(game.player) }
}

export type BalanceReport = {
  runs: number
  approved: number
  smaller: number
  denied: number
  /** Max price percentiles, with denials counted as 0. */
  p10: number
  median: number
  p90: number
  medianScore: number
}

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]

export function report(strategy: Strategy, seeds: number[]): BalanceReport {
  const runs = seeds.map((seed) => simulate(strategy, seed))
  const prices = runs.map((r) => r.result.maxPrice ?? 0).sort((a, b) => a - b)
  const scores = runs.map((r) => r.result.credit.score).sort((a, b) => a - b)
  const share = (outcome: string) => runs.filter((r) => r.result.outcome === outcome).length / runs.length
  return {
    runs: runs.length,
    approved: share('APPROVED'),
    smaller: share('APPROVED_SMALLER'),
    denied: share('DENIED'),
    p10: percentile(prices, 0.1),
    median: percentile(prices, 0.5),
    p90: percentile(prices, 0.9),
    medianScore: percentile(scores, 0.5),
  }
}
