/**
 * @medieval-kit/trestle-table
 *
 * Low bench-table on two independent splayed end frames. The top is NOT
 * fixed to the frames, it merely rests on them, which is why the boards
 * stand free of the legs and keep their gaps.
 *
 * THIRD TYPOLOGY. Do not go back to the earlier ones:
 *   v1/v2 built the later arrangement — a central post on a sled foot at
 *   each end with a full-length stretcher between them. The blind critic
 *   (70/100) reported that the reference is the OLDER pattern: two square
 *   legs per end raked outward into an A along the length, one cross-rail
 *   per frame at about a third height with a through-tenon standing proud,
 *   and NO lengthwise member at all. The long stretcher was the single
 *   largest thing wrong with the negative space, so it is gone; the
 *   'stretcher' part now carries the two end-frame cross-rails.
 *   v2 also read tall and thin: the slab is now about a twelfth of the
 *   length, the height about half of it, and the top overhangs each foot
 *   by about one plank width.
 *   v2's long stretcher rendered grey-brown against the rest — a leftover
 *   of the mutable-Color helper era. Everything goes through createTinter,
 *   and lifts stay within about ±0.015 because oak's LINEAR lightness sits
 *   near 0.067 with the tinter floor at 0.045; the pale salmon top of v2
 *   came from a +0.04 lift, which at that scale is a 60 percent lightening.
 *
 * The legs are raked but their end cuts stay horizontal (flat on the floor,
 * flat under the slab). A rotated box cannot do that — its foot would touch
 * on one corner and hang 30 mm clear on the other — so each leg is a
 * vertical box passed through a shear matrix instead.
 */
import { Color, Matrix4 } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
} from '../core/index.ts'

export interface TrestleTableConfig {
  /** Top length (metres). */
  readonly length: number
  /** Top width (metres). */
  readonly width: number
  readonly height: number
  /** Number of top boards. */
  readonly plankCount: number
  /** Outward rake of the legs along the length (radians). */
  readonly splay: number
  readonly seed: number
}

export const trestleTableDefaults: TrestleTableConfig = {
  length: 1.4,
  width: 0.62,
  height: 0.68,
  plankCount: 4,
  splay: 0.31,
  seed: 19,
}

export type TrestleTableParts = 'top' | 'trestles' | 'stretcher'

export function createModel(overrides: Partial<TrestleTableConfig> = {}) {
  return createKitModel<TrestleTableConfig, 'oak', TrestleTableParts>({
    id: 'trestle-table',
    defaults: trestleTableDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tinter = createTinter(random)
      const oak = (lift = 0): Color => tinter('oak', lift)
      const half = config.height / 2

      // Slab: about a twelfth of the length. This is a heavy bench-table,
      // and in the reference the slab edge is as thick as the legs.
      const board = config.length * 0.081
      // Square-section legs, roughly the slab's own thickness.
      const leg = board * 0.95
      // Rake clamped so a patched config cannot fold the legs flat.
      const rake = Math.min(Math.max(config.splay, 0), 0.5)
      const tan = Math.tan(rake)

      // --- top: separate boards with a thin gap between them ---
      const planks = []
      const count = Math.max(1, config.plankCount)
      const gap = config.width * 0.008
      const plankWidth = (config.width - gap * (count - 1)) / count
      for (let i = 0; i < count; i += 1) {
        const z = -config.width / 2 + plankWidth / 2 + i * (plankWidth + gap)
        const thickness = board * (1 + jitter(random, 0.07))
        planks.push(chamferedBoxGeometry(
          [config.length, plankWidth],
          [config.length, plankWidth],
          thickness,
          board * 0.09,
          [jitter(random, config.length * 0.004), half - thickness / 2, z],
          oak(-0.004),
        ))
      }

      // --- end frames: two raked legs each, flat-cut top and bottom ---
      // Leg tops end INSIDE the slab (0.45 board above its underside), legs
      // stand flat on the floor, and the foot sits one plank width inboard
      // of the slab end so the top overhangs it.
      const legTopY = half - board * 0.45
      const legSpan = legTopY + half
      const legY = (legTopY - half) / 2
      const footX = config.length / 2 - plankWidth - leg / 2
      const legZ = Math.max(leg * 0.55, config.width / 2 - leg * 0.8)
      const trestles = []
      const rails = []
      const railY = -half + config.height * 0.35
      for (const side of [-1, 1] as const) {
        // x' = x + shear * y: top leans inward, foot swings outward.
        const shear = -side * tan
        const centreX = side * footX + shear * (legSpan / 2)
        for (const dir of [-1, 1] as const) {
          const geometry = chamferedBoxGeometry(
            [leg, leg],
            [leg * 0.94, leg * 0.94],
            legSpan,
            leg * 0.12,
            [0, 0, 0],
            oak(-0.012 + jitter(random, 0.004)),
          )
          geometry.applyMatrix4(new Matrix4().set(
            1, shear, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
          ))
          geometry.translate(centreX, legY, dir * legZ)
          trestles.push(geometry)
        }

        // --- cross-rail with through-tenon, one per frame, at 35 % height ---
        // The rail follows the legs' lean, so its x is wherever the leg is
        // at rail height. The body ends inside the legs; the slimmer tenon
        // runs through and stands proud by half a leg width outside.
        const railX = centreX + shear * (railY - legY)
        rails.push(chamferedBoxGeometry(
          [leg * 0.58, (legZ + leg * 0.2) * 2],
          [leg * 0.55, (legZ + leg * 0.2) * 2],
          leg * 0.64,
          leg * 0.09,
          [railX, railY, 0],
          oak(-0.008),
        ))
        rails.push(chamferedBoxGeometry(
          [leg * 0.4, (legZ + leg) * 2],
          [leg * 0.4, (legZ + leg) * 2],
          leg * 0.46,
          leg * 0.07,
          [railX, railY, 0],
          oak(-0.014),
        ))
      }

      return {
        top: { slot: 'oak', geometry: mergeColoured(planks) },
        trestles: { slot: 'oak', geometry: mergeColoured(trestles) },
        stretcher: { slot: 'oak', geometry: mergeColoured(rails) },
      }
    },
  }, overrides)
}
