import { useMemo, useState } from 'react'
import { ActionBar } from '../components/ActionBar'
import { CoachTip } from '../components/CoachTip'
import { EventBanner } from '../components/EventBanner'
import { Hand } from '../components/Hand'
import { Log } from '../components/Log'
import { MonthTracker } from '../components/MonthTracker'
import { StatPanel } from '../components/StatPanel'
import { EVENTS } from '../data/events'
import { creditBreakdown } from '../engine/credit'
import { formatCompactMoney } from '../engine/format'
import { previewCard, previewChoice, previewEndMonth, snapshot } from '../engine/preview'
import { awaitingEventChoice, cardUnavailableReason, ENERGY_PER_MONTH, MONTHS } from '../engine/reducer'
import type { PlayerState } from '../engine/types'
import { underwrite } from '../engine/underwrite'
import { useGame } from '../hooks/useGame'
import styles from './GameScreen.module.css'

/** Everything the screen shows that is derived from state, computed once per state change. */
function deriveView(player: PlayerState) {
  const stats = snapshot(player)
  const event = player.event ? EVENTS[player.event.eventId] : null
  const unavailable = player.hand.map((id) => cardUnavailableReason(player, id))
  return {
    stats,
    credit: creditBreakdown(player),
    result: underwrite(player),
    event,
    awaitingChoice: awaitingEventChoice(player),
    choicePreviews: event?.choices?.map((choice) => previewChoice(player, choice, stats)) ?? [],
    cardPreviews: player.hand.map((id) => previewCard(player, id, stats)),
    unavailable,
    endMonthPreview: previewEndMonth(player, stats),
    anyPlayable: unavailable.some((reason) => reason === null),
  }
}

export function GameScreen({ player }: { player: PlayerState }) {
  const { dispatch } = useGame()
  const view = useMemo(() => deriveView(player), [player])
  const [tipDismissed, setTipDismissed] = useState(false)
  const lastMonth = player.month === MONTHS

  return (
    <div className={styles.screen}>
      <MonthTracker month={player.month} total={MONTHS} />

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <StatPanel stats={view.stats} credit={view.credit} result={view.result} />
        </aside>

        <div className={styles.main}>
          {player.month === 1 && !tipDismissed && (
            <CoachTip onDismiss={() => setTipDismissed(true)}>
              Every card shows what it would change before you play it. Green helps, red hurts. Your goal: get your
              max home price to {formatCompactMoney(player.targetPrice)} by month {MONTHS}.
            </CoachTip>
          )}

          {view.event && (
            <EventBanner
              event={view.event}
              awaitingChoice={view.awaitingChoice}
              choicePreviews={view.choicePreviews}
              onChoose={(choiceId) => dispatch({ type: 'RESOLVE_EVENT', choiceId })}
            />
          )}

          <section className={styles.handSection} aria-label="Your hand">
            <h2 className={styles.sectionTitle}>Your moves this month</h2>
            <Hand
              hand={player.hand}
              previews={view.cardPreviews}
              unavailable={view.unavailable}
              // Paychecks still to come after this month.
              monthsLeft={MONTHS - player.month}
              onPlay={(handIndex) => dispatch({ type: 'PLAY_CARD', handIndex })}
            />
          </section>

          <Log entries={player.log} />

          <ActionBar
            energy={player.energy}
            maxEnergy={ENERGY_PER_MONTH}
            endPreview={view.endMonthPreview}
            label={lastMonth ? 'Apply for the mortgage' : `End month ${player.month}`}
            disabled={view.awaitingChoice}
            highlight={!view.anyPlayable && !view.awaitingChoice}
            onEnd={() => dispatch({ type: 'END_MONTH' })}
          />
        </div>
      </div>
    </div>
  )
}
