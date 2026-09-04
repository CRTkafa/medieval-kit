/**
 * @contemporary-props/cable-drum
 *
 * Three repetitions in one small cheap object, which is exactly what the
 * catalogue puts it twenty-sixth for: the spokes of a flange, the staves of a
 * barrel, and a helix of cable wound between them. Nothing here is a new
 * technique. It is the row where three arrays that were each written for
 * something else have to share one object and agree about where its axis is.
 *
 * The helix is `tubeGeometry`'s second use, one row after the cycle stand
 * introduced it, and it is the case the hoop could not have justified on its
 * own: a path that turns through many full circles while climbing. A fixed up
 * vector survives a hoop -- barely, it pinches at the crown -- and cannot
 * survive this at all.
 *
 * BUILT UPRIGHT AND THEN TIPPED. Every generator in the kit turns about Y, so
 * a drum whose axle is horizontal is written as though it stood on one flange
 * and rotated a quarter turn at the end. Writing it lying down would mean
 * every lathe, every stave and every helix carrying the same rotation, and the
 * first one to be given it in the wrong order would be the one nobody found.
 *
 * Measured against the standard timber drum: a 1.2 m flange, a 0.6 m barrel,
 * and 0.7 m between the flanges. The reference is an EMPTY drum, which is the
 * `wound` slider at zero; it defaults part full instead, because a drum with no
 * cable on it is a spool, and because the catalogue asks this row for a helix.
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
  staveGeometry,
  tubeGeometry,
  type Vec3,
} from '../core/index.ts'

export interface CableDrumConfig {
  /** Diameter across a flange (metres). */
  readonly diameter: number
  /** Distance between the two flanges (metres). */
  readonly width: number
  /** Spokes in each flange. */
  readonly spokes: number
  /** How much of the barrel is covered in cable, 0 empty to 1 full. */
  readonly wound: number
  readonly seed: number
}

export const cableDrumDefaults: CableDrumConfig = {
  diameter: 1.2,
  width: 0.7,
  spokes: 8,
  wound: 0.35,
  seed: 13,
}

export type CableDrumParts = 'flanges' | 'barrel' | 'cable'

export interface CableDrumActions {
  /** Rolls the drum about its axle. 1 is a full turn. */
  roll(turns?: number): void
}

export function createModel(overrides: Partial<CableDrumConfig> = {}) {
  return createKitModel<
    CableDrumConfig, 'wood' | 'galvanised' | 'rubber', CableDrumParts, CableDrumActions
  >({
    id: 'cable-drum',
    defaults: cableDrumDefaults,
    slots: ['wood', 'galvanised', 'rubber'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const D = Math.min(2.4, Math.max(0.5, config.diameter))
      const W = Math.min(1.6, Math.max(0.25, config.width))
      const spokes = Math.max(4, Math.round(config.spokes))
      const wound = Math.min(1, Math.max(0, config.wound))

      const R = D / 2
      /*
       * Measured, not assumed. A cable drum's barrel is remembered as about
       * half the flange and this one is not: in the reference the staves span
       * 0.756 of the flange's diameter, which is a fat barrel carrying few
       * layers of thick cable rather than a thin one carrying many.
       *
       * Both measurements are reliable here for the same reason -- a disc and
       * a cylinder seen at any tilt both keep their full diameter across the
       * tilt axis -- so this is one of the few proportions in the kit that a
       * photograph gives up exactly.
       */
      const barrelR = R * 0.72
      // 7.4% of the flange's diameter, measured off the reference's rim band.
      const rimW = R * 0.148
      const plank = W * 0.07

      const timber = (lift = 0): ReturnType<typeof tint> =>
        tint('wood', 0.06 + lift + jitter(random, 0.05), 1.3)

      const flangePieces: BufferGeometry[] = []
      const barrelPieces: BufferGeometry[] = []

      /* ------------------------------------------------------------ flanges */
      /**
       * One flange, built at a height and then built again at the other.
       *
       * The rim is TWO rings rather than one, because the reference's is: a
       * timber flange that size is laminated from segments in two courses with
       * the joints staggered, and the seam between the courses runs right round
       * the outside where it cannot be missed. One ring reads as plywood.
       */
      const flange = (y: number, facing: number): void => {
        /*
         * A ring is ONE lathe with a closed profile, not four with caps.
         *
         * Written as an outer tube, an inner tube and two annulus faces it
         * came out a solid disc: `latheGeometry` caps by default, and the cap
         * on a two-level annulus is a full disc of its own radius. Four pieces,
         * two of them filling in the hole the other two were drawing. Walked as
         * a closed loop -- in at the bottom, out, up, back in -- the same four
         * surfaces are one uncapped solid with a real hole through it.
         */
        const ring = (r0: number, r1: number, from: number, to: number, lift: number): void => {
          flangePieces.push(latheGeometry([
            { y: y + facing * from, radius: r0 },
            { y: y + facing * from, radius: r1 },
            { y: y + facing * to, radius: r1 },
            { y: y + facing * to, radius: r0 },
          ], 40, [0, 0, 0], timber(lift), { capBottom: false, capTop: false }))
        }

        // The rim is TWO courses rather than one, because the reference's is: a
        // timber flange that size is laminated in two, and the seam runs right
        // round the outside where it cannot be missed. One ring reads as ply.
        // The outer course is a hair proud of the inner one, so the seam is a
        // step that catches light rather than a colour change nobody sees:
        // built flush, the critic read the two courses as one.
        ring(R - rimW, R - rimW * 0.14, 0, plank * 0.52, 0)
        ring(R - rimW * 0.1, R, plank * 0.48, plank, 0.03)

        // The hub, the same way, with the axle bore through it.
        const hubR = R * 0.17
        const bore = R * 0.075
        ring(bore, hubR, 0, plank * 1.15, -0.04)

        /*
         * The spokes: the first of the three arrays.
         *
         * They run from the hub to the inside of the rim and they are BURIED at
         * both ends rather than butted to them -- a spoke cut exactly to the
         * rim's inner face puts its end grain in that face's plane, which is
         * the whole of what made the park bench flicker.
         */
        const from = hubR - plank * 0.25
        const to = R - rimW + plank * 0.25
        for (let i = 0; i < spokes; i += 1) {
          const a = (i / spokes) * Math.PI * 2
          const spoke = chamferedBoxGeometry(
            [plank * 1.15, plank * 0.92], [plank * 0.95, plank * 0.92],
            // The LENGTH is the height, not part of the section. Put in the
            // section instead, the spokes came out standing on end: eight short
            // blocks scattered across the flange, each pointing at the camera.
            to - from, plank * 0.1, [0, 0, 0], timber(-0.02),
          )
          // Built standing in Y; laid flat, aimed down the radius, and set out
          // to the middle of its own run.
          spoke.rotateX(Math.PI / 2)
          spoke.translate(0, 0, (from + to) / 2)
          spoke.rotateY(a)
          spoke.translate(0, y + facing * plank * 0.5, 0)
          flangePieces.push(spoke)
        }

        // The plates round the bore, which is the only metal on the object and
        // the thing that says an axle goes through rather than a peg.
        const steel = tint('galvanised', -0.1, 0.4).offsetHSL(0, -1, 0)
        for (let i = 0; i < spokes; i += 1) {
          const a = ((i + 0.5) / spokes) * Math.PI * 2
          const plate = chamferedBoxGeometry(
            [plank * 0.38, plank * 0.34], [plank * 0.34, plank * 0.3],
            plank * 0.14, plank * 0.03, [0, 0, 0], steel,
          )
          plate.translate(Math.cos(a) * bore * 1.45, y + facing * (plank * 1.15 - plank * 0.06), Math.sin(a) * bore * 1.45)
          flangePieces.push(plate)
        }
      }

      flange(0, 1)
      flange(W, -1)

      /* ------------------------------------------------------------- barrel */
      /**
       * The staves: the second array, and the reason `staveGeometry` exists.
       *
       * A barrel of boards is not a cylinder with lines drawn on it. Each board
       * is flat across its own width and the ring of them is a polygon, so the
       * light breaks at every joint -- which is the whole read, and it is lost
       * the moment the barrel is drawn as one lathe.
       */
      const staves = Math.max(8, Math.round(spokes * 2.5))
      const step = (Math.PI * 2) / staves
      for (let i = 0; i < staves; i += 1) {
        const a = i * step
        barrelPieces.push(staveGeometry([
          { y: plank * 0.3, radius: barrelR },
          { y: W - plank * 0.3, radius: barrelR },
        ], a + step * 0.03, a + step * 0.97, barrelR * 0.09, timber(-0.03)))
      }

      /* -------------------------------------------------------------- cable */
      /**
       * The helix: the third array, and the one that needed a new helper.
       *
       * It is wound as a real coil -- one turn beside the last, filling from
       * the flange inward -- rather than drawn as a fat ring, because a cable
       * drum is the object where the winding IS the detail. The turn count is
       * derived from the cable's own gauge and the width it has to cover, so
       * changing either leaves no half turn at one end.
       */
      const cablePieces: BufferGeometry[] = []
      const cableR = Math.max(0.006, D * 0.011)
      const span = (W - plank * 1.4) * wound
      const turns = Math.floor(span / (cableR * 2))
      if (turns >= 1) {
        // `staveGeometry` takes its levels' radius as the OUTER one, so the
        // barrel's surface IS `barrelR` and the cable seats one cable radius
        // out from it. Adding the stave thickness on top as well is what stood
        // the pack several diameters off the drum.
        const lay = barrelR + cableR
        // Clear of the flange's inner face, not inside it. Started at 0.7 of a
        // plank the first turn sat within the flange's own thickness and the
        // cable crossed the timber it is supposed to be wound against.
        const start = plank + cableR * 1.15
        const perTurn = 16
        const path: Vec3[] = []
        for (let i = 0; i <= turns * perTurn; i += 1) {
          const t = i / perTurn
          const a = t * Math.PI * 2
          path.push([Math.cos(a) * lay, start + t * cableR * 2, Math.sin(a) * lay])
        }
        cablePieces.push(tubeGeometry(path, cableR, 8, tint('rubber', jitter(random, 0.03)), {
          capStart: true,
          capEnd: true,
        }))
      }

      bakeOcclusion(flangePieces, { strength: 0.4 })
      bakeOcclusion(barrelPieces, { strength: 0.45 })

      /**
       * ...and then the whole thing is TIPPED onto its side.
       *
       * Built about Y because every generator here turns about Y; a drum's axle
       * is horizontal, so one quarter turn at the end puts the axle along Z and
       * the drum on the two rims it actually stands on. Lifting it by a flange
       * radius is what puts those rims on the ground rather than through it.
       */
      const tip = (pieces: BufferGeometry[]): BufferGeometry | undefined => {
        if (pieces.length === 0) return undefined
        const merged = mergeColoured(pieces)
        merged.rotateX(Math.PI / 2)
        // ...and NOT lifted. A part that declares an origin is written in that
        // origin's own space and the anchor carries it into place; the kit does
        // not subtract the origin from world-written geometry, it only moves
        // things temporarily to bake occlusion and moves them back. Lifting
        // here as well put the whole drum a flange radius into the air, where
        // it stayed, because the support check measures a model against itself
        // rather than against the ground.
        return merged
      }

      // Every part declares the AXLE as its origin, which is what lets one
      // rotation roll all three together, and every part's geometry is written
      // about that axle rather than about the ground.
      const axle = [0, R, 0] as const
      const cable = tip(cablePieces)
      return {
        flanges: { slot: 'wood' as const, geometry: smoothNormals(tip(flangePieces)!, 34), origin: axle },
        barrel: { slot: 'wood' as const, geometry: smoothNormals(tip(barrelPieces)!, 34), origin: axle },
        // Present as `undefined` rather than absent when the drum is empty: the
        // kit's part map is keyed on the declared names, so a missing key is a
        // type error and a silently absent part is worse than an empty one.
        cable: cable
          ? { slot: 'rubber' as const, geometry: smoothNormals(cable, 40), origin: axle }
          : undefined,
      }
    },

    actions: ({ parts }) => {
      // Rotation only. The position is the origin the build declared, and the
      // kit resets it on every rebuild -- writing to it here would fight that
      // and put the drum a flange radius further up on each configure().
      const set = (turns: number): void => {
        for (const part of Object.values(parts)) {
          part.anchor.rotation.z = -turns * Math.PI * 2
        }
      }
      return { roll: (turns = 0.25) => { set(turns) } }
    },
  }, overrides)
}
