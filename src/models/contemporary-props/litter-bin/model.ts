/**
 * @contemporary-props/litter-bin
 *
 * A perforated drum under an overhanging hood, hung off a post: the catalogue's
 * thirtieth row, and the first object here where a hinge carries real mass.
 *
 * It is also the row that spends `perforate`, which is written in core rather
 * than here for the reason the catalogue gives: perforation is defined across
 * three rows in three domains -- the mesh waste bin in the office, the colander
 * in the kitchen, and this -- and a helper that only knew how to punch a
 * cylinder would be rewritten by the second of them. This model hands it a
 * cylinder; the colander will hand it a curved shell and get the same code.
 *
 * Measured off the reference against a 1.2 m overall height:
 *
 *   drum        368 mm across, 550 mm deep, hung with its base 400 mm up
 *   hood        450 mm across, 116 mm deep, overhanging the drum on both sides
 *   post        55 mm, tapered, on a 190 mm flange with four gussets
 *   punching    14 mm holes on a 24 mm pitch, staggered, with solid bands top
 *               and bottom and a solid strip where the bracket lands
 *
 * The hood hinges at the back of its bracket. That is the action the catalogue
 * asks for and it is a real one: emptying the bin means swinging the hood up
 * and lifting the liner out, so the pivot has to be behind the drum rather than
 * over it, and the hood has to clear the drum's rim through the whole travel.
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
  perforate,
  smoothNormals,
  type RuntimeContext,
  type Vec3,
} from '../core/index.ts'

export interface LitterBinConfig {
  /** Height to the top of the hood (metres). */
  readonly height: number
  /** Diameter of the drum (metres). */
  readonly diameter: number
  /** Rows of holes up the drum. */
  readonly rows: number
  /** Holes around the drum. */
  readonly columns: number
  /** How far the hood is swung up, 0 closed to 1 open. */
  readonly lift: number
  readonly seed: number
}

export const litterBinDefaults: LitterBinConfig = {
  height: 1.2,
  diameter: 0.368,
  // 14 mm holes on a 24 mm pitch, which is what the reference punches: at 26
  // columns they came out 26 mm across and read as a grille rather than a
  // perforation.
  rows: 21,
  columns: 34,
  lift: 0,
  seed: 33,
}

export type LitterBinParts = 'post' | 'drum' | 'hood'

export interface LitterBinActions {
  /** Swings the hood up off the drum. 1 is fully open. */
  lift(amount?: number): void
}

/**
 * The hood's pose, in one place because the config and the action both drive
 * it -- the lesson the pavement sign and the fire extinguisher both paid for.
 * A pose that lives only in an anchor rotation is a pose no rebuild re-applies,
 * so the slider moves and nothing happens.
 */
function applyLift(
  runtime: RuntimeContext<LitterBinConfig, LitterBinParts>,
  amount: number,
): void {
  runtime.parts.hood.anchor.rotation.x = -Math.min(1, Math.max(0, amount)) * 1.15
}

export function createModel(overrides: Partial<LitterBinConfig> = {}) {
  let heldLift = 0
  let seenLift = Number.NaN

  return createKitModel<
    LitterBinConfig, 'steelPainted' | 'galvanised', LitterBinParts, LitterBinActions
  >({
    id: 'litter-bin',
    defaults: litterBinDefaults,
    slots: ['steelPainted', 'galvanised'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.7, Math.max(0.8, config.height))
      const D = Math.min(0.6, Math.max(0.2, config.diameter))
      const rows = Math.max(3, Math.round(config.rows))
      const columns = Math.max(8, Math.round(config.columns))

      const R = D / 2
      const drumH = H * 0.458
      const drumBase = H * 0.333
      const drumTop = drumBase + drumH
      // The post stands behind the drum, not through it.
      const postZ = R * 1.16
      const postR = H * 0.023
      const hoodY = H - H * 0.097

      const paint = tint('steelPainted', jitter(random, 0.02))
      const dark = tint('steelPainted', -0.5, 0.3)

      /* --------------------------------------------------------------- post */
      const postPieces: BufferGeometry[] = []
      postPieces.push(latheGeometry([
        { y: H * 0.02, radius: postR * 1.18 },
        { y: H * 0.05, radius: postR },
        // Up to the hood's arm, not to a number that looked about right: at
        // 0.86 the post stopped 38 mm short of the arm it carries and the
        // whole hood hung in the air, which the support check found and no
        // amount of looking at the render from the front would have.
        { y: hoodY + H * 0.006, radius: postR * 0.92 },
      ], 18, [0, 0, postZ], paint, { capBottom: false, capTop: true }))

      // The bolted foot: a flange with four gussets, which is how a post this
      // slender is actually kept upright and the only place the object is
      // fixed to anything.
      postPieces.push(latheGeometry([
        { y: 0, radius: H * 0.079 },
        { y: H * 0.008, radius: H * 0.079 },
        { y: H * 0.013, radius: H * 0.07 },
      ], 24, [0, 0, postZ], tint('galvanised', 0, 0.5).offsetHSL(0, -1, 0),
      { capBottom: false, capTop: true }))
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        const gusset = chamferedBoxGeometry(
          [H * 0.008, H * 0.052], [H * 0.008, H * 0.012],
          H * 0.1, H * 0.003, [0, 0, 0], paint,
        )
        gusset.translate(0, H * 0.063, H * 0.03)
        gusset.rotateY(a)
        gusset.translate(0, 0, postZ)
        postPieces.push(gusset)
      }

      /* --------------------------------------------------------------- drum */
      /**
       * The punched band, and the two solid ones that close it.
       *
       * A drum punched edge to edge has a row of half holes at each end and
       * reads as torn. The reference's has 75 mm of plain sheet at the top and
       * 65 at the bottom, which is where the rolled rims are, and it is those
       * bands rather than the holes that make the perforation look cut into
       * something.
       */
      const drumPieces: BufferGeometry[] = []
      const bandTop = drumH * 0.14
      const bandBot = drumH * 0.12
      const punchLo = drumBase + bandBot
      const punchHi = drumTop - bandTop

      for (const [lo, hi] of [[drumBase, punchLo], [punchHi, drumTop]] as const) {
        drumPieces.push(latheGeometry([
          { y: lo, radius: R },
          { y: hi, radius: R },
        ], 36, [0, 0, 0], paint, { capBottom: false, capTop: false }))
      }

      /*
       * THREE fields, not one, split by two solid bands.
       *
       * The reference's punching is interrupted twice on the way up, and those
       * bands are structural: a drum of continuous perforation has nothing to
       * hold its shape, so a real one is stiffened at the third points. They
       * are also most of what stops the punching reading as a printed texture,
       * because they give it edges in the middle rather than only at the ends.
       *
       * The helper is called once per field rather than being taught about
       * bands. It punches a surface; where the surface stops is the caller's
       * business, and this way the colander can interrupt its own punching for
       * a completely different reason without changing anything here.
       */
      const fields = 3
      const bandMid = drumH * 0.045
      const fieldH = (punchHi - punchLo - bandMid * (fields - 1)) / fields
      for (let f = 0; f < fields; f += 1) {
        const lo = punchLo + f * (fieldH + bandMid)
        const hi = lo + fieldH
        drumPieces.push(perforate(
          // The surface the punch is mapped onto: a plain cylinder, described
          // by the caller because the helper is not allowed to assume one.
          (u, v): Vec3 => {
            const a = u * Math.PI * 2
            return [Math.sin(a) * R, lo + (hi - lo) * v, Math.cos(a) * R]
          },
          { rows: Math.max(2, Math.round(rows / fields)), columns, open: 0.55, stagger: true },
          paint,
        ))
        if (f < fields - 1) {
          drumPieces.push(latheGeometry([
            { y: hi, radius: R },
            { y: hi + bandMid, radius: R },
          ], 36, [0, 0, 0], paint, { capBottom: false, capTop: false }))
        }
      }

      // The liner: a dark drum just inside, so the holes have something behind
      // them. Without it they open onto whatever is behind the bin and the
      // punching reads as a stencil rather than as a hole.
      drumPieces.push(latheGeometry([
        { y: drumBase + drumH * 0.03, radius: R * 0.955 },
        { y: drumTop - drumH * 0.02, radius: R * 0.955 },
      ], 30, [0, 0, 0], dark, { capBottom: true, capTop: false }))

      // The rolled rims top and bottom, and the bracket that hangs the drum on
      // the post.
      for (const [y, lift] of [[drumBase, -0.04], [drumTop, 0.03]] as const) {
        drumPieces.push(latheGeometry([
          { y: y - drumH * 0.018, radius: R * 1.035 },
          { y: y + drumH * 0.018, radius: R * 1.035 },
        ], 36, [0, 0, 0], tint('steelPainted', lift), { capBottom: false, capTop: false }))
      }
      // TWO compact fittings rather than one long block. A bracket two thirds
      // of the drum's height reads as a spine the bin is welded to; the
      // reference carries it on a pair of short lugs, which is both what a
      // hinge looks like and what says the drum comes off.
      for (const at of [0.16, 0.84]) {
        // Narrow enough to tuck between the drum and the post rather than
        // standing out either side of it: the lug is a fitting, and a fitting
        // that reads as a block is a fitting nobody believes carries anything.
        const lug = chamferedBoxGeometry(
          [H * 0.032, postZ - R * 0.4], [H * 0.027, postZ - R * 0.4],
          drumH * 0.13, H * 0.004, [0, 0, 0], paint,
        )
        lug.translate(0, drumBase + drumH * at, (R * 0.85 + postZ) / 2)
        drumPieces.push(lug)
      }

      /* --------------------------------------------------------------- hood */
      /**
       * A shallow dome on an arm, and it OVERHANGS.
       *
       * The hood is half again the drum's diameter in the reference, which is
       * what keeps rain out of a bin whose whole side is holes. Drawn to the
       * drum's own width it stops reading as a hood at all and becomes a lid.
       */
      const hoodPieces: BufferGeometry[] = []
      const hoodR = R * 1.22
      // A shallow shield, not a mushroom. Taken to a point the hood reads as a
      // parasol; the reference's is a pressing with a flat crown and a rolled
      // edge, and its whole job is to be wider than the drum rather than taller
      // than it.
      hoodPieces.push(latheGeometry([
        { y: hoodY, radius: hoodR },
        // A real vertical lip, deep enough to throw a shadow line round the
        // whole rim: at 8 mm it was an edge, and an edge is not a pressing.
        { y: hoodY + H * 0.014, radius: hoodR },
        { y: hoodY + H * 0.026, radius: hoodR * 0.95 },
        { y: hoodY + H * 0.043, radius: hoodR * 0.79 },
        { y: hoodY + H * 0.055, radius: hoodR * 0.48 },
        { y: hoodY + H * 0.06, radius: hoodR * 0.22 },
      ], 30, [0, 0, 0], tint('steelPainted', 0.04), { capBottom: true, capTop: true }))

      // The arm back to the post, and the pivot it swings about.
      const arm = chamferedBoxGeometry(
        [H * 0.028, postZ + hoodR * 0.55], [H * 0.028, postZ + hoodR * 0.55],
        H * 0.03, H * 0.004, [0, 0, 0], paint,
      )
      arm.translate(0, hoodY - H * 0.012, (postZ - hoodR * 0.55) / 2)
      hoodPieces.push(arm)

      bakeOcclusion(postPieces, { strength: 0.35 })
      bakeOcclusion(drumPieces, { strength: 0.4 })

      // The hood's origin is the pivot, behind the drum on the post, so one
      // rotation swings it up and clear rather than through the rim.
      const pivot = [0, hoodY - H * 0.012, postZ] as const
      return {
        post: { slot: 'steelPainted' as const, geometry: smoothNormals(mergeColoured(postPieces), 34) },
        drum: { slot: 'steelPainted' as const, geometry: smoothNormals(mergeColoured(drumPieces), 34) },
        hood: {
          // Written where it sits and then moved into the PIVOT'S OWN SPACE,
          // because that is the space a part with an origin is expected in:
          // the anchor carries it back. Left in world coordinates it is placed
          // twice and ends up a pivot height above itself.
          slot: 'steelPainted' as const,
          geometry: smoothNormals(
            mergeColoured(hoodPieces).translate(-pivot[0], -pivot[1], -pivot[2]), 34,
          ),
          origin: pivot,
        },
      }
    },

    actions: (runtime) => {
      heldLift = runtime.getConfig().lift
      seenLift = heldLift
      applyLift(runtime, heldLift)
      return { lift: (amount = 1) => { heldLift = amount; applyLift(runtime, amount) } }
    },

    update: (_dt, runtime) => {
      const wanted = runtime.getConfig().lift
      if (wanted !== seenLift) { seenLift = wanted; heldLift = wanted }
      applyLift(runtime, heldLift)
    },
  }, overrides)
}
