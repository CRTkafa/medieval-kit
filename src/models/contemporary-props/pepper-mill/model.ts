/**
 * @contemporary-props/pepper-mill
 *
 * Table pepper mill: the longest profile in the kit at the lowest cost, and
 * the first radial cut.
 *
 * SECOND VERSION, and the first one built against a photograph. The first was
 * a turned baluster: a drum, a cove into a waist, a swell back out and a domed
 * head, with the flutes doing the work of telling you it was not a chess
 * piece. It was a good bottle. What a present-day mill actually is, is a
 * STRAIGHT tube: one cylinder from the collar to the flat top, a polished
 * steel ring at the base, a band of vertical flutes cut around the middle for
 * grip, a flat top and a small knurled steel knob. There is no waist and there
 * is no dome, and the profile that has neither is both simpler and right.
 *
 * The flute band is the model's reason for being fourth in the build order:
 * the catalogue's row for it reads "the flute grip is the first radial cut",
 * and everything after it that arrays anything around an axis copies what
 * happens here. So the band is not decoration and must not be optional in the
 * sense of being absent by default.
 *
 * The band is a RECESS with ribs standing back out of it, not ribs stuck on a
 * plain tube. Two things follow from that and both are visible. The rib ends
 * terminate against the step at either end of the recess instead of stopping
 * in mid-air, which is what a machined flute does. And the ribs stay under the
 * tube's own radius, so the silhouette of the mill is a clean cylinder and the
 * flutes read from shading rather than from a bumpy outline.
 *
 * Proportions are measured, not chosen: the reference is 3.6 diameters tall,
 * the steel collar takes the bottom 0.12 of it and the flute band runs from
 * 0.31 to 0.79 of the tube. The band is nearly half the height, which is far
 * more than it looks like it should be until it is drawn at anything less.
 *
 * Parts: `body` and `cap`. The cap is its own part with its origin at the seat
 * so `cap.anchor.rotation.y` is the grinding action. A smooth head would turn
 * invisibly, so the knurl on the knob is what carries the motion.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Level,
} from '../core/index.ts'

export interface PepperMillConfig {
  /** Overall height, knob included (metres). */
  readonly height: number
  /** Radius of the tube (metres). */
  readonly baseRadius: number
  /** How deep the flute band is cut, as a fraction of the radius. */
  readonly bandDepth: number
  /** Centre of the flute band, as a fraction of the tube's height. */
  readonly bandAt: number
  /** Number of grip flutes around the band. */
  readonly flutes: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const pepperMillDefaults: PepperMillConfig = {
  height: 0.23,
  // 3.65 diameters tall, which is what the reference measures. The first
  // version was 3.8 and the difference is not the point: the point is that
  // this one is a tube and that one was a baluster.
  baseRadius: 0.0315,
  bandDepth: 0.075,
  bandAt: 0.55,
  // The reference carries about forty and forty is wrong here, which is the
  // difference between copying a photograph and reading one. At prop scale a
  // mill is a hundred and fifty pixels wide, half of them facing the camera:
  // forty ribs is four pixels each and the band turns into a grey smear.
  // Twenty-two is the same object at the size it is actually seen.
  flutes: 22,
  segments: 40,
  seed: 23,
}

export type PepperMillParts = 'body' | 'cap'

export interface PepperMillActions {
  /** Turns the cap — the grind. Default is a sixth of a turn. */
  twist(radians?: number): void
}

export function createModel(overrides: Partial<PepperMillConfig> = {}) {
  return createKitModel<PepperMillConfig, 'wood' | 'stainless', PepperMillParts, PepperMillActions>({
    id: 'pepper-mill',
    defaults: pepperMillDefaults,
    slots: ['wood', 'stainless'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(0.45, Math.max(0.12, config.height))
      // The radius is clamped against the height, not just on its own: a mill
      // is between roughly two and six diameters tall. Outside that band the
      // squat end turns into a jar and the thin end into a taper candle.
      const R = Math.min(H * 0.21, Math.max(H * 0.08, Math.min(0.05, Math.max(0.015, config.baseRadius))))
      const segments = Math.max(12, Math.round(config.segments))
      const flutes = Math.max(12, Math.min(64, Math.round(config.flutes)))
      const bandDepth = Math.min(0.12, Math.max(0.02, config.bandDepth))
      const bandAt = Math.min(0.72, Math.max(0.38, config.bandAt))

      /* ------------------------------------------------------------ layout */
      // Read bottom up, all as fractions of the whole height: the steel collar
      // covers the grinder housing, the tube runs to the seat, the cap disc
      // sits on the seat and the knob stands on the disc.
      const collarH = H * 0.12
      const knobH = H * 0.042
      const capDisc = H * 0.028
      const seat = H - knobH - capDisc
      const bodyH = seat

      const bandHalf = bodyH * 0.24
      const bandLo = bodyH * bandAt - bandHalf
      const bandHi = bodyH * bandAt + bandHalf
      const recessR = R * (1 - bandDepth)

      /* -------------------------------------------------------------- tube */
      // A step at each end of the recess rather than a ramp: the flutes have
      // to stop against something, and on the reference they stop against a
      // machined shoulder you can see the shadow of.
      const bodyLevels: Level[] = [
        { y: 0, radius: R },
        { y: bandLo - 0.0008, radius: R },
        { y: bandLo, radius: recessR },
        { y: bandHi, radius: recessR },
        { y: bandHi + 0.0008, radius: R },
        { y: bodyH - 0.0012, radius: R },
        // The top edge is broken, not sharp: a tube cut off square catches a
        // white line along its rim from every angle.
        { y: bodyH, radius: R * 0.988 },
      ]

      const woodBase = tint('wood', jitter(random, 0.02))
      const pieces: BufferGeometry[] = [
        latheGeometry(bodyLevels, segments, [0, 0, 0], woodBase, {
          colourTop: tint('wood', 0.035),
          capBottom: true,
          capTop: true,
        }),
      ]

      /* ------------------------------------------------------------ flutes */
      // The ribs come back out of the recess and stop just under the tube's
      // own flats. Under, not level: a revolve of `segments` sides has its
      // faces at R·cos(pi/segments), and a rib reaching exactly that height
      // fights the flat it is sitting on.
      const inscribed = Math.cos(Math.PI / segments)
      const ribOuter = R * inscribed * 0.99
      const ribDepth = Math.max(0.0004, ribOuter - recessR)
      // Nearly touching: the grip reads from the narrow dark gaps between the
      // ribs, not from the ribs themselves.
      // 0.78 of the pitch: wide ribs and narrow grooves, the way a machined
      // grip goes. At 0.66 the lit faces came out narrower than the shadows
      // between them and the band read as a picket fence.
      const ribWidth = Math.min((2 * Math.PI * recessR) / flutes * 0.78, R * 0.2)
      const ribCentre = recessR + ribDepth / 2

      for (let i = 0; i < flutes; i += 1) {
        const angle = (i / flutes) * Math.PI * 2
        const rib = chamferedBoxGeometry(
          [ribWidth, ribDepth],
          [ribWidth, ribDepth],
          bandHi - bandLo,
          Math.min(0.0005, ribWidth * 0.22),
          [0, 0, 0],
          // Turned from the same blank as the tube, so they may not jump in
          // tone. Relief and occlusion carry them.
          tint('wood', jitter(random, 0.012)),
        )
        rib.rotateY(angle)
        rib.translate(
          Math.sin(angle) * ribCentre,
          (bandLo + bandHi) / 2,
          Math.cos(angle) * ribCentre,
        )
        pieces.push(rib)
      }

      /**
       * Darken what the ribs shade, before anything is merged.
       *
       * Vertical ribs on a vertical tube are the one case where relief alone
       * does nothing: every rib and every groove between them faces the light
       * at the same angle, so a band with a millimetre and a half of real
       * relief still rendered as pale stripes. What separates them on the
       * reference is not the highlight, it is the dark in the bottom of each
       * groove. This is the kit's first use of it and it is the reason the
       * band reads at all.
       */
      bakeOcclusion(pieces, { strength: 0.5 })

      /* ------------------------------------------------------------ collar */
      // Proud of the tube by a hair, which is what makes it read as a ring
      // fitted over the bottom rather than as a painted stripe.
      const collarLevels: Level[] = [
        { y: 0, radius: R * 0.985 },
        { y: 0.0012, radius: R * 1.012 },
        { y: collarH - 0.0012, radius: R * 1.012 },
        { y: collarH, radius: R * 0.998 },
      ]
      pieces.push(latheGeometry(
        collarLevels, segments, [0, 0, 0],
        tint('stainless', jitter(random, 0.02), 0.5),
        { colourTop: tint('stainless', 0.03, 0.5), capBottom: true },
      ))

      /* --------------------------------------------------------------- cap */
      // Everything below is LOCAL to the seat: the part's origin sits there so
      // rotation.y grinds.
      const discLevels: Level[] = [
        { y: 0, radius: R * 0.985 },
        { y: 0.0008, radius: R },
        { y: capDisc - 0.0012, radius: R },
        { y: capDisc, radius: R * 0.988 },
      ]
      const disc = latheGeometry(discLevels, segments, [0, 0, 0], tint('wood', jitter(random, 0.02)), {
        colourTop: tint('wood', 0.05),
        capBottom: true,
        capTop: true,
      })

      // The knurled knob. Its sides are a radial array too, at a pitch fine
      // enough to read as knurling rather than as a nut, and it is the only
      // thing on the mill whose rotation is visible.
      const knobR = R * 0.28
      const knurl = Math.max(10, Math.round(knobR / R * 40))
      const knobLevels: Level[] = [
        { y: capDisc - 0.002, radius: knobR * 0.55 },
        { y: capDisc + 0.0015, radius: knobR },
        { y: capDisc + knobH * 0.82, radius: knobR },
        { y: capDisc + knobH * 0.93, radius: knobR * 0.86 },
        { y: capDisc + knobH, radius: knobR * 0.62 },
      ]
      const knob = latheGeometry(
        knobLevels, knurl, [0, 0, 0],
        tint('stainless', jitter(random, 0.02), 0.5),
        { colourTop: tint('stainless', 0.05, 0.5), capBottom: true, capTop: true },
      )

      // 40 degrees: the revolve smooths, and the collar step, the recess
      // shoulders, the rib chamfers and the knurl facets all turn harder than
      // that and stay edges.
      return {
        body: {
          slot: 'wood' as const,
          geometry: smoothNormals(mergeColoured(pieces.slice(0, pieces.length - 1)), 40),
          extras: [{
            slot: 'stainless' as const,
            geometry: smoothNormals(mergeColoured([pieces[pieces.length - 1]!]), 30),
          }],
        },
        cap: {
          slot: 'wood' as const,
          geometry: smoothNormals(mergeColoured([disc]), 40),
          extras: [{ slot: 'stainless' as const, geometry: smoothNormals(mergeColoured([knob]), 30) }],
          origin: [0, seat, 0] as const,
        },
      }
    },

    actions: ({ parts }) => ({
      twist: (radians = Math.PI / 3) => {
        parts.cap.anchor.rotation.y += radians
      },
    }),
  }, overrides)
}
