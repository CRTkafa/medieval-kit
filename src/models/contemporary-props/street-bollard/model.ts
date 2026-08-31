/**
 * @contemporary-props/street-bollard
 *
 * Cast iron street bollard, and the cheapest possible proof that a profile is
 * data. It shares no code with the traffic cone and every idea: one radius as
 * a function of height, turned once, with the bands that read as separate
 * castings being nothing but y-ranges of the same curve.
 *
 * Measured off the reference rather than chosen. It is 8.2 shaft diameters
 * tall, which is the number that decides whether this is a bollard or a
 * gatepost, and the pieces stack in fractions of that height:
 *
 *   0.000  base flange, 1.63 shaft diameters across
 *   0.059  skirt, barely proud of the shaft
 *   0.144  lower bead
 *   0.185  the shaft, and it is two thirds of the whole thing
 *   0.869  upper bead, the same casting as the lower one
 *   0.905  dome
 *
 * The two beads are what make it read as cast and not as pipe. They are the
 * same ring at two heights and the model draws them from one function for that
 * reason: a bollard whose collars differ is a bollard somebody drew twice.
 *
 * The dome is slightly WIDER than the shaft, which looks wrong written down
 * and is right in front of you. A cap flush with the shaft reads as a tube cut
 * off and painted; the overhang is what says a separate piece was cast onto
 * the top of it.
 *
 * One part, one slot. There is nothing here that comes off, nothing that
 * lights, and nothing that moves, and the catalogue asks for no action: it is
 * row seven precisely because it is the shape and nothing else.
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

export interface StreetBollardConfig {
  /** Overall height, dome included (metres). */
  readonly height: number
  /** Radius of the shaft (metres). */
  readonly radius: number
  /** Base flange radius, as a multiple of the shaft's. */
  readonly flange: number
  /** How far the beads stand proud of the shaft, as a fraction of its radius. */
  readonly bead: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const streetBollardDefaults: StreetBollardConfig = {
  height: 0.95,
  // 8.2 diameters tall. Thicker and it is a gatepost; thinner and it is a
  // parking post, which is a different object with a different job.
  radius: 0.058,
  flange: 1.63,
  bead: 0.13,
  // 36, not 28. This kit has no lowpoly budget and a bollard is a plain
  // cylinder for two thirds of its height, which is exactly the shape where
  // facets have nothing to hide behind.
  segments: 36,
  seed: 5,
}

export type StreetBollardParts = 'body'

export function createModel(overrides: Partial<StreetBollardConfig> = {}) {
  return createKitModel<StreetBollardConfig, 'steelPainted', StreetBollardParts>({
    id: 'street-bollard',
    defaults: streetBollardDefaults,
    slots: ['steelPainted'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.4, Math.max(0.5, config.height))
      // Clamped against the height for the same reason the mill's is: the
      // proportion is the object, and either end of the slider on its own
      // produces something with another name.
      const R = Math.min(H * 0.11, Math.max(H * 0.045, Math.min(0.12, Math.max(0.03, config.radius))))
      const segments = Math.max(10, Math.round(config.segments))
      const flangeR = R * Math.min(2.1, Math.max(1.25, config.flange))
      const beadR = R * (1 + Math.min(0.3, Math.max(0.04, config.bead)))
      const skirtR = R * 1.05

      /**
       * One bead, at whatever height it is asked for.
       *
       * Written once and called twice because the two collars on a real
       * bollard come out of the same mould. The profile is sampled at 30 and
       * 60 degrees so the smoothing reads the ring as round rather than as a
       * pair of cones meeting at a point.
       */
      const ring = (centre: number, halfH: number): Level[] => [
        { y: centre - halfH, radius: R },
        { y: centre - halfH * 0.5, radius: R + (beadR - R) * 0.87 },
        { y: centre, radius: beadR },
        { y: centre + halfH * 0.5, radius: R + (beadR - R) * 0.87 },
        { y: centre + halfH, radius: R },
      ]

      const flangeTop = H * 0.059
      const skirtTop = H * 0.144
      const loBead = H * 0.1645
      const hiBead = H * 0.887
      const beadHalf = H * 0.0205
      const domeBase = H * 0.905
      const domeH = H - domeBase

      const levels: Level[] = [
        // The flange's own edge is turned over, not left square: a plate that
        // meets the pavement at a sharp corner reads as card.
        { y: 0, radius: flangeR - H * 0.004 },
        { y: H * 0.004, radius: flangeR },
        { y: flangeTop - H * 0.008, radius: flangeR },
        { y: flangeTop, radius: skirtR },
        { y: skirtTop, radius: skirtR },
        { y: skirtTop + H * 0.004, radius: R },
        ...ring(loBead, beadHalf),
        ...ring(hiBead, beadHalf),
        // The dome. Its widest point is a touch proud of the shaft and sits a
        // little above the parting line, so the overhang is a lip rather than
        // a step.
        { y: domeBase, radius: R },
        { y: domeBase + domeH * 0.1, radius: beadR * 0.97 },
        { y: domeBase + domeH * 0.45, radius: R * 0.93 },
        { y: domeBase + domeH * 0.75, radius: R * 0.7 },
        { y: domeBase + domeH * 0.92, radius: R * 0.42 },
        { y: H, radius: R * 0.16 },
      ]

      const iron = tint('steelPainted', jitter(random, 0.02))
      const pieces: BufferGeometry[] = [
        latheGeometry(levels, segments, [0, 0, 0], iron, {
          // Weathering runs the other way to a vessel's: a bollard is washed
          // clean at the top and dirty at the foot, so the ramp lightens
          // upward more than a glaze would.
          colourTop: tint('steelPainted', 0.06),
          capBottom: true,
          capTop: true,
        }),
      ]

      // 35 degrees: the shaft and the dome smooth into one another, and the
      // flange edge, the skirt step and the bead shoulders all turn harder
      // than that and stay as edges.
      return {
        body: { slot: 'steelPainted' as const, geometry: smoothNormals(mergeColoured(pieces), 35) },
      }
    },
  }, overrides)
}
