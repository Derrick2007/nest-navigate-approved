import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { awaitingEventChoice, cardUnavailableReason, ENERGY_PER_MONTH, MONTHS, type GameAction } from '../engine/reducer'
import type { PlayerState } from '../engine/types'
import { underwrite } from '../engine/underwrite'
import { useGame } from '../hooks/useGame'
import { useGameKeys } from '../hooks/useGameKeys'
import styles from './GameScreen.module.css'
import { monthNotice } from './monthNotice'

/** Everything the screen shows that is derived from state, computed once per state change. */
function deriveView(player: PlayerState) {
  const stats = snapshot(player)
  const event = player.event ? EVENTS[player.event.eventId] : null
  const unavailable = player.hand.map((id) => cardUnavailableReason(player, id))
  const awaitingChoice = awaitingEventChoice(player)
  return {
    stats,
    credit: creditBreakdown(player),
    result: underwrite(player),
    event,
    awaitingChoice,
    choiceIds: awaitingChoice ? (event?.choices?.map((c) => c.id) ?? null) : null,
    choicePreviews: event?.choices?.map((choice) => previewChoice(player, choice, stats)) ?? [],
    cardPreviews: player.hand.map((id) => previewCard(player, id, stats)),
    unavailable,
    playable: unavailable.map((reason) => reason === null),
    endMonthPreview: previewEndMonth(player, stats),
    anyPlayable: unavailable.some((reason) => reason === null),
  }
}

// After a move, focus goes somewhere useful so keyboard and screen-reader
// users never lose their place: the event (if it needs a choice), else the
// hand, else End month. It lands on a heading, not a button, so a stray
// Enter can never play a card or pick an option the player didn't choose.
const FOCUS_ORDER = ['event', 'hand', 'end'] as const

export function GameScreen({ player }: { player: PlayerState }) {
  const { dispatch } = useGame()
  const view = useMemo(() => deriveView(player), [player])
  const [tipDismissed, setTipDismissed] = useState(false)
  const lastMonth = player.month === MONTHS
  const rootRef = useRef<HTMLDivElement>(null)
  // Set by each action; `scroll` is false after playing a card, so the page
  // doesn't jump away from the card the player just used.
  const pendingFocus = useRef<{ scroll: boolean } | null>({ scroll: false })

  const act = useCallback(
    (action: GameAction, scroll: boolean) => {
      pendingFocus.current = { scroll }
      dispatch(action)
    },
    [dispatch],
  )
  const choose = useCallback((choiceId: string) => act({ type: 'RESOLVE_EVENT', choiceId }, true), [act])
  const play = useCallback((handIndex: number) => act({ type: 'PLAY_CARD', handIndex }, false), [act])
  const end = useCallback(() => act({ type: 'END_MONTH' }, true), [act])

  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending || !rootRef.current) return
    pendingFocus.current = null
    for (const kind of FOCUS_ORDER) {
      const target = rootRef.current.querySelector<HTMLElement>(`[data-autofocus="${kind}"]:not(:disabled)`)
      if (target) {
        target.focus({ preventScroll: true })
        // Centre rather than "nearest", so the target never lands under the sticky action bar.
        if (pending.scroll) target.scrollIntoView({ block: 'center' })
        return
      }
    }
  }, [player])

  useGameKeys({ choiceIds: view.choiceIds, playable: view.playable, onChoose: choose, onPlay: play, onEnd: end })

  return (
    <div className={styles.screen} ref={rootRef}>
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
              onChoose={choose}
            />
          )}

          <section className={styles.handSection} aria-label="Your hand">
            <div className={styles.handHeader}>
              <h2
                className={styles.sectionTitle}
                tabIndex={-1}
                data-autofocus={view.anyPlayable ? 'hand' : undefined}
              >
                Your moves this month
              </h2>
              <p className={styles.keys}>
                Keys: <kbd>1</kbd>–<kbd>{Math.max(1, player.hand.length)}</kbd> play a card, <kbd>E</kbd> ends the month
              </p>
            </div>
            <Hand
              hand={player.hand}
              previews={view.cardPreviews}
              unavailable={view.unavailable}
              // Paychecks still to come after this month.
              monthsLeft={MONTHS - player.month}
              onPlay={play}
            />
          </section>

          <Log entries={player.log} />

          <ActionBar
            energy={player.energy}
            maxEnergy={ENERGY_PER_MONTH}
            endPreview={view.endMonthPreview}
            notice={monthNotice(player, view.awaitingChoice, view.anyPlayable)}
            label={lastMonth ? 'Apply for the mortgage' : `End month ${player.month}`}
            disabled={view.awaitingChoice}
            highlight={!view.anyPlayable && !view.awaitingChoice}
            onEnd={end}
          />
        </div>
      </div>
    </div>
  )
}
