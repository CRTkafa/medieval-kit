import { Color, type BufferGeometry } from 'three'

import { latheGeometry, mergeColoured, type Level } from './geometry.ts'
import { jitter } from './random.ts'
import { PROP_PALETTE } from './materials.ts'

/**
 * The shared language of hand tools.
 *
 * In the first attempt all three tools were just a straight prismatic shaft +
 * a boxy head, and they looked like toys. The reasons were small, individual
 * things:
 *
 *   - The shaft was the same thickness end to end. A real shaft has a swell
 *     at its base (the grip) — so the hand does not slip off. That is the one
 *     detail that makes the silhouette readable.
 *   - The head was stuck directly onto the shaft. A real tool has a conical
 *     socket; the shaft goes inside it.
 *   - There was no geometric variation anywhere, only the colour changed. A
 *     forged tool is not perfectly symmetric.
 *
 * This module supplies all three from one place, so adding a new tool to the
 * kit is now just a matter of answering "what is the head".
 */

export interface ShaftOptions {
  readonly length: number
  readonly radius: number
  /** How many sides. 6 is enough: on a hand-held stick 8 adds nothing to the silhouette. */
  readonly segments?: number
  readonly random: () => number
}

export interface ToolShaft {
  readonly geometry: BufferGeometry
  /** Y position of the shaft's top end — the head sits here. */
  readonly top: number
  /** The shaft's radius at the top end. */
  readonly topRadius: number
}

/**
 * Tool shaft: grip swell at the bottom, a long straight body in the middle, a
 * slight taper towards the top. Produced as a single lathe — stacking prisms
 * on top of each other would leave coplanar face pairs between them.
 */
export function toolShaft(options: ShaftOptions): ToolShaft {
  const { length, radius, random } = options
  const segments = options.segments ?? 6
  const bottom = -length / 2
  const top = length / 2
  const r = (scale: number): number => radius * scale * (1 + jitter(random, 0.02))

  const profile: Level[] = [
    { y: bottom, radius: r(0.78) },              // bottom: rounded end
    { y: bottom + length * 0.012, radius: r(1.18) }, // underside of the grip swell
    { y: bottom + length * 0.075, radius: r(1.1) },  // top of the grip
    { y: bottom + length * 0.14, radius: r(0.94) },  // waist between grip and body
    { y: bottom + length * 0.55, radius: r(1) },     // body
    { y: top, radius: r(0.9) },                      // taper towards the head
  ]

  const tint = new Color(PROP_PALETTE.wood)
  tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), 0.05 + jitter(random, 0.05))
  const tintTop = new Color(PROP_PALETTE.wood)
  // The head end passes through the hand less often, so it stays a bit darker.
  tintTop.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), -0.02 + jitter(random, 0.04))

  return {
    geometry: latheGeometry(profile, segments, [0, 0, 0], tint, { colourTop: tintTop }),
    top,
    topRadius: profile.at(-1)!.radius,
  }
}

export interface SocketOptions {
  /** Y position where the socket sits (the shaft's top end). */
  readonly y: number
  /** The shaft's radius at that point. */
  readonly shaftRadius: number
  /** Socket length. */
  readonly length: number
  readonly segments?: number
  readonly random: () => number
}

/**
 * Forged socket: a cone that wraps the shaft and widens upwards, with a collar
 * on top.
 *
 * It is extended DOWN INTO the shaft — because its lower end stays inside the
 * shaft's body, no surface ends up coplanar with the shaft's surface.
 */
export function toolSocket(options: SocketOptions): BufferGeometry {
  const { y, shaftRadius, length, random } = options
  const segments = options.segments ?? 6
  const tint = new Color(PROP_PALETTE.steelPainted)
  tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.05))
  const collar = new Color(PROP_PALETTE.steelPainted)
  collar.offsetHSL(0, jitter(random, 0.02), 0.04 + jitter(random, 0.04))

  const profile: Level[] = [
    { y: y - length * 0.9, radius: shaftRadius * 1.12 },
    { y: y - length * 0.45, radius: shaftRadius * 1.34 },
    { y: y + length * 0.1, radius: shaftRadius * 1.5 },
    { y: y + length * 0.22, radius: shaftRadius * 1.72 },  // collar
    { y: y + length * 0.34, radius: shaftRadius * 1.46 },
  ]
  return mergeColoured([latheGeometry(profile, segments, [0, 0, 0], tint, { colourTop: collar })])
}

/** Iron tone with a small deviation. So all three tools look like one hand made them. */
export function ironTint(random: () => number, lift = 0): Color {
  const tint = new Color(PROP_PALETTE.steelPainted)
  tint.offsetHSL(0, jitter(random, 0.02), lift + jitter(random, 0.05))
  return tint
}

/**
 * Burnished steel tone — for the `steel` slot.
 *
 * The deviation is kept narrower than in `ironTint`: what determines the
 * colour of a polished surface is not its own pigment but the environment it
 * reflects. Shifting hue in the vertex colour looks dirty here, so there is
 * only a tiny wobble in lightness.
 */
export function steelTint(random: () => number, lift = 0): Color {
  const tint = new Color(PROP_PALETTE.stainless)
  tint.offsetHSL(0, jitter(random, 0.008), lift + jitter(random, 0.025))
  return tint
}
