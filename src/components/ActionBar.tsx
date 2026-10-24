import type { Delta } from '../engine/preview'
import styles from './ActionBar.module.css'
import { DeltaPreview } from './DeltaPreview'
import { EnergyPips } from './EnergyPips'

export type Notice = {
  tone: 'info' | 'bad'
  text: string
}

type Props = {
  energy: number
  maxEnergy: number
  /** What ending the month will change (interest, loan paydown, overdraft). */
  endPreview: Delta[]
  /** A short status line, such as why the button is disabled or a cash shortfall. */
  notice: Notice | null
  label: string
  disabled: boolean
  /** True once nothing else can be played, to make ending the month the obvious next step. */
  highlight: boolean
  onEnd: () => void
}

/** Sticky footer: energy left this month and the button that ends it, with its preview. */
export function ActionBar({ energy, maxEnergy, endPreview, notice, label, disabled, highlight, onEnd }: Props) {
  // Max price "no change" is noise here; only show what actually moves.
  const moving = endPreview.filter((d) => d.good !== null)
  return (
    <div className={styles.bar}>
      <EnergyPips energy={energy} max={maxEnergy} />
      <button
        type="button"
        data-autofocus="end"
        className={`button ${highlight ? 'button-primary' : ''} ${styles.end}`}
        disabled={disabled}
        onClick={onEnd}
        aria-keyshortcuts="E"
      >
        {label}
      </button>
      <div className={styles.details}>
        <p className={`${styles.notice} ${notice?.tone === 'bad' ? styles.bad : ''}`} role="status">
          {notice?.text}
        </p>
        {moving.length > 0 && (
          <div className={styles.preview}>
            <span className={styles.previewLabel}>At month end</span>
            <DeltaPreview deltas={moving} />
          </div>
        )}
      </div>
    </div>
  )
}
