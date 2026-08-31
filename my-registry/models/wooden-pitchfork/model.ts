/**
 * @medieval-kit/wooden-pitchfork
 *
 * What tells a pitchfork apart from a distance is the gap between the tines.
 * That is why the tine count and their spread decide the whole silhouette.
 *
 * In my first version the tines were boxes of square section and every one of
 * them was identical. A real tine is forged and round, it tapers towards the
 * point, and none of them sits at exactly the same angle as its neighbour. All
 * three were fixed here.
 */
import { Color, type BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  ironTint,
  jitter,
  bendGeometry,
  latheGeometry,
  mergeColoured,
  toolShaft,
  toolSocket,
  type Level,
} from '../core/index.ts'

export interface WoodenPitchforkConfig {
  readonly length: number
  readonly shaftRadius: number
  /** Number of tines. */
  readonly tineCount: number
  /** How far the tines splay outwards (radians). */
  readonly spread: number
  /** Tine length, as a fraction of the total length. */
  readonly tineLength: number
  readonly seed: number
}

export const woodenPitchforkDefaults: WoodenPitchforkConfig = {
  length: 1.5,
  shaftRadius: 0.021,
  // Four tines and longer ones. Three is a garden fork; a hay fork has four
  // or five, and the tines are the working length of the tool -- at 0.24 on a
  // 1.5 m shaft they were 16% of it against roughly 22% in the reference, and
  // read as stubs rather than as something you could lift a forkful with.
  // Tines run close to parallel, splaying only a little. Fanned out like a
  // claw they read as a garden cultivator; a hay fork's tines stay together
  // so a forkful stays on them.
  tineCount: 4,
  spread: 0.15,
  tineLength: 0.34,
  seed: 37,
}

export type WoodenPitchforkParts = 'shaft' | 'socket' | 'tines'

export function createModel(overrides: Partial<WoodenPitchforkConfig> = {}) {
  return createKitModel<WoodenPitchforkConfig, 'oak' | 'iron', WoodenPitchforkParts>({
    id: 'wooden-pitchfork',
    defaults: woodenPitchforkDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const tineSpan = config.length * config.tineLength
      const shaftLength = config.length - tineSpan * 0.86
      const shaft = toolShaft({ length: shaftLength, radius: config.shaftRadius, random })

      const socketLength = config.length * 0.045
      const socket = toolSocket({
        y: shaft.top - socketLength * 0.3,
        shaftRadius: shaft.topRadius,
        length: socketLength,
        random,
      })

      const count = Math.max(2, config.tineCount)
      const base = shaft.top + config.length * 0.006
      const pieces: BufferGeometry[] = []

      // Cross forging: flat iron tying the tines to the socket. Thins towards the ends.
      //
      // Sized FROM the tine roots so it cannot overhang them. It was
      // `shaftRadius * 2.6 * count`, which has nothing to do with where the
      // tines actually sit: at four tines the bar came to 229 mm across while
      // the outermost root sat 55 mm from the centre, so 59 mm of iron stuck out
      // past the last tine at each end and finished in a flat slab holding
      // nothing. The bar now ends just outboard of the outer roots, which is
      // where a forged head ends.
      const rootHalf = config.shaftRadius * 2.5
      const crossWidth = (rootHalf + config.shaftRadius * 1.3) * 2
      pieces.push(chamferedBoxGeometry(
        [crossWidth, config.shaftRadius * 2],
        [crossWidth * 0.94, config.shaftRadius * 1.3],
        config.length * 0.026,
        config.shaftRadius * 0.25,
        [0, base, 0],
        ironTint(random, -0.03),
      ))

      for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1
        // A tine must be THICK. In the first version the radius was half the
        // shaft's, i.e. 1 cm, and from a distance the model looked like three
        // hairs. A real pitchfork tine is forged iron 2–3 cm across and takes up
        // as much of the silhouette as the shaft itself.
        const radius = config.shaftRadius * 0.88
        const profile: Level[] = [
          { y: 0, radius: radius * 1.2 },
          { y: tineSpan * 0.2, radius },
          { y: tineSpan * 0.66, radius: radius * 0.78 },
          { y: tineSpan * 0.9, radius: radius * 0.42 },
          { y: tineSpan, radius: radius * 0.12 },  // pointed but not zero
        ]
        // Oak, not steel. The model is called wooden-pitchfork and the
        // reference is exactly that: a hay fork was cut and steamed from wood,
        // because iron tines are heavy at the end of a long shaft and hay does
        // not need an edge. The socket stays iron -- that is the ferrule.
        const tine = latheGeometry(profile, 6, [0, 0, 0], new Color(tint('oak', -0.03)), {
          capTop: false,
          colourTop: new Color(tint('oakEnd', 0.06)),
        })
        // Curve: a straight tine looks like a technical drawing. A real pitchfork
        // tine is bent forward — so it does not drop the straw it has lifted.
        bendGeometry(tine, 0.42 / tineSpan + jitter(random, 0.06 / tineSpan))
        // Each tine sits at a slightly different angle from its neighbour: a
        // forged pitchfork is never perfectly symmetric, and this single detail
        // stops it from looking "manufactured".
        tine.rotateZ(-t * config.spread + jitter(random, 0.02))
        tine.rotateX(jitter(random, 0.025))
        tine.translate(t * rootHalf, base + config.length * 0.008, 0)
        pieces.push(tine)
      }

      return {
        shaft: { slot: 'oak', geometry: shaft.geometry },
        socket: { slot: 'iron', geometry: socket },
        tines: { slot: 'oak', geometry: mergeColoured(pieces) },
      }
    },
  }, overrides)
}
