/**
 * @medieval-kit/pitch-torch
 *
 * Pitch torch: a knotty stick, pitch-soaked cloth wound onto its end, a flame
 * above. This was exactly the period's lighting — candles were expensive,
 * torches were free.
 *
 * The kit's first ANIMATED model. The flame flickers via `update()` and the
 * source of that flicker is NOT randomness but a sum of sines of elapsed time.
 * There are three reasons for that:
 *
 *   - Randomness breaks determinism. `Math.random()` is banned everywhere in
 *     the kit; the flame can be no exception, otherwise two torches with the
 *     same seed diverge.
 *   - Two sines at incommensurate frequencies give an oscillation that reads as
 *     "non-repeating" to the eye. A single sine would tick like a metronome.
 *   - If the consumer never calls `update()`, the model stops completely.
 *     Setting up a self-driving timer would violate the protocol's principle
 *     that "the consumer owns the loop".
 *
 * The flame also EMITS NO LIGHT. If the torch is meant to light the scene, the
 * consumer attaches a PointLight to `parts.flame.anchor` — the model has no
 * right to make assumptions about the scene's light budget.
 */
import {
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface PitchTorchConfig {
  /** Total shaft length (metres). */
  readonly length: number
  /** Shaft radius (metres). */
  readonly radius: number
  /** Length of the cloth wrap, as a fraction of the shaft. */
  readonly wrapLength: number
  /** Flame height, as a fraction of the wrap length. */
  readonly flameHeight: number
  /** Amplitude of the flicker. 0 = steady flame. */
  readonly flicker: number
  readonly seed: number
}

export const pitchTorchDefaults: PitchTorchConfig = {
  length: 0.58,
  radius: 0.019,
  wrapLength: 0.3,
  // The flame was taller than the head that feeds it. A pitch torch burns
  // with a low, fat, smoky flame, not a candle's spire.
  flameHeight: 0.78,
  flicker: 1,
  seed: 37,
}

export type PitchTorchParts = 'shaft' | 'wrap' | 'flame'

export interface PitchTorchActions {
  /** Lights/extinguishes the flame. When out, the `flame` part is fully hidden. */
  setLit(lit: boolean): void
  isLit(): boolean
}

export function createModel(overrides: Partial<PitchTorchConfig> = {}) {
  // State lives OUTSIDE the build: `configure()` must not put the torch out.
  let lit = true
  let elapsed = 0

  return createKitModel<PitchTorchConfig, 'oak' | 'char' | 'ember', PitchTorchParts, PitchTorchActions>({
    id: 'pitch-torch',
    defaults: pitchTorchDefaults,
    slots: ['oak', 'char', 'ember'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.length / 2
      const wrapLength = config.length * config.wrapLength
      const wrapBase = half - wrapLength

      // --- Shaft -----------------------------------------------------------
      // A knotty branch: its radius wavers along its length. A straight
      // cylinder would look manufactured, whereas a torch is a stick cut in
      // the forest.
      const knots = 6
      const shaftProfile: Level[] = Array.from({ length: knots + 1 }, (_, i) => {
        const t = i / knots
        return {
          y: -half + config.length * (1 - config.wrapLength) * t,
          radius: config.radius * (1 + jitter(random, 0.16)) * (i === 0 ? 0.82 : 1),
        }
      })
      const shaft = mergeColoured([latheGeometry(
        shaftProfile, 6, [0, 0, 0], tint('oak', -0.08),
        { colourTop: tint('oak', -0.02) },
      )])

      // --- Wrap ------------------------------------------------------------
      // Pitch-soaked cloth: thick relative to the shaft, swollen towards the
      // end, flat on top. The char slot is used because pitch gets coated in
      // soot — an oak colour would be a lie here.
      const wrapProfile: Level[] = [
        { y: wrapBase - wrapLength * 0.12, radius: config.radius * 1.15 },
        // Fatter. A torch head is a fist of tow and rags soaked in pitch,
        // bound on; at 2.5 shaft radii it was a spindle, and the head is the
        // whole reason the object is not a stick.
        { y: wrapBase + wrapLength * 0.22, radius: config.radius * 3.3 },
        { y: wrapBase + wrapLength * 0.62, radius: config.radius * 3.5 },
        { y: half, radius: config.radius * 2.9 },
      ]
      const wrap = mergeColoured([latheGeometry(
        wrapProfile, 7, [0, 0, 0], tint('char', 0.06),
        { colourTop: tint('charHot', -0.32) },
      )])

      // --- Flame -----------------------------------------------------------
      // The flame geometry is built at ITS OWN origin and the anchor is moved
      // to the end of the wrap. This is required because the flicker drives the
      // anchor's scale: a flame whose origin is not at its base would sink into
      // the wrap when scaled.
      const flameHeight = wrapLength * config.flameHeight
      // This is the flame profile's second version. The first tapered from base
      // to tip on a single curve and in render it looked like a ROCKET NOSE —
      // smooth, symmetric, pointed. A flame is not like that: its base is wide
      // and swollen, it has a waist in the middle, and its tip is not pointed
      // but TORN. The profile below gives that waist, and `roughen` breaks the
      // symmetry.
      const flameProfile: Level[] = [
        { y: 0, radius: config.radius * 2.05 },
        { y: flameHeight * 0.14, radius: config.radius * 2.75 },
        { y: flameHeight * 0.34, radius: config.radius * 2.15 },
        { y: flameHeight * 0.5, radius: config.radius * 2.4 },
        { y: flameHeight * 0.72, radius: config.radius * 1.35 },
        { y: flameHeight * 0.9, radius: config.radius * 0.8 },
        { y: flameHeight, radius: config.radius * 0.22 },
      ]
      const outer = latheGeometry(flameProfile, 6, [0, 0, 0], tint('ember', 0.04, 0.4),
        { colourTop: tint('emberTip', 0, 0.4), capBottom: true })
      roughenGeometry(outer, config.radius * 0.3, { salt: 5, scaleY: 1.6 })

      const flame = mergeColoured([
        outer,
        // Inner core: smaller and whiter than the outer one. Two layers give
        // the impression that the flame has depth — a single cone reads flat.
        //
        // Its base is NOT CAPPED: it was coplanar with the base of the outer
        // cone and z-fought with it. It is invisible anyway, being inside the
        // outer shell, so the cap was both unnecessary and harmful.
        prismGeometry(
          config.radius * 1.25, config.radius * 0.1, flameHeight * 0.48, 5,
          [0, flameHeight * 0.3, 0], tint('ember', 0.22, 0.3),
          { capBottom: false },
        ),
      ])

      return {
        shaft: { slot: 'oak' as const, geometry: shaft },
        wrap: { slot: 'char' as const, geometry: wrap },
        flame: {
          slot: 'ember' as const,
          geometry: flame,
          origin: [0, half - wrapLength * 0.12, 0] as const,
        },
      }
    },

    actions: ({ parts }) => {
      parts.flame.anchor.visible = lit
      return {
        setLit: (next) => { lit = next; parts.flame.anchor.visible = next },
        isLit: () => lit,
      }
    },

    update: (dt, { parts, getConfig }) => {
      // An extinguished torch does not advance: so that when it is relit the
      // flame resumes from the same phase point rather than wherever it drifted
      // to. Otherwise a torch left out for a long time would start at an
      // arbitrary size when lit.
      if (!lit) return
      const config = getConfig()
      const amount = config.flicker
      if (amount === 0) return
      elapsed += Math.max(0, dt)

      // Incommensurate frequencies: 11.3 and 19.7 are not multiples of each
      // other, so the period of the sum is too long for the eye to catch.
      const pulse = Math.sin(elapsed * 11.3) * 0.09 + Math.sin(elapsed * 19.7 + 1.4) * 0.055
      const sway = Math.sin(elapsed * 7.1 + 0.6) * 0.05 + Math.sin(elapsed * 13.9) * 0.028

      const anchor = parts.flame.anchor
      // Height and width move in OPPOSITE directions: a flame narrows as it
      // stretches. Scaling them the same way made the flame look like a
      // breathing balloon.
      anchor.scale.set(1 - pulse * 0.55 * amount, 1 + pulse * amount, 1 - pulse * 0.55 * amount)
      anchor.rotation.z = sway * amount
      anchor.rotation.x = Math.sin(elapsed * 9.4 + 2.1) * 0.038 * amount
    },
  }, overrides)
}
