/**
 * @contemporary-props/bus-shelter
 *
 * A cantilevered roof over glazed bays: the largest thing in the kit that is
 * still a thing rather than a building, which is what the catalogue puts it
 * ninety-ninth for and is the line this model is built to stay on the right
 * side of. A shelter is furniture. It has four feet you can see all of, a roof
 * you can see under, and no floor -- and the moment it gets a floor or a door
 * it stops being a prop somebody drops into a street and starts being
 * architecture somebody has to model a street around.
 *
 * Measured off the reference against a 2.4 m shelter: 3.2 m long, 1.4 m deep,
 * a roof overhanging 0.3 at the front and 0.15 behind, glazing from 0.32 up to
 * the roof beam, a seat at 0.45 and its back rail at 0.75.
 *
 * The open side faces +Z, where the kit's renderer stands. Three models this
 * session were written the other way round and photographed from behind.
 *
 * Everything repeated here goes through `splitRuns`: the glazed bays across the
 * back, and the slats of the seat. It is the fourth and fifth use of a rule the
 * park bench settled -- derive the pitch, never type it -- and on an object
 * this size it is what stops a change of length leaving a sliver at one end.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  smoothNormals,
  splitRuns,
} from '../core/index.ts'

export interface BusShelterConfig {
  /** Length along the kerb (metres). */
  readonly length: number
  /** Height to the top of the roof (metres). */
  readonly height: number
  /** Depth front to back (metres). */
  readonly depth: number
  /** Glazed bays across the back. */
  readonly bays: number
  /** Slats in the seat. */
  readonly slats: number
  readonly seed: number
}

export const busShelterDefaults: BusShelterConfig = {
  length: 3.2,
  height: 2.4,
  depth: 1.4,
  bays: 2,
  slats: 5,
  seed: 43,
}

export type BusShelterParts = 'frame' | 'glass' | 'seat'

export function createModel(overrides: Partial<BusShelterConfig> = {}) {
  return createKitModel<
    BusShelterConfig, 'aluminium' | 'glass', BusShelterParts, Record<string, never>
  >({
    id: 'bus-shelter',
    defaults: busShelterDefaults,
    slots: ['aluminium', 'glass'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = Math.min(8, Math.max(1.4, config.length))
      const H = Math.min(3.2, Math.max(1.8, config.height))
      const D = Math.min(2.6, Math.max(0.8, config.depth))
      const bays = Math.max(1, Math.round(config.bays))
      const slats = Math.max(2, Math.round(config.slats))

      const alu = tint('aluminium', 0.04 + jitter(random, 0.015))
      const shade = tint('aluminium', -0.06, 0.5)
      /*
       * CLEAR glass, not the tinted slot.
       *
       * `glassTinted` is a smoked panel at 0x3a4750 and it is the right slot
       * for something meant to be looked AT -- the street lamp's unlit lens
       * uses it one row back. A shelter's glazing is toughened and clear,
       * because its whole job is that a waiting passenger can see the bus
       * coming and a passing driver can see the passenger. Glazed in the
       * tinted slot the bays read as filled-in dark panels and the shelter
       * turns into a shed.
       */
      const glass = tint('glass', 0.02, 0.4)

      // 0.045 of the total height, measured off the reference. A shelter's
      // posts carry a roof in wind and they are stockier than they look in a
      // drawing; at 0.037 the whole frame reads as wire.
      const post = H * 0.045
      /*
       * The roof is a DEEP slab, and that is measured rather than chosen.
       *
       * On the reference the slab is 0.119 of the clear height under it. Built
       * at 0.05 -- the thickness a roof wants to be if you think of it as a
       * lid -- it reads as a sheet of card on four legs, which is what the
       * first render of this was. A shelter's canopy is that deep because the
       * drainage and the lighting live inside it.
       */
      const roofH = H * 0.1
      const beamY = H - roofH
      const backZ = -D / 2 + post / 2
      const frontZ = D / 2 - post / 2
      const halfL = L / 2 - post / 2

      const framePieces: BufferGeometry[] = []
      const glassPieces: BufferGeometry[] = []
      const seatPieces: BufferGeometry[] = []

      /* -------------------------------------------------------------- posts */
      /**
       * Four posts on bolted feet, and the feet matter.
       *
       * A shelter that meets the pavement as four bare tubes reads as a model
       * standing on a table. Every real one is bolted down through a plate at
       * each corner, and those plates are the only thing in the object that
       * says it was installed rather than placed.
       */
      const footH = H * 0.008
      for (const x of [-halfL, halfL]) {
        for (const z of [backZ, frontZ]) {
          framePieces.push(chamferedBoxGeometry(
            [post, post], [post * 0.96, post * 0.96],
            beamY - footH, post * 0.09, [x, footH + (beamY - footH) / 2, z], alu,
          ))
          framePieces.push(chamferedBoxGeometry(
            [post * 2.4, post * 2.4], [post * 2.2, post * 2.2],
            footH, post * 0.1, [x, footH / 2, z], shade,
          ))
        }
      }

      /* --------------------------------------------------------------- roof */
      /**
       * The roof CANTILEVERS, and that is the whole silhouette.
       *
       * It runs past the front posts by a fifth of the depth and past the back
       * by half that, so from the side it is a slab floating on two legs rather
       * than a lid sitting on a box. Built flush with the posts the shelter
       * reads as a glass cabinet.
       */
      /*
       * The overhang, and it is asymmetric on purpose.
       *
       * The roof stands about 0.30 of the depth past the FRONT posts on the
       * reference and half that behind, because the front is the side you
       * stand under while the bus is arriving. Made even, the roof centres on
       * the frame and the object loses the one thing that says which way it
       * faces.
       */
      const over = D * 0.26
      // The bright cap is the THIN half and the fascia below it the deep one.
      // Split evenly the roof reads as two slabs; the reference is a shallow
      // tray sitting on a deep skirt, and the skirt is what casts the shadow
      // that says there is somewhere to stand under it.
      // The cap stands 2 mm proud of the fascia and no more. It cannot stand
      // flush -- two boxes with the same footprint put their side faces on one
      // plane over the band where they overlap, which is the fault the beams
      // had -- but anything the eye can read as a step makes the roof two
      // slabs, and the reference's is one.
      const lip = 0.002
      framePieces.push(chamferedBoxGeometry(
        [L + post * 1.24 + lip * 2, D + over * 1.36 + lip * 2],
        [L + post * 1.24 + lip * 2, D + over * 1.36 + lip * 2],
        roofH * 0.34, post * 0.12, [0, beamY + roofH * 0.83, over * 0.3], alu,
      ))
      // The fascia is ONE flat face: the same section top and bottom, with the
      // cap standing a few millimetres proud of it as a lip. Written as a
      // taper it steps in visibly and the roof reads as two slabs stacked
      // rather than as a tray with a skirt.
      framePieces.push(chamferedBoxGeometry(
        [L + post * 1.24, D + over * 1.36], [L + post * 1.24, D + over * 1.36],
        roofH * 0.68, post * 0.1, [0, beamY + roofH * 0.33, over * 0.3], shade,
      ))
      /*
       * The beams, front and back, spanning the posts.
       *
       * They hang a quarter of a post BELOW the post heads rather than finishing
       * level with them. Written flush -- which is the obvious way to say `the
       * roof sits on these` -- the beam's top face and the four post tops are
       * eight faces on one plane at the exact height the eye is drawn to, and
       * the renderer has no way to order them. Dropped, the posts run past the
       * beam into the roof, which is also how one of these is actually built.
       */
      for (const z of [backZ, frontZ]) {
        framePieces.push(chamferedBoxGeometry(
          [L + post, post * 1.1], [L + post, post * 1.1],
          post * 1.5, post * 0.1, [0, beamY - post * 1.05, z], alu,
        ))
      }

      /* ------------------------------------------------------------ glazing */
      /**
       * The glass, in bays across the back and one pane at each end.
       *
       * The bays come from `splitRuns` so their mullions land where they land
       * rather than where somebody typed, and the panes stop short of the frame
       * on every side -- glass is held in a channel with a gasket, and a pane
       * run right into the steel is the giveaway that nobody looked.
       */
      const glassLo = H * 0.133
      const glassHi = beamY - post * 1.5
      const glassT = H * 0.005
      const inset = post * 0.35

      for (const run of splitRuns(L - post, post * 1.6, Array.from({ length: bays }, () => 1))) {
        glassPieces.push(chamferedBoxGeometry(
          [run.size - inset, glassT], [run.size - inset, glassT],
          glassHi - glassLo - inset, glassT * 0.4,
          [run.at, (glassLo + glassHi) / 2, backZ], glass,
        ))
      }
      // The mullions between the bays, which have to exist or the glass floats.
      for (let i = 1; i < bays; i += 1) {
        const x = -L / 2 + (L / bays) * i
        framePieces.push(chamferedBoxGeometry(
          [post * 0.7, post * 0.9], [post * 0.7, post * 0.9],
          glassHi - glassLo, post * 0.08,
          [x, (glassLo + glassHi) / 2, backZ], alu,
        ))
      }
      // The end panes.
      for (const x of [-halfL, halfL]) {
        glassPieces.push(chamferedBoxGeometry(
          [glassT, D - post * 2 - inset], [glassT, D - post * 2 - inset],
          glassHi - glassLo - inset, glassT * 0.4,
          [x, (glassLo + glassHi) / 2, (backZ + frontZ) / 2], glass,
        ))
      }
      /*
       * The CLIPS down each pane edge.
       *
       * Glass this size is not glued in; it is held by bolted clamps at
       * intervals, and on the reference they are the only detail on an
       * otherwise blank surface -- which makes them the thing that says the
       * pane is glass rather than an absence. They go on the frame, not on the
       * glass, so they shade with the frame.
       */
      const clipR = post * 0.16
      const clipAt = (x: number, z: number, along: 'x' | 'z'): void => {
        for (let i = 0; i < 3; i += 1) {
          const y = glassLo + (glassHi - glassLo) * (0.12 + i * 0.38)
          const box = chamferedBoxGeometry(
            along === 'x' ? [clipR * 2.6, clipR * 1.4] : [clipR * 1.4, clipR * 2.6],
            along === 'x' ? [clipR * 2.2, clipR * 1.1] : [clipR * 1.1, clipR * 2.2],
            clipR * 1.8, clipR * 0.3, [x, y, z], shade,
          )
          framePieces.push(box)
        }
      }
      for (const x of [-halfL + post * 0.42, halfL - post * 0.42]) {
        clipAt(x, backZ + post * 0.36, 'x')
        clipAt(x + (x < 0 ? -post * 0.06 : post * 0.06), 0, 'z')
      }

      // The rail along the foot of the back glazing, which is what the panes
      // actually stand in.
      framePieces.push(chamferedBoxGeometry(
        [L + post, post * 0.9], [L + post, post * 0.9],
        post * 0.8, post * 0.1, [0, glassLo - post * 0.4, backZ], alu,
      ))
      /*
       * And the same rail under each END pane, which the first pass left out.
       *
       * Without them the side glazing has nothing along its bottom edge and
       * hangs in the frame; the reference has a section there on all three
       * sides, and it is the member the whole shelter is squared up by.
       *
       * They sit a fraction LOWER than the back rail and are narrower than the
       * posts they run into. Level with it, the two rails cross at each back
       * corner with their top faces on one plane, which is the same pair of
       * unorderable faces the roof beams had; flush with the posts, their sides
       * land 0.6 mm off the post faces, under the kit's 1 mm rule.
       */
      for (const x of [-halfL, halfL]) {
        framePieces.push(chamferedBoxGeometry(
          [post * 0.7, D - post * 1.6], [post * 0.7, D - post * 1.6],
          post * 0.8, post * 0.1, [x, glassLo - post * 0.52, 0], alu,
        ))
      }

      /* --------------------------------------------------------------- seat */
      /**
       * A cantilevered bench: slats on brackets off the back posts, with
       * nothing under it.
       *
       * That is not a saving, it is the object. A shelter's seat hangs so the
       * pavement under it can be swept and so nobody can leave anything behind
       * it, and a bench with legs in here would read as a bench somebody
       * carried in.
       */
      // 0.237 of the clear height, off the reference. Written at 0.197 the
      // bench is a step rather than a seat, and the gap up to the back rail
      // opens far enough that the two stop reading as one piece of furniture.
      const seatY = H * 0.213
      const railY = H * 0.312
      const seatD = D * 0.3
      const slatRuns = splitRuns(seatD, seatD * 0.045, Array.from({ length: slats }, () => 1))
      for (const run of slatRuns) {
        seatPieces.push(chamferedBoxGeometry(
          [L * 0.86, run.size], [L * 0.86, run.size],
          post * 0.55, run.size * 0.18,
          [0, seatY, backZ + post * 0.6 + seatD / 2 + run.at], alu,
        ))
      }
      /*
       * The APRON along the front edge, which is what gives a bench its
       * thickness.
       *
       * Slats alone are read from the side as a row of pencils: the seat has a
       * visible depth of one slat and none of the mass a thing you sit on
       * needs. Every bench of this pattern closes its front edge with a
       * continuous section, and it is the member the slats are actually
       * screwed down to.
       */
      seatPieces.push(chamferedBoxGeometry(
        [L * 0.86, post * 0.34], [L * 0.86, post * 0.34],
        post * 0.7, post * 0.06,
        [0, seatY - post * 0.44, backZ + post * 0.6 + seatD - post * 0.12], alu,
      ))
      // The back rail, and the two brackets carrying the whole thing.
      seatPieces.push(chamferedBoxGeometry(
        [L * 0.86, post * 0.5], [L * 0.86, post * 0.5],
        post * 1.5, post * 0.08, [0, railY, backZ + post * 0.75], alu,
      ))
      for (const x of [-L * 0.3, L * 0.3]) {
        seatPieces.push(chamferedBoxGeometry(
          [post * 0.5, seatD * 0.9], [post * 0.5, seatD * 0.3],
          post * 1.4, post * 0.08,
          [x, seatY - post * 0.8, backZ + post * 0.6 + seatD * 0.45], shade,
        ))
      }

      bakeOcclusion(framePieces, { strength: 0.35 })
      bakeOcclusion(seatPieces, { strength: 0.35 })

      return {
        frame: { slot: 'aluminium' as const, geometry: smoothNormals(mergeColoured(framePieces), 30) },
        glass: { slot: 'glass' as const, geometry: smoothNormals(mergeColoured(glassPieces), 30) },
        seat: { slot: 'aluminium' as const, geometry: smoothNormals(mergeColoured(seatPieces), 30) },
      }
    },
  }, overrides)
}
