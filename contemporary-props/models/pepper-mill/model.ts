/**
 * @contemporary-props/pepper-mill
 *
 * Table pepper mill: the longest profile curve in the kit at the lowest cost,
 * and the first radial cut.
 *
 * The body is one lathe and the whole object is decided by where that curve
 * turns. Reading from the table up: a drum for the grinder housing, a turn
 * inward to the waist, a swell back out to an upper belly that stays narrower
 * than the base, then a quick fall into the neck the cap sits over. The upper
 * belly NARROWER than the base is the load-bearing choice: make them equal and
 * the silhouette is a baluster, make the top wider and it is a chess queen
 * about to tip over.
 *
 * The flutes are what stop it reading as a chess piece even so. A lathe cannot
 * cut a groove, so the grip is built the other way round: a radial array of
 * slim chamfered bars standing a millimetre proud of the waist. Because the
 * waist is the narrowest point of the profile, a straight vertical bar held at
 * a fixed radius is proud exactly in the middle and sinks into the body at
 * both ends on its own — no cap, no fade, both ends terminate inside the
 * solid. The proud height is recomputed against the actual profile for every
 * configuration, so a fat waist under a low bulge cannot push a bar end
 * through the surface.
 *
 * Parts: `body` and `cap`. The cap is its own part with its origin at the seat
 * so `cap.anchor.rotation.y` is the grinding action, and the `twist` action
 * does exactly that. A turned dome is rotationally invisible, so the motion is
 * carried by the crown: the stainless finial nut is a 6-segment lathe — a hex
 * acorn — and its facets are what you see move.
 */
import { type BufferGeometry } from 'three'

import {
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
  /** Overall height, finial included (metres). */
  readonly height: number
  /** Radius of the base drum (metres). */
  readonly baseRadius: number
  /** Waist radius as a fraction of the base radius. */
  readonly waist: number
  /** Where the waist sits, as a fraction of the body height. */
  readonly waistAt: number
  /** Number of grip flutes around the waist. */
  readonly flutes: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const pepperMillDefaults: PepperMillConfig = {
  height: 0.28,
  baseRadius: 0.03,
  // The waist is what separates a mill from a rolling pin. Below ~0.5 it
  // reads as an hourglass, above ~0.7 the profile goes straight. Measured
  // against the reference this one was already right: 58% against its 60%.
  waist: 0.58,
  waistAt: 0.55,
  // NONE by default, because the reference has none. See the header: the
  // flutes were carrying an argument the proportions should have been making.
  flutes: 0,
  segments: 32,
  seed: 23,
}

export type PepperMillParts = 'body' | 'cap'

export interface PepperMillActions {
  /** Turns the cap — the grind. Default is a sixth of a turn. */
  twist(radians?: number): void
}

/** Linear read of a lathe profile at an arbitrary height. */
function radiusAt(levels: readonly Level[], y: number): number {
  if (y <= levels[0]!.y) return levels[0]!.radius
  for (let i = 0; i < levels.length - 1; i += 1) {
    const a = levels[i]!
    const b = levels[i + 1]!
    if (y <= b.y) {
      const t = (y - a.y) / Math.max(1e-9, b.y - a.y)
      return a.radius + t * (b.radius - a.radius)
    }
  }
  return levels.at(-1)!.radius
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
      // squat end turns into a jar on a pedestal and the thin end into a
      // taper candle, and both were seen in a render before this clamp.
      const R = Math.min(H * 0.21, Math.max(H * 0.08, Math.min(0.05, Math.max(0.015, config.baseRadius))))
      const segments = Math.max(12, Math.round(config.segments))
      const waistFraction = Math.min(0.68, Math.max(0.45, config.waist))
      const waistAt = Math.min(0.6, Math.max(0.42, config.waistAt))
      // 0 is a real answer, not a floor to clamp away: a plain turned mill is
      // the common one, and the slider could not reach it.
      const wanted = Math.round(config.flutes)
      const flutes = wanted <= 0 ? 0 : Math.max(8, Math.min(28, wanted))

      // The cap takes the top ~16% of the height and overlaps the neck by a
      // few millimetres, so the parting line is a step rather than a seam of
      // two coplanar rings.
      const bodyH = H * 0.84
      const seat = bodyH - 0.004

      const W = R * waistFraction
      const waistY = bodyH * waistAt
      // The grip is a band, not a point: the waist holds its radius for a
      // stretch so the flutes sit on something, and the cove into and out of
      // it is what makes the profile a mill rather than a bottle.
      const bandHalf = bodyH * 0.09
      // The upper belly is clearly SMALLER than the drum: the masses must
      // step down going up — drum, belly, head — or the object turns into a
      // chess bishop. It still follows the waist up when the waist is fat, so
      // the swell never dips below the flute tops.
      // 0.83 of the drum, measured off the reference: the shaft under the head
      // comes back out almost to the collar's width. At 0.72 the top half was
      // a neck, and a body that only ever narrows going up is a bottle.
      const upperR = R * Math.max(0.83, waistFraction * 1.2)
      // The swell carries almost to the top. Stopping it at 0.74 left a
      // quarter of the shaft to fall away into a neck, and a body that only
      // narrows going up is a bottle whatever is standing on it.
      const upperY = bodyH * 0.86

      /* ------------------------------------------------------------- body */
      const waistLo = waistY - bandHalf
      const waistHi = waistY + bandHalf
      // The shoulder backs off when the waist sits low, so the cove into the
      // grip keeps some run and the drum does not turn into a pedestal.
      const shoulderY = Math.min(bodyH * 0.3, waistLo - bodyH * 0.08)
      const drumTop = shoulderY - bodyH * 0.1
      const bodyLevels: Level[] = [
        { y: 0, radius: R * 0.97 },
        // Crisp foot, same reasoning as the vase: the profile must leave the
        // table vertically or the mill looks like it is sinking into it.
        { y: 0.005, radius: R },
        // The grinder drum: a near-cylinder, because that is the one straight
        // stretch a mill has and softening it is what turned the first render
        // into a crayon.
        { y: drumTop, radius: R * 0.985 },
        { y: shoulderY, radius: R * 0.93 },
        { y: (shoulderY + waistLo) / 2, radius: ((R * 0.93 + W) / 2) * 1.015 },
        { y: waistLo, radius: W * 1.01 },
        { y: waistY, radius: W },
        { y: waistHi, radius: W * 1.01 },
        // The rise off the grip band is deliberately quick, so the flute bar
        // ends go under the surface within a couple of millimetres.
        { y: waistHi + (upperY - waistHi) * 0.4, radius: ((W + upperR) / 2) * 1.02 },
        { y: upperY, radius: upperR },
        { y: bodyH * 0.95, radius: upperR * 0.99 },
        // The neck is a hair narrower than the shaft and nothing more. The
        // cap's lip steps out OVER it, so the parting line is a groove; the
        // reference has no throat at all and the one here was 0.52 R, which
        // is what made the head read as a stopper on a bottle.
        { y: bodyH, radius: R * 0.78 },
      ]

      const woodBase = tint('wood', jitter(random, 0.02))
      const pieces: BufferGeometry[] = [
        latheGeometry(bodyLevels, segments, [0, 0, 0], woodBase, {
          colourTop: tint('wood', 0.04),
          capBottom: true,
          capTop: true,
        }),
      ]

      /* ----------------------------------------------------------- flutes */
      // Half the vertical span of a flute bar: the grip band plus enough of
      // the cove beyond it for the profile to rise over the bar ends.
      const fluteHalf = bodyH * 0.13
      // How far a bar stands proud of the waist. Capped by the profile: the
      // bar ends must stay under the surface, including the flat-to-flat
      // shrink of the revolve's polygon.
      const inscribed = Math.cos(Math.PI / segments)
      const endRadius = Math.min(
        radiusAt(bodyLevels, waistY - fluteHalf),
        radiusAt(bodyLevels, waistY + fluteHalf),
      ) * inscribed
      const proud = Math.max(0.0005, Math.min(R * 0.04, endRadius - W - 0.0005))
      const depth = R * 0.22
      // Nearly touching: the grip reads from the narrow dark gaps between
      // ridges, not from the ridges themselves.
      const barWidth = Math.min((2 * Math.PI * W) / flutes * 0.72, R * 0.2)
      const barCentreRadius = W + proud - depth / 2

      for (let i = 0; i < flutes; i += 1) {
        const angle = (i / flutes) * Math.PI * 2
        const bar = chamferedBoxGeometry(
          [barWidth, depth],
          [barWidth, depth],
          fluteHalf * 2,
          Math.min(0.0008, barWidth * 0.25),
          [0, 0, 0],
          // Subtle: the flutes are turned from the same blank as the body,
          // so they may not jump in tone. Relief and occlusion carry them.
          tint('wood', jitter(random, 0.015)),
        )
        // Built at the origin, turned, then carried out to the waist.
        bar.rotateY(angle)
        bar.translate(Math.sin(angle) * barCentreRadius, waistY, Math.cos(angle) * barCentreRadius)
        pieces.push(bar)
      }

      /* -------------------------------------------------------------- cap */
      // Everything below is LOCAL to the seat: the part's origin sits there
      // so rotation.y grinds.
      const capH = H - seat
      const domeH = capH * 0.6
      // An OBLATE dome that overhangs the neck, measured off the reference:
      // its widest point is 0.87 R against a 0.78 R neck and it gets there in
      // the first third of its height. At 0.61 R it was narrower than the
      // shaft below it, which is a bullet, not a head.
      const capLevels: Level[] = [
        { y: 0, radius: R * 0.80 },
        { y: 0.003, radius: R * 0.86 },
        { y: domeH * 0.35, radius: R * 0.87 },
        { y: domeH * 0.68, radius: R * 0.74 },
        { y: domeH * 0.88, radius: R * 0.52 },
        { y: domeH, radius: R * 0.34 },
      ]
      const dome = latheGeometry(capLevels, segments, [0, 0, 0], tint('wood', jitter(random, 0.02)), {
        colourTop: tint('wood', 0.05),
        capBottom: true,
        capTop: true,
      })

      // The crown: a hex acorn, 6 segments on purpose. Its base is sunk into
      // the dome, its facets are what make the twist visible.
      const nutR = R * 0.22
      const nutLevels: Level[] = [
        { y: domeH - 0.003, radius: nutR * 0.72 },
        { y: domeH + 0.0008, radius: nutR },
        { y: capH * 0.87, radius: nutR },
        { y: capH * 0.95, radius: nutR * 0.7 },
        { y: capH, radius: nutR * 0.36 },
      ]
      const nut = latheGeometry(nutLevels, 6, [0, 0, 0], tint('stainless', jitter(random, 0.02), 0.5), {
        colourTop: tint('stainless', 0.04, 0.5),
        capBottom: true,
        capTop: true,
      })

      // 40 degrees: the revolve and the dome smooth, the foot, the lip, the
      // flute chamfers and the hex facets all turn harder than that and stay
      // edges.
      return {
        body: { slot: 'wood' as const, geometry: smoothNormals(mergeColoured(pieces), 40) },
        cap: {
          slot: 'wood' as const,
          geometry: smoothNormals(mergeColoured([dome]), 40),
          extras: [{ slot: 'stainless' as const, geometry: smoothNormals(mergeColoured([nut]), 30) }],
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
