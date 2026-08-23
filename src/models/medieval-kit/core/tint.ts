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
 * Every call returns A NEW Color.
 *
 * It used to return one shared object and mutate it, on the reasoning that the
 * geometry helpers read the colour immediately and an allocation per call is
 * waste. The reasoning holds right up until two tints appear as arguments of
 * the SAME call:
 *
 *     latheGeometry(profile, 7, origin, tint('char', 0.06),
 *       { colourTop: tint('charHot', -0.12) })
 *
 * Both arguments are the same object, so both carry whatever the second call
 * computed. That is not a hypothetical: it is why the torch's pitch head
 * rendered hot orange instead of black, and the same mistake was made twice
 * more in one session -- once in the anvil's stump, which came out painted in
 * end grain on every face, and once nearly in the shovel. Three times means
 * the hazard is in the helper, not in the callers.
 *
 * A few hundred Color allocations at build time is not a cost worth one class
 * of silent, invisible bug.
 */
export function createTinter(random: () => number) {
  return (
    key: keyof MedievalPalette,
    /** Lightness shift. Negative darkens. */
    lift = 0,
    /** Deviation multiplier. 0 gives a completely flat colour. */
    spread = 1,
  ): Color => {
    const scratch = new Color(MEDIEVAL_PALETTE[key])
    scratch.offsetHSL(
      jitter(random, 0.012 * spread),
      jitter(random, 0.05 * spread),
      lift + jitter(random, 0.05 * spread),
    )
    return scratch
  }
}

export type Tinter = ReturnType<typeof createTinter>
