/**
 * @medieval-kit/coin-pouch
 *
 * A drawstring leather pouch with silver pennies spilled beside it.
 *
 * What names this object is the TOP, not the body. A closed leather bag reads
 * as a stone; a lathe that pinches and then flares reads as a BOTTLE; a body
 * widest at mid-height with a shoulder break reads as THROWN POTTERY, which is
 * the death pass four is answering. The pouch lives in three landmarks:
 *
 *   1. the body is a TEARDROP, not a pot (pass four): widest ring ~35% of the
 *      height up from the base, base slumping out fast from a flat contact
 *      patch about a third of the max width, and above the bulge one
 *      continuous concave sweep to the neck, radius = tieR + span*(1-t)^1.6,
 *      with NO shoulder ring. Pass three's profile put the widest loop near
 *      mid-height with a distinct shoulder crease and scored as a clay pot.
 *   2. the gathered crown: the SAME hide as the body, bunched. Pass four
 *      replaced the ring of separate square prisms (background showed through
 *      the gaps) with tapered WEDGES that touch at their bases: each fold is
 *      wide tangentially at the collar and pinched at the tip, leans out
 *      10-18 degrees with a small twist about its own axis, and a dark plug
 *      fills the throat so the mouth is a dark slot, never open sky.
 *   3. the drawstring is a SINGLE TIE (pass four): two wrapped turns, one
 *      knot cluster on one side, and BOTH tails leaving from that knot with
 *      different lengths, bowing away from the wall. Pass three's two
 *      mirrored hangers on opposite sides read as handles. Tail control
 *      points clamp to radiusAt(y) plus a cord radius so no strand can enter
 *      the body on its way down.
 *
 * The side seam is a continuous overlapping braid welt (pass four): bars 1.5x
 * their spacing so consecutive bars overlap, buried wide*0.035 into the wall
 * with a radial depth that outreaches the roughen amplitude (dropped to
 * wide*0.02) in both directions. Pass three's separate half-sunk stitches sat
 * proud of roughened facets and the lowest one detached entirely.
 *
 * Body colour is near-uniform: pass three's lighter colourTop lerped to a
 * visible horizontal band at mid-height that read as a pot lid seam.
 *
 * Coins: silver pennies, cool grey (steel slot), all ON THE FLOOR as one
 * thinning trail whose first coin touches the base. No coin on the pouch: at
 * this scale a coin bedded into leather cannot be told from a clipping bug.
 * Every third floor coin leans on its neighbour with its rim on the ground,
 * offset DERIVED from the chosen tilt. Flat coins alternate sides of the
 * trail axis so consecutive coins cannot drift into each other.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface CoinPouchConfig {
  /** Height of the pouch (metres). */
  readonly height: number
  /** Widest radius of the pouch (metres). */
  readonly radius: number
  /** How full it is. 0.3 is half empty and slumped, 1 is stuffed. */
  readonly fill: number
  /** Number of coins spilled outside. */
  readonly coins: number
  /** Coin radius (metres). */
  readonly coinRadius: number
  readonly seed: number
}

export const coinPouchDefaults: CoinPouchConfig = {
  height: 0.115,
  radius: 0.042,
  fill: 0.85,
  coins: 9,
  coinRadius: 0.011,
  seed: 89,
}

export type CoinPouchParts = 'pouch' | 'cord' | 'coins'

export function createModel(overrides: Partial<CoinPouchConfig> = {}) {
  return createKitModel<CoinPouchConfig, 'leather' | 'cloth' | 'steel', CoinPouchParts>({
    id: 'coin-pouch',
    defaults: coinPouchDefaults,
    slots: ['leather', 'cloth', 'steel'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const fill = Math.max(0.15, Math.min(1, config.fill))
      const h = config.height
      const wide = config.radius * (0.68 + fill * 0.4)
      // The pinch sits at about 70% of the height; the crown owns the rest.
      const tieY = h * (0.6 + fill * 0.12)
      // The tube at the pinch is 40% of the body width: a fat gathered neck,
      // not a bottleneck. Thinner than this and the vase comes back.
      const tieR = wide * 0.4
      const tubeTop = tieY + h * 0.07

      // --- Body -------------------------------------------------------------
      // A teardrop: flat contact patch about a third of the max width, fast
      // slump out to the widest ring at ~35% of the height, then ONE concave
      // sweep to the neck. No shoulder ring, no flat wide base disc.
      const maxY = h * (0.33 + 0.07 * fill)
      const sweep = (t: number): Level => ({
        y: maxY + (tieY - maxY) * t,
        radius: tieR + (wide - tieR) * Math.pow(1 - t, 1.35),
      })
      const profile: Level[] = [
        { y: 0, radius: wide * 0.36 },
        { y: h * 0.035, radius: wide * 0.64 },
        { y: h * 0.12, radius: wide * 0.88 },
        { y: maxY * 0.72, radius: wide * 0.97 },
        { y: maxY, radius: wide },
        sweep(0.22),
        sweep(0.45),
        sweep(0.68),
        sweep(0.88),
        { y: tieY, radius: tieR },
        { y: tubeTop, radius: tieR * 1.08 },
      ]
      const radiusAt = (y: number): number => {
        for (let i = 0; i < profile.length - 1; i += 1) {
          const a = profile[i]!
          const b = profile[i + 1]!
          if (y >= a.y && y <= b.y) {
            const t = (y - a.y) / Math.max(1e-9, b.y - a.y)
            return a.radius + (b.radius - a.radius) * t
          }
        }
        return profile[profile.length - 1]!.radius
      }

      const pouchPieces: BufferGeometry[] = []
      // Near-uniform colour: a lighter top lerped across the lathe put a hard
      // horizontal band at mid-height that read as a pot lid seam.
      const body = latheGeometry(profile, 13, [0, 0, 0], tint('leather', -0.1, 0.85), {
        capTop: true,
      })
      roughenGeometry(body, wide * 0.02, { salt: 51, scaleY: 0.6 })
      pouchPieces.push(body)

      // Dark plug filling the throat: the mouth is a small dark slot between
      // the fold tips, never open sky through to the far side. The leather
      // palette is already dark: a lift below about -0.12 clamps to black and
      // reads as missing geometry, not shadow, so this stays at -0.11.
      // Its cap stays BELOW the fold tips: a taller plug lifted its brightly
      // lit top cap above the folds, where it read as a pale sliver of
      // background between the tips.
      pouchPieces.push(prismGeometry(
        tieR * 0.95, tieR * 0.55, h * 0.16, 8,
        [0, tubeTop + h * 0.02, 0], tint('leather', -0.11, 0.6),
      ))

      // The gathered crown: seven wedge folds of the BODY'S leather (same
      // lift; a lighter lift here turned a previous crown terracotta). Each
      // fold is a tapered wedge, wide tangentially at the collar so the bases
      // TOUCH their neighbours, pinched at the tip, leaning outward 10-18
      // degrees with a small twist about its own axis.
      const foldCount = 7
      const crownBase = tieY + h * 0.005
      const ringR = tieR * 0.7
      const chord = 2 * ringR * Math.sin(Math.PI / foldCount)
      for (let i = 0; i < foldCount; i += 1) {
        const a = (i / foldCount) * Math.PI * 2 + jitter(random, 0.06)
        const foldH = h * (0.16 + random() * 0.05)
        const baseW = chord * 1.25
        const baseD = tieR * 0.6
        const lean = 0.18 + random() * 0.14
        const twist = 0.06 + jitter(random, 0.15)
        const col = tint('leather', -0.1 + jitter(random, 0.02), 0.7)
        const colTip = tint('leather', -0.08 + jitter(random, 0.02), 0.55)

        const fold = taperedBoxGeometry(
          [baseW, baseD], [baseW * 0.38, baseD * 0.6], foldH,
          [0, foldH / 2, 0], col, colTip,
        )
        fold.rotateY(twist)
        fold.rotateX(lean)
        fold.rotateY(a)
        fold.translate(Math.sin(a) * ringR, crownBase, Math.cos(a) * ringR)
        pouchPieces.push(fold)
      }

      // Side seam: a continuous braid welt, the reference's strongest graphic
      // landmark. Bars 1.5x their spacing overlap into an unbroken run, each
      // buried wide*0.035 into the wall with enough radial depth to outreach
      // the roughen amplitude both ways: no bar can hover proud of a facet or
      // detach from the surface.
      const coinA = Math.PI / 2
      const seamA = coinA - (Math.PI * 2) / 3
      const seamLow = h * 0.13
      const seamHigh = tieY - h * 0.03
      const seamCount = 10
      const seamStep = (seamHigh - seamLow) / (seamCount - 1)
      for (let i = 0; i < seamCount; i += 1) {
        const y = seamLow + seamStep * i
        const dY = h * 0.02
        const slope = Math.atan2(radiusAt(y + dY) - radiusAt(y - dY), 2 * dY)
        // Lighter than the body: the bars sit in their own baked occlusion
        // and a darker lift on top of that read as a CRACK, not a seam.
        const bar = boxGeometry(
          [wide * 0.085, seamStep * 1.3, wide * 0.1],
          [0, 0, 0], tint('leather', -0.03 + jitter(random, 0.015), 0.3),
        )
        bar.rotateZ((i % 2 === 0 ? 1 : -1) * (0.18 + jitter(random, 0.04)))
        bar.rotateX(slope)
        bar.rotateY(seamA)
        const out = radiusAt(y) - wide * 0.035
        bar.translate(Math.sin(seamA) * out, y, Math.cos(seamA) * out)
        pouchPieces.push(bar)
      }

      // --- Drawstring: a single tie -----------------------------------------
      const cordA = coinA + (Math.PI * 5) / 6
      const cordR = wide * 0.045
      const cordPieces: BufferGeometry[] = []

      // Two turns wrapped around the pinch.
      cordPieces.push(bandGeometry(
        tieR + cordR * 1.2, tieY + cordR * 0.9, cordR * 1.7, cordR * 2.6, 10,
        tint('cloth', -0.3, 0.5), { inner: true },
      ))
      cordPieces.push(bandGeometry(
        tieR + cordR * 1.45, tieY - cordR * 1.05, cordR * 1.7, cordR * 2.6, 10,
        tint('cloth', -0.33, 0.5), { inner: true },
      ))

      // Knot cluster on ONE side of the wrap: two overlapping lumps, buried
      // back into the wrap, that both tails spring from.
      const knotOut = tieR + cordR * 1.9
      const knotPos: readonly [number, number, number] = [
        Math.sin(cordA) * knotOut, tieY, Math.cos(cordA) * knotOut,
      ]
      const knotA = prismGeometry(
        cordR * 2.2, cordR * 1.8, cordR * 3, 6, [0, 0, 0], tint('cloth', -0.28, 0.5),
      )
      knotA.rotateX(0.6)
      knotA.rotateY(cordA)
      knotA.translate(knotPos[0], knotPos[1], knotPos[2])
      cordPieces.push(knotA)
      const knotB = prismGeometry(
        cordR * 1.8, cordR * 1.4, cordR * 2.6, 5, [0, 0, 0], tint('cloth', -0.32, 0.5),
      )
      knotB.rotateZ(0.9)
      knotB.rotateY(cordA)
      knotB.translate(knotPos[0], knotPos[1] + cordR * 1.1, knotPos[2])
      cordPieces.push(knotB)

      // A lace segment between two points. Overshoots both ends by a cord
      // radius so every joint ends inside the next solid, never in air.
      const lace = (
        from: readonly [number, number, number],
        to: readonly [number, number, number],
        colour: ReturnType<typeof tint>,
      ): BufferGeometry => {
        const dx = to[0] - from[0]
        const dy = to[1] - from[1]
        const dz = to[2] - from[2]
        const len = Math.max(1e-6, Math.hypot(dx, dy, dz))
        const seg = prismGeometry(cordR, cordR * 0.92, len + cordR * 2, 5, [0, 0, 0], colour)
        seg.rotateZ(-Math.acos(Math.max(-1, Math.min(1, dy / len))))
        seg.rotateY(Math.atan2(-dz, dx))
        seg.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2)
        return seg
      }

      // Both tails leave from the SAME knot, drift the same way around the
      // body by different amounts, and end at different heights: one tie,
      // not two mirrored hangers. Each control point's radial distance is
      // clamped to the wall radius plus a cord clearance so no strand can
      // pass through the body, and the whole chain hangs from the knot.
      const tails: ReadonlyArray<{ drift: number; endY: number; lift: number }> = [
        { drift: 0.62, endY: h * 0.4, lift: -0.31 },
        { drift: 0.28, endY: h * 0.5, lift: -0.34 },
      ]
      for (const tail of tails) {
        const steps = 4
        const pts: Array<readonly [number, number, number]> = [knotPos]
        for (let k = 1; k <= steps; k += 1) {
          const s = k / steps
          const y = tieY + (tail.endY - tieY) * Math.pow(s, 1.15)
          const az = cordA + tail.drift * s + jitter(random, 0.03)
          const bow = knotOut + (wide * 1.06 - knotOut) * Math.pow(s, 0.7)
          const out = Math.max(bow, radiusAt(y) + cordR * 1.5)
          pts.push([Math.sin(az) * out, y, Math.cos(az) * out])
        }
        const colour = tint('cloth', tail.lift, 0.5)
        for (let k = 0; k < pts.length - 1; k += 1) {
          cordPieces.push(lace(pts[k]!, pts[k + 1]!, colour))
        }

        // Knotted bead near the tip, then a short flared tail end whose top
        // is buried in the bead.
        const end = pts[pts.length - 1]!
        const bead = prismGeometry(
          cordR * 2.1, cordR * 1.7, cordR * 3, 8, [0, 0, 0], tint('cloth', -0.27, 0.5),
        )
        bead.rotateX(jitter(random, 0.15))
        bead.rotateY(cordA + tail.drift)
        bead.translate(end[0], end[1] - cordR * 1.1, end[2])
        cordPieces.push(bead)
        const tip = prismGeometry(
          cordR, cordR * 0.5, cordR * 2, 4, [0, 0, 0], tint('cloth', -0.3, 0.5),
        )
        tip.rotateY(cordA + tail.drift)
        tip.translate(end[0], end[1] - cordR * 3, end[2])
        cordPieces.push(tip)
      }

      // --- Coin trail -------------------------------------------------------
      // One thinning trail across the floor, first coin touching the base.
      // Cool grey silver, not brass. No coins on the pouch itself: at this
      // scale a coin bedded into leather cannot be told from a clipping bug.
      const count = Math.max(0, Math.round(config.coins))
      const coinPieces: BufferGeometry[] = []
      const rimShrink = Math.cos(Math.PI / 9)
      const mint = (lower: number, thickness: number): BufferGeometry => prismGeometry(
        lower, lower * (0.96 + random() * 0.08), thickness, 9,
        [0, 0, 0], tint('steel', -0.05 + jitter(random, 0.04), 0.5),
      )
      const dirX = Math.sin(coinA)
      const dirZ = Math.cos(coinA)
      const perpX = Math.cos(coinA)
      const perpZ = -Math.sin(coinA)
      let trail = 0
      let prevFlat: { x: number; z: number; thickness: number; lower: number } | undefined
      for (let j = 0; j < count; j += 1) {
        const lower = config.coinRadius * (0.9 + random() * 0.16)
        const thickness = config.coinRadius * (0.13 + random() * 0.06)
        const coin = mint(lower, thickness)
        const side = j % 2 === 0 ? 1 : -1
        if (j % 3 === 2 && prevFlat !== undefined) {
          // Leans on the previous coin: tilt chosen first, offset DERIVED
          // from the contact (rim on the ground, underside touching the
          // previous coin's top rim). Guessing the offset is what made the
          // pairs clip through each other.
          const theta = 0.36 + random() * 0.1
          const away = coinA + side * (Math.PI / 2) + jitter(random, 0.3)
          const offset = prevFlat.lower
            + (prevFlat.thickness * 0.9) / Math.tan(theta)
            - lower * Math.cos(theta)
          const px = prevFlat.x + Math.sin(away) * offset
          const pz = prevFlat.z + Math.cos(away) * offset
          coin.rotateX(theta)
          coin.rotateY(away)
          const rest = lower * rimShrink * Math.sin(theta) + (thickness / 2) * Math.cos(theta)
          coin.translate(px, rest, pz)
        } else {
          const t = trail / Math.max(1, count - 1)
          // The trail starts CLEAR of the widest ring: a coin under the
          // bulge's overhang bakes to a near-black speck that reads as a
          // stray fragment, not as a penny.
          const d = wide * 1.15 + config.coinRadius * (0.55 + trail * 2.35)
            + jitter(random, config.coinRadius * 0.25)
          // Alternating sides of the trail axis: consecutive flat coins can
          // never wander onto each other.
          const lat = side * config.coinRadius * (0.4 + t * 0.9)
            + jitter(random, config.coinRadius * 0.2)
          const x = dirX * d + perpX * lat
          const z = dirZ * d + perpZ * lat
          const tilt = jitter(random, 0.1)
          coin.rotateX(tilt)
          coin.rotateY(random() * Math.PI * 2)
          const rest = Math.abs(Math.sin(tilt)) * lower * rimShrink
            + (thickness / 2) * Math.cos(tilt)
          coin.translate(x, rest, z)
          prevFlat = { x, z, thickness, lower }
          trail += 1
        }
        coinPieces.push(coin)
      }

      return {
        pouch: { slot: 'leather' as const, geometry: mergeColoured(pouchPieces) },
        cord: { slot: 'cloth' as const, geometry: mergeColoured(cordPieces) },
        coins: coinPieces.length > 0
          ? { slot: 'steel' as const, geometry: mergeColoured(coinPieces) }
          : undefined,
      }
    },
  }, overrides)
}
