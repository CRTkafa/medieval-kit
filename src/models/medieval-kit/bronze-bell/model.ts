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

export type BronzeBellParts = 'bell' | 'clapper' | 'yoke' | 'frame'

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
      const skirt = latheGeometry(bellProfile, 12, [0, 0, 0], tint('bronze', -0.06, 0.7), {
        colourTop: tint('bronze', 0.05, 0.7),
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
        innerProfile, 12, [0, 0, 0], tint('bronze', -0.24, 0.5),
        { capBottom: false, capTop: false },
      ))
      // Mouth lip: the hoop joining the inner and outer shell. Without it a gap
      // as wide as the shell is left at the rim and the bell's inside is void.
      const lipY = -half + config.height * 0.02
      const lip = bandGeometry(
        radius * 0.995, lipY, config.height * 0.035,
        radius * 0.115, 12, tint('bronze', -0.12, 0.6),
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
          tint('bronze', 0.08, 0.6),
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
      // Where the uprights stand. Computed here, before the beam, because the
      // beam has to REACH them: decoupling the two (so the frame could not
      // close onto the bell at a short yoke) left the rail shorter than the
      // gap it spans at the bottom of the slider, and the two A-frames came
      // apart into separate objects with nothing joining them.
      const standX = Math.max(beamLength * 0.4, radius * 1.3)
      const beamSpan = Math.max(beamLength, standX * 2.2)
      // The rail is ALREADY built horizontal: the first two arguments of
      // `chamferedBoxGeometry` are the X–Z footprint, the third the Y height.
      // I had put a `rotateZ` here and it stood the rail upright, sticking out
      // of the top of the bell like a post — the price of misremembering which
      // axis the helper counts as "height".
      const beam = chamferedBoxGeometry(
        [beamSpan, radius * 0.24],
        [beamSpan * 0.98, radius * 0.21],
        radius * 0.3,
        radius * 0.04,
        [0, beamY, 0],
        tint('oak', 0.02),
      )
      const yokePieces: BufferGeometry[] = [beam]

      // --- Frame -------------------------------------------------------------
      // Two uprights and a pair of ground sills. Without them the whole
      // assembly — bell, clapper, yoke — hangs in mid-air with nothing holding
      // it, which is exactly the failure the support check exists to catch.
      // A bell also does not come without its frame: the frame is what lets it
      // swing, so modelling one without the other is modelling half an object.
      //
      // Consumers who want the bare bell for their own tower hide
      // `parts.frame` — that is what semantic parts are for.
      // The frame stands CLEAR of the bell, in both axes.
      //
      // The uprights were at beamLength * 0.34, which at the default yoke is
      // 0.165 against a bell radius of 0.18: half-width included, they spanned
      // 0.147 to 0.183 and ran straight through the bell's mouth. Nothing in
      // the check suite objects -- the support test sees one connected mass,
      // which is exactly what a post driven through a bell looks like -- but a
      // bell cannot swing through its own frame. The width is now the larger of
      // the yoke's reach and the bell's radius plus a margin, so shortening the
      // yoke slider cannot close the frame onto the bell.
      //
      // And the foot sat at height * 0.16 below the mouth, leaving 24 mm
      // between the sill and the lip. A bell hangs clear of its sill; at that
      // gap it read as resting on it.
      const standFoot = -half - config.height * 0.36
      const legY = (beamY + standFoot) / 2
      const legHeight = beamY - standFoot
      const framePieces: BufferGeometry[] = []
      const braceRise = legHeight * 0.44
      const braceRun = radius * 0.62
      const braceLength = Math.hypot(braceRun, braceRise)

      for (const side of [-1, 1]) {
        // The upright reaches PAST the rail it carries, so the joint is a real
        // overlap rather than two faces meeting.
        framePieces.push(chamferedBoxGeometry(
          [radius * 0.2, radius * 0.34],
          [radius * 0.15, radius * 0.26],
          // Starts INSIDE the sill, not level with it: sharing the sill's
          // bottom plane put two downward faces in the same place and they
          // flickered against each other.
          legHeight + radius * 0.22,
          radius * 0.03,
          [side * standX, legY + radius * 0.19, 0],
          tint('oak', -0.04),
          tint('oak', 0.03),
        ))
        // Sill: the foot that spreads the load along the ground. It runs across
        // the swing, because that is the direction a swinging bell tries to
        // rock its frame.
        framePieces.push(chamferedBoxGeometry(
          [radius * 0.26, radius * 1.5],
          [radius * 0.22, radius * 1.34],
          radius * 0.22,
          radius * 0.03,
          [side * standX, standFoot + radius * 0.11, 0],
          tint('oak', -0.1),
        ))

        // Braces: a pair per upright, in the plane of that upright's own
        // A-frame, running fore and aft to the ends of its sill.
        //
        // They used to be single diagonals tilted about Z -- across the model,
        // in the same plane as the bell -- which meant they had to be shoved
        // either in front of the bell (a diagonal drawn straight over the one
        // silhouette that has to read cleanly) or outboard of the uprights,
        // where they connect to nothing and stick out like broken sticks.
        // Neither is what a bell frame does. Real frames are two A-frames, one
        // at each end of the beam, braced fore-and-aft in their own planes,
        // with the bell swinging in the gap between them. Tilting about X
        // instead of Z puts them there, and the bell is never in the way.
        for (const dir of [-1, 1]) {
          const brace = chamferedBoxGeometry(
            [radius * 0.13, radius * 0.2],
            [radius * 0.1, radius * 0.16],
            braceLength,
            radius * 0.025,
            [0, 0, 0],
            tint('oak', -0.07),
          )
          brace.rotateX(-dir * Math.atan2(braceRun, braceRise))
          brace.translate(
            side * standX,
            standFoot + radius * 0.11 + braceRise / 2,
            dir * braceRun / 2,
          )
          framePieces.push(brace)
        }
      }

      /*
       * Straps: the two iron ears that clamp the rail where the bell hangs
       * from it. They carry it from ABOVE, which is how a real strap works, and
       * when their top faces were level with the rail's the two ended up
       * coplanar and flickered.
       *
       * They used to sit at `beamLength * 0.34`, which at the default yoke puts
       * them all but directly over the uprights, at the far ends of the rail.
       * The bell meets the rail at its centre. So the ironwork was at one end of
       * the beam and the load at the other, and the straps held nothing: a
       * critic reading the render said exactly that. They now straddle the
       * hanger, which is the only place on a beam where a strap has a job.
       */
      for (const side of [-1, 1]) {
        yokePieces.push(boxGeometry(
          [radius * 0.09, radius * 0.56, radius * 0.28],
          [side * radius * 0.3, beamY - radius * 0.02, 0],
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
        frame: { slot: 'oak' as const, geometry: mergeColoured(framePieces) },
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
