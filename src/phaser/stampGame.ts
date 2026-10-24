import Phaser from 'phaser'

// The Phaser layer for the end of the underwriting reveal (docs/SPEC.md P3):
// a rubber stamp slams down, ink spatters, and an approval gets confetti.
//
// React owns all game state; this only draws. It is loaded with a dynamic
// import from ApprovalStamp.tsx, so Phaser's ~1 MB never touches the first
// page load, and the game is destroyed when the component unmounts.

export type StampOptions = {
  label: string
  /** Ink colour, e.g. '#2f7d4f'. */
  color: string
  /** Confetti for a full approval. */
  celebrate: boolean
}

const CONFETTI_COLORS = [0x2f7d4f, 0xa86a12, 0x3b82c4, 0xd94f70, 0xf2c14e]
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

class StampScene extends Phaser.Scene {
  private options: StampOptions

  constructor(options: StampOptions) {
    super('stamp')
    this.options = options
  }

  create() {
    const { width, height } = this.scale
    const ink = Phaser.Display.Color.HexStringToColor(this.options.color).color

    // Small generated textures, so there are no image files to ship.
    const g = this.make.graphics({}, false)
    g.fillStyle(0xffffff).fillRect(0, 0, 10, 6).generateTexture('confetti', 10, 6)
    g.clear().fillStyle(0xffffff).fillCircle(4, 4, 4).generateTexture('ink', 8, 8)
    g.destroy()

    // The stamp: a rounded border with the outcome inside, built in a container
    // so it scales and rotates as one piece.
    const padX = 28
    const padY = 14
    // Fit the label to the canvas: heavy capitals run about 0.65em wide each.
    const fontSize = Math.floor(Math.min(56, (width - padX * 2 - 32) / (this.options.label.length * 0.65)))
    const text = this.add
      .text(0, 0, this.options.label, {
        fontFamily: FONT,
        fontSize: `${fontSize}px`,
        fontStyle: '900',
        color: this.options.color,
      })
      .setOrigin(0.5)
    const border = this.add.graphics()
    border.lineStyle(6, ink, 1)
    border.strokeRoundedRect(
      -text.width / 2 - padX,
      -text.height / 2 - padY,
      text.width + padX * 2,
      text.height + padY * 2,
      12,
    )
    const stamp = this.add.container(width / 2, height / 2, [border, text])
    stamp.setScale(2.6).setAlpha(0).setAngle(-18)

    this.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 1,
      angle: -6,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete: () => this.land(stamp, ink),
    })
  }

  /** The moment of impact: shake, ink spatter, and confetti on approval. */
  private land(stamp: Phaser.GameObjects.Container, ink: number) {
    const { width, height } = this.scale
    this.cameras.main.shake(160, 0.012)

    this.add
      .particles(stamp.x, stamp.y, 'ink', {
        speed: { min: 60, max: 220 },
        scale: { start: 0.9, end: 0.2 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 450,
        tint: ink,
        emitting: false,
      })
      .explode(26)

    if (this.options.celebrate) {
      // Two bursts from the bottom corners, arcing up and falling back down.
      for (const [x, angle] of [
        [0, { min: -80, max: -40 }],
        [width, { min: -140, max: -100 }],
      ] as const) {
        this.add
          .particles(x, height, 'confetti', {
            angle,
            speed: { min: 380, max: 620 },
            gravityY: 700,
            rotate: { min: 0, max: 360 },
            lifespan: 2400,
            tint: CONFETTI_COLORS,
            emitting: false,
          })
          .explode(70)
      }
    }
  }
}

export function createStampGame(parent: HTMLElement, options: StampOptions): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    scene: new StampScene(options),
  })
}
