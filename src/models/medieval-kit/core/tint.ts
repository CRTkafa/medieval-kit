import { Color } from 'three'

import { MEDIEVAL_PALETTE, type MedievalPalette } from './materials.ts'
import { jitter } from './random.ts'

/**
 * Factory that produces colours deviated from the palette.
 *
 * Every model used to rewrite this inline — the same five lines thirteen
 * times. The cost of the repetition was not just line count: the deviation
 * amounts had drifted from model to model, so when two models were put side
 * by side one of them visibly had more variation than the other.
 *
 * The returned Color IS THE SAME OBJECT ON EVERY CALL. That is not a problem
 * because the geometry functions read the colour immediately and write it into
 * the vertices, and it is far cheaper than allocating one Color per call. But
 * anyone who wants to keep it must do `new Color(tint(...))` — otherwise the
 * next call mutates what they are holding.
 */
export function createTinter(random: () => number) {
  const scratch = new Color()
  return (
    key: keyof MedievalPalette,
    /** Lightness shift. Negative darkens. */
    lift = 0,
    /** Deviation multiplier. 0 gives a completely flat colour. */
    spread = 1,
  ): Color => {
    scratch.copy(MEDIEVAL_PALETTE[key])
    scratch.offsetHSL(
      jitter(random, 0.012 * spread),
      jitter(random, 0.05 * spread),
      lift + jitter(random, 0.05 * spread),
    )
    return scratch
  }
}

export type Tinter = ReturnType<typeof createTinter>
