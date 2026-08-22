/**
 * @medieval-kit/linen-sack
 *
 * Grain sack with its mouth tied off by a cord. Storeroom, mill, market stall,
 * cart — one of the kit's most widely placeable pieces.
 *
 * What makes a sack a sack is that it TAKES THE SHAPE of what is inside it. So
 * the body is not a cylinder: it spreads out at the bottom under the weight of
 * the grain, bulges in the middle, and gathers towards the mouth. Then
 * `roughenGeometry` breaks up the surface, because nothing about a full sack
 * is flat.
 *
 * The bottom corners are a separate matter: a real sack pulls in at its four
 * corners and those corners stick out like ears. Without them the model looked
 * like a vase.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface LinenSackConfig {
  /** Total height (metres). */
  readonly height: number
  /** Radius at the widest point (metres). */
  readonly radius: number
  /** How full it is. 1 = packed solid, 0.4 = half empty and slumped. */
  readonly fill: number
  /** Cloth left above the mouth, as a fraction of the height. */
  readonly collar: number
  /** Gathered ears at the bottom. */
  readonly ears: number
  readonly seed: number
}

export const linenSackDefaults: LinenSackConfig = {
  height: 0.52,
  radius: 0.16,
  fill: 0.85,
  // A hand's width of gathered cloth above the cord, not a fifth of the sack.
  collar: 0.1,
  ears: 4,
  seed: 53,
}

export type LinenSackParts = 'body' | 'collar' | 'cord'

export function createModel(overrides: Partial<LinenSackConfig> = {}) {
  return createKitModel<LinenSackConfig, 'cloth', LinenSackParts>({
    id: 'linen-sack',
    defaults: linenSackDefaults,
    slots: ['cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const fill = Math.max(0.15, Math.min(1, config.fill))
      // Where the neck sits: high on a full sack, low on an empty one.
      const neckY = half - config.height * config.collar
      const bodyTop = neckY - config.height * 0.06

      // --- Body -----------------------------------------------------------
      // The profile depends on the fill: an under-filled sack both drops and
      // spreads sideways. Letting a single `fill` number change the whole
      // silhouette means one model can produce both a full and a half-empty
      // sack.
      const wide = config.radius * (0.72 + fill * 0.36)
      // A sack, not an amphora.
      //
      // The old profile put its widest point a quarter of the way up and then
      // narrowed all the way to the neck, which is the silhouette of a vase.
      // A filled sack does the opposite: it SPREADS where it meets the ground,
      // because the grain settles and the cloth has no stiffness, then runs
      // close to parallel up most of its height, and only gathers in sharply
      // where the cord is tied. Nearly the whole difference between the two
      // shapes is in the bottom level and in where the taper begins.
      const profile: Level[] = [
        { y: -half, radius: wide * 0.93 },
        { y: -half + config.height * 0.07, radius: wide },
        { y: -half + config.height * 0.44 * fill, radius: wide },
        { y: -half + config.height * 0.72 * fill, radius: wide * 0.9 },
        { y: bodyTop - config.height * 0.09, radius: wide * 0.52 },
        { y: bodyTop, radius: config.radius * 0.25 },
      ]
      const body = latheGeometry(profile, 11, [0, 0, 0], tint('cloth', -0.06, 1.3), {
        colourTop: tint('cloth', 0.05, 1.3),
      })
      // Cloth is not rigid: here the surface break-up is the texture itself.
      roughenGeometry(body, config.radius * 0.05, { salt: 21, scaleY: 0.7 })

      const pieces: BufferGeometry[] = [body]

      // --- Bottom ears ------------------------------------------------------
      // A sack gathers at the seam and its corners jut outwards. Without them
      // the cylinder comes out as a vase.
      const ears = Math.max(0, Math.round(config.ears))
      for (let i = 0; i < ears; i += 1) {
        const angle = (i / ears) * Math.PI * 2 + jitter(random, 0.12)
        const reach = wide * (0.3 + random() * 0.16)
        const ear = boxGeometry(
          [reach, config.height * 0.05, config.radius * 0.2],
          [reach * 0.36, 0, 0],   // keep the root INSIDE the body
          tint('cloth', -0.1, 1.2),
        )
        // Orient first, then translate — the reverse order flings the ear off
        // into orbit.
        ear.rotateZ(-0.22 + jitter(random, 0.1))
        ear.rotateY(-angle)
        ear.translate(
          Math.sin(angle) * wide * 0.6,
          -half + config.height * 0.035,
          Math.cos(angle) * wide * 0.6,
        )
        pieces.push(ear)
      }

      // --- Mouth allowance ---------------------------------------------------
      // The cloth left ABOVE the tie, flopping outwards. This is what separates
      // a sack from a sealed bag: a tied mouth always has some cloth to spare.
      const collarPieces: BufferGeometry[] = []
      const flare: Level[] = [
        // Starts BELOW the body's top, not above it. It used to begin at
        // neckY − 0.02·h while the body ended at neckY − 0.06·h, so the collar
        // and the cord were a separate island hanging over the sack.
        { y: bodyTop - config.height * 0.03, radius: config.radius * 0.36 },
        { y: neckY - config.height * 0.02, radius: config.radius * 0.3 },
        { y: neckY + config.height * 0.03, radius: config.radius * 0.27 },
        // The tuft above the tie opens only a little. Flaring to 0.46 of the
        // radius turned the top of a sack into the mouth of a bottle, which is
        // the last thing left reading as a vessel once the body was fixed.
        { y: half - config.height * 0.02, radius: config.radius * 0.33 },
        { y: half, radius: config.radius * 0.27 },
      ]
      const collar = latheGeometry(flare, 9, [0, 0, 0], tint('cloth', 0.02, 1.3), {
        colourTop: tint('cloth', 0.1, 1.3),
        capTop: true,
      })
      roughenGeometry(collar, config.radius * 0.035, { salt: 22, scaleY: 0.6 })
      collarPieces.push(collar)

      // --- Cord ---------------------------------------------------------------
      const cord = bandGeometry(config.radius * 0.29, neckY, config.height * 0.035,
        config.radius * 0.045, 9, tint('cloth', -0.24, 0.8), { inner: true })

      return {
        body: { slot: 'cloth' as const, geometry: mergeColoured(pieces) },
        collar: { slot: 'cloth' as const, geometry: mergeColoured(collarPieces) },
        cord: { slot: 'cloth' as const, geometry: mergeColoured([cord]) },
      }
    },
  }, overrides)
}
