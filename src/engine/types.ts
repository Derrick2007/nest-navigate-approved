// Core game state types. See docs/SPEC.md §4.
// Derived numbers (score, utilization, DTI, underwriting) are never stored
// here; they are computed from this state by pure functions.

export type AccountKind = 'revolving' | 'installment'

export type Account = {
  id: string
  kind: AccountKind
  name: string
  ageYears: number // grows by 1/12 each month
  balance: number
  limit?: number // revolving only
  // Installment only. A revolving card's minimum payment is derived from its
  // balance (see accountPayment in underwrite.ts) so it can never go stale.
  monthlyPayment?: number
  open: boolean
}

// Narrowed to a union of real card ids once src/data/cards.ts exists (milestone 3).
export type CardId = string

export type EventInstance = {
  eventId: string
}

export type LogEntry = {
  month: number
  text: string
}

export type PlayerState = {
  month: number // 1..12
  cash: number
  grossMonthlyIncome: number // only verified income, used for DTI
  unverifiedIncome: number // side gig etc.: adds cash but is NOT counted for DTI
  monthlySurplus: number // cash added every paycheck after rent and living costs
  accounts: Account[]
  missedPayments: number
  hardInquiries: number // in the last 12 months
  targetPrice: number
  baseRate: number // percent, e.g. 6.25
  flags: Record<string, boolean>
  energy: number
  hand: CardId[]
  deck: CardId[]
  discard: CardId[]
  pendingEvent?: EventInstance
  log: LogEntry[]
  seed: number
}
