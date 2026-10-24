import { useMemo, useReducer } from 'react'
import { gameReducer, initialGameState } from './engine/reducer'
import { GameContext } from './hooks/useGame'
import { BareGameScreen } from './screens/BareGameScreen'
import { GameScreen } from './screens/GameScreen'

function App() {
  const [game, dispatch] = useReducer(gameReducer, initialGameState)
  // Stable context value so consumers only re-render when the game changes.
  const value = useMemo(() => ({ game, dispatch }), [game])

  return (
    <GameContext.Provider value={value}>
      <main className="app">
        {game.phase === 'playing' ? <GameScreen player={game.player} /> : <BareGameScreen />}
      </main>
    </GameContext.Provider>
  )
}

export default App
