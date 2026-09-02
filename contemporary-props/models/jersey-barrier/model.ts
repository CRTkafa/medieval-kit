/**
 * @contemporary-props/jersey-barrier
 *
 * The extrusion helper's reference implementation, which is what the catalogue
 * puts it eleventh for, and the cheapest model in the kit by a distance: the
 * whole body is one polyline and a length.
 *
 * The polyline is not invented. The New Jersey profile is a published shape and
 * every barrier on every road is a casting of it, so the section here is the
 * standard one in inches and converted, rather than a curve drawn to look
 * right. On a 32 inch barrier:
 *
 *   0 in    24 in wide   the base
 *   3 in    24 in wide   the top of the vertical toe
 *   13 in    9.75 in     the 55 degree face, which is the one a tyre climbs
 *   32 in    6 in        the 84 degree face, and the top
 *
 * Those four numbers are the entire reason the shape is recognisable. The lower
 * face is shallow enough that a car rides up it and comes back down; the upper
 * one is steep enough that it does not roll. Draw it as a single straight taper
 * and it is a plinth, not a barrier.
 *
 * The end connector is a half lap: the upper half of the casting runs past the
 * lower at one end and the lower past the upper at the other. A single barrier
 * is never the object -- they come in runs -- and a run of these placed end to
 * end at `length` spacing interleaves.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  createKitModel,
  createTinter,
  extrudeGeometry,
  jitter,
  mergeColoured,
  smoothNormals,
  type Section,
} from '../core/index.ts'

export interface JerseyBarrierConfig {
  /** Height of the barrier (metres). */
  readonly height: number
  /** Length of the cast section (metres). */
  readonly length: number
  readonly seed: number
}

export const jerseyBarrierDefaults: JerseyBarrierConfig = {
  // 32 inches, which is the standard highway height and the one the published
  // section is dimensioned at.
  height: 0.81,
  // Precast sections come at 2, 3 and 6 metres. Two is the one that gets
  // craned around a works entrance, which is where most of them are seen.
  length: 2,
  seed: 7,
}

export type JerseyBarrierParts = 'body'

export function createModel(overrides: Partial<JerseyBarrierConfig> = {}) {
  return createKitModel<
    JerseyBarrierConfig, 'concrete', JerseyBarrierParts, Record<string, never>
  >({
    id: 'jersey-barrier',
    defaults: jerseyBarrierDefaults,
    slots: ['concrete'],
    /*
     * Concrete is the coarsest surface in the palette and this is the largest
     * flat expanse of it in the kit, so it takes more than the default -- but
     * at a LARGER cell, not a finer one.
     *
     * The obvious reading of the reference is fine aggregate speckle, and the
     * first attempt chased it with a 50 mm cell. Mottle here is written into
     * vertex colours, so a cell smaller than the distance between rings is
     * sampled about once per cell and aliases: the barrier came out with long
     * smeared bands down it and read as brushed metal. Speckle at that scale
     * is a texture and this kit does not have textures. What it can carry is
     * the other half of what concrete looks like -- broad tonal drift across a
     * pour -- and that wants a cell several rings wide.
     *
     * The amount is then held DOWN, because a long constant section can only
     * vary along its length and one octave of noise on it reads as stripes. At
     * 0.2 the barrier came out banded like corrugated sheet. This is the point
     * where more variation is worse than less, and it is a property of the
     * shape rather than of the setting: nothing else in either kit is two
     * metres of the same cross-section.
     */
    mottle: { amount: 0.11, cell: 0.32 },

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.2, Math.max(0.5, config.height))
      const L = Math.min(6, Math.max(0.8, config.length))

      /**
       * The section, in fractions of the height, straight off the published
       * profile: 24, 24, 9.75 and 6 inches of width at 0, 3, 13 and 32 inches
       * of height, all divided by 32.
       *
       * Written as one side and mirrored, because the two faces of a jersey
       * barrier are the same face and writing them out twice is how they end
       * up not being.
       */
      const HALF: ReadonlyArray<readonly [number, number]> = [
        [0.375, 0],
        [0.375, 0.094],
        [0.1523, 0.406],
        // A small flat before the top edge: the casting has an arris rather
        // than a knife edge, and at prop scale one chamfer is the difference
        // between concrete and cardboard.
        [0.0938, 0.978],
        [0.078, 1],
      ]

      /**
       * ...and every corner of it is ROUNDED, which is not decoration.
       *
       * A casting comes out of a mould with radiused arrises -- the reference's
       * are 20 to 30 mm on an 810 mm barrier -- and a section with mathematical
       * corners reads as folded card at any size. Each corner is replaced by
       * two points a radius back along each of its edges, which is a chamfer
       * rather than a true fillet; across 20 mm nothing can tell, and the
       * alternative is arcs at every vertex of every extruded thing in the
       * catalogue.
       */
      const R = 0.022
      const back = (
        p: readonly [number, number], to: readonly [number, number],
      ): readonly [number, number] => {
        const dx = to[0] - p[0]
        const dy = to[1] - p[1]
        const len = Math.hypot(dx, dy) || 1
        const d = Math.min(R, len * 0.45)
        return [p[0] + (dx / len) * d, p[1] + (dy / len) * d]
      }
      const CORNERS: Array<readonly [number, number]> = []
      for (let i = 0; i < HALF.length; i += 1) {
        const p = HALF[i]!
        // The first and last points sit ON the mirror line, so the edge on
        // that side is the one the mirror supplies: the neighbour there is the
        // same point with its x negated.
        const prev = HALF[i - 1] ?? ([-p[0], p[1]] as const)
        const next = HALF[i + 1] ?? ([-p[0], p[1]] as const)
        CORNERS.push(back(p, prev), back(p, next))
      }

      /**
       * ...and then the long edges are SUBDIVIDED.
       *
       * The two faces of this section are 0.3 of the height each, and a ring
       * every 6 cm makes them into quads three times longer than they are
       * wide. A quad is two triangles, its four corners carry four different
       * mottle values, and the interpolation across the shared diagonal does
       * not match on both sides of it: the flat faces came out crossed by
       * broad diagonal facets. Nothing is wrong with the surface -- it is one
       * plane -- and no amount of normal smoothing will help, because the seam
       * is in the colour.
       *
       * Squarer quads fix it, and half of squarer is the section's job.
       */
      const STEP = 0.075
      for (let i = CORNERS.length - 1; i > 0; i -= 1) {
        const a = CORNERS[i - 1]!
        const b = CORNERS[i]!
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        const cuts = Math.floor(len / STEP)
        for (let k = cuts; k >= 1; k -= 1) {
          const t = k / (cuts + 1)
          CORNERS.splice(i, 0, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        }
      }

      const widthAt = (y: number): number => {
        for (let i = 0; i < CORNERS.length - 1; i += 1) {
          const [x0, y0] = CORNERS[i]!
          const [x1, y1] = CORNERS[i + 1]!
          if (y >= y0 && y <= y1) {
            const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0)
            return x0 + (x1 - x0) * t
          }
        }
        return CORNERS.at(-1)![0]
      }

      /**
       * One horizontal band of the section, mirrored and closed.
       *
       * `band(0, 1)` is the whole barrier; the two halves are what the end
       * joint is made of, and a third band with its floor lifted is what the
       * drainage openings are made of. Counter-clockwise seen from +Z -- up the
       * right-hand face, across the top, back down the left -- which is the
       * helper's whole contract and the same direction the plan sweep wanted.
       */
      const band = (from: number, to: number): Section => {
        const side: Array<readonly [number, number]> = [[widthAt(from), from]]
        for (const c of CORNERS) if (c[1] > from && c[1] < to) side.push(c)
        side.push([widthAt(to), to])
        return [
          ...side.map(([x, y]) => [x * H, y * H] as const),
          ...[...side].reverse().map(([x, y]) => [-x * H, y * H] as const),
        ]
      }

      const section = band(0, 1)

      const concrete = tint('concrete', jitter(random, 0.02))
      // Lighter along the top, because the top of a barrier is the face that
      // never gets splashed.
      const crest = tint('concrete', 0.05)
      // One ring every 6 cm, which is what gives the mottle somewhere to sit:
      // three samples across its cell, where one sample gives smears. See the
      // helper's `steps`.
      const ringsPer = (span: number): number => Math.max(1, Math.round(span / 0.06))

      /**
       * The end connector is a POCKET CAST INTO THE TOP, not a half lap.
       *
       * Three shapes were tried here. A spigot with a painted pocket opposite
       * it could not win: dark enough to read as a hole the pocket became a
       * black panel the size of the end face, light enough not to and it
       * became a second projecting rib. A half lap fixed that -- it is a
       * recess that is really there -- and then two separate readers looked at
       * it and both said the barrier appeared to have been cut in two and
       * slid. They were right. At 30 mm the step is far too small to read as a
       * joint and just large enough to read as a fault, and the reference's
       * ends are square.
       *
       * So the ends go back to square and the connector goes where a precast
       * barrier really carries one: a dowel pocket cast down into the top of
       * each end, so two barriers abutted make one pocket for a pin. It is the
       * same trick the drainage openings use -- a short span extruded from a
       * section whose top is lowered -- it is invisible in silhouette, and it
       * is the only one of the three nobody has misread.
       */
      const pocketTop = 0.9
      const pocketL = H * 0.13

      /**
       * The drainage openings, and they are REAL openings.
       *
       * Water has to cross the line a barrier makes, so every casting has a
       * pair of holes through the bottom of it; they are the only thing that
       * breaks the silhouette of an otherwise entirely constant section. The
       * cheap way to suggest one is a dark patch, and it does not work here,
       * because a barrier is looked at end on as often as not and a patch has
       * no daylight behind it.
       */
      // Small, and near the ENDS, which is where the reference's is: a single
      // slot cut into the bottom edge just in from the corner. Put at the
      // third points and made twice this size they stopped reading as
      // openings in a casting and started reading as a shape decision.
      const notchH = 0.06
      const gap = (H * 0.16) / L

      interface Span { readonly from: number; readonly to: number; readonly cut: Section }
      const pocket = pocketL / L
      const pocketed = band(0, pocketTop)
      const notched = band(notchH, 1)
      const spans: Span[] = [
        { from: 0, to: pocket, cut: pocketed },
        { from: pocket, to: 0.16 - gap / 2, cut: section },
        { from: 0.16 - gap / 2, to: 0.16 + gap / 2, cut: notched },
        { from: 0.16 + gap / 2, to: 0.84 - gap / 2, cut: section },
        { from: 0.84 - gap / 2, to: 0.84 + gap / 2, cut: notched },
        { from: 0.84 + gap / 2, to: 1 - pocket, cut: section },
        { from: 1 - pocket, to: 1, cut: pocketed },
      ]

      const pieces: BufferGeometry[] = spans.map((span) => {
        const length = (span.to - span.from) * L
        return extrudeGeometry(span.cut, length, [0, 0, span.from * L - L / 2], concrete, {
          colourTop: crest,
          steps: ringsPer(length),
          // Every span is capped at both ends. Between two spans of the same
          // section that would leave a pair of coincident faces, which is the
          // trap `latheGeometry` exists to avoid -- but here no two neighbours
          // share a section, so every one of these caps is a real step that has
          // to be drawn.
          capStart: true,
          capEnd: true,
        })
      })

      bakeOcclusion(pieces, { strength: 0.35 })

      return {
        body: {
          slot: 'concrete' as const,
          // A low crease angle: concrete castings have arrises, and every edge
          // on this shape is a real one that should stay sharp.
          geometry: smoothNormals(mergeColoured(pieces), 18),
        },
      }
    },
  }, overrides)
}
