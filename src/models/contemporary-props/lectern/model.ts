/**
 * @contemporary-props/lectern
 *
 * An angled cap on a panelled shaft, which is what the catalogue puts it
 * fifteenth for: the chamfer helper carrying a whole object rather than
 * finishing one. There is no lathe here, no sweep and no extrusion. Every
 * piece is a box with its arrises taken off, and the model is a demonstration
 * that at prop scale that is enough for a piece of furniture.
 *
 * The panelling is the reason it is not just a plinth. A shaft this tall and
 * this plain has nothing to catch light on: 800 mm of unbroken face reads as a
 * cardboard box however well proportioned it is. A stile-and-rail border
 * standing 7 mm proud of a recessed panel gives every face four shadow lines
 * and a change of plane, and it costs sixteen boxes.
 *
 * Measured off the reference against a 1.15 m standing height:
 *
 *   base      520 x 420 x 75, chamfered top and bottom
 *   shaft     300 x 340, running from the base to 0.78 of the height
 *   top       600 x 460, sloped 20 degrees, with a book stop along its low
 *             edge that runs past the board at both ends exactly as the
 *             reference's does
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  extrudeGeometry,
  jitter,
  mergeColoured,
  smoothNormals,
  type Section,
} from '../core/index.ts'

export interface LecternConfig {
  /** Height to the top of the reading surface (metres). */
  readonly height: number
  /** Width of the reading top (metres). */
  readonly width: number
  /** Slope of the reading top (radians from horizontal). */
  readonly slope: number
  readonly seed: number
}

export const lecternDefaults: LecternConfig = {
  // A standing lectern is set so the reading surface meets a speaker's hands,
  // which puts it between 1.1 and 1.2 m whoever makes it.
  height: 1.15,
  // 1.9 tall for its width, which is the reference measured corner to corner.
  width: 0.58,
  // A shade steeper than 20 degrees. The reference's board is closer to 22,
  // and a lectern flatter than 20 reads as a table someone has propped up.
  slope: 0.39,
  seed: 37,
}

export type LecternParts = 'top' | 'column' | 'base'

export function createModel(overrides: Partial<LecternConfig> = {}) {
  return createKitModel<LecternConfig, 'wood', LecternParts, Record<string, never>>({
    id: 'lectern',
    defaults: lecternDefaults,
    slots: ['wood'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.4, Math.max(0.9, config.height))
      const W = Math.min(0.85, Math.max(0.4, config.width))
      const slope = Math.min(0.6, Math.max(0.1, config.slope))

      const D = W * 0.77
      const T = 0.032
      // The tray's rim stands 20 mm proud of the reading surface. At 15 it
      // read as a moulding on the edge rather than as something a book could
      // rest against, which is the only reason it is there.
      const lip = 0.028

      const baseH = H * 0.065
      // Wider than 0.87: the top overhung the plinth by a quarter and the
      // whole thing read top-heavy. The reference's overhang is an eighth.
      const baseW = W * 0.94
      const baseD = W * 0.75

      const cw = W * 0.5
      const cd = W * 0.57
      const columnTop = H - D * Math.sin(slope) - T * Math.cos(slope) - lip

      // Oak, and the same board throughout: this is one piece of furniture
      // made from one pack, not an assembly of found timber, so the per-piece
      // deviation is half of what the picnic table's boards get -- enough that
      // a panel differs from the stile beside it, which is the only part of
      // grain a kit without textures can carry.
      const oak = (lift = 0): ReturnType<typeof tint> =>
        tint('wood', 0.06 + lift + jitter(random, 0.03), 0.8)

      const box = (
        dx: number, dy: number, dz: number,
        at: readonly [number, number, number],
        chamfer = Math.min(dx, dy, dz) * 0.16, colour = oak(),
      ): BufferGeometry => chamferedBoxGeometry(
        [dx, dz], [dx, dz], dy, chamfer, [0, 0, 0], colour,
      ).translate(at[0], at[1], at[2])

      /* --------------------------------------------------------------- base */
      /*
       * ONE slab, deeply chamfered, not two.
       *
       * Built as a plinth with a second moulding standing on it, the base read
       * as two thin tiers with a step between them -- the reference is a
       * single thick block whose whole top edge is one bevel, and the
       * difference is the difference between a lectern and a wedding cake. The
       * chamfer at 0.3 of the height is large enough to be the moulding by
       * itself.
       */
      const basePieces: BufferGeometry[] = [
        box(baseW, baseH, baseD, [0, baseH / 2, 0], baseH * 0.3),
      ]

      /* ------------------------------------------------------------- column */
      /**
       * The shaft, and then the panelling that is the point of it.
       *
       * The core is the full section and the border stands PROUD of it. Done
       * the other way round -- a full-size shaft with a recessed plate laid on
       * each face -- the plate has to be sunk into a solid that is already
       * there, and a kit with no subtraction cannot sink anything. Proud is
       * the same shadow line seen from outside and it is four boxes a face.
       */
      const columnPieces: BufferGeometry[] = []

      /**
       * The shaft's top is CUT TO THE SLOPE, and that is why it is an
       * extrusion rather than a box.
       *
       * Squared off level it meets a sloped board along one edge and nowhere
       * else: measured, the gap at the back of the shaft was 138 mm of open
       * air with the reading top hanging over it. A joiner cuts the shaft to
       * the underside of the desk, so the side profile is a rectangle with an
       * angled top -- which is a section, and a section is one call.
       */
      const frontEdgeZ = -(T / 2) * Math.sin(slope) + (D / 2) * Math.cos(slope)
      const topAt = (z: number): number => columnTop + (frontEdgeZ - z) * Math.tan(slope)

      const profile: Section = [
        [cd / 2, baseH],
        [cd / 2, topAt(cd / 2)],
        [-cd / 2, topAt(-cd / 2)],
        [-cd / 2, baseH],
      ]
      columnPieces.push(
        extrudeGeometry(profile, cw, [0, 0, 0], oak(-0.05))
          .rotateY(-Math.PI / 2)
          .translate(cw / 2, 0, 0),
      )

      /**
       * ...and then the panelling, which has to follow it.
       *
       * The front face and the back face are rectangles of DIFFERENT heights
       * -- 125 mm apart on this slope -- and the two side faces are
       * trapezoids. Running one border height round all four, which is the
       * obvious economy, leaves the back face with a hand's width of bare
       * shaft above its panel and it shows from every rear view.
       */
      const bw = W * 0.075
      const proud = 0.007
      const inset = 0.004

      // The two faces normal to Z: each square, each to its own height.
      for (const side of [-1, 1]) {
        const z = side * (cd / 2 + proud / 2)
        const hi = topAt(side * cd / 2) - inset
        const lo = baseH + inset
        for (const edge of [-1, 1]) {
          columnPieces.push(box(
            bw, hi - lo, proud, [edge * (cw / 2 - bw / 2), (hi + lo) / 2, z], proud * 0.3,
          ))
        }
        for (const [at, sign] of [[hi, -1], [lo, 1]] as const) {
          columnPieces.push(box(
            cw - bw * 2, bw, proud, [0, at + (sign * bw) / 2, z], proud * 0.3,
          ))
        }
      }

      // The two faces normal to X: stiles of unequal height, and a rail across
      // the top that is sloped because the face it borders is.
      for (const side of [-1, 1]) {
        const x = side * (cw / 2 + proud / 2)
        const lo = baseH + inset
        const at = (z: number): number => topAt(z) - inset
        for (const edge of [-1, 1]) {
          const z = edge * (cd / 2 - bw / 2)
          const hi = at(z)
          columnPieces.push(box(proud, hi - lo, bw, [x, (hi + lo) / 2, z], proud * 0.3))
        }
        columnPieces.push(box(proud, bw, cd - bw * 2, [x, lo + bw / 2, 0], proud * 0.3))
        const span = (cd - bw * 2) / Math.cos(slope)
        const rail = chamferedBoxGeometry(
          [proud, span], [proud, span], bw, proud * 0.3, [0, 0, 0], oak(),
        )
        rail.rotateX(slope)
        rail.translate(x, (at(cd / 2 - bw) + at(-(cd / 2 - bw))) / 2 - bw / 2, 0)
        columnPieces.push(rail)
      }

      /* ---------------------------------------------------------------- top */
      /**
       * The reading top, built flat and then tipped.
       *
       * Everything on it is laid out in the board's own plane -- the tray, its
       * three raised edges, the book stop -- and one rotation at the end puts
       * the whole assembly on the slope. Tipping each piece as it is made puts
       * the trigonometry in six places and the mistakes in five of them.
       */
      const topPieces: BufferGeometry[] = []
      topPieces.push(box(W, T, D, [0, 0, 0], T * 0.16))
      // The book stop runs PAST the board at both ends, which is the detail
      // that stops the top reading as a slab with a lid.
      topPieces.push(box(
        W * 1.03, lip + T * 0.4, lip * 1.5,
        [0, (lip + T * 0.4) / 2 + T * 0.3, D / 2 - lip * 0.75], lip * 0.28,
      ))
      // A raised edge up each side and along the high edge, all one section.
      for (const side of [-1, 1]) {
        topPieces.push(box(
          lip * 1.2, lip, D - lip * 1.5,
          [side * (W / 2 - lip * 0.6), lip / 2 + T * 0.3, -lip * 0.75], lip * 0.25,
        ))
      }
      topPieces.push(box(
        W - lip * 2.4, lip, lip * 1.2,
        [0, lip / 2 + T * 0.3, -(D / 2 - lip * 0.6)], lip * 0.25,
      ))

      const top = mergeColoured(topPieces)
      top.rotateX(slope)
      top.translate(0, columnTop + T * Math.cos(slope) * 0.5 + D * Math.sin(slope) * 0.5, 0)

      bakeOcclusion(columnPieces, { strength: 0.4 })
      bakeOcclusion(basePieces, { strength: 0.35 })

      return {
        base: { slot: 'wood' as const, geometry: smoothNormals(mergeColoured(basePieces), 26) },
        column: { slot: 'wood' as const, geometry: smoothNormals(mergeColoured(columnPieces), 26) },
        top: { slot: 'wood' as const, geometry: smoothNormals(top, 26) },
      }
    },
  }, overrides)
}
