import { useEffect, useMemo, useReducer } from 'react'
import { gameReducer, initialGameState, type GameState } from './engine/reducer'
import { GameContext } from './hooks/useGame'
import { GameScreen } from './screens/GameScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import { UnderwritingScreen } from './screens/UnderwritingScreen'

function Screen({ game }: { game: GameState }) {
  switch (game.phase) {
    case 'start':
      return <StartScreen />
    case 'playing':
      return <GameScreen player={game.player} />
    case 'underwriting':
      return <UnderwritingScreen player={game.player} />
    case 'result':
      return <ResultScreen player={game.player} />
  }
}

function App() {
  const [game, dispatch] = useReducer(gameReducer, initialGameState)
  // Stable context value so consumers only re-render when the game changes.
  const value = useMemo(() => ({ game, dispatch }), [game])

  // Each screen starts at the top, like a page change.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [game.phase])

  return (
    <GameContext.Provider value={value}>
      <main className="app">
        <Screen game={game} />
      </main>
    </GameContext.Provider>
  )
}

export default App
