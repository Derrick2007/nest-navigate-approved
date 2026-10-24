import { useMemo } from 'react'
import { createInitialState } from '../data/initialState'
import { formatCompactMoney, formatMoney, formatPercent } from '../engine/format'
import { snapshot } from '../engine/preview'
import { MAX_DTI, MIN_CREDIT_SCORE } from '../engine/underwrite'
import { randomSeed } from '../engine/rng'
import { useGame } from '../hooks/useGame'
import styles from './StartScreen.module.css'

/** Introduces the goal and the three numbers a lender checks, before the first month. */
export function StartScreen() {
  const { dispatch } = useGame()
  // Computed from the real starting state, so the intro can never disagree with the game.
  const start = useMemo(() => {
    const state = createInitialState(0)
    return { state, stats: snapshot(state) }
  }, [])

  const numbers = [
    {
      name: 'Credit score',
      yours: String(start.stats.score),
      text: `How reliably you've handled credit, from 300 to 850. Under ${MIN_CREDIT_SCORE}, most lenders say no. Higher scores get cheaper rates.`,
    },
    {
      name: 'Debt-to-income (DTI)',
      yours: `${formatPercent(start.stats.dti, 1)} before housing`,
      text: `Your monthly debt payments plus the new mortgage, divided by your income. It has to stay under ${formatPercent(MAX_DTI)}.`,
    },
    {
      name: 'Cash',
      yours: formatMoney(start.stats.cash),
      text: 'Pays your down payment (at least 3%), closing costs (about 3%) and two months of payments held in reserve.',
    },
  ]

  return (
    <div className={styles.screen}>
      <header className={styles.hero}>
        <p className={styles.kicker}>A 12-month mortgage-readiness game</p>
        <h1 className={styles.title}>Approved</h1>
        <p className={styles.setup}>
          You earn $90,000 a year, rent in the city, and want a{' '}
          <strong>{formatCompactMoney(start.state.targetPrice)} starter home</strong> a year from now. If you applied
          today, a lender would approve you for about <strong>{formatCompactMoney(start.stats.maxPrice)}</strong>. You
          have 12 months of choices to close the gap.
        </p>
      </header>

      <section aria-labelledby="numbers-title" className={styles.numbersSection}>
        <h2 id="numbers-title" className={styles.sectionTitle}>
          A lender reads three numbers
        </h2>
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
      </section>

      <details className={styles.howTo}>
        <summary>How to play</summary>
        <ul>
          <li>Each month you get paid, face one life event, then spend up to 3 energy on cards.</li>
          <li>Every card shows what it will change before you play it. Green helps, red hurts.</li>
          <li>Keep an eye on your max home price. It's the most house you'd be approved for today.</li>
          <li>After month 12, the Underwriter checks your numbers and builds your interest rate.</li>
          <li>On a keyboard: number keys play a card or pick an event option, E ends the month.</li>
        </ul>
      </details>

      <div className={styles.actions}>
        <button
          type="button"
          className={`button button-primary ${styles.startButton}`}
          onClick={() => dispatch({ type: 'START', seed: randomSeed() })}
        >
          Start month 1
        </button>
        <p className={styles.disclaimer}>Lending rules are simplified for teaching. Not financial advice.</p>
      </div>
    </div>
  )
}
