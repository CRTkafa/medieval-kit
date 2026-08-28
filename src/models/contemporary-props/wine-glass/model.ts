/**
 * @contemporary-props/wine-glass
 *
 * Second object in the kit, and it is here to prove two things before anything
 * expensive depends on them: wall thickness on a revolve, and the glass slot.
 *
 * The vase got away with a wall of zero thickness because ceramic is opaque
 * and the bore is dark. Glass is not opaque. Look through a wine glass and
 * what you actually see of it is its edges: the bright ellipse of the rim, the
 * disc edge of the foot, and the thick mass where the bowl closes onto the
 * stem. So the bowl here is a real shell: the profile runs UP the outside,
 * steps across the rim, and comes back DOWN the inside to a dished floor that
 * sits well above the outer bottom. That step across the rim is the whole
 * point — a single-surface bowl in a transparent material has a rim one
 * triangle wide, which flickers, and a bowl bottom with nothing in it, which
 * reads as a soap bubble on a stick.
 *
 * One continuous lathe carries foot, stem, bowl and inner surface. Not three
 * stacked pieces, for the reason the lathe exists at all: stacked revolves
 * leave coincident faces where they meet, and in a transparent material every
 * internal face is visible forever.
 *
 * The stem is the hard part of the silhouette. Too thick and the object is a
 * goblet; too thin and at prop distance it disappears and the bowl floats.
 * The config exposes it, clamped to 3.5–8 mm radius, which spans a delicate
 * tasting glass to a sturdy bistro stem and nothing outside what a stem is.
 *
 * The family: bowl radius and rim tuck move it from a wide tucked-in red
 * through a narrower white to a small open port glass; bowl depth against
 * total height trades stem for bowl.
 *
 * Parts: `body` alone. Nothing on a wine glass moves, and slicing one revolve
 * into named thirds would only invent seams.
 */
import { type BufferGeometry } from 'three'

import {
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Level,
} from '../core/index.ts'

export interface WineGlassConfig {
  /** Overall height (metres). */
  readonly height: number
  /** Widest radius of the bowl (metres). */
  readonly bowlRadius: number
  /** Bowl height as a fraction of the overall height. */
  readonly bowlFraction: number
  /** Rim radius as a fraction of the bowl radius. Low values tuck the rim in. */
  readonly rim: number
  /** Stem radius (metres). The goblet/disappearing line is clamped at both ends. */
  readonly stemRadius: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const wineGlassDefaults: WineGlassConfig = {
  height: 0.215,
  bowlRadius: 0.044,
  // Just under half. More bowl than this reads as a brandy balloon, more stem
  // reads as laboratory glassware.
  bowlFraction: 0.48,
  rim: 0.68,
  stemRadius: 0.0045,
  segments: 40,
  seed: 7,
}

export type WineGlassParts = 'body'

export function createModel(overrides: Partial<WineGlassConfig> = {}) {
  return createKitModel<WineGlassConfig, 'glass', WineGlassParts>({
    id: 'wine-glass',
    defaults: wineGlassDefaults,
    slots: ['glass'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

      const H = clamp(config.height, 0.12, 0.3)
      const bowlR = clamp(config.bowlRadius, 0.025, Math.min(0.065, H * 0.42))
      const bowlH = H * clamp(config.bowlFraction, 0.32, 0.62)
      const rimR = bowlR * clamp(config.rim, 0.52, 0.95)
      // The stem is clamped twice: absolutely, and against the bowl. The
      // absolute clamp keeps it a stem at all; the relative one stops a small
      // glass given a fat stem turning into a candlestick, which is exactly
      // what the first render of that corner was.
      const stemR = clamp(config.stemRadius, 0.0035, Math.min(0.008, bowlR * 0.2))
      // The foot follows the bowl rather than being free: a foot wider than
      // the bowl is a cake stand, a foot narrower than three stem widths falls
      // over in the hand and in the eye.
      const footR = Math.max(bowlR * 0.78, stemR * 3)
      // Wall thickness scales gently with the bowl so a big balloon does not
      // end up with cigarette-paper walls, floored where thinner would vanish.
      const wall = Math.max(0.0016, bowlR * 0.042)
      const bowlBaseY = H - bowlH

      /**
       * Outer bowl profile, u = 0 at the stem junction, 1 at the rim.
       * Below the belly an eased sine gives the rounded bottom; above it a
       * cosine ease tucks the wall back in toward the rim, with a nonzero
       * slope at the top so the rim tilts slightly inward like a red should.
       */
      const bellyU = 0.45
      const rOut = (u: number): number =>
        u <= bellyU
          ? bowlR * Math.sin((u / bellyU) * (Math.PI / 2)) ** 0.8
          : rimR + (bowlR - rimR) * Math.cos(((u - bellyU) / (1 - bellyU)) * (Math.PI / 2)) ** 1.35
      const yAt = (u: number): number => bowlBaseY + bowlH * u

      // The foot's vertical build scales with the glass: fixed heights that
      // look right on a 21 cm red are a bell jar on a 12 cm port glass.
      const fs = clamp(H / 0.215, 0.65, 1.15)
      // Stem levels are fractions of the run between foot and bowl, so a short
      // glass with a deep bowl cannot fold the stem back through the foot.
      const footTipY = 0.0165 * fs
      const s = (t: number): number => footTipY + (bowlBaseY - footTipY) * t

      const levels: Level[] = [
        // Foot: a disc with a rolled edge, rising as a shallow dome. The edge
        // band is what the eye gets of the foot through the glass above it.
        { y: 0, radius: footR * 0.985 },
        { y: 0.0018 * fs, radius: footR },
        { y: 0.0032 * fs, radius: footR * 0.94 },
        { y: 0.007 * fs, radius: footR * 0.5 },
        { y: 0.0125 * fs, radius: Math.max(footR * 0.2, stemR * 1.9) },
        { y: footTipY, radius: stemR * 1.5 },
        // Stem: a hair of entasis. Dead straight looks extruded; the swell at
        // the top is where the pull into the bowl begins.
        { y: s(0.22), radius: stemR * 1.06 },
        { y: s(0.6), radius: stemR * 0.94 },
        { y: s(0.93), radius: stemR * 1.05 },
        // Bowl, outside, base to rim. The lowest samples are floored at the
        // stem radius: on a squat bowl the raw curve starts below the stem and
        // the profile pinches in before flaring, which reads as a crack.
        { y: yAt(0.03), radius: Math.max(rOut(0.03), stemR * 1.2) },
        { y: yAt(0.07), radius: Math.max(rOut(0.07), stemR * 1.45) },
        { y: yAt(0.13), radius: rOut(0.13) },
        { y: yAt(0.21), radius: rOut(0.21) },
        { y: yAt(0.31), radius: rOut(0.31) },
        { y: yAt(bellyU), radius: bowlR },
        { y: yAt(0.57), radius: rOut(0.57) },
        { y: yAt(0.7), radius: rOut(0.7) },
        { y: yAt(0.82), radius: rOut(0.82) },
        { y: yAt(0.92), radius: rOut(0.92) },
        { y: H, radius: rimR },
        // The rim: two levels at the same height, one wall thickness apart.
        // The quad between them is the flat annulus that carries the whole
        // top of the silhouette.
        { y: H, radius: rimR - wall },
        // Inside, descending. Same profile inset by the wall, stopped short of
        // the bottom so the bowl closes onto a solid mass above the stem.
        { y: yAt(0.92), radius: rOut(0.92) - wall },
        { y: yAt(0.8), radius: rOut(0.8) - wall },
        { y: yAt(0.66), radius: rOut(0.66) - wall },
        { y: yAt(0.52), radius: rOut(0.52) - wall },
        { y: yAt(bellyU), radius: bowlR - wall },
        { y: yAt(0.36), radius: rOut(0.36) - wall },
        { y: yAt(0.27), radius: rOut(0.27) - wall },
        { y: yAt(0.2), radius: rOut(0.2) - wall },
        // Dished floor, then the cap closes it. Its height above the outer
        // base is the thick lens of glass every stemmed glass has where the
        // bowl was gathered onto the stem, and it is the third edge (after
        // rim and foot) that makes transparent glass readable.
        { y: yAt(0.13), radius: bowlR * 0.16 },
      ]

      const pieces: BufferGeometry[] = [
        latheGeometry(
          levels,
          Math.max(12, Math.round(config.segments)),
          [0, 0, 0],
          tint('glass', jitter(random, 0.02)),
          // Slightly lighter along the run of the profile, which ends on the
          // inner surface: light collects in the bowl rather than on the foot.
          { colourTop: tint('glass', 0.05), capBottom: true, capTop: true },
        ),
      ]

      // 40 degrees: the walls and the stem are curves and smooth out, while
      // the rim annulus, the foot edge and the floor cap all turn through
      // close to a right angle and keep their edges — and on glass the edges
      // are the object.
      return {
        body: { slot: 'glass' as const, geometry: smoothNormals(mergeColoured(pieces), 40) },
      }
    },
  }, overrides)
}
