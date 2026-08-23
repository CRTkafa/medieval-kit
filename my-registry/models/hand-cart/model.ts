/**
 * @medieval-kit/hand-cart
 *
 * A two-wheeled handcart: a planked body on an axle, with two shafts to pull
 * it by.
 *
 * The kit already had `cart-wheel` and nothing to put it on. That is the gap
 * this fills, and it fills a second one at the same time: every container in
 * the catalogue — crates, sacks, barrels, baskets — is a thing you would
 * MOVE, and there was no way to move any of it.
 *
 * Two details carry the whole design, and both are about where the axle is:
 *
 *   - It sits BEHIND the middle of the bed, not under it. A handcart is
 *     balanced so that a loaded body rests a little weight on the puller's
 *     hands rather than trying to tip backwards out of them, and the wheels go
 *     aft of centre to do it.
 *   - The shafts slope DOWN from the bed's front and rest on the ground when
 *     the cart is parked. That is not the cart tipping: the bed stays level
 *     and the shafts leave it at an angle, which is what lets one person pick
 *     them up to waist height without the load shifting.
 *
 * Parts: `wheels` (the pair and their axle, with its own origin at the axle so
 * `setRoll` turns them in place), `bed`, `sides` and `shafts`.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface HandCartConfig {
  /** Length of the cart's bed (metres). */
  readonly bedLength: number
  /** Width of the bed (metres). */
  readonly bedWidth: number
  /** Height of the side boards above the bed (metres). */
  readonly sideHeight: number
  /** Wheel radius (metres). */
  readonly wheelRadius: number
  /** Spokes in each wheel. */
  readonly spokes: number
  /** Length of the shafts beyond the bed (metres). */
  readonly shaftLength: number
  /** Wheel rotation (radians). */
  readonly roll: number
  readonly seed: number
}

export const handCartDefaults: HandCartConfig = {
  bedLength: 1.34,
  bedWidth: 0.66,
  sideHeight: 0.28,
  wheelRadius: 0.33,
  spokes: 10,
  shaftLength: 1.15,
  roll: 0,
  seed: 61,
}

export type HandCartParts = 'wheels' | 'bed' | 'sides' | 'shafts'

export interface HandCartActions {
  /** Turns the wheels. */
  setRoll(radians: number): void
  roll(): number
}

export function createModel(overrides: Partial<HandCartConfig> = {}) {
  let roll = 0

  return createKitModel<HandCartConfig, 'oak' | 'iron', HandCartParts, HandCartActions>({
    id: 'hand-cart',
    defaults: handCartDefaults,
    slots: ['oak', 'iron'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = config.bedLength
      const W = config.bedWidth
      const wheelR = config.wheelRadius
      const plank = W * 0.035

      // Ground at y = 0: this model rests on its wheels and its shaft tips, and
      // building from the floor up keeps all three of those at one datum.
      const axleY = wheelR
      const bedY = axleY + plank * 2.6
      // Aft of centre, so a load leans on the puller rather than away from him.
      const axleZ = L * 0.16

      // --- Wheels and axle ------------------------------------------------------
      const spokes = Math.max(6, Math.round(config.spokes))
      const felloeOuter = wheelR * 0.9
      const felloeInner = felloeOuter * 0.8
      const hubR = wheelR * 0.19
      const wheelX = W / 2 + plank * 2.2
      const wheelBody: BufferGeometry[] = []
      const wheelIron: BufferGeometry[] = []

      for (const side of [-1, 1]) {
        const parts: BufferGeometry[] = []
        // Hub, turned and belled at both ends the way a nave is.
        parts.push(latheGeometry(
          [
            { y: -wheelR * 0.16, radius: hubR * 0.72 },
            { y: -wheelR * 0.1, radius: hubR },
            { y: wheelR * 0.1, radius: hubR },
            { y: wheelR * 0.16, radius: hubR * 0.72 },
          ] as Level[],
          9, [0, 0, 0], tint('oak', -0.02, 1.1),
        ))
        // Spokes. Each reaches INTO the hub at one end and INTO the felloe at
        // the other, so both joints are overlaps rather than faces meeting.
        const spokeInner = hubR * 0.5
        const spokeLength = felloeInner - spokeInner + wheelR * 0.06
        for (let i = 0; i < spokes; i += 1) {
          const a = (i / spokes) * Math.PI * 2
          const spoke = taperedBoxGeometry(
            [wheelR * 0.075, wheelR * 0.055],
            [wheelR * 0.058, wheelR * 0.045],
            spokeLength,
            [0, spokeLength / 2 + spokeInner, 0],
            tint('oak', jitter(random, 0.05)),
          )
          spoke.rotateZ(a + jitter(random, 0.012))
          parts.push(spoke)
        }
        // Felloe: separate segments, because a wheel rim is built from arcs of
        // timber and a turned ring reads as a hoop.
        for (let i = 0; i < spokes; i += 1) {
          const a = ((i + 0.5) / spokes) * Math.PI * 2
          const mid = (felloeOuter + felloeInner) / 2
          const arc = (Math.PI * 2 * mid) / spokes
          const seg = taperedBoxGeometry(
            [arc * 1.06, felloeOuter - felloeInner],
            [arc * 1.02, (felloeOuter - felloeInner) * 0.96],
            wheelR * 0.14 * (1 + jitter(random, 0.05)),
            [0, 0, 0],
            tint('oak', -0.05 + jitter(random, 0.05)),
          )
          // Built lying flat with its height along Y; standing it on edge and
          // then swinging it round puts its thickness across the wheel.
          seg.rotateX(Math.PI / 2)
          seg.rotateZ(a)
          seg.translate(Math.cos(a) * mid, Math.sin(a) * mid, 0)
          parts.push(seg)
        }
        const wheel = mergeColoured(parts)
        wheel.rotateY(Math.PI / 2)
        wheel.translate(side * wheelX, axleY, axleZ)
        wheelBody.push(wheel)

        // Iron tyre, set INTO the tread and narrower than the felloe, the same
        // way the cart wheel's is: anything within the felloe's own thickness
        // will sooner or later share a plane with one of its segments.
        const tyre = bandGeometry(
          wheelR, 0, wheelR * 0.115, wheelR * 0.1, spokes * 2,
          tint('iron', jitter(random, 0.04), 0.7), { inner: true },
        )
        tyre.rotateZ(Math.PI / 2)
        tyre.translate(side * wheelX, axleY, axleZ)
        wheelIron.push(tyre)
      }

      // Axle: through both hubs, so the pair is one object.
      const axle = taperedBoxGeometry(
        [hubR * 0.8, hubR * 0.8],
        [hubR * 0.8, hubR * 0.8],
        wheelX * 2 + hubR,
        [0, 0, 0],
        tint('oak', -0.1),
      )
      axle.rotateZ(Math.PI / 2)
      axle.translate(0, axleY, axleZ)
      wheelBody.push(axle)

      // --- Bed ------------------------------------------------------------------
      const floorBoards: BufferGeometry[] = []
      const boards = 5
      for (let i = 0; i < boards; i += 1) {
        const w = W / boards
        floorBoards.push(chamferedBoxGeometry(
          [w * 0.97, L],
          [w * 0.95, L * 0.998],
          plank,
          plank * 0.14,
          [(i + 0.5) * w - W / 2, bedY, 0],
          tint('oak', 0.03 + jitter(random, 0.05)),
        ))
      }
      // Cross bearers under the boards, and the axle bed they sit on.
      for (const at of [-0.36, 0, 0.36]) {
        floorBoards.push(chamferedBoxGeometry(
          [W * 1.02, L * 0.07],
          [W * 0.99, L * 0.06],
          plank * 1.5,
          plank * 0.12,
          [0, bedY - plank * 1.2, at * L],
          tint('oak', -0.08),
        ))
      }
      floorBoards.push(chamferedBoxGeometry(
        [wheelX * 2 - hubR, L * 0.1],
        [wheelX * 2 - hubR * 1.6, L * 0.09],
        plank * 1.8,
        plank * 0.12,
        [0, bedY - plank * 2.3, axleZ],
        tint('oak', -0.12),
      ))

      // --- Sides ----------------------------------------------------------------
      const walls: BufferGeometry[] = []
      const iron: BufferGeometry[] = []
      const sideH = config.sideHeight

      for (const side of [-1, 1]) {
        // Two boards to a side, with a gap between them: a cart side is
        // planked, not panelled, and the gap is what says so.
        for (const [row, at] of [[0, 0.27], [1, 0.74]] as const) {
          walls.push(chamferedBoxGeometry(
            [plank, L * 0.99],
            [plank * 0.94, L * 0.985],
            sideH * 0.42,
            plank * 0.16,
            [side * (W / 2 + plank * 0.5), bedY + sideH * at, 0],
            tint('oak', (row === 0 ? -0.02 : 0.04) + jitter(random, 0.05)),
          ))
        }
        // Corner and middle stakes: the uprights the boards are nailed to.
        for (const at of [-0.46, 0, 0.46]) {
          walls.push(chamferedBoxGeometry(
            [plank * 1.4, L * 0.055],
            [plank * 1.2, L * 0.05],
            sideH * 1.08,
            plank * 0.16,
            [side * (W / 2 + plank * 1.1), bedY + sideH * 0.5, at * L],
            tint('oak', -0.05),
          ))
        }
      }
      // End boards, front and back.
      for (const end of [-1, 1]) {
        walls.push(chamferedBoxGeometry(
          [W + plank * 2.2, plank],
          [W + plank * 1.9, plank * 0.94],
          sideH * 0.92,
          plank * 0.16,
          [0, bedY + sideH * 0.5, end * (L / 2 - plank * 0.5)],
          tint('oak', -0.01 + jitter(random, 0.04)),
        ))
      }

      // --- Shafts ---------------------------------------------------------------
      // They leave the bed's front and slope down to the ground. The angle is
      // DERIVED from where they have to end, not chosen: a shaft that stops
      // short hangs in the air and one that goes long pushes the cart over.
      const shafts: BufferGeometry[] = []
      const rootY = bedY - plank * 1.2
      const rootZ = -L / 2
      const shaftDrop = rootY
      const reach = config.shaftLength
      const lean = Math.atan2(shaftDrop, reach)
      const shaftLength = Math.hypot(shaftDrop, reach)
      const shaftX = W / 2 - plank * 1.6

      for (const side of [-1, 1]) {
        const shaft = latheGeometry(
          [
            { y: -shaftLength / 2, radius: plank * 0.62 },
            { y: -shaftLength * 0.42, radius: plank * 0.72 },
            { y: shaftLength * 0.36, radius: plank * 0.86 },
            { y: shaftLength / 2, radius: plank * 0.95 },
          ] as Level[],
          7, [0, 0, 0], tint('oak', 0.02 + jitter(random, 0.05), 1.1),
        )
        // Built upright; leaning it about X drops its lower end forward, and
        // the 4% overrun at the top buries its head in the cart's frame.
        shaft.rotateX(Math.PI / 2 - lean)
        shaft.translate(
          side * shaftX,
          rootY - shaftDrop / 2,
          rootZ - reach / 2,
        )
        shafts.push(shaft)

        // The strap that holds the shaft to the frame. It is the only reason
        // the two are joined at all.
        iron.push(boxGeometry(
          [plank * 2.4, plank * 0.5, L * 0.09],
          [side * shaftX, rootY + plank * 0.5, rootZ + L * 0.03],
          new Color(tint('iron', 0.02, 0.7)),
        ))
      }
      // Cross handle between the shaft tips, so the cart can be pulled by one
      // person with both hands.
      shafts.push(latheGeometry(
        [
          { y: -shaftX - plank, radius: plank * 0.6 },
          { y: shaftX + plank, radius: plank * 0.6 },
        ] as Level[],
        7, [0, 0, 0], tint('oak', 0.06, 1.1),
      ).rotateZ(Math.PI / 2).translate(0, plank * 0.62, rootZ - reach * 0.88))

      return {
        wheels: {
          slot: 'oak' as const,
          geometry: mergeColoured(wheelBody),
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(wheelIron) }],
          origin: [0, axleY, axleZ] as const,
        },
        bed: { slot: 'oak' as const, geometry: mergeColoured(floorBoards) },
        sides: {
          slot: 'oak' as const,
          geometry: mergeColoured(walls),
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(iron) }],
        },
        shafts: { slot: 'oak' as const, geometry: mergeColoured(shafts) },
      }
    },

    actions: ({ parts, getConfig }) => {
      roll = getConfig().roll
      parts.wheels.anchor.rotation.x = roll
      return {
        setRoll: (radians) => {
          roll = radians
          parts.wheels.anchor.rotation.x = roll
        },
        roll: () => roll,
      }
    },
  }, overrides)
}
