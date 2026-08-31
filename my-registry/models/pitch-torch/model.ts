/**
 * @medieval-kit/pitch-torch
 *
 * Pitch torch: a stout stick, pitch-soaked cloth bound onto its end with cord,
 * a flame above. This was exactly the period's lighting — candles were
 * expensive, torches were free.
 *
 * THIRD VERSION. What the earlier ones got wrong, so it is not tried again:
 *
 *   - v1 flame tapered base-to-tip on one curve and rendered as a ROCKET NOSE.
 *     A flame has a swollen base, a waist, and a torn tip. The waist stays.
 *   - v2 head was a barrel widest at mid-height with a FLAT OPEN RIM, and its
 *     colourTop was charHot. In render that hot-coloured flat cap read as a
 *     stray detached flame-coloured quad lying across the rim. The head is now
 *     a teardrop widest in its upper third closing to a faceted dome, and the
 *     head carries char colours only. Nothing on the head is flame-coloured.
 *   - v2 flame ended its lathe at radius 0.22r with a capped fan, then
 *     roughened at 0.30r amplitude. The cap centre and its ring hash
 *     differently, which split the tip into a V notch, and the amplitude was
 *     enough to fold the waist into a self-intersection. The profile now ends
 *     at radius 0 (all tip triangles share one vertex position, so the
 *     position hash moves them together and no notch can open) and the
 *     amplitude is halved.
 *   - v2 had NO BINDING, so the bulb met the shaft as a bare cone point and
 *     the object read as a moulded club. The binding band of cord turns is the
 *     landmark that names a pitch torch, and it gets a zone about as long as
 *     the head, exactly as the reference gives it.
 *
 * The flame flickers via `update()` and the source of that flicker is NOT
 * randomness but a sum of sines of elapsed time: randomness would break
 * determinism, a single sine ticks like a metronome, and a self-driving timer
 * would violate "the consumer owns the loop". The flame also EMITS NO LIGHT;
 * a consumer who wants the torch to light the scene attaches a PointLight to
 * `parts.flame.anchor`.
 *
 * The binding turn count is DERIVED (zone length over cord pitch), not a
 * config integer: the zone fraction is the config surface, and any change to
 * it moves the geometry continuously.
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
  /** Total wood-plus-head length, butt to dome top, excluding flame (metres). */
  readonly length: number
  /** Shaft radius (metres). Near-constant along the shaft; a torch stick is not tapered. */
  readonly radius: number
  /** Length of the pitched head bulb, as a fraction of `length`. */
  readonly wrapLength: number
  /** Length of the cord binding zone, as a fraction of the head length. */
  readonly binding: number
  /** Flame height, as a fraction of the head length. */
  readonly flameHeight: number
  /** Amplitude of the flicker. 0 = steady flame. */
  readonly flicker: number
  readonly seed: number
}

export const pitchTorchDefaults: PitchTorchConfig = {
  // Longer and thicker than v2: the critique measured the shaft at a fifth of
  // the head's width where the reference is nearer a third, and short. The
  // exposed shaft below the binding now comes to about 60% of the total.
  length: 0.72,
  radius: 0.024,
  wrapLength: 0.22,
  binding: 0.8,
  // The flame stays LOWER than the head is long. A pitch torch burns with a
  // low, fat, smoky flame, not a candle's spire.
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
      const r = Math.max(config.radius, 0.004) // floored: derived divisions below
      const half = config.length / 2
      // Head bulb zone, then the cord binding zone immediately below it.
      const headLength = Math.max(config.length * config.wrapLength, r * 3)
      const headBase = half - headLength
      const bindingLength = Math.max(headLength * config.binding, r * 2)
      const bindingBase = headBase - bindingLength

      // --- Shaft -----------------------------------------------------------
      // Near-constant diameter with only a whisper of waver: a torch stick is
      // a straight-cut stave, not a tapering tool handle. The butt closes with
      // a short chamfer so the end reads slightly rounded, and the top ends
      // INSIDE the bulb.
      const shaftTop = headBase + headLength * 0.35
      const shaftLevels: Level[] = [
        { y: -half, radius: r * 0.58 },
        { y: -half + 0.016, radius: r * (0.96 + jitter(random, 0.03)) },
      ]
      const waverSteps = 4
      for (let i = 1; i <= waverSteps; i += 1) {
        const t = i / waverSteps
        shaftLevels.push({
          y: (-half + 0.016) + (shaftTop - (-half + 0.016)) * t,
          radius: r * (1 + jitter(random, 0.05)) * (i === waverSteps ? 0.92 : 1),
        })
      }
      const shaft = mergeColoured([latheGeometry(
        shaftLevels, 7, [0, 0, 0], tint('oak', -0.06),
        { colourTop: tint('oak', 0.02) },
      )])

      // --- Binding + head --------------------------------------------------
      // The binding: a stack of cord turns proud of the shaft by about a third
      // of its radius. One wavy lathe rather than stacked rings, so no pair of
      // coincident faces forms where turns touch. Turn count is derived from
      // the zone length over a cord pitch tied to the shaft radius; the
      // defaults give seven turns.
      const pitch = r * 0.75
      const turns = Math.min(12, Math.max(3, Math.round(bindingLength / pitch)))
      const turnPitch = bindingLength / turns
      const grooveR = r * 1.14
      const bindingLevels: Level[] = [{ y: bindingBase, radius: grooveR }]
      for (let k = 0; k < turns; k += 1) {
        bindingLevels.push({
          y: bindingBase + (k + 0.5) * turnPitch,
          radius: r * (1.4 + jitter(random, 0.03)),
        })
        bindingLevels.push({
          y: bindingBase + (k + 1) * turnPitch,
          radius: grooveR * (1 + jitter(random, 0.015)),
        })
      }
      // Soot creeps down the cord from the head, so the top of the binding
      // lerps darker. Both tints are separate Colors (createTinter allocates).
      const binding = latheGeometry(
        bindingLevels, 8, [0, 0, 0], tint('leather', 0.02),
        { colourTop: tint('leather', -0.13) },
      )

      // Two loose cord ends angling off the binding: fat end buried inside a
      // crest of the binding solid, thin tip dangling free like a lashing's
      // cut end. Built at the origin along Y, rotated, then translated; the
      // final rotateY swings each around the torch axis so they are not both
      // on the same side.
      const cordEnds = [
        { tilt: Math.PI + 0.22, len: bindingLength * 0.42, crest: turns - 2.5, swing: 0.6 },
        { tilt: Math.PI + 0.35, len: bindingLength * 0.34, crest: 2.5, swing: 3.9 },
      ].map(({ tilt, len, crest, swing }) => {
        const cord = prismGeometry(r * 0.17, r * 0.06, len, 5, [0, 0, 0], tint('leather', -0.04))
        cord.rotateZ(tilt)
        // Where the fat (local bottom) end lands after the rotation, so it can
        // be pinned to a crest of the binding.
        const fatX = (len / 2) * Math.sin(tilt)
        const fatY = -(len / 2) * Math.cos(tilt)
        const anchorY = bindingBase + Math.min(Math.max(crest, 0.5), turns - 0.5) * turnPitch
        cord.translate(r * 1.18 - fatX, anchorY - fatY, 0)
        cord.rotateY(swing)
        return cord
      })

      // The head: pitch-soaked rags bound into a teardrop, widest in its
      // upper third, closing to a faceted dome. Its lowest level hides inside
      // the binding's top turn, so the taper terminates in cord, not on bare
      // shaft. The char slot is used because pitch gets coated in soot — an
      // oak colour would be a lie here. No flame colour anywhere on the head.
      const lump = () => 1 + jitter(random, 0.04)
      const bulbLevels: Level[] = [
        { y: headBase - turnPitch * 0.6, radius: r * 1.1 },
        { y: headBase + headLength * 0.1, radius: r * 1.9 * lump() },
        { y: headBase + headLength * 0.3, radius: r * 2.5 * lump() },
        { y: headBase + headLength * 0.55, radius: r * 2.9 * lump() },
        { y: headBase + headLength * 0.7, radius: r * 3.0 },
        { y: headBase + headLength * 0.82, radius: r * 2.75 * lump() },
        { y: headBase + headLength * 0.92, radius: r * 2.15 * lump() },
        { y: headBase + headLength * 0.985, radius: r * 1.15 },
        { y: half, radius: r * 0.55 },
      ]
      const bulb = latheGeometry(
        bulbLevels, 8, [0, 0, 0], tint('char', 0.05),
        { colourTop: tint('char', 0.14) },
      )
      const wrap = mergeColoured([binding, ...cordEnds, bulb])

      // --- Flame -----------------------------------------------------------
      // Built at ITS OWN origin; the anchor sits just inside the dome. This is
      // required because the flicker drives the anchor's scale: a flame whose
      // origin is not at its base would sink into the wrap when scaled. The
      // base ring is buried well inside the dome so the roughen displacement
      // can never push it out into view.
      const flameH = Math.max(headLength * config.flameHeight, 0.02)
      const flameProfile: Level[] = [
        { y: 0, radius: r * 1.7 },
        { y: flameH * 0.15, radius: r * 2.35 },
        { y: flameH * 0.38, radius: r * 1.95 },
        { y: flameH * 0.55, radius: r * 2.05 },
        { y: flameH * 0.75, radius: r * 1.3 },
        { y: flameH * 0.9, radius: r * 0.7 },
        { y: flameH, radius: 0 }, // closes to a single shared point: no tip notch
      ]
      const outer = latheGeometry(flameProfile, 7, [0, 0, 0], tint('ember', 0.04, 0.4),
        { colourTop: tint('emberTip', 0, 0.4), capBottom: true })
      roughenGeometry(outer, r * 0.16, { salt: 7, scaleY: 1.25 })

      const flame = mergeColoured([
        outer,
        // Inner core: smaller and whiter. Two layers give the flame depth — a
        // single cone reads flat. Its base is NOT CAPPED: a cap was coplanar
        // with the outer base and z-fought, and it is invisible anyway.
        prismGeometry(
          r * 1.1, r * 0.1, flameH * 0.5, 5,
          [0, flameH * 0.32, 0], tint('ember', 0.22, 0.3),
          { capBottom: false },
        ),
      ])

      return {
        shaft: { slot: 'oak' as const, geometry: shaft },
        wrap: { slot: 'char' as const, geometry: wrap },
        flame: {
          slot: 'ember' as const,
          geometry: flame,
          origin: [0, half - headLength * 0.1, 0] as const,
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
