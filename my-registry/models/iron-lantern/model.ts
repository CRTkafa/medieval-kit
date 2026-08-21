/**
 * @medieval-kit/iron-lantern
 *
 * An iron lantern carried in the hand or hung from a hook: a hexagonal cage,
 * glass panels, an oil lamp inside.
 *
 * What separates it from the torch is not only shape. A torch is a consumable,
 * a lantern is a TOOL — expensive, kept, handed down. So the geometry looks
 * more "made" as well: forged corner posts, a vent flue, a carrying hoop.
 *
 * The glass has two consequences and both are visible here:
 *
 *   - The `glass` slot is TRANSPARENT and `depthWrite` is off. Without that the
 *     glass hid the wick behind it; a transparent surface must not write depth.
 *   - The glass panels are an `extras` body of the cage. Making them a separate
 *     part had seemed sensible but was wrong: cage and glass are ONE MEANING —
 *     if one moves, so does the other. Only the material is split.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  type Level,
} from '../core/index.ts'

export interface IronLanternConfig {
  /** Body height, hoop excluded (metres). */
  readonly height: number
  /** Corner-to-corner radius of the cage (metres). */
  readonly radius: number
  /** How many corners. 4 is a lantern, 6 is richer. */
  readonly sides: number
  /** Flame height, as a fraction of the body height. */
  readonly flameHeight: number
  /** Amplitude of the flicker. 0 = steady flame. */
  readonly flicker: number
  readonly seed: number
}

export const ironLanternDefaults: IronLanternConfig = {
  height: 0.26,
  radius: 0.075,
  sides: 6,
  flameHeight: 0.22,
  flicker: 1,
  seed: 71,
}

export type IronLanternParts = 'frame' | 'font' | 'flame' | 'handle'

export interface IronLanternActions {
  setLit(lit: boolean): void
  isLit(): boolean
}

export function createModel(overrides: Partial<IronLanternConfig> = {}) {
  let lit = true
  let elapsed = 0

  return createKitModel<IronLanternConfig, 'iron' | 'glass' | 'char' | 'ember', IronLanternParts, IronLanternActions>({
    id: 'iron-lantern',
    defaults: ironLanternDefaults,
    slots: ['iron', 'glass', 'char', 'ember'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const sides = Math.max(3, Math.round(config.sides))
      const bar = config.radius * 0.13
      // The glazed section is the middle: oil font below, room for the flue above.
      const glassBottom = -half + config.height * 0.2
      const glassTop = half - config.height * 0.26

      // --- Cage --------------------------------------------------------------
      const iron: BufferGeometry[] = []

      // Base dish and top cap: both hexagonal, one flat and one conical.
      iron.push(prismGeometry(
        config.radius * 1.08, config.radius, config.height * 0.11, sides,
        [0, -half + config.height * 0.055, 0], tint('iron', -0.04, 0.7),
      ))
      iron.push(prismGeometry(
        config.radius * 1.12, config.radius * 0.42, config.height * 0.19, sides,
        [0, half - config.height * 0.16, 0], tint('iron', 0.03, 0.7),
      ))
      // Flue: if the hot air cannot get out the flame dies. A functional detail,
      // and what makes the top of the silhouette read as a lantern.
      iron.push(prismGeometry(
        config.radius * 0.4, config.radius * 0.34, config.height * 0.09, sides,
        [0, half - config.height * 0.025, 0], tint('iron', 0.07, 0.7),
      ))

      // Corner posts: the forged iron bars left between the glass panels.
      const step = (Math.PI * 2) / sides
      for (let i = 0; i < sides; i += 1) {
        const a = i * step
        const post = boxGeometry(
          [bar, glassTop - glassBottom + config.height * 0.1, bar * 1.15],
          [0, 0, 0],
          tint('iron', jitter(random, 0.05), 0.7),
        )
        // Orient first, then translate — reversed, the post is flung into orbit.
        post.rotateY(a)
        post.translate(
          Math.sin(a) * config.radius * 0.97,
          (glassBottom + glassTop) / 2,
          Math.cos(a) * config.radius * 0.97,
        )
        iron.push(post)
      }
      // The bottom and top frames holding the glass panels.
      for (const y of [glassBottom, glassTop]) {
        iron.push(bandGeometry(config.radius * 0.99, y, bar * 1.1, bar * 0.8, sides,
          tint('iron', -0.02, 0.7)))
      }

      // --- Glass ---------------------------------------------------------------
      // The panels sit slightly INSIDE the posts: at the same radius their side
      // faces would be coplanar with the posts' faces and would flicker.
      const glass = prismGeometry(
        config.radius * 0.9, config.radius * 0.9, glassTop - glassBottom, sides,
        [0, (glassBottom + glassTop) / 2, 0], tint('glass', 0.04, 0.4),
        { capTop: false, capBottom: false },
      )

      // --- Oil font and wick ------------------------------------------------------
      const fontTop = glassBottom + config.height * 0.16
      const font = latheGeometry([
        { y: glassBottom - config.height * 0.02, radius: config.radius * 0.5 },
        { y: glassBottom + config.height * 0.06, radius: config.radius * 0.62 },
        { y: fontTop, radius: config.radius * 0.44 },
      ], sides * 2, [0, 0, 0], tint('glass', -0.05, 0.4), { capTop: true })

      const wick = prismGeometry(
        config.radius * 0.075, config.radius * 0.05, config.height * 0.09, 4,
        [0, fontTop + config.height * 0.035, 0], tint('char', 0.05),
      )

      // --- Flame -------------------------------------------------------------
      // A smaller, calmer version of the torch's flame: in a closed lantern the
      // flame gets no wind, so it flickers less as well.
      const flameHeight = config.height * config.flameHeight
      const flameBase = fontTop + config.height * 0.07
      const flameProfile: Level[] = [
        { y: 0, radius: flameHeight * 0.2 },
        { y: flameHeight * 0.22, radius: flameHeight * 0.3 },
        { y: flameHeight * 0.58, radius: flameHeight * 0.19 },
        { y: flameHeight, radius: flameHeight * 0.03 },
      ]
      const flame = mergeColoured([
        latheGeometry(flameProfile, 6, [0, 0, 0], tint('ember', 0.06, 0.35),
          { colourTop: tint('emberTip', 0.02, 0.35) }),
      ])

      // --- Carrying hoop ----------------------------------------------------------
      const handle: BufferGeometry[] = [bandGeometry(
        config.radius * 0.3, half + config.height * 0.1, bar * 0.9, bar * 0.55, 8,
        tint('iron', 0.06, 0.7), { inner: true },
      )]
      // The tongue joining the hoop to the flue.
      handle.push(boxGeometry(
        [bar * 1.1, config.height * 0.1, bar],
        [0, half + config.height * 0.045, 0],
        tint('iron', 0.02, 0.7),
      ))

      return {
        frame: {
          slot: 'iron' as const,
          geometry: mergeColoured(iron),
          extras: [{ slot: 'glass' as const, geometry: mergeColoured([glass]) }],
        },
        font: {
          slot: 'glass' as const,
          geometry: mergeColoured([font]),
          extras: [{ slot: 'char' as const, geometry: mergeColoured([wick]) }],
        },
        flame: {
          slot: 'ember' as const,
          geometry: flame,
          origin: [0, flameBase, 0] as const,
        },
        handle: { slot: 'iron' as const, geometry: mergeColoured(handle) },
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
      if (!lit) return
      const amount = getConfig().flicker
      if (amount === 0) return
      elapsed += Math.max(0, dt)
      // Slower and smaller than the torch's: the glass shields the flame from wind.
      const pulse = Math.sin(elapsed * 6.4) * 0.06 + Math.sin(elapsed * 11.1 + 0.9) * 0.035
      const anchor = parts.flame.anchor
      anchor.scale.set(1 - pulse * 0.4 * amount, 1 + pulse * amount, 1 - pulse * 0.4 * amount)
      anchor.rotation.z = Math.sin(elapsed * 4.7 + 1.3) * 0.03 * amount
    },
  }, overrides)
}
