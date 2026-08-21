/**
 * @medieval-kit/hay-bale
 *
 * A bound bundle of straw.
 *
 * A warning is in order: the rectangular block that comes to mind today when
 * you say "bale" is machine work and belongs to the 19th century. In the Middle
 * Ages straw was either heaped loose or bound by hand into a bundle. This model
 * is the second.
 *
 * The SECOND attempt. The first was built from slice after slice of boxes and
 * one look at the render made the call obvious: it looked like A PALE WOODEN
 * CHEST. There were two separate mistakes, both about form, not colour:
 *
 *   - The cross-section was rectangular. Sharp corner + flat face = joinery. A
 *     bound bundle's section is round, because the cord that pulls it rounds it.
 *   - The surfaces were perfectly flat. Straw is nowhere flat.
 *
 * So the body is now a lathe body — a cylinder that narrows where the cord
 * cinches it and is then broken up with `roughenGeometry`. Those two changes
 * made the model recognisable without the colour changing at all.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface HayBaleConfig {
  /** Length (metres). */
  readonly length: number
  /** Height (metres). */
  readonly height: number
  /** Depth (metres). */
  readonly depth: number
  /** How many cord ties. */
  readonly ropeCount: number
  /** Number of loose stalks sticking out of the surface. */
  readonly wisps: number
  /** Surface irregularity. 0 = smooth body. */
  readonly rough: number
  readonly seed: number
}

export const hayBaleDefaults: HayBaleConfig = {
  length: 0.88,
  height: 0.42,
  depth: 0.46,
  ropeCount: 2,
  wisps: 34,
  rough: 1,
  seed: 47,
}

export type HayBaleParts = 'bale' | 'wisps' | 'ropes'

export function createModel(overrides: Partial<HayBaleConfig> = {}) {
  return createKitModel<HayBaleConfig, 'straw' | 'cloth', HayBaleParts>({
    id: 'hay-bale',
    defaults: hayBaleDefaults,
    slots: ['straw', 'cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const ropes = Math.max(0, Math.round(config.ropeCount))
      const halfLength = config.length / 2

      // The body is built first as a lathe body of RADIUS 1, because it is then
      // squashed into the real width/depth ratio. That way the amount the cord
      // pulls in is a single number — no need to work it out per axis.
      const ropeXs = Array.from({ length: ropes }, (_, i) =>
        ropes === 1 ? 0 : (i / (ropes - 1) - 0.5) * config.length * 0.54)
      const cinch = (x: number): number => {
        let tightest = 1
        for (const rx of ropeXs) {
          const distance = Math.abs(x - rx) / (config.length * 0.19)
          if (distance < 1) tightest = Math.min(tightest, 1 - 0.13 * (1 - distance * distance))
        }
        return tightest
      }

      // --- Body -----------------------------------------------------------
      const rings = 11
      const levels: Level[] = Array.from({ length: rings }, (_, i) => {
        const t = i / (rings - 1)
        const x = -halfLength + config.length * t
        // The ends round off: the first and last hoop are clearly narrower, or
        // else the bundle looks like a pipe cut off at both ends.
        const endFade = 1 - Math.pow(Math.abs(t - 0.5) * 2, 6) * 0.34
        return { y: x, radius: 0.5 * cinch(x) * endFade * (1 + jitter(random, 0.05)) }
      })

      const body = latheGeometry(levels, 7, [0, 0, 0], tint('straw', -0.06, 1.6), {
        colourTop: tint('strawPale', 0.02, 1.6),
      })
      // Built upright and then laid down: the lathe helper works around the Y
      // axis, whereas the bundle runs along X.
      body.rotateZ(Math.PI / 2)
      body.scale(1, config.height, config.depth)
      roughenGeometry(body, config.height * 0.045 * config.rough, { salt: 11 })

      // --- Stray stalks ----------------------------------------------------
      // The loose stalks on the surface and the stem ends spraying out of the
      // two ends. The second matters: in a bound bundle the CUT ends of the
      // stalks are always at the two ends, and that is the only sign that makes
      // the bundle read as "cut plant".
      const wispPieces: BufferGeometry[] = []
      const wispCount = Math.max(0, Math.round(config.wisps))
      const thickness = config.height * 0.016

      for (let i = 0; i < wispCount; i += 1) {
        const fromEnd = i % 3 === 0
        const length = config.height * (fromEnd ? 0.2 + random() * 0.24 : 0.13 + random() * 0.17)
        const wisp = boxGeometry(
          [length, thickness * (0.6 + random() * 0.9), thickness],
          [length * 0.3, 0, 0],   // root behind the origin: buried in the body
          tint('strawPale', 0.05, 1.4),
        )

        if (fromEnd) {
          // End stalks: outward along the X axis, scattering a little.
          const side = i % 6 === 0 ? 1 : -1
          const angle = random() * Math.PI * 2
          const radius = 0.5 * (0.15 + random() * 0.8)
          wisp.rotateZ(jitter(random, 0.4))
          wisp.rotateX(jitter(random, 0.4))
          if (side < 0) wisp.rotateY(Math.PI)
          wisp.translate(
            side * halfLength * (0.86 + random() * 0.1),
            Math.sin(angle) * radius * config.height,
            Math.cos(angle) * radius * config.depth,
          )
        } else {
          // Surface stalks: outward from the side surface of the body.
          const x = (random() - 0.5) * config.length * 0.88
          const angle = random() * Math.PI * 2
          const shrink = cinch(x)
          wisp.rotateZ(jitter(random, 0.9))
          wisp.rotateY(angle + Math.PI / 2)
          wisp.translate(
            x,
            Math.sin(angle) * 0.47 * config.height * shrink,
            Math.cos(angle) * 0.47 * config.depth * shrink,
          )
        }
        wispPieces.push(wisp)
      }

      // --- Cords -----------------------------------------------------------
      // Since the body is round, the cord is now built from a real HOOP rather
      // than from four bars. It goes through the same squashing transform, so
      // it sits exactly on the bundle's cross-section.
      const ropePieces: BufferGeometry[] = []
      const cord = config.height * 0.03
      for (const x of ropeXs) {
        // Free-standing hoop: it needs its inner face too, or it is not solid.
        const ring = bandGeometry(0.5 * cinch(x) + cord * 0.35, 0, cord * 1.5, cord, 7,
          tint('cloth', -0.07), { inner: true })
        ring.rotateZ(Math.PI / 2)
        ring.scale(1, config.height, config.depth)
        ring.translate(x, 0, 0)
        ropePieces.push(ring)
      }

      return {
        bale: { slot: 'straw' as const, geometry: mergeColoured([body]) },
        wisps: wispPieces.length > 0
          ? { slot: 'straw' as const, geometry: mergeColoured(wispPieces) }
          : undefined,
        ropes: ropePieces.length > 0
          ? { slot: 'cloth' as const, geometry: mergeColoured(ropePieces) }
          : undefined,
      }
    },
  }, overrides)
}
