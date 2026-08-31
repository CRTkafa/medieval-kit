/**
 * @medieval-kit/oak-tankard
 *
 * Oak tankard: the barrel at palm size. Same stave language, same iron hoop,
 * only the scale changes — the example that shows how far the kit carries its
 * own vocabulary.
 *
 * Do NOT look for a glass mug: a medieval drinking vessel was wood, leather or
 * pewter. A clear glass would be a period error, and it would also look foreign
 * next to the rest of the kit.
 *
 * LESSONS FROM THE DEAD VERSIONS, in order:
 *
 * 1. A round rod handle looked like a modern mug. A tankard handle is a flat
 *    strap or carved grip fixed to the body at two points.
 * 2. A flat box strap through `bendGeometry` with a hand-derived offset ended
 *    up buried in the wall: the offset formula did not describe what
 *    `bendGeometry` actually does. Curves are specified by where their ends
 *    land and how far the belly stands off — `arcBarGeometry` takes exactly
 *    that.
 * 3. Even a correct arc fails if it HUGS the wall. The v3 handle stood 7 mm
 *    off a 47 mm body: no daylight, and the occlusion bake painted it black.
 *    A finger window must stay open between strap and wall.
 * 4. The body was near straight and slightly flared at the RIM, which is a
 *    bucket's profile, not a tankard's. The reference (and every surviving
 *    coopered mug) is widest at the BASE and narrows to the rim.
 * 5. Per-LEVEL radius jitter gave one stave a bulge at mid-height that read
 *    as two coincident panels with a shading break between them. Jitter is
 *    now one factor per stave, applied to every level, so each stave is a
 *    single clean board.
 * 6. The 3.5%-of-step seam gap opened visible dark slots at the rim. The gap
 *    only exists to keep adjacent side faces off a shared plane; 0.6% of a
 *    step (~0.2 mm) does that invisibly.
 * 7. Two hoops left a bare band of wood under the lower one. Three hoops,
 *    seated where the reference puts them: just under the rim, across the
 *    lower middle, and flush with the bottom edge of the staves. Each hoop is
 *    rotated half a step so its facets stay concentric with the stave facets
 *    instead of crossing them at the seams.
 *
 * PASS 2 (blind critique scored v5 at 66; silhouette was the worst axis):
 *
 * 8. The -0.15 taper at 1.55 height-to-width still read as a straight can.
 *    Now rim ≈ 0.82 × base (taper -0.22) and the wood column is ~1.3 × the
 *    base diameter (height 0.148): the reference's bucket-like truncated
 *    cone, widest element at the bottom band. The mid-level bulge is gone —
 *    the critic asked for a linear taper and the 1.004 bulge fought it.
 * 9. The chunky square-section strap on two protruding ears read as a jug
 *    handle on lugs, and the ears collected three modelling errors (lug
 *    through the bottom band, strap tips poking past the lug caps, hard
 *    seams at the wall). The ears are DELETED. The strap is now a SLAB:
 *    arcBarGeometry gives a square section, so the geometry is scaled 2.5×
 *    along the pre-rotation Z (the tangential direction after mounting) —
 *    wide across the body, shallow radially, like the reference. Its ends
 *    are buried in two thin flush PADS that hug the wall (tall one just
 *    under the top band, short foot about a stave-width above the bottom
 *    band), and the apex was pulled in from 0.6 R to 0.45 R off the wall.
 * 10. The palette's `iron` (0x40464d) is steel-blue and read as cold metal
 *    against the wood. The hoops get a fixed offsetHSL toward the wood's
 *    hue (dark warm oxide, ~21°) applied to the tinted colour — the tinter
 *    cannot shift hue that far and core is shared, so the shift lives here.
 *    Four rivet studs per hoop sit on the band facets (never at a = 0 where
 *    the handle mounts), the reference's most memorable close detail.
 */
import { Color, type BufferGeometry } from 'three'

import {
  arcBarGeometry,
  bandGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  headGeometry,
  jitter,
  mergeColoured,
  staveGeometry,
  type Level,
} from '../core/index.ts'

export interface OakTankardConfig {
  /** Height (metres). */
  readonly height: number
  /** Rim radius (metres). */
  readonly radius: number
  /** Narrowing towards the base. 0 = cylinder; negative widens the base. */
  readonly taper: number
  /** Number of staves. */
  readonly staveCount: number
  /** Number of iron hoops. */
  readonly hoopCount: number
  /** Whether there is a handle (0/1). */
  readonly handle: number
  readonly seed: number
}

export const oakTankardDefaults: OakTankardConfig = {
  // Squat: the wood column is ~1.3 × the base diameter (lesson 8). At 0.17
  // the tankard was a can; the reference is a bucket.
  height: 0.148,
  radius: 0.047,
  // Negative on purpose: widest at the base, rim ≈ 0.82 × base (lesson 8).
  taper: -0.22,
  staveCount: 10,
  hoopCount: 3,
  handle: 1,
  seed: 61,
}

export type OakTankardParts = 'staves' | 'base' | 'hoops' | 'handle'

export function createModel(overrides: Partial<OakTankardConfig> = {}) {
  return createKitModel<OakTankardConfig, 'oak' | 'iron', OakTankardParts>({
    id: 'oak-tankard',
    defaults: oakTankardDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      /**
       * The tankard's own oak, warmer than the palette entry.
       *
       * The palette is pitched for weathered structural timber, which is what
       * most of the kit is made of, and against their own references the crate,
       * the barrel and the chest all land within 0.07 on saturation. This one
       * measured 0.23 under. Its reference is a turned drinking vessel that has
       * spent its life indoors being handled, not a fence in the rain, and it
       * is genuinely a richer wood. Same shape of exception as the ladder, which
       * needs to go the other way and paler.
       */
      const oak = (lift = 0, spread = 1): Color => {
        const c = tint('oak', lift, spread)
        const hsl = { h: 0, s: 0, l: 0 }
        c.getHSL(hsl)
        c.setHSL(hsl.h, Math.min(1, hsl.s * 1.95), hsl.l * 0.86)
        return c
      }
      // Floored: height and radius sit under divisions and a patched zero
      // would spray NaN through the occlusion bake (kit trap 2).
      const height = Math.max(0.04, config.height)
      const radius = Math.max(0.012, config.radius)
      const half = height / 2
      const staves = Math.max(5, Math.round(config.staveCount))
      const thickness = radius * 0.13
      const bottomRadius = Math.max(radius * 0.6, radius * (1 - config.taper))
      // Linear taper (lesson 8): every stave face is a clean trapezoid. The
      // mid level exists only so radiusAt stays a simple two-piece lerp.
      const midRadius = (bottomRadius + radius) / 2

      /** Nominal wall radius (at the stave seams) at height y. */
      const radiusAt = (y: number): number =>
        y < 0
          ? bottomRadius + ((midRadius - bottomRadius) * (y + half)) / half
          : midRadius + ((radius - midRadius) * y) / half

      // --- Staves -----------------------------------------------------------
      // Offset by half a step so a stave FACE (not a seam) sits at a = 0,
      // where the handle mounts: the pads must land on wood, not on a slit.
      const stavePieces: BufferGeometry[] = []
      const step = (Math.PI * 2) / staves
      // Just enough gap to keep adjacent side faces off a shared plane.
      // Anything visible from arm's length is too much (lesson 6).
      const gap = step * 0.006
      for (let i = 0; i < staves; i += 1) {
        // ONE jitter factor per stave, applied to every level (lesson 5).
        const k = 1 + jitter(random, 0.008)
        const levels: Level[] = [
          { y: -half, radius: bottomRadius * k },
          { y: 0, radius: midRadius * k },
          { y: half, radius: radius * k },
        ]
        const start = (i - 0.5) * step
        stavePieces.push(staveGeometry(
          levels, start + gap, start + step - gap, thickness,
          oak(jitter(random, 0.05)),
        ))
      }

      // --- Base --------------------------------------------------------------
      // A disc seated inside the staves; its edge stays buried in the wall
      // even at the flattest chord of the jittered stave polygon.
      const base = headGeometry(
        bottomRadius - thickness * 0.8, -half + height * 0.055,
        staves, 'up', oak(0.06), 3, 0.06,
      )

      // --- Hoops --------------------------------------------------------------
      // Warm dark iron, not the palette's steel-blue (lesson 10). The tinted
      // colour is rotated to the wood's side of the wheel; the tinter's own
      // jitter survives underneath the fixed offset.
      const hoops = Math.max(0, Math.round(config.hoopCount))
      const hoopHeight = height * 0.078
      const hoopThickness = radius * 0.09
      const hoopYs: number[] = []
      if (hoops === 3) {
        // Flush with the bottom edge, across the lower middle (below true
        // centre so the lower zone reads shorter than the upper), and just
        // under the rim with a bare wood lip above (lesson 7).
        hoopYs.push(
          -half + hoopHeight / 2 + 0.0006,
          -half + height * 0.40,
          half - height * 0.105,
        )
      } else {
        for (let i = 0; i < hoops; i += 1) {
          const t = hoops === 1 ? 0.5 : 0.05 + (i / (hoops - 1)) * 0.85
          hoopYs.push(-half + height * t)
        }
      }
      const hoopPieces: BufferGeometry[] = []
      const studSize = radius * 0.105
      for (const y of hoopYs) {
        const bandR = radiusAt(y) + 0.0026
        hoopPieces.push(bandGeometry(
          bandR, y, hoopHeight, hoopThickness, staves,
          tint('iron', jitter(random, 0.05), 0.6).offsetHSL(-0.53, 0.13, -0.04),
        ))
        // Rivet studs on the band facets (lesson 10). Facet centres sit at
        // (i + 0.5)·step here; the later half-step rotation of the whole
        // hoops part carries them onto the stave centres, so odd i keeps
        // them clear of the handle's stave at a = 0 and symmetric about it.
        const facetZ = bandR * Math.cos(step / 2)
        for (const i of [1, 3, 5, 7]) {
          const stud = chamferedBoxGeometry(
            [studSize, studSize], [studSize, studSize], studSize, studSize * 0.28,
            [0, 0, facetZ + studSize * 0.08],
            tint('iron', 0.025, 0.5).offsetHSL(-0.53, 0.13, -0.02),
          )
          stud.rotateY((i + 0.5) * step)
          stud.translate(0, y, 0)
          hoopPieces.push(stud)
        }
      }
      // Half a step aligns the hoop facets with the stave facets; unrotated,
      // the hoop's flats cross the stave seams and pinch to nothing there.
      const hoopGeometry = hoopPieces.length > 0
        ? mergeColoured(hoopPieces)
        : undefined
      hoopGeometry?.rotateY(step / 2)

      // --- Handle --------------------------------------------------------------
      // A broad flat slab, not a rod and not a strap on lugs (lessons 1, 9):
      // wide across the body's tangent, shallow radially, ends buried in two
      // flush pads that hug the wall.
      let handle: BufferGeometry | undefined
      if (config.handle >= 0.5) {
        const barD = radius * 0.22            // radial depth of the slab
        const barW = barD * 2.5               // tangential width (the flat face)
        /** Outer wall surface at the stave FACE centre (a = 0), not the seam. */
        const wallZ = (y: number): number => radiusAt(y) * Math.cos(step / 2)

        const topBandBottom = half - height * 0.105 - hoopHeight / 2
        const bottomBandTop = -half + hoopHeight + 0.0006
        const staveWidth = (Math.PI * 2 * bottomRadius) / staves

        // Tall pad immediately under the top band; short foot about one
        // stave-width above the bottom band (the critic's placement, and it
        // keeps the foot out of the bottom band — v5's clearest error).
        const padTopH = radius * 0.6
        const padBottomH = radius * 0.42
        const yTop = topBandBottom - 0.0012 - padTopH / 2
        const yBottom = bottomBandTop + staveWidth * 0.9 + padBottomH / 2
        // The strap ends sit OFF the pad centres — high on the top pad, low
        // on the foot — so the arms cross the pad faces where the reference's
        // do, instead of leaving a blocky shelf of pad above the top arm.
        const yTopEnd = yTop + padTopH * 0.15
        const yBottomEnd = yBottom - padBottomH * 0.1
        const yCentre = (yTopEnd + yBottomEnd) / 2
        // Floored: a degenerate patched height can push the pads past each
        // other, and this feeds a division and an asin below (trap 2).
        const spanHalf = Math.max(radius * 0.15, (yTopEnd - yBottomEnd) / 2)

        // One shared colour for strap and pads so the handle reads as one
        // carved piece, not a strap pinned between blocks. Slightly lighter
        // than the body; the underside quads live in shadow.
        const handleColour = oak(0.04)

        // Pads stay just proud of the wall (~half the slab depth): the first
        // pass of this pad idea stood 7 mm out and the critic-shaped blocks
        // came straight back. The inner face stays inside the stave solid
        // without breaking through to the inside of the mug.
        const padW = barW * 1.05
        const padD = radius * 0.21
        const pads = ([[yTop, padTopH], [yBottom, padBottomH]] as const).map(
          ([y, h]) => chamferedBoxGeometry(
            [padW, padD], [padW, padD], h, 0.0025,
            [0, y, wallZ(y) - 0.0005],
            handleColour,
          ),
        )

        // The arc, specified by where the ends land (buried in the pads and
        // the wall — anchored to the TOP wall radius, the tighter of the
        // two under the taper) and where the outer apex sits: 0.45 R off
        // the wall (lesson 9) — close enough to read as one object, far
        // enough for daylight (lesson 3).
        const endZ = (wallZ(yTopEnd) + wallZ(yBottomEnd)) / 2 + 0.0005
        const apexOuter = wallZ(yCentre) + radius * 0.45
        const bellyCentre = apexOuter - barD / 2
        const depth = Math.max(radius * 0.06, bellyCentre - endZ)
        const arcRadius = (spanHalf * spanHalf + depth * depth) / (2 * depth)
        const theta = Math.atan2(spanHalf, arcRadius - depth)
        // THREE segments on purpose: the reference's outer edge is straight
        // and angular with a hard top corner, not a smooth bow. Three chords
        // give a near-vertical outer face and two straight diagonal arms.
        const strap = arcBarGeometry(
          arcRadius, barD, -theta, theta, 3,
          [0, 0, 0], handleColour,
        )
        // Built in the XY plane with a square section; the pre-rotation Z is
        // the section direction that becomes tangential to the body, so
        // scaling it turns the square bar into the reference's flat slab.
        strap.scale(1, 1, barW / barD)
        // -90° about Y carries +X into +Z, standing the arc beside the body,
        // then it is carried out to the wall.
        strap.rotateY(-Math.PI / 2)
        // The body tapers but the arc's two ends share one z: a small lean
        // about X follows the wall, so the lower arm emerges from its pad at
        // the same depth as the upper one instead of sinking into the
        // thicker base first.
        const lean = Math.asin(Math.min(0.4, Math.max(-0.4,
          (wallZ(yTopEnd) - wallZ(yBottomEnd)) / (2 * spanHalf))))
        strap.rotateX(lean)
        strap.translate(0, yCentre, bellyCentre - arcRadius)
        handle = mergeColoured([strap, ...pads])
      }

      return {
        staves: { slot: 'oak' as const, geometry: mergeColoured(stavePieces) },
        base: { slot: 'oak' as const, geometry: mergeColoured([base]) },
        hoops: hoopGeometry
          ? { slot: 'iron' as const, geometry: hoopGeometry }
          : undefined,
        handle: handle ? { slot: 'oak' as const, geometry: handle } : undefined,
      }
    },
  }, overrides)
}
