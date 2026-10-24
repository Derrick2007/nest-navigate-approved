import { CARDS } from '../../data/cards'
import { EVENTS } from '../../data/events'
import { amountRange } from '../amounts'
import { paydownToReach } from '../credit'
import { snapshot } from '../preview'
import { awaitingEventChoice, cardUnavailableReason, gameReducer, MONTHS, type GameState } from '../reducer'
import { createRng } from '../rng'
import type { CardId, PlayerState } from '../types'
import { underwrite, type UnderwritingResult } from '../underwrite'

// Plays whole runs with simple automated strategies, for balance tests and
// tuning (docs/SPEC.md §13 milestone 6). Not used by the game itself.

type Decision =
  | { type: 'choice'; choiceId: string }
  | { type: 'card'; handIndex: number; amount?: number }
  | { type: 'end' }
  | { type: 'draft'; cardId: CardId | null }

export type Strategy = (player: PlayerState, seed: number, step: number, drafting: boolean) => Decision

const CAUTIOUS_CHOICES = ['cash', 'skip', 'decline', 'pass']

/** Never plays or drafts a card; takes the cautious option on every event. The "do nothing" player. */
export const idle: Strategy = (player, _seed, _step, drafting) => {
  if (drafting) return { type: 'draft', cardId: null }
  if (awaitingEventChoice(player)) {
    const choices = EVENTS[player.event!.eventId].choices!
    return { type: 'choice', choiceId: (choices.find((c) => CAUTIOUS_CHOICES.includes(c.id)) ?? choices[0]).id }
  }
  return { type: 'end' }
}

/** Picks uniformly among legal moves, including ending the month early. A new player clicking around. */
export const random: Strategy = (player, seed, step, drafting) => {
  const rng = createRng(seed * 31 + step)
  if (drafting) {
    const pick = Math.floor(rng.next() * (player.draftOffer.length + 1))
    return { type: 'draft', cardId: player.draftOffer[pick] ?? null }
  }
  if (awaitingEventChoice(player)) {
    const choices = EVENTS[player.event!.eventId].choices!
    return { type: 'choice', choiceId: choices[Math.floor(rng.next() * choices.length)].id }
  }
  const playable = player.hand.flatMap((id, i) => (cardUnavailableReason(player, id) === null ? [i] : []))
  const pick = Math.floor(rng.next() * (playable.length + 1))
  if (pick >= playable.length) return { type: 'end' }
  // Sliders land anywhere in their legal range.
  const range = amountRange(CARDS[player.hand[playable[pick]]], player)
  const amount = range ? range.min + Math.floor(rng.next() * ((range.max - range.min) / range.step + 1)) * range.step : undefined
  return { type: 'card', handIndex: playable[pick], amount }
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

/** Amounts worth trying on a slider: the ends, every $500, and exactly the 30% and 10% utilization lines. */
function candidateAmounts(player: PlayerState, cardId: CardId): (number | undefined)[] {
  const card = CARDS[cardId]
  const range = amountRange(card, player)
  if (!range) return [undefined]
  const marks = card.amount?.utilizationMarks ? [0.3, 0.1].map((r) => Math.ceil(paydownToReach(player, r) / range.step) * range.step) : []
  const steps = Array.from({ length: Math.floor((range.max - range.min) / 500) + 1 }, (_, i) => range.min + i * 500)
  return [...new Set([range.min, range.max, ...steps, ...marks])].filter((a) => a >= range.min && a <= range.max)
}

/** One-step lookahead on projected max price. A thoughtful player who reads the previews. */
export const greedy: Strategy = (player, _seed, _step, drafting) => {
  if (drafting) {
    // Value each offered card as if it could be played right now; skip if none helps.
    const now = projectedMaxPrice(player)
    const scored = player.draftOffer.map((cardId) => {
      const card = CARDS[cardId]
      const trial = { ...player, energy: 3, event: null }
      if (card.unavailable?.(trial)) return { cardId, value: -Infinity }
      const best = Math.max(
        ...candidateAmounts(trial, cardId).map((amount) => projectedMaxPrice(card.play(trial, createRng(0), amount))),
      )
      return { cardId, value: best }
    })
    const top = scored.sort((a, b) => b.value - a.value)[0]
    return { type: 'draft', cardId: top && top.value > now ? top.cardId : null }
  }
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
    return candidateAmounts(player, id).flatMap((amount) => {
      const after = gameReducer({ phase: 'playing', player }, { type: 'PLAY_CARD', handIndex, amount })
      return after.phase === 'playing' ? [{ handIndex, amount, value: projectedMaxPrice(after.player) }] : []
    })
  })
  const best = options.sort((a, b) => b.value - a.value)[0]
  return best && best.value > now ? { type: 'card', handIndex: best.handIndex, amount: best.amount } : { type: 'end' }
}

export type RunSummary = { seed: number; player: PlayerState; result: UnderwritingResult }

export function simulate(strategy: Strategy, seed: number): RunSummary {
  let game: GameState = gameReducer({ phase: 'start' }, { type: 'START', seed })
  for (let step = 0; game.phase === 'playing' || game.phase === 'draft'; step++) {
    const decision = strategy(game.player, seed, step, game.phase === 'draft')
    game = gameReducer(
      game,
      decision.type === 'choice'
        ? { type: 'RESOLVE_EVENT', choiceId: decision.choiceId }
        : decision.type === 'card'
          ? { type: 'PLAY_CARD', handIndex: decision.handIndex, amount: decision.amount }
          : decision.type === 'draft'
            ? { type: 'DRAFT_PICK', cardId: decision.cardId }
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
