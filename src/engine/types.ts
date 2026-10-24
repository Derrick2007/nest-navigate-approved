import type { Rng } from './rng'

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

// Listed here so engine state can name them; src/data/cards.ts and events.ts
// are typed as Record<Id, Def>, so the compiler fails if a definition is missing.
export type CardId =
  | 'pay_card_1k'
  | 'balance_blitz'
  | 'extra_car'
  | 'pay_off_car'
  | 'side_gig'
  | 'ask_raise'
  | 'limit_increase'
  | 'store_card'
  | 'close_old'
  | 'meal_prep'
  | 'sell_stuff'
  | 'cheaper_place'
  | 'autopay'
  | 'dispute'
  | 'consolidate'

export type EventId =
  | 'quiet'
  | 'rent_hike'
  | 'medical'
  | 'car_trouble'
  | 'prices_up'
  | 'rates_up'
  | 'rates_down'
  | 'tax_refund'
  | 'bonus'
  | 'wedding'
  | 'card_offer'
  | 'furniture_promo'

/** This month's life event. Card play is blocked until it is resolved. */
export type EventInstance = {
  eventId: EventId
  resolved: boolean
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
  // autopay, plus "card:<id>" and "event:<id>:<choice>" markers that the
  // result screen reads to pick lessons from what the player actually did.
  flags: Record<string, boolean>
  energy: number
  hand: CardId[]
  deck: CardId[]
  discard: CardId[]
  event: EventInstance | null
  log: LogEntry[]
  seed: number // the run's seed, for "Replay this seed"
  rngState: number // the generator's current state (see rng.ts)
}

/** How every card and event choice changes the game. Must be pure apart from drawing from rng. */
export type Effect = (state: PlayerState, rng: Rng) => PlayerState
