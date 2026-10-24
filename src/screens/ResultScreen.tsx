import { useMemo } from 'react'
import { formatCompactMoney, formatMoney, formatRate } from '../engine/format'
import { pickLessons } from '../engine/lessons'
import { randomSeed } from '../engine/rng'
import type { PlayerState } from '../engine/types'
import { MIN_CREDIT_SCORE, underwrite, WHAT_IF_SCORE_BUMP, type UnderwritingResult } from '../engine/underwrite'
import { useGame } from '../hooks/useGame'
import styles from './ResultScreen.module.css'

type Tone = 'good' | 'warn' | 'bad'

function headline(result: UnderwritingResult): { badge: string; text: string; tone: Tone } {
  const target = formatCompactMoney(result.targetPrice)
  if (result.outcome === 'APPROVED') {
    return { badge: 'Approved', text: `You qualify for your ${target} target home.`, tone: 'good' }
  }
  if (result.outcome === 'APPROVED_SMALLER') {
    const short = formatCompactMoney(result.targetPrice - result.maxPrice!)
    return {
      badge: 'Approved for less',
      text: `You qualify for ${formatCompactMoney(result.maxPrice!)}, ${short} below your ${target} target.`,
      tone: result.farBelowTarget ? 'bad' : 'warn',
    }
  }
  if (result.denialReason === 'credit') {
    return {
      badge: 'Denied',
      text: `Your credit score of ${result.credit.score} is below the ${MIN_CREDIT_SCORE} minimum.`,
      tone: 'bad',
    }
  }
  return {
    badge: 'Denied',
    text: 'There was not enough cash for a 3% down payment plus closing costs and reserves.',
    tone: 'bad',
  }
}

/** Which number stopped them, and the lever that would have moved it. */
const CONSTRAINT_COPY = {
  dti: {
    title: 'You were limited by debt-to-income',
    text: 'Your monthly debts plus the mortgage hit the 43% limit. Removing a monthly payment, like paying off the car, or raising verified income is what moves it.',
  },
  cash: {
    title: 'You were limited by cash',
    text: "You ran out of cash for the down payment, closing costs and reserves. Saving more, and not draining savings into loan balances, is what moves it.",
  },
  credit: {
    title: 'You were stopped by your credit score',
    text: `Below ${MIN_CREDIT_SCORE} the Underwriter doesn't look any further. Payment history and card utilization are the biggest parts of a score.`,
  },
} as const

function whatIfText(result: UnderwritingResult): string | null {
  const { quote, whatIf } = result
  if (result.denialReason === 'credit') {
    const gap = MIN_CREDIT_SCORE - result.credit.score
    return `You were ${gap} point${gap === 1 ? '' : 's'} short. A ${WHAT_IF_SCORE_BUMP}-point higher score would have opened the door.`
  }
  if (!quote || !whatIf) return null
  if (whatIf.rate.total >= quote.rate.total) {
    return 'Your score already earns the best rate tier, so a higher score would not lower your rate.'
  }
  const saved = quote.totalInterest - whatIf.totalInterest
  return `With a score ${WHAT_IF_SCORE_BUMP} points higher, your rate would be ${formatRate(whatIf.rate.total)} instead of ${formatRate(quote.rate.total)}, and you'd pay ${formatMoney(saved)} less in interest over 30 years.`
}

export function ResultScreen({ player }: { player: PlayerState }) {
  const { dispatch } = useGame()
  const result = useMemo(() => underwrite(player), [player])
  const lessons = useMemo(() => pickLessons(player), [player])
  const head = headline(result)
  const limit = result.denialReason === 'credit' ? 'credit' : result.bindingConstraint
  // An approved player wasn't "limited"; the same fact is framed as what set their ceiling.
  const limitTitle =
    limit && result.outcome === 'APPROVED'
      ? `Your ${formatCompactMoney(result.maxPrice!)} ceiling was set by ${limit === 'dti' ? 'debt-to-income' : 'cash'}`
      : limit && CONSTRAINT_COPY[limit].title
  const whatIf = whatIfText(result)
  const { quote } = result

  return (
    <div className={styles.screen}>
      <header className={`${styles.hero} ${styles[head.tone]}`}>
        <p className={styles.badge}>{head.badge}</p>
        <p className={styles.headline}>{head.text}</p>
      </header>

      {quote && (
        <dl className={styles.numbers}>
          <div className={styles.number}>
            <dt>Home price</dt>
            <dd>{formatCompactMoney(quote.price)}</dd>
          </div>
          <div className={styles.number}>
            <dt>Interest rate</dt>
            <dd>{formatRate(quote.rate.total)}</dd>
          </div>
          <div className={styles.number}>
            <dt>Monthly payment</dt>
            <dd>{formatMoney(quote.piti.total)}</dd>
          </div>
          <div className={styles.number}>
            <dt>Interest over 30 years</dt>
            <dd>{formatMoney(quote.totalInterest)}</dd>
          </div>
        </dl>
      )}

      <div className={styles.insights}>
        {limit && (
          <section className={styles.insight}>
            <h2 className={styles.insightTitle}>{limitTitle}</h2>
            <p>{CONSTRAINT_COPY[limit].text}</p>
          </section>
        )}
        {whatIf && (
          <section className={styles.insight}>
            <h2 className={styles.insightTitle}>What if your score were higher?</h2>
            <p>{whatIf}</p>
          </section>
        )}
      </div>

      {lessons.length > 0 && (
        <section className={styles.lessons} aria-labelledby="lessons-title">
          <h2 id="lessons-title" className={styles.sectionTitle}>
            What your year taught you
          </h2>
          <ol className={styles.lessonList}>
            {lessons.map((lesson) => (
              <li key={lesson.source} className={styles.lesson}>
                <p className={styles.lessonSource}>{lesson.source}</p>
                <p>{lesson.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className="button button-primary"
          onClick={() => dispatch({ type: 'START', seed: randomSeed() })}
        >
          Play again
        </button>
        <button type="button" className="button" onClick={() => dispatch({ type: 'START', seed: player.seed })}>
          Replay this year
        </button>
        <p className={styles.seedNote}>Same events and cards, different choices.</p>
      </div>
    </div>
  )
}
