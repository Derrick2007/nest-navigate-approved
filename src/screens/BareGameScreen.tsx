import { useMemo } from 'react'
import { CARDS } from '../data/cards'
import { EVENTS } from '../data/events'
import { creditScore } from '../engine/credit'
import { formatMoney } from '../engine/effects'
import { awaitingEventChoice, cardUnavailableReason, MONTHS } from '../engine/reducer'
import { underwrite } from '../engine/underwrite'
import { useGame } from '../hooks/useGame'

// Milestone 3 only: an unstyled screen that proves the loop is playable end
// to end. Replaced by the real Start, Game and Result screens in milestones 4–5.
export function BareGameScreen() {
  const { game, dispatch } = useGame()
  const player = game.phase === 'start' ? null : game.player
  const result = useMemo(() => (game.phase === 'finished' ? underwrite(game.player) : null), [game])

  if (!player) {
    return (
      <button onClick={() => dispatch({ type: 'START', seed: Math.floor(Math.random() * 2 ** 31) })}>
        Start a run
      </button>
    )
  }

  const event = player.event ? EVENTS[player.event.eventId] : null
  const waiting = awaitingEventChoice(player)

  return (
    <div>
      <p>
        Month {player.month}/{MONTHS} · Cash {formatMoney(player.cash)} · Score {creditScore(player)} · Energy{' '}
        {player.energy} · Seed {player.seed}
      </p>

      {result ? (
        <section>
          <h2>{result.outcome}</h2>
          <p>
            Max price {result.maxPrice ? formatMoney(result.maxPrice) : 'none'} vs target{' '}
            {formatMoney(result.targetPrice)} · Limited by {result.bindingConstraint ?? result.denialReason}
            {result.quote && ` · Rate ${result.quote.rate.total.toFixed(3)}%`}
          </p>
          <button onClick={() => dispatch({ type: 'START', seed: player.seed })}>Replay this seed</button>{' '}
          <button onClick={() => dispatch({ type: 'RESTART' })}>Back to start</button>
        </section>
      ) : (
        <>
          {event && (
            <section>
              <h2>{event.name}</h2>
              <p>{event.description}</p>
              {waiting &&
                event.choices?.map((choice) => (
                  <button key={choice.id} onClick={() => dispatch({ type: 'RESOLVE_EVENT', choiceId: choice.id })}>
                    {choice.label}
                  </button>
                ))}
            </section>
          )}

          <section>
            <h2>Hand</h2>
            {player.hand.map((id, index) => {
              const reason = cardUnavailableReason(player, id)
              return (
                <button
                  key={`${id}-${index}`}
                  disabled={reason !== null}
                  title={reason ?? CARDS[id].description}
                  onClick={() => dispatch({ type: 'PLAY_CARD', handIndex: index })}
                >
                  {CARDS[id].name} ({CARDS[id].cost})
                </button>
              )
            })}
            <p>
              <button disabled={waiting} onClick={() => dispatch({ type: 'END_MONTH' })}>
                End month
              </button>
            </p>
          </section>
        </>
      )}

      <ol>
        {player.log.map((entry, i) => (
          <li key={i}>
            M{entry.month}: {entry.text}
          </li>
        ))}
      </ol>
    </div>
  )
}
