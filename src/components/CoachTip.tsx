import type { ReactNode } from 'react'
import styles from './CoachTip.module.css'

type Props = {
  children: ReactNode
  onDismiss: () => void
}

/** A one-time hint for first-month players. */
export function CoachTip({ children, onDismiss }: Props) {
  return (
    <aside className={styles.tip} aria-label="Tip">
      <p className={styles.text}>{children}</p>
      <button type="button" className={`button ${styles.dismiss}`} onClick={onDismiss}>
        Got it
      </button>
    </aside>
  )
}
