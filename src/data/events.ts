import { addAccount, addLog, findAccount, payWithCard, updateAccount } from '../engine/effects'
import { formatMoney } from '../engine/format'
import type { Effect, EventId, PlayerState } from '../engine/types'

// Life events, one per month. See docs/SPEC.md §9.
// An event either applies automatically (`effect`) or makes the player pick
// one of its `choices` before they can play cards that month.

export type EventChoice = {
  id: string
  label: string
  description: string
  apply: Effect
}

export type EventDef = {
  id: EventId
  name: string
  description: string
  weight: number
  /** Inclusive month window the event can appear in. Defaults to the whole year. */
  months?: [number, number]
  /** Shown on the result screen if the player hit this event. */
  lesson?: string
} & ({ effect: Effect; choices?: never } | { choices: EventChoice[]; effect?: never })

const payCash = (amount: number, text: string) => (state: PlayerState) =>
  addLog({ ...state, cash: state.cash - amount }, text)

const payCard = (amount: number, text: string) => (state: PlayerState) => addLog(payWithCard(state, amount), text)

const nothing = (text: string) => (state: PlayerState) => addLog(state, text)

export const EVENTS: Record<EventId, EventDef> = {
  quiet: {
    id: 'quiet',
    name: 'Quiet Month',
    description: 'Nothing unexpected happened. Enjoy it.',
    weight: 2,
    effect: nothing('A quiet month.'),
  },
  rent_hike: {
    id: 'rent_hike',
    name: 'Rent Goes Up',
    description: 'Your landlord raised the rent by $150 a month.',
    weight: 1,
    effect: (state) =>
      addLog({ ...state, monthlySurplus: state.monthlySurplus - 150 }, 'Rent went up: -$150 every month.'),
  },
  medical: {
    id: 'medical',
    name: 'Urgent Care Bill',
    description: 'A sprained ankle came with a $1,200 bill.',
    weight: 1,
    choices: [
      {
        id: 'cash',
        label: 'Pay $1,200 cash',
        description: 'Your savings take the hit.',
        apply: payCash(1_200, 'Paid the $1,200 urgent care bill in cash.'),
      },
      {
        id: 'card',
        label: 'Put it on a card',
        description: 'Savings stay put, but your card balance grows.',
        apply: payCard(1_200, 'Put the $1,200 urgent care bill on a card.'),
      },
    ],
  },
  car_trouble: {
    id: 'car_trouble',
    name: 'Car Breaks Down',
    description: 'The transmission is going. Repair it for $2,500 or replace the car.',
    weight: 1,
    lesson: 'A new car payment right before you apply eats directly into the house you can afford.',
    choices: [
      {
        id: 'cash',
        label: 'Repair with cash',
        description: '$2,500 out of savings.',
        apply: payCash(2_500, 'Paid $2,500 in cash to repair the car.'),
      },
      {
        id: 'card',
        label: 'Repair on a card',
        description: '$2,500 onto your cards.',
        apply: payCard(2_500, 'Put the $2,500 car repair on a card.'),
      },
      {
        id: 'finance',
        label: 'Finance a newer car',
        description: 'Trade in the old one. New loan at $450 a month, plus a hard inquiry.',
        // The trade-in pays off the old loan, so the new $450 replaces its payment.
        apply: (state) => {
          const traded = findAccount(state, 'car')?.open
            ? updateAccount(state, 'car', { open: false, balance: 0 })
            : state
          return addLog(
            addAccount(
              { ...traded, hardInquiries: traded.hardInquiries + 1 },
              { kind: 'installment', name: 'New Car Loan', ageYears: 0, balance: 25_000, monthlyPayment: 450 },
            ),
            'Financed a newer car: $450 a month and one hard inquiry.',
          )
        },
      },
    ],
  },
  prices_up: {
    id: 'prices_up',
    name: 'Home Prices Climb',
    description: 'Starter homes in your area got 3% more expensive.',
    weight: 1,
    effect: (state) => {
      const targetPrice = Math.round(state.targetPrice * 1.03)
      return addLog({ ...state, targetPrice }, `Home prices rose 3%. Your target is now ${formatMoney(targetPrice)}.`)
    },
  },
  rates_up: {
    id: 'rates_up',
    name: 'Rates Tick Up',
    description: 'Mortgage rates rose a quarter point.',
    weight: 1,
    effect: (state) => {
      const baseRate = state.baseRate + 0.25
      return addLog({ ...state, baseRate }, `Mortgage rates rose to a base of ${baseRate.toFixed(2)}%.`)
    },
  },
  rates_down: {
    id: 'rates_down',
    name: 'Rates Ease',
    description: 'Mortgage rates fell a quarter point.',
    weight: 1,
    effect: (state) => {
      const baseRate = state.baseRate - 0.25
      return addLog({ ...state, baseRate }, `Mortgage rates eased to a base of ${baseRate.toFixed(2)}%.`)
    },
  },
  tax_refund: {
    id: 'tax_refund',
    name: 'Tax Refund',
    description: 'You got $1,500 back from taxes.',
    weight: 1,
    effect: (state) => addLog({ ...state, cash: state.cash + 1_500 }, 'Tax refund: +$1,500.'),
  },
  bonus: {
    id: 'bonus',
    name: 'Work Bonus',
    description: 'Your team hit its goals. $2,000 bonus.',
    weight: 1,
    effect: (state) => addLog({ ...state, cash: state.cash + 2_000 }, 'Work bonus: +$2,000.'),
  },
  wedding: {
    id: 'wedding',
    name: "Friend's Wedding",
    description: 'Your college roommate is getting married out of state. Travel and a gift run $800.',
    weight: 1,
    choices: [
      {
        id: 'go',
        label: 'Go ($800)',
        description: 'Some things are worth it.',
        apply: payCash(800, "Went to the wedding. -$800, and a great weekend."),
      },
      {
        id: 'skip',
        label: 'Skip it',
        description: 'Keep the $800. Missing it wears on you: 1 less energy next month.',
        apply: (state) =>
          addLog({ ...state, flags: { ...state.flags, burnout: true } }, 'Skipped the wedding. Kept the $800, but next month you have 1 less energy.'),
      },
    ],
  },
  card_offer: {
    id: 'card_offer',
    name: 'Pre-Approved Offer',
    description: 'A bank mailed you a pre-approved card with a $5,000 limit.',
    weight: 1,
    lesson: 'A new card adds available credit but costs an inquiry and lowers your average account age.',
    choices: [
      {
        id: 'accept',
        label: 'Accept',
        description: 'New $5,000 card, plus a hard inquiry and a brand-new account.',
        apply: (state) =>
          addLog(
            addAccount(
              { ...state, hardInquiries: state.hardInquiries + 1 },
              { kind: 'revolving', name: 'Pre-Approved Card', ageYears: 0, balance: 0, limit: 5_000 },
            ),
            'Accepted the pre-approved card: +$5,000 limit, one hard inquiry.',
          ),
      },
      {
        id: 'decline',
        label: 'Decline',
        description: 'Into the shredder.',
        apply: nothing('Declined the pre-approved card offer.'),
      },
    ],
  },
  furniture_promo: {
    id: 'furniture_promo',
    name: 'Your Bed Breaks',
    description: 'You need a new bed and sofa: $2,400. The store offers 0% for 20 months.',
    weight: 1,
    months: [8, 12],
    lesson: "New credit right before you apply shows up as a payment and an inquiry. Paying cash costs savings instead. Which hurts less depends on what's holding you back.",
    choices: [
      {
        id: 'cash',
        label: 'Pay $2,400 cash',
        description: 'No new debt, but your down payment shrinks.',
        apply: payCash(2_400, 'Paid $2,400 cash for furniture.'),
      },
      {
        id: 'finance',
        label: 'Finance at 0%',
        description: 'Keep your cash. New $120-a-month loan, plus a hard inquiry.',
        apply: (state) =>
          addLog(
            addAccount(
              { ...state, hardInquiries: state.hardInquiries + 1 },
              { kind: 'installment', name: 'Furniture Loan', ageYears: 0, balance: 2_400, monthlyPayment: 120 },
            ),
            'Financed furniture: $120 a month and one hard inquiry.',
          ),
      },
    ],
  },
}

export const ALL_EVENTS: EventDef[] = Object.values(EVENTS)
