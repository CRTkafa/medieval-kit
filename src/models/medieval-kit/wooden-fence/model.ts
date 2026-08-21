/**
 * @medieval-kit/wooden-fence
 *
 * Mortised riven fence: riven heavy posts, rails passing THROUGH the post.
 *
 * SECOND attempt, and the reason can be said in one word: JOINERY. The first
 * version was four square sticks with two thin battens laid across their
 * front; at no point was it visible how two pieces held on to each other, so
 * the whole subject of the object was missing. In the render it read not as a
 * fence but as "the technical drawing of a fence" — 4.89 × 1.10 × 0.09 m,
 * i.e. a depth-to-length ratio of 54:1, cardboard.
 *
 * In a real riven post-and-rail fence a RECTANGULAR HOLE is cut through the
 * post and the rail passes through that hole. The entire model was rebuilt
 * around this single fact:
 *
 *   - The post is no longer a single box: two CHEEKS with BRIDGE blocks
 *     between them. The hole therefore exists geometrically, it is not a
 *     painted notch. `bakeOcclusion` darkens its mouth on its own too.
 *   - The rail passes through the hole and PROTRUDES from the far face at the
 *     two ends of the fence. The tenon tongue is the only horizontal
 *     protrusion that enters the silhouette, and it answers the question
 *     "how is this standing up" all by itself.
 *   - The rail is narrower than the hole: a few millimetres of gap remain on
 *     each side, so the hole does not close up. That gap is what shows the
 *     hole as a hole.
 *
 * And the spacing: the old rail distribution was `0.28 + 0.5·r/(count−1)`,
 * i.e. no matter how many rails there were it ALWAYS filled the 0.28–0.78
 * band. Filling the top and the bottom was structurally impossible; that is
 * why the upper edge of the silhouette was empty.
 */
import { Color } from 'three'
import type { BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  taperedBoxGeometry,
} from '../core/index.ts'

export interface WoodenFenceConfig {
  /** Number of sections. Each section is the span between two posts. */
  readonly sections: number
  /** Length of one section (metres). 2–3 m, because a rail is riven from one log. */
  readonly sectionLength: number
  readonly height: number
  /** Number of horizontal rails. */
  readonly railCount: number
  /** Curvature and height deviation of the posts. 0 = factory straightness. */
  readonly rough: number
  /** Whether a brace is placed at one end (0/1). */
  readonly brace: number
  readonly seed: number
}

export const woodenFenceDefaults: WoodenFenceConfig = {
  sections: 2,
  sectionLength: 2.4,
  height: 1.25,
  railCount: 3,
  rough: 1,
  brace: 1,
  seed: 12,
}

export type WoodenFenceParts = 'posts' | 'rails'

export function createModel(overrides: Partial<WoodenFenceConfig> = {}) {
  return createKitModel<WoodenFenceConfig, 'oak', WoodenFenceParts>({
    id: 'wooden-fence',
    // The mottle cell is given by hand: the fence is 4.8 m long, and when the
    // automatic derivation takes it from the model's scale a single post falls
    // into a single cell and the texture system does nothing. The grain mottle
    // of wood is a few centimetres regardless of the object's size.
    mottle: { cell: 0.05 },
    defaults: woodenFenceDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const shade = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.06))
        return tint
      }
      /** End grain: riven surface and cut ends. The fence never used this. */
      const endGrain = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oakEnd)
        tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), lift + jitter(random, 0.05))
        return tint
      }
      const soil = (): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.01), -0.3 + jitter(random, 0.04), -0.19 + jitter(random, 0.04))
        return tint
      }

      const sections = Math.max(1, Math.round(config.sections))
      const count = Math.max(1, Math.round(config.railCount))
      const total = sections * config.sectionLength
      const half = config.height / 2
      const rough = Math.max(0, config.rough)

      // --- Dimensions, all derived from the height --------------------------
      const postW = config.height * 0.12          // post width along the fence
      const mortise = config.height * 0.062       // Z opening of the hole
      const cheek = config.height * 0.03          // material on each side of the hole
      const postD = mortise + cheek * 2           // total depth of the post
      const railH = config.height * 0.098         // vertical height of the rail
      const railD = config.height * 0.053         // rail depth — NARROWER than the hole
      const tenon = config.height * 0.088         // overhang at the ends

      // Rail heights. Exponent 1.12: the gaps tighten towards the bottom,
      // because the animal trying to get under it is the small one.
      const railT = Array.from({ length: count }, (_, r) =>
        count === 1 ? 0.55 : 0.19 + 0.71 * Math.pow(r / (count - 1), 1.12))

      // --- Posts --------------------------------------------------------------
      const postPieces: BufferGeometry[] = []
      const slotHalf = railH / 2 + config.height * 0.008

      for (let i = 0; i <= sections; i += 1) {
        const x = -total / 2 + i * config.sectionLength
        const postH = config.height + jitter(random, 0.075 * rough)
        const pieces: BufferGeometry[] = []

        // Two cheeks: the walls of the hole. Full height, base to top.
        for (const side of [-1, 1]) {
          pieces.push(chamferedBoxGeometry(
            [postW, cheek],
            [postW * 0.81, cheek * 0.94],
            postH,
            cheek * 0.2,
            [0, postH / 2, side * (mortise + cheek) / 2],
            shade(-0.11),
            shade(0.02),
          ))
        }

        // Bridges: blocks that fill the space BETWEEN the slots. The hole is
        // exactly the gap they leave. Their cross-sections stay INSIDE the
        // cheeks (their ±Z faces are buried in the cheek solid), so no pair
        // of faces is coplanar.
        //
        // The bridges do not run all the way to the two ENDS of the post:
        // their ends sat on the same plane as the cheek ends and z-fought.
        // The insets are not visible — they stay inside the soil mound below
        // and inside the cap above.
        const inset = cheek * 0.3
        const bounds = [0, ...railT.flatMap((t) => [t * postH - slotHalf, t * postH + slotHalf]), postH]
        for (let k = 0; k + 1 < bounds.length; k += 2) {
          const lo = Math.max(inset, bounds[k]!)
          const hi = Math.min(postH - inset, bounds[k + 1]!)
          if (hi - lo < 1e-4) continue
          const taper = 1 - 0.19 * (lo / postH)
          pieces.push(taperedBoxGeometry(
            [postW * taper * 0.96, mortise + cheek * 1.1],
            [postW * (taper - 0.03) * 0.96, mortise + cheek * 1.1],
            hi - lo,
            [0, (lo + hi) / 2, 0],
            shade(-0.07),
          ))
        }

        // Cap: an axe-hewn ridge that sheds water. Its base sits INSIDE the body
        // and its section is LARGER than the body's section at that height — the
        // same pattern as `toolSocket`; that is why no coplanar face pair forms.
        pieces.push(taperedBoxGeometry(
          [postW * 0.88, postD * 0.98],
          [postW * 0.74, postD * 0.13],
          config.height * 0.1,
          [0, postH - config.height * 0.016, 0],
          endGrain(-0.03),
          endGrain(0.07),
        ))

        // Build → ROTATE → translate. The old code passed the centre straight
        // into the geometry call, so rotating was impossible; that is why they
        // lined up like a grid. Rotations are kept small: 0.045 rad means 7 mm
        // of lateral drift along the hole, and the hole slack is 8 mm.
        const post = mergeColoured(pieces)
        post.rotateY(jitter(random, 0.045 * rough))
        post.rotateZ(jitter(random, 0.03 * rough))
        post.rotateX(jitter(random, 0.018 * rough))
        const sink = config.height * (0.012 + Math.abs(jitter(random, 0.012)))
        post.translate(x, -half - sink, 0)
        postPieces.push(post)

        // Soil mound. DOES NOT ROTATE: the post's lean would lift it off the ground.
        postPieces.push(taperedBoxGeometry(
          [postW * 2.2, postD * 2],
          [postW * 1.25, postD * 1.15],
          config.height * 0.11,
          [x, -half + config.height * 0.018, 0],
          soil(),
        ))
      }

      // --- Rails ----------------------------------------------------------------
      const railPieces: BufferGeometry[] = []
      for (let r = 0; r < count; r += 1) {
        const y = -half + railT[r]! * config.height + jitter(random, config.height * 0.005)
        for (let i = 0; i < sections; i += 1) {
          const xc = -total / 2 + (i + 0.5) * config.sectionLength
          // The body enters the holes of the two neighbouring posts and meets
          // the body of the adjacent bay end to end in there.
          const body = chamferedBoxGeometry(
            [config.sectionLength + postW * 0.55, railD],
            [config.sectionLength + postW * 0.55, railD * 0.88],
            railH,
            railH * 0.09,
            [xc, y, jitter(random, railD * 0.06)],
            shade(0.05),
            shade(0.1),
          )
          railPieces.push(body)
        }

        // Tenon tongue: ONLY at the two ends. Protruding from the far face, this
        // piece is the only horizontal projection entering the silhouette; it
        // tells on its own that the rail runs through the post. No overhang at
        // the intermediate posts, because there two bodies meet inside the hole.
        for (const side of [-1, 1]) {
          const px = side * total / 2
          railPieces.push(taperedBoxGeometry(
            [tenon * 2, railD * 0.9],
            [tenon * 1.7, railD * 0.76],
            railH * 0.82,
            [px + side * tenon * 0.72, y, 0],
            shade(0.02),
            endGrain(0.05),
          ))
        }
      }

      // --- Brace -----------------------------------------------------------------
      // The model's only off-axis line. It props the end post towards the field.
      if (config.brace >= 0.5) {
        const rise = config.height * 0.72
        const run = config.sectionLength * 0.3
        const length = Math.hypot(run, rise)
        const atStart = random() < 0.5
        const brace = chamferedBoxGeometry(
          [postW * 0.72, postD * 0.36],
          [postW * 0.56, postD * 0.3],
          length,
          postW * 0.06,
          [0, 0, 0],
          shade(-0.05),
          endGrain(0.02),
        )
        // The sign looks INVERTED but this is the correct one: the TOP of the
        // brace leans against the post, its FOOT stands on the field. Flipped,
        // what came out was a stick with its foot at the base of the post and
        // its top in the air — a brace that supports nothing.
        const angle = Math.atan2(run, rise)
        brace.rotateZ(atStart ? angle : -angle)
        brace.translate(
          (atStart ? -1 : 1) * (total / 2 - run / 2),
          -half + rise / 2 + config.height * 0.02,
          // The post's back face is SLOPED (tapered), the brace's is upright —
          // they never become coplanar at any height.
          -postD * 0.62,
        )
        postPieces.push(brace)
      }

      return {
        posts: { slot: 'oak', geometry: mergeColoured(postPieces) },
        rails: { slot: 'oak', geometry: mergeColoured(railPieces) },
      }
    },
  }, overrides)
}
