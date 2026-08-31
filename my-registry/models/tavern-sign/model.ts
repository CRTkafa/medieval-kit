/**
 * @medieval-kit/tavern-sign
 *
 * A wooden board swinging on chains from a forged iron arm on a freestanding
 * timber post.
 *
 * Since literacy was rare, a period sign carried a PICTURE, not TEXT: a garland
 * meant the vintner, a boot the cobbler, a mortar the apothecary. So the model
 * gives the board itself, not the device on it — the consumer attaches whatever
 * they want to `parts.board.anchor`. This is exactly what the protocol's idea
 * of semantic parts is good for.
 *
 * The swing is a different pendulum from the bell's: here the restoring force
 * is not gravity but the friction of two rings. So a sign at rest always hangs
 * STRAIGHT, but once pushed it oscillates for a long time. Put next to the
 * bell's hard, fast damping, the difference between the two reads immediately.
 *
 * DEAD ENDS, so far four rounds of them:
 *   1. The bracket was bolted to a wall the model did not contain, so the
 *      whole sign floated. It became a standing post.
 *   2. The brace and the curl were boxes put through `bendGeometry`, which
 *      shears a two-level box instead of bending it; both were replaced with
 *      `arcBarGeometry`.
 *   3. The post was a stick. A blind critique scored the model 60 and put
 *      almost all of the loss below the sign; the cross base, heavy post, cap,
 *      collars and knee brace date from that pass, as does the grey-washed oak
 *      (the `oak` helper below, with its lightness floor against the
 *      renderer's gamma crush).
 *   4. A second blind critique (66) found the pass-3 fixes overshot or
 *      half-done, plus real modelling bugs:
 *      - The battens were built 8 mm BEHIND the board's back face — floating,
 *        and from half the angles they read as a stray strap lying on the
 *        front. Battens are gone; the planks now touch at a chamfer-groove
 *        seam instead.
 *      - The planks were wedge-tapered through their thickness, so the board
 *        read as two splayed slabs. They are straight now.
 *      - The chain lugs were thicker than the board and ran down its face.
 *        Replaced with eye rings half-buried in the board's top edge, and the
 *        chain stops above the edge so no link crosses the face.
 *      - The cone cap overhung the post like a roof; now a slim pyramid whose
 *        base matches the post's cross-section (about half a post-width tall).
 *      - The two collars were black blocks a third of a post-width tall,
 *        stacked into one collar; now two thin straps (about an eighth), one
 *        at the arm, one up where the tie rod anchors, projecting only a few
 *        percent past the post faces — which also terminates the rod's top.
 *      - The bearer was a stub; it is now a real through-timber about 0.8
 *        post-widths across reaching 55% of the arm's length, the arm seats
 *        flat on its top face, and the knee brace lands inside its underside.
 *      - The hexagonal ring "scroll" is now a C-scroll volute: a 255-degree
 *        arc rising off the arm at the tie-rod junction, its free end closed
 *        by a forged ball so nothing terminates in the open.
 *      - The post dropped from 1:9 to 1:13 width-to-height (the reference is
 *        nearer 1:14), the board widened to 1.26:1 with two planks, and every
 *        board corner carries the hanging-sign cusp: the edges step in before
 *        the corner and a diagonal tab pokes back out to the corner point.
 *      - `plankCount` changed MEANING: it now counts the SEAMS, and the board
 *        carries plankCount + 1 planks. Do not change it back to a plank
 *        count with a default of 2.
 */
import type { BufferGeometry } from 'three'

import {
  arcBarGeometry,
  bandGeometry,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  taperedBoxGeometry,
} from '../core/index.ts'

export interface TavernSignConfig {
  /** Board width (metres). */
  readonly width: number
  /** Board height (metres). */
  readonly height: number
  /** How far the bracket projects from the post (metres). */
  readonly reach: number
  /** Height of the post the arm is bolted to (metres). */
  readonly postHeight: number
  /** Length of the hanging chain (metres). */
  readonly drop: number
  /** Seams between the boards: the sign carries plankCount + 1 planks. */
  readonly plankCount: number
  /** How fast the swing damps out. */
  readonly damping: number
  readonly seed: number
}

export const tavernSignDefaults: TavernSignConfig = {
  // 1.26:1, wider than tall — the reference board is about 1.2:1. The old
  // 0.72 x 0.52 read as roughly square once the corner cusps came off.
  width: 0.78,
  height: 0.62,
  // About 1.5 board widths. At 0.62 the board's inner planks ended flush
  // against the post face and read as clipped by it; now the inner edge
  // clears the post comfortably.
  reach: 1.15,
  postHeight: 2.15,
  // Long enough to see the chain. At 0.12 the board hung almost against the
  // bracket and the five links that connect them were a smudge; the chain is
  // half of what makes a hanging sign read as hanging.
  drop: 0.3,
  // One seam: two planks, which is what the reference board is made of.
  plankCount: 1,
  damping: 0.42,
  seed: 73,
}

// The chains are NOT a separate part: they have to swing together with the
// board, so they live as its `extras` body.
export type TavernSignParts = 'bracket' | 'board' | 'post'

export interface TavernSignActions {
  /** Pushes the sign: wind, or someone coming out of the door. */
  push(strength?: number): void
  still(): void
  /** Current swing angle (radians). */
  lean(): number
}

export function createModel(overrides: Partial<TavernSignConfig> = {}) {
  let angle = 0
  let velocity = 0

  return createKitModel<TavernSignConfig, 'oak' | 'iron', TavernSignParts, TavernSignActions>({
    id: 'tavern-sign',
    defaults: tavernSignDefaults,
    slots: ['oak', 'iron'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      // Decades outdoors: rain leaches the tannin out of oak and leaves it
      // grey-brown. The palette's oak is fresh-sawn; every timber tint here is
      // pulled toward grey. The critique called the untreated colour
      // "bright orange-tan" and it was right.
      const oak = (lift = 0, spread = 1) => {
        const c = tint('oak', lift, spread)
        c.offsetHSL(0.004, -0.17, -0.025)
        // Floor the lightness. The renderer's gamma crushes this palette to
        // pure black somewhere around L 0.18, and the tinter's own jitter can
        // land a piece there even from a mild lift -- that is what painted the
        // old battens (and one unlucky foot per seed) as black plastic.
        const hsl = { h: 0, s: 0, l: 0 }
        c.getHSL(hsl)
        if (hsl.l < 0.19) c.setHSL(hsl.h, hsl.s, 0.19)
        return c
      }
      const bar = config.reach * 0.035
      // A slender structural timber: about 1:13 width to height. The first
      // heavy-post pass used 1:9 and the whole sign came out stocky; the
      // reference is nearer 1:14.
      const w = config.postHeight / 13
      // Axis of rotation: the line where the chains leave the arm. The board
      // and the chains are written RELATIVE to this point.
      const pivotY = config.height * 0.5 + config.drop
      const armY = pivotY
      // The post continues well past the ironwork before the cap, the way the
      // reference does, and the tie rod needs the vertical run.
      const postTop = armY + w * 1.6
      const ground = postTop - config.postHeight
      // Board centre along the arm, and where the two chains meet it.
      const zc = config.reach * 0.72
      const hangA = zc - config.width * 0.3
      const hangB = zc + config.width * 0.3

      // --- Post and base -----------------------------------------------------
      const timber: BufferGeometry[] = [chamferedBoxGeometry(
        [w, w],
        [w * 0.92, w * 0.92],
        config.postHeight,
        w * 0.08,
        // The post's foot ends INSIDE the plinth, not on the ground: two
        // ground-touching interpenetrating solids would share coplanar
        // down-facing faces.
        [0, (postTop + ground + w * 0.4) / 2, 0],
        oak(-0.03),
        oak(0.03),
      )]
      // Cap: a slim four-sided pyramid whose base matches the post's
      // cross-section, about half a post-width tall. The old cone overhung the
      // post on every side and read as a fence-post roof.
      const capH = w * 0.55
      timber.push(taperedBoxGeometry(
        [w * 0.945, w * 0.945],
        [w * 0.06, w * 0.06],
        capH,
        [0, postTop - 0.02 + capH / 2, 0],
        oak(-0.02),
        oak(-0.05),
      ))

      // The cross base: a centre plinth, four feet radiating on the ground
      // axes, four angled struts. This is the bottom third of the reference.
      //
      // Ground contact is divided so no two down-facing faces overlap in the
      // ground plane: the FEET stand on the ground at four disjoint patches,
      // and the plinth they all embed into rides 6 mm up, hidden behind them.
      const footH = w * 0.75
      const footW = w * 0.88
      const rIn = w * 0.55   // feet start inside the plinth
      const rOut = w * 2.3   // and reach over two post-widths out
      timber.push(chamferedBoxGeometry(
        [w * 1.55, w * 1.55],
        [w * 1.42, w * 1.42],
        footH * 1.2,
        w * 0.06,
        [0, ground + 0.006 + footH * 0.6, 0],
        oak(-0.02),
      ))
      for (const [axis, sign] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]] as const) {
        const len = rOut - rIn
        const foot = chamferedBoxGeometry(
          axis === 'x' ? [footH, footW] : [footW, footH],
          axis === 'x' ? [footH * 0.88, footW * 0.88] : [footW * 0.88, footH * 0.88],
          len,
          footH * 0.14,
          [0, 0, 0],
          oak(jitter(random, 0.025), 0.6),
        )
        // Built standing, then laid over so the chamfered end points outward.
        if (axis === 'x') foot.rotateZ(-sign * Math.PI / 2)
        else foot.rotateX(sign * Math.PI / 2)
        const mid = rIn + len / 2
        foot.translate(axis === 'x' ? sign * mid : 0, ground + footH / 2, axis === 'z' ? sign * mid : 0)
        timber.push(foot)

        // Strut: from a fifth of the way up the post down to the outer end of
        // this foot. Both end caps terminate inside their solids.
        const s = w * 0.38
        const top = { r: w * 0.3, y: ground + config.postHeight * 0.19 }
        const bot = { r: rOut - w * 0.4, y: ground + footH * 0.5 }
        const run = bot.r - top.r
        const rise = top.y - bot.y
        const len2 = Math.hypot(run, rise)
        const lean = Math.atan2(-run, rise)
        const strut = boxGeometry([s * 0.92, len2, s], [0, 0, 0], oak(jitter(random, 0.02), 0.6))
        if (axis === 'x') strut.rotateZ(-sign * lean)
        else strut.rotateX(sign * lean)
        strut.translate(
          axis === 'x' ? sign * (top.r + bot.r) / 2 : 0,
          (top.y + bot.y) / 2,
          axis === 'z' ? sign * (top.r + bot.r) / 2 : 0,
        )
        timber.push(strut)
      }

      // Bearer: the through-timber the arm actually rests on. About 0.8
      // post-widths across, poking out a little behind the post and reaching
      // 55% of the arm's length in front; the arm seats flat on its top face.
      const armH = bar * 1.5
      const armW = bar * 0.9
      const bearerW = w * 0.8
      const bearerH = w * 0.68
      const bearerTop = armY - armH / 2 + 0.004
      const bearerY = bearerTop - bearerH / 2
      const backZ = -w * 0.9
      // Just short of the inner chain: at 0.55 reach the bearer's end swallowed
      // the inner chain's top link.
      const frontZ = config.reach * 0.47
      const bearer = chamferedBoxGeometry(
        [bearerW, bearerH],
        [bearerW * 0.96, bearerH * 0.96],
        frontZ - backZ,
        w * 0.05,
        [0, 0, 0],
        oak(-0.02),
      )
      bearer.rotateX(Math.PI / 2) // stand it on its side: length now along +Z
      bearer.translate(0, bearerY, (frontZ + backZ) / 2)
      timber.push(bearer)
      // The knee brace: a quarter arc from the post face out to the bearer's
      // underside. One end cap inside the post, the other rises into the
      // bearer; nothing terminates in the open.
      const braceR = Math.max(w * 0.9, Math.min(w * 2.1, frontZ - w * 0.3))
      const brace = arcBarGeometry(
        braceR, w * 0.32, -Math.PI / 2, 0, 6, [0, 0, 0],
        oak(0.02, 0.5),
      )
      // Built in XY; -90 degrees about Y carries +X into +Z, standing the arc
      // in the plane the bracket occupies.
      brace.rotateY(-Math.PI / 2)
      brace.translate(0, bearerY - bearerH / 2 + 0.02, 0)
      timber.push(brace)

      // --- Ironwork ----------------------------------------------------------
      const iron: BufferGeometry[] = []
      // The arm: a flat strap seated on the bearer's top face, its back end
      // buried in the post (it stops short of the post's back face).
      iron.push(boxGeometry(
        [armW, armH, config.reach + w * 0.4],
        [0, armY, (config.reach - w * 0.4) / 2],
        tint('iron', 0.02, 0.7),
      ))
      // Forged diamond finial at the tip, slightly proud of the bar the way a
      // hammered spear-end spreads.
      const tipL = w * 0.5
      const tip = taperedBoxGeometry(
        [armW * 1.2, armH * 1.35],
        [armW * 0.12, armH * 0.12],
        tipL,
        [0, 0, 0],
        tint('iron', 0.04, 0.7),
      )
      tip.rotateX(Math.PI / 2) // point it along +Z
      tip.translate(0, armY, config.reach - 0.01 + tipL / 2)
      iron.push(tip)
      // Two thin straps around the post — about an eighth of a post-width
      // tall, projecting a few percent past the faces. One clamps the arm
      // where it enters the post, one up top anchors the tie rod.
      const bandH = bar * 0.65
      const rodTopY = postTop - w * 0.35
      iron.push(boxGeometry([w, bandH, w], [0, rodTopY, 0], tint('iron', -0.04, 0.7)))
      iron.push(boxGeometry([w, bandH * 1.1, w], [0, armY, 0], tint('iron', -0.06, 0.7)))
      // The shallow diagonal tie rod, from the upper strap down into the arm
      // at the scroll junction.
      const scrollZ = config.reach * 0.8
      {
        const t = { y: rodTopY, z: w * 0.28 }
        const b = { y: armY + armH * 0.2, z: scrollZ }
        const len = Math.hypot(t.y - b.y, b.z - t.z)
        const rod = boxGeometry([bar * 0.55, len, bar * 0.55], [0, 0, 0], tint('iron', 0, 0.7))
        // atan2 of (dz, dy) ALONG the rod, top to bottom: getting the y term
        // backwards mirrors the slope and the rod climbs into free air past
        // the arm instead of dropping from the post top onto it.
        rod.rotateX(Math.atan2(b.z - t.z, b.y - t.y))
        rod.translate(0, (t.y + b.y) / 2, (t.z + b.z) / 2)
        iron.push(rod)
      }
      // The C-scroll volute where the rod meets the arm: a 255-degree arc
      // rising off the arm and curling back over itself. Its lower end is
      // buried in the arm; its free end is closed by a forged ball, so neither
      // end terminates in the open. The old closed hexagonal ring read as a
      // washer, not a scroll.
      const rS = w * 0.32
      const scroll = arcBarGeometry(
        rS, bar * 0.6, -Math.PI * 0.44, Math.PI * 0.97, 8, [0, 0, 0],
        tint('iron', 0.05, 0.7),
      )
      scroll.rotateY(-Math.PI / 2)
      scroll.translate(0, armY + rS * 0.9, scrollZ)
      iron.push(scroll)
      iron.push(boxGeometry(
        [bar * 1.1, bar * 1.1, bar * 1.1],
        [0, armY + rS * 0.99, scrollZ - rS],
        tint('iron', 0.02, 0.7),
      ))

      // --- Chains ------------------------------------------------------------
      // They have to swing TOGETHER with the board, hence the board's `extras`
      // body. Were they a separate part, the chain would stay bolt upright
      // while the board swung.
      //
      // The COUNT is fixed and the RADIUS is derived, not the other way round.
      // Deriving the count from `drop` guaranteed the links overlap, but it also
      // made the triangle count depend on a continuous slider — which meant the
      // showcase could not morph this model and had to fall back to visibly
      // stepped rebuilds. Fixing the count and growing the links instead keeps
      // both properties: always interlocked, always the same topology.
      const linkCount = 5
      const linkRadius = Math.max(bar * 0.9, (config.drop / (linkCount - 1)) * 0.62)
      const eyeR = linkRadius * 0.9
      // The chain stops ABOVE the board's top edge; the eye ring bridges the
      // last link to the board. Letting the last link reach the edge itself
      // put its lower arc through the board's face from both sides.
      const chainSpan = Math.max(0.01, config.drop - eyeR * 1.2)
      const links: BufferGeometry[] = []
      for (const side of [-1, 1]) {
        const hangZ = side < 0 ? hangA - zc : hangB - zc
        for (let i = 0; i < linkCount; i += 1) {
          // The first link wraps the arm and the last threads the board's eye,
          // so the chain is a real connection rather than two things at
          // roughly the same height.
          const y = -chainSpan * (i / (linkCount - 1))
          const ring2 = bandGeometry(linkRadius, 0, bar * 0.6, bar * 0.35, 6,
            tint('iron', jitter(random, 0.05), 0.7), { inner: true })
          // Each link is indexed a little differently about its own axis, so
          // consecutive interlocking links never leave coplanar facets. The
          // offset is deterministic so the seeded stream is untouched.
          ring2.rotateY(i * 0.37 + side * 0.19)
          // Successive links must pass through at right angles — that is what a
          // chain is.
          ring2.rotateX(i % 2 === 0 ? Math.PI / 2 : 0)
          ring2.rotateZ(i % 2 === 0 ? 0 : Math.PI / 2)
          ring2.translate(0, y, hangZ)
          links.push(ring2)
        }
        // The eye: a ring standing in the board's own plane, its lower half
        // buried in the board's top edge, its upper half threading the last
        // chain link. This replaces the old lugs, which were thicker than the
        // board and ran down its face.
        const eye = bandGeometry(eyeR, 0, bar * 0.55, bar * 0.35, 6,
          tint('iron', 0.03, 0.7), { inner: true })
        eye.rotateZ(Math.PI / 2)
        eye.translate(0, -config.drop + eyeR * 0.35, hangZ)
        links.push(eye)
      }

      // --- Board -------------------------------------------------------------
      // Two planks (by default) touching at a chamfer-groove seam, with the
      // hanging-sign cusp cut into all four corners: the outer edges step in a
      // tenth of the board width before the corner, and a diagonal tab pokes
      // back out to the corner point, leaving a concave notch either side.
      const W = config.width
      const H = config.height
      const t = Math.max(0.02, H * 0.05)
      const planks = Math.max(1, Math.round(config.plankCount) + 1)
      const plankH = H / planks
      const n = Math.min(W * 0.09, plankH * 0.42)
      const boardTop = -config.drop
      // Half-width of the shadow gap either side of a plank seam. The seam is
      // an actual groove: the planks pull back a hair and a darker strip sits
      // recessed behind the gap, bridging them. Tint jitter alone was not
      // enough — one seed put the two planks at the same value and the board
      // read as a single slab.
      const g = 0.002
      const board: BufferGeometry[] = []
      for (let i = 0; i < planks; i += 1) {
        const y0 = boardTop - H + i * plankH
        const y1 = y0 + plankH
        const cutTop = i === planks - 1
        const cutBottom = i === 0
        // Alternate the planks light/dark on purpose so the seam always
        // separates two visibly different boards, whatever the seed does.
        const c = oak((i % 2 === 0 ? -0.055 : 0.05) + jitter(random, 0.012))
        // Two boards cut from two trees: the light plank is warmer as well as
        // lighter, so the seam separates two visibly different timbers.
        if (i % 2 === 1) c.offsetHSL(0.012, 0.05, 0)
        // A hair of per-plank thickness difference: it marks the single real
        // seam with a faint step without cutting a groove that could be
        // miscounted as another plank.
        const tp = t * (1 - i * 0.012)
        const yLo = cutBottom ? y0 : y0 + g
        const yHi = cutTop ? y1 : y1 - g
        const aLow = yLo + (cutBottom ? n : 0)
        const aHigh = yHi - (cutTop ? n : 0)
        if (i > 0) {
          // The seam strip: darker, recessed behind both plank faces, and
          // overlapping both planks so the board stays one connected body.
          // Sitting only 1.3 mm behind the faces: any deeper and the lower
          // plank's lit top face fills the slit and the seam reads LIGHT.
          board.push(boxGeometry([t * 0.91, 0.02, W * 0.985], [0, y0, 0], oak(-0.2)))
        }
        // The plank body. Plain and straight through its thickness: the old
        // wedge taper made the front faces splay and the board read as two
        // non-coplanar slabs, and a chamfered body left a groove where the
        // corner-cut strip joins it, which read as a third plank seam.
        board.push(boxGeometry([tp, aHigh - aLow, W], [0, (aLow + aHigh) / 2, 0], c))
        for (const [edge, cut] of [[1, cutTop], [-1, cutBottom]] as const) {
          if (!cut) continue
          const yEdge = edge > 0 ? y1 : y0
          // The outer-edge strip: its inner cross-section matches the body
          // exactly (flush, invisible joint) and it tapers to W - 2n at the
          // outer edge, so each corner is cut by a 45-degree facet.
          board.push(taperedBoxGeometry(
            edge > 0 ? [tp, W] : [tp * 0.99, W - 2 * n],
            edge > 0 ? [tp * 0.99, W - 2 * n] : [tp, W],
            n,
            [0, yEdge - edge * n / 2, 0], c,
          ))
          for (const side of [-1, 1] as const) {
            // The cusp point: a small pointed diamond on the corner diagonal,
            // base buried in the strip, tip reaching exactly the original
            // corner. It stays inside the board's rectangle instead of
            // poking past it.
            const theta = edge > 0 ? side * Math.PI / 4 : Math.PI - side * Math.PI / 4
            const tipTab = taperedBoxGeometry(
              [tp * 0.92, n * 0.95], [tp * 0.45, n * 0.12], n, [0, 0, 0], c,
            )
            tipTab.rotateX(theta)
            tipTab.translate(
              0,
              yEdge - Math.cos(theta) * n * 0.5,
              side * W / 2 - Math.sin(theta) * n * 0.5,
            )
            board.push(tipTab)
          }
        }
      }

      return {
        post: { slot: 'oak' as const, geometry: mergeColoured(timber) },
        bracket: { slot: 'iron' as const, geometry: mergeColoured(iron) },
        board: {
          slot: 'oak' as const,
          geometry: mergeColoured(board),
          // The origin is the point on the ARM the chains hang from, not the
          // post's centre line: the swing action rotates about this origin,
          // and rotating about anywhere else sweeps the chain tops off the
          // bar they are looped through.
          origin: [0, pivotY, zc] as const,
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(links) }],
        },
      }
    },

    actions: ({ parts }) => {
      parts.board.anchor.rotation.z = angle
      return {
        push: (strength = 1) => {
          // Reinforces the existing motion instead of resetting it: successive
          // pushes should accumulate the way a real wind does.
          velocity += (velocity >= 0 ? 1 : -1) * 1.6 * strength
        },
        still: () => { angle = 0; velocity = 0; parts.board.anchor.rotation.z = 0 },
        lean: () => angle,
      }
    },

    update: (dt, { parts, getConfig }) => {
      const step = Math.min(0.05, Math.max(0, dt))
      if (step === 0) return
      if (Math.abs(angle) < 1e-5 && Math.abs(velocity) < 1e-5) return
      // A SOFTER pendulum than the bell's: weak restoring force, little damping.
      // This is what the long, lazy swing of a heavy board looks like.
      velocity += -angle * 11 * step - velocity * getConfig().damping * step
      angle += velocity * step
      // Limit: the board must stop before it hits the arm.
      const limit = 0.55
      if (Math.abs(angle) > limit) {
        angle = Math.sign(angle) * limit
        velocity *= -0.4
      }
      parts.board.anchor.rotation.z = angle
    },
  }, overrides)
}
