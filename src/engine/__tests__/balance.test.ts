import { describe, expect, it } from 'vitest'
import { greedy, idle, random, report } from './simulate'

// Balance targets (docs/SPEC.md §5): doing nothing falls short, clicking
// around rarely wins, and a player who reads the previews usually does.
// If a content change moves these, re-tune rather than loosening the bands.

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1)
const SLOW = { timeout: 60_000 }

describe('balance', () => {
  it('never approves a player who does nothing', SLOW, () => {
    const r = report(idle, SEEDS)
    expect(r.approved).toBe(0)
    expect(r.median).toBeGreaterThanOrEqual(275_000)
    expect(r.median).toBeLessThanOrEqual(300_000)
  })

  it('rarely approves random play', SLOW, () => {
    const r = report(random, SEEDS)
    expect(r.approved).toBeGreaterThanOrEqual(0.08)
    expect(r.approved).toBeLessThanOrEqual(0.35)
  })

  it('usually approves a player who reads the previews, inside the $310k–$365k range', SLOW, () => {
    const r = report(greedy, SEEDS)
    expect(r.approved).toBeGreaterThanOrEqual(0.7)
    expect(r.approved).toBeLessThanOrEqual(0.95)
    expect(r.median).toBeGreaterThanOrEqual(310_000)
    expect(r.median).toBeLessThanOrEqual(365_000)
  })

  // Run with BALANCE_REPORT=1 to print the full table while tuning. Read through
  // globalThis because the app's tsconfig (which covers tests) has no Node types.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  it.runIf(env?.BALANCE_REPORT)('prints the report', { timeout: 120_000 }, () => {
    console.table({ idle: report(idle, SEEDS), random: report(random, SEEDS), greedy: report(greedy, SEEDS) })
  })
})
