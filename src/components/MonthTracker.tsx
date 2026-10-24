import styles from './MonthTracker.module.css'

type Props = {
  month: number
  total: number
}

/** Twelve segments: months already played, this month, months to go. */
export function MonthTracker({ month, total }: Props) {
  const left = total - month
  return (
    <div className={styles.tracker}>
      <p className={styles.label}>
        <strong>
          Month {month} of {total}
        </strong>
        <span>{left === 0 ? 'Last month before you apply' : `${left} to go before you apply`}</span>
      </p>
      <ol className={styles.segments} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const state = i + 1 < month ? styles.done : i + 1 === month ? styles.current : ''
          return <li key={i} className={`${styles.segment} ${state}`} />
        })}
      </ol>
    </div>
  )
}
