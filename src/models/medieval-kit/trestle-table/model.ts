/**
 * @medieval-kit/trestle-table
 *
 * Trestle table: the standard table of the middle ages. The top is NOT nailed
 * to the trestles, it merely rests on them — so that once the meal is over it
 * can be lifted away and the hall cleared. That is why the top boards stand
 * independent of the trestles and have gaps between them.
 *
 * A trestle: a horizontal cap, two legs splaying down from it, a foot at the
 * bottom. Two trestles are tied together by a stretcher.
 */
import { Color } from 'three'

import {
  MEDIEVAL_PALETTE,
  chamferedBoxGeometry,
  createKitModel,
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
  /** Outward splay of the legs. */
  readonly splay: number
  readonly seed: number
}

export const trestleTableDefaults: TrestleTableConfig = {
  length: 1.9,
  width: 0.78,
  height: 0.74,
  plankCount: 4,
  splay: 0.22,
  seed: 19,
}

export type TrestleTableParts = 'top' | 'trestles' | 'stretcher'

export function createModel(overrides: Partial<TrestleTableConfig> = {}) {
  return createKitModel<TrestleTableConfig, 'oak', TrestleTableParts>({
    id: 'trestle-table',
    defaults: trestleTableDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const oak = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.055))
        return tint
      }
      const half = config.height / 2
      // 0.07 of the height, not 0.045: a 52 mm plank rather than a 33 mm one
      // across 1.9 m. Same reasoning as the bench -- a trestle top is a slab
      // laid on frames and taken off again, and it has to be stiff enough to
      // carry itself between two supports.
      const board = config.height * 0.07
      const timber = config.height * 0.075

      // --- top: separate boards with a thin gap between them ---
      const planks = []
      const count = Math.max(1, config.plankCount)
      const gap = config.width * 0.008
      const plankWidth = (config.width - gap * (count - 1)) / count
      for (let i = 0; i < count; i += 1) {
        const z = -config.width / 2 + plankWidth / 2 + i * (plankWidth + gap)
        // Every board gets its own thickness and tone: a top that was sawn,
        // planed and used for years is never uniform.
        const thickness = board * (1 + jitter(random, 0.08))
        planks.push(chamferedBoxGeometry(
          [config.length, plankWidth],
          [config.length, plankWidth],
          thickness,
          board * 0.22,
          [jitter(random, config.length * 0.004), half - thickness / 2, z],
          oak(0.04),
        ))
      }

      // --- trestles ---
      const trestles = []
      const trestleX = config.length * 0.31
      const legSpan = config.height - board
      for (const side of [-1, 1] as const) {
        const x = side * trestleX
        // Cap: the horizontal rail that carries the top.
        trestles.push(chamferedBoxGeometry(
          [timber * 1.1, config.width * 0.72],
          [timber * 1.1, config.width * 0.72],
          timber * 0.9,
          timber * 0.16,
          [x, half - board - timber * 0.45, 0],
          oak(-0.02),
        ))
        // Two legs: they splay outwards on their way down from the cap.
        for (const dir of [-1, 1] as const) {
          const leg = chamferedBoxGeometry(
            [timber * 0.9, timber * 0.8],
            [timber * 1.05, timber * 0.95],
            legSpan,
            timber * 0.15,
            [0, -legSpan / 2, 0],
            oak(),
          )
          leg.rotateX(dir * config.splay)
          // The legs pass through the cap at SEPARATE points; two timbers
          // cannot share one mortise. Without this offset the two sit on top
          // of each other when splay=0.
          leg.translate(x, half - board - timber * 0.3, dir * timber * 0.62)
          trestles.push(leg)
        }
        // Centre post: the vertical timber running from the cap down to the
        // foot. The stretcher passes through it — without it the stretcher hung
        // in mid-air BETWEEN the two trestles, because as the legs splayed they
        // moved apart along z and no longer touched the stretcher.
        trestles.push(chamferedBoxGeometry(
          [timber * 0.8, timber * 0.85],
          [timber * 0.9, timber * 0.9],
          config.height - board - timber * 0.5,
          timber * 0.14,
          [x, -half + (config.height - board - timber * 0.5) / 2 + timber * 0.2, 0],
          oak(-0.01),
        ))

        // Foot: the crosswise member resting on the ground. Required, because
        // the floor is not flat.
        const spread = Math.sin(config.splay) * legSpan
        trestles.push(chamferedBoxGeometry(
          [timber * 1.2, config.width * 0.62 + spread * 2],
          [timber * 1.05, config.width * 0.58 + spread * 2],
          timber * 0.62,
          timber * 0.14,
          [x, -half + timber * 0.31, 0],
          oak(-0.04),
        ))
      }

      // --- stretcher: the long rail tying the two trestles, it enters the legs ---
      const stretcher = chamferedBoxGeometry(
        [trestleX * 2 + timber * 1.6, timber * 0.7],
        [trestleX * 2 + timber * 1.6, timber * 0.7],
        timber * 0.85,
        timber * 0.15,
        [0, -half + config.height * 0.24, 0],
        oak(-0.03),
      )

      return {
        top: { slot: 'oak', geometry: mergeColoured(planks) },
        trestles: { slot: 'oak', geometry: mergeColoured(trestles) },
        stretcher: { slot: 'oak', geometry: stretcher },
      }
    },
  }, overrides)
}
