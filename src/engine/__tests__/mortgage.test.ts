import { describe, expect, it } from 'vitest'
import {
  creditAdjustment,
  downPaymentAdjustment,
  monthlyPrincipalAndInterest,
  piti,
  rateFor,
  totalInterest,
} from '../mortgage'

describe('monthlyPrincipalAndInterest', () => {
  it('matches a standard amortization table', () => {
    // $300k at 6% over 30 years is a well-known $1,798.65.
    expect(monthlyPrincipalAndInterest(300_000, 6)).toBeCloseTo(1_798.65, 2)
  })

  it('handles a 0% rate', () => {
    expect(monthlyPrincipalAndInterest(360_000, 0)).toBe(1_000)
  })
})

describe('piti', () => {
  it('adds PMI below 20% down', () => {
    const payment = piti(300_000, 0.1, 6)
    expect(payment.taxesAndInsurance).toBeCloseTo(450)
    expect(payment.pmi).toBeCloseTo((270_000 * 0.007) / 12)
    expect(payment.total).toBeCloseTo(
      payment.principalAndInterest + payment.taxesAndInsurance + payment.pmi,
    )
  })

  it('drops PMI at 20% down', () => {
    expect(piti(300_000, 0.2, 6).pmi).toBe(0)
  })
})

describe('totalInterest', () => {
  it('is every payment minus the amount borrowed', () => {
    expect(totalInterest(300_000, 6)).toBeCloseTo(1_798.65 * 360 - 300_000, -1)
  })
})

describe('rate tiers', () => {
  it('prices credit at each score boundary', () => {
    expect(creditAdjustment(850)).toBe(0)
    expect(creditAdjustment(760)).toBe(0)
    expect(creditAdjustment(759)).toBe(0.125)
    expect(creditAdjustment(700)).toBe(0.375)
    expect(creditAdjustment(659)).toBe(1.0)
    expect(creditAdjustment(620)).toBe(1.25)
  })

  it('prices the down payment at each boundary', () => {
    expect(downPaymentAdjustment(0.2)).toBe(0)
    expect(downPaymentAdjustment(0.1999)).toBe(0.125)
    expect(downPaymentAdjustment(0.1)).toBe(0.125)
    expect(downPaymentAdjustment(0.0999)).toBe(0.25)
    expect(downPaymentAdjustment(0.03)).toBe(0.25)
  })

  it('builds the rate as base + credit + down payment', () => {
    expect(rateFor(6.25, 656, 0.05)).toEqual({ base: 6.25, credit: 1.0, downPayment: 0.25, total: 7.5 })
  })
})
