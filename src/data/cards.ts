import { utilization } from '../engine/credit'
import {
  addAccount,
  addLog,
  findAccount,
  isOpen,
  payDownCards,
  totalCardBalance,
  updateAccount,
} from '../engine/effects'
import { formatMoney } from '../engine/format'
import { chance } from '../engine/rng'
import type { CardId, Effect, PlayerState } from '../engine/types'

// Every financial move the player can make. See docs/SPEC.md §8.
// Content lives here as data; the reducer only knows how to play "a card".

export type CardDef = {
  id: CardId
  name: string
  cost: 1 | 2
  /** Copies in the starting deck. 0 means the card only appears in the monthly draft. */
  copies: 0 | 1 | 2
  /** How often the draft offers it, relative to other cards. 0 means never. Defaults to 1. */
  draftWeight?: number
  /** Removed from the game after being played instead of going to the discard pile. */
  once: boolean
  /** Chance of success for cards with a random outcome. Previews show the success case. */
  odds?: number
  description: string
  /** Shown on the result screen if the player played this card. */
  lesson?: string
  /** Why the card can't be played right now, or null if it can. */
  unavailable?: (state: PlayerState) => string | null
  /**
   * Cards the player sizes with a slider. The reducer clamps the chosen amount
   * to [min, max] in steps, and to `limit` (what the player can put in now).
   */
  amount?: {
    min: number
    max: number
    step: number
    initial: number
    limit: (state: PlayerState) => number
    /** Mark where card utilization crosses 30% and 10% on the slider. */
    utilizationMarks?: boolean
  }
  play: Effect
}

const RAISE_ODDS = 0.5
const DISPUTE_ODDS = 0.4

const needsCash = (amount: number) => (state: PlayerState) =>
  state.cash < amount ? `Needs ${formatMoney(amount)} in cash` : null

const needsOpen = (id: string, label: string) => (state: PlayerState) =>
  isOpen(state, id) ? null : `${label} is already closed`

const needsCardBalance = (state: PlayerState) =>
  totalCardBalance(state) < 1 ? 'Your cards are already paid off' : null

const first = (...checks: ((state: PlayerState) => string | null)[]) => (state: PlayerState) =>
  checks.reduce<string | null>((reason, check) => reason ?? check(state), null)

// Draft-only cards are offered a little more often than starting cards, so new ideas show up.
const DRAFT_ONLY = { copies: 0, draftWeight: 1.5 } as const

export const CARDS: Record<CardId, CardDef> = {
  pay_cards: {
    id: 'pay_cards',
    name: 'Pay Down Cards',
    cost: 1,
    copies: 2,
    once: false,
    description: 'Choose how much to put toward your card balances.',
    lesson: 'Utilization is about 30% of your score and it updates every month.',
    unavailable: first(needsCardBalance, needsCash(100)),
    amount: {
      min: 100,
      max: 2_000,
      step: 100,
      initial: 1_000,
      limit: (state) => Math.min(state.cash, totalCardBalance(state)),
      utilizationMarks: true,
    },
    play: (state, _rng, amount = 1_000) => {
      const after = payDownCards(state, amount)
      const pct = Math.round(utilization(after) * 100)
      return addLog(after, `Paid ${formatMoney(state.cash - after.cash)} off your cards. Utilization is now ${pct}%.`)
    },
  },
  balance_blitz: {
    id: 'balance_blitz',
    name: 'Balance Blitz',
    cost: 2,
    copies: 1,
    once: false,
    description: 'Go big on your card balances, split across every card.',
    lesson: 'Getting under 30% utilization, then under 10%, unlocks big score jumps.',
    unavailable: first(needsCardBalance, needsCash(1_000)),
    amount: {
      min: 1_000,
      max: 5_000,
      step: 100,
      initial: 2_500,
      limit: (state) => Math.min(state.cash, totalCardBalance(state)),
      utilizationMarks: true,
    },
    play: (state, _rng, amount = 2_500) => {
      const after = payDownCards(state, amount)
      const pct = Math.round(utilization(after) * 100)
      return addLog(after, `Blitzed ${formatMoney(state.cash - after.cash)} into your cards. Utilization is now ${pct}%.`)
    },
  },
  extra_car: {
    id: 'extra_car',
    name: 'Extra Car Payment',
    cost: 1,
    copies: 1,
    once: false,
    description: 'Choose how much extra to pay on the car loan.',
    lesson: "Lowering a loan balance doesn't lower your DTI. Lenders count the monthly payment.",
    unavailable: first(needsOpen('car', 'The car loan'), needsCash(500)),
    amount: {
      min: 500,
      max: 3_000,
      step: 100,
      initial: 1_500,
      limit: (state) => Math.min(state.cash, findAccount(state, 'car')?.balance ?? 0),
    },
    play: (state, _rng, amount = 1_500) => {
      const car = findAccount(state, 'car')!
      const paid = Math.min(amount, car.balance)
      return addLog(
        updateAccount({ ...state, cash: state.cash - paid }, 'car', { balance: car.balance - paid }),
        `Paid an extra ${formatMoney(paid)} on the car. The monthly payment is still the same.`,
      )
    },
  },
  pay_off_car: {
    id: 'pay_off_car',
    name: 'Pay Off the Car',
    cost: 2,
    copies: 1,
    once: true,
    description: 'Pay the whole car loan balance and close it.',
    lesson: 'Removing a monthly payment frees DTI room for a housing payment.',
    unavailable: (state) => {
      const car = findAccount(state, 'car')
      if (!car?.open) return 'The car loan is already closed'
      return needsCash(car.balance)(state)
    },
    play: (state) => {
      const car = findAccount(state, 'car')!
      return addLog(
        updateAccount({ ...state, cash: state.cash - car.balance }, 'car', { balance: 0, open: false }),
        `Paid off the car for ${formatMoney(car.balance)}. That's ${formatMoney(car.monthlyPayment ?? 0)} a month off your DTI.`,
      )
    },
  },
  side_gig: {
    id: 'side_gig',
    name: 'Start a Side Gig',
    cost: 1,
    copies: 1,
    once: true,
    description: 'Earn $400 a month delivering on weekends. It costs 1 energy every month after.',
    lesson: 'Lenders usually want about 2 years of history before they count new side income.',
    play: (state) =>
      addLog(
        { ...state, unverifiedIncome: state.unverifiedIncome + 400, flags: { ...state.flags, sideGig: true } },
        "Started a side gig: +$400 a month in cash. A lender won't count it yet.",
      ),
  },
  ask_raise: {
    id: 'ask_raise',
    name: 'Ask for a Raise',
    cost: 1,
    copies: 1,
    once: true,
    description: 'Your employer might say yes to a 5% raise.',
    lesson: 'A raise from the same employer counts toward your income right away.',
    odds: RAISE_ODDS,
    play: (state, rng) => {
      if (!chance(rng, RAISE_ODDS)) return addLog(state, 'You asked for a raise. Not this year.')
      const income = state.grossMonthlyIncome * 1.05
      return addLog(
        { ...state, grossMonthlyIncome: income },
        `Raise approved! Verified income is now ${formatMoney(income * 12)} a year.`,
      )
    },
  },
  limit_increase: {
    id: 'limit_increase',
    name: 'Request Limit Increase',
    cost: 1,
    copies: 1,
    once: true,
    description: 'Ask for $3,000 more credit on Old Faithful Visa. The issuer does a hard inquiry.',
    lesson: 'More available credit lowers utilization without paying anything.',
    unavailable: needsOpen('old_faithful', 'Old Faithful Visa'),
    play: (state) => {
      const card = findAccount(state, 'old_faithful')!
      return addLog(
        updateAccount({ ...state, hardInquiries: state.hardInquiries + 1 }, card.id, { limit: (card.limit ?? 0) + 3_000 }),
        'Old Faithful Visa limit raised by $3,000, after a hard inquiry.',
      )
    },
  },
  store_card: {
    id: 'store_card',
    name: 'Store Card Bonus',
    cost: 1,
    copies: 1,
    once: false,
    description: 'Open a store card and get a $200 sign-up bonus.',
    lesson: 'Every new account costs a hard inquiry and lowers your average account age.',
    play: (state) =>
      addLog(
        addAccount(
          { ...state, cash: state.cash + 200, hardInquiries: state.hardInquiries + 1 },
          { kind: 'revolving', name: 'Store Card', ageYears: 0, balance: 0, limit: 1_500 },
        ),
        'Opened a store card: +$200, one hard inquiry and a brand-new account.',
      ),
  },
  close_old: {
    id: 'close_old',
    name: 'Close Your Oldest Card',
    cost: 1,
    copies: 1,
    once: true,
    description: 'Close Old Faithful Visa. Its balance moves to your Rewards Card.',
    lesson: 'Closing an old card shortens your credit history and raises utilization.',
    unavailable: needsOpen('old_faithful', 'Old Faithful Visa'),
    play: (state) => {
      const old = findAccount(state, 'old_faithful')!
      const rewards = findAccount(state, 'rewards')!
      const closed = updateAccount(state, old.id, { open: false, balance: 0 })
      return addLog(
        updateAccount(closed, rewards.id, { balance: rewards.balance + old.balance }),
        'Closed Old Faithful Visa. Your oldest account no longer counts toward your history.',
      )
    },
  },
  meal_prep: {
    id: 'meal_prep',
    name: 'Meal Prep Month',
    cost: 1,
    copies: 1,
    once: false,
    description: 'Cook at home all month and save $400.',
    lesson: 'Cash covers your down payment, closing costs and the reserves a lender wants to see.',
    play: (state) => addLog({ ...state, cash: state.cash + 400 }, 'Meal prepped all month: +$400.'),
  },
  sell_stuff: {
    id: 'sell_stuff',
    name: 'Sell Unused Stuff',
    cost: 2,
    copies: 0, // offered in the draft
    once: false,
    description: 'Sell the bike, the old console and the bread maker for $600.',
    play: (state) => addLog({ ...state, cash: state.cash + 600 }, 'Sold unused stuff: +$600.'),
  },
  cheaper_place: {
    id: 'cheaper_place',
    name: 'Move Somewhere Cheaper',
    cost: 2,
    copies: 1,
    once: true,
    description: 'Pay $800 to move. Save $300 every month after.',
    lesson: 'Recurring savings compound over the year.',
    unavailable: needsCash(800),
    play: (state) =>
      addLog(
        { ...state, cash: state.cash - 800, monthlySurplus: state.monthlySurplus + 300 },
        'Moved somewhere cheaper: -$800 now, +$300 every month.',
      ),
  },
  autopay: {
    id: 'autopay',
    name: 'Set Up Autopay',
    cost: 1,
    copies: 1,
    once: true,
    description: 'Never miss a minimum payment again, even in a tight month.',
    lesson: 'Payment history is the largest part of your credit score.',
    play: (state) =>
      addLog({ ...state, flags: { ...state.flags, autopay: true } }, 'Autopay is on. No more missed payments.'),
  },
  dispute: {
    id: 'dispute',
    name: 'Dispute a Report Error',
    cost: 1,
    copies: 1,
    once: true,
    description: 'Your missed payment might be a reporting error. If so, it comes off your report.',
    lesson: 'Credit reports contain errors, and checking yours is free.',
    odds: DISPUTE_ODDS,
    unavailable: (state) => (state.missedPayments === 0 ? 'No missed payments to dispute' : null),
    play: (state, rng) => {
      if (!chance(rng, DISPUTE_ODDS)) return addLog(state, 'Dispute filed. The bureau says the missed payment stands.')
      return addLog(
        { ...state, missedPayments: state.missedPayments - 1 },
        'Dispute won! The missed payment is off your report.',
      )
    },
  },
  consolidate: {
    id: 'consolidate',
    name: 'Personal Loan Consolidation',
    cost: 1,
    copies: 1,
    once: true,
    description: 'Move all card balances into a new personal loan at 4% of the balance per month.',
    lesson: 'Consolidating can help utilization, but it adds a monthly payment and an inquiry.',
    unavailable: needsCardBalance,
    play: (state) => {
      const balance = totalCardBalance(state)
      const cleared: PlayerState = {
        ...state,
        hardInquiries: state.hardInquiries + 1,
        accounts: state.accounts.map((a) => (a.open && a.kind === 'revolving' ? { ...a, balance: 0 } : a)),
      }
      return addLog(
        addAccount(cleared, {
          kind: 'installment',
          name: 'Personal Loan',
          ageYears: 0,
          balance,
          monthlyPayment: balance * 0.04,
        }),
        `Consolidated ${formatMoney(balance)} into a personal loan at ${formatMoney(balance * 0.04)} a month.`,
      )
    },
  },

  // Draft-only cards: each brings in an idea the starting deck doesn't teach.
  gift_funds: {
    id: 'gift_funds',
    name: 'Family Gift Letter',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Your parents chip in $2,000 and sign a gift letter for the lender.',
    lesson: 'Gift money can go toward a down payment if it is documented with a gift letter.',
    play: (state) => addLog({ ...state, cash: state.cash + 2_000 }, 'Family gift: +$2,000, documented with a gift letter.'),
  },
  balance_transfer: {
    id: 'balance_transfer',
    name: '0% Balance Transfer',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Move every card balance to a new $6,000 card at 0% for the rest of the year. 3% fee, one hard inquiry.',
    lesson: 'A 0% transfer stops interest and adds available credit, but it costs a fee, an inquiry and a new account.',
    unavailable: needsCardBalance,
    play: (state) => {
      const moved = totalCardBalance(state)
      const fee = moved * 0.03
      const cleared: PlayerState = {
        ...state,
        cash: state.cash - fee,
        hardInquiries: state.hardInquiries + 1,
        accounts: state.accounts.map((a) => (a.open && a.kind === 'revolving' ? { ...a, balance: 0 } : a)),
      }
      return addLog(
        addAccount(cleared, {
          kind: 'revolving',
          name: 'Balance Transfer Card',
          ageYears: 0,
          balance: moved,
          limit: 6_000,
          interestRate: 0,
        }),
        `Moved ${formatMoney(moved)} to a 0% card for a ${formatMoney(fee)} fee.`,
      )
    },
  },
  overtime: {
    id: 'overtime',
    name: 'Pick Up Overtime',
    cost: 2,
    ...DRAFT_ONLY,
    once: false,
    description: 'Work extra shifts this month for $800.',
    lesson: 'Overtime adds cash, but lenders usually want about two years of it before they count it as income.',
    play: (state) => addLog({ ...state, cash: state.cash + 800 }, 'Picked up overtime: +$800 cash, not counted as income.'),
  },
  negotiate_apr: {
    id: 'negotiate_apr',
    name: 'Call to Lower Your APR',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Ask your card issuers for a lower rate. Card interest drops from 2% to 1% a month.',
    lesson: "Card interest is a cost you can negotiate. Asking is free and doesn't touch your credit score.",
    unavailable: (state) => (state.flags.lowerApr ? 'Your rate is already lowered' : null),
    play: (state) =>
      addLog({ ...state, flags: { ...state.flags, lowerApr: true } }, 'Your card issuers cut your rate in half.'),
  },
  income_driven: {
    id: 'income_driven',
    name: 'Income-Driven Student Loan Plan',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Switch your student loan to an income-driven plan. The payment drops from $250 to $150.',
    lesson: 'Lenders count the payment on your credit report, so a lower required payment can lower DTI. Rules vary by loan type.',
    unavailable: needsOpen('student', 'The student loan'),
    play: (state) =>
      addLog(updateAccount(state, 'student', { monthlyPayment: 150 }), 'Student loan payment cut to $150 a month.'),
  },
  // Renting now, buying soon: cards tied to the move from renter to owner.
  report_rent: {
    id: 'report_rent',
    name: 'Report Your Rent',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Sign up for a service that reports your on-time rent to the credit bureaus.',
    lesson: 'Renters can build credit history with the rent they already pay.',
    play: (state) =>
      addLog({ ...state, flags: { ...state.flags, rentReporting: true } }, 'Your rent payments now count toward your credit history.'),
  },
  roommate: {
    id: 'roommate',
    name: 'Get a Roommate',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Split the rent and save $500 a month. Sharing a place costs 1 energy every month after.',
    lesson: 'Rent is usually your biggest bill, so cutting it is the fastest way to save a down payment.',
    play: (state) =>
      addLog(
        { ...state, monthlySurplus: state.monthlySurplus + 500, flags: { ...state.flags, roommate: true } },
        'Got a roommate: +$500 a month, a little less free time.',
      ),
  },
  shop_lenders: {
    id: 'shop_lenders',
    name: 'Shop 3 Lenders',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Compare quotes from three lenders. Your rate drops 0.125%. Mortgage inquiries close together count as one.',
    lesson: 'Comparing lenders saves money, and rate shopping in a short window only counts as one inquiry.',
    play: (state) =>
      addLog({ ...state, baseRate: state.baseRate - 0.125 }, 'Shopped three lenders and found a rate 0.125% lower.'),
  },
  lock_rate: {
    id: 'lock_rate',
    name: 'Lock Your Rate',
    cost: 1,
    ...DRAFT_ONLY,
    once: true,
    description: 'Pay $500 so that rate rises no longer affect you this year.',
    lesson: 'Rates move while you shop. A rate lock is insurance: you pay a little to avoid a bigger surprise.',
    unavailable: needsCash(500),
    play: (state) =>
      addLog({ ...state, cash: state.cash - 500, flags: { ...state.flags, rateLocked: true } }, 'Locked your rate for $500.'),
  },
  buyer_grant: {
    id: 'buyer_grant',
    name: 'First-Time Buyer Grant',
    cost: 2,
    ...DRAFT_ONLY,
    once: true,
    description: 'Apply to a local down-payment assistance program for $4,000. The paperwork takes 2 energy.',
    lesson: 'Many areas offer down-payment help for first-time buyers, and many buyers never ask.',
    play: (state) => addLog({ ...state, cash: state.cash + 4_000 }, 'Approved for a $4,000 first-time buyer grant.'),
  },
}

/** The starting deck: one entry per copy. */
export function buildDeck(): CardId[] {
  return Object.values(CARDS).flatMap((card) => Array<CardId>(card.copies).fill(card.id))
}
