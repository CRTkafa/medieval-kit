/**
 * @medieval-kit/oak-tankard
 *
 * Oak tankard: the barrel at palm size. Same stave language, same iron hoop,
 * only the scale changes — the example that shows how far the kit carries its
 * own vocabulary.
 *
 * Do NOT look for a glass mug: a medieval drinking vessel was wood, leather or
 * pewter. A clear glass would be a period error, and it would also look foreign
 * next to the rest of the kit.
 *
 * The handle turned into a problem. A round rod handle looked like a modern
 * mug; a real tankard's handle is a FLAT strap of wood or iron, fixed to the
 * body at two points. The curve comes from `bendGeometry`.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  bendGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  headGeometry,
  jitter,
  mergeColoured,
  staveGeometry,
  type Level,
} from '../core/index.ts'

export interface OakTankardConfig {
  /** Height (metres). */
  readonly height: number
  /** Rim radius (metres). */
  readonly radius: number
  /** Narrowing towards the base. 0 = cylinder. */
  readonly taper: number
  /** Number of staves. */
  readonly staveCount: number
  /** Number of iron hoops. */
  readonly hoopCount: number
  /** Whether there is a handle (0/1). */
  readonly handle: number
  readonly seed: number
}

export const oakTankardDefaults: OakTankardConfig = {
  height: 0.175,
  radius: 0.047,
  taper: 0.05,
  staveCount: 10,
  hoopCount: 2,
  handle: 1,
  seed: 61,
}

export type OakTankardParts = 'staves' | 'base' | 'hoops' | 'handle'

export function createModel(overrides: Partial<OakTankardConfig> = {}) {
  return createKitModel<OakTankardConfig, 'oak' | 'iron', OakTankardParts>({
    id: 'oak-tankard',
    defaults: oakTankardDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const staves = Math.max(5, Math.round(config.staveCount))
      const thickness = config.radius * 0.13
      const bottomRadius = config.radius * (1 - config.taper)

      // --- Staves -----------------------------------------------------------
      const stavePieces: BufferGeometry[] = []
      const step = (Math.PI * 2) / staves
      for (let i = 0; i < staves; i += 1) {
        // A thin gap between staves: adjacent staves were coplanar along their
        // side faces, and on the barrel that caused z-fighting.
        const gap = step * 0.035
        const levels: Level[] = [
          { y: -half, radius: bottomRadius * (1 + jitter(random, 0.012)) },
          { y: -half + config.height * 0.5, radius: config.radius * (0.985 + jitter(random, 0.012)) },
          { y: half, radius: config.radius * (1 + jitter(random, 0.012)) },
        ]
        stavePieces.push(staveGeometry(
          levels, i * step + gap, (i + 1) * step - gap, thickness,
          tint('oak', jitter(random, 0.06)),
        ))
      }

      // --- Base --------------------------------------------------------------
      // A disc seated inside the staves; its edge stays within them.
      const base = headGeometry(
        bottomRadius - thickness * 0.55, -half + config.height * 0.055,
        staves, 'up', tint('oakEnd', 0.02), 3, 0.06,
      )

      // --- Hoops --------------------------------------------------------------
      const hoops = Math.max(0, Math.round(config.hoopCount))
      const hoopPieces: BufferGeometry[] = []
      for (let i = 0; i < hoops; i += 1) {
        const t = hoops === 1 ? 0.5 : 0.13 + (i / (hoops - 1)) * 0.74
        const y = -half + config.height * t
        const radius = bottomRadius + (config.radius - bottomRadius) * t
        hoopPieces.push(bandGeometry(
          radius + thickness * 0.42, y, config.height * 0.055,
          thickness * 0.32, staves, tint('iron', jitter(random, 0.05), 0.6),
        ))
      }

      // --- Handle --------------------------------------------------------------
      let handle: BufferGeometry | undefined
      if (config.handle >= 0.5) {
        const span = config.height * 0.72
        const strap = boxGeometry(
          [config.radius * 0.3, span, thickness * 1.1],
          [0, 0, 0],
          tint('oak', -0.05),
        )
        // The flat strap curves outwards away from the body. Because the centre
        // of the curve is at the origin, both ends come back towards the body —
        // that is exactly where the impression of a handle gripping the body
        // comes from.
        bendGeometry(strap, -2.05 / span)
        // The offset is found by calculation, not by eye: the bend leaves the
        // midpoint of the arc in place and pulls its ENDS back, so if the
        // middle of the handle is not pushed far enough away from the body it
        // is not the ends but the MIDDLE that ends up inside the stave. On the
        // first attempt the handle was completely invisible.
        //
        // Half-angle a = (span/2)·k, the ends pull back by (1−cos a)/k.
        const drop = (1 - Math.cos(span * 0.5 * (2.05 / span))) / (2.05 / span)
        strap.translate(0, 0, config.radius + drop + thickness * 0.6)
        // Small pegs so that both ends go INSIDE the body.
        const pegs = [1, -1].map((sign) => boxGeometry(
          [config.radius * 0.3, thickness * 1.6, config.radius * 0.55],
          [0, sign * span * 0.42, config.radius * 0.88],
          tint('oak', -0.1),
        ))
        handle = mergeColoured([strap, ...pegs])
      }

      return {
        staves: { slot: 'oak' as const, geometry: mergeColoured(stavePieces) },
        base: { slot: 'oak' as const, geometry: mergeColoured([base]) },
        hoops: hoopPieces.length > 0
          ? { slot: 'iron' as const, geometry: mergeColoured(hoopPieces) }
          : undefined,
        handle: handle ? { slot: 'oak' as const, geometry: handle } : undefined,
      }
    },
  }, overrides)
}
