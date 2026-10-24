import type { Delta } from '../engine/preview'
import styles from './DeltaPreview.module.css'
import { formatStat, STAT_LABELS, STAT_SHORT_LABELS } from './statFormat'

type Props = {
  deltas: Delta[]
}

/** "Credit score 656 → 696" lines, green when it helps and red when it hurts. */
export function DeltaPreview({ deltas }: Props) {
  return (
    <ul className={styles.list}>
      {deltas.map((d) => {
        const tone = d.good === null ? styles.neutral : d.good ? styles.good : styles.bad
        return (
          <li key={d.stat} className={`${styles.row} ${tone}`}>
            <abbr className={styles.label} title={STAT_LABELS[d.stat]}>
              {STAT_SHORT_LABELS[d.stat]}
            </abbr>
            {d.good === null ? (
              <span className={styles.value}>no change</span>
            ) : (
              <span className={styles.value}>
                {formatStat(d.stat, d.before)}
                <span aria-label="becomes"> → </span>
                <strong>{formatStat(d.stat, d.after)}</strong>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
