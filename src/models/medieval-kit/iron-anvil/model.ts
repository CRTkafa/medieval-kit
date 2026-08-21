/**
 * @medieval-kit/iron-anvil
 *
 * An anvil's silhouette is the forging process itself: a wide base, a narrow
 * waist, a broad face on top, a horn tapering off to one side. The geometry is
 * almost entirely boxes — what gives it character is the proportions.
 *
 * The kit's first "place-making" piece: on its own it suggests a smith's corner.
 */
import { Color } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  steelTint,
} from '../core/index.ts'

export interface IronAnvilConfig {
  /** Total height (metres). With a real anvil stump it comes to ~0.75 m. */
  readonly height: number
  /** Length of the top face (metres). */
  readonly faceLength: number
  /** Width of the top face (metres). */
  readonly faceWidth: number
  /** How far the horn reaches past the face, as a ratio of the face length. */
  readonly hornReach: number
  readonly seed: number
}

export const ironAnvilDefaults: IronAnvilConfig = {
  height: 0.34,
  faceLength: 0.46,
  faceWidth: 0.13,
  hornReach: 0.52,
  seed: 9,
}

export type IronAnvilParts = 'base' | 'waist' | 'body' | 'face' | 'horn'

export function createModel(overrides: Partial<IronAnvilConfig> = {}) {
  return createKitModel<IronAnvilConfig, 'iron' | 'steel', IronAnvilParts>({
    id: 'iron-anvil',
    defaults: ironAnvilDefaults,
    slots: ['iron', 'steel'],
    build: ({ config, random }) => {
      const tint = new Color()
      const shade = (amount = 0.05): Color => {
        tint.copy(MEDIEVAL_PALETTE.iron)
        tint.offsetHSL(0, jitter(random, 0.02), jitter(random, amount))
        return tint
      }

      const half = config.height / 2
      const baseHeight = config.height * 0.2
      const bodyHeight = config.height * 0.3
      const waistHeight = config.height - baseHeight - bodyHeight

      // Base: the widest piece, splaying out slightly toward the bottom.
      const baseLength = config.faceLength * 0.58
      const baseWidth = config.faceWidth * 1.5
      const base = mergeColoured([
        chamferedBoxGeometry(
        [baseLength * 1.08, baseWidth * 1.08],
        [baseLength, baseWidth],
        baseHeight,
        config.faceWidth * 0.06,
        [0, -half + baseHeight / 2, 0],
        shade(),
      ),
      ])

      // Waist: the narrow throat that makes an anvil an anvil.
      const waist = chamferedBoxGeometry(
        [baseLength * 0.5, baseWidth * 0.46],
        [baseLength * 0.5, baseWidth * 0.46],
        waistHeight,
        config.faceWidth * 0.06,
        [0, -half + baseHeight + waistHeight / 2, 0],
        shade(),
      )

      // Body: widens upward from the waist and carries the steel plate on top.
      //
      // An anvil really is made of two metals: a hard steel plate is welded on
      // top of the wrought iron body. The hammer always lands on that plate, so
      // over the years it polishes like a mirror; the body stays oxidised and
      // matte. In the model we give this as a separate part + separate material
      // slot, because the difference is not in colour but in ROUGHNESS, and
      // vertex colour cannot carry roughness.
      const plateHeight = config.height * 0.055
      const bodyY = half - bodyHeight / 2
      const body = mergeColoured([
        chamferedBoxGeometry(
          [baseLength * 0.62, baseWidth * 0.52],
          [config.faceLength * 0.62, config.faceWidth],
          bodyHeight,
          config.faceWidth * 0.06,
          [0, bodyY, 0],
          shade(0.06),
        ),
      ])

      // The plate is SUNK into the body: it goes in by half its own thickness
      // and also overhangs a touch on all four sides. Together those guarantee
      // that no pair of faces ends up coplanar (the z-fighting rule).
      const face = mergeColoured([
        chamferedBoxGeometry(
          [config.faceLength * 0.628, config.faceWidth * 1.012],
          [config.faceLength * 0.622, config.faceWidth * 1.006],
          plateHeight,
          config.faceWidth * 0.035,
          [0, half - plateHeight * 0.32, 0],
          steelTint(random),
        ),
      ])

      // Horn: a cone leaving the body horizontally, tapering to a point. Making
      // a vertical tapering box and turning it a quarter turn about the Z axis
      // is less code than writing a separate primitive, and the same result.
      const reach = config.faceLength * config.hornReach
      const horn = chamferedBoxGeometry(
        [config.faceWidth * 0.92, config.faceWidth * 0.86],
        [config.faceWidth * 0.1, config.faceWidth * 0.1],
        reach,
        config.faceWidth * 0.06,
        [0, 0, 0],
        shade(0.04),
      )
      horn.rotateZ(-Math.PI / 2)
      // Reach INTO the body: keep the end face inside the solid piece so that no
      // surface ends up coplanar with the body (the z-fighting rule).
      horn.translate(config.faceLength * 0.31 + reach / 2 - config.faceWidth * 0.35, bodyY + bodyHeight * 0.12, 0)

      return {
        base: { slot: 'iron', geometry: base },
        waist: { slot: 'iron', geometry: waist },
        body: { slot: 'iron', geometry: body },
        face: { slot: 'steel', geometry: face },
        horn: { slot: 'iron', geometry: horn },
      }
    },
  }, overrides)
}
