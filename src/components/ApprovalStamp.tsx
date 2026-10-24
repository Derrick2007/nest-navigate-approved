import { useEffect, useRef, useState } from 'react'
import styles from './ApprovalStamp.module.css'

type Tone = 'good' | 'warn' | 'bad'

type Props = {
  label: string
  tone: Tone
}

// Same values as --good / --warn / --bad in index.css. Phaser draws on a
// canvas, so it needs real colours rather than CSS variables.
const INK: Record<Tone, string> = { good: '#2f7d4f', warn: '#a86a12', bad: '#b4442f' }

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * The outcome stamp at the end of the reveal, animated with Phaser. Falls back
 * to a static CSS stamp under reduced motion or if Phaser fails to load.
 */
export function ApprovalStamp({ label, tone }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [fallback, setFallback] = useState(prefersReducedMotion)

  useEffect(() => {
    if (fallback || !stageRef.current) return
    const stage = stageRef.current
    // `cancelled` covers unmounting before the chunk arrives (and React's
    // double-run of effects in development).
    let cancelled = false
    let game: { destroy: (removeCanvas: boolean) => void } | null = null

    import('../phaser/stampGame')
      .then(({ createStampGame }) => {
        if (!cancelled) game = createStampGame(stage, { label, color: INK[tone], celebrate: tone === 'good' })
      })
      .catch(() => {
        if (!cancelled) setFallback(true)
      })

    return () => {
      cancelled = true
      game?.destroy(true)
    }
  }, [label, tone, fallback])

  return (
    <div className={styles.stage} ref={stageRef}>
      {/* The canvas is decoration; this text is what screen readers get. */}
      <span className="visually-hidden">{label}</span>
      {fallback && (
        <span className={`${styles.static} ${styles[tone]}`} aria-hidden="true">
          {label}
        </span>
      )}
    </div>
  )
}
