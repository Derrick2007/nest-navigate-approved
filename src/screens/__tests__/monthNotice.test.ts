import { describe, expect, it } from 'vitest'
import { startState } from '../../engine/__tests__/helpers'
import { monthNotice } from '../monthNotice'

const player = { ...startState(), hand: ['meal_prep' as const], energy: 3 }

describe('monthNotice', () => {
  it('asks for the event choice first', () => {
    expect(monthNotice({ ...player, cash: -500 }, true, false)?.text).toMatch(/event first/)
  })

  it('warns about a cash shortfall before month end', () => {
    expect(monthNotice({ ...player, cash: -1_200 }, false, true)).toEqual({
      tone: 'bad',
      text: "You're $1,200 short. At month end it goes on a card, or counts as a missed payment.",
    })
  })

  it('explains why nothing can be played', () => {
    expect(monthNotice({ ...player, energy: 0 }, false, false)?.text).toBe('Out of energy for this month.')
    expect(monthNotice(player, false, false)?.text).toBe('Nothing else you can do this month.')
  })

  it('stays quiet when there is something to do', () => {
    expect(monthNotice(player, false, true)).toBeNull()
    expect(monthNotice({ ...player, hand: [] }, false, false)).toBeNull()
  })
})
