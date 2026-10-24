import { CARDS } from '../data/cards'
import type { Delta } from '../engine/preview'
import type { CardId } from '../engine/types'
import { Card } from './Card'
import styles from './Hand.module.css'

type Props = {
  hand: CardId[]
  previews: Delta[][]
  unavailable: (string | null)[]
  onPlay: (handIndex: number) => void
}

/** This month's cards. Arrays are indexed by hand position, since a hand can hold two copies. */
export function Hand({ hand, previews, unavailable, onPlay }: Props) {
  if (hand.length === 0) {
    return <p className={styles.empty}>You've played every card this month. End the month when you're ready.</p>
  }
  return (
    <div className={styles.hand}>
      {hand.map((id, index) => (
        <Card
          // Position plus id: stable within a month, and unique even for duplicate cards.
          key={`${index}-${id}`}
          card={CARDS[id]}
          preview={previews[index]}
          unavailable={unavailable[index]}
          onPlay={() => onPlay(index)}
        />
      ))}
    </div>
  )
}
