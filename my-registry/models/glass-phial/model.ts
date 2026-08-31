/**
 * @medieval-kit/glass-phial
 *
 * Cork-stoppered glass bottle with a wax seal. Alchemist's shelf, healer's
 * bag, a slot in the inventory.
 *
 * THIRD PROFILE. The first two were curvy decanters: a bulging belly on a
 * rounded near-pointed base, a long conical shoulder tapering into a stem of
 * a neck. The blind critique (70/100, worst axis silhouette) reported that
 * the reference is nothing of the sort: a plain straight-sided apothecary
 * bottle, vertical walls on a flat foot, a short shoulder, a short neck, and
 * a flared lip ring that is the one feature naming the object. So:
 *
 *   - Constant wall radius from the foot to ~60% of total height. The widest
 *     point at mid-belly is gone entirely.
 *   - Shoulder turns over ~12% of height, neck is short, and the lip flares
 *     to ~1.4x the neck radius. Glass above the shoulder is ~10% of height.
 *   - Flat disc base with a slight foot ring, not a rounded bottom.
 *   - The cork is a plain, slightly tapered plug standing clear of the lip at
 *     about the neck's width, not a stub hidden under the wax.
 *   - The wax bridges the cork-to-neck junction: it wraps the lip ring and
 *     climbs onto the cork. The previous seal sat wholly on the cork,
 *     floating above the glass with bare cork showing beneath it.
 *
 * The kit's second model to use the `glass` slot, and where the glass is
 * really tested: in the lantern it was a panel of a CAGE, here it is the
 * vessel itself. Two consequences survive from the earlier versions —
 *
 *   - The contents are a separate body INSIDE the glass shell. In the `ember`
 *     slot, so it takes no light and supplies its own colour: a liquid that
 *     went dark at the bottom looked like dirty water, not a potion.
 *   - The liquid surface is a flat disc. Seen through the glass that straight
 *     line is the only mark saying "this is full"; a spherical liquid body
 *     has no surface and the bottle looks empty.
 *
 * Period note: clear, colourless glass is a very late thing. Glass of the
 * period was greenish and bubbly from iron impurity; that is why the `glass`
 * colour in the palette leans green.
 */
import { Color, type BufferGeometry } from 'three'

import {
  createKitModel,
  createTinter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface GlassPhialConfig {
  /** Total height, stopper included (metres). */
  readonly height: number
  /** Radius of the straight body wall (metres). */
  readonly radius: number
  /** Height of shoulder, neck and lip together, as a fraction of the height. */
  readonly neck: number
  /** Fill level. 0 empty, 1 up to the shoulder. */
  readonly fill: number
  /**
   * Colour of the liquid, 0–1 around the colour wheel.
   *
   * The reason it is a parameter and not a fixed colour is the same as in the
   * rest of the kit: one model has to yield red healing, green poison and blue
   * mana potions. Adding three separate colours to the palette would do the
   * same thing in a more rigid way.
   */
  readonly hue: number
  /** Whether there is a wax seal (0/1). */
  readonly seal: number
  readonly seed: number
}

export const glassPhialDefaults: GlassPhialConfig = {
  height: 0.14,
  radius: 0.024,
  neck: 0.26,
  fill: 0.62,
  hue: 0.33,
  seal: 1,
  seed: 83,
}

export type GlassPhialParts = 'bottle' | 'liquid' | 'stopper'

export function createModel(overrides: Partial<GlassPhialConfig> = {}) {
  return createKitModel<GlassPhialConfig, 'glass' | 'ember' | 'oak' | 'char', GlassPhialParts>({
    id: 'glass-phial',
    defaults: glassPhialDefaults,
    slots: ['glass', 'ember', 'oak', 'char'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      // Floors, because a config slider at zero must degrade the shape, not
      // divide the vertices into NaN (that mistake once recoloured a whole
      // model through the occlusion bake).
      const height = Math.max(0.05, config.height)
      const radius = Math.max(0.008, config.radius)
      const half = height / 2
      const bottom = -half

      // Vertical layout, from the ground up. The cork's crown defines the
      // total height; glass stops at 86% of it.
      const glassTop = bottom + height * 0.86
      const neckLength = height * Math.max(0.12, config.neck)
      const shoulderStart = glassTop - neckLength
      const shoulderRun = neckLength * 0.46
      const lipRun = neckLength * 0.16
      const neckTop = glassTop - lipRun

      const wallRadius = radius * 0.985
      const neckRadius = radius * 0.62
      const lipRadius = neckRadius * 1.42

      // --- Bottle ---------------------------------------------------------------
      // Straight-sided apothecary bottle: flat foot with a slight foot ring,
      // vertical wall, short rounded shoulder, short neck, flared lip ring.
      // capTop is TRUE: the mouth reads as the flat top face of the lip, and
      // the cork rises through it. Leaving it open showed the interior
      // backfaces around the cork whenever the seal was off.
      const profile: Level[] = [
        { y: bottom, radius: radius * 0.95 },
        { y: bottom + height * 0.012, radius },                     // foot ring
        { y: bottom + height * 0.045, radius: wallRadius },
        { y: shoulderStart, radius: wallRadius },                   // straight wall
        { y: shoulderStart + shoulderRun * 0.55, radius: radius * 0.88 },
        { y: shoulderStart + shoulderRun, radius: neckRadius },     // shoulder done
        { y: neckTop, radius: neckRadius },                         // neck
        { y: neckTop + lipRun * 0.45, radius: lipRadius },          // lip flare
        { y: glassTop, radius: lipRadius * 0.97 },
      ]
      const bottle = latheGeometry(profile, 10, [0, 0, 0], tint('glass', -0.02, 0.4), {
        colourTop: tint('glass', 0.06, 0.4),
      })
      // Blown glass is never perfectly symmetric; the deviation is kept tiny
      // because on a straight wall big irregularity reads as a dented bottle.
      roughenGeometry(bottle, radius * 0.015, { salt: 41 })

      // --- Contents -------------------------------------------------------------
      // The liquid level is computed from the fill and sits on the body's radius
      // AT THAT HEIGHT. Its floor starts slightly ABOVE the bottle's own base
      // cap: two same-facing discs sharing the base plane are forbidden.
      const fill = Math.max(0, Math.min(1, config.fill))
      let liquid: BufferGeometry | undefined
      if (fill > 0.02) {
        const floorY = bottom + height * 0.012
        const surfaceY = floorY
          + (shoulderStart + shoulderRun * 0.4 - floorY) * fill
        // A FIXED number of levels, sampled between the bottle's floor and the
        // liquid surface. Filtering the bottle profile by height was the
        // obvious way to do it and it made the vertex count depend on `fill` —
        // which meant the showcase could not morph this model at all and fell
        // back to rebuilding it in visible steps.
        const steps = 5
        function radiusAt(y: number): number {
          for (let i = 1; i < profile.length; i += 1) {
            const a = profile[i - 1]!
            const b = profile[i]!
            if (y <= b.y) {
              const t = (y - a.y) / Math.max(1e-6, b.y - a.y)
              return (a.radius + (b.radius - a.radius) * t) * 0.88
            }
          }
          return profile.at(-1)!.radius * 0.88
        }
        const inner = Array.from({ length: steps }, (_, i) => {
          const y = floorY + (surfaceY - floorY) * (i / steps)
          return { y, radius: radiusAt(y) }
        })
        inner.push({ y: surfaceY, radius: radiusAt(surfaceY) })
        // The liquid is in the `ember` slot, so it TAKES NO LIGHT: the vertex
        // colour is the final colour that goes to the screen. A choice — a
        // liquid behind glass darkened by the scene's light looked like dirty
        // water, not a potion.
        const hue = ((config.hue % 1) + 1) % 1
        const deep = new Color().setHSL(hue, 0.78, 0.36)
        const bright = new Color().setHSL((hue + 0.03) % 1, 0.72, 0.58)
        liquid = mergeColoured([latheGeometry(
          inner, 10, [0, 0, 0], deep,
          { colourTop: bright, capTop: true },
        )])
      }

      // --- Stopper -------------------------------------------------------------
      // A plain tapered plug: buried in the neck below, standing clear above
      // the lip by about the neck's width. Its lower end terminates INSIDE the
      // neck, never level with the mouth.
      const corkBottom = neckTop - neckLength * 0.24
      const corkTop = bottom + height
      const corkHeight = corkTop - corkBottom
      const corkRadiusAt = (y: number): number => {
        const t = (y - corkBottom) / Math.max(1e-6, corkHeight)
        return neckRadius * (0.84 + 0.22 * t)
      }
      const stopper = prismGeometry(
        corkRadiusAt(corkBottom), corkRadiusAt(corkTop), corkHeight, 8,
        [0, (corkBottom + corkTop) / 2, 0], tint('oak', 0.08),
        { colourTop: tint('oak', 0.13) },
      )

      // --- Wax seal ------------------------------------------------------------
      // The wax bridges the junction: a skirt wrapping the glass lip ring, a
      // slope over its corner, and a collar hugging the cork above it, capped
      // so it reads as poured wax the cork rises out of.
      let seal: BufferGeometry | undefined
      if (config.seal >= 0.5) {
        // The skirt stops halfway down the lip: it must bridge onto the glass,
        // but a skirt that swallowed the whole lip ring erased the one feature
        // that names the object.
        const waxTop = glassTop + height * 0.038
        const waxProfile: Level[] = [
          { y: glassTop - lipRun * 0.55, radius: lipRadius * 1.07 },
          { y: glassTop + height * 0.012, radius: lipRadius * 0.97 },
          { y: waxTop, radius: corkRadiusAt(waxTop) * 1.08 },
        ]
        seal = mergeColoured([latheGeometry(
          waxProfile, 10, [0, 0, 0], tint('charHot', -0.1, 0.6),
          { colourTop: tint('charHot', -0.04, 0.6) },
        )])
      }

      return {
        bottle: { slot: 'glass' as const, geometry: mergeColoured([bottle]) },
        liquid: liquid ? { slot: 'ember' as const, geometry: liquid } : undefined,
        stopper: {
          slot: 'oak' as const,
          geometry: mergeColoured([stopper]),
          ...(seal
            ? { extras: [{ slot: 'char' as const, geometry: seal }] }
            : {}),
        },
      }
    },
  }, overrides)
}
