import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionBar } from '../components/ActionBar'
import type { AmountSliderProps } from '../components/AmountSlider'
import { CoachTip } from '../components/CoachTip'
import { DraftPanel } from '../components/DraftPanel'
import { EventBanner } from '../components/EventBanner'
import { Hand } from '../components/Hand'
import { Log } from '../components/Log'
import { MonthTracker } from '../components/MonthTracker'
import { StatPanel } from '../components/StatPanel'
import { CARDS } from '../data/cards'
import { EVENTS } from '../data/events'
import { amountRange, resolveAmount } from '../engine/amounts'
import { creditBreakdown, paydownToReach } from '../engine/credit'
import { formatCompactMoney } from '../engine/format'
import { previewCard, previewChoice, previewEndMonth, snapshot } from '../engine/preview'
import {
  awaitingEventChoice,
  cardUnavailableReason,
  ENERGY_PER_MONTH,
  MONTHS,
  type GameAction,
} from '../engine/reducer'
import type { CardId, PlayerState } from '../engine/types'
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
    unavailable,
    playable: unavailable.map((reason) => reason === null),
    endMonthPreview: previewEndMonth(player, stats),
    anyPlayable: unavailable.some((reason) => reason === null),
    draftPreviews: player.draftOffer.map((id) => previewCard(player, id, stats)),
  }
}

/** Utilization lines worth marking on a card-payment slider, as payment amounts. */
function utilizationMarks(player: PlayerState, step: number) {
  return [
    { label: '30%', value: Math.ceil(paydownToReach(player, 0.3) / step) * step },
    { label: '10%', value: Math.ceil(paydownToReach(player, 0.1) / step) * step },
  ]
}

// After a move, focus goes somewhere useful so keyboard and screen-reader
// users never lose their place: the draft or the event (if either needs a
// choice), else the hand, else End month. It lands on a heading, not a
// button, so a stray Enter can never make a choice the player didn't mean.
const FOCUS_ORDER = ['draft', 'event', 'hand', 'end'] as const

// Shared empty object, so the previews memo below doesn't rerun on every render.
const NO_SLIDER_VALUES: Record<number, number> = {}

type Props = {
  player: PlayerState
  /** Between months: show the draft instead of the hand. */
  drafting: boolean
}

export function GameScreen({ player, drafting }: Props) {
  const { dispatch } = useGame()
  const view = useMemo(() => deriveView(player), [player])

  // Slider positions, by hand index. They reset whenever the hand changes
  // (a card played, a new month), because positions shift with the hand.
  const [sliderState, setSliderState] = useState<{ hand: CardId[]; values: Record<number, number> }>({
    hand: player.hand,
    values: {},
  })
  const sliderValues = sliderState.hand === player.hand ? sliderState.values : NO_SLIDER_VALUES

  // Card previews depend on the slider amounts, so they are computed apart from deriveView.
  const cards = useMemo(
    () =>
      player.hand.map((id, index) => {
        const card = CARDS[id]
        const range = amountRange(card, player)
        const amount = resolveAmount(card, player, sliderValues[index])
        const slider: AmountSliderProps | undefined =
          range && amount !== undefined
            ? {
                range,
                value: amount,
                marks: card.amount?.utilizationMarks ? utilizationMarks(player, range.step) : [],
                onChange: (value) => setSliderState({ hand: player.hand, values: { ...sliderValues, [index]: value } }),
              }
            : undefined
        return { preview: previewCard(player, id, view.stats, amount), slider, amount }
      }),
    [player, sliderValues, view.stats],
  )
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
  const play = useCallback(
    (handIndex: number) => act({ type: 'PLAY_CARD', handIndex, amount: cards[handIndex]?.amount }, false),
    [act, cards],
  )
  const end = useCallback(() => act({ type: 'END_MONTH' }, true), [act])
  const take = useCallback((cardId: string) => act({ type: 'DRAFT_PICK', cardId: cardId as CardId }, true), [act])
  const skip = useCallback(() => act({ type: 'DRAFT_PICK', cardId: null }, true), [act])

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

  // In the draft, number keys take an offered card and E skips.
  useGameKeys(
    drafting
      ? { choiceIds: player.draftOffer, playable: [], onChoose: take, onPlay: play, onEnd: skip }
      : { choiceIds: view.choiceIds, playable: view.playable, onChoose: choose, onPlay: play, onEnd: end },
  )

  return (
    <div className={styles.screen} ref={rootRef}>
      <MonthTracker month={player.month} total={MONTHS} />

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <StatPanel stats={view.stats} credit={view.credit} result={view.result} />
        </aside>

        <div className={styles.main}>
          {drafting ? (
            <>
              <DraftPanel
                month={player.month}
                offer={player.draftOffer}
                previews={view.draftPreviews}
                monthsLeft={MONTHS - player.month}
                onTake={take}
                onSkip={skip}
              />
              <Log entries={player.log} />
            </>
          ) : (
            <>
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
                    Keys: <kbd>1</kbd>–<kbd>{Math.max(1, player.hand.length)}</kbd> play a card, <kbd>E</kbd> ends the
                    month
                  </p>
                </div>
                <Hand
                  hand={player.hand}
                  previews={cards.map((c) => c.preview)}
                  unavailable={view.unavailable}
                  sliders={cards.map((c) => c.slider)}
                  // Paychecks still to come after this month.
                  monthsLeft={MONTHS - player.month}
                  locked={view.awaitingChoice}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
