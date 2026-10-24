import { useMemo } from 'react'
import { DeltaPreview } from '../components/DeltaPreview'
import { EnergyPips } from '../components/EnergyPips'
import { EventBanner } from '../components/EventBanner'
import { Hand } from '../components/Hand'
import { Log } from '../components/Log'
import { MonthTracker } from '../components/MonthTracker'
import { StatPanel } from '../components/StatPanel'
import { EVENTS } from '../data/events'
import { creditBreakdown } from '../engine/credit'
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
  const lastMonth = player.month === MONTHS

  return (
    <div className={styles.screen}>
      <MonthTracker month={player.month} total={MONTHS} />

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <StatPanel stats={view.stats} credit={view.credit} result={view.result} />
        </aside>

        <div className={styles.main}>
          {view.event && (
            <EventBanner
              event={view.event}
              awaitingChoice={view.awaitingChoice}
              choicePreviews={view.choicePreviews}
              onChoose={(choiceId) => dispatch({ type: 'RESOLVE_EVENT', choiceId })}
            />
          )}

          <section className={styles.handSection} aria-label="Your hand">
            <div className={styles.handHeader}>
              <h2 className={styles.sectionTitle}>Your moves this month</h2>
              <EnergyPips energy={player.energy} max={ENERGY_PER_MONTH} />
            </div>
            <Hand
              hand={player.hand}
              previews={view.cardPreviews}
              unavailable={view.unavailable}
              onPlay={(handIndex) => dispatch({ type: 'PLAY_CARD', handIndex })}
            />
          </section>

          <section className={styles.endMonth} aria-label="End the month">
            <div className={styles.endMonthText}>
              <h2 className={styles.sectionTitle}>When the month ends</h2>
              <p className={styles.hint}>
                Card balances grow 2% in interest, loans pay down, and unplayed cards are discarded.
              </p>
              <DeltaPreview deltas={view.endMonthPreview} />
            </div>
            <button
              type="button"
              // Highlight the button once there is nothing left to do this month.
              className={`button ${view.anyPlayable ? '' : 'button-primary'} ${styles.endButton}`}
              disabled={view.awaitingChoice}
              onClick={() => dispatch({ type: 'END_MONTH' })}
            >
              {lastMonth ? 'Apply for the mortgage' : `End month ${player.month}`}
            </button>
          </section>

          <Log entries={player.log} />
        </div>
      </div>
    </div>
  )
}
