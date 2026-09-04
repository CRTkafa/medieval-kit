/**
 * @contemporary-props/boom-barrier
 *
 * A single lever over a box, which the catalogue puts fifty-ninth and calls the
 * cleanest test that a ninety degree action changes the read entirely. It is
 * right: down, this is a barrier and the road is shut; up, it is a post with a
 * stick on it and the road is open. Nothing about the geometry changes and the
 * meaning inverts, which is the argument for shipping actions at all rather
 * than shipping two models.
 *
 * Measured off the reference against a 1.05 m cabinet: a 3.2 m boom of 90 mm
 * section, banded in about 400 mm alternating red and white, on a cabinet 320
 * wide and 280 deep with a rounded dark cap and a louvred vent low on the side.
 *
 * The bands are the slat rule again, in its fifth use: the count comes from the
 * length and a target pitch, and the pitch is then re-derived so the boom ends
 * on a whole band. A boom whose last band is a sliver is the one thing on a
 * barrier everybody has seen and nobody can name.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  louvreGeometry,
  mergeColoured,
  smoothNormals,
  type RuntimeContext,
} from '../core/index.ts'

export interface BoomBarrierConfig {
  /** Length of the boom from its pivot (metres). */
  readonly boom: number
  /** Height of the cabinet (metres). */
  readonly height: number
  /** Target length of one colour band (metres). */
  readonly band: number
  /** How far the boom is raised, 0 across the road to 1 vertical. */
  readonly raised: number
  readonly seed: number
}

export const boomBarrierDefaults: BoomBarrierConfig = {
  boom: 3.2,
  height: 1.05,
  band: 0.4,
  raised: 0,
  seed: 83,
}

export type BoomBarrierParts = 'cabinet' | 'boom'

export interface BoomBarrierActions {
  /** Raises the boom. 0 is across the road, 1 is vertical. */
  raise(amount?: number): void
}

function applyRaise(
  runtime: RuntimeContext<BoomBarrierConfig, BoomBarrierParts>,
  amount: number,
): void {
  // About Z, because the boom lies along X: the one rotation the whole object
  // exists for.
  runtime.parts.boom.anchor.rotation.z = Math.min(1, Math.max(0, amount)) * (Math.PI / 2)
}

export function createModel(overrides: Partial<BoomBarrierConfig> = {}) {
  let heldRaise = 0
  let seenRaise = Number.NaN

  return createKitModel<
    BoomBarrierConfig,
    'steelPainted' | 'retroreflective' | 'plastic',
    BoomBarrierParts, BoomBarrierActions
  >({
    id: 'boom-barrier',
    defaults: boomBarrierDefaults,
    slots: ['steelPainted', 'retroreflective', 'plastic'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = Math.min(8, Math.max(1, config.boom))
      const H = Math.min(1.6, Math.max(0.6, config.height))
      const W = H * 0.305
      const D = H * 0.267

      // Small lifts: painted steel measures 0.202 in linear lightness and
      // anything past -0.19 is black, not dark.
      const case_ = tint('steelPainted', 0.09 + jitter(random, 0.015))
      const trim = tint('plastic', -0.16, 0.5)
      const red = tint('retroreflective', -0.02, 0.5)
      const white = tint('retroreflective', 0.3, 0.2).offsetHSL(0, -0.85, 0)

      const pivotY = H * 0.79
      const boomT = H * 0.086
      const boomW = boomT * 0.62

      /* ------------------------------------------------------------ cabinet */
      const cabPieces: BufferGeometry[] = []
      // The body starts ON the base rather than beside it: written to y = 0 as
      // well, its underside shares a plane with the base's, which is two faces
      // the renderer cannot order. Sunk a few millimetres into it instead.
      const sunk = H * 0.008
      const bodyH = H * 0.9
      cabPieces.push(chamferedBoxGeometry(
        [W, D], [W * 0.97, D * 0.97], bodyH, W * 0.07, [0, sunk + bodyH / 2, 0], case_,
      ))
      // The moulded cap, which on every one of these is a different colour from
      // the case and is most of what stops it reading as a filing cabinet.
      cabPieces.push(chamferedBoxGeometry(
        [W * 0.99, D * 0.99], [W * 0.72, D * 0.72],
        H * 0.11, W * 0.14, [0, sunk + bodyH + H * 0.045, 0], trim,
      ))
      // The base, set back, so the cabinet stands on something.
      cabPieces.push(chamferedBoxGeometry(
        [W * 1.02, D * 1.02], [W * 1.02, D * 1.02],
        H * 0.026, W * 0.03, [0, H * 0.013, 0], trim,
      ))

      /*
       * The vent, low on the case: `louvreGeometry`'s second use, one row after
       * the utility cabinet settled it.
       *
       * On the +Z face, because that is where the kit's renderer stands. Put on
       * -Z -- which is the way `louvreGeometry` builds by default and the
       * natural way to think about a front -- it is behind the object in every
       * picture, which is the third time this session that has happened.
       */
      const vent = louvreGeometry({
        width: W * 0.34,
        height: H * 0.1,
        blades: 4,
        depth: W * 0.03,
        angle: 0.42,
        centre: [0, 0, 0],
        colour: case_,
        shadow: trim,
      })
      vent.rotateY(Math.PI)
      vent.translate(-W * 0.18, H * 0.2, D / 2)
      cabPieces.push(vent)

      // The bracket the boom pivots in, which is the only place the two parts
      // of this object touch.
      cabPieces.push(chamferedBoxGeometry(
        [W * 0.62, boomT * 1.6], [W * 0.62, boomT * 1.5],
        boomT * 2.1, W * 0.02, [W * 0.24, pivotY, 0], trim,
      ))

      /* --------------------------------------------------------------- boom */
      /**
       * The banding, derived rather than typed.
       *
       * `band` is the length a stripe wants to be; the count is what that gives
       * over the boom, rounded to an EVEN number so the pattern closes on the
       * colour it opened with, and the actual band length comes back out of the
       * count. Set the length directly and every change to the boom leaves a
       * half band at the tip.
       */
      const wanted = Math.min(1, Math.max(0.08, config.band))
      const bands = Math.max(2, Math.round(L / wanted / 2) * 2)
      const bandL = L / bands

      const boomPieces: BufferGeometry[] = []
      for (let i = 0; i < bands; i += 1) {
        // The band's LENGTH is its height, and the turn is MINUS a quarter.
        //
        // Put in the section and turned the other way, each band came out one
        // section thick along the boom and a band long across it: sixteen
        // paddles standing in a row, none of them touching, which the support
        // check reported as nine floating pieces. It is the same mistake the
        // cable drum's spokes made, in a different dress.
        const band = chamferedBoxGeometry(
          [boomT, boomW], [boomT, boomW],
          bandL, boomT * 0.28, [0, 0, 0], i % 2 === 0 ? white : red,
        )
        band.rotateZ(-Math.PI / 2)
        band.translate(bandL * (i + 0.5), 0, 0)
        boomPieces.push(band)
      }
      // The end cap, so the boom stops rather than being cut off.
      boomPieces.push(latheGeometry([
        { y: 0, radius: boomT * 0.42 },
        { y: boomT * 0.2, radius: boomT * 0.5 },
        { y: boomT * 0.34, radius: boomT * 0.5 },
      ], 12, [0, 0, 0], trim, { capBottom: false, capTop: true })
        .rotateZ(-Math.PI / 2)
        .translate(L, 0, 0))

      bakeOcclusion(cabPieces, { strength: 0.35 })

      const pivot = [W * 0.3, pivotY, 0] as const
      return {
        cabinet: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(mergeColoured(cabPieces), 34),
        },
        boom: {
          // Retroreflective, because that is what the banding is: the boom is
          // the one part of this object that has to be seen by a headlight at
          // an angle no lamp is pointing.
          slot: 'retroreflective' as const,
          geometry: smoothNormals(mergeColoured(boomPieces), 34),
          origin: pivot,
        },
      }
    },

    actions: (runtime) => {
      heldRaise = runtime.getConfig().raised
      seenRaise = heldRaise
      applyRaise(runtime, heldRaise)
      return { raise: (amount = 1) => { heldRaise = amount; applyRaise(runtime, amount) } }
    },

    update: (_dt, runtime) => {
      const wanted = runtime.getConfig().raised
      if (wanted !== seenRaise) { seenRaise = wanted; heldRaise = wanted }
      applyRaise(runtime, heldRaise)
    },
  }, overrides)
}
