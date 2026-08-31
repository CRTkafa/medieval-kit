/**
* @medieval-kit/wooden-crate
*
* A crate is not a box: it is rows of horizontal boards nailed to four corner
* posts. The thin gaps between them, and the posts standing proud of them, are
* what give the silhouette its "assembled" reading. This model builds it that
* way.
*
* It shares the same core as the barrel: the same oak tone, the same
* deterministic randomness, the same vertex-colour technique. That is why they
* look as if they came from the same catalogue when you stand them side by
* side.
*/
import { Color, type BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  createRandom,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  type Vec3,
} from '../core/index.ts'

export interface WoodenCrateConfig {
  /** Width (X axis, metres). */
  readonly width: number
  /** Height (metres). */
  readonly height: number
  /** Depth (Z axis, metres). */
  readonly depth: number
  /** Number of horizontal board rows on each face. */
  readonly plankRows: number
  /** Iron strap count. 0 = plain wooden crate. */
  readonly strapCount: number
  /** Variation seed. */
  readonly seed: number
}

export const woodenCrateDefaults: WoodenCrateConfig = {
  width: 0.66,
  height: 0.52,
  depth: 0.52,
  // Four rows, not three. The reference reads as a stack of boards and at
  // three courses each one is deep enough to look like a panel with a line
  // scored across it.
  plankRows: 4,
  strapCount: 2,
  seed: 3,
}

export type WoodenCrateParts = 'posts' | 'planks' | 'straps'

const SLOTS = ['oak', 'iron'] as const
type Slot = (typeof SLOTS)[number]

export function createModel(overrides: Partial<WoodenCrateConfig> = {}) {
  return createKitModel<WoodenCrateConfig, 'oak' | 'iron', WoodenCrateParts>({
      id: 'wooden-crate',
      defaults: woodenCrateDefaults,
      slots: SLOTS,
      build: ({ config, random }) => {
        /**
        * The dimension contract.
        *
        * Z-FIGHTING RULE: no two surfaces may overlap in the same plane facing the
        * same way. In real joinery the parts interlock, and we do the same here. The
        * posts stand proud of the boards, the lid and the floor overhang the frame a
        * little, the boards are butt-jointed to one another. That way every surface
        * is alone in its own plane.
        */
        const dims = () => {
          const post = Math.min(config.width, config.depth) * 0.11
          const board = post * 0.5
          return {
            post,
            board,
            /** How far the posts stand proud of the board surface. */
            postProud: board * 0.45,
            /** Overhang of the lid and the floor beyond the frame. */
            overhang: board * 0.6,
            half: config.height / 2,
          }
        }

        function buildPosts(random: () => number): BufferGeometry {
          const { post, board, half } = dims()
          const tint = new Color()
          const pieces: BufferGeometry[] = []
          const x = config.width / 2 - post / 2
          const z = config.depth / 2 - post / 2
          // The posts run INTO the lid and the floor; because their ends stay
          // inside those solid pieces they are invisible and align with nothing.
          const reach = half - board * 0.3

          for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
            tint.copy(MEDIEVAL_PALETTE.oak)
            // Posts are a bit darker than the body: a different cut, more wear.
            tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), -0.045 + jitter(random, 0.02))
            pieces.push(chamferedBoxGeometry(
                [post, post], [post, post], reach * 2,
                board * 0.16, [sx * x, 0, sz * z], tint,
            ))
          }

          return mergeColoured(pieces)
        }

        function buildPlanks(random: () => number): BufferGeometry {
          const { board, postProud, overhang, half } = dims()
          const tint = new Color()
          const pieces: BufferGeometry[] = []

          // The side boards are pulled BEHIND the posts: their outer faces are not at
          // ±width/2 but at ±(width/2 - postProud). That is why they never share a plane
          // with the posts.
          const faceX = config.width / 2 - postProud - board / 2
          const faceZ = config.depth / 2 - postProud - board / 2
          // Butt joint: the front/back boards bear against the inner face of the side
          // boards. They touch but do not overlap — edge contact produces no z-fighting.
          const spanX = (config.width / 2 - postProud - board) * 2
          const spanZ = (config.depth / 2 - postProud - board) * 2

          // The rows reach far enough to enter the lid and the floor, but they end
          // at a DIFFERENT height than the ends of the posts.
          const wallTop = half - board * 0.65
          const rows = Math.max(1, config.plankRows)
          const gap = config.height * 0.015
          const rowHeight = (wallTop * 2 - gap * (rows - 1)) / rows

          for (let row = 0; row < rows; row += 1) {
            const y = -wallTop + rowHeight / 2 + row * (rowHeight + gap)
            for (const side of [-1, 1] as const) {
              tint.copy(MEDIEVAL_PALETTE.oak)
              tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), jitter(random, 0.06))
              pieces.push(chamferedBoxGeometry(
                  [spanX, board], [spanX, board], rowHeight,
                  board * 0.16, [0, y, side * faceZ], tint,
              ))

              tint.copy(MEDIEVAL_PALETTE.oak)
              tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), jitter(random, 0.06))
              pieces.push(chamferedBoxGeometry(
                  [board, spanZ], [board, spanZ], rowHeight,
                  board * 0.16, [side * faceX, y, 0], tint,
              ))
            }
          }

          /**
           * The diagonal brace, which is the thing the reference leads with.
           *
           * One board corner post to corner post across each long face, standing
           * proud of the courses by half its own thickness so it crosses them
           * instead of joining them. Without it the long face is a field of
           * parallel horizontals and the crate reads as a panelled box; with it
           * the face reads as framed boarding, which is what it is.
           */
          const diagLen = Math.hypot(spanX, wallTop * 2) * 0.99
          const diagAngle = Math.atan2(spanX, wallTop * 2)
          for (const side of [-1, 1] as const) {
            tint.copy(MEDIEVAL_PALETTE.oak)
            tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), 0.03 + jitter(random, 0.04))
            const brace = chamferedBoxGeometry(
              [board * 0.95, board * 0.8], [board * 0.95, board * 0.8],
              diagLen, board * 0.14, [0, 0, 0], tint,
            )
            // Built standing; laid over onto the diagonal. rotateZ sends +Y to
            // (-sin, cos), so the angle is negated to send it toward +X.
            brace.rotateZ(-side * diagAngle)
            brace.translate(0, 0, side * (faceZ + board * 0.45))
            pieces.push(brace)
          }

          // Lid and floor: board sheets that sit on top of and under the frame and
          // overhang it a little. The overhang keeps their side faces from aligning
          // with the faces of the posts.
          const slabWidth = config.width + overhang * 2
          const slabDepth = config.depth + overhang * 2
          const slabBoards = 3
          const slabGap = slabDepth * 0.014
          const boardDepth = (slabDepth - slabGap * (slabBoards - 1)) / slabBoards

          for (const [y, shade] of [[half - board / 2, 0.03], [-half + board / 2, -0.05]] as const) {
            for (let i = 0; i < slabBoards; i += 1) {
              tint.copy(MEDIEVAL_PALETTE.oakEnd)
              tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), shade + jitter(random, 0.05))
              pieces.push(chamferedBoxGeometry(
                  [slabWidth, boardDepth],
                  [slabWidth, boardDepth],
                  board,
                  board * 0.16,
                  [0, y, -slabDepth / 2 + boardDepth / 2 + i * (boardDepth + slabGap)],
                  tint,
              ))
            }
          }

          return mergeColoured(pieces)
        }

        function buildStraps(random: () => number): BufferGeometry | undefined {
          if (config.strapCount <= 0) return undefined

          const { post } = dims()
          const tint = new Color()
          const pieces: BufferGeometry[] = []
          const bandHeight = config.height * 0.07
          const proud = post * 0.3

          for (let i = 0; i < config.strapCount; i += 1) {
            // The straps sit symmetrically from the top and the bottom inwards.
            const t = config.strapCount === 1
            ? 0
            : 0.6 - (1.2 * i) / (config.strapCount - 1)
            const y = (t * config.height) / 2
            tint.copy(MEDIEVAL_PALETTE.iron)
            tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.06))

            // The front/back straps stand proud at the corners; the side straps end
            // BEFORE reaching them. That way the top faces of the four pieces do not
            // sit on top of each other at the corner.
            pieces.push(
              chamferedBoxGeometry([config.width + proud * 2, proud], [config.width + proud * 2, proud], bandHeight, proud * 0.22, [0, y, config.depth / 2], tint),
              chamferedBoxGeometry([config.width + proud * 2, proud], [config.width + proud * 2, proud], bandHeight, proud * 0.22, [0, y, -config.depth / 2], tint),
              chamferedBoxGeometry([proud, config.depth - proud], [proud, config.depth - proud], bandHeight, proud * 0.22, [config.width / 2, y, 0], tint),
              chamferedBoxGeometry([proud, config.depth - proud], [proud, config.depth - proud], bandHeight, proud * 0.22, [-config.width / 2, y, 0], tint),
            )
          }

          return mergeColoured(pieces)
        }

        // The call ORDER must be kept: the seeded randomness advances as a
        // stream, and if the order changes so does the geometry.
        const postsPart = buildPosts(random)
        const planksPart = buildPlanks(random)
        const strapsPart = buildStraps(random)

        return {
          posts: { slot: 'oak' as const, geometry: postsPart },
          planks: { slot: 'oak' as const, geometry: planksPart },
          straps: strapsPart ? { slot: 'iron' as const, geometry: strapsPart } : undefined,
        }
      },
    }, overrides)
}
