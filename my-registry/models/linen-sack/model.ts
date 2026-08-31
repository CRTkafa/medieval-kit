/**
 * @medieval-kit/linen-sack
 *
 * Grain sack with its mouth tied off by a cord. Storeroom, mill, market stall,
 * cart — one of the kit's most widely placeable pieces.
 *
 * What makes a sack a sack is that it TAKES THE SHAPE of what is inside it.
 * Five earlier versions failed on exactly this:
 *
 * 1. The first profile put its widest point a quarter of the way up and
 *    narrowed to the neck — a vase.
 * 2. The second fixed the body but kept a straight parallel-sided neck with a
 *    flat cylindrical cap above the cord: a stoppered jug.
 * 3. The third grew a gathered fan, but its points were matchstick-thin and
 *    near vertical (a crown), and the cord recessed into a notch and vanished
 *    from the silhouette.
 * 4. The fourth put the widest ring AT THE FLOOR and tapered in a straight
 *    line all the way to the tie: a truncated cone. Its tie was a tall dark
 *    cylinder, its petals flared to near horizontal over an exposed interior
 *    floor disc, and its bottom ears dipped through the ground plane.
 * 5. The fifth ("egg on a pillow") scored 66: still a squat urn. Widest ring
 *    at mid-height and nearly as wide as tall, a hard step from the dome into
 *    a bottle neck, a low outward skirt ring that read as a turned plinth,
 *    tapered-box bottom ears that read as free-floating tabs, a dark sliver
 *    at 12 o'clock where the tail showed through the gaps between the three
 *    cord wraps, petal bases visibly clear of the tuft, and one flat facet on
 *    the left flank from heavy roughen on 14 segments.
 *
 * So, this pass, straight from the critique of v5:
 *
 * - PROPORTION: the body is distinctly taller than wide, about 1:1.5 width to
 *   height, with the widest ring at 35% of the body height and the two rings
 *   below it pulled in only slightly so the lower body stays heavy.
 * - NO NECK: the same lathe climbs continuously from the shoulder to the tie
 *   through a run of gather rings (0.72 → 0.955 of the body, radii falling
 *   0.72W → 0.17W). On top of that, a displacement pass scales vertices
 *   radially by cos(8·angle + phase) with the phase held constant up the
 *   stack, ramping in above 60% of the body height, so alternate vertices
 *   pull in and out and the creases converge on the twine. The amplitude
 *   eases off again just under the cord so the pleated cloth (plus roughen)
 *   stays INSIDE the twine wraps.
 * - PILLOW BASE: no skirt ring, no rim. The lowest ring is wider than the one
 *   above it and the bottom sits flat on the floor. The corner ears are NOT
 *   separate boxes: the same displacement pass pushes the bottom 12% of the
 *   body radially outward (and a few millimetres down, clamped at the floor)
 *   in `ears` sharpened cosine lobes, so the corners grow out of the cloth
 *   and share edges with the side faces by construction. `ears` is the lobe
 *   count of that displacement, not a mesh-piece count.
 * - The displacement is a pure function of vertex POSITION (like roughen), so
 *   the co-located copies in this non-indexed geometry all move together and
 *   the surface stays closed.
 * - The three twine wraps are taller than their spacing so they overlap and
 *   there is no see-through gap between turns (v5's 12 o'clock sliver was the
 *   dark tail visible through those gaps). The tail still roots inside the
 *   cinched cloth and drapes down the gather at the gather's own slope.
 * - Petal roots sit lower and closer to the axis (0.35·cinchR at 1.5% of the
 *   height above the cord) so they emerge from the tuft, never float over it.
 * - 16 lathe segments and milder roughen, against v5's single flat facet.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface LinenSackConfig {
  /** Total height (metres). */
  readonly height: number
  /** Radius at the widest point (metres). */
  readonly radius: number
  /** How full it is. 1 = packed solid, 0.4 = half empty and slumped. */
  readonly fill: number
  /** Cloth left above the mouth, as a fraction of the height. */
  readonly collar: number
  /** Gathered ears at the bottom. */
  readonly ears: number
  readonly seed: number
}

export const linenSackDefaults: LinenSackConfig = {
  height: 0.52,
  radius: 0.16,
  fill: 0.85,
  // Enough neck below the fan for the tie to actually show.
  collar: 0.12,
  // Two opposing corners, like the reference: the seam gathers at the ends of
  // the flat-sewn bottom, not all the way round.
  ears: 2,
  seed: 53,
}

export type LinenSackParts = 'body' | 'collar' | 'cord'

export function createModel(overrides: Partial<LinenSackConfig> = {}) {
  return createKitModel<LinenSackConfig, 'cloth', LinenSackParts>({
    id: 'linen-sack',
    defaults: linenSackDefaults,
    slots: ['cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      // Floored: h and radius are divisors downstream, and a zero here would
      // NaN every vertex (and, through the occlusion bake, every colour).
      const h = Math.max(0.05, config.height)
      const radius = Math.max(0.02, config.radius)
      const half = h / 2
      const fill = Math.max(0.15, Math.min(1, config.fill))
      const collarF = Math.max(0.05, Math.min(0.4, config.collar))
      // Where the cord sits: high on a full sack, low on an empty one.
      const neckY = half - h * collarF
      // Body height, floor to cord, and a helper to place rings on it.
      const bodyH = neckY + half
      const by = (f: number): number => -half + bodyH * f
      // The tie pinches the gathered cloth down to this. Everything near the
      // cord keys off it: the cloth must come in UNDER the wraps or the cord
      // vanishes into a notch.
      const cinchR = radius * 0.18
      // Outer radius of the twine wraps: just proud of the cinched cloth.
      const cordR = cinchR + radius * 0.065

      // --- Body (floor to cord, one piece) ---------------------------------
      // An under-filled sack both drops and spreads sideways. Kept narrow
      // enough that the whole sack stands about 1.5x taller than wide.
      const wide = radius * (0.8 + fill * 0.26)
      // Widest ring at 35% of the body, the two rings below it pulled in only
      // slightly so the lower body stays heavy, the lowest ring WIDER than
      // the one above it so the base reads as cloth puddling, and a
      // continuous run of gather rings climbing from the shoulder to the
      // cord with no step and no neck.
      const profile: Level[] = [
        { y: by(0.0), radius: wide * 0.94 },
        { y: by(0.045), radius: wide * 0.92 },
        { y: by(0.14), radius: wide * 0.96 },
        { y: by(0.35), radius: wide },          // widest, 35% up
        { y: by(0.5), radius: wide * 0.975 },
        { y: by(0.62), radius: wide * 0.925 },
        { y: by(0.72), radius: wide * 0.83 },
        { y: by(0.78), radius: wide * 0.7 },
        { y: by(0.84), radius: wide * 0.52 },
        { y: by(0.89), radius: wide * 0.36 },
        { y: by(0.925), radius: wide * 0.25 },
        { y: by(0.955), radius: wide * 0.17 },
        { y: neckY - h * 0.013, radius: cinchR * 1.06 },
        { y: neckY, radius: cinchR },
      ]
      const body = latheGeometry(profile, 16, [0, 0, 0], tint('cloth', -0.04, 1.2), {
        colourTop: tint('cloth', 0.05, 1.2),
      })

      // --- Displacement pass: drape pleats and base corners -----------------
      // Both are pure functions of vertex position, so every co-located copy
      // of a corner moves identically and the surface stays closed (same
      // trick roughenGeometry relies on).
      const earN = Math.max(0, Math.round(config.ears))
      const earPhase = 0.7 + jitter(random, 0.18)
      const pleatPhase = random() * Math.PI * 2
      // Pleat depth: ramps in above 60% of the body, peaks at 85%, then eases
      // off approaching the cord so pleats + roughen stay inside the wraps.
      const pleatAmp = (f: number): number => {
        if (f < 0.6) return 0
        if (f < 0.85) return 0.13 * ((f - 0.6) / 0.25)
        return 0.13 * (1 - 0.7 * ((f - 0.85) / 0.15))
      }
      {
        const position = body.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          const x = position.getX(i)
          const y = position.getY(i)
          const z = position.getZ(i)
          const r = Math.hypot(x, z)
          if (r < 1e-6) continue
          const f = (y + half) / bodyH
          const angle = Math.atan2(x, z)
          let scale = 1
          let drop = 0
          // Drape creases: alternate vertices in and out (16 segments, 8
          // lobes: exact alternation), phase constant up the stack so the
          // creases run vertically and converge on the twine.
          scale += pleatAmp(f) * Math.cos(8 * angle + pleatPhase)
          // Base corners: sharpened cosine lobes push the bottom of the
          // cloth out and slightly down. Grown from the body, not appended.
          if (f < 0.12 && earN > 0) {
            const t = 1 - f / 0.12
            const lobe = Math.max(0, Math.cos(earN * (angle - earPhase)))
            const sharp = lobe * lobe * lobe
            scale += 0.2 * t * sharp
            drop = h * 0.008 * t * sharp
          }
          position.setXYZ(i, x * scale, y - drop, z * scale)
        }
        position.needsUpdate = true
      }

      // Cloth is not rigid: the surface break-up IS the texture. Milder than
      // v5 (whose 0.038 on 14 segments flattened a whole facet) and small
      // enough that the cinched cloth cannot spike through the twine.
      roughenGeometry(body, radius * 0.03, { salt: 21, scaleY: 0.7 })
      // The floor verts must not dig through the ground plane: clamp the
      // roughened bottom flat, which is also what a sack of grain does.
      {
        const position = body.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          if (position.getY(i) < -half) position.setY(i, -half)
        }
        position.needsUpdate = true
        body.computeVertexNormals()
      }

      // --- Gathered crown above the tie ------------------------------------
      // A CLOSED gathered cone rises out of the tie and caps itself, so every
      // gap between petals shows cloth, never the background or an interior
      // floor. The whole crown stays within about 1.2x the cord's diameter.
      const collarPieces: BufferGeometry[] = []
      const core: Level[] = [
        { y: neckY - h * 0.02, radius: cinchR * 0.8 },   // ends INSIDE the body
        { y: neckY + h * 0.024, radius: cinchR * 1.05 }, // clears the top wrap
        { y: neckY + h * 0.052, radius: cinchR * 1.35 },
        { y: neckY + h * 0.075, radius: cinchR * 1.6 },
      ]
      const tuft = latheGeometry(core, 10, [0, 0, 0], tint('cloth', 0.03, 1.2), {
        colourTop: tint('cloth', 0.09, 1.2),
      })
      collarPieces.push(tuft)

      // Pleats: widest at the TIP and pinched at the tie, leaning about 40
      // degrees. Roots sit LOW and CLOSE to the axis so every flap visibly
      // emerges from the tuft cloth (v5's roots were higher and wider and
      // read as floating over the rim).
      const points = 8
      for (let i = 0; i < points; i += 1) {
        const angle = (i / points) * Math.PI * 2 + jitter(random, 0.12)
        const tall = h * (0.055 + random() * 0.028)
        const lean = 0.55 + random() * 0.2
        const widthTip = cinchR * (1.25 + random() * 0.35)
        const wedge = taperedBoxGeometry(
          [cinchR * 0.6, cinchR * 0.5],       // pinched at the tie
          [widthTip, cinchR * 0.3],           // widest at the tip
          tall,
          [0, tall / 2, 0],                   // base at the origin: build, THEN orient
          tint('cloth', 0.02, 1.3),
          tint('cloth', 0.1, 1.3),
        )
        wedge.rotateZ(jitter(random, 0.08))  // slight twist so no two match
        wedge.rotateX(lean)                  // top leans towards local +Z
        wedge.rotateY(angle)                 // +Z now points along (sin a, cos a)
        wedge.translate(
          Math.sin(angle) * cinchR * 0.35,
          neckY + h * 0.015,
          Math.cos(angle) * cinchR * 0.35,
        )
        collarPieces.push(wedge)
      }
      const collar = mergeColoured(collarPieces)
      roughenGeometry(collar, radius * 0.024, { salt: 22, scaleY: 0.8 })

      // --- Cord: thin stacked wraps and a loose tail ------------------------
      // Twine, not a hoop: three thin turns close to the body's own value,
      // standing only slightly proud of the cinched cloth. Each wrap is
      // TALLER than the wrap spacing so the turns overlap: v5 left 0.0055h
      // gaps between them and the dark tail behind showed through as a
      // vertical sliver at 12 o'clock.
      const cordRope = tint('cloth', -0.08, 0.7)
      const cordPieces: BufferGeometry[] = []
      const wrapYs = [neckY - h * 0.011, neckY, neckY + h * 0.011]
      for (const wrapY of wrapYs) {
        cordPieces.push(bandGeometry(
          cordR + jitter(random, radius * 0.006),
          wrapY,
          h * 0.015,
          radius * 0.05,
          10,
          tint('cloth', -0.08, 0.7),
          { inner: true },
        ))
      }
      // The loose tail: emerges from under the bottom wrap and drapes down
      // the gather. The gather is CONCAVE (the flare accelerates downward),
      // so a straight chord leaned at the average slope stands clear of the
      // cloth mid-way and reads as a floating stick — which is exactly what
      // the first render of this pass showed. Instead it leans only slightly
      // (0.35 rad), hugging the narrow column just under the tie, and its far
      // end lands INSIDE the widening cloth lower down, so it reads as a rope
      // end lying on the gather and disappearing into a crease.
      const tailLen = h * 0.1
      const tailLean = 0.35
      const tail = taperedBoxGeometry(
        [radius * 0.055, radius * 0.055],
        [radius * 0.04, radius * 0.04],
        tailLen,
        [0, -tailLen / 2, 0],                // hangs DOWN from the origin
        cordRope,
      )
      const tailA = 0.7 + jitter(random, 0.3)
      tail.rotateX(-tailLean)                // down and outward along local +Z
      tail.rotateY(tailA)
      tail.translate(
        Math.sin(tailA) * cordR * 0.6,
        neckY - h * 0.01,
        Math.cos(tailA) * cordR * 0.6,
      )
      cordPieces.push(tail)

      return {
        body: { slot: 'cloth' as const, geometry: mergeColoured([body]) },
        collar: { slot: 'cloth' as const, geometry: collar },
        cord: { slot: 'cloth' as const, geometry: mergeColoured(cordPieces) },
      }
    },
  }, overrides)
}
