import type { EventDef } from '../data/events'
import type { Delta } from '../engine/preview'
import { DeltaPreview } from './DeltaPreview'
import styles from './EventBanner.module.css'

type Props = {
  event: EventDef
  /** True while the player still has to pick one of the choices. */
  awaitingChoice: boolean
  /** One preview per choice, in the same order as event.choices. */
  choicePreviews: Delta[][]
  onChoose: (choiceId: string) => void
}

/** This month's life event. A choice event blocks card play until the player picks. */
export function EventBanner({ event, awaitingChoice, choicePreviews, onChoose }: Props) {
  return (
    <section className={`${styles.banner} ${awaitingChoice ? styles.waiting : ''}`} aria-live="polite">
      <p className={styles.kicker}>{awaitingChoice ? 'Decide before you play cards' : 'This month'}</p>
      <h2 className={styles.name}>{event.name}</h2>
      <p className={styles.description}>{event.description}</p>

      {awaitingChoice && event.choices && (
        <div className={styles.choices}>
          {event.choices.map((choice, i) => (
            <div key={choice.id} className={styles.choice}>
              <div>
                <p className={styles.choiceLabel}>{choice.label}</p>
                <p className={styles.choiceDescription}>{choice.description}</p>
              </div>
              <DeltaPreview deltas={choicePreviews[i]} />
              <button type="button" className="button button-primary" onClick={() => onChoose(choice.id)}>
                Choose
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
