/**
 * @medieval-kit/market-stall
 *
 * A plank table on a braced trestle, four posts, and a linen awning over it.
 *
 * This is the piece the kit was assembled around without having: it is where
 * the basket, the vegetables, the sack, the crate and the coin pouch all
 * belong, and a market with none of it is a row of props on the floor. It is
 * also the only thing here with a roof.
 *
 * The awning SAGS, and that is the whole model. A flat sheet on four posts is
 * a table with a lid; cloth slung between four points hangs, and the dip is
 * what says it is cloth before the colour does. It costs nothing here:
 * `dishedSheetGeometry` bends its cross section by `curve`, and one turn about
 * X maps that bend onto the world's vertical — so the sag is the helper's own
 * parameter rather than anything hand-built.
 *
 * The front edge dips further than the back, which is also the reference and
 * is the reason the sag is per-level rather than one number: cloth pulled over
 * a ridge and left loose at the eaves does not hang symmetrically.
 */
import { Color, type BufferGeometry } from 'three'

import {
  boxGeometry,
  createKitModel,
  createTinter,
  dishedSheetGeometry,
  jitter,
  mergeColoured,
  taperedBoxGeometry,
  type SheetLevel,
} from '../core/index.ts'

export interface MarketStallConfig {
  /** Along the counter (metres). */
  readonly length: number
  /** Front to back (metres). */
  readonly depth: number
  /** Height of the counter top (metres). */
  readonly height: number
  /** Height of the awning above the ground (metres). */
  readonly awning: number
  /** How far the cloth hangs between the posts, as a fraction of the depth. */
  readonly sag: number
  /** Boards in the counter top. */
  readonly planks: number
  readonly seed: number
}

export const marketStallDefaults: MarketStallConfig = {
  length: 1.62,
  depth: 0.76,
  height: 0.78,
  awning: 1.94,
  // 0.10 of the depth, not 0.17. At 0.17 the cloth dropped a tenth of its own
  // span between the posts and read as a hammock; the reference hangs about
  // half that. Cloth stretched over a stall is pulled tight and then sags a
  // little, which is a different shape from cloth thrown over it.
  sag: 0.1,
  planks: 6,
  seed: 29,
}

export type MarketStallParts = 'top' | 'trestle' | 'posts' | 'awning'

export function createModel(overrides: Partial<MarketStallConfig> = {}) {
  return createKitModel<MarketStallConfig, 'oak' | 'cloth', MarketStallParts>({
    id: 'market-stall',
    defaults: marketStallDefaults,
    slots: ['oak', 'cloth'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = Math.max(0.5, config.length)
      const D = Math.max(0.3, config.depth)
      const H = Math.max(0.3, config.height)
      const roofY = Math.max(H + 0.25, config.awning)
      const planks = Math.max(2, Math.round(config.planks))
      const timberSize = D * 0.075

      /** Weathered, like the grindstone's frame: a stall lives outdoors. */
      const timber = (lift = 0): Color => {
        const c = tint('oak', -0.08 + lift, 0.85)
        c.offsetHSL(0, -0.09, 0)
        return c
      }

      // --- Counter top ----------------------------------------------------
      // Boards with a hair of daylight between them. The gap is what makes it
      // a counter rather than a slab, and it is why the planks are separate
      // boxes rather than one.
      const boardT = timberSize * 0.62
      const topY = H - boardT / 2
      const pitch = D / planks
      // The counter stops SHORT of the posts, which stand at the two ends.
      // Run to the full length the boards had posts driven through them a
      // hand's breadth from each end, which is not how a stall is built and
      // not what the reference shows: the top lies between the posts.
      const postSize = timberSize * 0.72
      const topL = L - postSize * 2.6
      const top: BufferGeometry[] = []
      for (let i = 0; i < planks; i += 1) {
        top.push(boxGeometry(
          [topL, boardT, pitch * 0.93],
          [0, topY + jitter(random, boardT * 0.06), -D / 2 + pitch * (i + 0.5)],
          timber(jitter(random, 0.05)),
        ))
      }

      // --- Trestle --------------------------------------------------------
      const trestle: BufferGeometry[] = []
      const legX = L / 2 - timberSize * 1.6
      const legZ = D / 2 - timberSize * 1.3
      const railY = H - boardT - timberSize * 0.5
      // Two rails under the top, running the length, which is what the legs
      // and the posts both fasten to.
      for (const sz of [-1, 1] as const) {
        // Full length, so they reach the posts at the ends.
        trestle.push(boxGeometry(
          [L, timberSize, timberSize * 0.85],
          [0, railY, sz * legZ],
          timber(-0.02),
        ))
      }
      // Legs, splayed a little on the way down so the thing is not a card
      // table. Splayed by WIDENING rather than by rotating, which is what lets
      // the foot sit flat.
      const splay = timberSize * 1.5
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          trestle.push(taperedBoxGeometry(
            [timberSize * 1.15, timberSize * 1.15],
            [timberSize, timberSize],
            // Up INTO the rail and stopping there. Run to the rail's own top
            // face the leg ends level with it — two upward faces in the plane
            // y = 0.745, which the checker found at all four corners before
            // anything was rendered. A leg is housed in a rail, not flush
            // with it.
            railY + timberSize * 0.18,
            [
              sx * (legX + splay * 0.5),
              (railY + timberSize * 0.18) / 2,
              sz * (legZ + splay * 0.35),
            ],
            timber(-0.05 + jitter(random, 0.04)),
          ))
        }
      }
      // The braces from the leg up to the rail. They are the reference's most
      // recognisable joint and they are also what stops the top racking.
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const foot: readonly [number, number, number] = [
            sx * (legX + splay * 0.42), railY * 0.42, sz * (legZ + splay * 0.2),
          ]
          const head: readonly [number, number, number] = [
            sx * (legX - L * 0.16), railY, sz * legZ,
          ]
          const dx = head[0] - foot[0]
          const dy = head[1] - foot[1]
          const dz = head[2] - foot[2]
          const len = Math.hypot(dx, dy, dz)
          const brace = taperedBoxGeometry(
            [timberSize * 0.7, timberSize * 0.7],
            [timberSize * 0.62, timberSize * 0.62],
            len,
            [0, len / 2, 0],
            timber(-0.03),
          )
          // Built at the origin and turned, the construction that has never
          // gone wrong here. The bearing comes off the two ends, not out of a
          // guess: rotateZ then rotateY sends +Y to
          // (-sin t cos a, cos t, sin t sin a), so a = atan2(dz, -dx).
          brace.rotateZ(Math.acos(Math.max(-1, Math.min(1, dy / len))))
          brace.rotateY(Math.atan2(dz, -dx))
          trestle.push(brace.translate(foot[0], foot[1], foot[2]))
        }
      }
      // The low stretcher and its cross piece.
      const tieY = railY * 0.26
      trestle.push(boxGeometry(
        [(legX + splay * 0.46) * 2, timberSize * 0.8, timberSize * 0.7],
        [0, tieY, 0],
        timber(-0.07),
      ))
      for (const sx of [-1, 1] as const) {
        trestle.push(boxGeometry(
          [timberSize * 0.7, timberSize * 0.7, (legZ + splay * 0.3) * 2],
          [sx * (legX + splay * 0.46), tieY, 0],
          timber(-0.06),
        ))
      }

      // --- Posts ----------------------------------------------------------
      // They run from the RAIL, not from the top: bolted to the frame is how
      // the reference carries them, and it is also what puts them beyond doubt
      // for the support check — a post standing on a plank top would be held up
      // by six millimetres of board.
      const posts: BufferGeometry[] = []
      const postX = L / 2 - postSize * 0.5

      // The awning's shape, worked out here because the POSTS need it.
      const overhang = timberSize * 1.8
      const sag = Math.max(0, config.sag) * D
      const halfLength = L / 2 + overhang
      const halfDepth = D / 2 + overhang
      const tilt = 0.055

      /**
       * How high the cloth hangs over a point on the ground.
       *
       * Every post has to reach it, and each of the four reaches a different
       * height: the sheet is a parabola across its length and it is deeper at
       * the front than the back, so a single post height leaves some of them
       * short. Built with one, the cloth came away as its own floating piece
       * 67 mm above the post heads — held up in the drawing and by nothing in
       * the geometry.
       *
       * This is the sheet's own arithmetic rather than a second version of it:
       * the same parabola, the same per-level sag, the same quarter turn that
       * maps the helper's `curve` onto the world's vertical, and the same
       * small tilt after it.
       */
      const clothY = (x: number, z: number): number => {
        const f = (-z + halfDepth) / (2 * halfDepth)
        const u = x / halfLength
        const curve = sag * (0.72 + f * 0.55)
        return roofY + Math.cos(tilt) * curve * u * u + Math.sin(tilt) * z
      }

      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          // ON the cloth's mid surface, so half its thickness covers the head.
          //
          // A shade PAST it was the first version, and four dark post heads
          // came through the awning like tacks — the same fault as the bench's
          // tenons and made for the same reason: pushed proud to keep two
          // faces out of one plane. Buried does that too, and cannot be seen
          // doing it.
          const head = clothY(sx * postX, sz * legZ)
          // Down PAST the rail and finishing as a stub below it, which is both
          // the reference's detail and the fix for a real fault: stopped at the
          // rail's underside, the post's foot lay in the same plane as it,
          // facing the same way — `plane 0,-1,0 | -0.688` at all four corners.
          const foot = railY - timberSize * 1.8
          posts.push(taperedBoxGeometry(
            [postSize, postSize],
            [postSize * 0.88, postSize * 0.88],
            head - foot,
            [sx * postX, (foot + head) / 2, sz * legZ],
            timber(0.02 + jitter(random, 0.03)),
          ))
        }
      }

      // --- Awning ---------------------------------------------------------
      /**
       * Cloth slung between the four post heads.
       *
       * `dishedSheetGeometry` builds in the XY plane and bends its cross
       * section along Z by `curve`. Turning it a quarter about X maps that
       * bend onto the world's vertical, so the parabola the helper already
       * draws IS the hang of the cloth: levels run front to back, the half
       * width is half the stall's length, and the sag is a parameter rather
       * than something modelled.
       *
       * `curve` lifts the EDGES relative to the middle, which is the right way
       * round — the cloth is held at the posts and falls between them.
       */
      const levels: SheetLevel[] = []
      const steps = 4
      for (let i = 0; i < steps; i += 1) {
        const f = i / (steps - 1)
        levels.push({
          y: halfDepth * (f * 2 - 1),
          halfWidth: halfLength,
          // Thick enough to hide a post head in. At 0.2 of a board there was
          // barely three millimetres of cloth either side of the mid surface,
          // which is not enough to bury anything in with confidence.
          thickness: boardT * 0.42,
          // Deeper at the front than the back. Cloth pulled over a ridge and
          // left loose at the eaves does not hang symmetrically.
          curve: sag * (0.72 + f * 0.55),
        })
      }
      const awning = dishedSheetGeometry(levels, 6, tint('cloth', 0.04, 0.9))
      awning.rotateX(-Math.PI / 2)
      // A shade of fall front to back, on top of the sag. Same axis as the
      // turn above, so it is one angle rather than a second rotation.
      awning.rotateX(-tilt)
      awning.translate(0, roofY, 0)

      return {
        top: { slot: 'oak' as const, geometry: mergeColoured(top) },
        trestle: { slot: 'oak' as const, geometry: mergeColoured(trestle) },
        posts: { slot: 'oak' as const, geometry: mergeColoured(posts) },
        awning: { slot: 'cloth' as const, geometry: awning },
      }
    },
  }, overrides)
}
