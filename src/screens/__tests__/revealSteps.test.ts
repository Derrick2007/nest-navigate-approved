import { describe, expect, it } from 'vitest'
import { closeOldestCard, startState } from '../../engine/__tests__/helpers'
import { underwrite } from '../../engine/underwrite'
import { revealSteps } from '../revealSteps'

const stepsFor = (state = startState()) => revealSteps(underwrite(state), state.grossMonthlyIncome)

describe('revealSteps', () => {
  it('walks credit, cash, DTI, outcome, then the rate tier by tier', () => {
    expect(stepsFor().map((s) => s.id)).toEqual([
      'credit',
      'cash',
      'dti',
      'outcome',
      'rate-base',
      'rate-credit',
      'rate-down',
      'rate-total',
    ])
  })

  it('flags the check that fails at the target price', () => {
    // The starting player can't afford $325k: DTI is over 43% there.
    const dti = stepsFor().find((s) => s.id === 'dti')!
    expect(dti.status).toBe('fail')
    expect(stepsFor().find((s) => s.id === 'outcome')?.status).toBe('warn')
  })

  it('stops at the credit gate when the score is too low', () => {
    const steps = stepsFor(closeOldestCard(startState()))
    expect(steps.map((s) => [s.id, s.status])).toEqual([
      ['credit', 'fail'],
      ['outcome', 'fail'],
    ])
  })

  it('recovers monthly debts from the DTI line', () => {
    const dti = stepsFor().find((s) => s.id === 'dti')!
    expect(dti.detail).toContain('$765 in debts')
  })
})
