import { describe, expect, it } from 'vitest'
import { buildDeck, CARDS } from '../../data/cards'
import { creditScore, utilization } from '../credit'
import { findAccount } from '../effects'
import { payday } from '../reducer'
import { dti, monthlyDebts, underwrite } from '../underwrite'
import { applyCard, payOffCar, startState } from './helpers'

describe('deck', () => {
  it('has two copies of the ×2 cards and one of everything else', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(17)
    expect(deck.filter((id) => id === 'pay_card_1k')).toHaveLength(2)
    expect(deck.filter((id) => id === 'meal_prep')).toHaveLength(2)
  })
})

describe('card effects', () => {
  it('side gig adds cash each paycheck but does not change DTI', () => {
    const before = startState()
    const after = applyCard(before, 'side_gig')
    expect(dti(after, 2_000)).toBe(dti(before, 2_000))
    expect(underwrite(after).maxPrice).toBe(underwrite(before).maxPrice)
    // Next paycheck: surplus plus the $400 the lender won't count.
    const paid = payday(after)
    expect(paid.cash).toBe(before.cash + 700 + 400)
  })

  it('pay off the car removes its payment and then becomes unavailable', () => {
    const after = payOffCar(startState())
    expect(after.cash).toBe(startState().cash - 9_000)
    expect(monthlyDebts(after)).toBe(monthlyDebts(startState()) - 380)
    expect(CARDS.pay_off_car.unavailable?.(after)).toMatch(/closed/)
    expect(CARDS.extra_car.unavailable?.(after)).toMatch(/closed/)
  })

  it('extra car payment lowers the balance but not the monthly payment', () => {
    const after = applyCard(startState(), 'extra_car')
    expect(findAccount(after, 'car')?.balance).toBe(7_500)
    expect(monthlyDebts(after)).toBe(monthlyDebts(startState()))
  })

  it('pay down a card targets the highest-utilization card', () => {
    // Old Faithful is at 83%, the Rewards Card at 67%.
    const after = applyCard(startState(), 'pay_card_1k')
    expect(findAccount(after, 'old_faithful')?.balance).toBe(1_500)
    expect(findAccount(after, 'rewards')?.balance).toBe(2_000)
  })

  it('balance blitz splits $2,500 across cards in proportion to balance', () => {
    const after = applyCard(startState(), 'balance_blitz')
    expect(after.cash).toBe(startState().cash - 2_500)
    expect(utilization(after)).toBeCloseTo(2_000 / 6_000)
  })

  it('store card adds an inquiry and a brand-new account', () => {
    const after = applyCard(startState(), 'store_card')
    expect(after.hardInquiries).toBe(2)
    expect(after.accounts.at(-1)).toMatchObject({ kind: 'revolving', ageYears: 0, limit: 1_500, open: true })
    expect(creditScore(after)).toBeLessThan(creditScore(startState()))
  })

  it('limit increase lowers utilization without paying anything', () => {
    const after = applyCard(startState(), 'limit_increase')
    expect(after.cash).toBe(startState().cash)
    expect(utilization(after)).toBeCloseTo(4_500 / 9_000)
  })

  it('consolidation zeroes the cards but adds a payment and an inquiry', () => {
    const after = applyCard(startState(), 'consolidate')
    expect(utilization(after)).toBe(0)
    expect(after.hardInquiries).toBe(2)
    // Card minimums (3% of $4,500) are replaced by a loan at 4% of $4,500.
    expect(monthlyDebts(after)).toBeCloseTo(monthlyDebts(startState()) - 135 + 180)
  })

  it('ask for a raise depends on the seeded roll', () => {
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => applyCard(startState(), 'ask_raise', seed))
    const incomes = new Set(outcomes.map((s) => s.grossMonthlyIncome))
    expect(incomes).toEqual(new Set([7_500, 7_875]))
  })

  it('dispute is unavailable with nothing to dispute', () => {
    expect(CARDS.dispute.unavailable?.({ ...startState(), missedPayments: 0 })).not.toBeNull()
  })

  it('cards that cost cash are unavailable without it', () => {
    const broke = { ...startState(), cash: 500 }
    expect(CARDS.pay_card_1k.unavailable?.(broke)).toMatch(/cash/)
    expect(CARDS.cheaper_place.unavailable?.(broke)).toMatch(/cash/)
  })
})
