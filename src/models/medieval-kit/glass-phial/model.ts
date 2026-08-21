/**
 * @medieval-kit/glass-phial
 *
 * Cork-stoppered, wax-sealed glass bottle. Alchemist's shelf, healer's bag, a
 * slot in the inventory.
 *
 * The kit's second model to use the `glass` slot, and where the glass is really
 * tested: in the lantern it was a panel of a CAGE, here it is the vessel
 * itself. That has two consequences —
 *
 *   - The contents are a separate body INSIDE the glass shell. In the `ember`
 *     slot, so it takes no light and supplies its own colour: a liquid that
 *     went dark at the bottom looked like dirty water, not a potion.
 *   - The liquid surface is a flat disc. Seen through the glass that straight
 *     line is the only mark saying "this is full"; a spherical liquid body has
 *     no surface and the bottle looks empty.
 *
 * Period note: clear, colourless glass is a very late thing. Glass of the
 * period was greenish and bubbly from iron impurity; that is why the `glass`
 * colour in the palette leans green.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
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
  /** Widest radius of the body (metres). */
  readonly radius: number
  /** Neck length, as a fraction of the height. */
  readonly neck: number
  /** Fill level. 0 empty, 1 up to the brim. */
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
  radius: 0.032,
  neck: 0.34,
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
      const half = config.height / 2
      const neckLength = config.height * config.neck
      const bodyTop = half - neckLength
      const bodyBottom = -half
      const neckRadius = config.radius * 0.36

      // --- Bottle ---------------------------------------------------------------
      // Blown glass: slightly pushed in at the base (pontil mark), round body,
      // shoulder narrowing fast into the neck, a lip flared out at the mouth.
      const profile: Level[] = [
        { y: bodyBottom + config.height * 0.02, radius: config.radius * 0.5 },
        { y: bodyBottom + config.height * 0.06, radius: config.radius * 0.86 },
        { y: bodyBottom + config.height * 0.19, radius: config.radius },
        { y: bodyBottom + (bodyTop - bodyBottom) * 0.72, radius: config.radius * 0.88 },
        { y: bodyTop, radius: config.radius * 0.5 },
        { y: bodyTop + neckLength * 0.34, radius: neckRadius },
        { y: half - config.height * 0.05, radius: neckRadius * 0.96 },
        { y: half - config.height * 0.02, radius: neckRadius * 1.28 },  // lip
      ]
      const bottle = latheGeometry(profile, 9, [0, 0, 0], tint('glass', -0.02, 0.4), {
        colourTop: tint('glass', 0.06, 0.4),
        capTop: false,   // mouth OPEN: the stopper sits there
      })
      // Blown glass is never perfectly symmetric; the deviation is kept tiny
      // because on a transparent surface big irregularity reads as frosted glass.
      roughenGeometry(bottle, config.radius * 0.02, { salt: 41 })

      // --- Contents -------------------------------------------------------------
      // The liquid level is computed from the fill and sits on the body's radius
      // AT THAT HEIGHT — using a fixed radius either spilled the liquid out
      // through the glass or left it hanging in mid-air.
      const fill = Math.max(0, Math.min(1, config.fill))
      let liquid: BufferGeometry | undefined
      if (fill > 0.02) {
        const surfaceY = bodyBottom + config.height * 0.04
          + (bodyTop + neckLength * 0.4 - bodyBottom - config.height * 0.04) * fill
        // A FIXED number of levels, sampled between the bottle's floor and the
        // liquid surface. Filtering the bottle profile by height was the
        // obvious way to do it and it made the vertex count depend on `fill` —
        // which meant the showcase could not morph this model at all and fell
        // back to rebuilding it in visible steps.
        const steps = 5
        const inner = Array.from({ length: steps }, (_, i) => {
          const y = profile[0]!.y + (surfaceY - profile[0]!.y) * (i / steps)
          return { y, radius: radiusAt(y) }
        })
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
        inner.push({ y: surfaceY, radius: radiusAt(surfaceY) })
        // The liquid is in the `ember` slot, so it TAKES NO LIGHT: the vertex
        // colour is the final colour that goes to the screen. A choice — a
        // liquid behind glass darkened by the scene's light looked like dirty
        // water, not a potion.
        const hue = ((config.hue % 1) + 1) % 1
        const deep = new Color().setHSL(hue, 0.78, 0.36)
        const bright = new Color().setHSL((hue + 0.03) % 1, 0.72, 0.58)
        liquid = mergeColoured([latheGeometry(
          inner, 9, [0, 0, 0], deep,
          { colourTop: bright, capTop: true },
        )])
      }

      // --- Stopper -------------------------------------------------------------
      const stopper: BufferGeometry[] = [prismGeometry(
        neckRadius * 1.02, neckRadius * 1.24, config.height * 0.11, 8,
        [0, half - config.height * 0.035, 0], tint('oak', 0.08),
      )]
      if (config.seal >= 0.5) {
        // Wax seal: the hoop wrapping stopper and bottle mouth together.
        stopper.push(bandGeometry(
          neckRadius * 1.36, half - config.height * 0.035, config.height * 0.055,
          neckRadius * 0.24, 8, tint('charHot', -0.1, 0.6), { inner: true },
        ))
      }

      return {
        bottle: { slot: 'glass' as const, geometry: mergeColoured([bottle]) },
        liquid: liquid ? { slot: 'ember' as const, geometry: liquid } : undefined,
        stopper: {
          slot: 'oak' as const,
          geometry: mergeColoured([stopper[0]!]),
          ...(stopper.length > 1
            ? { extras: [{ slot: 'char' as const, geometry: mergeColoured(stopper.slice(1)) }] }
            : {}),
        },
      }
    },
  }, overrides)
}
