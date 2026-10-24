import styles from './EnergyPips.module.css'

type Props = {
  energy: number
  max: number
}

/** Filled pips for energy left this month. Each card costs 1 or 2. */
export function EnergyPips({ energy, max }: Props) {
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Energy</span>
      <span className={styles.pips} role="img" aria-label={`${energy} of ${max} energy left this month`}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`${styles.pip} ${i < energy ? styles.full : ''}`} />
        ))}
      </span>
    </div>
  )
}
