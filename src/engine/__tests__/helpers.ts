import { createInitialState } from '../../data/initialState'
import type { Account, PlayerState } from '../types'

// Hand-written state changes for engine tests. Milestone 3 adds the real card
// effects in src/data/cards.ts; until then these mirror what the cards will do.

export const startState = (): PlayerState => createInitialState(1)

export function updateAccount(state: PlayerState, id: string, change: Partial<Account>): PlayerState {
  return {
    ...state,
    accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...change } : a)),
  }
}

/** "Close Your Oldest Card": Old Faithful closes and its balance moves to the Rewards Card. */
export function closeOldestCard(state: PlayerState): PlayerState {
  const old = state.accounts.find((a) => a.id === 'old_faithful')!
  const rewards = state.accounts.find((a) => a.id === 'rewards')!
  const closed = updateAccount(state, 'old_faithful', { open: false, balance: 0 })
  return updateAccount(closed, 'rewards', { balance: rewards.balance + old.balance })
}

/** "Pay Off the Car": cash pays the balance and the loan closes. */
export function payOffCar(state: PlayerState): PlayerState {
  const car = state.accounts.find((a) => a.id === 'car')!
  return updateAccount({ ...state, cash: state.cash - car.balance }, 'car', { open: false, balance: 0 })
}
