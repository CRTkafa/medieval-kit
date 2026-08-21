/**
 * @medieval-kit/straw-broom
 *
 * Besom: a hazel-rod handle with a bundle of birch twigs bound to its end by a
 * withy tie. The period's broom really was this simple, and that is exactly why
 * it turns up in every interior scene.
 *
 * THIRD attempt. In the first, the bristles were individual rods and the bundle
 * looked like a whisk; in the second I moved to flat sheaves, which brought
 * mass, but what came out in render still was not a broom: "a lampshade pushed
 * onto a handle", "a closed umbrella". The cause was single and structural —
 * all the sheaves sat on ONE SINGLE RING, i.e. the bundle was a hollow cone
 * SHELL. On top of that, since it gathered at a single point up top and opened
 * downwards, its silhouette was a cone, whereas a besom is a slightly flared
 * CYLINDER.
 *
 * Three changes fix this:
 *
 *   - The bundle is built from three CONCENTRIC rings (6 / 10 / 16). The inner
 *     rings have less slope, so the middle fills in. The shell becomes mass.
 *   - The flare is no longer a hand-tuned angle: the tie radius and the tip
 *     radius are given, and the slope is DERIVED from the two. What determines
 *     the silhouette is two directly measurable numbers.
 *   - The radius of the bindings comes from the same source as the bundle's
 *     radius AT THAT HEIGHT. There used to be a separate guessed formula, and
 *     the binding hung in the air around the bundle.
 */
import type { BufferGeometry } from 'three'

import {
  arcBarGeometry,
  bandGeometry,
  bendGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface StrawBroomConfig {
  /** Total length (metres). */
  readonly length: number
  /** Shaft radius (metres). */
  readonly shaftRadius: number
  /** Length of the bundle, as a fraction of the total length. */
  readonly headLength: number
  /** Bundle radius at the tie (metres). */
  readonly tieRadius: number
  /** Bundle radius at the sweeping end (metres). The flare derives from these two. */
  readonly tipRadius: number
  /** Total number of twigs. */
  readonly bristles: number
  /** How many turns of binding. */
  readonly bindings: number
  readonly seed: number
}

export const strawBroomDefaults: StrawBroomConfig = {
  length: 1.2,
  shaftRadius: 0.018,
  headLength: 0.42,
  tieRadius: 0.058,
  tipRadius: 0.102,
  bristles: 32,
  bindings: 3,
  seed: 59,
}

export type StrawBroomParts = 'shaft' | 'bristles' | 'bindings'

export function createModel(overrides: Partial<StrawBroomConfig> = {}) {
  return createKitModel<StrawBroomConfig, 'oak' | 'straw' | 'cloth', StrawBroomParts>({
    id: 'straw-broom',
    // The auto-derived values stay too coarse for a 1.2 m object: the ambient
    // occlusion darkens the bundle like a blanket, and the mottle cell drops to
    // a couple of samples per sheaf. Both are tied to the scale of a twig.
    occlusion: { radius: 0.055 },
    mottle: { cell: 0.022 },
    defaults: strawBroomDefaults,
    slots: ['oak', 'straw', 'cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.length / 2
      const headLength = config.length * config.headLength
      const headTop = -half + headLength

      // --- The bundle's shape, from a single source ----------------------------
      const tieY = headTop - config.length * 0.017
      const sweepY = -half + config.length * 0.025
      const span = Math.max(0.02, tieY - sweepY)
      const tieRadius = config.tieRadius
      const tipRadius = Math.max(tieRadius * 1.05, config.tipRadius)
      // `tieRadius` and `tipRadius` are the bundle's OUTER radius — what the
      // user would measure looking at a broom. The rings are back-computed from
      // it: outer surface = ring radius + half the sheaf's width.
      const halfWidth = config.shaftRadius * 0.95
      /** The bundle's OUTER radius at height `y`. The bindings use this too. */
      const bundleRadius = (y: number): number =>
        tieRadius + (tipRadius - tieRadius) * Math.min(1, Math.max(0, (tieY - y) / span))

      // A broom has a FACE: held in the hand, the same side always meets the
      // floor and that side wears down more. The direction is chosen once,
      // driven by the seed.
      const faceAngle = random() * Math.PI * 2

      // --- Twigs: three concentric rings -----------------------------------------
      // The inner rings have little slope, the outer one has the full slope.
      // That is why the inside of the bundle fills in; had I left a single ring
      // it would be a shell again.
      const total = Math.max(6, Math.round(config.bristles))
      const core = Math.max(config.shaftRadius, tieRadius - halfWidth)
      const rings = [
        { share: 0.19, radius: core * 0.34, slope: 0.3, offset: 0 },
        { share: 0.31, radius: core * 0.62, slope: 0.68, offset: Math.PI / 7 },
        { share: 0.5, radius: core * 0.92, slope: 1, offset: Math.PI / 14 },
      ]
      const fullFlare = Math.atan((tipRadius - tieRadius) / span)

      const bristles: BufferGeometry[] = []
      for (const ring of rings) {
        const n = Math.max(3, Math.round(total * ring.share))
        for (let i = 0; i < n; i += 1) {
          const angle = (i / n) * Math.PI * 2 + ring.offset + jitter(random, 0.1)
          const flare = fullFlare * ring.slope * (0.92 + random() * 0.16)
          // The worn face is shorter: the asymmetry comes from here, not from
          // flattening the bundle. (The flat fan broom is a 19th-century Shaker
          // invention, an anachronism here.)
          const wear = 1 + 0.1 * Math.cos(angle - faceAngle)
          const length = (span / Math.cos(flare)) * wear * (0.97 + random() * 0.06)

          const width = config.shaftRadius * (1.7 + random() * 0.28)
          const depth = config.shaftRadius * (0.78 + random() * 0.16)
          // The cross-section TAPERS DOWNWARDS. Previously it was exactly the
          // reverse — the lower end was both wider and thicker, i.e. the bundle
          // swelled towards the bottom; whereas the sweeping end wears thin
          // over the years.
          const sheaf = taperedBoxGeometry(
            [width * 1.12, depth * 0.62],
            [width, depth],
            length,
            [0, -length / 2, 0],   // top end AT THE ORIGIN: the bundle hangs from the tie
            tint('straw', 0.02, 1.5),
            tint('strawPale', 0.12, 1.5),
          )
          roughenGeometry(sheaf, config.shaftRadius * 0.09, { salt: i, scaleY: 0.4 })

          // THE SIGN: the sheaf extends along -Y. `rotateX(+f)` throws its end
          // towards -Z, and the following `rotateY(angle)` turns -Z TOWARDS THE
          // AXIS — so a positive sign flares the bundle INWARDS, not outwards.
          // This was the case in the previous two versions too: the sheaves
          // crossed the axis and were flung to the far side, which is why the
          // bundle came out a hollow shell. Caught by measurement, not by eye —
          // the bundle's width came out 0.13 m where 0.23 m was expected.
          sheaf.rotateZ(jitter(random, 0.09))
          sheaf.rotateX(-flare)
          sheaf.rotateY(angle)
          sheaf.translate(
            Math.sin(angle) * ring.radius,
            tieY + jitter(random, config.length * 0.005),
            Math.cos(angle) * ring.radius,
          )
          bristles.push(sheaf)
        }
      }

      // --- Collar: the cut butts left above the tie ------------------------------
      // It both covers where the shaft enters the bundle and is the cheapest way
      // of saying "this is a bundle": short stubs tipped upwards.
      for (let i = 0; i < 9; i += 1) {
        const angle = i * 2.399963   // golden angle: no rows form anywhere
        const stub = config.shaftRadius * (1.6 + random() * 1.2)
        const piece = taperedBoxGeometry(
          [config.shaftRadius * 0.62, config.shaftRadius * 0.4],
          [config.shaftRadius * 0.5, config.shaftRadius * 0.34],
          stub,
          [0, stub / 2, 0],   // centre at the LOWER end: this piece juts upwards
          tint('strawPale', 0.16, 1.4),
          tint('straw', 0.04, 1.4),
        )
        // This piece extends along +Y, so the sign is the OPPOSITE of the
        // sheaves': a positive value throws its end towards +Z and `rotateY`
        // turns it outwards.
        piece.rotateZ(jitter(random, 0.08))
        piece.rotateX(0.28 + random() * 0.24)
        piece.rotateY(angle)
        piece.translate(
          Math.sin(angle) * tieRadius * 0.8,
          tieY + config.length * 0.008,
          Math.cos(angle) * tieRadius * 0.8,
        )
        bristles.push(piece)
      }

      // --- Bindings --------------------------------------------------------------
      const turns = Math.max(0, Math.round(config.bindings))
      const bindings: BufferGeometry[] = []
      for (let i = 0; i < turns; i += 1) {
        const y = tieY - config.length * (0.01 + i * 0.042)
        // The binding sits on the bundle's OUTER surface and bites into it a
        // little. Originally the radius was computed from the ring radius, so
        // the binding stayed INSIDE the sheaves and was never visible at all.
        const radius = bundleRadius(y) - config.shaftRadius * 0.16
        bindings.push(bandGeometry(
          radius, y, config.shaftRadius * 1.15, config.shaftRadius * 0.42, 12,
          tint('cloth', -0.28, 0.9), { inner: true },
        ))
      }
      if (turns > 0) {
        // The tucked withy end: the one piece that shows how the tie itself is
        // fastened. Offset so it does not stay parallel to the band's 30° facet.
        const withy = arcBarGeometry(
          bundleRadius(tieY) + config.shaftRadius * 0.24, config.shaftRadius * 0.32,
          -0.5, 0.9, 3, [0, 0, 0], tint('cloth', -0.34, 0.7),
        )
        withy.rotateX(Math.PI / 2)
        withy.rotateY(0.26 + Math.PI / 12)
        withy.translate(0, tieY - config.length * 0.006, 0)
        bindings.push(withy)
      }

      // --- Shaft -------------------------------------------------------------------
      // Not a turned spindle but a hazel rod cut in the forest: the radius
      // wavers along its length, there is a grip swell where the hand holds it,
      // and the top end is whittled. And it is slightly bent — a straight rod
      // always reads as manufactured.
      //
      // Built AT THE ORIGIN and bent, THEN translated: bending it at its final
      // coordinates would fling the whole stick away.
      const shaftBottom = headTop - config.length * 0.1
      const shaftLength = half - shaftBottom
      const r = config.shaftRadius
      const shaftLevels: Level[] = [
        { y: -shaftLength / 2, radius: r * 0.26 },
        { y: -shaftLength / 2 + shaftLength * 0.07, radius: r * 0.82 },
        { y: -shaftLength / 2 + shaftLength * 0.16, radius: r * 1.02 },
        { y: shaftLength * 0.06, radius: r * 0.93 },
        { y: shaftLength / 2 - shaftLength * 0.07, radius: r * 1.14 },   // grip
        { y: shaftLength / 2, radius: r * 0.84 },
      ].map((level) => ({ y: level.y, radius: level.radius * (1 + jitter(random, 0.05)) }))

      const shaft = latheGeometry(shaftLevels, 6, [0, 0, 0], tint('oak', -0.05), {
        colourTop: tint('oak', 0.05),
      })
      bendGeometry(shaft, jitter(random, 0.22) / shaftLength)
      shaft.rotateY(random() * Math.PI * 2)
      shaft.translate(0, shaftBottom + shaftLength / 2, 0)

      return {
        shaft: { slot: 'oak' as const, geometry: mergeColoured([shaft]) },
        bristles: { slot: 'straw' as const, geometry: mergeColoured(bristles) },
        bindings: bindings.length > 0
          ? { slot: 'cloth' as const, geometry: mergeColoured(bindings) }
          : undefined,
      }
    },
  }, overrides)
}
