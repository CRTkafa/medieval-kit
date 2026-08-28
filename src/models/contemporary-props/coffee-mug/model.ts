/**
 * @contemporary-props/coffee-mug
 *
 * The kit's second revolve, and its first join: a swept handle attached to a
 * lathed body. The join is the point. The kettle, the jug, the watering can
 * and the saucepan all reuse it, so the mug is where it has to be got right.
 *
 * Two things separate a mug from the vase it inherits its lathe from:
 *
 *   the bore    a mug is looked INTO. The profile goes up the outside, rolls
 *               over the rim, and comes back down inside to a floor, so the
 *               rim has a measurable thickness and the inner wall catches
 *               light. The vase could skip its bore; a mug with no bore is a
 *               dummy prop and reads as one from any angle above the rim.
 *
 *   the handle  a strap, not a rod. The section is wider across than it is
 *               deep, which is what says "ceramic pulled from the wall"
 *               rather than "wire bent into a loop". It is one arc whose two
 *               ends land INSIDE the wall: the end depth is computed from the
 *               wall thickness and the cap tilt so that at every value of the
 *               `handle` control the caps stay buried, clear of the outer
 *               surface on one side and of the bore on the other. On a
 *               tapered body the loop tilts to follow the wall, the way a
 *               real handle is stuck on parallel to the side it joins.
 *
 * The wall is deliberately chunky, diner-mug thick. Partly because that is
 * what a stoneware mug is, and partly because the wall is the material the
 * handle ends are buried in: a fine porcelain wall leaves no solid for the
 * join to live inside.
 *
 * Parts: `body` and `handle`. The handle is the part a consumer will want to
 * reach separately, whether to drop it for an espresso cup or to recolour a
 * glazed accent.
 */
import { type BufferGeometry } from 'three'

import {
  arcBarGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Level,
} from '../core/index.ts'

export interface CoffeeMugConfig {
  /** Overall height (metres). */
  readonly height: number
  /** Outer radius at the rim (metres). */
  readonly radius: number
  /** Foot radius as a fraction of the rim radius. 1 is a straight diner mug. */
  readonly taper: number
  /** How far the handle bows out. 1 is a standard loop. */
  readonly handle: number
  /** Sides around the revolve. Low values are a deliberate faceted look. */
  readonly segments: number
  readonly seed: number
}

export const coffeeMugDefaults: CoffeeMugConfig = {
  height: 0.095,
  radius: 0.041,
  // A slight taper. Dead straight is a value in the family, not the default:
  // most mugs narrow a little toward the foot and it keeps the silhouette
  // from reading as a cut length of pipe.
  taper: 0.9,
  handle: 1,
  segments: 32,
  seed: 7,
}

export type CoffeeMugParts = 'body' | 'handle'

export function createModel(overrides: Partial<CoffeeMugConfig> = {}) {
  return createKitModel<CoffeeMugConfig, 'ceramic', CoffeeMugParts>({
    id: 'coffee-mug',
    defaults: coffeeMugDefaults,
    slots: ['ceramic'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = config.height
      const R = config.radius
      const taper = Math.min(1, Math.max(0.7, config.taper))
      const F = R * taper
      const segments = Math.max(10, Math.round(config.segments))

      // The wall. Thick enough to read at the rim and, just as important,
      // thick enough that the handle ends can be buried in it with margin on
      // both faces. The floor stops a small mug from getting a paper wall.
      const wall = Math.max(0.0058, R * 0.15)
      // A mug's base is heavier than its wall; the bore floor sits up here.
      const base = Math.max(0.006, H * 0.085)

      // Outer radius at height y: a straight taper with a faint barrel bow.
      // The bow is under two percent, which is invisible as a shape but keeps
      // a highlight moving along the wall instead of sitting in one stripe.
      const rOut = (y: number): number => {
        const f = y / H
        return (F + (R - F) * f) * (1 + 0.013 * Math.sin(Math.PI * f))
      }

      /* ------------------------------------------------------------- body */
      // One profile, up the outside, over the rim, down the bore. A single
      // lathe leaves no coincident faces where an outer and an inner shell
      // would meet, and the rim thickness falls out of the turn-around.
      const half = wall / 2
      const rimY = H - half
      const rimX = R - half
      const s45 = half * Math.SQRT1_2
      const levels: Level[] = [
        // A short chamfer off the table, so the foot has an edge that reads
        // as trimmed rather than the wall dying into the ground plane.
        { y: 0, radius: F * 0.96 },
        { y: 0.0035, radius: rOut(0.0035) },
        { y: H * 0.2, radius: rOut(H * 0.2) },
        { y: H * 0.45, radius: rOut(H * 0.45) },
        { y: H * 0.7, radius: rOut(H * 0.7) },
        { y: H * 0.88, radius: rOut(H * 0.88) },
        // The rim, rolled as a half circle of the wall's own thickness,
        // sampled every 45 degrees so smoothing reads it as a curve.
        { y: rimY, radius: R },
        { y: H - half + s45, radius: rimX + s45 },
        { y: H, radius: rimX },
        { y: H - half + s45, radius: rimX - s45 },
        { y: rimY, radius: R - wall },
        // Down the bore. Same profile as the outside, one wall in, so the
        // rim reads as an even thickness from every angle that sees into it.
        { y: H * 0.66, radius: rOut(H * 0.66) - wall },
        { y: H * 0.42, radius: rOut(H * 0.42) - wall },
        { y: base + 0.0025, radius: rOut(base + 0.0025) - wall },
        { y: base, radius: rOut(base + 0.0025) - wall - 0.0012 },
      ]

      const glaze = tint('ceramic', jitter(random, 0.02))
      const body = latheGeometry(
        levels,
        segments,
        [0, 0, 0],
        glaze,
        // The index ramp runs foot -> rim -> floor, so the outside lightens
        // toward the rim the way thinning glaze does, and the bore stays a
        // touch lighter than the outside, which stops it going to mud once
        // the renderer shades the cavity.
        { colourTop: tint('ceramic', 0.05), capBottom: true, capTop: true },
      )

      /* ----------------------------------------------------------- handle */
      // Strap section: deeper across (z, along the wall) than radially. Built
      // square by arcBarGeometry, flattened by a scale before it moves.
      const scaleT = R / 0.041
      const tRad = Math.min(0.0072, Math.max(0.0048, 0.006 * scaleT))
      const widthZ = Math.min(0.0135, Math.max(0.0088, 0.0115 * scaleT))

      // Where the loop leaves the wall.
      const topY = H * 0.78
      const botY = H * 0.36
      const wallTop = rOut(topY)
      const wallBot = rOut(botY)

      // End angle past 90 degrees turns the ends in toward the wall; the
      // `handle` control widens the bow. Capped where the cap tilt would
      // start pushing corners through the bore.
      const bow = Math.min(1.3, Math.max(0.7, config.handle))
      const thetaE = (Math.PI / 180) * Math.min(125, Math.max(109, 95 + 23 * bow))

      // Bury depth for the end caps. The cap is a tilted rectangle: its
      // corners reach `capTilt` past the end centre radially, and at the
      // strap's z-edges the round wall has receded by `recess`. The depth
      // sits centred between "corner breaks out of the wall" and "corner
      // breaks into the bore", with margin on both sides.
      const capTilt = Math.abs(Math.cos(thetaE)) * (tRad / 2)
      const recess = wallBot - Math.sqrt(Math.max(0, wallBot * wallBot - (widthZ / 2) ** 2))
      const dMin = recess + 0.0006 + capTilt
      const dMax = wall - 0.0006 - capTilt
      const depth = dMin < dMax ? (dMin + dMax) / 2 : wall * 0.5

      const eTop = { x: wallTop - depth, y: topY }
      const eBot = { x: wallBot - depth, y: botY }
      const chordX = eTop.x - eBot.x
      const chordY = eTop.y - eBot.y
      const chord = Math.hypot(chordX, chordY)
      const rLoop = chord / 2 / Math.sin(thetaE)
      // Tilt that lays the loop's chord along the wall slope, so on a tapered
      // body both ends sit at the same depth instead of one floating proud.
      const alpha = Math.atan2(-chordX, chordY)

      const strap = arcBarGeometry(
        rLoop, tRad, -thetaE, thetaE, 22, [0, 0, 0],
        // The body's own glaze colour: a handle tinted separately shows the
        // join as a colour edge before it shows it as geometry.
        glaze.clone(),
      )
      // Flatten to a strap, tilt to the wall, then carry to the wall. Built
      // at the origin in the XY plane, which is already the vertical plane
      // the loop lives in, so no other rotation is needed.
      strap.scale(1, 1, widthZ / tRad)
      strap.rotateZ(alpha)
      const endBotX = rLoop * Math.cos(thetaE)
      const endBotY = -rLoop * Math.sin(thetaE)
      strap.translate(
        eBot.x - (Math.cos(alpha) * endBotX - Math.sin(alpha) * endBotY),
        eBot.y - (Math.sin(alpha) * endBotX + Math.cos(alpha) * endBotY),
        0,
      )

      const bodyPieces: BufferGeometry[] = [body]
      // Smoothed at 50: the rim's 45 degree steps round over, while the foot
      // chamfer against the base cap stays an edge. The handle smooths along
      // its sweep at 40 and keeps its four strap edges crisp, which is what
      // makes the section read as a section.
      return {
        body: { slot: 'ceramic' as const, geometry: smoothNormals(mergeColoured(bodyPieces), 50) },
        handle: { slot: 'ceramic' as const, geometry: smoothNormals(strap, 40) },
      }
    },
  }, overrides)
}
