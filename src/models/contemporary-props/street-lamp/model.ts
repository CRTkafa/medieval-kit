/**
 * @contemporary-props/street-lamp
 *
 * Tapered column, swan-neck sweep and a shallow head: the skyline shape a
 * street scene needs, which is what the catalogue puts it eighty-fifth for.
 * Every other object in this domain sits below eye level. This one is the only
 * thing that draws a line across the sky, and a street without it reads as a
 * yard.
 *
 * The neck is `tubeGeometry`'s fourth use and the one it was really written
 * for: a single length of tube going up, over and down, whose bend is the
 * object's whole silhouette. Built as an arc piece between two straight ones it
 * has two joints in exactly the place the eye is looking.
 *
 * The bend is an ELLIPTICAL quarter-and-a-bit rather than a semicircle. A
 * semicircle comes back down to the height it left at, and the reference's head
 * hangs a third of a metre ABOVE its collar -- so the sweep stops at a fifth of
 * the way round and the head hangs from there. Measured against a 4 m lamp: a
 * 0.47 m reach, a 0.62 m rise, a 0.58 m head.
 *
 * The lens is the kit's first use of the `emissive` slot, and `lit` swaps it
 * rather than dimming it: an unlit lamp's lens is grey glass and a lit one is a
 * light source, and those are two different materials rather than two values of
 * one. The kit skips occlusion on emissive parts for the same reason.
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

export interface StreetLampConfig {
  /** Height to the top of the sweep (metres). */
  readonly height: number
  /** How far the head reaches out from the column (metres). */
  readonly reach: number
  /** Diameter of the head (metres). */
  readonly head: number
  /** 1 lights the lens, 0 leaves it as glass. */
  readonly lit: number
  readonly seed: number
}

export const streetLampDefaults: StreetLampConfig = {
  height: 4,
  reach: 0.47,
  head: 0.58,
  lit: 0,
  seed: 29,
}

export type StreetLampParts = 'column' | 'arm' | 'lens'

export function createModel(overrides: Partial<StreetLampConfig> = {}) {
  return createKitModel<
    StreetLampConfig,
    'steelPainted' | 'glassTinted' | 'emissive',
    StreetLampParts, Record<string, never>
  >({
    id: 'street-lamp',
    defaults: streetLampDefaults,
    slots: ['steelPainted', 'glassTinted', 'emissive'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(8, Math.max(2, config.height))
      const reach = Math.min(H * 0.4, Math.max(0.1, config.reach))
      const headR = Math.min(H * 0.3, Math.max(0.1, config.head)) / 2
      const lit = config.lit >= 0.5

      // Small lifts: painted steel measures 0.202 in linear lightness, and
      // anything past -0.19 is black rather than dark.
      const iron = tint('steelPainted', -0.1 + jitter(random, 0.015), 0.5)
      const dark = tint('steelPainted', -0.15, 0.4)

      const shaftR = H * 0.011
      const rise = H * 0.155
      const collarY = H - rise - H * 0.09
      const baseH = H * 0.085

      /* ------------------------------------------------------------- column */
      /**
       * The base is a BELL, and it is a third of what names the object.
       *
       * A column that meets the pavement as a plain tube reads as scaffold. A
       * cast lamp standard flares into a bell on a round foot plate, because
       * the bending moment at the ground is where all of it goes, and that
       * flare is visible from further away than anything else at this height.
       */
      const columnPieces: BufferGeometry[] = [latheGeometry([
        { y: 0, radius: shaftR * 4.4 },
        { y: H * 0.006, radius: shaftR * 4.4 },
        { y: H * 0.011, radius: shaftR * 4 },
        { y: H * 0.017, radius: shaftR * 3.5 },
        { y: baseH * 0.9, radius: shaftR * 1.6 },
        { y: baseH, radius: shaftR * 1.5 },
        { y: baseH + H * 0.008, radius: shaftR * 1.28 },
        { y: baseH + H * 0.016, radius: shaftR * 1.12 },
        // The shaft, which tapers over its whole run rather than being a pipe.
        { y: collarY - H * 0.02, radius: shaftR * 0.98 },
        { y: collarY - H * 0.008, radius: shaftR * 1.22 },
        { y: collarY, radius: shaftR * 1.22 },
        { y: collarY + H * 0.008, radius: shaftR * 0.94 },
      ], 20, [0, 0, 0], iron, { capBottom: true, capTop: false })]

      /* ---------------------------------------------------------------- arm */
      /**
       * The sweep, as one path.
       *
       * Up the last of the column, round an ellipse from pointing up to a fifth
       * of the way past the apex, and then the head hangs off the end. The
       * ellipse rather than a circle is what puts the head above the collar
       * instead of level with it.
       */
      const half = reach / 1.809
      const path: Vec3[] = [[0, collarY - H * 0.004, 0]]
      const steps = 16
      const stop = Math.PI * 0.2
      for (let i = 0; i <= steps; i += 1) {
        const a = Math.PI - (i / steps) * (Math.PI - stop)
        path.push([half * (1 + Math.cos(a)), collarY + rise * Math.sin(a), 0])
      }
      const tip = path.at(-1)!
      const armPieces: BufferGeometry[] = [
        tubeGeometry(path, shaftR * 0.86, 12, iron, { capStart: false, capEnd: false }),
      ]

      // The knuckle where the head is clamped on, which is the only fitting on
      // an object otherwise made of two curves.
      armPieces.push(latheGeometry([
        { y: tip[1] - shaftR * 1.5, radius: shaftR * 1.15 },
        { y: tip[1] - shaftR * 0.4, radius: shaftR * 1.15 },
        { y: tip[1] - shaftR * 0.1, radius: shaftR * 0.95 },
      ], 14, [tip[0], 0, 0], dark, { capBottom: true, capTop: false }))

      /**
       * The head: a shallow cone, and shallow is the whole of it.
       *
       * This is the shade every municipal lamp of this pattern has, and its
       * proportion is unforgiving -- deep enough and it is a Chinese hat, flat
       * enough and it is a dinner plate. The reference's is a fifth as deep as
       * it is wide, with a rolled rim that catches the light from below.
       */
      const headTop = tip[1] - shaftR * 1.4
      const headDrop = headR * 0.42
      armPieces.push(latheGeometry([
        { y: headTop, radius: shaftR * 0.9 },
        { y: headTop - headDrop * 0.35, radius: headR * 0.55 },
        { y: headTop - headDrop * 0.86, radius: headR * 0.97 },
        { y: headTop - headDrop, radius: headR },
        { y: headTop - headDrop * 1.12, radius: headR * 0.94 },
      ], 24, [tip[0], 0, 0], iron, { capBottom: false, capTop: false }))

      /* --------------------------------------------------------------- lens */
      // A dish rather than a flat disc, because the lens on one of these bulges
      // slightly below the rim and that is where the light appears to come from.
      const lensPieces: BufferGeometry[] = [latheGeometry([
        { y: headTop - headDrop * 1.1, radius: headR * 0.9 },
        { y: headTop - headDrop * 1.24, radius: headR * 0.82 },
        { y: headTop - headDrop * 1.34, radius: headR * 0.5 },
      ], 24, [tip[0], 0, 0],
      lit ? tint('emissive', 0.06, 0.1) : tint('glassTinted', 0, 0.4),
      { capBottom: false, capTop: true })]

      bakeOcclusion(columnPieces, { strength: 0.3 })
      bakeOcclusion(armPieces, { strength: 0.3 })

      return {
        column: { slot: 'steelPainted' as const, geometry: smoothNormals(mergeColoured(columnPieces), 40) },
        arm: { slot: 'steelPainted' as const, geometry: smoothNormals(mergeColoured(armPieces), 40) },
        lens: {
          // The slot itself is switched rather than the colour: an unlit lens is
          // tinted glass and a lit one is a light, and the kit skips occlusion
          // on emissive parts, which is what stops a lit lamp being shaded by
          // its own shade.
          slot: lit ? ('emissive' as const) : ('glassTinted' as const),
          geometry: smoothNormals(mergeColoured(lensPieces), 40),
        },
      }
    },
  }, overrides)
}
