import { describe, expect, it } from 'vitest'
import { EVENTS } from '../../data/events'
import { diffSnapshots, previewCard, previewChoice, previewEndMonth, snapshot, type Delta } from '../preview'
import { applyCard, startState } from './helpers'

const find = (deltas: Delta[], stat: Delta['stat']) => deltas.find((d) => d.stat === stat)

describe('preview', () => {
  it('matches what actually happens when the card is played', () => {
    const state = startState()
    const deltas = previewCard(state, 'pay_card_1k')
    const after = snapshot(applyCard(state, 'pay_card_1k'))
    for (const delta of deltas) expect(delta.after).toBe(after[delta.stat])
  })

  it('shows paying down cards as a better score and less cash', () => {
    // $2,500 takes utilization from 75% to 33%, crossing into the next band.
    const deltas = previewCard(startState(), 'balance_blitz')
    expect(find(deltas, 'score')?.good).toBe(true)
    expect(find(deltas, 'cash')?.good).toBe(false)
    expect(find(deltas, 'utilization')?.good).toBe(true)
  })

  it('shows no score change when a payment stays inside a utilization band', () => {
    // $1,000 only takes utilization from 75% to 58%: same 50–75% band.
    expect(find(previewCard(startState(), 'pay_card_1k'), 'score')).toBeUndefined()
  })

  it('shows the side gig adding savings without moving max price', () => {
    const deltas = previewCard(startState(), 'side_gig')
    expect(find(deltas, 'monthlySavings')?.good).toBe(true)
    expect(find(deltas, 'maxPrice')?.good).toBeNull()
    expect(find(deltas, 'dti')).toBeUndefined()
  })

  it('previews the success case of a chance card without touching real state', () => {
    const state = startState()
    const deltas = previewCard(state, 'ask_raise')
    expect(find(deltas, 'dti')?.good).toBe(true)
    expect(state.grossMonthlyIncome).toBe(7_500)
  })

  it('shows closing the oldest card as a denial', () => {
    expect(find(previewCard(startState(), 'close_old'), 'maxPrice')?.after).toBe(0)
  })

  it('previews each event choice separately', () => {
    const [cash, card] = EVENTS.medical.choices!
    expect(find(previewChoice(startState(), cash), 'cash')?.after).toBe(22_000 - 1_200)
    expect(find(previewChoice(startState(), card), 'utilization')?.good).toBe(false)
  })

  it('previews end-of-month card interest as a cash cost', () => {
    const state = { ...startState(), event: { eventId: 'quiet' as const, resolved: true } }
    const deltas = previewEndMonth(state)
    expect(find(deltas, 'cash')?.after).toBeCloseTo(state.cash - 90)
    expect(find(deltas, 'utilization')).toBeUndefined()
  })

  it('always includes max price but drops stats that did not move', () => {
    const same = snapshot(startState())
    expect(diffSnapshots(same, same)).toEqual([
      { stat: 'maxPrice', before: same.maxPrice, after: same.maxPrice, good: null },
    ])
  })
})
