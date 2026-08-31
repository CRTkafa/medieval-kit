/**
 * @medieval-kit/wicker-basket
 *
 * A basket woven from willow rods, with a bow handle, optionally filled with
 * produce.
 *
 * The model in the kit that imitates "how it was made" the most, because in
 * wickerwork the form and the making are the same thing: a basket is the
 * horizontal rods (withies) winding IN FRONT OF ONE and BEHIND THE NEXT of the
 * vertical rods (stakes). Without that winding what you get is a bucket with
 * lines drawn on it.
 *
 * The weave trick is short: every horizontal hoop is first produced as a flat
 * band, then its vertices are pushed in and out according to THEIR ANGLE —
 *
 *     radius × (1 + amplitude · cos(stakes · angle + phase))
 *
 * On consecutive rows the phase is shifted by π, so where one row comes out the
 * next one goes in. That is exactly what a real weave is, and it costs not one
 * single extra triangle.
 *
 * HISTORY, because this model is on its third body:
 *
 * v2 read as a bowl of fired clay, and the blind critique named the three
 * reasons. (1) No handle: the reference's single most identifying feature is a
 * bow handle arcing well above the rim, and without it the silhouette is a
 * bowl, not a carrying basket. (2) The wall was a cone — base half the rim —
 * where the reference is a near-vertical drum whose inward curve lives in the
 * bottom fifth. `radiusAt` now has a knee at t=0.2: eased curve below it,
 * near-vertical above. Because the wall is no longer a straight line, a
 * one-piece leaning stake no longer follows it; each stake is two prisms, a
 * steep lower one under the knee and a near-vertical upper one, overlapped at
 * the joint. (3) Four fat courses with a deep sawtooth read as stacked blocks;
 * there are now more, thinner courses and the undulation amplitude is a third
 * of what it was. The colour was salmon because the oak entry is saturated and
 * every lift pushed it toward peach; the `willow` wrapper below desaturates
 * every tint toward grey-brown instead of lightening it (lifting was tried in
 * v2 and documented as the salmon mistake — do not go back to it).
 *
 * The critique also caught a modelling error: the lowest points of the model
 * were the dips of the bottom course's zigzag, so the basket would rock. The
 * base is now a foot ring standing 2% of the height below the wall, with a
 * flat bottom cap, and its top plate is wide enough to reach under the bottom
 * course and the stakes — an earlier draft of this fix left the base plate at
 * the nominal base radius, which the flaring wall never touches, and the base
 * came out a second floating component.
 *
 * The produce sits in its own slot and takes its colour from the `hue` field:
 * the same model can give you a basket of apples, turnips or cabbages. Do NOT
 * look for tomatoes — they come from the Americas and do not enter European
 * cooking before the 16th century.
 */
import { Color, type BufferGeometry } from 'three'

import {
  arcBarGeometry,
  bandGeometry,
  createKitModel,
  createTinter,
  flipGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  type Level,
} from '../core/index.ts'

export interface WickerBasketConfig {
  /** Basket height, handle excluded (metres). */
  readonly height: number
  /** Mouth radius (metres). */
  readonly radius: number
  /** Taper towards the base. 0 = cylinder. */
  readonly taper: number
  /** Number of vertical stakes. Also the "wave count" of the weave. */
  readonly stakes: number
  /** Horizontal weave rows. */
  readonly rows: number
  /** Number of fruits inside. 0 = empty basket. */
  readonly produce: number
  /** Fruit colour, 0–1 around the colour wheel. */
  readonly hue: number
  readonly seed: number
}

export const wickerBasketDefaults: WickerBasketConfig = {
  height: 0.16,
  radius: 0.17,
  // Base 0.79 of the rim. The reference's wall is a near-vertical drum; the
  // taper is small and, through the knee in `radiusAt`, spent almost entirely
  // in the bottom fifth.
  taper: 0.21,
  stakes: 11,
  rows: 9,
  produce: 12,
  hue: 0.02,
  seed: 97,
}

export type WickerBasketParts = 'weave' | 'rim' | 'contents'

export function createModel(overrides: Partial<WickerBasketConfig> = {}) {
  return createKitModel<WickerBasketConfig, 'oak' | 'produce', WickerBasketParts>({
    id: 'wicker-basket',
    defaults: wickerBasketDefaults,
    slots: ['oak', 'produce'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      // Floors, not trust: several of these appear in denominators or in the
      // sagitta of the handle arc, and a zero patched in from outside must not
      // become a NaN that the occlusion bake then smears over every part.
      const H = Math.max(0.05, config.height)
      const R = Math.max(0.04, config.radius)
      const half = H / 2
      const stakes = Math.max(5, Math.round(config.stakes))
      const rows = Math.max(1, Math.round(config.rows))
      const taper = Math.min(0.7, Math.max(0, config.taper))
      const bottomRadius = R * (1 - taper)
      const rod = H * 0.026          // horizontal withy thickness (halved from v2)
      const stakeThick = H * 0.021   // uprights keep their old, visible section
      // A third of v2's 0.055: the courses should read as bent willow, and at
      // 0.055 they read as stacked blocks. The zigzag survives at 0.02 because
      // consecutive rows still move in antiphase.
      const amplitude = 0.02

      /**
       * Willow is not oak-coloured. The `oak` palette entry has the right hue
       * but weathered willow is greyer, and v2 proved that LIFTING the entry
       * moves it toward peach, not toward grey (lightness holds saturation).
       * So every basket tint passes through here and has its saturation set
       * against the reference rather than inherited. The tinter returns a new Color per call, so mutating it in
       * place is safe.
       *
       * The factor was a third, and a third was right when `oak` was a saturated
       * orange-brown. That entry has since been measured against its references
       * and pulled toward grey itself, so taking another third off it greyed the
       * basket 0.20 below its own reference. Two corrections for the same fault,
       * applied one on top of the other. Measured back the other way, the
       * reference willow is in fact WARMER than the corrected oak, so the factor
       * is now above one.
       */
      const willow = (lift: number, spread = 1.2): Color => {
        const c = tint('oak', lift, spread)
        const hsl = { h: 0, s: 0, l: 0 }
        c.getHSL(hsl)
        c.setHSL(hsl.h, Math.max(0, hsl.s * 1.3), hsl.l)
        return c
      }

      /**
       * Wall profile. Near-vertical drum over the top four fifths, the whole
       * inward curve eased into the bottom fifth — the knee. `rKnee` is floored
       * at `bottomRadius` so a cylinder (taper 0) stays a cylinder instead of
       * denting inward at the knee.
       */
      const knee = 0.2
      const rKnee = Math.max(bottomRadius, R * 0.97)
      const radiusAt = (t: number): number => {
        if (t >= knee) return rKnee + (R - rKnee) * ((t - knee) / (1 - knee))
        const s = t / knee
        return bottomRadius + (rKnee - bottomRadius) * s * (2 - s)
      }

      /**
       * The transform that turns a band into a weave: every vertex moves
       * towards and away from the centre according to ITS OWN angle. Y is left
       * alone, so the hoop stays in its plane and never collides with the
       * neighbouring rows.
       */
      const undulate = (geometry: BufferGeometry, phase: number): BufferGeometry => {
        const position = geometry.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          const x = position.getX(i)
          const z = position.getZ(i)
          const distance = Math.hypot(x, z)
          if (distance < 1e-6) continue
          const scale = 1 + amplitude * Math.cos(stakes * Math.atan2(x, z) + phase)
          position.setX(i, x * scale)
          position.setZ(i, z * scale)
        }
        position.needsUpdate = true
        geometry.computeVertexNormals()
        return geometry
      }

      // --- Vertical stakes -----------------------------------------------------
      // Two prisms per stake, because the wall is no longer a straight line: a
      // steep lower segment rounds through the knee, a near-vertical upper one
      // runs to the rim. They overlap at the joint; both far ends are buried —
      // the bottom behind the lowest course, the top inside the rim ring — so
      // only the lower bottom is capped and the rest of the tube ends stay open
      // where nothing can see them.
      const pieces: BufferGeometry[] = []
      const yKnee = -half + knee * H
      const yStakeBottom = -half + H * 0.012
      const yStakeTop = half - H * 0.02
      const overlap = H * 0.02
      const rLow = radiusAt(0.012)
      const segment = (
        y0: number, r0: number, y1: number, r1: number, angle: number,
        colour: Color, options: { capTop?: boolean; capBottom?: boolean },
      ): BufferGeometry => {
        const length = Math.hypot(y1 - y0, r1 - r0)
        const piece = prismGeometry(
          stakeThick * 0.52, stakeThick * 0.46, length, 4, [0, 0, 0], colour, options,
        )
        piece.rotateX(Math.atan2(r1 - r0, y1 - y0))
        piece.rotateY(angle)
        const mid = (r0 + r1) / 2
        piece.translate(Math.sin(angle) * mid, (y0 + y1) / 2, Math.cos(angle) * mid)
        return piece
      }
      for (let i = 0; i < stakes; i += 1) {
        const angle = (i / stakes) * Math.PI * 2
        const shade = willow(-0.05, 1.2)
        pieces.push(segment(
          yStakeBottom, rLow, yKnee + overlap, rKnee, angle, shade,
          { capTop: false, capBottom: true },
        ))
        pieces.push(segment(
          yKnee - overlap, rKnee, yStakeTop, R, angle, shade,
          { capTop: false, capBottom: false },
        ))
      }

      // --- Horizontal weave ----------------------------------------------------
      // TWO segments per vertical stake: `cos(stakes·θ)` is sampled exactly once
      // positive and once negative on every stake, so the wave is fully resolved
      // with the fewest possible triangles.
      //
      // The INNER FACE of the hoops is not generated. In its place there is a
      // single-piece inner liner (below). The weave stops BELOW the rim: the rim
      // is a separate, thicker rod laid over the finished weave, which is how
      // the object is actually made.
      const weaveSpan = H * 0.92
      for (let r = 0; r < rows; r += 1) {
        const t = (r + 0.5) / rows
        const y = -half + weaveSpan * t
        // Rows overlap slightly so they always MEET; they do not z-fight
        // because consecutive rows are undulated half a wave apart AND lean
        // alternately in and out, so no two rows lie on the same cylinder.
        const lean = r % 2 === 0 ? rod * 0.2 : -rod * 0.2
        const ring = bandGeometry(
          radiusAt(t) + lean, y, (weaveSpan / rows) * 1.06, rod * 0.8, stakes * 2,
          willow(0.02 + jitter(random, 0.05)),
        )
        pieces.push(undulate(ring, r % 2 === 0 ? 0 : Math.PI))
      }

      // Inner liner: the single surface that closes off the back of the weave.
      // Wound in reverse so the normals face the axis. It follows the wall
      // profile at 0.955 of it — inside the courses, outside the base plate,
      // its top edge buried in the rim ring.
      pieces.push(flipGeometry(latheGeometry([
        { y: -half + H * 0.04, radius: radiusAt(0.05) * 0.955 },
        { y: yKnee, radius: rKnee * 0.955 },
        { y: half - H * 0.02, radius: R * 0.955 },
      ], stakes * 2, [0, 0, 0], willow(-0.02, 1.1), {
        capTop: false,
        capBottom: false,
      })))

      // --- Base and foot -------------------------------------------------------
      // One lathe: a foot ring the basket actually stands on (flat bottom cap
      // 2% of the height below the wall, so the bottom course's zigzag dips
      // stay clear of the ground), swelling slightly, then flaring up and OUT
      // to a floor plate at `radiusAt(0.03)` — wide enough to pass under the
      // bottom course and the stake feet, which is what keeps the base part of
      // the same solid as the wall.
      const footR = bottomRadius * 0.98
      const yGround = -half - H * 0.02
      const yFloor = -half + H * 0.06
      pieces.push(latheGeometry([
        { y: yGround, radius: footR * 0.95 },
        { y: yGround + H * 0.03, radius: footR * 1.03 },
        { y: yFloor, radius: radiusAt(0.03) * 0.99 },
      ], stakes * 2, [0, 0, 0], willow(-0.06, 1.2)))

      // --- Rim -----------------------------------------------------------------
      // The thick bend that finishes the weave: the heaviest rod in a basket,
      // bent over the finished weave, standing proud on both sides. Everything
      // that must vanish — liner top, stake tops, handle feet — ends inside
      // this solid.
      const rimY = half - H * 0.03
      const rimHalfH = H * 0.05
      const rimOuter = R * 1.02
      const rimThick = rod * 3.5
      const rimPieces: BufferGeometry[] = [
        bandGeometry(rimOuter, rimY, rimHalfH * 2, rimThick, stakes * 2,
          willow(0.05, 1.2), { inner: true }),
      ]

      // --- Handle --------------------------------------------------------------
      // The bow that makes it a carrying basket rather than a bowl. A flat
      // band — twice as wide in the plane of the loop as it is deep — arcing
      // rim to rim across the diameter and peaking about 0.6 of the body
      // height above the rim. The arc is solved from its chord and sagitta, so
      // the feet land at mid-wall of the rim ring (inside the solid, not
      // butted against the outer face) whatever the proportions are patched to.
      const handleWide = Math.min(rimThick * 0.9, R * 0.09)
      const handleDeep = handleWide * 0.5
      const footY = rimY - rimHalfH * 0.4
      const footX = rimOuter - rimThick * 0.5
      const peak = rimY + H * 0.62
      const sagitta = Math.max(0.01, peak - footY)
      const arcR = (footX * footX + sagitta * sagitta) / (2 * sagitta)
      const arcCentreY = peak - arcR
      const footAngle = Math.atan2(footY - arcCentreY, footX)
      const handle = arcBarGeometry(
        arcR, handleWide, footAngle, Math.PI - footAngle, 7,
        [0, arcCentreY, 0], willow(0.03, 1.1),
      )
      // The bar comes out square; flattening it in Z (the out-of-loop
      // direction) turns it into the band. Scale is safe here because the arc
      // is only ever offset in Y.
      handle.scale(1, 1, handleDeep / handleWide)
      rimPieces.push(handle)

      // Lashings: a short sleeve wrapped around each handle foot just above
      // the rim, its lower end sunk into the rim ring — the bindings that hold
      // a real handle. The sleeve is held by the handle passing through it.
      for (const side of [0, 1] as const) {
        const a = side === 0 ? footAngle + 0.12 : Math.PI - footAngle - 0.12
        const sleeve = prismGeometry(
          handleWide * 0.72, handleWide * 0.66, H * 0.2, 4, [0, 0, 0],
          willow(-0.03, 1.1),
        )
        sleeve.rotateZ(a)
        sleeve.translate(Math.cos(a) * arcR, arcCentreY + Math.sin(a) * arcR, 0)
        rimPieces.push(sleeve)
      }

      // --- Contents ------------------------------------------------------------
      const count = Math.max(0, Math.round(config.produce))
      const contents: BufferGeometry[] = []
      const hue = ((config.hue % 1) + 1) % 1
      for (let i = 0; i < count; i += 1) {
        const size = R * (0.2 + random() * 0.07)
        // Apple profile: dimpled top and bottom, wide in the middle.
        const fruit = latheGeometry([
          { y: -size * 0.82, radius: size * 0.36 },
          { y: -size * 0.45, radius: size * 0.9 },
          { y: size * 0.15, radius: size * 0.97 },
          { y: size * 0.8, radius: size * 0.4 },
        ] as Level[], 6, [0, 0, 0], new Color().setHSL(
          (hue + jitter(random, 0.03) + 1) % 1,
          0.52 + random() * 0.2,
          0.3 + random() * 0.12,
        ))

        // Placement: golden-angle spiral plus a distance growing with the
        // square root, and the heap RESTS ON THE FLOOR PLATE — fruit piles up
        // from the bottom, and with enough of it the heap mounds past the rim.
        const angle = i * 2.399963
        const ring = Math.sqrt((i + 0.4) / count)
        const inner = Math.max(size, bottomRadius * 0.92 - size * 0.6)
        const spread = inner * ring
        const layer = Math.floor(i / Math.max(3, Math.round(count * 0.38)))
        fruit.rotateX(jitter(random, 0.6))
        fruit.rotateZ(jitter(random, 0.6))
        fruit.translate(
          Math.sin(angle) * spread,
          // Floor plate + one radius = resting on the floor of the basket.
          // Layers nest at 0.95 of a diameter: stacked fruit settles into the
          // gaps of the layer below rather than sitting on top of it.
          yFloor + size * (0.92 + layer * 0.95)
            - ring * size * 0.28 + jitter(random, size * 0.08),
          Math.cos(angle) * spread,
        )
        contents.push(fruit)
      }

      return {
        weave: { slot: 'oak' as const, geometry: mergeColoured(pieces) },
        rim: { slot: 'oak' as const, geometry: mergeColoured(rimPieces) },
        contents: contents.length > 0
          ? { slot: 'produce' as const, geometry: mergeColoured(contents) }
          : undefined,
      }
    },
  }, overrides)
}
