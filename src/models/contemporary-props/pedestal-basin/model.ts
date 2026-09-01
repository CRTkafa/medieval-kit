/**
 * @contemporary-props/pedestal-basin
 *
 * The first object in the kit that is not round, and the first where the
 * ceramic slot carries the whole model.
 *
 * The catalogue budgets this row at "two lathes making an hourglass", and that
 * is the one thing it cannot be. Every basin in use today is a D in plan: a
 * semicircular front, straight sides, and a flat back that goes against a
 * wall. A lathe cannot make a flat back, and the flat back is not a detail —
 * it is what gives the object a FRONT, and an object with a front reads as
 * plumbing where a circular one reads as a birdbath. So the row introduces
 * `planSweepGeometry` and `dPlan` instead, and both are in core because the
 * cistern, the bath and the back-to-wall pan all want the same curve. The
 * extrusion helper the catalogue reserves for row 11 is a different thing
 * again: that one runs a fixed section along a straight line.
 *
 * Measured off the reference against a 0.85 m rim height, which is the height
 * a basin is actually fitted at:
 *
 *   width         0.72 of the height
 *   plan depth    0.78 of the width
 *   bowl body     0.28 of the height, the rest is pedestal
 *   pedestal      0.28 of the width at the neck, flaring to 0.31 at the foot
 *   rim shelf     0.15 of the local half-extent, so it is wider at the back
 *                 than at the sides exactly as the photograph's is
 *
 * The bowl is ONE closed profile. It runs from the outer rim edge down the
 * outside, in under the bowl, up the inside to the dish floor, out across it
 * and back over the rim to where it started, so the solid seals itself with no
 * caps at either end. That is also what stops it doing what the vase did
 * before it was bored: a single-sided shell with an open top shows you the
 * inside of its own far wall, which is back-facing, which is culled, which
 * looks like the object has a bite taken out of it.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  createKitModel,
  createTinter,
  dPlan,
  latheGeometry,
  mergeColoured,
  planSweepGeometry,
  smoothNormals,
  type PlanLevel,
} from '../core/index.ts'

export interface PedestalBasinConfig {
  /** Height to the rim (metres). */
  readonly height: number
  /** Width of the bowl across the front (metres). */
  readonly width: number
  /** Sides around the plan. */
  readonly segments: number
  readonly seed: number
}

export const pedestalBasinDefaults: PedestalBasinConfig = {
  // The fitted height for a basin rim, and it is a standard rather than a
  // choice: 0.85 m is what the regulations put it at and what every one in a
  // house is set to.
  height: 0.85,
  width: 0.58,
  segments: 56,
  seed: 12,
}

export type PedestalBasinParts = 'bowl' | 'pedestal' | 'waste'

export function createModel(overrides: Partial<PedestalBasinConfig> = {}) {
  return createKitModel<
    PedestalBasinConfig, 'ceramic' | 'chrome', PedestalBasinParts, Record<string, never>
  >({
    id: 'pedestal-basin',
    defaults: pedestalBasinDefaults,
    slots: ['ceramic', 'chrome'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.05, Math.max(0.6, config.height))
      const W = Math.min(0.9, Math.max(0.35, config.width))
      const segments = Math.max(16, Math.round(config.segments))

      const halfW = W / 2
      const halfD = W * 0.39
      const bowlH = H * 0.28
      const rimY = H
      const bowlBase = rimY - bowlH

      // Glaze is nearly white and very slightly warm, and the deviation has to
      // stay small: two vases' worth of mottle on a surface this large reads
      // as dirt rather than as glaze.
      const glaze = tint('ceramic', 0.02, 0.35)
      const glazeShade = tint('ceramic', -0.05, 0.35)
      /*
       * The back exponent, and it is 4 rather than the helper's default 8.
       *
       * At 8 the back corner turns through most of its angle in about twenty
       * degrees of plan, and a ring of 44 points puts three of them in it: the
       * corner came out as a pair of broad diagonal facets, which is what the
       * critic saw from behind. Four keeps a back that is flat enough to sit
       * against plaster -- 0.84 of full depth at the diagonal against a
       * circle's 0.71 -- and spreads the turn over enough of the ring for the
       * segments to describe it.
       */
      const plan = dPlan(segments, 4)

      /* --------------------------------------------------------------- bowl */
      /**
       * The closed profile, read anticlockwise in section.
       *
       * Two things are going on in every level. `scale` is the multiplier on
       * the plan, so 1 is the rim's outer edge; the shelf is the step from 1.00
       * to 0.85 at the top, and because it is a FRACTION of the local plan
       * extent it comes out 44 mm at the sides and 68 mm at the back, which is
       * the relationship the reference has and would have taken two numbers to
       * write any other way.
       *
       * `shift` is what keeps the BACK FLAT. A basin narrows on three sides as
       * it descends and does not move at all on the fourth, because the fourth
       * is against a wall for its whole height. Scaling alone pulls that plane
       * forward with the rest and the bowl ends up floating off the plaster;
       * `wall()` pins it by pushing each ring back by exactly what the scale
       * took off. Every level below the rim goes through it.
       */
      const rimShift = -W * 0.021
      const wall = (y: number, scale: number): PlanLevel =>
        ({ y, scale, shift: halfD * (1 - scale) })

      /**
       * The interior is NOT pinned to the wall, and that is the whole reason
       * the shelf exists.
       *
       * Pinning both the outer body and the bore to the same back plane makes
       * the rim's back width exactly zero -- the two rings meet there -- and
       * the tap hole then sits over a gap instead of over ceramic. So the bore
       * is a separate shape that happens to live inside the body: its own two
       * scales, and one shift that pushes it forward so the shelf comes out
       * 67 mm at the back and 43 at the front, which is the reference's.
       */
      const dish = (y: number, sx: number, sz: number): PlanLevel =>
        ({ y, scale: sx, scaleZ: sz, shift: rimShift })

      /*
       * Written rim-first because that is the order it is easiest to read and
       * to measure, and then REVERSED before it is swept.
       *
       * The direction matters and it is the same rule `latheGeometry` has
       * always had: a profile is walked from the bottom upward, because that
       * is what puts the outward normal on the outside. Walked the other way
       * every face on the body points inward, back-face culling removes the
       * near wall, and what the render shows is the inside of the far one --
       * which arrives looking like a folded panel with a hole in it, not like
       * a winding fault, and costs an afternoon.
       */
      const rimFirst: PlanLevel[] = [
        { y: rimY, scale: 1 },
        // down the outside: a short vertical face, then the belly, which does
        // not close to a point -- it comes down BROAD and the pedestal tucks
        // under it. Narrowing it to a neck instead left the pedestal's
        // shoulders sticking out from under the bowl in a step.
        wall(rimY - bowlH * 0.1, 0.995),
        wall(rimY - bowlH * 0.34, 0.95),
        wall(rimY - bowlH * 0.58, 0.86),
        wall(rimY - bowlH * 0.78, 0.78),
        wall(rimY - bowlH * 0.92, 0.7),
        /*
         * Where the skirt STOPS, and it is fixed by arithmetic rather than
         * taste.
         *
         * A wall-pinned ring's front edge sits at halfD (1 - 2 s), so it
         * crosses the centre line at s = 0.5 and every ring below that is
         * BEHIND the middle of the basin. The waste is at the dish's centre,
         * a little forward of the middle. Ending the skirt at 0.47 therefore
         * asked the underside to climb from a ring behind the waste to the
         * waste itself, which means travelling FORWARD as it rises: the shell
         * folded over on itself and the render showed a creased panel with a
         * hole in it under the bowl. Nothing about the underside was wrong.
         * The skirt had already swept past the point it had to reach.
         *
         * At 0.58 the front edge is 36 mm forward of centre, the waste is
         * inside that, and every ring of the underside can move backward and
         * inward the whole way up, which is what a shell does.
         */
        wall(bowlBase, 0.62),
        wall(bowlBase - bowlH * 0.04, 0.58),
        // The underside: back, in and up to the waste, monotonic in all three.
        { y: bowlBase + bowlH * 0.02, scale: 0.44, scaleZ: 0.4, shift: halfD * 0.34 },
        { y: bowlBase + bowlH * 0.12, scale: 0.28, scaleZ: 0.25, shift: halfD * 0.2 },
        // The last ring of the underside is CONCENTRIC with the floor of the
        // dish and a little larger, so the shell closes with an even wall all
        // round. Left on its own walk toward the wall it finished off-centre
        // from the floor above it, and the two met in a pinched point that
        // showed under the bowl from behind.
        { y: bowlBase + bowlH * 0.22, scale: 0.32, scaleZ: 0.28, shift: rimShift },
        // the floor of the dish, and it is FLAT and broad
        //
        // Tapered to a near point instead, there was nowhere to put a waste:
        // the grating came out wider than the floor it sat in and vanished
        // into the wall of the bowl. A basin's floor is about a fifth of its
        // width across, which is what a 90 mm waste needs to sit in.
        dish(rimY - bowlH * 0.72, 0.28, 0.24),
        // and out across the dish, which is shallow: a basin you wash your
        // hands in is 130 mm deep, not a bucket
        dish(rimY - bowlH * 0.68, 0.4, 0.35),
        dish(rimY - bowlH * 0.6, 0.52, 0.45),
        dish(rimY - bowlH * 0.42, 0.66, 0.575),
        dish(rimY - bowlH * 0.2, 0.79, 0.7),
        dish(rimY - bowlH * 0.05, 0.843, 0.752),
        dish(rimY, 0.848, 0.757),
        // over the rim and back to the start, which closes the solid
        { y: rimY, scale: 1 },
      ]
      const bowl = [...rimFirst].reverse()
      const bowlPieces: BufferGeometry[] = [
        planSweepGeometry(plan, bowl, [halfW, halfD], [0, 0, 0], glaze, {
          colourTop: glaze,
        }),
      ]

      /* ----------------------------------------------------------- tap hole */
      /**
       * The tap hole and the overflow, and neither is a real hole.
       *
       * Cutting one would need the geometry the kit does not have. What it
       * does have is that a hole is read as a DARK DISC BELOW THE SURFACE, so
       * each is a shallow sunk cylinder in the shade of the glaze with its own
       * floor. At any distance the model is looked at they are holes, and at
       * the one distance they are not, they are recesses, which is what a
       * basin's overflow actually is anyway.
       */
      // Dark enough to read as a shadow rather than as a fitting. At -0.42 it
      // came out a beige disc and the critic called it a raised plug, which is
      // also what the geometry was: its mouth ring stood 0.6 mm PROUD of the
      // shelf. Both are fixed here; a hole is dark and it is below the
      // surface, and either one alone is a stud.
      const dark = tint('ceramic', -0.66, 0.15)
      const tapR = W * 0.038
      // Halfway across the back shelf: between the bore's back edge and the
      // body's, both of which are written above rather than guessed at here.
      const boreBack = rimShift + halfD * 0.757
      bowlPieces.push(latheGeometry([
        { y: rimY - tapR * 0.9, radius: tapR * 0.86 },
        { y: rimY - tapR * 0.25, radius: tapR },
        { y: rimY - 0.0004, radius: tapR },
      ], 14, [0, 0, (boreBack + halfD) / 2], dark, { capBottom: true, capTop: false }))

      // The overflow is in the bore's back wall a little under the rim, which
      // is a point on the same profile: the ring at 0.8 of the bowl height.
      const overflowR = W * 0.023
      const overflowY = rimY - bowlH * 0.2
      bowlPieces.push(latheGeometry([
        { y: -overflowR * 0.8, radius: overflowR * 0.8 },
        { y: -overflowR * 0.2, radius: overflowR },
        { y: -0.0004, radius: overflowR },
      ], 12, [0, 0, 0], dark, { capBottom: true, capTop: false })
        // MINUS a quarter turn. Built opening along +Y and turned the other
        // way, the recess opened into the ceramic behind it instead of into
        // the bowl, so there was nothing to see from any angle -- which is
        // exactly what the critic reported.
        .rotateX(-Math.PI / 2)
        .translate(0, overflowY, rimShift + halfD * 0.7))

      /* ----------------------------------------------------------- pedestal */
      /**
       * The pedestal, and it is NOT under the middle of the bowl.
       *
       * Its back face is flush with the basin's back face, because both are
       * touching the same wall; that puts its centre well behind the bowl's,
       * and its front face at roughly the bowl's centre line, which is where
       * the reference's is. Centring it under the bowl instead leaves a gap
       * behind it that a wall would have to be built into.
       *
       * It is very slightly waisted and flares at the foot, which is the only
       * thing keeping a 0.6 m column from reading as a length of pipe.
       */
      const pedHalfW = W * 0.15
      // Depth is capped by the skirt, not chosen: the skirt's front edge at
      // scale s sits at halfD (1 - 2 s), so anything deeper than s * halfD
      // reaches past it and the pedestal's top corner shows under the bowl.
      // At the skirt's 0.47 that is 0.183 W, and this is just inside it.
      const pedHalfD = W * 0.175
      /*
       * How far up into the bowl the pedestal goes, and it is a MEASUREMENT
       * off the profile above rather than a nice-looking number.
       *
       * The binding direction is Z, not X. The pedestal's back is on the wall
       * plane and so is the bowl's, so what has to be covered is its FRONT
       * face at 0.01 W, and the bowl's front at scale s sits at 0.39 W (1-2s):
       * it only clears the pedestal once s passes 0.49. At 0.16 of the bowl
       * height the ring had closed to 0.29 and the pedestal stood up inside
       * the bowl in plain sight. The bowl's outer surface ends at 0.52, so
       * this is the one height the joint can be at, and it is not a choice.
       */
      const pedTop = bowlBase
      const pedestal: PlanLevel[] = [
        // A rolled foot rather than a cut end: three rings instead of one, so
        // the base has a profile in silhouette instead of an angular corner.
        { y: 0, scale: 0.94 },
        { y: H * 0.004, scale: 0.985 },
        { y: H * 0.014, scale: 1 },
        { y: H * 0.03, scale: 0.982 },
        { y: H * 0.055, scale: 0.94 },
        { y: H * 0.3, scale: 0.925 },
        { y: pedTop - H * 0.05, scale: 0.95 },
        { y: pedTop, scale: 0.99 },
      ]
      const pedestalPieces: BufferGeometry[] = [
        planSweepGeometry(plan, pedestal, [pedHalfW, pedHalfD],
          [0, 0, halfD - pedHalfD], glazeShade,
          { colourTop: glaze, capBottom: true, capTop: true }),
      ]

      /* -------------------------------------------------------------- waste */
      // The chrome grating in the floor of the dish. One disc, and it is the
      // only thing in the model that is not glaze.
      /*
       * The waste, sunk into the floor of the dish rather than sitting on it.
       *
       * Every fitting on this model failed the same way first time: modelled
       * proud, in a colour a shade off the glaze, and therefore invisible in
       * a render of a white object under a white light. A drain is a hole with
       * a bright ring round it, so this is a dark disc a few millimetres down
       * inside a chrome rim, and the darkness is doing the work.
       */
      const wasteY = rimY - bowlH * 0.72
      const wasteR = W * 0.062
      const waste = mergeColoured([
        latheGeometry([
          { y: wasteY - 0.006, radius: wasteR * 0.9 },
          { y: wasteY + 0.0015, radius: wasteR },
          { y: wasteY + 0.0035, radius: wasteR * 0.86 },
        ], 20, [0, 0, rimShift], tint('chrome', -0.02, 0.4), { capBottom: false, capTop: false }),
        latheGeometry([
          { y: wasteY - 0.007, radius: wasteR * 0.78 },
          { y: wasteY, radius: wasteR * 0.8 },
        ], 20, [0, 0, rimShift], tint('chrome', -0.55, 0.2), { capBottom: true, capTop: false }),
      ])

      bakeOcclusion(bowlPieces, { strength: 0.4 })

      return {
        bowl: { slot: 'ceramic' as const, geometry: smoothNormals(mergeColoured(bowlPieces), 50) },
        pedestal: { slot: 'ceramic' as const, geometry: smoothNormals(mergeColoured(pedestalPieces), 50) },
        waste: { slot: 'chrome' as const, geometry: smoothNormals(waste, 35) },
      }
    },
  }, overrides)
}
