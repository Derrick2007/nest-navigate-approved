import { describe, expect, it } from 'vitest'
import { EVENTS } from '../../data/events'
import { previewChoice } from '../preview'
import { applyCard, startState } from './helpers'

// Design rule: no event choice may be all upside in every situation, or it
// isn't a decision. Checked at the start and mid-year (cards paid down to about
// 30%): a choice may be clearly good in one (e.g. a new card while utilization
// is 75%) as long as it costs something in the other.
describe('event choices are real dilemmas', () => {
  const situations = [startState(), applyCard(applyCard(startState(), 'balance_blitz', 1), 'pay_cards')]
  for (const event of Object.values(EVENTS)) {
    for (const choice of event.choices ?? []) {
      it(`${event.id}:${choice.id} costs something somewhere`, () => {
        const freeEverywhere = situations.every((state) => {
          const deltas = previewChoice(state, choice)
          return deltas.some((d) => d.good === true) && !deltas.some((d) => d.good === false)
        })
        expect(freeEverywhere).toBe(false)
      })
    }
  }
})
