import { CARDS } from '../../data/cards'
import { createInitialState } from '../../data/initialState'
import { createRng } from '../rng'
import type { CardId, PlayerState } from '../types'

// The section 5 starting numbers, before month 1's paycheck.
export const startState = (): PlayerState => createInitialState(1)

/** Apply one card's effect directly, skipping energy and hand rules. */
export const applyCard = (state: PlayerState, id: CardId, rngState = 1): PlayerState =>
  CARDS[id].play(state, createRng(rngState))

export const closeOldestCard = (state: PlayerState) => applyCard(state, 'close_old')
export const payOffCar = (state: PlayerState) => applyCard(state, 'pay_off_car')
