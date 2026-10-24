import { useEffect } from 'react'

type Options = {
  /** While an event is waiting, number keys pick its choices instead of cards. */
  choiceIds: string[] | null
  /** One entry per card in hand: true if it can be played now. */
  playable: boolean[]
  onChoose: (choiceId: string) => void
  onPlay: (handIndex: number) => void
  onEnd: () => void
}

/**
 * Keyboard shortcuts on the game screen: 1–9 play a card (or pick an event
 * choice), E ends the month. Everything is also reachable with Tab and Enter;
 * these just make a run quick to play from the keyboard.
 */
export function useGameKeys({ choiceIds, playable, onChoose, onPlay, onEnd }: Options) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return

      const index = Number(e.key) - 1
      const isNumber = Number.isInteger(index) && index >= 0 && index < 9
      if (choiceIds) {
        if (isNumber && choiceIds[index]) onChoose(choiceIds[index])
        return
      }
      if (isNumber && playable[index]) onPlay(index)
      else if (e.key === 'e' || e.key === 'E') onEnd()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [choiceIds, playable, onChoose, onPlay, onEnd])
}
