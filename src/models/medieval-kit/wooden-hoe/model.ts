/**
 * @medieval-kit/wooden-hoe
 *
 * Gooseneck field hoe: an ash shaft, a forged iron neck curving forward and
 * down from the tip of the shaft, and a dished blade at the end of it.
 *
 * THIRD attempt, and both of the earlier ones missed the same thing: the
 * GOOSENECK. What makes a hoe a hoe is not the blade, it is the curved neck
 * that carries the blade FORWARD off the axis of the shaft. Without it what
 * you get is a flat sheet balanced on top of a post — in the render it read
 * exactly as "lectern", "music stand", "road sign". The neck also adds negative
 * space to the silhouette: that gap between shaft and blade is what tells the
 * object apart from a distance.
 *
 * In the second attempt I tried to curve the blade with `bendGeometry` and
 * wrote in the comment "this single detail solves the real problem in the
 * silhouette". Measuring showed that was wrong: because the blade was built
 * CENTRED on y=0 the bend was symmetric, both ends went the same way and the
 * middle stayed where it was. On a 0.235 m blade the Z range DROPPED from
 * 0.0337 to 0.0327, i.e. the curve was not visible in the silhouette at all.
 * With the same blade built base-at-origin the run-out is 44 mm. Now both the
 * neck and the blade are started from the origin.
 */
import type { BufferGeometry } from 'three'

import {
  bendGeometry,
  chamferedBoxGeometry,
  createKitModel,
  ironTint,
  steelTint,
  jitter,
  latheGeometry,
  mergeColoured,
  toolShaft,
  toolSocket,
  type Level,
} from '../core/index.ts'

export interface WoodenHoeConfig {
  /** Shaft length (metres). */
  readonly length: number
  readonly shaftRadius: number
  /** Width of the blade (metres). */
  readonly bladeWidth: number
  /** Total sweep of the gooseneck (degrees). 0 = straight neck, no longer a hoe. */
  readonly neckSweep: number
  /** Dish of the blade. 0 = flat sheet. */
  readonly dish: number
  readonly seed: number
}

export const woodenHoeDefaults: WoodenHoeConfig = {
  length: 1.14,
  shaftRadius: 0.021,
  bladeWidth: 0.2,
  neckSweep: 112,
  dish: 1,
  seed: 23,
}

export type WoodenHoeParts = 'shaft' | 'socket' | 'blade'

export function createModel(overrides: Partial<WoodenHoeConfig> = {}) {
  return createKitModel<WoodenHoeConfig, 'oak' | 'iron' | 'steel', WoodenHoeParts>({
    id: 'wooden-hoe',
    defaults: woodenHoeDefaults,
    slots: ['oak', 'iron', 'steel'],
    build: ({ config, random }) => {
      const shaft = toolShaft({ length: config.length, radius: config.shaftRadius, random })
      const socketLength = config.length * 0.075
      const socket = toolSocket({
        y: shaft.top - socketLength * 0.42,
        shaftRadius: shaft.topRadius,
        length: socketLength,
        random,
      })

      // --- Gooseneck ----------------------------------------------------------
      // It is built with its base AT THE ORIGIN and bent from there; centred on
      // y=0 it would bend symmetrically and nothing would happen.
      //
      // `latheGeometry` was chosen because it has intermediate levels: bending
      // a two-level box gives you a warped box, not an arc.
      const neckLength = config.length * 0.17
      const bar = config.shaftRadius * 0.85
      const sweep = (config.neckSweep * Math.PI) / 180
      const curvature = sweep / neckLength

      const neckLevels: Level[] = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6
        return { y: neckLength * t, radius: bar * (1.05 - 0.28 * t) }
      })
      const neck = latheGeometry(neckLevels, 5, [0, 0, 0], ironTint(random, -0.02), {
        colourTop: ironTint(random, 0.04),
      })
      // A forged neck is not round but FLAT: it is hammered out crosswise. The
      // scaling is BEFORE the bend and only in X — scaling in Z would ruin the
      // plane of the arc.
      neck.scale(1.75, 1, 0.62)
      bendGeometry(neck, curvature)
      neck.translate(0, shaft.top - neckLength * 0.12, 0)

      // The TIP of the neck and the tangent there come out of the arc mapping
      // itself — computed instead of placed by eye, so that when `neckSweep`
      // changes the blade follows on its own.
      const tipY = shaft.top - neckLength * 0.12 + Math.sin(sweep) / curvature
      const tipZ = (1 - Math.cos(sweep)) / curvature

      // --- Blade ---------------------------------------------------------------
      // Continues from the tip of the neck. Built base-at-origin so that the
      // dish is actually visible.
      const bladeLength = config.length * 0.115
      const thick = config.length * 0.028
      const thin = config.length * 0.006
      const blade = chamferedBoxGeometry(
        [config.bladeWidth * 0.72, thick],
        [config.bladeWidth, thin],
        bladeLength,
        thin * 0.6,
        [0, bladeLength / 2, 0],
        steelTint(random, -0.04),
        steelTint(random, 0.05),
      )
      // Dish: the cutting edge curves back towards the user, so that it can hold
      // the soil in front of it. NEGATIVE curvature, otherwise the hoe turns
      // into a scoop that pushes the soil away from itself.
      if (config.dish > 0) bendGeometry(blade, (-0.9 * config.dish) / bladeLength)
      // A forged blade is not perfectly symmetric.
      blade.rotateY(jitter(random, 0.04))
      // Align to the tangent at the neck tip, then move it there — order is critical.
      blade.rotateX(sweep)
      blade.translate(0, tipY, tipZ)

      // Collar: the forged thickening where the neck meets the blade. The only
      // detail that answers how the two pieces hold on to each other.
      const collar = latheGeometry([
        { y: -bar * 0.9, radius: bar * 1.05 },
        { y: 0, radius: bar * 1.5 },
        { y: bar * 1.1, radius: bar * 1.15 },
      ], 6, [0, 0, 0], ironTint(random, 0.06))
      collar.scale(1.7, 1, 0.7)
      collar.rotateX(sweep)
      collar.translate(0, tipY, tipZ)

      const ironwork: BufferGeometry = mergeColoured([socket, neck, collar])

      return {
        shaft: { slot: 'oak', geometry: shaft.geometry },
        socket: { slot: 'iron', geometry: ironwork },
        blade: { slot: 'steel', geometry: mergeColoured([blade]) },
      }
    },
  }, overrides)
}
