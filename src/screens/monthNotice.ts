import type { Notice } from '../components/ActionBar'
import { formatMoney } from '../engine/format'
import type { PlayerState } from '../engine/types'

/** The one thing worth saying in the action bar right now, most urgent first. */
export function monthNotice(player: PlayerState, awaitingChoice: boolean, anyPlayable: boolean): Notice | null {
  if (awaitingChoice) return { tone: 'info', text: 'Choose an option for this month’s event first.' }
  if (player.cash < 0) {
    return {
      tone: 'bad',
      text: `You're ${formatMoney(-player.cash)} short. At month end it goes on a card, or counts as a missed payment.`,
    }
  }
  if (player.hand.length > 0 && !anyPlayable) {
    return {
      tone: 'info',
      text: player.energy === 0 ? 'Out of energy for this month.' : 'Nothing else you can do this month.',
    }
  }
  return null
}
