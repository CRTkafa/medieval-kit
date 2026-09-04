/**
 * @contemporary-props/parcel-locker-bank
 *
 * A door grid with a mixed size distribution, which the catalogue calls the
 * locker generator's harder case and puts fiftieth. The easy case is a grid:
 * every door the same, pitch derived from the count, and the park bench settled
 * that rule at row thirteen. This is what happens when the doors are not all
 * the same size, which is the whole point of a parcel locker -- a bank that can
 * only take one size of parcel is a bank half of which is always empty.
 *
 * The arithmetic lives in core as `splitRuns`, because three rows in three
 * domains want it: the locker bank in the office, this in the street, and the
 * server rack in computing. What stays here is the door itself, which is a box
 * with a handle and is not worth sharing.
 *
 * Each bay gets its OWN pattern, chosen from the seeded random. That is what
 * makes the reference look like a parcel locker rather than a filing cabinet:
 * five bays, one of six equal doors, one of three tall ones, one of four small
 * over two large. The distribution is the object.
 *
 * Measured off the reference: 2.0 m tall including a 120 mm recessed kick,
 * 2.2 m across five bays, 600 deep, with a top cap standing slightly proud.
 * Doors face +Z, which is where the kit's renderer stands -- written the other
 * way round, as the utility cabinet was, every picture is of the back.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  smoothNormals,
  splitRuns,
  type RuntimeContext,
} from '../core/index.ts'

export interface LockerBankConfig {
  /** Width across all bays (metres). */
  readonly width: number
  /** Height including the kick (metres). */
  readonly height: number
  /** Depth front to back (metres). */
  readonly depth: number
  /** Bays across. */
  readonly bays: number
  /** How far every door swings, 0 shut to 1 wide. */
  readonly open: number
  readonly seed: number
}

export const lockerBankDefaults: LockerBankConfig = {
  width: 2.2,
  height: 2,
  depth: 0.6,
  bays: 5,
  open: 0,
  seed: 17,
}

export type LockerBankParts = 'carcass' | 'doors'

export interface LockerBankActions {
  /** Swings every door. 1 is wide open. */
  open(amount?: number): void
}

function applyOpen(
  runtime: RuntimeContext<LockerBankConfig, LockerBankParts>,
  amount: number,
): void {
  runtime.parts.doors.anchor.rotation.y = -Math.min(1, Math.max(0, amount)) * 1.9
}

export function createModel(overrides: Partial<LockerBankConfig> = {}) {
  let heldOpen = 0
  let seenOpen = Number.NaN

  return createKitModel<
    LockerBankConfig, 'steelPainted', LockerBankParts, LockerBankActions
  >({
    id: 'parcel-locker-bank',
    defaults: lockerBankDefaults,
    slots: ['steelPainted'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const W = Math.min(4, Math.max(0.6, config.width))
      const H = Math.min(2.6, Math.max(1, config.height))
      const D = Math.min(1, Math.max(0.3, config.depth))
      const bays = Math.max(1, Math.round(config.bays))

      // Small lifts only: the palette's painted steel measures 0.202 in linear
      // lightness and anything past -0.19 clamps to black, which the utility
      // cabinet found the hard way.
      const paint = tint('steelPainted', 0.02 + jitter(random, 0.015))
      const shade = tint('steelPainted', -0.1, 0.5)
      const dark = tint('steelPainted', -0.15, 0.4)

      const kickH = H * 0.06
      const capH = H * 0.026
      const frontH = H - kickH - capH
      const frontY = kickH + frontH / 2
      const doorT = D * 0.03
      const faceZ = D / 2

      const carcassPieces: BufferGeometry[] = []
      const doorPieces: BufferGeometry[] = []

      /* ------------------------------------------------------------ carcass */
      carcassPieces.push(chamferedBoxGeometry(
        [W, D], [W, D], frontH, W * 0.004, [0, frontY, 0], shade,
      ))
      // The kick, set back so the bank reads as standing on a plinth rather
      // than sitting on the floor.
      carcassPieces.push(chamferedBoxGeometry(
        [W * 0.985, D * 0.94], [W * 0.985, D * 0.94],
        kickH, W * 0.004, [0, kickH / 2, 0], dark,
      ))
      // The cap, standing proud all round, which is what stops the top edge
      // reading as a cut.
      carcassPieces.push(chamferedBoxGeometry(
        [W * 1.012, D * 1.02], [W * 1.008, D * 1.016],
        capH, W * 0.004, [0, H - capH / 2, 0], paint,
      ))

      /**
       * The bays, and then the tiers inside each one.
       *
       * Both splits go through the same helper. The bays are equal, so their
       * weights are all one; the tiers are not, and each bay draws its own
       * pattern. The patterns are written as weights rather than as heights so
       * they hold whatever the bank's height is set to.
       */
      const PATTERNS: ReadonlyArray<readonly number[]> = [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [2, 3, 3],
        [1, 1, 1, 1, 3, 3],
        [2, 2, 2, 3, 3],
        [1, 1, 2, 2, 2],
      ]

      const gap = H * 0.006
      const bayRuns = splitRuns(W * 0.99, gap * 1.4, Array.from({ length: bays }, () => 1))

      /**
       * One PAIR of bays is merged, and its lower half carries doors spanning
       * both.
       *
       * Varying only the tier heights gives a bank whose every door is one bay
       * wide, and a parcel locker's whole reason for existing is that a parcel
       * is not one size. The reference has two double-width doors stacked
       * across its right-hand pair, and without them the distribution is a
       * column exercise rather than the harder case the catalogue asked for.
       *
       * The merge is seeded and it is one pair, not a scatter: two adjacent
       * bays give up their bottom two thirds to a pair of wide doors and keep
       * their own patterns above.
       */
      const mergeAt = bays >= 2 ? Math.floor(random() * (bays - 1)) : -1
      const mergeFrac = 0.56

      const chosen = new Set<number>()
      const patternFor = (): readonly number[] => {
        // Drawn WITHOUT replacement while there are patterns left, so five bays
        // get five different divisions. Drawn with replacement the seeded pick
        // repeats and the bank comes out looking ruled.
        for (let tries = 0; tries < 24; tries += 1) {
          const i = Math.floor(random() * PATTERNS.length) % PATTERNS.length
          if (!chosen.has(i) || chosen.size >= PATTERNS.length) {
            chosen.add(i)
            return PATTERNS[i]!
          }
        }
        return PATTERNS[0]!
      }

      /** One door, plus the handle that is the only thing distinguishing it. */
      const addDoor = (x: number, y: number, w: number, h: number): void => {
        doorPieces.push(chamferedBoxGeometry(
          [w, doorT], [w * 0.995, doorT],
          h, Math.min(w, h) * 0.035, [x, y, faceZ + doorT / 2], paint,
        ))

        /*
         * The handle: a RECESSED slot in a surround, not a lever.
         *
         * A parcel locker's door is flush, because there is nothing to catch a
         * shoulder on in a doorway, so the grip is pressed into the skin. The
         * surround is what makes it read -- a bare slot at this size is a mark,
         * and the reference's has a clear rectangular border round it.
         */
        const grip = Math.min(h * 0.5, W * 0.045)
        const gx = x - w * 0.4
        doorPieces.push(chamferedBoxGeometry(
          [grip * 0.62, doorT * 0.55], [grip * 0.58, doorT * 0.45],
          grip, grip * 0.1, [gx, y, faceZ + doorT * 1.05], shade,
        ))
        doorPieces.push(chamferedBoxGeometry(
          [grip * 0.3, doorT * 0.4], [grip * 0.26, doorT * 0.3],
          grip * 0.6, grip * 0.06, [gx, y, faceZ + doorT * 1.25], dark,
        ))
      }

      for (let b = 0; b < bayRuns.length; b += 1) {
        const bay = bayRuns[b]!
        const merged = b === mergeAt || b === mergeAt + 1
        // A merged bay keeps only its top, so the wide doors below have room.
        const span = merged ? frontH * (1 - mergeFrac) : frontH * 0.985
        const top = merged ? frontY + frontH / 2 - span / 2 : frontY

        for (const tier of splitRuns(span, gap, patternFor())) {
          addDoor(bay.at, top + tier.at, bay.size * 0.97, tier.size)
        }
      }

      if (mergeAt >= 0) {
        const left = bayRuns[mergeAt]!
        const right = bayRuns[mergeAt + 1]!
        const wide = (right.at + right.size / 2) - (left.at - left.size / 2)
        const centre = (left.at - left.size / 2 + right.at + right.size / 2) / 2
        const span = frontH * mergeFrac - gap
        const top = frontY - frontH / 2 + span / 2
        for (const tier of splitRuns(span, gap, [1, 1])) {
          addDoor(centre, top + tier.at, wide * 0.985, tier.size)
        }
      }

      bakeOcclusion(carcassPieces, { strength: 0.4 })
      bakeOcclusion(doorPieces, { strength: 0.35 })

      // Every door turns about the bank's left edge, which is a simplification
      // the catalogue's own action signature invites -- it asks for individual
      // doors, and a per-door part would be forty parts and forty anchors. One
      // hinge line demonstrates the mechanism; a consumer who needs one door
      // open takes the geometry and does it themselves.
      const hinge = [-W / 2, 0, faceZ] as const
      return {
        carcass: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(mergeColoured(carcassPieces), 30),
        },
        doors: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(
            mergeColoured(doorPieces).translate(-hinge[0], -hinge[1], -hinge[2]), 30,
          ),
          origin: hinge,
        },
      }
    },

    actions: (runtime) => {
      heldOpen = runtime.getConfig().open
      seenOpen = heldOpen
      applyOpen(runtime, heldOpen)
      return { open: (amount = 1) => { heldOpen = amount; applyOpen(runtime, amount) } }
    },

    update: (_dt, runtime) => {
      const wanted = runtime.getConfig().open
      if (wanted !== seenOpen) { seenOpen = wanted; heldOpen = wanted }
      applyOpen(runtime, heldOpen)
    },
  }, overrides)
}
