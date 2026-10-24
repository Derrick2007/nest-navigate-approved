import { utilization } from '../engine/credit'
import {
  addAccount,
  addLog,
  findAccount,
  isOpen,
  openCards,
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
  copies: 1 | 2
  /** Removed from the game after being played instead of going to the discard pile. */
  once: boolean
  /** Chance of success for cards with a random outcome. Previews show the success case. */
  odds?: number
  description: string
  /** Shown on the result screen if the player played this card. */
  lesson?: string
  /** Why the card can't be played right now, or null if it can. */
  unavailable?: (state: PlayerState) => string | null
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

export const CARDS: Record<CardId, CardDef> = {
  pay_card_1k: {
    id: 'pay_card_1k',
    name: 'Pay Down a Card',
    cost: 1,
    copies: 2,
    once: false,
    description: 'Put $1,000 toward the card with the highest utilization.',
    lesson: 'Utilization is about 30% of your score and it updates every month.',
    unavailable: first(needsCardBalance, needsCash(1_000)),
    play: (state) => {
      const card = [...openCards(state)].sort(
        (a, b) => b.balance / (b.limit ?? 1) - a.balance / (a.limit ?? 1),
      )[0]
      const paid = Math.min(1_000, card.balance)
      return addLog(
        updateAccount({ ...state, cash: state.cash - paid }, card.id, { balance: card.balance - paid }),
        `Paid ${formatMoney(paid)} off ${card.name}.`,
      )
    },
  },
  balance_blitz: {
    id: 'balance_blitz',
    name: 'Balance Blitz',
    cost: 2,
    copies: 1,
    once: false,
    description: 'Throw $2,500 at your card balances, split across every card.',
    lesson: 'Getting under 30% utilization, then under 10%, unlocks big score jumps.',
    unavailable: first(needsCardBalance, needsCash(2_500)),
    play: (state) => {
      const after = payDownCards(state, 2_500)
      const pct = Math.round(utilization(after) * 100)
      return addLog(after, `Blitzed your card balances. Utilization is now ${pct}%.`)
    },
  },
  extra_car: {
    id: 'extra_car',
    name: 'Extra Car Payment',
    cost: 1,
    copies: 1,
    once: false,
    description: 'Pay an extra $1,500 toward the car loan.',
    lesson: "Lowering a loan balance doesn't lower your DTI. Lenders count the monthly payment.",
    unavailable: first(needsOpen('car', 'The car loan'), needsCash(1_500)),
    play: (state) => {
      const car = findAccount(state, 'car')!
      const paid = Math.min(1_500, car.balance)
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
    description: 'Earn an extra $600 a month delivering on weekends.',
    lesson: 'Lenders usually want about 2 years of history before they count new side income.',
    play: (state) =>
      addLog(
        { ...state, unverifiedIncome: state.unverifiedIncome + 600 },
        "Started a side gig: +$600 a month in cash. A lender won't count it yet.",
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
    description: 'Ask for $3,000 more credit on Old Faithful Visa.',
    lesson: 'More available credit lowers utilization without paying anything.',
    unavailable: needsOpen('old_faithful', 'Old Faithful Visa'),
    play: (state) => {
      const card = findAccount(state, 'old_faithful')!
      return addLog(
        updateAccount(state, card.id, { limit: (card.limit ?? 0) + 3_000 }),
        'Old Faithful Visa limit raised by $3,000.',
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
    copies: 2,
    once: false,
    description: 'Cook at home all month and save $400.',
    lesson: 'Cash covers your down payment, closing costs and the reserves a lender wants to see.',
    play: (state) => addLog({ ...state, cash: state.cash + 400 }, 'Meal prepped all month: +$400.'),
  },
  sell_stuff: {
    id: 'sell_stuff',
    name: 'Sell Unused Stuff',
    cost: 2,
    copies: 1,
    once: false,
    description: 'Sell the bike, the old console and the bread maker for $900.',
    play: (state) => addLog({ ...state, cash: state.cash + 900 }, 'Sold unused stuff: +$900.'),
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
}

/** The starting deck: one entry per copy. */
export function buildDeck(): CardId[] {
  return Object.values(CARDS).flatMap((card) => Array<CardId>(card.copies).fill(card.id))
}
