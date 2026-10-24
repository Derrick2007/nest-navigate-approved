import { CARDS } from '../data/cards'
import type { Delta } from '../engine/preview'
import type { CardId } from '../engine/types'
import type { AmountSliderProps } from './AmountSlider'
import { Card } from './Card'
import styles from './Hand.module.css'

type Props = {
  hand: CardId[]
  previews: Delta[][]
  unavailable: (string | null)[]
  /** One entry per card; set only for slider cards. */
  sliders: (AmountSliderProps | undefined)[]
  monthsLeft: number
  /** An event is waiting for a choice, so cards can be read but not played yet. */
  locked: boolean
  onPlay: (handIndex: number) => void
}

/** This month's cards. Arrays are indexed by hand position, since a hand can hold two copies. */
export function Hand({ hand, previews, unavailable, sliders, monthsLeft, locked, onPlay }: Props) {
  if (hand.length === 0) {
    return <p className={styles.empty}>You've played every card this month. End the month when you're ready.</p>
  }
  return (
    <div className={styles.wrap}>
      {locked && <p className={styles.lockedNote}>Choose an option for this month's event above to unlock your cards.</p>}
      <div className={`${styles.hand} ${locked ? styles.locked : ''}`}>
        {hand.map((id, index) => (
          <Card
            // Position plus id: stable within a month, and unique even for duplicate cards.
            key={`${index}-${id}`}
            card={CARDS[id]}
            preview={previews[index]}
            unavailable={unavailable[index]}
            slider={sliders[index]}
            monthsLeft={monthsLeft}
            shortcut={index + 1}
            locked={locked}
            action={{ label: 'Play', onClick: () => onPlay(index) }}
          />
        ))}
      </div>
    </div>
  )
}
