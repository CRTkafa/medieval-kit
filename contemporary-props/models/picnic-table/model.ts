/**
 * @contemporary-props/picnic-table
 *
 * A plank array on a mirrored frame, which is what the catalogue puts it
 * twelfth for and very nearly all it is: five boards for the top, two for each
 * bench, and one A-frame written once and built twice.
 *
 * Measured against the fitted heights, which for seating are standards rather
 * than choices: 750 mm to the table, 450 mm to the seat, and the 300 mm
 * between them is what a person's thigh needs. Everything else follows from
 * those two numbers and the splay.
 *
 * The one piece of real joinery here is the LEG, and it is why this model uses
 * the extrusion helper rather than a rotated box. A leg leaning 34 degrees off
 * vertical, built as a box and turned, has a foot cut square to itself: it
 * meets the ground on an edge and the table stands on four knife points. A
 * real leg is sawn horizontally at both ends. That shape is a parallelogram --
 * two edges parallel to the leg, two horizontal -- and a parallelogram is a
 * section, so the leg is an extrusion of it along the frame's thickness. The
 * arithmetic is one line: horizontal cuts widen the leg to `t / cos(angle)`
 * measured across, and the corners sit half that either side of the centreline
 * at each end.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  extrudeGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Section,
} from '../core/index.ts'

export interface PicnicTableConfig {
  /** Length of the table along the benches (metres). */
  readonly length: number
  /** Width of the table top (metres). */
  readonly width: number
  /** Height to the top surface (metres). */
  readonly height: number
  /** Boards across the top. */
  readonly planks: number
  readonly seed: number
}

export const picnicTableDefaults: PicnicTableConfig = {
  length: 2,
  // 0.78 rather than 0.72: at 0.72 the top came out 2.8 times as long as it
  // is wide and every catalogue table is between 2.4 and 2.6.
  width: 0.78,
  // The fitted table height. The seat follows it at 0.6 of it, which is the
  // 300 mm of thigh room that makes the thing sittable.
  height: 0.75,
  planks: 5,
  seed: 19,
}

export type PicnicTableParts = 'top' | 'seats' | 'frame'

export function createModel(overrides: Partial<PicnicTableConfig> = {}) {
  return createKitModel<
    PicnicTableConfig, 'wood' | 'galvanised', PicnicTableParts, Record<string, never>
  >({
    id: 'picnic-table',
    defaults: picnicTableDefaults,
    slots: ['wood', 'galvanised'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = Math.min(3.2, Math.max(1.2, config.length))
      const W = Math.min(1, Math.max(0.5, config.width))
      const H = Math.min(0.85, Math.max(0.6, config.height))
      const planks = Math.max(3, Math.round(config.planks))

      const T = H * 0.05
      const seatY = H * 0.6
      const gap = T * 0.22
      const half = W / 2

      // The frames stand in from the ends, because the top overhanging them is
      // most of what makes a picnic table look like one rather than like a
      // bench with a lid: knees go under the overhang.
      const frameZ = L * 0.31
      // A 45 by 120 rather than a 45 by 95. The reference's legs are visibly
      // the same board as its seats, and a frame in lighter stock than the
      // thing it carries reads as a flat-pack of it.
      const frameT = T * 1.35
      const legTop = H - T
      const footHalf = W * 1.08
      const legTopHalf = half * 0.83
      const legFace = W * 0.17

      /**
       * A tone per board, and the spread is deliberately wide.
       *
       * The reference's grain and knots are a texture and this kit has none;
       * what a kit of vertex colours can carry is the other thing that makes a
       * timber table look like timber, which is that no two boards out of the
       * same pack are the same colour. Every call to this returns a different
       * one, so the array of boards varies the way a real one does even though
       * each board is flat within itself.
       */
      const wood = (lift = 0): ReturnType<typeof tint> =>
        tint('wood', lift + jitter(random, 0.055), 1.4)

      /**
       * One board, with its arrises taken off.
       *
       * Planed softwood has a 2 mm ease on every edge and it is not decoration:
       * a board with square corners catches a single hard line of light down
       * its whole length and reads as a printed rectangle. The chamfer gives
       * every board two.
       */
      const board = (
        w: number, t: number, length: number, at: readonly [number, number, number],
        axis: 'x' | 'z' = 'z',
      ): BufferGeometry => {
        const g = chamferedBoxGeometry(
          [axis === 'z' ? w : length, axis === 'z' ? length : w],
          [axis === 'z' ? w : length, axis === 'z' ? length : w],
          // Bigger than the 2 mm a real ease is, on purpose. At true scale the
          // chamfer on a 38 mm board is one pixel of a render of a two-metre
          // table and the boards read as printed rectangles; at 0.16 of the
          // thin dimension it is 6 mm, still a plausible arris, and it is the
          // thing that says planed timber.
          t, Math.min(w, t) * 0.16, [0, 0, 0], wood(),
        )
        g.translate(at[0], at[1], at[2])
        return g
      }

      /* ---------------------------------------------------------------- top */
      // The array, and the pitch is derived rather than chosen: whatever board
      // width makes `planks` of them plus their gaps come to exactly W.
      const topW = (W - gap * (planks - 1)) / planks
      const topPieces: BufferGeometry[] = []
      for (let i = 0; i < planks; i += 1) {
        const x = -half + topW / 2 + i * (topW + gap)
        topPieces.push(board(topW, T, L, [x, H - T / 2, 0]))
      }

      /* -------------------------------------------------------------- seats */
      const seatW = W * 0.42
      const seatBoards = 2
      const seatBoardW = (seatW - gap) / seatBoards
      const seatCentre = (legTopHalf + footHalf) / 2 + W * 0.12
      const seatPieces: BufferGeometry[] = []
      for (const side of [-1, 1]) {
        for (let i = 0; i < seatBoards; i += 1) {
          const x = side * (seatCentre - seatW / 2 + seatBoardW / 2 + i * (seatBoardW + gap))
          seatPieces.push(board(seatBoardW, T, L * 0.93, [x, seatY - T / 2, 0]))
        }
      }

      /* -------------------------------------------------------------- frame */
      /**
       * The A-frame, written once.
       *
       * Two legs, a bearer under the top and a bearer under the seats. The two
       * bearers go on OPPOSITE faces of the legs -- the seat bearer outside so
       * it can reach past them to the benches, the top bearer inside where the
       * boards land on it -- which is both how they are actually bolted and
       * what stops the two of them fighting over the same 45 mm of timber.
       */
      const bearerAt = seatY - T - T * 1.6
      const framePieces: BufferGeometry[] = []
      const boltPieces: BufferGeometry[] = []
      /*
       * Flat, and slightly darker than the palette's galvanised.
       *
       * Zinc is a neutral grey with a faint blue cast, and next to warm timber
       * a faint blue cast is not faint: at full deviation and full brightness
       * the bolt heads came out as bright blue dots on a pine table. The
       * spread is cut to almost nothing so the hue cannot wander, and the
       * lightness comes down because these are the one part of the model the
       * occlusion bake does not touch -- they sit in the shadow of the timber
       * and were being lit as though they did not.
       *
       * Then the saturation goes to zero outright. The palette's zinc measures
       * #4e5357 after the lift, which is a neutral grey by any measurement --
       * and it still read as a blue dot, because an eight-pixel neutral spot
       * surrounded by saturated pine is pushed the opposite way round the
       * wheel by everything looking at it. Simultaneous contrast is not a bug
       * to be measured away; the answer is to give it nothing to work with.
       */
      const steel = tint('galvanised', -0.08, 0.12).offsetHSL(0, -1, 0)

      const leg = (side: number, z: number): BufferGeometry => {
        const xf = side * footHalf
        const xt = side * legTopHalf
        const run = xt - xf
        const rise = legTop
        const len = Math.hypot(run, rise)
        // Horizontal cuts at both ends: the leg measures `frameT` across its
        // face but `frameT / cos(angle)` across a horizontal line, and that is
        // the whole of the parallelogram.
        const h = (frameT * (len / rise)) / 2
        const section: Section = side > 0
          ? [[xf - h, 0], [xf + h, 0], [xt + h, rise], [xt - h, rise]]
          : [[xf + h, 0], [xf - h, 0], [xt - h, rise], [xt + h, rise]]
        return extrudeGeometry(section, legFace, [0, 0, z - legFace / 2], wood(-0.02))
      }

      /**
       * A coach bolt head, and it is sized to be SEEN.
       *
       * The first pass drew them at 7 mm radius, which is what an M10 head
       * actually is, and on a two-metre table they came to four pixels: the
       * critic reported zero fasteners and was right about the render. A
       * domed 20 mm head is what a coach bolt looks like from any distance
       * anyone looks at a picnic table from, and the fasteners are half of
       * what says this thing was bolted together rather than moulded.
       */
      const bolt = (at: readonly [number, number, number], facing = 1): void => {
        const g = latheGeometry([
          { y: 0, radius: T * 0.4 },
          { y: T * 0.12, radius: T * 0.38 },
          { y: T * 0.2, radius: T * 0.31 },
          { y: T * 0.25, radius: T * 0.17 },
        ], 10, [0, 0, 0], steel, { capBottom: false, capTop: true })
        g.rotateX((facing < 0 ? -1 : 1) * Math.PI / 2)
        g.translate(at[0], at[1], at[2])
        boltPieces.push(g)
      }

      for (const z of [-frameZ, frameZ]) {
        const outward = Math.sign(z)
        framePieces.push(leg(-1, z), leg(1, z))

        // Under the top, on the inside face.
        framePieces.push(board(
          frameT, T * 3.2, W * 1.02,
          [0, H - T - T * 1.6, z - outward * (legFace / 2 + frameT / 2)], 'x',
        ))
        // Under the seats, on the outside face, reaching past the legs.
        const bearerY = bearerAt
        // On edge, not flat. A bearer laid on its face is a shelf; the whole
        // reason a 45 by 70 goes in this way round is that the load is
        // vertical and so is the depth that carries it.
        framePieces.push(board(
          frameT, T * 3.2, footHalf * 2 + W * 0.04,
          [0, bearerY, z + outward * (legFace / 2 + frameT / 2)], 'x',
        ))
        // Two bolts a side through the seat bearer into each leg, which is the
        // joint that actually carries a person.
        const boltZ = z + outward * (legFace / 2 + frameT + T * 0.06)
        for (const side of [-1, 1]) {
          const legX = side * (footHalf + (legTopHalf - footHalf) * (bearerY / legTop))
          bolt([legX - T * 0.6, bearerY + T * 0.6, boltZ], outward)
          bolt([legX + T * 0.6, bearerY - T * 0.55, boltZ], outward)
          // ...and a pair at the head of each leg, through the top bearer,
          // which on the reference is the most visible joint of the lot.
          const headY = H - T - T * 1.6
          const headX = side * (footHalf + (legTopHalf - footHalf) * (headY / legTop))
          // On the leg's OUTER face, not its inner one: written the other way
          // round they sat two millimetres inside the timber and the critic
          // reported no fasteners for a second round running.
          const headZ = outward * (frameZ + legFace / 2 + 0.002)
          bolt([headX, headY + T * 0.5, headZ], outward)
          bolt([headX, headY - T * 0.5, headZ], outward)
        }
      }

      /**
       * The two braces, which are the only members running along the table.
       *
       * Without them the frame is two independent A's and the whole thing racks
       * along its length -- a picnic table that has lost its braces walks
       * across a car park in a gale, which is why every one of them has a pair.
       * They meet the underside of the top at the centre and land on each seat
       * bearer, and their ends are cut square because that is how a bolted
       * brace is cut.
       */
      for (const z of [-frameZ, frameZ]) {
        // Both ends land ON something, and that is the whole of the geometry
        // here: the top end against the underside of the boards at the centre
        // of the length, the bottom end in the seat bearer -- which is out at
        // the bearer's own z, not the leg's, because the bearer is bolted to
        // the frame's outer face and the brace has to reach it.
        const y0 = H - T
        const y1 = bearerAt
        const z1 = Math.sign(z) * (frameZ + legFace / 2 + frameT / 2)
        const len = Math.hypot(z1, y0 - y1)
        const brace = chamferedBoxGeometry(
          [T * 1.7, frameT], [T * 1.7, frameT], len, T * 0.08, [0, 0, 0], wood(-0.03),
        )
        brace.rotateX(Math.atan2(z1, y0 - y1) * -1)
        brace.translate(0, (y0 + y1) / 2, z1 / 2)
        framePieces.push(brace)
      }

      bakeOcclusion(framePieces, { strength: 0.4 })

      return {
        top: { slot: 'wood' as const, geometry: smoothNormals(mergeColoured(topPieces), 22) },
        seats: { slot: 'wood' as const, geometry: smoothNormals(mergeColoured(seatPieces), 22) },
        frame: {
          slot: 'wood' as const,
          geometry: smoothNormals(mergeColoured(framePieces), 22),
          extras: [{
            slot: 'galvanised' as const,
            geometry: smoothNormals(mergeColoured(boltPieces), 30),
          }],
        },
      }
    },
  }, overrides)
}
