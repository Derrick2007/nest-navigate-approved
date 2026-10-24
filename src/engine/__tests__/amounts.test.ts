import { describe, expect, it } from 'vitest'
import { CARDS } from '../../data/cards'
import { amountRange, resolveAmount } from '../amounts'
import { creditScore, paydownToReach, utilization } from '../credit'
import { previewCard } from '../preview'
import { cardUnavailableReason, newRun, playCard } from '../reducer'
import type { PlayerState } from '../types'
import { startState } from './helpers'

describe('amount ranges', () => {
  it('caps the slider at what you owe and what you can pay', () => {
    expect(amountRange(CARDS.pay_cards, startState())).toEqual({ min: 100, max: 2_000, step: 100 })
    // Only $1,250 in cash: the top of the slider snaps down to $1,200.
    expect(amountRange(CARDS.pay_cards, { ...startState(), cash: 1_250 })?.max).toBe(1_200)
    // Blitz can go up to everything owed on the cards ($4,500).
    expect(amountRange(CARDS.balance_blitz, startState())?.max).toBe(4_500)
  })

  it('has no range when the smallest payment is out of reach', () => {
    expect(amountRange(CARDS.extra_car, { ...startState(), cash: 300 })).toBeNull()
    expect(amountRange(CARDS.meal_prep, startState())).toBeNull()
  })

  it('snaps a requested amount to a legal step', () => {
    expect(resolveAmount(CARDS.pay_cards, startState(), 1_234)).toBe(1_200)
    expect(resolveAmount(CARDS.pay_cards, startState(), 99_999)).toBe(2_000)
    expect(resolveAmount(CARDS.pay_cards, startState(), 0)).toBe(100)
    expect(resolveAmount(CARDS.pay_cards, startState())).toBe(1_000)
  })
})

describe('playing a slider card', () => {
  const ready = (hand: PlayerState['hand']): PlayerState => ({
    ...newRun(7),
    event: { eventId: 'quiet', resolved: true },
    hand,
  })

  it('pays exactly the chosen amount', () => {
    const before = ready(['balance_blitz'])
    const after = playCard(before, 0, 2_700)
    expect(after.cash).toBeCloseTo(before.cash - 2_700)
  })

  it('crossing the 30% line is worth a big score jump', () => {
    const state = startState()
    const toThirty = paydownToReach(state, 0.3)
    expect(toThirty).toBe(4_500 - 0.3 * 6_000)
    const justShort = CARDS.balance_blitz.play(state, { next: () => 0, state: 0 }, toThirty - 100)
    const across = CARDS.balance_blitz.play(state, { next: () => 0, state: 0 }, toThirty)
    expect(utilization(across)).toBeCloseTo(0.3)
    expect(creditScore(across) - creditScore(justShort)).toBeGreaterThanOrEqual(40)
  })

  it('previews the amount on the slider', () => {
    const small = previewCard(startState(), 'balance_blitz', undefined, 1_000)
    const big = previewCard(startState(), 'balance_blitz', undefined, 4_500)
    const cash = (d: typeof small) => d.find((x) => x.stat === 'cash')!.after
    expect(cash(small)).toBe(22_000 - 1_000)
    expect(cash(big)).toBe(22_000 - 4_500)
  })

  it('an extra car payment never changes DTI, at any amount', () => {
    for (const amount of [500, 1_500, 3_000]) {
      expect(previewCard(startState(), 'extra_car', undefined, amount).find((d) => d.stat === 'dti')).toBeUndefined()
    }
  })

  it('is unavailable when not even the smallest payment fits', () => {
    const owesLittle = { ...ready(['pay_cards']), accounts: ready([]).accounts.map((a) => (a.kind === 'revolving' ? { ...a, balance: 40 } : a)) }
    expect(cardUnavailableReason(owesLittle, 'pay_cards')).toMatch(/smallest payment/)
  })
})
