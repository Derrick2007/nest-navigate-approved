import { describe, expect, it } from 'vitest'
import { CARDS } from '../../data/cards'
import { MAX_LESSONS, pickLessons } from '../lessons'
import type { PlayerState } from '../types'
import { startState } from './helpers'

const withFlags = (...flags: string[]): PlayerState => ({
  ...startState(),
  flags: Object.fromEntries(flags.map((f) => [f, true])),
})

describe('pickLessons', () => {
  it('puts closing the oldest card first', () => {
    const lessons = pickLessons(withFlags('card:meal_prep', 'card:close_old'))
    expect(lessons[0].source).toBe(CARDS.close_old.name)
  })

  it('teaches from event choices', () => {
    const lessons = pickLessons(withFlags('event:car_trouble:finance'))
    expect(lessons[0].source).toBe('Car Breaks Down')
  })

  it('mentions high utilization even if the player never touched their cards', () => {
    // The starting cards sit at 75%.
    const lessons = pickLessons(withFlags())
    expect(lessons[0].text).toMatch(/75% utilization/)
  })

  it('stops at three lessons and never repeats one', () => {
    const lessons = pickLessons(
      withFlags('card:close_old', 'card:side_gig', 'card:pay_off_car', 'card:autopay', 'card:balance_blitz'),
    )
    expect(lessons).toHaveLength(MAX_LESSONS)
    expect(new Set(lessons.map((l) => l.source)).size).toBe(MAX_LESSONS)
  })

  it('falls back to other cards the player played', () => {
    const paidOff = { ...withFlags('card:autopay'), accounts: startState().accounts.map((a) => ({ ...a, balance: 0 })) }
    expect(pickLessons(paidOff)).toEqual([{ source: CARDS.autopay.name, text: CARDS.autopay.lesson }])
  })
})
