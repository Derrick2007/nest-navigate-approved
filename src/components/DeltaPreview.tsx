import type { Delta } from '../engine/preview'
import styles from './DeltaPreview.module.css'
import { formatChange, formatStat, STAT_LABELS, STAT_SHORT_LABELS } from './statFormat'

type Props = {
  deltas: Delta[]
}

/** Compact chips like "Score +29", green when it helps and red when it hurts. */
export function DeltaPreview({ deltas }: Props) {
  return (
    <ul className={styles.chips}>
      {deltas.map((d) => {
        const tone = d.good === null ? styles.neutral : d.good ? styles.good : styles.bad
        const full =
          d.good === null
            ? `${STAT_LABELS[d.stat]}: no change`
            : `${STAT_LABELS[d.stat]}: ${formatStat(d.stat, d.before)} to ${formatStat(d.stat, d.after)}`
        return (
          <li key={d.stat} className={`${styles.chip} ${tone}`} title={full}>
            {/* Screen readers get the full before and after; the chip shows just the change. */}
            <span className="visually-hidden">{full}</span>
            <span aria-hidden="true">
              <span className={styles.label}>{STAT_SHORT_LABELS[d.stat]}</span> <strong>{formatChange(d)}</strong>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
