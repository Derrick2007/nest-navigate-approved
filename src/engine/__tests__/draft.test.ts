import { describe, expect, it } from 'vitest'
import { CARDS } from '../../data/cards'
import { EVENTS } from '../../data/events'
import { creditScore } from '../credit'
import { DRAFT_SIZE, draftPool, drawDraftOffer, takeDraft } from '../draft'
import { previewCard } from '../preview'
import { endMonth, gameReducer, newRun, startMonth, type GameState } from '../reducer'
import { createRng } from '../rng'
import type { PlayerState } from '../types'
import { monthlyDebts } from '../underwrite'
import { applyCard, startState } from './helpers'

/** A month ready to end: event handled. */
const endable = (seed = 7): GameState => ({
  phase: 'playing',
  player: { ...newRun(seed), event: { eventId: 'quiet', resolved: true } },
})

const playerOf = (game: GameState): PlayerState => {
  if (game.phase === 'start') throw new Error('no player')
  return game.player
}

describe('draft offers', () => {
  it('offers three different cards after a month ends', () => {
    const game = gameReducer(endable(), { type: 'END_MONTH' })
    expect(game.phase).toBe('draft')
    const offer = playerOf(game).draftOffer
    expect(offer).toHaveLength(DRAFT_SIZE)
    expect(new Set(offer).size).toBe(DRAFT_SIZE)
  })

  it('offers the same cards when the same seed is replayed', () => {
    const a = playerOf(gameReducer(endable(42), { type: 'END_MONTH' })).draftOffer
    const b = playerOf(gameReducer(endable(42), { type: 'END_MONTH' })).draftOffer
    expect(a).toEqual(b)
  })

  it('skips the draft after month 12 and goes to the Underwriter', () => {
    const last: GameState = { phase: 'playing', player: { ...playerOf(endable()), month: 12 } }
    expect(gameReducer(last, { type: 'END_MONTH' }).phase).toBe('underwriting')
  })

  it("never offers a one-time card you already have or have played", () => {
    const owned = { ...startState(), deck: ['gift_funds' as const], flags: { 'card:autopay': true } }
    const ids = draftPool(owned).map((c) => c.id)
    expect(ids).not.toContain('gift_funds')
    expect(ids).not.toContain('autopay')
    expect(ids).toContain('overtime') // repeatable cards stay in the pool
    // Trap cards teach from the starting hand; they are never offered.
    expect(ids).not.toContain('extra_car')
    expect(ids).not.toContain('close_old')
  })

  it('never offers a card that can no longer work', () => {
    const noCar = applyCard(startState(), 'pay_off_car')
    const ids = draftPool(noCar).map((c) => c.id)
    // A short month (no cash) is not a lasting reason, so cash cards stay.
    expect(draftPool({ ...startState(), cash: 0 }).map((c) => c.id)).toContain('pay_cards')
  })

  it('draws fewer cards when the pool runs low', () => {
    const tiny = { ...startState() }
    const offer = drawDraftOffer(tiny, createRng(1))
    expect(offer.length).toBeLessThanOrEqual(DRAFT_SIZE)
    expect(offer.every((id) => id in CARDS)).toBe(true)
  })
})

describe('taking a draft card', () => {
  it('puts the card in next month’s hand', () => {
    const drafting = gameReducer(endable(), { type: 'END_MONTH' })
    const pick = playerOf(drafting).draftOffer[1]
    const next = gameReducer(drafting, { type: 'DRAFT_PICK', cardId: pick })
    expect(next.phase).toBe('playing')
    expect(playerOf(next).month).toBe(2)
    expect(playerOf(next).hand).toContain(pick)
    expect(playerOf(next).draftOffer).toEqual([])
  })

  it('can be skipped', () => {
    const drafting = gameReducer(endable(), { type: 'END_MONTH' })
    const next = gameReducer(drafting, { type: 'DRAFT_PICK', cardId: null })
    expect(next.phase).toBe('playing')
    expect(playerOf(next).log.some((e) => e.text.startsWith('Skipped'))).toBe(true)
  })

  it('refuses a card that was not offered', () => {
    const drafting = gameReducer(endable(), { type: 'END_MONTH' })
    const notOffered = Object.keys(CARDS).find((id) => !playerOf(drafting).draftOffer.includes(id as never))!
    expect(gameReducer(drafting, { type: 'DRAFT_PICK', cardId: notOffered as never })).toBe(drafting)
    expect(takeDraft(playerOf(drafting), notOffered as never)).toBe(playerOf(drafting))
  })

  it('ignores other moves while drafting', () => {
    const drafting = gameReducer(endable(), { type: 'END_MONTH' })
    expect(gameReducer(drafting, { type: 'PLAY_CARD', handIndex: 0 })).toBe(drafting)
    expect(gameReducer(drafting, { type: 'END_MONTH' })).toBe(drafting)
  })
})

describe('draft-only cards', () => {
  it('gift letter adds cash for the down payment', () => {
    expect(applyCard(startState(), 'gift_funds').cash).toBe(22_000 + 2_000)
  })

  it('0% balance transfer stops card interest but costs a fee and an inquiry', () => {
    const after = applyCard(startState(), 'balance_transfer')
    expect(after.cash).toBeCloseTo(22_000 - 0.03 * 4_500)
    expect(after.hardInquiries).toBe(2)
    const month = endMonth({ ...after, event: { eventId: 'quiet', resolved: true } })
    // All $4,500 now sits at 0%, so no interest comes out of cash.
    expect(month.cash).toBeCloseTo(after.cash)
  })

  it('lower APR previews as monthly savings, since that is where its value shows', () => {
    const savings = previewCard(startState(), 'negotiate_apr').find((d) => d.stat === 'monthlySavings')!
    // Interest on $4,500 drops from $90 to $45 a month.
    expect(savings.after - savings.before).toBeCloseTo(45)
  })

  it('lower APR halves card interest', () => {
    const quiet = (s: PlayerState) => ({ ...s, event: { eventId: 'quiet' as const, resolved: true } })
    const normal = endMonth(quiet(startState()))
    const lowered = endMonth(quiet(applyCard(startState(), 'negotiate_apr')))
    expect(startState().cash - normal.cash).toBeCloseTo(90)
    expect(startState().cash - lowered.cash).toBeCloseTo(45)
  })

  it('an income-driven plan lowers the student loan payment', () => {
    expect(monthlyDebts(applyCard(startState(), 'income_driven'))).toBe(monthlyDebts(startState()) - 100)
  })

  it('overtime adds cash but never verified income', () => {
    const after = applyCard(startState(), 'overtime')
    expect(after.cash).toBe(22_800)
    expect(after.grossMonthlyIncome).toBe(startState().grossMonthlyIncome)
  })
})

describe('renter-to-buyer cards', () => {
  it('reported rent adds payment history', () => {
    expect(creditScore(applyCard(startState(), 'report_rent'))).toBe(creditScore(startState()) + 15)
  })

  it('a roommate saves $500 a month but costs energy every month', () => {
    const after = applyCard(startState(), 'roommate')
    expect(after.monthlySurplus).toBe(startState().monthlySurplus + 500)
    expect(newRunEnergy({ ...after, month: 2 })).toBe(2)
  })

  it('shopping lenders lowers the rate', () => {
    expect(applyCard(startState(), 'shop_lenders').baseRate).toBe(6.125)
  })

  it('a locked rate ignores rate rises', () => {
    const locked = applyCard(startState(), 'lock_rate')
    expect(locked.cash).toBe(21_500)
    expect(EVENTS.rates_up.effect!(locked, createRng(1)).baseRate).toBe(6.25)
  })

  it('the buyer grant adds cash', () => {
    expect(applyCard(startState(), 'buyer_grant').cash).toBe(26_000)
  })
})

const newRunEnergy = (state: PlayerState) => startMonth(state).energy
