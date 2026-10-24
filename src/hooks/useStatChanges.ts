import { useEffect, useRef, useState } from 'react'
import { diffSnapshots, type Delta, type StatKey, type StatSnapshot } from '../engine/preview'

export type StatChanges = {
  /** Stats that moved on the last update, cleared after a moment. */
  deltas: Partial<Record<StatKey, Delta>>
  /** Bumps on every change, so a flash animation restarts even for the same stat. */
  id: number
}

const HOLD_MS = 2400

/** Remembers the previous stats and reports what just changed, for the "+29" flash. */
export function useStatChanges(stats: StatSnapshot): StatChanges {
  const previous = useRef(stats)
  const [changes, setChanges] = useState<StatChanges>({ deltas: {}, id: 0 })

  useEffect(() => {
    const moved = diffSnapshots(previous.current, stats).filter((d) => d.good !== null)
    previous.current = stats
    if (moved.length > 0) {
      setChanges((c) => ({ deltas: Object.fromEntries(moved.map((d) => [d.stat, d])), id: c.id + 1 }))
    }
  }, [stats])

  // Clear the flash a moment after each new change. Keyed on id, so a later
  // update that changes nothing can't cancel the clear and leave it stuck.
  useEffect(() => {
    if (changes.id === 0) return
    const timer = window.setTimeout(() => setChanges((c) => ({ ...c, deltas: {} })), HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [changes.id])

  return changes
}
