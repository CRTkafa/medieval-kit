/**
 * @medieval-kit/wooden-bucket
 *
 * A bucket is really a small barrel: tapering staves, an iron hoop, a base sunk
 * inside. It using the same `staveGeometry` as the barrel is no accident — so
 * that when the two stand side by side you read at a glance that they come from
 * the same catalogue.
 *
 * Where it differs from the barrel: conical (no belly), open at the top, and it
 * has an iron handle.
 */
import { Color, type BufferGeometry } from 'three'

import {
  MEDIEVAL_PALETTE,
  arcBarGeometry,
  bandGeometry,
  createKitModel,
  headGeometry,
  jitter,
  mergeColoured,
  staveGeometry,
  type Level,
} from '../core/index.ts'

export interface WoodenBucketConfig {
  /** Height (metres). */
  readonly height: number
  /** Mouth radius. The base is always narrower. */
  readonly radius: number
  /** How far the base narrows against the mouth. 0.25 = base at 75% width. */
  readonly taper: number
  /** Stave count. */
  readonly staveCount: number
  /** Iron hoop count. */
  readonly hoopCount: number
  /** Handle present (1) or not (0). */
  readonly handle: number
  readonly seed: number
}

export const woodenBucketDefaults: WoodenBucketConfig = {
  height: 0.32,
  radius: 0.15,
  taper: 0.26,
  staveCount: 11,
  hoopCount: 2,
  handle: 1,
  seed: 5,
}

export type WoodenBucketParts = 'staves' | 'base' | 'hoops' | 'handle'

/** t ∈ [0,1], 0 = base, 1 = mouth. */
function profileAt(t: number, taper: number): number {
  return 1 - taper * (1 - t)
}

export function createModel(overrides: Partial<WoodenBucketConfig> = {}) {
  return createKitModel<WoodenBucketConfig, 'oak' | 'iron', WoodenBucketParts>({
    id: 'wooden-bucket',
    defaults: woodenBucketDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      const half = config.height / 2
      const wall = config.radius * 0.11
      const tint = new Color()

      // --- wall staves ---
      const step = (Math.PI * 2) / config.staveCount
      // NO GAP between the staves. On the barrel a visible seam looked good,
      // but a bucket carries water: the 4 mm slots between the 11 staves turned
      // the bucket into a sieve. The seam now reads out of the per-stave radius
      // deviation — every stave that comes out slightly different from its
      // neighbour casts its own shadow, without leaving a hole.
      const gap = 0
      const levels = [0, 0.5, 1]
      const staves: BufferGeometry[] = []

      for (let i = 0; i < config.staveCount; i += 1) {
        const bias = 1 + jitter(random, 0.006)
        const rimBias = jitter(random, 0.004)
        const shaped: Level[] = levels.map((t, index) => ({
          y: -half + t * config.height + (index === levels.length - 1 ? rimBias : 0),
          radius: config.radius * profileAt(t, config.taper) * bias,
        }))
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.014), jitter(random, 0.05), jitter(random, 0.06))
        staves.push(staveGeometry(shaped, i * step + gap / 2, (i + 1) * step - gap / 2, wall, tint))
      }

      // --- base: seats inside the body ---
      const baseRadius = config.radius * profileAt(0, config.taper) - wall * 0.85
      tint.copy(MEDIEVAL_PALETTE.oakEnd)
      tint.offsetHSL(0, jitter(random, 0.03), jitter(random, 0.04))
      const base = headGeometry(baseRadius, -half + config.height * 0.07, config.staveCount, 'up', tint, 3, 0.05)

      // --- iron hoops ---
      const hoops: BufferGeometry[] = []
      for (let i = 0; i < config.hoopCount; i += 1) {
        // From the top and the bottom inwards; a single hoop sits in the middle.
        const t = config.hoopCount === 1 ? 0.5 : 0.14 + (0.72 * i) / (config.hoopCount - 1)
        tint.copy(MEDIEVAL_PALETTE.iron)
        tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.05))
        hoops.push(bandGeometry(
          config.radius * profileAt(t, config.taper) + config.radius * 0.02,
          -half + t * config.height,
          config.height * 0.055,
          config.radius * 0.05,
          config.staveCount,
          tint,
        ))
      }

      // --- handle (bail): a half arc just above the mouth ---
      let handle: BufferGeometry | undefined
      if (config.handle >= 0.5) {
        tint.copy(MEDIEVAL_PALETTE.iron)
        tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.04))
        const span = config.radius * profileAt(1, config.taper) + config.radius * 0.02
        // The arc is produced in the XY plane; since the bucket's axis is Y it
        // stands as it is, and is only shifted up level with the mouth.
        handle = arcBarGeometry(span, config.radius * 0.055, 0, Math.PI, 9, [0, half * 0.92, 0], tint)
      }

      return {
        staves: { slot: 'oak', geometry: mergeColoured(staves) },
        base: { slot: 'oak', geometry: base },
        hoops: hoops.length ? { slot: 'iron', geometry: mergeColoured(hoops) } : undefined,
        handle: handle ? { slot: 'iron', geometry: handle } : undefined,
      }
    },
  }, overrides)
}
