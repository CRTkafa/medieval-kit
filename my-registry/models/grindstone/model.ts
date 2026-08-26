/**
 * @medieval-kit/grindstone
 *
 * A treadle grindstone: a sandstone wheel turning in a timber trestle, with a
 * crank to work it and a trough of water underneath.
 *
 * The kit has an anvil, a forge and four edged tools, and nothing that put an
 * edge on any of them. This is the machine that did — the one piece of village
 * equipment with a moving part in it, which is why it turns.
 *
 * The wheel is `limestone` rather than `stone`, and that was measured rather
 * than assumed: the reference wheel reads hue 32.5, saturation 0.196,
 * lightness 0.511 against the trough limestone's 36.6, 0.161, 0.500. Close
 * enough that a sandstone wheel and a weathered trough are the same rock as
 * far as this palette is concerned, and nowhere near the grey `stone` of a
 * dressed wall.
 *
 * The frame is oak taken well down in value. The reference's timber reads
 * lightness 0.25 against the palette's 0.40 — it is a machine left in a yard,
 * not sawn boards — but it stays `oak`, because a third wood key for one model
 * would be describing the weather rather than the material.
 *
 * What is NOT here, said plainly: the reference has a treadle and a linkage
 * down to a foot board, and this has a hand crank instead. Both are period.
 * The treadle is three more moving parts to serve an animation that already
 * reads from the crank, and the crank is the half of the reference that says
 * "this turns" without being run.
 */
import { Color, type BufferGeometry } from 'three'

import {
  boxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface GrindstoneConfig {
  /** Diameter of the wheel (metres). */
  readonly diameter: number
  /** Thickness of the wheel (metres). */
  readonly thickness: number
  /** Height of the axle above the ground (metres). */
  readonly height: number
  /** Length of the frame (metres). */
  readonly length: number
  /** How far the legs splay out on their way down. */
  readonly splay: number
  /** How full the trough stands, as a fraction of its depth. 0 is dry. */
  readonly water: number
  readonly seed: number
}

export const grindstoneDefaults: GrindstoneConfig = {
  diameter: 0.62,
  // 0.16 of the diameter, off the reference. A grindstone is a MILLSTONE's
  // proportions, not a saw blade's: thin enough to read as a disc, thick
  // enough that its rim is a working surface you could hold a blade against.
  thickness: 0.1,
  height: 0.63,
  length: 1,
  splay: 0.26,
  water: 0.6,
  seed: 23,
}

export type GrindstoneParts = 'wheel' | 'frame' | 'crank' | 'water'

export interface GrindstoneActions {
  /** Give the wheel a turn. Repeated cranking builds speed. */
  readonly crank: () => void
  /** Stop it dead. */
  readonly still: () => void
  readonly isTurning: () => boolean
  /** Turns completed since the model was built. */
  readonly turns: () => number
}

export function createModel(overrides: Partial<GrindstoneConfig> = {}) {
  let angle = 0
  let speed = 0
  let turned = 0

  return createKitModel<GrindstoneConfig, 'stone' | 'oak' | 'iron' | 'water', GrindstoneParts, GrindstoneActions>({
    id: 'grindstone',
    defaults: grindstoneDefaults,
    slots: ['stone', 'oak', 'iron', 'water'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const R = Math.max(0.08, config.diameter) / 2
      const T = Math.max(0.02, config.thickness)
      const axleY = Math.max(R * 0.9, config.height)
      const L = Math.max(0.4, config.length)
      const splay = Math.max(0, config.splay)

      /** Weathered rather than sawn: the reference's timber is 0.15 down on the palette. */
      const timber = (lift = 0): Color => {
        const c = tint('oak', -0.11 + lift, 0.85)
        c.offsetHSL(0, -0.11, 0)
        return c
      }

      // --- Wheel --------------------------------------------------------
      /**
       * A disc with a barrelled rim, built about Y and stood up with ONE turn.
       *
       * `latheGeometry` revolves about the Y axis, so it comes out lying flat
       * like a millstone on the floor. `rotateX(90)` sends +Y to +Z, which
       * puts the axle along Z — and Z is across the frame, which is where an
       * axle goes. The wheel then turns about Z, so the action is a single
       * `rotation.z` and there is no chain of rotations to get wrong.
       */
      const wheel = latheGeometry(
        [
          { y: -T / 2, radius: R * 0.985 },
          { y: -T * 0.3, radius: R },
          { y: T * 0.3, radius: R },
          { y: T / 2, radius: R * 0.985 },
        ] as Level[],
        16, [0, 0, 0], tint('limestone', -0.02, 0.7),
      )
      wheel.rotateX(Math.PI / 2)
      // A worn wheel is not a machined one. Small, because a grinding face
      // that is visibly lumpy is a wheel nobody would put a blade near.
      roughenGeometry(wheel, R * 0.012, { salt: 7 })

      // --- Frame --------------------------------------------------------
      const frame: BufferGeometry[] = []
      // 0.2 of the wheel's radius, not 0.15. At 0.15 the frame came out
      // spindly next to a reference whose timber is heavy enough to stand
      // being leant on while the wheel is worked — and a machine that looks
      // like it would rack is a machine nobody would put a blade to.
      const post = R * 0.2
      // The axle's radius is needed up here to size the bearing blocks and
      // again below to build the axle itself. One number, named once.
      const axleGuess = post * 0.3
      const railZ = T * 0.9 + post
      const railY = axleY - post * 1.4

      /**
       * A strut from one point to another.
       *
       * Built along +Y with its foot at the ORIGIN and turned into place, which
       * is the one construction in this kit that has never gone wrong: a piece
       * built where it is going to be rotated gets flung away by the rotation,
       * a piece built at the origin does not. The two angles are the ordinary
       * spherical pair and they are derived from the two ends rather than
       * chosen, so a leg cannot end up pointing somewhere its endpoints do not.
       */
      const strut = (
        from: readonly [number, number, number],
        to: readonly [number, number, number],
        thick: number,
        taper: number,
        colour: Color,
      ): BufferGeometry => {
        const dx = to[0] - from[0]
        const dy = to[1] - from[1]
        const dz = to[2] - from[2]
        const len = Math.hypot(dx, dy, dz)
        const bar = taperedBoxGeometry(
          [thick, thick],
          [thick * taper, thick * taper],
          len,
          [0, len / 2, 0],
          colour,
        )
        const tilt = Math.acos(Math.max(-1, Math.min(1, dy / len)))
        // rotateZ then rotateY sends +Y to (-sin t cos a, cos t, sin t sin a),
        // so the bearing that lands on (dx, dz) is atan2(dz, -dx).
        bar.rotateZ(tilt)
        bar.rotateY(Math.atan2(dz, -dx))
        bar.translate(from[0], from[1], from[2])
        return bar
      }

      // Four legs, one to a corner, splaying out in both directions on the way
      // down so the thing cannot be pushed over while it is being worked.
      const topX = L / 2 - post
      const footX = topX + splay * railY
      const footZ = railZ + splay * railY * 0.55
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          frame.push(strut(
            [sx * footX, 0, sz * footZ],
            // Past the rail rather than up to it: the leg's head shows above
            // the rail as a through-tenon, which is the joint the reference
            // makes a feature of at every corner.
            [sx * topX, railY + post * 1.5, sz * railZ],
            post, 0.86, timber(jitter(random, 0.04)),
          ))
        }
      }

      // The two long rails the wheel hangs between, and a cross rail at each
      // end. They run PAST the legs, because a rail stopping flush at a post
      // is a rail with nothing holding it.
      for (const sz of [-1, 1] as const) {
        frame.push(boxGeometry(
          [L, post * 0.85, post * 0.9],
          [0, railY, sz * railZ],
          timber(0.03),
        ))
      }
      for (const sx of [-1, 1] as const) {
        frame.push(boxGeometry(
          [post * 0.8, post * 0.8, (railZ + post) * 2],
          [sx * topX, railY - post * 0.15, 0],
          timber(-0.02),
        ))
      }
      /**
       * The bearing blocks, which are what the wheel actually rests on.
       *
       * The axle sat 48 mm ABOVE the rails and touched nothing: the wheel was
       * hanging in the air and the support check said so — one component on
       * the ground, another containing the wheel, the crank and the water. It
       * is the reference's own answer, too, and I had left it out: there are
       * blocks bolted on top of each rail with the axle running through them.
       */
      const railTop = railY + post * 0.425
      const bearingTop = axleY + axleGuess * 1.8
      for (const sz of [-1, 1] as const) {
        frame.push(boxGeometry(
          [axleGuess * 5, bearingTop - railTop, post * 1.05],
          [0, (railTop + bearingTop) / 2, sz * railZ],
          timber(0.05),
        ))
      }

      /**
       * The low rails, one down EACH SIDE rather than one down the middle.
       *
       * A single stretcher on the centre line reached from end to end and
       * touched nothing on the way: at that height the legs have splayed out
       * to z = 0.21 and the stretcher was at z = 0. It tied the two trestles
       * together in the drawing and not in the geometry — the trough hung off
       * it, and the whole lot came away as one floating piece.
       *
       * Where the legs ARE at that height is worked out from the two ends of
       * the strut rather than guessed, which is the only way it stays true
       * when the splay is changed.
       */
      const tieY = railY * 0.3
      const legTopY = railY + post * 1.5
      const along = tieY / legTopY
      const tieX = footX + along * (topX - footX)
      const tieZ = footZ + along * (railZ - footZ)
      for (const sz of [-1, 1] as const) {
        frame.push(boxGeometry(
          [tieX * 2 + post, post * 0.8, post * 0.7],
          [0, tieY, sz * tieZ],
          timber(-0.05),
        ))
      }
      // And one across, which is what the trough hangs from.
      frame.push(boxGeometry(
        [post * 0.8, post * 0.7, tieZ * 2],
        [0, tieY - post * 0.05, 0],
        timber(-0.07),
      ))

      // --- Trough -------------------------------------------------------
      // Slung under the wheel so the rim runs through the water. Its rim
      // stands ABOVE the bottom of the wheel, which is the whole point of it
      // and the one measurement here that has to be right.
      const troughTop = axleY - R * 0.72
      const troughDepth = R * 0.32
      const troughHalfL = R * 0.78
      const troughHalfZ = T * 0.85 + post * 0.5
      const board = post * 0.38
      // Inside the four walls, not flush with them. Cut to the trough's full
      // outer size, the floor's own side faces landed in the same planes as
      // the walls' outer faces — four coplanar pairs, which the checker
      // reported at `plane 0,0,1 | 0.108` before anything had been rendered.
      frame.push(boxGeometry(
        [(troughHalfL - board) * 2, board, (troughHalfZ - board) * 2],
        [0, troughTop - troughDepth + board / 2, 0],
        timber(-0.08),
      ))
      for (const sz of [-1, 1] as const) {
        frame.push(boxGeometry(
          [troughHalfL * 2, troughDepth, board],
          [0, troughTop - troughDepth / 2, sz * (troughHalfZ - board / 2)],
          timber(-0.04),
        ))
      }
      for (const sx of [-1, 1] as const) {
        frame.push(boxGeometry(
          [board, troughDepth, (troughHalfZ - board) * 2],
          [sx * (troughHalfL - board / 2), troughTop - troughDepth / 2, 0],
          timber(-0.06),
        ))
      }
      // Two hangers from the stretcher up to the trough, so it is carried
      // rather than floating between the legs.
      for (const sx of [-1, 1] as const) {
        frame.push(boxGeometry(
          [post * 0.5, troughTop - troughDepth - tieY + post * 0.6, post * 0.5],
          [sx * troughHalfL * 0.7, (tieY + troughTop - troughDepth) / 2, 0],
          timber(-0.07),
        ))
      }

      // --- Axle, hub and crank ------------------------------------------
      const iron: BufferGeometry[] = []
      const axleR = axleGuess
      const axleEnd = railZ + post * 0.9
      // Built about the ORIGIN, not at the axle's height, because these ride
      // with the wheel: they go in as extras on the wheel part, whose anchor
      // already sits at `axleY`. Placing them in world coordinates as well
      // would have put them at twice that.
      iron.push(prismGeometry(
        axleR, axleR, axleEnd * 2, 8, [0, 0, 0], tint('iron', 0.02, 0.7),
      ).rotateX(Math.PI / 2))
      // The washers that hold the wheel on its axle, one to a face.
      for (const sz of [-1, 1] as const) {
        iron.push(prismGeometry(
          axleR * 2.4, axleR * 2.1, T * 0.2, 10, [0, 0, 0], tint('iron', -0.03, 0.7),
        ).rotateX(Math.PI / 2).translate(0, 0, sz * (T / 2 + T * 0.06)))
      }
      // The crank: out along the axle, across, and back for the handle.
      // A crank you could actually get a hand round. At 0.34 of the radius
      // with a 0.1 m handle it read as a hook on the hub rather than as the
      // thing that drives the wheel, which is half of what says "this turns"
      // when the model is standing still.
      const throwR = R * 0.44
      // Back along the axle rather than past its end. Set beyond it, the crank
      // had nothing to hold it and the support check said so: a part on its own
      // at 0.60 m with clear air between it and the machine.
      const crankZ = axleEnd - post * 0.3
      const crank: BufferGeometry[] = [
        boxGeometry(
          [axleR * 1.5, throwR + axleR * 2, axleR * 1.5],
          [0, throwR / 2 - axleR, 0],
          new Color(tint('iron', 0.04, 0.6)),
        ),
        prismGeometry(
          axleR * 0.85, axleR * 0.85, post * 2.6, 8, [0, 0, 0],
          tint('iron', 0.06, 0.6),
        ).rotateX(Math.PI / 2).translate(0, throwR, post * 1.3),
        // The grip is oak, because on every one of these it is: iron in the
        // hand is cold and it slips.
        prismGeometry(
          axleR * 1.7, axleR * 1.5, post * 1.5, 8, [0, 0, 0],
          tint('oak', -0.04),
        ).rotateX(Math.PI / 2).translate(0, throwR, post * 3.1),
      ]

      const crankBody = mergeColoured(crank)

      return {
        // The axle and its washers ride WITH the wheel, so they are extras on
        // it rather than a part of their own: the anchor turns, they turn, and
        // a cylinder on the axis of its own rotation does not move.
        //
        // Leaving them out of the returned parts entirely was the first
        // version. They were built, merged into a local array, and then never
        // referenced — so the wheel hung on nothing and the crank floated
        // beside the machine. Nothing in the type system minds an array you
        // forget to use.
        wheel: {
          slot: 'stone' as const,
          geometry: wheel,
          origin: [0, axleY, 0] as const,
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(iron) }],
        },
        frame: { slot: 'oak' as const, geometry: mergeColoured(frame) },
        // Its own part with its own origin ON THE AXLE, so the action turns it
        // about the axle rather than about the model's floor.
        crank: {
          slot: 'iron' as const,
          geometry: crankBody,
          origin: [0, axleY, crankZ] as const,
        },
        water: (() => {
          const level = Math.max(0, Math.min(1, config.water))
          const depth = (troughDepth - board) * level
          if (depth <= troughDepth * 0.02) return undefined
          const sink = board * 0.5
          return {
            slot: 'water' as const,
            // Cut a shade WIDER than the basin, so its sides are buried in the
            // boards rather than laid against them. Sized to the inner
            // dimensions exactly, the water's faces sat in the same planes as
            // the trough's inner faces — the checker found all four at
            // `plane 0,0,1 | 0.091`. Water meets wood at a join you cannot see
            // anyway; the only question is which side of the wood it ends on.
            geometry: boxGeometry(
              [(troughHalfL - board * 0.55) * 2, depth + sink, (troughHalfZ - board * 0.55) * 2],
              [0, troughTop - troughDepth + board - sink + (depth + sink) / 2, 0],
              new Color(tint('water', jitter(random, 0.03), 0.6)),
            ),
          }
        })(),
      }
    },

    actions: ({ parts }) => {
      const apply = (): void => {
        parts.wheel.anchor.rotation.z = angle
        parts.crank.anchor.rotation.z = angle
      }
      apply()
      return {
        crank: () => {
          // 9.4 rad/s a pull, which measures out at about two and a half turns
          // before it stops. One crank giving less than a single revolution --
          // which 5.2 did -- reads as a stiff wheel rather than a heavy one.
          speed += 9.4
        },
        still: () => { angle = 0; speed = 0; apply() },
        isTurning: () => Math.abs(speed) > 1e-4,
        turns: () => turned,
      }
    },

    /**
     * Friction, not a fixed spin-down.
     *
     * A stone wheel on a wooden bearing is heavy and badly lubricated: it
     * carries for a while and then stops fairly suddenly, which is a constant
     * drag rather than a proportional one. A purely proportional decay never
     * reaches zero and the wheel creeps for ever, which is both wrong and the
     * kind of thing that leaves a model dirtying frames after the tour has
     * moved on.
     */
    update: (dt, { parts }) => {
      const step = Math.min(0.05, Math.max(0, dt))
      if (step === 0 || Math.abs(speed) < 1e-4) return
      const before = angle
      angle += speed * step
      speed *= Math.exp(-0.32 * step)
      const drag = 0.62 * step
      speed = Math.abs(speed) <= drag ? 0 : speed - Math.sign(speed) * drag
      turned += Math.abs(angle - before) / (Math.PI * 2)
      parts.wheel.anchor.rotation.z = angle
      parts.crank.anchor.rotation.z = angle
    },
  }, overrides)
}
