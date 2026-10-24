import { useId, useState, type ReactNode } from 'react'
import styles from './StatTooltip.module.css'

type Props = {
  label: string
  children: ReactNode
}

/** A small "i" button that explains a number on hover or keyboard focus. */
export function StatTooltip({ label, children }: Props) {
  const id = useId()
  // Escape hides the tip without moving focus; it can show again on the next hover or focus.
  const [dismissed, setDismissed] = useState(false)
  return (
    <span
      className={`${styles.wrap} ${dismissed ? styles.dismissed : ''}`}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={`About ${label}`}
        aria-describedby={id}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDismissed(true)
        }}
      >
        i
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {children}
      </span>
    </span>
  )
}
