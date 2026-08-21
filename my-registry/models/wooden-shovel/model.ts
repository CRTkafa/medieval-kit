/**
 * @medieval-kit/wooden-shovel
 *
 * Third attempt. The first two failed, and both for the same reason: I tried
 * to build the blade out of flat pieces.
 *
 *   attempt 1 — two boxes end to end. It came out "shovel-shaped", not a shovel.
 *   attempt 2 — three flat panels, each rotated slightly, lined up side by
 *      side. Because the panels rotated about their own centres, steps were
 *      left between them; the eye read that as "three boards", not one surface.
 *
 * What makes a shovel a shovel is that the blade is ONE CONTINUOUS CONCAVE
 * SURFACE: the dish that holds the soil. `dishedSheetGeometry` was written for
 * exactly this — a seamless sheet with a curved cross-section whose width and
 * thickness change along its length.
 *
 * Silhouette: a narrow neck at the socket, widest at 45%, a soft taper towards
 * the tip. A foot tread at the back — on a real shovel the top edge of the
 * blade is folded over, to press down on with the foot.
 */
import { type BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  dishedSheetGeometry,
  ironTint,
  steelTint,
  mergeColoured,
  toolShaft,
  toolSocket,
  type SheetLevel,
} from '../core/index.ts'

export interface WoodenShovelConfig {
  readonly length: number
  readonly shaftRadius: number
  /** The widest point of the blade (metres). */
  readonly bladeWidth: number
  /** Blade length, as a fraction of the total length. */
  readonly bladeLength: number
  /** Depth of the scoop: how far the edges rise above the middle. 0 = flat sheet. */
  readonly dish: number
  /** Tilt of the blade relative to the shaft (degrees). */
  readonly bladeAngle: number
  readonly seed: number
}

export const woodenShovelDefaults: WoodenShovelConfig = {
  length: 1.16,
  shaftRadius: 0.022,
  bladeWidth: 0.27,
  bladeLength: 0.27,
  dish: 0.17,
  bladeAngle: 9,
  seed: 31,
}

export type WoodenShovelParts = 'shaft' | 'socket' | 'blade'

export function createModel(overrides: Partial<WoodenShovelConfig> = {}) {
  return createKitModel<WoodenShovelConfig, 'oak' | 'iron' | 'steel', WoodenShovelParts>({
    id: 'wooden-shovel',
    defaults: woodenShovelDefaults,
    slots: ['oak', 'iron', 'steel'],
    build: ({ config, random }) => {
      const span = config.length * config.bladeLength
      const shaftLength = config.length - span * 0.82
      const shaft = toolShaft({ length: shaftLength, radius: config.shaftRadius, random })

      const socketLength = config.length * 0.05
      const socket = toolSocket({
        y: shaft.top - socketLength * 0.3,
        shaftRadius: shaft.topRadius,
        length: socketLength,
        random,
      })

      const half = config.bladeWidth / 2
      const t = config.length * 0.011
      const curve = config.bladeWidth * config.dish

      // Cross-section profile — the FOURTH attempt, this time over the silhouette.
      //
      // The third attempt was geometrically correct (one continuous dished
      // surface) but it still did not read as a shovel: the edges bulged in the
      // middle and closed softly towards the tip, i.e. a SPOON profile. A shovel
      // is not a spoon: it runs almost PARALLEL along its sides, then ends in a
      // short chamfer at the tip. What holds the soil is that parallel part;
      // without it what you get is a spatula.
      const profile: SheetLevel[] = [
        { y: 0, halfWidth: half * 0.24, thickness: t * 1.5, curve: curve * 0.08 },
        { y: span * 0.11, halfWidth: half * 0.82, thickness: t * 1.15, curve: curve * 0.4 },
        { y: span * 0.28, halfWidth: half * 0.99, thickness: t * 0.95, curve: curve * 0.85 },
        { y: span * 0.62, halfWidth: half, thickness: t * 0.82, curve },
        { y: span * 0.85, halfWidth: half * 0.95, thickness: t * 0.6, curve: curve * 0.94 },
        { y: span * 0.96, halfWidth: half * 0.74, thickness: t * 0.32, curve: curve * 0.72 },
        { y: span, halfWidth: half * 0.44, thickness: t * 0.14, curve: curve * 0.48 },
      ]

      const sheet = dishedSheetGeometry(profile, 8, steelTint(random, -0.04), steelTint(random, 0.04))

      // Foot tread: the fold at the top edge of the blade, BEHIND the dish. It
      // must sit at shoulder height and be WIDE — this is where you step, and a
      // narrow ledge is both useless and invisible in the silhouette.
      const tread = chamferedBoxGeometry(
        [config.bladeWidth * 0.78, t * 2.4],
        [config.bladeWidth * 0.7, t * 1.9],
        t * 1.8,
        t * 0.34,
        [0, 0, 0],
        steelTint(random, -0.07),
      )
      tread.rotateX(0.42)
      tread.translate(0, span * 0.12, -t * 1.7)

      // Back strap: forged iron leaving the socket and running up BEHIND the
      // blade. This is the second thing that makes a shovel a shovel. Without it
      // the blade looks like a sheet glued to the end of the shaft; on a real
      // shovel the strap is what carries the blade, and it is also what answers
      // the eye's question of "how is this held on".
      const strap = chamferedBoxGeometry(
        [config.shaftRadius * 2.3, t * 2.2],
        [config.shaftRadius * 1.1, t * 1.4],
        span * 0.5,
        t * 0.3,
        [0, span * 0.22, -t * 1.4],
        ironTint(random, -0.02),
      )

      const blade: BufferGeometry = mergeColoured([sheet, tread])
      // Both must take the SAME transform, or the strap won't stay behind the blade.
      for (const piece of [blade, strap]) {
        // The blade is tilted slightly forward of the shaft line, so it bites the soil.
        piece.rotateX(-(config.bladeAngle * Math.PI) / 180)
        piece.translate(0, shaft.top - span * 0.06, 0)
      }

      return {
        shaft: { slot: 'oak', geometry: shaft.geometry },
        socket: { slot: 'iron', geometry: socket },
        blade: {
          slot: 'steel',
          geometry: blade,
          extras: [{ slot: 'iron', geometry: strap }],
        },
      }
    },
  }, overrides)
}
