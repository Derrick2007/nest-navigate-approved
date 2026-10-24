import type { Delta } from '../engine/preview'
import styles from './ActionBar.module.css'
import { DeltaPreview } from './DeltaPreview'
import { EnergyPips } from './EnergyPips'

type Props = {
  energy: number
  maxEnergy: number
  /** What ending the month will change (interest, loan paydown, overdraft). */
  endPreview: Delta[]
  label: string
  disabled: boolean
  /** True once nothing else can be played, to make ending the month the obvious next step. */
  highlight: boolean
  onEnd: () => void
}

/** Sticky footer: energy left this month and the button that ends it, with its preview. */
export function ActionBar({ energy, maxEnergy, endPreview, label, disabled, highlight, onEnd }: Props) {
  // Max price "no change" is noise here; only show what actually moves.
  const moving = endPreview.filter((d) => d.good !== null)
  return (
    <div className={styles.bar}>
      <EnergyPips energy={energy} max={maxEnergy} />
      <div className={styles.preview}>
        {moving.length > 0 && (
          <>
            <span className={styles.previewLabel}>At month end</span>
            <DeltaPreview deltas={moving} />
          </>
        )}
      </div>
      <button
        type="button"
        className={`button ${highlight ? 'button-primary' : ''} ${styles.end}`}
        disabled={disabled}
        onClick={onEnd}
      >
        {label}
      </button>
    </div>
  )
}
