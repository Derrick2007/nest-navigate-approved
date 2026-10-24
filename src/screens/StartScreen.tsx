import { useEffect, useMemo, useRef, useState } from 'react'
import { createInitialState } from '../data/initialState'
import { formatCompactMoney, formatMoney, formatPercent } from '../engine/format'
import { snapshot } from '../engine/preview'
import { ENERGY_PER_MONTH, MONTHS } from '../engine/reducer'
import { randomSeed } from '../engine/rng'
import { MAX_DTI, MIN_CREDIT_SCORE } from '../engine/underwrite'
import { useGame } from '../hooks/useGame'
import styles from './StartScreen.module.css'

const STEP_TITLES = ['Your goal', 'A month in Approved', 'Build your year', 'Applying for the mortgage'] as const

/**
 * The intro, as four short pages the player steps through. Start only appears
 * on the last page, so everyone sees how the game works before month 1.
 */
export function StartScreen() {
  const { dispatch } = useGame()
  const [step, setStep] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const isLast = step === STEP_TITLES.length - 1

  // Computed from the real starting state, so the intro can never disagree with the game.
  const start = useMemo(() => {
    const state = createInitialState(0)
    return { state, stats: snapshot(state) }
  }, [])

  // Move focus to the new page's heading, so screen readers announce it.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  return (
    <div className={styles.screen}>
      <header className={styles.hero}>
        <p className={styles.kicker}>A 12-month mortgage-readiness game</p>
        <h1 className={styles.title}>Approved</h1>
      </header>

      <section className={styles.page} aria-labelledby="intro-step-title">
        <p className={styles.stepCount}>
          How to play · {step + 1} of {STEP_TITLES.length}
        </p>
        <h2 id="intro-step-title" ref={headingRef} tabIndex={-1} className={styles.pageTitle}>
          {STEP_TITLES[step]}
        </h2>

        {step === 0 && <GoalPage target={start.state.targetPrice} stats={start.stats} />}
        {step === 1 && <MonthPage />}
        {step === 2 && <YearPage />}
        {step === 3 && <ApplyPage />}
      </section>

      <nav className={styles.nav} aria-label="Intro pages">
        <ol className={styles.dots} aria-hidden="true">
          {STEP_TITLES.map((title, i) => (
            <li key={title} className={`${styles.dot} ${i <= step ? styles.dotDone : ''}`} />
          ))}
        </ol>
        <div className={styles.navButtons}>
          {step > 0 && (
            <button type="button" className="button" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              className={`button button-primary ${styles.startButton}`}
              onClick={() => dispatch({ type: 'START', seed: randomSeed() })}
            >
              Start month 1
            </button>
          ) : (
            <button type="button" className="button button-primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          )}
        </div>
      </nav>

      <p className={styles.disclaimer}>Lending rules are simplified for teaching. Not financial advice.</p>
    </div>
  )
}

function GoalPage({ target, stats }: { target: number; stats: ReturnType<typeof snapshot> }) {
  const numbers = [
    {
      name: 'Credit score',
      yours: String(stats.score),
      text: `How reliably you've handled credit, from 300 to 850. Under ${MIN_CREDIT_SCORE}, most lenders say no. Higher scores get cheaper rates.`,
    },
    {
      name: 'Debt-to-income (DTI)',
      yours: `${formatPercent(stats.dti, 1)} before housing`,
      text: `Your monthly debt payments plus the new mortgage, divided by your income. It has to stay under ${formatPercent(MAX_DTI)}.`,
    },
    {
      name: 'Cash',
      yours: formatMoney(stats.cash),
      text: 'Pays your down payment (at least 3%), closing costs (about 3%) and two months of payments held in reserve.',
    },
  ]
  return (
    <>
      <p className={styles.lead}>
        You earn $90,000 a year, rent in the city, and want a <strong>{formatCompactMoney(target)} starter home</strong>{' '}
        a year from now. If you applied today, a lender would approve you for about{' '}
        <strong>{formatCompactMoney(stats.maxPrice)}</strong>. You have {MONTHS} months to close the gap.
      </p>
      <p className={styles.subhead}>A lender reads three numbers:</p>
      <ul className={styles.numbers}>
        {numbers.map((n) => (
          <li key={n.name} className={styles.number}>
            <h3 className={styles.numberName}>{n.name}</h3>
            <p className={styles.numberText}>{n.text}</p>
            <p className={styles.yours}>
              You today: <strong>{n.yours}</strong>
            </p>
          </li>
        ))}
      </ul>
      <p className={styles.tension}>The catch: they pull against each other. Paying down debt costs cash.</p>
    </>
  )
}

function MonthPage() {
  return (
    <ol className={styles.steps}>
      <li>
        <strong>Get paid.</strong> Whatever's left after rent and bills goes into your cash.
      </li>
      <li>
        <strong>Handle a life event.</strong> A rent hike, a bonus, a broken-down car. Some ask you to choose how to
        deal with it.
      </li>
      <li>
        <strong>Play cards with {ENERGY_PER_MONTH} energy.</strong> Each card costs 1 or 2. Before you commit, every card
        shows exactly what it would change:
        <span className={styles.exampleChips} aria-label="For example: score up 29, cash down 1,000 dollars">
          <span className={`${styles.chip} ${styles.good}`}>
            Score <strong>+29</strong>
          </span>
          <span className={`${styles.chip} ${styles.bad}`}>
            Cash <strong>−$1,000</strong>
          </span>
        </span>
        Green helps, red hurts.
      </li>
      <li>
        <strong>End the month.</strong> Card interest comes out of your cash and your loans pay down a little.
      </li>
    </ol>
  )
}

function YearPage() {
  return (
    <ul className={styles.points}>
      <li>
        <strong>Build your deck.</strong> After each month you pick one of three new cards to add, and it shows up in
        next month's hand. What you take shapes your strategy for the rest of the year.
      </li>
      <li>
        <strong>Choose how much.</strong> Some cards have a slider. Credit card ones mark where your utilization drops
        under 30% and 10%, which is where your score jumps.
      </li>
      <li>
        <strong>Watch your max home price.</strong> It's the most house a lender would approve today, shown at the top
        left. Some moves raise it right away; others, like saving more each month, pay off later.
      </li>
    </ul>
  )
}

function ApplyPage() {
  return (
    <>
      <p className={styles.lead}>After month {MONTHS}, the Underwriter checks your file one line at a time:</p>
      <ul className={styles.checks}>
        <li>Credit score at least {MIN_CREDIT_SCORE}</li>
        <li>Enough cash for at least 3% down, closing costs and reserves</li>
        <li>Debt-to-income, mortgage included, under {formatPercent(MAX_DTI)}</li>
      </ul>
      <p className={styles.lead}>
        Then your interest rate is built up tier by tier. <strong>You win if you're approved for your target home.</strong>{' '}
        Every run plays out differently, so try again to beat your rate.
      </p>
      <p className={styles.keysTip}>
        On a keyboard: number keys play a card or pick an option, <kbd>E</kbd> ends the month.
      </p>
    </>
  )
}
