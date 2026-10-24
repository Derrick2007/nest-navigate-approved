import type { ReactNode } from 'react'
import type { CreditBreakdown } from '../engine/credit'
import { formatCompactMoney, formatRate } from '../engine/format'
import type { StatKey, StatSnapshot } from '../engine/preview'
import { MIN_CREDIT_SCORE, type UnderwritingResult } from '../engine/underwrite'
import { useStatChanges, type StatChanges } from '../hooks/useStatChanges'
import styles from './StatPanel.module.css'
import { formatChange, formatStat, STAT_EXPLANATIONS, STAT_LABELS, STAT_SHORT_LABELS } from './statFormat'
import { StatTooltip } from './StatTooltip'

type Props = {
  stats: StatSnapshot
  credit: CreditBreakdown
  result: UnderwritingResult
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

function scoreTone(score: number): Tone {
  if (score < MIN_CREDIT_SCORE) return 'bad'
  if (score < 680) return 'warn'
  return 'good'
}

function utilizationTone(ratio: number): Tone {
  if (ratio <= 0.3) return 'good'
  if (ratio <= 0.5) return 'warn'
  return 'bad'
}

// Points out of the most each part can earn (docs/SPEC.md §6.1).
const CREDIT_PARTS: { key: keyof Omit<CreditBreakdown, 'score'>; label: string; max: number }[] = [
  { key: 'paymentHistory', label: 'Payment history', max: 192 },
  { key: 'utilization', label: 'Card utilization', max: 165 },
  { key: 'age', label: 'Account age', max: 82 },
  { key: 'newCredit', label: 'New credit', max: 55 },
  { key: 'mix', label: 'Credit mix', max: 55 },
]

function statusLine(result: UnderwritingResult): { text: string; tone: Tone } {
  if (result.denialReason === 'credit') return { text: `Denied: score under ${MIN_CREDIT_SCORE}`, tone: 'bad' }
  if (result.outcome === 'DENIED') return { text: 'Denied: not enough cash for 3% down', tone: 'bad' }
  const limit = result.bindingConstraint === 'dti' ? 'debt-to-income' : 'cash'
  const tone = result.outcome === 'APPROVED' ? 'good' : result.farBelowTarget ? 'bad' : 'warn'
  return { text: `Limited by ${limit}`, tone }
}

/** "+29" next to a number that just moved. Keyed on the change id so the animation replays. */
function Flash({ stat, changes }: { stat: StatKey; changes: StatChanges }) {
  const delta = changes.deltas[stat]
  if (!delta) return null
  return (
    <span key={changes.id} className={`${styles.flash} ${delta.good ? styles.flashGood : styles.flashBad}`}>
      {formatChange(delta)}
    </span>
  )
}

type RowProps = {
  stat: StatKey
  value: number
  changes: StatChanges
  tone?: Tone
  detail?: string
  /** Replaces the default one-sentence explanation. */
  tooltip?: ReactNode
}

/** The full name on wide screens, the short one ("DTI") where the panel is narrow. */
function StatLabel({ stat }: { stat: StatKey }) {
  return (
    <>
      <span className={styles.fullLabel}>{STAT_LABELS[stat]}</span>
      <span className={styles.shortLabel} aria-hidden="true">
        {STAT_SHORT_LABELS[stat]}
      </span>
    </>
  )
}

/** One of the three numbers a lender reads: large, with an explanation. */
function PrimaryRow({ stat, value, changes, tone = 'neutral', detail, tooltip }: RowProps) {
  return (
    <div className={styles.row}>
      <dt className={styles.rowLabel}>
        <StatLabel stat={stat} />
        <StatTooltip label={STAT_LABELS[stat]}>{tooltip ?? STAT_EXPLANATIONS[stat]}</StatTooltip>
      </dt>
      <dd className={styles.rowValue}>
        <span className={styles.valueLine}>
          <Flash stat={stat} changes={changes} />
          <span className={styles[tone]}>{formatStat(stat, value)}</span>
        </span>
        {detail && <span className={styles.rowDetail}>{detail}</span>}
      </dd>
    </div>
  )
}

/** A supporting number: smaller, below the three that matter most. */
function SecondaryRow({ stat, value, changes, tone = 'neutral' }: RowProps) {
  return (
    <div className={styles.secondaryRow}>
      <dt className={styles.rowLabel}>
        <StatLabel stat={stat} />
        <StatTooltip label={STAT_LABELS[stat]}>{STAT_EXPLANATIONS[stat]}</StatTooltip>
      </dt>
      <dd className={styles.secondaryValue}>
        <Flash stat={stat} changes={changes} />
        <span className={styles[tone]}>{formatStat(stat, value)}</span>
      </dd>
    </div>
  )
}

/** The numbers a lender reads, plus what they add up to today. */
export function StatPanel({ stats, credit, result }: Props) {
  const changes = useStatChanges(stats)
  const progress = Math.min(1, stats.maxPrice / result.targetPrice)
  const status = statusLine(result)

  const scoreTooltip = (
    <>
      <span className={styles.tipIntro}>{STAT_EXPLANATIONS.score}</span>
      <span className={styles.parts}>
        {CREDIT_PARTS.map((part) => (
          <span key={part.key} className={styles.part}>
            <span>{part.label}</span>
            <span>
              {Math.round(credit[part.key])} / {part.max}
            </span>
          </span>
        ))}
      </span>
    </>
  )

  return (
    <section className={styles.panel} aria-label="Your numbers">
      <div className={styles.goal}>
        <p className={styles.goalLabel}>
          {STAT_LABELS.maxPrice} today
          <StatTooltip label={STAT_LABELS.maxPrice}>{STAT_EXPLANATIONS.maxPrice}</StatTooltip>
        </p>
        <p className={styles.goalValue}>
          {formatStat('maxPrice', stats.maxPrice)}
          <Flash stat="maxPrice" changes={changes} />
        </p>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="Progress toward your target home"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className={`${styles.barFill} ${styles[`${status.tone}Fill`]}`} style={{ width: `${progress * 100}%` }} />
        </div>
        <p className={styles.goalMeta}>
          <span>Target {formatCompactMoney(result.targetPrice)}</span>
          <span className={styles[status.tone]}>{status.text}</span>
        </p>
        {result.quote && <p className={styles.goalMeta}>Your rate today: {formatRate(result.quote.rate.total)}</p>}
      </div>

      <div className={styles.group}>
        <p className={styles.groupLabel}>What the lender checks</p>
        <dl className={styles.rows}>
          <PrimaryRow
            stat="score"
            value={stats.score}
            changes={changes}
            tone={scoreTone(stats.score)}
            detail={`needs ${MIN_CREDIT_SCORE}+`}
            tooltip={scoreTooltip}
          />
          <PrimaryRow stat="dti" value={stats.dti} changes={changes} detail="before housing" />
          <PrimaryRow stat="cash" value={stats.cash} changes={changes} />
        </dl>
      </div>

      <dl className={styles.secondary}>
        <SecondaryRow
          stat="utilization"
          value={stats.utilization}
          changes={changes}
          tone={utilizationTone(stats.utilization)}
        />
        <SecondaryRow stat="monthlySavings" value={stats.monthlySavings} changes={changes} />
      </dl>
    </section>
  )
}
