import { describe, expect, it } from 'vitest'
import { accountPayment, borrowerProfile, checkPrice, dti, monthlyDebts, underwrite } from '../underwrite'
import { closeOldestCard, payOffCar, startState } from './helpers'

describe('debts and DTI', () => {
  it('counts 3% of a card balance and the fixed installment payment', () => {
    const [oldFaithful, , car] = startState().accounts
    expect(accountPayment(oldFaithful)).toBe(75)
    expect(accountPayment(car)).toBe(380)
    expect(accountPayment({ ...car, open: false })).toBe(0)
    expect(monthlyDebts(startState())).toBe(765)
  })

  it('never counts unverified side-gig income', () => {
    const withGig = { ...startState(), unverifiedIncome: 600 }
    expect(dti(withGig, 2_000)).toBe(dti(startState(), 2_000))
    expect(underwrite(withGig).maxPrice).toBe(underwrite(startState()).maxPrice)
  })
})

describe('checkPrice', () => {
  it('spends all available cash on closing, reserves and down payment', () => {
    const check = checkPrice(borrowerProfile(startState()), 250_000)
    const spent = check.closingCosts + check.reservesRequired + check.downPayment
    // Under 20% down, every spare dollar goes to the down payment.
    expect(spent).toBeCloseTo(startState().cash, 0)
    expect(check.failReason).toBeNull()
  })

  it('fails on cash when the down payment would be under 3%', () => {
    const check = checkPrice(borrowerProfile({ ...startState(), cash: 5_000 }), 250_000)
    expect(check.failReason).toBe('cash')
  })
})

describe('underwrite', () => {
  it('approves the starting player for less than the target, limited by DTI', () => {
    const result = underwrite(startState())
    expect(result.credit.score).toBe(656)
    expect(result.outcome).toBe('APPROVED_SMALLER')
    expect(result.maxPrice).toBeGreaterThanOrEqual(275_000)
    expect(result.maxPrice).toBeLessThanOrEqual(282_000)
    expect(result.bindingConstraint).toBe('dti')
    expect(result.farBelowTarget).toBe(false)
    // Quoted at the best price they can get, since that is below the target.
    expect(result.quote?.price).toBe(result.maxPrice)
    expect(result.atTarget?.failReason).not.toBeNull()
  })

  it('denies on credit when the oldest card is closed', () => {
    const result = underwrite(closeOldestCard(startState()))
    expect(result.outcome).toBe('DENIED')
    expect(result.denialReason).toBe('credit')
    expect(result.quote).toBeNull()
  })

  it('denies on cash when no price has a 3% down payment', () => {
    const result = underwrite({ ...startState(), cash: 1_000 })
    expect(result.outcome).toBe('DENIED')
    expect(result.denialReason).toBe('cash')
  })

  it('frees DTI room for housing when the car is paid off', () => {
    // Plenty of cash, so only DTI can limit the price.
    const rich = { ...startState(), cash: 200_000 }
    const before = underwrite(rich)
    const after = underwrite(payOffCar(rich))
    expect(monthlyDebts(payOffCar(rich))).toBe(monthlyDebts(rich) - 380)
    expect(after.maxPrice!).toBeGreaterThan(before.maxPrice!)
  })

  it('makes cash the limit when the car is paid off from starting savings', () => {
    // The trade-off the game teaches: the payoff frees DTI but drains the down payment.
    expect(underwrite(payOffCar(startState())).bindingConstraint).toBe('cash')
  })

  it('approves at the target price with enough cash and low debt', () => {
    const result = underwrite({ ...startState(), cash: 80_000, grossMonthlyIncome: 11_000 })
    expect(result.outcome).toBe('APPROVED')
    expect(result.quote?.price).toBe(result.targetPrice)
  })

  it('shows a lower rate and less interest with a score 40 points higher', () => {
    const { quote, whatIf } = underwrite(startState())
    expect(whatIf!.price).toBe(quote!.price)
    expect(whatIf!.rate.total).toBeLessThan(quote!.rate.total)
    expect(whatIf!.totalInterest).toBeLessThan(quote!.totalInterest)
  })
})
