import { useMemo } from 'react'
import { formatCompactMoney, formatRate } from '../engine/format'
import { underwrite } from '../engine/underwrite'
import { useGame } from '../hooks/useGame'

// Temporary start and result screens so the game stays playable end to end.
// Replaced by StartScreen, UnderwritingScreen and ResultScreen in milestone 5.
export function BareGameScreen() {
  const { game, dispatch } = useGame()
  const result = useMemo(() => (game.phase === 'finished' ? underwrite(game.player) : null), [game])
  const newSeed = () => Math.floor(Math.random() * 2 ** 31)

  if (game.phase !== 'finished' || !result) {
    return (
      <button className="button button-primary" onClick={() => dispatch({ type: 'START', seed: newSeed() })}>
        Start a run
      </button>
    )
  }

  return (
    <section>
      <h2>{result.outcome}</h2>
      <p>
        Max price {result.maxPrice ? formatCompactMoney(result.maxPrice) : 'none'} vs target{' '}
        {formatCompactMoney(result.targetPrice)} · Limited by {result.bindingConstraint ?? result.denialReason}
        {result.quote && ` · Rate ${formatRate(result.quote.rate.total)}`}
      </p>
      <button className="button" onClick={() => dispatch({ type: 'START', seed: game.player.seed })}>
        Replay this seed
      </button>{' '}
      <button className="button" onClick={() => dispatch({ type: 'START', seed: newSeed() })}>
        Play again
      </button>
    </section>
  )
}
