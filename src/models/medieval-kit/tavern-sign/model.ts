/**
 * @medieval-kit/tavern-sign
 *
 * A wooden board swinging from the end of a forged iron bracket fixed to a wall.
 *
 * Since literacy was rare, a period sign carried a PICTURE, not TEXT: a garland
 * meant the vintner, a boot the cobbler, a mortar the apothecary. So the model
 * gives the board itself, not the device on it — the consumer attaches whatever
 * they want to `parts.board.anchor`. This is exactly what the protocol's idea
 * of semantic parts is good for.
 *
 * The swing is a different pendulum from the bell's: here the restoring force
 * is not gravity but the friction of two rings. So a sign at rest always hangs
 * STRAIGHT, but once pushed it oscillates for a long time. Put next to the
 * bell's hard, fast damping, the difference between the two reads immediately.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  bendGeometry,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  taperedBoxGeometry,
} from '../core/index.ts'

export interface TavernSignConfig {
  /** Board width (metres). */
  readonly width: number
  /** Board height (metres). */
  readonly height: number
  /** How far the bracket projects from the wall (metres). */
  readonly reach: number
  /** Height of the post the arm is bolted to (metres). */
  readonly postHeight: number
  /** Length of the hanging chain (metres). */
  readonly drop: number
  /** Number of planks. */
  readonly plankCount: number
  /** How fast the swing damps out. */
  readonly damping: number
  readonly seed: number
}

export const tavernSignDefaults: TavernSignConfig = {
  width: 0.72,
  height: 0.52,
  reach: 0.62,
  postHeight: 2.15,
  drop: 0.12,
  plankCount: 3,
  damping: 0.42,
  seed: 73,
}

// The chains are NOT a separate part: they have to swing together with the
// board, so they live as its `extras` body.
export type TavernSignParts = 'bracket' | 'board' | 'post'

export interface TavernSignActions {
  /** Pushes the sign: wind, or someone coming out of the door. */
  push(strength?: number): void
  still(): void
  /** Current swing angle (radians). */
  lean(): number
}

export function createModel(overrides: Partial<TavernSignConfig> = {}) {
  let angle = 0
  let velocity = 0

  return createKitModel<TavernSignConfig, 'oak' | 'iron', TavernSignParts, TavernSignActions>({
    id: 'tavern-sign',
    defaults: tavernSignDefaults,
    slots: ['oak', 'iron'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const bar = config.reach * 0.035
      // Axis of rotation: the line where the chains leave the bracket. The
      // board and the chains are written RELATIVE to this point.
      const pivotY = config.height * 0.5 + config.drop
      const armY = pivotY
      const hangX = config.width * 0.4

      // --- Bracket -----------------------------------------------------------
      // Sits against the wall at Z zero and reaches out along +Z.
      // --- Post ------------------------------------------------------------
      // The bracket used to be bolted to a wall the model did not contain, so
      // the whole sign floated in the air. A standing signpost is
      // period-correct — plenty of inn signs were on posts rather than walls —
      // and it is the version that can actually be dropped into a scene,
      // because it holds itself up.
      const postWidth = config.reach * 0.1
      const postTop = pivotY + config.reach * 0.1
      const postBase = postTop - config.postHeight
      const timber: BufferGeometry[] = [chamferedBoxGeometry(
        [postWidth, postWidth],
        [postWidth * 0.82, postWidth * 0.82],
        config.postHeight,
        postWidth * 0.12,
        [0, (postTop + postBase) / 2, 0],
        tint('oak', -0.06),
        tint('oak', 0.04),
      )]
      // Soil mound at the foot, the same device the fence uses: it explains how
      // the post stays upright and hides where it meets the ground.
      const soil = tint('oak', -0.2)
      soil.offsetHSL(0, -0.28, 0)
      timber.push(taperedBoxGeometry(
        [postWidth * 3.2, postWidth * 3.2],
        [postWidth * 1.6, postWidth * 1.6],
        postWidth * 1.1,
        [0, postBase + postWidth * 0.4, 0],
        soil,
      ))

      const iron: BufferGeometry[] = []
      iron.push(boxGeometry(
        [bar * 4.4, config.height * 0.9, bar * 1.6],
        [0, armY - config.height * 0.1, bar * 0.4],
        tint('iron', -0.05, 0.7),
      ))
      // The horizontal arm.
      iron.push(boxGeometry(
        [bar * 1.5, bar * 1.7, config.reach],
        [0, armY + bar * 0.5, config.reach / 2],
        tint('iron', 0.02, 0.7),
      ))
      // Brace: the curved support tying the arm back to the wall. Without it
      // the arm looks like it is hanging in the air and the eye's question of
      // "what is holding this up" goes unanswered.
      const braceLength = config.reach * 0.72
      const brace = boxGeometry(
        [bar * 1.1, braceLength, bar * 1.1],
        [0, braceLength / 2, 0],
        tint('iron', -0.02, 0.7),
      )
      bendGeometry(brace, -1.15 / braceLength)
      brace.rotateX(Math.PI / 4)
      brace.translate(0, armY - config.height * 0.42, bar)
      iron.push(brace)
      // The curl at the end of the arm: the signature of forged iron.
      const curl = boxGeometry(
        [bar * 0.9, config.reach * 0.3, bar * 0.9],
        [0, config.reach * 0.15, 0],
        tint('iron', 0.06, 0.7),
      )
      bendGeometry(curl, 5.2 / (config.reach * 0.3))
      curl.rotateX(Math.PI / 2)
      curl.translate(0, armY + bar * 0.5, config.reach)
      iron.push(curl)

      // Cross-bar at the end of the arm.
      //
      // Without it the board could not be attached at all: the arm is a single
      // bar on the model's centre line, roughly 4 cm wide, while the board
      // hangs from two chains set `width * 0.8` apart. The chains passed the
      // arm on either side and touched nothing, so the entire board — planks,
      // battens, chains and all — was a separate object hanging in the air.
      // A real bracket has this piece for exactly the same reason.
      iron.push(boxGeometry(
        [hangX * 2 + bar * 2.4, bar * 1.2, bar * 1.5],
        [0, armY + bar * 0.5, config.reach * 0.86],
        tint('iron', 0.03, 0.7),
      ))

      // --- Chains ----------------------------------------------------------------
      // They have to swing TOGETHER with the board, hence the board's `extras`
      // body. Were they a separate part, the chain would stay bolt upright
      // while the board swung.
      //
      // The link COUNT is derived from the drop, not fixed. It used to be three
      // links whose radius scaled with `config.drop`, which is scale-invariant
      // in the worst way: the spacing between links was always 0.5·drop while
      // their diameter was always 0.32·drop, so the chain never actually
      // interlocked at any setting. At the default drop the gap was small
      // enough that nothing caught it; at the top of the slider the board came
      // off the bracket completely.
      //
      // Now the link is sized from the iron stock and enough of them are made
      // to overlap across whatever drop is asked for.
      // The COUNT is fixed and the RADIUS is derived, not the other way round.
      // Deriving the count from `drop` guaranteed the links overlap, but it also
      // made the triangle count depend on a continuous slider — which meant the
      // showcase could not morph this model and had to fall back to visibly
      // stepped rebuilds. Fixing the count and growing the links instead keeps
      // both properties: always interlocked, always the same topology.
      const linkCount = 5
      const linkRadius = Math.max(bar * 0.9, (config.drop / (linkCount - 1)) * 0.62)
      const links: BufferGeometry[] = []
      for (const side of [-1, 1]) {
        const count = linkCount
        for (let i = 0; i < count; i += 1) {
          // The first link sits INSIDE the arm and the last inside the board's
          // ear, so the chain is a real connection rather than two things at
          // roughly the same height. Spacing the links evenly across the drop
          // (the old `(i + 0.5) / count`) left the top link short of the arm by
          // drop/6, which detached the entire board.
          const y = -config.drop * (i / Math.max(1, count - 1))
          const ring = bandGeometry(linkRadius, 0, bar * 0.6, bar * 0.35, 6,
            tint('iron', jitter(random, 0.05), 0.7), { inner: true })
          // Successive links must pass through at right angles — that is what a
          // chain is.
          ring.rotateX(i % 2 === 0 ? Math.PI / 2 : 0)
          ring.rotateZ(i % 2 === 0 ? 0 : Math.PI / 2)
          ring.translate(side * hangX, y, config.reach * 0.86 * (side === 0 ? 1 : 1))
          links.push(ring)
        }
      }

      // --- Board -------------------------------------------------------------------
      const planks = Math.max(1, Math.round(config.plankCount))
      const plankHeight = config.height / planks
      const board: BufferGeometry[] = []
      for (let i = 0; i < planks; i += 1) {
        const y = -config.drop - config.height + plankHeight * (i + 0.5)
        board.push(chamferedBoxGeometry(
          [config.width, config.height * 0.055],
          [config.width * 0.997, config.height * 0.05],
          plankHeight * 0.94,
          config.height * 0.012,
          [0, y, config.reach * 0.86],
          tint('oak', jitter(random, 0.05)),
        ))
      }
      // The two battens on the back: what holds the planks together. They go
      // INTO the planks so that no two faces end up coplanar.
      for (const side of [-1, 1]) {
        board.push(boxGeometry(
          [config.width * 0.07, config.height * 0.94, config.height * 0.045],
          [side * config.width * 0.36, -config.drop - config.height / 2, config.reach * 0.86 - config.height * 0.045],
          tint('oak', -0.09),
        ))
      }
      // The two iron lugs joining the board to the chain.
      for (const side of [-1, 1]) {
        links.push(boxGeometry(
          [bar * 1.2, config.drop * 0.4, bar * 1.4],
          [side * hangX, -config.drop - config.drop * 0.06, config.reach * 0.86],
          tint('iron', 0.04, 0.7),
        ))
      }

      return {
        post: { slot: 'oak' as const, geometry: mergeColoured(timber) },
        bracket: { slot: 'iron' as const, geometry: mergeColoured(iron) },
        board: {
          slot: 'oak' as const,
          geometry: mergeColoured(board),
          origin: [0, pivotY, 0] as const,
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(links) }],
        },
      }
    },

    actions: ({ parts }) => {
      parts.board.anchor.rotation.x = angle
      return {
        push: (strength = 1) => {
          // Reinforces the existing motion instead of resetting it: successive
          // pushes should accumulate the way a real wind does.
          velocity += (velocity >= 0 ? 1 : -1) * 1.6 * strength
        },
        still: () => { angle = 0; velocity = 0; parts.board.anchor.rotation.x = 0 },
        lean: () => angle,
      }
    },

    update: (dt, { parts, getConfig }) => {
      const step = Math.min(0.05, Math.max(0, dt))
      if (step === 0) return
      if (Math.abs(angle) < 1e-5 && Math.abs(velocity) < 1e-5) return
      // A SOFTER pendulum than the bell's: weak restoring force, little damping.
      // This is what the long, lazy swing of a heavy board looks like.
      velocity += -angle * 11 * step - velocity * getConfig().damping * step
      angle += velocity * step
      // Limit: the board must stop before it hits the arm.
      const limit = 0.55
      if (Math.abs(angle) > limit) {
        angle = Math.sign(angle) * limit
        velocity *= -0.4
      }
      parts.board.anchor.rotation.x = angle
    },
  }, overrides)
}
