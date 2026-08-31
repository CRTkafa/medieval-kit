/**
 * @medieval-kit/wooden-ladder
 *
 * Two rails with rungs between them. The cheapest model in the kit and one of
 * the highest in scene value: it suggests vertical movement in a scene.
 *
 * The rungs go INTO the rails (a housed joint), so no surface sits on the same
 * plane as the surface of the rails.
 */
import { Color } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
} from '../core/index.ts'

export interface WoodenLadderConfig {
  readonly height: number
  /** Distance between the rails (metres). */
  readonly width: number
  readonly rungCount: number
  /** How much the rails narrow towards the top. 0 = parallel. */
  readonly taper: number
  readonly seed: number
}

export const woodenLadderDefaults: WoodenLadderConfig = {
  height: 2.2,
  width: 0.42,
  rungCount: 8,
  taper: 0.18,
  seed: 4,
}

export type WoodenLadderParts = 'rails' | 'rungs'

export function createModel(overrides: Partial<WoodenLadderConfig> = {}) {
  return createKitModel<WoodenLadderConfig, 'oak', WoodenLadderParts>({
    id: 'wooden-ladder',
    defaults: woodenLadderDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      // A ladder is bare sapwood that spends its life being gripped and leaned,
      // so it wears pale rather than grey. Every reference photograph of one is
      // markedly lighter than the weathered oak the rest of the kit is cut from,
      // by about this much, and the palette constant is set for the rest of the
      // kit.
      const bleach = 0.13
      const shade = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), bleach + lift + jitter(random, 0.055))
        return tint
      }

      const railThickness = config.width * 0.1
      const half = config.width / 2

      // The rails converge towards the top; this single detail stops the ladder
      // from being "two boards" and makes it a ladder.
      const lean = half * config.taper
      /**
       * Half-gap between the rails at height fraction `t`.
       *
       * This exists because the rung length and the rail placement used to be
       * two separate expressions that disagreed. The rails are built upright
       * and then rotated about Z, so at height y each one sits at
       * `side·half − y·sin(θ)`; the rung length assumed `half − lean·t`, which
       * narrows where the real rails widen. At the default taper the error was
       * small enough to hide. At taper 0.4 on a 5 m ladder the top rungs came
       * out half the length of the gap they were supposed to span and floated
       * between the rails.
       *
       * Both now read from here, so they cannot drift apart again.
       */
      const railHalfAt = (t: number): number => {
        const y = -config.height / 2 + t * config.height
        return half - y * Math.sin(lean / config.height)
      }
      const rails = [-1, 1].map((side) => {
        const rail = chamferedBoxGeometry(
        [railThickness, railThickness * 1.35],
        [railThickness * 0.85, railThickness * 1.15],
        config.height,
        railThickness * 0.16,
        [0, 0, 0],
        shade(),
      )
        // Lean it slightly around the Z axis: bottom end out, top end in.
        rail.rotateZ((side * -lean) / config.height)
        rail.translate(side * half, 0, 0)
        return rail
      })

      const rungs = []
      const count = Math.max(2, config.rungCount)
      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.5) / count
        const y = -config.height / 2 + t * config.height
        // The rung is a little LONGER than the rail gap at that height, so that
        // its ends stay inside the rails.
        const span = railHalfAt(t) * 2 + railThickness * 0.9
        rungs.push(chamferedBoxGeometry(
        [span, railThickness * 1.05],
        [span, railThickness * 1.05],
        railThickness * 0.8,
        railThickness * 0.16,
        [0, y, 0],
        shade(0.03),
      ))
      }

      return {
        rails: { slot: 'oak', geometry: mergeColoured(rails) },
        rungs: { slot: 'oak', geometry: mergeColoured(rungs) },
      }
    },
  }, overrides)
}
