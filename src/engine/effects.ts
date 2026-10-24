import type { Account, PlayerState } from './types'

// Small immutable building blocks that card and event effects are made of,
// so src/data stays a readable list of "what happens" rather than plumbing.

export function addLog(state: PlayerState, text: string): PlayerState {
  return { ...state, log: [...state.log, { month: state.month, text }] }
}

export function findAccount(state: PlayerState, id: string): Account | undefined {
  return state.accounts.find((a) => a.id === id)
}

export function isOpen(state: PlayerState, id: string): boolean {
  return findAccount(state, id)?.open ?? false
}

export function updateAccount(state: PlayerState, id: string, change: Partial<Account>): PlayerState {
  return {
    ...state,
    accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...change } : a)),
  }
}

export function addAccount(state: PlayerState, account: Omit<Account, 'id' | 'open'>): PlayerState {
  // Index-based ids stay unique because accounts are closed, never removed.
  const id = `${account.kind}_${state.accounts.length}`
  return { ...state, accounts: [...state.accounts, { ...account, id, open: true }] }
}

export function openCards(state: PlayerState): Account[] {
  return state.accounts.filter((a) => a.open && a.kind === 'revolving')
}

export function totalCardBalance(state: PlayerState): number {
  return openCards(state).reduce((sum, a) => sum + a.balance, 0)
}

export const cardRoom = (card: Account) => Math.max(0, (card.limit ?? 0) - card.balance)

/**
 * Charge an amount to the open card with the most available credit. Whatever
 * does not fit is returned as `unpaid` for the caller to handle.
 */
export function chargeToCard(state: PlayerState, amount: number): { state: PlayerState; unpaid: number } {
  const best = [...openCards(state)].sort((a, b) => cardRoom(b) - cardRoom(a))[0]
  const charged = best ? Math.min(amount, cardRoom(best)) : 0
  if (!best || charged === 0) return { state, unpaid: amount }
  return {
    state: updateAccount(state, best.id, { balance: best.balance + charged }),
    unpaid: amount - charged,
  }
}

/** Pay a bill with a card where possible; any remainder comes out of cash. */
export function payWithCard(state: PlayerState, amount: number): PlayerState {
  const { state: charged, unpaid } = chargeToCard(state, amount)
  return { ...charged, cash: charged.cash - unpaid }
}

/** Pay down card balances in proportion to their size, up to what is owed. */
export function payDownCards(state: PlayerState, amount: number): PlayerState {
  const owed = totalCardBalance(state)
  const paid = Math.min(amount, owed)
  if (paid === 0) return state
  return {
    ...state,
    cash: state.cash - paid,
    accounts: state.accounts.map((a) =>
      a.open && a.kind === 'revolving' ? { ...a, balance: a.balance - (paid * a.balance) / owed } : a,
    ),
  }
}
