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
  dishedSheetGeometry,
  ironTint,
  steelTint,
  jitter,
  latheGeometry,
  mergeColoured,
  toolShaft,
  toolSocket,
  type Level,
  type SheetLevel,
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
  bladeWidth: 0.23,
  // 112 stands. I lowered it to 95 after reading a render in which the blade
  // happened to sit edge-on to the camera, and mistook foreshortening for the
  // wrong angle.
  //
  // It is also worth recording that the reference generated for this model is
  // a plain strap hoe, where this one is deliberately a GOOSENECK -- a curved
  // forged neck carrying the blade ahead of the shaft axis, as the
  // description says. Both are period-correct, and bending the model towards
  // the photograph on that point would be changing the design rather than
  // fixing a fault. The blade's depth and wedge are another matter: a hoe
  // blade is the heavy end of the tool whichever neck it hangs from.
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
      // 0.17 of the tool, not 0.115. A field hoe's blade is the heavy end of
      // it -- in the reference it is close to a fifth of the whole length --
      // and at 131 mm ours read as a tab riveted to a stick.
      const bladeLength = config.length * 0.15
      const thick = config.length * 0.028
      const thin = config.length * 0.006
      // A dished sheet, not a bent box.
      //
      // The blade was a `chamferedBoxGeometry` put through `bendGeometry`.
      // That has exactly four levels in Y, and once the blade was made deep
      // enough to look right the bend had to work a 50-degree arc across those
      // four -- the cutting edge came out visibly faceted, a row of steps
      // instead of a curve. `dishedSheetGeometry` exists for this: it produces
      // one seamless concave surface whose cross-section is curved at every
      // level, which is what the shovel's blade is built from.
      //
      // The hoe is a wedge: narrow where the neck carries it, wide where it
      // meets the ground. That taper is most of what identifies the
      // silhouette, and it was nearly parallel-sided before.
      const halfEdge = config.bladeWidth / 2
      // `curve` is an absolute rise in metres, not a ratio, so it has to be
      // scaled to the blade. Written as `-0.34 * dish` it asked for a 340 mm
      // rise across a 230 mm blade -- seven times its own half-width -- and
      // the sheet came out as a pair of wings. The shovel gets this right:
      // `bladeWidth * dish`, with its own dish slider running 0 to 0.22. This
      // one's runs 0 to 2, so the coefficient differs; the quantity does not.
      const curve = config.bladeWidth * 0.13 * config.dish
      const profile: SheetLevel[] = [
        { y: 0, halfWidth: halfEdge * 0.34, thickness: thick, curve: curve * 0.15 },
        { y: bladeLength * 0.18, halfWidth: halfEdge * 0.6, thickness: thick * 0.9, curve: curve * 0.5 },
        { y: bladeLength * 0.52, halfWidth: halfEdge * 0.86, thickness: thick * 0.6, curve: curve * 0.9 },
        { y: bladeLength * 0.86, halfWidth: halfEdge, thickness: thin * 1.6, curve },
        { y: bladeLength, halfWidth: halfEdge * 0.99, thickness: thin, curve: curve * 0.95 },
      ]
      const blade = dishedSheetGeometry(
        profile, 7, steelTint(random, -0.04), steelTint(random, 0.05),
      )
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
