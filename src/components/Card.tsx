import { useId } from 'react'
import type { CardDef } from '../data/cards'
import { formatPercent } from '../engine/format'
import type { Delta } from '../engine/preview'
import styles from './Card.module.css'
import { DeltaPreview } from './DeltaPreview'

type Props = {
  card: CardDef
  preview: Delta[]
  /** Why it can't be played right now, or null. */
  unavailable: string | null
  onPlay: () => void
}

/** One financial move: what it costs, what it does, and its preview, before you commit. */
export function Card({ card, preview, unavailable, onPlay }: Props) {
  // useId, not card.id: a hand can hold two copies of the same card.
  const titleId = useId()
  return (
    <article className={`${styles.card} ${unavailable ? styles.unavailable : ''}`} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h3 id={titleId} className={styles.name}>
          {card.name}
        </h3>
        <span className={styles.cost} aria-label={`Costs ${card.cost} energy`}>
          {Array.from({ length: card.cost }, (_, i) => (
            <span key={i} className={styles.costPip} />
          ))}
        </span>
      </header>

      <p className={styles.description}>{card.description}</p>

      {(card.once || card.odds !== undefined) && (
        <p className={styles.tags}>
          {card.odds !== undefined && <span className={styles.tag}>{formatPercent(card.odds)} chance</span>}
          {card.once && <span className={styles.tag}>One-time</span>}
        </p>
      )}

      {/* Unplayable cards drop their preview: the reason is all the player needs. */}
      {!unavailable && (
        <div className={styles.preview}>
          <p className={styles.previewLabel}>{card.odds !== undefined ? 'If it works' : 'If you play it'}</p>
          <DeltaPreview deltas={preview} />
        </div>
      )}

      <footer className={styles.footer}>
        {unavailable ? (
          <p className={styles.reason}>{unavailable}</p>
        ) : (
          <button type="button" className="button button-primary" onClick={onPlay}>
            Play
          </button>
        )}
      </footer>
    </article>
  )
}
