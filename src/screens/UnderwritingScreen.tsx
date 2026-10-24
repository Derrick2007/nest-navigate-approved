import { useEffect, useMemo, useRef, useState } from 'react'
import { ApprovalStamp } from '../components/ApprovalStamp'
import type { PlayerState } from '../engine/types'
import { underwrite, type UnderwritingResult } from '../engine/underwrite'
import { useGame } from '../hooks/useGame'
import { revealSteps } from './revealSteps'
import styles from './UnderwritingScreen.module.css'

const STEP_DELAY_MS = 750

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const ICONS = { pass: '✓', fail: '✕', warn: '!', rate: '' } as const

function stampFor(result: UnderwritingResult): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (result.outcome === 'APPROVED') return { label: 'APPROVED', tone: 'good' }
  if (result.outcome === 'APPROVED_SMALLER') return { label: 'APPROVED FOR LESS', tone: result.farBelowTarget ? 'bad' : 'warn' }
  return { label: 'DENIED', tone: 'bad' }
}

/** The Underwriter checks each number in turn, one line at a time. */
export function UnderwritingScreen({ player }: { player: PlayerState }) {
  const { dispatch } = useGame()
  const result = useMemo(() => underwrite(player), [player])
  const steps = useMemo(() => revealSteps(result, player.grossMonthlyIncome), [result, player.grossMonthlyIncome])
  const stamp = stampFor(result)
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? steps.length : 1))
  const done = shown >= steps.length
  const continueRef = useRef<HTMLButtonElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)

  // Start with focus on Skip, so Enter or Space jumps straight to the end.
  // Also start fetching the Phaser chunk now, while the lines reveal, so the
  // stamp is ready the moment the last line lands.
  useEffect(() => {
    skipRef.current?.focus()
    void import('../phaser/stampGame')
  }, [])

  // Reveal the next line on a timer until every step is visible.
  useEffect(() => {
    if (done) return
    const timer = window.setTimeout(() => setShown((n) => n + 1), STEP_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [shown, done])

  // Move focus to the next action once the reveal finishes, for keyboard users.
  useEffect(() => {
    if (done) continueRef.current?.focus()
  }, [done])

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.kicker}>Month 12 is over</p>
        <h1 className={styles.title}>The Underwriter is reviewing your file</h1>
      </header>

      <ol className={styles.steps} aria-live="polite">
        {steps.slice(0, shown).map((step) => (
          <li key={step.id} className={`${styles.step} ${styles[step.status]}`}>
            <span className={styles.icon} aria-hidden="true">
              {ICONS[step.status]}
            </span>
            <div>
              <p className={styles.stepTitle}>{step.title}</p>
              {step.detail && <p className={styles.stepDetail}>{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>

      {done && <ApprovalStamp label={stamp.label} tone={stamp.tone} />}

      <div className={styles.actions}>
        {done ? (
          <button
            ref={continueRef}
            type="button"
            className="button button-primary"
            onClick={() => dispatch({ type: 'SHOW_RESULT' })}
          >
            See what it means
          </button>
        ) : (
          <button ref={skipRef} type="button" className="button" onClick={() => setShown(steps.length)}>
            Skip to the end
          </button>
        )}
      </div>
    </div>
  )
}
