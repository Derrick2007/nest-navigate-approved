import { useMemo, useReducer } from 'react'
import { gameReducer, initialGameState } from './engine/reducer'
import { GameContext } from './hooks/useGame'
import { BareGameScreen } from './screens/BareGameScreen'

function App() {
  const [game, dispatch] = useReducer(gameReducer, initialGameState)
  // Stable context value so consumers only re-render when the game changes.
  const value = useMemo(() => ({ game, dispatch }), [game])

  return (
    <GameContext.Provider value={value}>
      <main className="app">
        <h1>Approved</h1>
        <BareGameScreen />
      </main>
    </GameContext.Provider>
  )
}

export default App
