/**
 * @contemporary-props/park-bench
 *
 * A slat array between two cast side frames, which is what the catalogue puts
 * it thirteenth for, and the row that settles the SLAT-WITH-GAP RULE the rest
 * of the kit copies: the pitch is derived from the run and the count, never
 * chosen, so a bench with four slats and a bench with seven both fill the same
 * seat and neither has a stray gap at one end.
 *
 * Measured against the fitted heights, which for seating are standards: 440 mm
 * to the seat, 460 mm of depth, and a back that rakes 18 degrees and stops at
 * 820 mm. A back that does not rake is a plank, and a bench with one is a
 * bench nobody sits on twice.
 *
 * The frame is a CASTING, and that is the whole reason it is an extrusion. It
 * is a flat plate of constant thickness with a complicated outline -- two
 * limbs sweeping up from two feet, thickening into a knee at the seat, one of
 * them carrying on up and back for the back rest -- and the arched void
 * between the limbs is not cut out of anything. It is simply where no limb is.
 * Each limb is written as a centre line with a half width at each knot and
 * offset into a closed section, so the outline follows the line rather than
 * being drawn twice by hand and going out of true.
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

export interface ParkBenchConfig {
  /** Length of the bench (metres). */
  readonly length: number
  /** Height to the top of the back (metres). */
  readonly height: number
  /** Slats across the seat. */
  readonly slats: number
  /** Slats across the back. */
  readonly backSlats: number
  readonly seed: number
}

export const parkBenchDefaults: ParkBenchConfig = {
  length: 1.6,
  height: 0.82,
  slats: 5,
  backSlats: 3,
  seed: 23,
}

export type ParkBenchParts = 'slats' | 'frames'

export function createModel(overrides: Partial<ParkBenchConfig> = {}) {
  return createKitModel<
    ParkBenchConfig, 'wood' | 'steelPainted' | 'stainless', ParkBenchParts, Record<string, never>
  >({
    id: 'park-bench',
    defaults: parkBenchDefaults,
    slots: ['wood', 'steelPainted', 'stainless'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = Math.min(3, Math.max(1, config.length))
      const B = Math.min(1, Math.max(0.65, config.height))
      const seats = Math.max(3, Math.round(config.slats))
      const backs = Math.max(2, Math.round(config.backSlats))

      const S = 0.44
      const D = 0.46
      const T = 0.026
      const rake = 0.32
      const frameT = 0.042
      // The frame's outer face is the end of the bench. Slats stop two
      // millimetres inside it: any further out and, seen from behind, every
      // back slat pokes past the upright it is bolted to, which is what the
      // critic reported and what a bench that has been reassembled wrong looks
      // like.
      const frameX = Math.max(0.2, L / 2 - frameT)
      // ...and the slats end HALFWAY THROUGH the frame plate, not at its outer
      // face. Two millimetres inside the face is flush by any measurement and
      // still read as protruding from the rear quarter, because the back
      // slats sit forward of the rest and their end grain shows beside it.
      // Twenty millimetres inside, they are inarguably held.
      const slatL = L - frameT

      // Darker than the palette's pine, because a park bench's timber has been
      // outside for years and the reference's is a weathered brown three or
      // four value steps below new stock. A per-model lift, not a palette
      // change: the picnic table next to it is new pine and looked it.
      // The per-slat spread is wider than the picnic table's, because the
      // darker base compresses what the eye can tell apart: at the same jitter
      // ten weathered slats came out as one colour.
      const wood = (): ReturnType<typeof tint> => tint('wood', -0.13 + jitter(random, 0.08), 1.6)
      /*
       * Black-painted cast iron, and not TOO black. The palette's painted
       * steel is a mid grey because most painted steel is; municipal ironwork
       * is black, and the tint knows it while the slot stays swappable. But
       * at -0.34 the frames rendered as flat silhouettes with no form in them
       * at all -- the arch, the knee and the feet were all one cut-out -- and
       * the occlusion bake then took what was left. Charcoal leaves the
       * shading somewhere to go, which is what lets a casting read as a solid
       * with edges rather than as a shape.
       */
      const iron = tint('steelPainted', -0.22, 0.4)

      /**
       * A limb of the casting, from a centre line.
       *
       * Knots are [z, y, half-width] in metres, z positive toward the back.
       * Each is offset perpendicular to the local direction of the line, so
       * the two edges of the limb stay parallel to it through every bend --
       * which is what a cast section does and what drawing both edges by hand
       * reliably fails to do at the third knot.
       *
       * Counter-clockwise: up the back edge, over the top, down the front.
       */
      const limb = (knots: ReadonlyArray<readonly [number, number, number]>): Section => {
        const near: Array<readonly [number, number]> = []
        const far: Array<readonly [number, number]> = []
        for (let i = 0; i < knots.length; i += 1) {
          const [z, y, w] = knots[i]!
          const prev = knots[i - 1] ?? knots[i]!
          const next = knots[i + 1] ?? knots[i]!
          const dz = next[0] - prev[0]
          const dy = next[1] - prev[1]
          const len = Math.hypot(dz, dy) || 1
          near.push([z + (dy / len) * w, y - (dz / len) * w])
          far.push([z - (dy / len) * w, y + (dz / len) * w])
        }
        return [...near, ...far.reverse()]
      }

      const framePieces: BufferGeometry[] = []
      const boltPieces: BufferGeometry[] = []
      // Warmed a little rather than merely neutral: a small pale fitting on
      // warm timber is pushed blue by everything around it, and a grey that
      // measures neutral still reads cold. A touch of the timber's own hue
      // brings it back to silver in context.
      const steel = tint('stainless', -0.06, 0.15).offsetHSL(0, -1, 0).offsetHSL(0.08, 0.1, 0)

      const plate = (section: Section, x: number): BufferGeometry =>
        extrudeGeometry(section, frameT, [0, 0, 0], iron)
          .rotateY(-Math.PI / 2)
          .translate(x + frameT / 2, 0, 0)

      /* -------------------------------------------------------------- frame */
      /**
       * The two limbs CONVERGE, and that is the arch.
       *
       * Written as two near-vertical posts a seat's depth apart -- which is
       * what they look like in a photograph if you only note where they touch
       * the ground and where they touch the seat -- the void between them is a
       * rectangle and the frame reads as two black posts with a plank across.
       * The reference's casting is a pointed arch: the feet are 400 mm apart,
       * both limbs lean in as they rise, and they meet at a knee under the
       * middle of the seat. The seat rail is then a plate cantilevering
       * forward and back off that knee, and the arch is what is left.
       */
      const kneeY = S - T - 0.055
      // The limbs are thin through the middle and BROAD AT THE KNEE, which is
      // where a real casting carries its spandrel. Two wrong widths came
      // first: at 28 mm all the way up the frame was an inverted V with
      // daylight through it, and at 90 mm all the way up the critic called it
      // three times too massive and was right. The arch is closed by the web
      // at the top, not by fat legs.
      const front: ReadonlyArray<readonly [number, number, number]> = [
        [-D * 0.46, 0, 0.032],
        [-D * 0.45, 0.07, 0.03],
        // ...and they stay OUT near their feet until the last quarter of the
        // height, so the void is the tall three-quarter-depth opening the
        // reference has and not a slot. Converging from the ground up, as the
        // first knots did, closed it to half the seat depth.
        [-D * 0.43, 0.17, 0.032],
        [-D * 0.37, 0.27, 0.04],
        [-D * 0.22, 0.345, 0.064],
        [-D * 0.02, kneeY, 0.08],
      ]
      const back: ReadonlyArray<readonly [number, number, number]> = [
        [D * 0.44, 0, 0.032],
        [D * 0.43, 0.07, 0.03],
        [D * 0.42, 0.17, 0.032],
        [D * 0.36, 0.27, 0.04],
        [D * 0.22, 0.345, 0.064],
        [D * 0.02, kneeY, 0.08],
      ]
      // The rail on top of the knee, carrying the seat and closing the arch.
      const rail: ReadonlyArray<readonly [number, number, number]> = [
        [-D * 0.45, S - T - 0.022, 0.022],
        [0, S - T - 0.03, 0.03],
        [D * 0.42, S - T - 0.022, 0.024],
      ]
      // ...and the rest, rising off the rail's back end and raking away.
      const restZ = D * 0.42
      const rest: ReadonlyArray<readonly [number, number, number]> = [
        [restZ, S - T - 0.03, 0.062],
        [restZ + Math.sin(rake) * (B - S) * 0.3, S + (B - S) * 0.26, 0.05],
        [restZ + Math.sin(rake) * (B - S) * 0.7, S + (B - S) * 0.66, 0.042],
        [restZ + Math.sin(rake) * (B - S), B, 0.034],
      ]

      for (const side of [-1, 1]) {
        const x = side > 0 ? frameX : -frameX - frameT
        framePieces.push(
          plate(limb(front), x), plate(limb(back), x),
          plate(limb(rail), x), plate(limb(rest), x),
        )
        // The feet: flat pads, because a casting this thin would sink into
        // anything softer than tarmac standing on its own section.
        for (const z of [-D * 0.46, D * 0.44]) {
          const pad = chamferedBoxGeometry(
            [frameT * 2.4, 0.115], [frameT * 1.9, 0.09], 0.026, 0.006, [0, 0, 0], iron,
          )
          pad.translate(x + frameT / 2, 0.013, z)
          framePieces.push(pad)
        }
      }

      /**
       * A domed bolt head where a slat meets a frame.
       *
       * Sized to be seen rather than to be right: a real M8 dome is 14 mm and
       * comes to three pixels on a 1.6 m bench, which is the same as not
       * modelling it. Every slat gets one at each end, and sixteen small bright
       * marks in two straight lines are most of what says the timber is bolted
       * to iron rather than glued to it.
       */
      const bolt = (at: readonly [number, number, number], tilt = 0): void => {
        const g = latheGeometry([
          { y: 0, radius: 0.011 },
          { y: 0.0035, radius: 0.0105 },
          { y: 0.0062, radius: 0.008 },
          { y: 0.0078, radius: 0.004 },
        ], 10, [0, 0, 0], steel, { capBottom: false, capTop: true })
        if (tilt !== 0) g.rotateX(tilt)
        g.translate(at[0], at[1], at[2])
        boltPieces.push(g)
      }

      /* -------------------------------------------------------------- slats */
      /**
       * The slat-with-gap rule, and it is one line.
       *
       * A run of `n` slats with `n - 1` gaps has to come to exactly the run it
       * is filling, so the slat width is `(run - gaps) / n` and never a number
       * anybody typed. Choose the width instead and every change to the count
       * leaves a sliver at one end -- which is how a slatted anything gives
       * itself away.
       */
      const pitch = (run: number, count: number, gap: number): number =>
        (run - gap * (count - 1)) / count

      const gap = 0.014
      const slatPieces: BufferGeometry[] = []

      const seatRun = D * 0.78
      const seatW = pitch(seatRun, seats, gap)
      const seatFront = -D * 0.42
      for (let i = 0; i < seats; i += 1) {
        const z = seatFront + seatW / 2 + i * (seatW + gap)
        const g = chamferedBoxGeometry(
          [slatL, seatW], [slatL, seatW], T, Math.min(seatW, T) * 0.16, [0, 0, 0], wood(),
        )
        g.translate(0, S - T / 2, z)
        slatPieces.push(g)
        for (const side of [-1, 1]) bolt([side * frameX * 0.99, S + 0.0005, z])
      }

      // The back slats lie against the raked limb, so each is turned by the
      // rake and stepped along it rather than up the vertical.
      // Up to within a slat-quarter of the top of the rest. At 0.78 the
      // uprights stood a whole slat proud of the top board.
      const backRun = (B - S) * 0.86
      const backW = pitch(backRun, backs, gap * 1.6)
      const backStart = S + (B - S) * 0.16
      for (let i = 0; i < backs; i += 1) {
        const along = backW / 2 + i * (backW + gap * 1.6)
        const y = backStart + along * Math.cos(rake)
        // On the FRONT face of the rest, which is the limb's centre line
        // pushed forward by its half width and the slat's own half thickness.
        const z = restZ + (y - (S - T)) * Math.tan(rake) - (0.04 + T / 2) * Math.cos(rake)
        const g = chamferedBoxGeometry(
          [slatL, backW], [slatL, backW], T, Math.min(backW, T) * 0.16, [0, 0, 0], wood(),
        )
        g.rotateX(-rake)
        g.translate(0, y, z)
        slatPieces.push(g)
        for (const side of [-1, 1]) {
          bolt([side * frameX * 0.99, y + Math.sin(rake) * 0.013, z - Math.cos(rake) * 0.013], -rake)
        }
      }

      bakeOcclusion(framePieces, { strength: 0.3 })

      // The bench FACES +Z, which is where the kit's check camera stands. It
      // was written with the front at -Z, which is a fine convention for a
      // drawing and means every render is of the back of the thing.
      for (const g of [...slatPieces, ...framePieces, ...boltPieces]) g.rotateY(Math.PI)

      return {
        slats: { slot: 'wood' as const, geometry: smoothNormals(mergeColoured(slatPieces), 22) },
        frames: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(mergeColoured(framePieces), 30),
          extras: [{
            slot: 'stainless' as const,
            geometry: smoothNormals(mergeColoured(boltPieces), 30),
          }],
        },
      }
    },
  }, overrides)
}
