import { createContext, useContext, type Dispatch } from 'react'
import type { GameAction, GameState } from '../engine/reducer'

// The game lives in one useReducer in App. Screens read it and dispatch
// actions through this context instead of passing props through every level.

export type GameContextValue = {
  game: GameState
  dispatch: Dispatch<GameAction>
}

export const GameContext = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
  const value = useContext(GameContext)
  if (!value) throw new Error('useGame must be used inside <GameContext.Provider>')
  return value
}
