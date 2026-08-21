/**
 * @medieval-kit/wooden-stool
 *
 * A three-legged stool. Three legs are no accident: on uneven ground three legs
 * always touch, a fourth one rocks — that is why village furniture has three.
 *
 * Its function in a scene: to say "somebody sits here". Not a prop on its own
 * but the sign of a human presence.
 */
import { Color } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  prismGeometry,
} from '../core/index.ts'

export interface WoodenStoolConfig {
  readonly height: number
  /** Radius of the seat (metres). */
  readonly seatRadius: number
  readonly legCount: number
  /** How far the legs splay outwards. 0 = upright. */
  readonly splay: number
  readonly seed: number
}

export const woodenStoolDefaults: WoodenStoolConfig = {
  height: 0.46,
  seatRadius: 0.17,
  legCount: 3,
  splay: 0.22,
  seed: 17,
}

export type WoodenStoolParts = 'seat' | 'legs'

export function createModel(overrides: Partial<WoodenStoolConfig> = {}) {
  return createKitModel<WoodenStoolConfig, 'oak', WoodenStoolParts>({
    id: 'wooden-stool',
    defaults: woodenStoolDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const half = config.height / 2
      const seatThickness = config.seatRadius * 0.22

      // Seat: a thick wooden disc — that is, a short cylinder. Its edge narrows
      // slightly downwards, which gives the impression of being hewn from a log.
      tint.copy(MEDIEVAL_PALETTE.oakEnd)
      tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), jitter(random, 0.04))
      const seatTop = half
      const seat = prismGeometry(
        config.seatRadius * 0.94,
        config.seatRadius,
        seatThickness,
        12,
        [0, seatTop - seatThickness / 2, 0],
        tint,
      )

      const legs = []
      const count = Math.max(3, config.legCount)
      const legLength = config.height - seatThickness
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + jitter(random, 0.06)
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), jitter(random, 0.06))
        const thick = config.seatRadius * 0.2

        // Leg: a stick hanging below the origin, tapering downwards. Order is
        // critical: lean first, then MOVE OUT TO THE RADIUS, then rotate. Without
        // the move-to-radius step all three legs stack on the axis when splay=0.
        const leg = chamferedBoxGeometry(
        [thick * 0.72, thick * 0.72],
        [thick, thick],
        legLength,
        thick * 0.16,
        [0, -legLength / 2, 0],
        tint,
      )
        leg.rotateZ(config.splay)
        leg.translate(config.seatRadius * 0.6, 0, 0)
        leg.rotateY(angle)
        // Go INTO the seat disc: the top end is invisible and aligns with no plane.
        leg.translate(0, seatTop - seatThickness * 0.35, 0)
        legs.push(leg)
      }

      return {
        seat: { slot: 'oak', geometry: seat },
        legs: { slot: 'oak', geometry: mergeColoured(legs) },
      }
    },
  }, overrides)
}
