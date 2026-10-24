import { useState } from 'react'
import type { LogEntry } from '../engine/types'
import styles from './Log.module.css'

type Props = {
  entries: LogEntry[]
}

const RECENT = 2

/** The latest couple of things that happened, with the full history one click away. */
export function Log({ entries }: Props) {
  const [expanded, setExpanded] = useState(false)
  // Keep each entry's original index as its key; newest first.
  const ordered = entries.map((entry, i) => ({ ...entry, key: i })).reverse()
  const visible = expanded ? ordered : ordered.slice(0, RECENT)
  const hidden = ordered.length - RECENT

  return (
    <section className={styles.log} aria-label="What happened">
      <div className={styles.header}>
        <h2 className={styles.title}>What happened</h2>
        {hidden > 0 && (
          <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Show less' : `Show all ${ordered.length}`}
          </button>
        )}
      </div>
      {/* Polite live region: new entries are read out after each move. */}
      <ol className={`${styles.list} ${expanded ? styles.expanded : ''}`} aria-live="polite">
        {visible.map((entry) => (
          <li key={entry.key} className={styles.entry}>
            <span className={styles.month}>M{entry.month}</span>
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  )
}
