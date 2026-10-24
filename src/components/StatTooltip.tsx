import { useId, type ReactNode } from 'react'
import styles from './StatTooltip.module.css'

type Props = {
  label: string
  children: ReactNode
}

/** A small "i" button that explains a number on hover or keyboard focus. */
export function StatTooltip({ label, children }: Props) {
  const id = useId()
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-label={`About ${label}`} aria-describedby={id}>
        i
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {children}
      </span>
    </span>
  )
}
