/**
 * @medieval-kit/wicker-basket
 *
 * A basket woven from willow rods, optionally filled with produce.
 *
 * The model in the kit that imitates "how it was made" the most, because in
 * wickerwork the form and the making are the same thing: a basket is the
 * horizontal rods (withies) winding IN FRONT OF ONE and BEHIND THE NEXT of the
 * vertical rods (stakes). Without that winding what you get is a bucket with
 * lines drawn on it.
 *
 * The weave trick is short: every horizontal hoop is first produced as a flat
 * band, then its vertices are pushed in and out according to THEIR ANGLE —
 *
 *     radius × (1 + amplitude · cos(stakes · angle + phase))
 *
 * On consecutive rows the phase is shifted by π, so where one row comes out the
 * next one goes in. That is exactly what a real weave is, and it costs not one
 * single extra triangle.
 *
 * The produce sits in its own slot and takes its colour from the `hue` field:
 * the same model can give you a basket of apples, turnips or cabbages. Do NOT
 * look for tomatoes — they come from the Americas and do not enter European
 * cooking before the 16th century.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
  createKitModel,
  createTinter,
  flipGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  type Level,
} from '../core/index.ts'

export interface WickerBasketConfig {
  /** Basket height, handle excluded (metres). */
  readonly height: number
  /** Mouth radius (metres). */
  readonly radius: number
  /** Taper towards the base. 0 = cylinder. */
  readonly taper: number
  /** Number of vertical stakes. Also the "wave count" of the weave. */
  readonly stakes: number
  /** Horizontal weave rows. */
  readonly rows: number
  /** Number of fruits inside. 0 = empty basket. */
  readonly produce: number
  /** Fruit colour, 0–1 around the colour wheel. */
  readonly hue: number
  readonly seed: number
}

export const wickerBasketDefaults: WickerBasketConfig = {
  height: 0.21,
  radius: 0.17,
  taper: 0.26,
  stakes: 11,
  rows: 6,
  produce: 9,
  hue: 0.02,
  seed: 97,
}

export type WickerBasketParts = 'weave' | 'rim' | 'contents'

export function createModel(overrides: Partial<WickerBasketConfig> = {}) {
  return createKitModel<WickerBasketConfig, 'straw' | 'produce', WickerBasketParts>({
    id: 'wicker-basket',
    defaults: wickerBasketDefaults,
    slots: ['straw', 'produce'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const stakes = Math.max(5, Math.round(config.stakes))
      const rows = Math.max(1, Math.round(config.rows))
      const bottomRadius = config.radius * (1 - config.taper)
      const withy = config.height * 0.05          // rod thickness
      const amplitude = 0.055                     // in-out travel of the weave

      const radiusAt = (t: number): number => bottomRadius + (config.radius - bottomRadius) * t

      /**
       * The transform that turns a band into a weave: every vertex moves
       * towards and away from the centre according to ITS OWN angle. Y is left
       * alone, so the hoop stays in its plane and never collides with the
       * neighbouring rows.
       */
      const undulate = (geometry: BufferGeometry, phase: number): BufferGeometry => {
        const position = geometry.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          const x = position.getX(i)
          const z = position.getZ(i)
          const distance = Math.hypot(x, z)
          if (distance < 1e-6) continue
          const scale = 1 + amplitude * Math.cos(stakes * Math.atan2(x, z) + phase)
          position.setX(i, x * scale)
          position.setZ(i, z * scale)
        }
        position.needsUpdate = true
        geometry.computeVertexNormals()
        return geometry
      }

      // --- Vertical stakes -----------------------------------------------------
      // They run THROUGH the weave: because the horizontal hoops wind in front
      // of one and behind the next, the stakes hide here and show up there.
      const pieces: BufferGeometry[] = []
      for (let i = 0; i < stakes; i += 1) {
        const angle = (i / stakes) * Math.PI * 2
        const stake = prismGeometry(
          withy * 0.42, withy * 0.36, config.height * 1.02, 4,
          [0, 0, 0], tint('straw', -0.09, 1.2),
        )
        // Bend first, move second: in a tapering basket the stakes lean too.
        stake.rotateX(Math.atan2(config.radius - bottomRadius, config.height))
        stake.rotateY(angle)
        const mid = (bottomRadius + config.radius) / 2
        stake.translate(Math.sin(angle) * mid, 0, Math.cos(angle) * mid)
        pieces.push(stake)
      }

      // --- Horizontal weave ----------------------------------------------------
      // TWO segments per vertical stake: `cos(stakes·θ)` is sampled exactly once
      // positive and once negative on every stake, so the wave is fully resolved
      // with the fewest possible triangles. Four segments gave a smoother wave
      // but doubled the triangles per hoop and pushed the basket past the
      // lowpoly budget.
      //
      // The INNER FACE of the hoops is not generated. In its place there is a
      // single-piece inner liner (below): six separate inner surfaces for six
      // hoops cost ~800 triangles, the liner costs 44, and from the inside the
      // difference is invisible.
      for (let r = 0; r < rows; r += 1) {
        const t = (r + 0.5) / rows
        const y = -half + config.height * t
        const ring = bandGeometry(
          radiusAt(t), y, config.height * 0.11, withy * 0.8, stakes * 2,
          tint('straw', jitter(random, 0.07), 1.2),
        )
        // The phase shifts by half a wave on every row: the next row going in
        // where the previous one came out is what makes a weave a weave.
        pieces.push(undulate(ring, r % 2 === 0 ? 0 : Math.PI))
      }

      // Inner liner: the single surface that closes off the back of the weave.
      // Wound in reverse so the normals face the axis.
      pieces.push(flipGeometry(latheGeometry([
        { y: -half + config.height * 0.03, radius: bottomRadius * (1 - amplitude) },
        { y: half - config.height * 0.02, radius: config.radius * (1 - amplitude) },
      ], stakes * 2, [0, 0, 0], tint('straw', -0.2, 1.1), {
        capTop: false,
        capBottom: false,
      })))

      // --- Base ----------------------------------------------------------------
      pieces.push(latheGeometry([
        { y: -half - config.height * 0.01, radius: bottomRadius * 0.94 },
        { y: -half + config.height * 0.05, radius: bottomRadius * 0.99 },
      ], stakes * 2, [0, 0, 0], tint('straw', -0.14, 1.2), { capTop: true }))

      // --- Rim -----------------------------------------------------------------
      // The thick bend that finishes the weave. It is the most visible detail on
      // the basket, and without it the edge looks "cut off".
      const rim = mergeColoured([
        bandGeometry(config.radius * 1.015, half - config.height * 0.03,
          config.height * 0.1, withy * 1.5, stakes * 2,
          tint('straw', 0.07, 1.2), { inner: true }),
      ])

      // --- Contents ------------------------------------------------------------
      const count = Math.max(0, Math.round(config.produce))
      const contents: BufferGeometry[] = []
      const hue = ((config.hue % 1) + 1) % 1
      for (let i = 0; i < count; i += 1) {
        const size = config.radius * (0.2 + random() * 0.07)
        // Apple profile: dimpled top and bottom, wide in the middle.
        const fruit = latheGeometry([
          { y: -size * 0.86, radius: size * 0.3 },
          { y: -size * 0.6, radius: size * 0.78 },
          { y: 0, radius: size },
          { y: size * 0.58, radius: size * 0.82 },
          { y: size * 0.84, radius: size * 0.34 },
        ] as Level[], 7, [0, 0, 0], new Color().setHSL(
          (hue + jitter(random, 0.03) + 1) % 1,
          0.52 + random() * 0.2,
          0.3 + random() * 0.12,
        ))

        // Placement: golden-angle spiral plus a distance growing with the square
        // root, and — critically — the heap RESTS ON THE BASE.
        //
        // It used to be positioned relative to the rim, which is wrong for any
        // basket deeper than a fruit: the produce hung near the mouth with a
        // gap underneath it. Fruit sits at the bottom and piles up from there;
        // if there is more of it than the basket holds, the heap rises past
        // the rim, which is also what really happens.
        const angle = i * 2.399963
        const ring = Math.sqrt((i + 0.4) / count)
        const inner = Math.max(size, bottomRadius * 0.92 - size * 0.6)
        const spread = inner * ring
        const layer = Math.floor(i / Math.max(3, Math.round(count * 0.55)))
        fruit.rotateX(jitter(random, 0.6))
        fruit.rotateZ(jitter(random, 0.6))
        fruit.translate(
          Math.sin(angle) * spread,
          // Base top + one radius = resting on the floor of the basket.
          -half + config.height * 0.05 + size * (0.92 + layer * 1.5)
            - ring * size * 0.28 + jitter(random, size * 0.08),
          Math.cos(angle) * spread,
        )
        contents.push(fruit)
      }

      return {
        weave: { slot: 'straw' as const, geometry: mergeColoured(pieces) },
        rim: { slot: 'straw' as const, geometry: rim },
        contents: contents.length > 0
          ? { slot: 'produce' as const, geometry: mergeColoured(contents) }
          : undefined,
      }
    },
  }, overrides)
}
