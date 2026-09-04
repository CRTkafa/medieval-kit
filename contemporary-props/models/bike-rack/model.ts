/**
 * @contemporary-props/bike-rack
 *
 * One swept hoop instanced along a rail, which is what the catalogue puts it
 * twenty-first for and the whole of what it is: build the shape once, place it
 * a derived number of times, and let the count be a slider.
 *
 * It is the row that introduces `tubeGeometry`, the kit's fourth way of making
 * a solid. A hoop is a constant round section following a line that BENDS, and
 * none of the three helpers before it can do that: a lathe turns about an axis,
 * a plan sweep varies with height, an extrusion runs straight. The hoop's path
 * is four numbers -- up one leg, round the crown, down the other -- and the
 * same helper is waiting for the street lamp's swan neck and the traffic
 * signal's mast arm later in this same domain.
 *
 * Measured against the fitted dimensions, which for a cycle stand are set by
 * the bicycle rather than by taste: 750 mm above ground so the frame is held at
 * two heights, and a 48 mm tube, which is the size a D-lock closes around. The
 * narrow hoop in the reference is 300 mm across on a 38 mm tube, which is the
 * toast-rack element rather than the 750 mm Sheffield stand: the same object,
 * half the plan, and the one you see in a rank.
 *
 * The pitch is the slat-with-gap rule from the park bench, in its second use:
 * the spacing is `run / (count - 1)`, never a number anybody typed, so a rank
 * of four and a rank of nine both fill the same length of pavement.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  tubeGeometry,
  type Vec3,
} from '../core/index.ts'

export interface BikeRackConfig {
  /** Hoops in the rank. */
  readonly hoops: number
  /** Length of pavement the rank occupies, first hoop to last (metres). */
  readonly run: number
  /** Height of a hoop above the ground (metres). */
  readonly height: number
  /** Width of a hoop across its legs (metres). */
  readonly width: number
  readonly seed: number
}

export const bikeRackDefaults: BikeRackConfig = {
  hoops: 6,
  // 600 mm between hoops. The pitch is the one proportion the critic and the
  // measurement agreed on: two hoop widths, near enough, against a photograph
  // that reads 1.9.
  run: 3,
  // 750 mm, which is not a choice: it is the height that puts the top bar
  // across a bicycle's top tube and the bottom of the arc beside its wheel.
  height: 0.75,
  /*
   * The narrow toast-rack element rather than the 750 mm Sheffield stand, and
   * this number went out and came back.
   *
   * A round of critique said the hoops were too short and wide against a
   * reference it read as four tall to one across, so they went to 240 mm on
   * that word alone. The next round then said the tube was far too thick for
   * the opening -- which is the same complaint from the other side, and both
   * cannot be acted on.
   *
   * Measuring settled it. The reference's SIX hoops are not interchangeable:
   * the far ones are seen obliquely and their width is foreshortened, so hoop
   * one measures 4.6 tall to one across and hoop six, nearest and squarest to
   * the camera, measures 2.45. Against hoop six a 300 mm hoop on a 750 mm
   * stand is 2.5, its 38 mm tube is 0.127 of the width against the photo's
   * 0.122, and the rank's pitch is 1.7 widths against 1.9. All three inside a
   * few percent, from one measurement, after two rounds of moving on a word.
   */
  width: 0.3,
  seed: 41,
}

export type BikeRackParts = 'hoops'

export function createModel(overrides: Partial<BikeRackConfig> = {}) {
  return createKitModel<
    BikeRackConfig, 'galvanised', BikeRackParts, Record<string, never>
  >({
    id: 'bike-rack',
    defaults: bikeRackDefaults,
    slots: ['galvanised'],
    // Hot-dip zinc is the one metal in the palette with a real spangle to it,
    // and a rank of identical hoops is where a flat finish would show most.
    mottle: { amount: 0.28, cell: 0.09 },

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const hoops = Math.max(2, Math.round(config.hoops))
      const run = Math.min(8, Math.max(0.4, config.run))
      const H = Math.min(1.1, Math.max(0.45, config.height))
      const W = Math.min(0.9, Math.max(0.18, config.width))

      // 38 mm outside diameter, off the reference rather than off memory: a
      // 48 mm tube is made, but it is the Sheffield stand's gauge and on a
      // 300 mm hoop it fills a fifth of the opening instead of an eighth.
      const tube = 0.019
      const zinc = tint('galvanised', jitter(random, 0.02), 0.6)

      /**
       * The hoop's path, as a polyline the sweep follows.
       *
       * Two straight legs and a half turn between them, and the arc is sampled
       * rather than drawn: `arcBarGeometry` would give the crown but not the
       * legs, and joining three pieces would leave two pairs of end caps inside
       * the tube where the sections meet. One path, one solid, no joints.
       *
       * The crown's radius is half the hoop's width, so the arc is a true
       * semicircle and the legs are tangent to it -- which is what a tube
       * bender actually produces and what stops the corner reading as a mitre.
       */
      const crown = W / 2
      const legTop = H - crown
      const path: Vec3[] = [[-crown, 0, 0]]
      // A couple of intermediate points up each leg so the mottle has somewhere
      // to sit; a two-point leg is one long quad and takes one colour.
      for (const t of [0.35, 0.7]) path.push([-crown, legTop * t, 0])
      const arcSteps = 14
      for (let i = 0; i <= arcSteps; i += 1) {
        const a = Math.PI - (i / arcSteps) * Math.PI
        path.push([Math.cos(a) * crown, legTop + Math.sin(a) * crown, 0])
      }
      for (const t of [0.7, 0.35]) path.push([crown, legTop * t, 0])
      path.push([crown, 0, 0])

      /**
       * ...and the pitch, which is derived.
       *
       * `run` is first hoop to last, so the gaps are one fewer than the hoops
       * and the spacing is the run over that. A rank of two fills the same
       * pavement as a rank of nine, and no count leaves a hoop hanging off one
       * end -- the same rule the park bench's slats settled, in its second use.
       */
      const pitch = hoops > 1 ? run / (hoops - 1) : 0
      const pieces: BufferGeometry[] = []

      for (let i = 0; i < hoops; i += 1) {
        const z = -run / 2 + i * pitch
        pieces.push(tubeGeometry(
          path.map(([x, y]) => [x, y, z] as Vec3),
          tube, 12, zinc,
          // No caps: both ends are buried in their own flange below, and a cap
          // there would be a disc inside solid metal.
          { capStart: false, capEnd: false },
        ))

        /*
         * The flange each leg is bolted down through, and its BOLTS.
         *
         * The flange alone is the only thing saying the hoop was fitted rather
         * than pushed into mud, and on its own it did not say it: a plain pad
         * reads as the bottom of the tube. Three bolt heads do, and they are
         * drawn at 20 mm across rather than the 12 mm a real M10 head is --
         * the same call the picnic table's coach bolts needed, for the same
         * reason. A fastening nobody can see is a fastening that is not there.
         */
        const flange = tint('galvanised', -0.05, 0.6)
        for (const side of [-crown, crown]) {
          pieces.push(latheGeometry([
            { y: 0, radius: tube * 3 },
            { y: 0.005, radius: tube * 2.9 },
            { y: 0.011, radius: tube * 2.3 },
            { y: 0.015, radius: tube * 1.3 },
          ], 16, [side, 0, z], flange, { capBottom: false, capTop: false }))

          for (let b = 0; b < 3; b += 1) {
            const a = (b / 3) * Math.PI * 2 + 0.5
            pieces.push(latheGeometry([
              { y: 0.009, radius: 0.0095 },
              { y: 0.014, radius: 0.009 },
              { y: 0.017, radius: 0.005 },
            ], 8, [side + Math.cos(a) * tube * 2.1, 0, z + Math.sin(a) * tube * 2.1],
            tint('galvanised', -0.12, 0.4), { capBottom: false, capTop: true }))
          }
        }
      }

      bakeOcclusion(pieces, { strength: 0.3 })

      return {
        hoops: {
          slot: 'galvanised' as const,
          geometry: smoothNormals(mergeColoured(pieces), 46),
        },
      }
    },
  }, overrides)
}
