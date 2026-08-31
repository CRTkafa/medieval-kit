/**
 * @medieval-kit/straw-broom
 *
 * Besom: a hazel-rod handle with a bundle of birch twigs bound to its end by a
 * withy tie. The period's broom really was this simple, and that is exactly why
 * it turns up in every interior scene.
 *
 * FOURTH attempt. In the first, the bristles were individual rods and the
 * bundle looked like a whisk; in the second, flat sheaves on one ring made a
 * hollow cone shell ("a lampshade pushed onto a handle"). The third fixed the
 * shell with concentric rings, but the critique still read it as "a decorative
 * whisk or wheat sheaf", and the causes were mass and proportion, not
 * structure:
 *
 *   - Shaft and bundle were nearly 1:1 and the shaft was a fat dowel. A besom
 *     is a LONG THIN stick with a SHORT dense head: the shaft above the tie is
 *     now about 1.6x the bundle and its radius dropped by 40 percent, tapering
 *     towards the free end like a cut sapling.
 *   - The bundle was bright gold and you could see the background through it.
 *     Birch twigs are grey-brown, near the value of the handle itself, so the
 *     twig colour is straw pulled towards oak. The count nearly tripled, a
 *     fourth ring was added, and a cheap lathe FILLER CONE sits inside the
 *     bundle so no sight line passes through it. Fill the middle with a solid,
 *     not with more twigs: twigs in the core are invisible anyway.
 *   - The flare splayed into a teepee. The tip radius is now about a third of
 *     the bundle length rather than half, which also gathers the twig ends so
 *     the contact shadow reads as one patch instead of scattered fragments.
 *   - Three thin near-black rings floated at the very top. A real withy tie is
 *     several adjacent turns forming ONE WRAP BAND over about a quarter of the
 *     bundle, in pale withy, not black cord: `bindings` now means turns WITHIN
 *     that band, stacked contiguously below the throat.
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
  /** Turns of withy within the single wrap band. */
  readonly bindings: number
  readonly seed: number
}

export const strawBroomDefaults: StrawBroomConfig = {
  length: 1.2,
  // Was 0.018: a dowel. A cut hazel rod carrying a twig head runs nearer 22 mm
  // across, and the thin shaft is half of what makes the head read as dense.
  shaftRadius: 0.011,
  // Was 0.52, which made shaft and head nearly equal. The reference carries
  // roughly 1.6x as much shaft above the tie as bundle below it, and 0.38
  // gives 0.74 m of shaft over a 0.46 m head.
  headLength: 0.38,
  tieRadius: 0.042,
  // About a third of the bundle length. The old 0.17 against a 0.62 m bundle
  // splayed the skirt into a teepee; the reference fans out gently and stays
  // gathered, and the tighter skirt also pools the ground shadow into one
  // patch under the head.
  tipRadius: 0.14,
  // Tripled from 46. At 46 the gaps between sheaves were wider than the
  // sheaves and the background showed straight through the cone.
  bristles: 130,
  bindings: 5,
  seed: 59,
}

export type StrawBroomParts = 'shaft' | 'bristles' | 'bindings'

export function createModel(overrides: Partial<StrawBroomConfig> = {}) {
  return createKitModel<StrawBroomConfig, 'oak' | 'straw' | 'cloth', StrawBroomParts>({
    id: 'straw-broom',
    // The auto-derived values stay too coarse for a 1.2 m object: the ambient
    // occlusion darkens the bundle like a blanket, and the mottle cell drops to
    // a couple of samples per twig. Both are tied to the scale of a twig.
    occlusion: { radius: 0.05 },
    mottle: { cell: 0.016 },
    defaults: strawBroomDefaults,
    slots: ['oak', 'straw', 'cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      /**
       * Birch-twig grey-brown: straw pulled towards oak. The palette's straw is
       * bright gold, and a bundle of it read as a wheat sheaf; real besom twigs
       * sit near the value of the handle itself. Both tints are fresh Colors,
       * so the lerp cannot alias (the shared-Color trap).
       */
      const twigTint = (lift: number, spread = 1.2) =>
        tint('straw', lift, spread).lerp(tint('oak', lift * 0.5, spread * 0.7), 0.45)
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
      // it: outer surface = ring radius + half the twig's width.
      const halfWidth = config.shaftRadius * 0.95
      /** The bundle's OUTER radius at height `y`. The bindings use this too. */
      const bundleRadius = (y: number): number =>
        tieRadius + (tipRadius - tieRadius) * Math.min(1, Math.max(0, (tieY - y) / span))

      // A broom has a FACE: held in the hand, the same side always meets the
      // floor and that side wears down more. The direction is chosen once,
      // driven by the seed.
      const faceAngle = random() * Math.PI * 2

      // --- Twigs: four concentric rings, and a filler --------------------------
      // The inner rings have little slope, the outer one has the full slope.
      // That is why the inside of the bundle fills in; a single ring is a shell.
      const total = Math.max(8, Math.round(config.bristles))
      const core = Math.max(config.shaftRadius, tieRadius - halfWidth)
      const rings = [
        { share: 0.13, radius: core * 0.28, slope: 0.22, offset: 0 },
        { share: 0.2, radius: core * 0.52, slope: 0.5, offset: Math.PI / 9 },
        { share: 0.28, radius: core * 0.76, slope: 0.78, offset: Math.PI / 5 },
        { share: 0.39, radius: core, slope: 1, offset: Math.PI / 13 },
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
          const wear = 1 + 0.07 * Math.cos(angle - faceAngle)
          // The spread runs DOWN from 1.0, never above it: the span is the
          // longest twig and `length` means the whole broom. The tips still
          // feather — a level cut across the bottom is what made version two
          // read as a lampshade — but the variation tightened from a third to
          // a fifth, because at a third the skirt scattered and the critique
          // saw the stray tips' shadows as loose fragments on the ground.
          const length = (span / Math.cos(flare)) * wear * (0.85 + random() * 0.15)

          const width = config.shaftRadius * (1.05 + random() * 0.24)
          const depth = config.shaftRadius * (0.6 + random() * 0.14)
          // The cross-section TAPERS DOWNWARDS: the sweeping end wears thin.
          const sheaf = taperedBoxGeometry(
            [width * 1.12, depth * 0.62],
            [width, depth],
            length,
            [0, -length / 2, 0],   // top end AT THE ORIGIN: the bundle hangs from the tie
            twigTint(-0.03, 1.3),
            twigTint(-0.09, 1.3),
          )
          roughenGeometry(sheaf, config.shaftRadius * 0.09, { salt: i, scaleY: 0.4 })

          // THE SIGN: the sheaf extends along -Y. `rotateX(+f)` throws its end
          // towards -Z, and the following `rotateY(angle)` turns -Z TOWARDS THE
          // AXIS — so a NEGATIVE flare is what spreads the bundle outwards.
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

      // The filler: a dark lathe cone INSIDE the bundle, following the bundle's
      // own profile at 85 percent. Twigs in the core are invisible, so the
      // cheap way to kill every see-through sight line is a solid, not more
      // twigs. It hangs from the tie like everything else and its lower end
      // stops inside the thick of the bundle, hidden by the outer rings.
      const fillLength = span * 0.6
      const filler = latheGeometry(
        [
          { y: 0, radius: tieRadius * 0.85 },
          { y: -fillLength * 0.5, radius: bundleRadius(tieY - fillLength * 0.5) * 0.85 },
          { y: -fillLength, radius: bundleRadius(tieY - fillLength) * 0.8 },
        ],
        8, [0, tieY, 0], twigTint(-0.13, 0.7),
      )
      bristles.push(filler)

      // --- Collar: the cut butts left above the tie ------------------------------
      // It both covers where the shaft enters the bundle and is the cheapest way
      // of saying "this is a bundle": short stubs tipped upwards.
      for (let i = 0; i < 11; i += 1) {
        const angle = i * 2.399963   // golden angle: no rows form anywhere
        const stub = config.shaftRadius * (2.0 + random() * 1.5)
        const piece = taperedBoxGeometry(
          [config.shaftRadius * 0.62, config.shaftRadius * 0.4],
          [config.shaftRadius * 0.5, config.shaftRadius * 0.34],
          stub,
          [0, stub / 2, 0],   // centre at the LOWER end: this piece juts upwards
          twigTint(0.03, 1.2),
          twigTint(-0.02, 1.2),
        )
        // This piece extends along +Y, so the sign is the OPPOSITE of the
        // sheaves': a positive value throws its end towards +Z and `rotateY`
        // turns it outwards.
        piece.rotateZ(jitter(random, 0.08))
        piece.rotateX(0.24 + random() * 0.22)
        piece.rotateY(angle)
        piece.translate(
          Math.sin(angle) * tieRadius * 0.72,
          tieY + config.length * 0.008,
          Math.cos(angle) * tieRadius * 0.72,
        )
        bristles.push(piece)
      }

      // --- Binding: one wrap band of several turns -------------------------------
      // Not three thin cords at the throat: a withy tie is wound turn against
      // turn until the wrap covers about a quarter of the bundle, and it is
      // pale peeled withy, lighter than the twigs, not near-black cord (the old
      // -0.28 lift bottomed out on the tinter's floor).
      const turns = Math.max(0, Math.round(config.bindings))
      const wrapLength = span * 0.19
      const turnHeight = wrapLength / Math.max(1, turns)
      const bindings: BufferGeometry[] = []
      for (let i = 0; i < turns; i += 1) {
        const y = tieY - config.length * 0.004 - turnHeight * (i + 0.5)
        // Each turn sits JUST proud of the bundle's OUTER surface at ITS OWN
        // height and bites into it, so the stack follows the flare. When the
        // turns stood a fifth of a shaft radius proud in pale withy the wrap
        // stepped outwards like a beehive skep and dominated the whole head; a
        // tie is a thin skin over the twigs, not a basket around them.
        const radius = bundleRadius(y) + config.shaftRadius * (0.08 + jitter(random, 0.04))
        bindings.push(bandGeometry(
          radius, y, turnHeight * 0.96, config.shaftRadius * 0.9, 12,
          tint('cloth', -0.04, 0.8).lerp(tint('straw', -0.05, 0.8), 0.5),
          { inner: true },
        ))
      }
      if (turns > 0) {
        // The tucked withy end: the one piece that shows how the tie itself is
        // fastened. Offset so it does not stay parallel to the band's 30° facet.
        const withyY = tieY - config.length * 0.004 - wrapLength * 0.4
        const withy = arcBarGeometry(
          bundleRadius(withyY) + config.shaftRadius * 0.35, config.shaftRadius * 0.5,
          -0.5, 0.9, 3, [0, 0, 0],
          tint('cloth', -0.07, 0.7).lerp(tint('straw', -0.08, 0.7), 0.5),
        )
        withy.rotateX(Math.PI / 2)
        withy.rotateY(0.26 + Math.PI / 12)
        withy.translate(0, withyY, 0)
        bindings.push(withy)
      }

      // --- Shaft -------------------------------------------------------------------
      // Not a turned spindle but a hazel rod cut in the forest: the radius
      // wavers along its length and the rod TAPERS TOWARDS THE FREE END, the
      // way a cut sapling does — the old version swelled at the top like a
      // turned grip and read as a dowel. The whittled thin end is the one
      // buried in the bundle. And it is slightly bent — a straight rod always
      // reads as manufactured.
      //
      // Built AT THE ORIGIN and bent, THEN translated: bending it at its final
      // coordinates would fling the whole stick away.
      const shaftBottom = headTop - config.length * 0.12
      const shaftLength = half - shaftBottom
      const r = config.shaftRadius
      const shaftLevels: Level[] = [
        { y: -shaftLength / 2, radius: r * 0.55 },
        { y: -shaftLength / 2 + shaftLength * 0.06, radius: r * 1.1 },
        { y: -shaftLength / 2 + shaftLength * 0.2, radius: r * 1.04 },
        { y: shaftLength * 0.05, radius: r * 0.97 },
        { y: shaftLength / 2 - shaftLength * 0.12, radius: r * 0.88 },
        { y: shaftLength / 2, radius: r * 0.7 },
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
