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
  arcBarGeometry,
  bandGeometry,
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
  height: 0.162,
  radius: 0.056,
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
        // Built as a real arc, not as a bent box.
        //
        // The previous version made a flat `boxGeometry` strap and put it
        // through `bendGeometry`, then pushed it clear of the body by a
        // hand-derived offset: `(1 - cos(span/2 * k)) / k`. Measured, the
        // result was a handle whose outermost point stood 7 mm proud of a
        // body 47 mm in radius, with the rest of it buried in the stave wall.
        // There was no finger gap at all -- it read as a plank glued to the
        // side, which is exactly what it was. The offset formula did not
        // describe what `bendGeometry` actually does to the geometry.
        //
        // So this does not compute a correction for a curve it cannot see.
        // `arcBarGeometry` produces the arc directly, and the arc is specified
        // by the two things that actually matter: where its ends land, and how
        // far its belly stands off the body.
        const span = config.height * 0.72
        // Ends land INSIDE the stave wall, so the joint is an overlap.
        const endDepth = config.radius - thickness * 1.1
        const arcRadius = Math.hypot(span / 2, endDepth)
        const halfAngle = Math.atan2(span / 2, endDepth)
        const strap = arcBarGeometry(
          arcRadius,
          thickness * 1.5,
          -halfAngle,
          halfAngle,
          7,
          [0, 0, 0],
          tint('oak', -0.05),
        )
        // The arc is built in the XY plane; -90 degrees about Y carries its
        // +X into +Z, standing it up beside the body with its span along Y.
        strap.rotateY(-Math.PI / 2)
        handle = mergeColoured([strap])
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
