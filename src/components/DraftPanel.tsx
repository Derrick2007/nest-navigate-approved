import { CARDS } from '../data/cards'
import type { Delta } from '../engine/preview'
import type { CardId } from '../engine/types'
import { Card } from './Card'
import styles from './DraftPanel.module.css'

type Props = {
  month: number
  offer: CardId[]
  /** What each offered card would do if played right now, as a guide. */
  previews: Delta[][]
  monthsLeft: number
  onTake: (cardId: CardId) => void
  onSkip: () => void
}

/** Between months: add one of three cards to the deck, or skip. */
export function DraftPanel({ month, offer, previews, monthsLeft, onTake, onSkip }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="draft-title">
      <div className={styles.header}>
        <p className={styles.kicker}>Month {month} done</p>
        <h2 id="draft-title" className={styles.title} tabIndex={-1} data-autofocus="draft">
          Add one card to your deck
        </h2>
        <p className={styles.hint}>It goes into next month's hand. Previews show what it would do if you played it today.</p>
      </div>
      <div className={styles.cards}>
        {offer.map((id, i) => (
          <Card
            key={id}
            card={CARDS[id]}
            preview={previews[i]}
            unavailable={null}
            monthsLeft={monthsLeft}
            shortcut={i + 1}
            locked={false}
            previewLabel="If you played it today"
            action={{ label: 'Take', onClick: () => onTake(id) }}
          />
        ))}
      </div>
      <button type="button" className={`button ${styles.skip}`} onClick={onSkip} aria-keyshortcuts="E">
        Skip, keep my deck as it is
      </button>
    </section>
  )
}
