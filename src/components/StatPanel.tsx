import type { CreditBreakdown } from '../engine/credit'
import { formatCompactMoney, formatRate } from '../engine/format'
import type { StatKey, StatSnapshot } from '../engine/preview'
import { MIN_CREDIT_SCORE, type UnderwritingResult } from '../engine/underwrite'
import styles from './StatPanel.module.css'
import { formatStat, STAT_EXPLANATIONS, STAT_LABELS } from './statFormat'
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

function StatRow({ stat, value, tone = 'neutral', detail }: { stat: StatKey; value: number; tone?: Tone; detail?: string }) {
  return (
    <div className={styles.row}>
      <dt className={styles.rowLabel}>
        {STAT_LABELS[stat]}
        <StatTooltip label={STAT_LABELS[stat]}>{STAT_EXPLANATIONS[stat]}</StatTooltip>
      </dt>
      <dd className={`${styles.rowValue} ${styles[tone]}`}>
        {formatStat(stat, value)}
        {detail && <span className={styles.rowDetail}>{detail}</span>}
      </dd>
    </div>
  )
}

/** The numbers a lender reads, plus what they add up to today. */
export function StatPanel({ stats, credit, result }: Props) {
  const progress = Math.min(1, stats.maxPrice / result.targetPrice)
  const status = statusLine(result)

  return (
    <section className={styles.panel} aria-label="Your numbers">
      <div className={styles.goal}>
        <p className={styles.goalLabel}>
          {STAT_LABELS.maxPrice} today
          <StatTooltip label={STAT_LABELS.maxPrice}>{STAT_EXPLANATIONS.maxPrice}</StatTooltip>
        </p>
        <p className={styles.goalValue}>{formatStat('maxPrice', stats.maxPrice)}</p>
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

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>
            {STAT_LABELS.score}
            <StatTooltip label="how your score is built">
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
            </StatTooltip>
          </dt>
          <dd className={`${styles.rowValue} ${styles[scoreTone(stats.score)]}`}>
            {stats.score}
            <span className={styles.rowDetail}>needs {MIN_CREDIT_SCORE}+</span>
          </dd>
        </div>
        <StatRow stat="utilization" value={stats.utilization} tone={utilizationTone(stats.utilization)} />
        <StatRow stat="dti" value={stats.dti} detail="before housing" />
        <StatRow stat="cash" value={stats.cash} />
        <StatRow stat="monthlySavings" value={stats.monthlySavings} detail="per month" />
      </dl>
    </section>
  )
}
