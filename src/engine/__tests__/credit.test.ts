import { describe, expect, it } from 'vitest'
import { creditBreakdown, creditScore, utilization, utilizationPoints } from '../credit'
import { updateAccount } from '../effects'
import { closeOldestCard, startState } from './helpers'

describe('creditScore', () => {
  it('scores the starting state at 656', () => {
    expect(creditBreakdown(startState())).toEqual({
      paymentHistory: expect.closeTo(163.2),
      utilization: 60, // $4,500 of $6,000 = 75%
      age: 38, // average age 4.75 years
      newCredit: 40,
      mix: 55,
      score: 656,
    })
  })

  it('drops below the 620 gate when the oldest card is closed', () => {
    // Shorter history and a maxed-out remaining card, both at once.
    expect(creditScore(closeOldestCard(startState()))).toBe(618)
  })

  it('loses mix points without an open installment loan', () => {
    let state = updateAccount(startState(), 'car', { open: false })
    state = updateAccount(state, 'student', { open: false })
    expect(creditBreakdown(state).mix).toBe(30)
  })

  it('stays within 300–850', () => {
    const awful = { ...startState(), missedPayments: 10, hardInquiries: 10 }
    expect(creditScore(awful)).toBeGreaterThanOrEqual(300)
  })
})

describe('utilization', () => {
  it('counts only open revolving cards', () => {
    expect(utilization(startState())).toBeCloseTo(0.75)
    const closed = updateAccount(startState(), 'rewards', { open: false })
    expect(utilization(closed)).toBeCloseTo(2_500 / 3_000)
  })

  it('awards points at each tier boundary', () => {
    expect(utilizationPoints(0)).toBe(165)
    expect(utilizationPoints(0.1)).toBe(165)
    expect(utilizationPoints(0.1001)).toBe(140)
    expect(utilizationPoints(0.3)).toBe(140)
    expect(utilizationPoints(0.3001)).toBe(100)
    expect(utilizationPoints(0.5)).toBe(100)
    expect(utilizationPoints(0.5001)).toBe(60)
    expect(utilizationPoints(0.75)).toBe(60)
    expect(utilizationPoints(0.7501)).toBe(30)
    expect(utilizationPoints(1.5)).toBe(30)
  })
})
