/**
 * @contemporary-props/stockpot
 *
 * The kit's first metal vessel, and it exists to settle three details that
 * every metal vessel afterwards reuses: the rolled rim, the riveted lug, and
 * the separable sit-in lid.
 *
 * The rolled rim is the whole read. A pot without one is a cylinder, so the
 * rim here is a real curl: the profile reaches the top of the wall and then
 * travels 280 degrees around a small circle — down into the crevice under the
 * roll, out, over the top, and back in — before tucking into the bore. That
 * traversal direction is not decorative: the lathe orients faces by which way
 * the profile walks (up gives outward, out gives down, down gives inward), so
 * a curl sampled the obvious way, straight over the top from the wall, comes
 * out inside-out on its underside. Walking the circle in one consistent sense
 * keeps every face of the curl pointing at the air it actually touches.
 *
 * Unlike the vase, the pot models a short bore: a real interior wall drops
 * from inside the rim to a false floor at 42% of the height. The vase never
 * shows its inside; this object's one action is lifting the lid off, and an
 * open pot that is a hollow shell with the world visible through it is worse
 * than any number of extra triangles. The floor is deep enough to sit in
 * occlusion shadow and shallow enough that nothing pays for the part of the
 * bore no camera reaches.
 *
 * The lid is one profile too: a flange that drops inside the mouth (a lid
 * that merely rests on top reads as a plate), a step that seats on the rim, a
 * rolled edge matching the pot's, a dome, and the knob — stem, flare, cap —
 * continued from the same curve so the whole lid is a single connected solid.
 * The knob keeps a fixed hand size rather than scaling with the pot, for the
 * same reason the lugs do: hands do not scale with cookware.
 *
 * Each lug is a strap loop swept as a square-section arc, tilted up 25
 * degrees and standing about 30mm clear of the wall so a hand fits, with both
 * ends buried inside a chamfered mounting plate that is itself embedded into
 * the wall. The rivet heads sit over the buried strap ends, which is where a
 * rivet would actually be.
 *
 * One slot, `stainless`, everywhere. A stainless stockpot really is one
 * material; the lugs and rivets separate from the body by tint and by the
 * occlusion crevices around the plate, not by a material change.
 *
 * Parts: `body` and `lid`. The lid's anchor sits at the rim plane, so
 * `liftLid` is a straight translation and anything the consumer stood on the
 * lid rises with it.
 */
import { type BufferGeometry } from 'three'

import {
  arcBarGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Level,
} from '../core/index.ts'

export interface StockpotConfig {
  /** Body outer diameter (metres). */
  readonly diameter: number
  /** Body height to the rim (metres). The lid and knob add to it. */
  readonly height: number
  /** Lid dome rise as a fraction of the body radius. Low is a saucepot lid, high a casserole. */
  readonly lidDome: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const stockpotDefaults: StockpotConfig = {
  // A 26 x 24 cm pot, roughly eleven litres: unmistakably a stockpot rather
  // than a saucepan, and still a size that exists in an ordinary kitchen.
  diameter: 0.26,
  height: 0.24,
  lidDome: 0.16,
  segments: 48,
  seed: 7,
}

export type StockpotParts = 'body' | 'lid'

export interface StockpotActions {
  /** Lifts the lid clear of the rim, or seats it again. No argument toggles. */
  liftLid(lifted?: boolean): void
}

const clampDiameter = (v: number): number => Math.min(0.4, Math.max(0.14, v))
const clampHeight = (v: number): number => Math.min(0.36, Math.max(0.1, v))

const deg = (d: number): number => (d * Math.PI) / 180

export function createModel(overrides: Partial<StockpotConfig> = {}) {
  return createKitModel<StockpotConfig, 'stainless', StockpotParts, StockpotActions>({
    id: 'stockpot',
    defaults: stockpotDefaults,
    slots: ['stainless'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const R = clampDiameter(config.diameter) / 2
      const H = clampHeight(config.height)
      const segments = Math.max(16, Math.round(config.segments))
      // Roll radius: scales gently with the pot but stays in the few-millimetre
      // band a pressed rim actually has. Bigger and the rim reads as a pipe
      // welded on; smaller and it vanishes at prop distance.
      const rr = Math.min(0.0045, Math.max(0.002, R * 0.026))
      const wall = 0.004
      const bore = R - wall
      const floorY = H * 0.42

      const steel = tint('stainless', jitter(random, 0.02))

      /* ------------------------------------------------------------- body */

      const bodyLevels: Level[] = [
        { y: 0, radius: R * 0.96 },
        // A short chamfer off the table, then the wall. Stockpot walls are
        // straight; the character lives entirely at the top.
        { y: 0.006, radius: R },
        { y: H * 0.45, radius: R },
        // Tangent point where the wall meets the roll.
        { y: H - rr, radius: R },
      ]
      // The curl, walked in increasing angle so every face points outward:
      // under the roll (200-280), out and over the top (280-450), back in
      // toward the mouth (450-480).
      for (let a = 200; a <= 480; a += 40) {
        bodyLevels.push({
          y: H - rr + Math.sin(deg(a)) * rr,
          radius: R + rr + Math.cos(deg(a)) * rr,
        })
      }
      bodyLevels.push(
        // Tuck from the inner lip into the bore, then the false floor.
        { y: H - rr * 0.8, radius: bore },
        { y: floorY + 0.005, radius: bore },
        { y: floorY, radius: bore - 0.004 },
      )

      const pieces: BufferGeometry[] = [
        latheGeometry(bodyLevels, segments, [0, 0, 0], steel, {
          capBottom: true,
          capTop: true, // the false floor, facing up inside the bore
        }),
      ]

      /* ------------------------------------------------------------- lugs */

      const ra = 0.021 + R * 0.024           // loop radius: mostly hand, a little pot
      const bar = 0.009                      // strap section; thinner reads as wire
      const tilt = deg(18)
      const lugY = Math.min(H - 0.03, H * 0.8)
      // Ends of the 260-degree arc sit at (±cos40, -sin40) of the loop's local
      // frame; the centre is placed so those ends land just outside the wall
      // surface, buried inside the plate.
      const endIn = Math.sin(deg(40)) * ra * Math.cos(tilt)
      const endDown = Math.sin(deg(40)) * ra * Math.sin(tilt)
      const plateW = 0.046 + R * 0.04
      const plateH = 0.032

      for (const spin of [0, Math.PI]) {
        const loop = arcBarGeometry(ra, bar, deg(-40), deg(220), 20, [0, 0, 0],
          tint('stainless', 0.01))
        // Built in XY with the bulge up: turn the spread onto the tangent (Z),
        // then lean the bulge out and 18 degrees above horizontal.
        loop.rotateY(-Math.PI / 2)
        loop.rotateZ(tilt - Math.PI / 2)
        loop.translate(R + 0.001 + endIn, lugY, 0)
        loop.rotateY(spin)
        pieces.push(loop)

        // Mounting plate, embedded 5mm into the wall so its corners cannot
        // daylight on a small pot where the flat plate leaves the curve.
        const plate = chamferedBoxGeometry([0.01, plateW], [0.01, plateW], plateH,
          0.0012, [R + 0.001, lugY, 0], tint('stainless', -0.03))
        plate.rotateY(spin)
        pieces.push(plate)

        // Rivet heads on the plate's lower half, clear of the strap, where the
        // rivets that hold the plate to the wall actually sit. Under the strap
        // ends they exist but cannot be seen, which is the same as not existing.
        for (const side of [-1, 1]) {
          const rivet = latheGeometry([
            { y: 0, radius: 0.005 },
            { y: 0.0024, radius: 0.0041 },
            { y: 0.0038, radius: 0.0018 },
          ], 10, [0, 0, 0], tint('stainless', -0.06))
          rivet.rotateZ(-Math.PI / 2)
          rivet.translate(R + 0.0045, lugY - 0.009, side * 0.011)
          rivet.rotateY(spin)
          pieces.push(rivet)
        }
      }

      /* -------------------------------------------------------------- lid */

      const flange = bore - 0.0008
      const domeH = R * Math.min(0.22, Math.max(0.04, config.lidDome))
      const knobBase = 0.007 + domeH
      const lidLevels: Level[] = [
        // Flange: drops inside the mouth. Its bottom is capped so the lifted
        // lid shows a closed underside rather than a hollow shell.
        { y: -0.011, radius: flange * 0.9 },
        { y: -0.008, radius: flange },
        { y: -0.0005, radius: flange },
        // Seat step: walked outward, so it faces DOWN onto the rim.
        { y: 0.0008, radius: R + rr * 1.4 },
        // Rolled lid edge, matching the pot's roll in reach.
        { y: 0.0035, radius: R + rr * 2 },
        { y: 0.006, radius: R + rr * 1.2 },
      ]
      // The dome is an elliptical arc, not straight lines to the knob: three
      // linear levels read as a tent at any dome height worth having.
      for (const phi of [18, 36, 54, 72, 84]) {
        lidLevels.push({
          y: 0.006 + Math.sin(deg(phi)) * domeH,
          radius: Math.cos(deg(phi)) * (R + rr * 1.2),
        })
      }
      lidLevels.push(
        // Knob: fixed hand size, continued from the same profile.
        { y: knobBase + 0.001, radius: 0.0065 },
        { y: knobBase + 0.014, radius: 0.0065 },
        { y: knobBase + 0.02, radius: 0.0125 },
        { y: knobBase + 0.024, radius: 0.0125 },
        { y: knobBase + 0.0265, radius: 0.0075 },
        { y: knobBase + 0.028, radius: 0.003 },
      )

      const lid = latheGeometry(lidLevels, segments, [0, 0, 0],
        tint('stainless', jitter(random, 0.02)), { capBottom: true, capTop: true })

      // Smoothed at 40 degrees: the drum, the curl and the dome read as the
      // pressed surfaces they are, while the strap's square section, the rim
      // crevice, the seat step and every chamfer turn harder than that and
      // survive as edges.
      return {
        body: { slot: 'stainless' as const, geometry: smoothNormals(mergeColoured(pieces), 40) },
        lid: {
          slot: 'stainless' as const,
          geometry: smoothNormals(mergeColoured([lid]), 40),
          // Anchor at the rim plane: geometry is seat-relative, so lifting the
          // lid is a translation of the anchor and nothing else.
          origin: [0, H, 0] as const,
        },
      }
    },

    actions: ({ parts, getConfig }) => {
      let lifted = false
      return {
        liftLid(next?: boolean): void {
          lifted = next ?? !lifted
          const c = getConfig()
          parts.lid.anchor.position.y =
            clampHeight(c.height) + (lifted ? clampDiameter(c.diameter) * 0.55 : 0)
        },
      }
    },
  }, overrides)
}
