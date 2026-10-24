import type { LogEntry } from '../engine/types'
import styles from './Log.module.css'

type Props = {
  entries: LogEntry[]
}

/** What has happened so far, newest first. */
export function Log({ entries }: Props) {
  return (
    <section className={styles.log} aria-label="What happened">
      <h2 className={styles.title}>What happened</h2>
      <ol className={styles.list}>
        {entries
          .map((entry, i) => ({ ...entry, key: i }))
          .reverse()
          .map((entry) => (
            <li key={entry.key} className={styles.entry}>
              <span className={styles.month}>M{entry.month}</span>
              {entry.text}
            </li>
          ))}
      </ol>
    </section>
  )
}
