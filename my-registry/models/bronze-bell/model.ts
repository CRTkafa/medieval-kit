/**
 * @medieval-kit/bronze-bell
 *
 * Bronze bell hung from a yoke. Church tower, village square, ship's deck.
 *
 * The most "machine" like piece in the kit: the bell itself is easy, the real
 * problem is making it WORK. Two bodies swing independently of each other —
 *
 *   - The bell travels back and forth on the yoke axis like a damped pendulum.
 *   - The CLAPPER is on the same axis but LAGGING. That lag is exactly what
 *     rings the bell: as the bell moves one way the clapper falls behind, then
 *     catches up and hits the rim. If the two moved together the bell would be
 *     silent — and that is exactly what happened in my first attempt, where I
 *     made the clapper an `extras` body of the bell: it swung, nothing rang.
 *
 * NO sound. A model cannot make assumptions about the scene's audio system;
 * whoever needs it reads the `actions.strikes()` counter and plays its own.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  flipGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  type Level,
} from '../core/index.ts'

export interface BronzeBellConfig {
  /** Mouth diameter of the bell (metres). */
  readonly diameter: number
  /** Height of the bell itself (metres). */
  readonly height: number
  /** Length of the yoke rail, as a ratio of the diameter. */
  readonly yoke: number
  /** Angle at full swing (degrees). */
  readonly swing: number
  /** Damping rate. A larger value comes to rest sooner. */
  readonly damping: number
  readonly seed: number
}

export const bronzeBellDefaults: BronzeBellConfig = {
  diameter: 0.36,
  height: 0.4,
  yoke: 1.35,
  swing: 34,
  damping: 0.55,
  seed: 67,
}

export type BronzeBellParts = 'bell' | 'clapper' | 'yoke'

export interface BronzeBellActions {
  /** Rings the bell: starts the pendulum off at a full swing. */
  ring(): void
  /** Stops the motion instantly. */
  still(): void
  /** Whether the bell is still swinging. */
  isRinging(): boolean
  /**
   * How many times the clapper has hit the rim. A consumer that wants sound
   * watches this counter: if it went up after `update()`, a strike happened.
   */
  strikes(): number
}

export function createModel(overrides: Partial<BronzeBellConfig> = {}) {
  // Pendulum state lives OUTSIDE the build: `configure()` must not silence it.
  let angle = 0
  let velocity = 0
  let clapper = 0
  let clapperVelocity = 0
  let strikes = 0
  let lastSide = 0

  return createKitModel<BronzeBellConfig, 'brass' | 'iron' | 'oak', BronzeBellParts, BronzeBellActions>({
    id: 'bronze-bell',
    defaults: bronzeBellDefaults,
    slots: ['brass', 'iron', 'oak'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const radius = config.diameter / 2
      // Axis of rotation: the yoke rail. Everything is placed relative to it.
      const pivotY = config.height * 0.62
      const half = config.height / 2

      // --- Bell body ----------------------------------------------------------
      // The bell curve is not arbitrary: an upright shoulder up top, a concave
      // waist in the middle, a skirt flaring toward the mouth and a thickening
      // lip at the bottom (the sound bow). Without that lip the silhouette
      // looks like a plastic funnel.
      const bellProfile: Level[] = [
        { y: -half + config.height * 0.02, radius: radius },
        { y: -half + config.height * 0.07, radius: radius * 0.855 },  // sharp flare of the lip
        { y: -half + config.height * 0.15, radius: radius * 0.75 },
        { y: -half + config.height * 0.36, radius: radius * 0.665 },  // waist: almost straight
        { y: -half + config.height * 0.6, radius: radius * 0.615 },
        { y: -half + config.height * 0.79, radius: radius * 0.57 },
        { y: -half + config.height * 0.92, radius: radius * 0.49 },   // shoulder turn
        { y: half, radius: radius * 0.38 },
      ]
      // The bell is a SHELL: an outside, an inside, and a lip joining the two
      // at the mouth. Closed on top (the crown is solid), open at the mouth.
      const skirt = latheGeometry(bellProfile, 12, [0, 0, 0], tint('brass', -0.06, 0.7), {
        colourTop: tint('brass', 0.05, 0.7),
        capBottom: false,   // mouth OPEN: the inside of the bell must show
        capTop: true,
      })
      // Inner surface. Its winding is reversed with `flipGeometry` — mirroring
      // with `scale(-1, 1, 1)` flips the normals too, but it mirrors the
      // geometry as well and left the cap facing the wrong way: that is why a
      // hole showed at the top of the bell.
      const innerProfile = bellProfile.map((level) => ({
        y: level.y + config.height * 0.02,
        radius: level.radius * 0.88,
      }))
      const inner = flipGeometry(latheGeometry(
        innerProfile, 12, [0, 0, 0], tint('brass', -0.24, 0.5),
        { capBottom: false, capTop: false },
      ))
      // Mouth lip: the hoop joining the inner and outer shell. Without it a gap
      // as wide as the shell is left at the rim and the bell's inside is void.
      const lipY = -half + config.height * 0.02
      const lip = bandGeometry(
        radius * 0.995, lipY, config.height * 0.035,
        radius * 0.115, 12, tint('brass', -0.12, 0.6),
      )

      // Crown: the ears that fasten the bell to the yoke.
      const crown: BufferGeometry[] = [skirt, inner, lip]
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2
        const ear = chamferedBoxGeometry(
          [radius * 0.13, radius * 0.1],
          [radius * 0.1, radius * 0.08],
          config.height * 0.16,
          radius * 0.03,
          [0, 0, 0],
          tint('brass', 0.08, 0.6),
        )
        ear.translate(Math.sin(a) * radius * 0.17, half + config.height * 0.05, Math.cos(a) * radius * 0.17)
        crown.push(ear)
      }

      const bell = mergeColoured(crown)
      bell.translate(0, -pivotY, 0)   // bring the hinge to the origin

      // --- Clapper -----------------------------------------------------------
      // Hanging shaft + ball. The shaft drops down from the axis, the ball sits
      // just above the line of the mouth: a real clapper strikes the bell's lip.
      const drop = pivotY + half * 0.55
      const stem = prismGeometry(radius * 0.035, radius * 0.028, drop, 5,
        [0, -drop / 2, 0], tint('iron', -0.02, 0.7))
      const ball = latheGeometry([
        { y: -radius * 0.12, radius: radius * 0.04 },
        { y: -radius * 0.06, radius: radius * 0.11 },
        { y: radius * 0.04, radius: radius * 0.115 },
        { y: radius * 0.1, radius: radius * 0.05 },
      ], 7, [0, -drop, 0], tint('iron', 0.05, 0.7))
      const clapperGeometry = mergeColoured([stem, ball])

      // --- Yoke ---------------------------------------------------------------
      // DOES NOT SWING: the fixed piece the bell hangs from. It has no origin
      // of its own, so it just stands in model space.
      const beamLength = config.diameter * config.yoke
      const beamY = pivotY + radius * 0.2
      // The rail is ALREADY built horizontal: the first two arguments of
      // `chamferedBoxGeometry` are the X–Z footprint, the third the Y height.
      // I had put a `rotateZ` here and it stood the rail upright, sticking out
      // of the top of the bell like a post — the price of misremembering which
      // axis the helper counts as "height".
      const beam = chamferedBoxGeometry(
        [beamLength, radius * 0.24],
        [beamLength * 0.98, radius * 0.21],
        radius * 0.3,
        radius * 0.04,
        [0, beamY, 0],
        tint('oak', 0.02),
      )
      const yokePieces: BufferGeometry[] = [beam]

      // Bearings: the two iron ears carrying the rail. They carry it from ABOVE
      // — that is how a real bearing works, and when their top faces were level
      // with the rail's the two ended up coplanar and flickered.
      for (const side of [-1, 1]) {
        yokePieces.push(boxGeometry(
          [radius * 0.09, radius * 0.56, radius * 0.28],
          [side * beamLength * 0.34, beamY - radius * 0.02, 0],
          tint('iron', jitter(random, 0.04), 0.7),
        ))
      }

      return {
        bell: { slot: 'brass' as const, geometry: bell, origin: [0, pivotY, 0] as const },
        clapper: {
          slot: 'iron' as const,
          geometry: clapperGeometry,
          origin: [0, pivotY, 0] as const,
        },
        yoke: {
          slot: 'oak' as const,
          geometry: mergeColoured([yokePieces[0]!]),
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(yokePieces.slice(1)) }],
        },
      }
    },

    actions: ({ parts }) => {
      const apply = (): void => {
        parts.bell.anchor.rotation.z = angle
        parts.clapper.anchor.rotation.z = clapper
      }
      apply()
      return {
        ring: () => {
          // It does not always start from the SAME side: a bell rung over and
          // over looked like a machine. The direction is chosen from the
          // current velocity, so striking an ongoing swing reinforces it.
          const direction = velocity >= 0 ? 1 : -1
          velocity += direction * 3.4
        },
        still: () => {
          angle = 0; velocity = 0; clapper = 0; clapperVelocity = 0
          apply()
        },
        isRinging: () => Math.abs(angle) > 1e-4 || Math.abs(velocity) > 1e-4,
        strikes: () => strikes,
      }
    },

    update: (dt, { parts, getConfig }) => {
      const step = Math.min(0.05, Math.max(0, dt))
      if (step === 0) return
      const config = getConfig()
      const limit = (config.swing * Math.PI) / 180
      if (Math.abs(angle) < 1e-5 && Math.abs(velocity) < 1e-5
        && Math.abs(clapper) < 1e-5 && Math.abs(clapperVelocity) < 1e-5) return

      // Bell: a damped pendulum. The restoring force is proportional to the
      // angle (small-angle approximation), the friction to the velocity.
      velocity += -angle * 26 * step - velocity * config.damping * step
      angle += velocity * step
      if (Math.abs(angle) > limit) {
        angle = Math.sign(angle) * limit
        velocity *= -0.35   // hitting the yoke's limit
      }

      // Clapper: a pendulum of its own, but its mount is carried WITH the bell.
      // The drag term (angle - clapper) is exactly what produces the lag.
      clapperVelocity += (angle - clapper) * 34 * step - clapperVelocity * 0.9 * step
      clapper += clapperVelocity * step

      // Strike: when the clapper reaches the bell's inner wall. Since the wall
      // turns with the bell, the limit is not ABSOLUTE but RELATIVE to it.
      const reach = 0.26
      const relative = clapper - angle
      if (Math.abs(relative) > reach) {
        const side = Math.sign(relative)
        clapper = angle + side * reach
        clapperVelocity *= -0.55
        // No counting twice on the same side: one strike, one change of side.
        if (side !== lastSide) { strikes += 1; lastSide = side }
      } else if (Math.abs(relative) < reach * 0.4) {
        lastSide = 0
      }

      parts.bell.anchor.rotation.z = angle
      parts.clapper.anchor.rotation.z = clapper
    },
  }, overrides)
}
