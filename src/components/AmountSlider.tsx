import { useId } from 'react'
import type { AmountRange } from '../engine/amounts'
import { formatMoney } from '../engine/format'
import styles from './AmountSlider.module.css'

export type AmountSliderProps = {
  range: AmountRange
  value: number
  /** Points worth seeing on the track, such as where utilization crosses 30%. */
  marks: { value: number; label: string }[]
  onChange: (value: number) => void
}

/** Choose how much a card puts in. Marks show where a payment crosses a score tier. */
export function AmountSlider({ range, value, marks, onChange }: AmountSliderProps) {
  const id = useId()
  const span = range.max - range.min
  const position = (v: number) => (span === 0 ? 0 : ((v - range.min) / span) * 100)
  const visibleMarks = marks.filter((m) => m.value >= range.min && m.value <= range.max)

  return (
    <div className={styles.slider}>
      <div className={styles.header}>
        <label htmlFor={id} className={styles.label}>
          Amount
        </label>
        <output htmlFor={id} className={styles.value}>
          {formatMoney(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.input}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        aria-valuetext={formatMoney(value)}
        // Game shortcuts ignore keys typed into inputs (useGameKeys), so arrows and numbers stay with the slider.
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {visibleMarks.length > 0 && (
        <div className={styles.marks} aria-hidden="true">
          {visibleMarks.map((m) => (
            <button
              key={m.label}
              type="button"
              tabIndex={-1}
              className={`${styles.mark} ${value >= m.value ? styles.reached : ''}`}
              style={{ left: `${position(m.value)}%` }}
              onClick={() => onChange(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      {visibleMarks.length > 0 && (
        <p className="visually-hidden">
          {visibleMarks.map((m) => `${m.label} at ${formatMoney(m.value)}`).join(', ')}
        </p>
      )}
    </div>
  )
}
