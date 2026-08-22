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
  // Shallower and fuller. The reference is a bowl wider than it is deep,
  // heaped until the fruit mounds over the rim -- which is the only state a
  // fruit basket is ever drawn in.
  height: 0.16,
  radius: 0.17,
  taper: 0.26,
  stakes: 11,
  rows: 6,
  produce: 15,
  hue: 0.02,
  seed: 97,
}

export type WickerBasketParts = 'weave' | 'rim' | 'contents'

export function createModel(overrides: Partial<WickerBasketConfig> = {}) {
  return createKitModel<WickerBasketConfig, 'oak' | 'produce', WickerBasketParts>({
    id: 'wicker-basket',
    defaults: wickerBasketDefaults,
    slots: ['oak', 'produce'],
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
          [0, 0, 0], tint('oak', -0.09 + 0.04, 1.2),
        )
        // Bend first, move second: in a tapering basket the stakes lean too.
        stake.rotateX(Math.atan2(config.radius - bottomRadius, config.height))
        stake.rotateY(angle)
        const mid = (bottomRadius + config.radius) / 2
        stake.translate(Math.sin(angle) * mid, 0, Math.cos(angle) * mid)
        pieces.push(stake)
      }

      // Willow, not straw.
      //
      // The basket drew its colour from the `straw` palette entry and rendered
      // at hue 41 with saturation 0.59; a photograph of a wicker basket sits at
      // hue 29, saturation 0.50. It read as bright yellow plastic. The tuned
      // `oak` entry is hue 26 / saturation 0.53 -- almost exactly the
      // measurement -- and willow IS a wood, so the material slot moves with
      // the colour. The lift keeps it at the pale, peeled end of oak rather
      // than the dark structural end.
      //
      // The lift is 0.04 and that is nearly arbitrary: sweeping it over 0.00,
      // 0.04 and 0.08 moved the measured hue and saturation by at most 0.01.
      // It was first set to 0.12 on the reasoning that willow is paler than
      // structural oak, which is true and which made the basket salmon pink --
      // raising HSL lightness holds saturation, so a saturated brown climbs
      // towards peach rather than towards weathered willow. Against the
      // reference the straw entry was off by 12 degrees of hue and 0.09
      // saturation; oak is off by 7 and 0.03.

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
      // The weave stops BELOW the rim. Once the rows were made tall enough to
      // meet each other they grew into the rim's band, and the outermost point
      // of the undulation met the rim's inner facets in the same plane. The
      // rim is a separate, thicker rod laid over the finished weave, so the
      // weave ending under it is how the object is actually made.
      const weaveSpan = config.height * 0.9
      for (let r = 0; r < rows; r += 1) {
        const t = (r + 0.5) / rows
        const y = -half + weaveSpan * t
        // The band height is derived from the row count so that rows always
        // MEET. It used to be a flat 0.11 of the height while the spacing
        // between rows is 1/rows -- 0.167 at the default six -- which left a
        // 12 mm gap you could see straight through to the contents. That is a
        // slatted crate, not a weave. Rows now overlap slightly; they do not
        // z-fight because consecutive rows are undulated half a wave apart, so
        // where one bulges out its neighbour is tucked in.
        // Alternate rows sit slightly proud of and slightly behind each other.
        // This is how a weave really goes together -- the weaver's rod passes
        // outside one stake and inside the next, so no two rows lie on the
        // same cylinder -- and it is also what makes the overlap above safe.
        // Undulating consecutive rows in antiphase is not enough on its own:
        // a sine crosses zero, and at those nodes both rows returned to
        // exactly `radiusAt(t)`. With a cylindrical basket (taper 0) every row
        // shares that radius, so the overlapping bands met in coplanar faces
        // at every node.
        const lean = r % 2 === 0 ? withy * 0.2 : -withy * 0.2
        const ring = bandGeometry(
          radiusAt(t) + lean, y, (weaveSpan / rows) * 1.06, withy * 0.8, stakes * 2,
          tint('oak', 0.04 + jitter(random, 0.07), 1.2),
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
      ], stakes * 2, [0, 0, 0], tint('oak', 0.06, 1.1), {
        capTop: false,
        capBottom: false,
      })))

      // --- Base ----------------------------------------------------------------
      pieces.push(latheGeometry([
        { y: -half - config.height * 0.01, radius: bottomRadius * 0.94 },
        { y: -half + config.height * 0.05, radius: bottomRadius * 0.99 },
      ], stakes * 2, [0, 0, 0], tint('oak', -0.14 + 0.04, 1.2), { capTop: true }))

      // --- Rim -----------------------------------------------------------------
      // The thick bend that finishes the weave. It is the most visible detail on
      // the basket, and without it the edge looks "cut off".
      const rim = mergeColoured([
        // Thickness withy*2.1, not 1.5, and the reason is arithmetic rather
        // than taste. At 1.5 the rim's inner surface landed at
        // radius*1.015 - withy*1.5 = 0.16055, and the inner liner sits at
        // radius*(1 - amplitude) = 0.16065 -- a tenth of a millimetre apart,
        // by coincidence. On a cylindrical basket (taper 0) those are the same
        // 22-sided prism and every facet of it z-fought. The thicker rod
        // carries the inner face clearly past the liner, and it is the truer
        // shape anyway: the rim is the heaviest rod in a basket, bent over the
        // finished weave, and it stands proud on both sides.
        bandGeometry(config.radius * 1.015, half - config.height * 0.03,
          config.height * 0.1, withy * 2.1, stakes * 2,
          tint('oak', 0.07 + 0.04, 1.2), { inner: true }),
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
        // Fewer fruit per layer means MORE layers, and it is the layer count
        // that decides whether the heap ever reaches the mouth. At 0.55 the
        // default nine apples formed two layers topping out 12 cm below a rim
        // 10 cm up: correctly resting on the base, and completely invisible.
        // Resting on the base was the fix for an earlier bug where the produce
        // hung level with the rim over a gap; the fix was right and the
        // consequence -- that a deep basket then needs enough fruit to fill it
        // -- was not followed through.
        const layer = Math.floor(i / Math.max(3, Math.round(count * 0.38)))
        fruit.rotateX(jitter(random, 0.6))
        fruit.rotateZ(jitter(random, 0.6))
        fruit.translate(
          Math.sin(angle) * spread,
          // Base top + one radius = resting on the floor of the basket.
          // Layers nest at 0.95 of a diameter, not 1.5: stacked fruit settles
          // into the gaps of the layer below rather than sitting on top of it.
          -half + config.height * 0.05 + size * (0.92 + layer * 0.95)
            - ring * size * 0.28 + jitter(random, size * 0.08),
          Math.cos(angle) * spread,
        )
        contents.push(fruit)
      }

      return {
        weave: { slot: 'oak' as const, geometry: mergeColoured(pieces) },
        rim: { slot: 'oak' as const, geometry: rim },
        contents: contents.length > 0
          ? { slot: 'produce' as const, geometry: mergeColoured(contents) }
          : undefined,
      }
    },
  }, overrides)
}
