import type { PlayerState } from '../engine/types'

// Starting numbers from docs/SPEC.md §5. They are tuned so that doing nothing
// scores 656 and falls short of the target price; keep that when changing them.
export function createInitialState(seed: number): PlayerState {
  return {
    month: 1,
    cash: 22_000,
    grossMonthlyIncome: 7_500,
    unverifiedIncome: 0,
    monthlySurplus: 700,
    accounts: [
      { id: 'old_faithful', kind: 'revolving', name: 'Old Faithful Visa', ageYears: 8, balance: 2_500, limit: 3_000, open: true },
      { id: 'rewards', kind: 'revolving', name: 'Rewards Card', ageYears: 2, balance: 2_000, limit: 3_000, open: true },
      { id: 'car', kind: 'installment', name: 'Car Loan', ageYears: 3, balance: 9_000, monthlyPayment: 380, open: true },
      { id: 'student', kind: 'installment', name: 'Student Loan', ageYears: 6, balance: 24_000, monthlyPayment: 250, open: true },
    ],
    missedPayments: 1,
    hardInquiries: 1,
    targetPrice: 325_000,
    baseRate: 6.25,
    flags: {},
    // The deck is shuffled and month 1 begins in newRun (engine/reducer.ts).
    energy: 0,
    hand: [],
    deck: [],
    discard: [],
    event: null,
    log: [],
    seed,
    rngState: seed,
  }
}
