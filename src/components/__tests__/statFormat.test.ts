import { describe, expect, it } from 'vitest'
import type { Delta } from '../../engine/preview'
import { formatChange } from '../statFormat'

const delta = (stat: Delta['stat'], before: number, after: number, good: boolean | null = true): Delta => ({
  stat,
  before,
  after,
  good,
})

describe('formatChange', () => {
  it('signs money and score changes', () => {
    expect(formatChange(delta('score', 656, 685))).toBe('+29')
    expect(formatChange(delta('cash', 22_000, 21_000, false))).toBe('−$1,000')
    expect(formatChange(delta('monthlySavings', 700, 1_300))).toBe('+$600/mo')
    expect(formatChange(delta('maxPrice', 278_000, 289_000))).toBe('+$11k')
  })

  it('shows where a ratio ends up', () => {
    expect(formatChange(delta('utilization', 0.75, 0.58))).toBe('↓ 58%')
    expect(formatChange(delta('dti', 0.102, 0.108, false))).toBe('↑ 10.8%')
  })

  it('names denial and recovery instead of a meaningless change', () => {
    expect(formatChange(delta('maxPrice', 278_000, 0, false))).toBe('Denied')
    expect(formatChange(delta('maxPrice', 0, 250_000))).toBe('$250k')
    expect(formatChange(delta('maxPrice', 278_000, 278_000, null))).toBe('no change')
  })
})

describe('formatChange with months left', () => {
  it('projects a monthly savings change to month 12', () => {
    expect(formatChange(delta('monthlySavings', 700, 1_100), 11)).toBe('+$400/mo, +$4,400 by month 12')
    expect(formatChange(delta('monthlySavings', 700, 550, false), 0)).toBe('−$150/mo')
  })
})
