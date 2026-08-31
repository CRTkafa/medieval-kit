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
/**
 * Lightness a tinted colour is never taken below.
 *
 * These lightnesses are LINEAR, not sRGB, so the whole palette lives between
 * about 0.03 and 0.36 and a lift of -0.28 is an enormous move rather than a
 * gentle darkening. That is survivable while the palette sits high and fatal
 * once it drops. When `cloth` was measured against its references and taken
 * from linear lightness 0.364 to 0.252, every part carrying a -0.28 lift went
 * straight through zero: nine parts across six models -- the market stall's
 * whole trestle, two stretchers, three cords and a set of bindings -- came out
 * pure black. In the render they then read as neutral GREY, because a black
 * albedo contributes nothing and the only thing left is the white specular.
 *
 * The lifts were not wrong. They are relative offsets and the thing they were
 * relative to moved. So the floor lives here rather than in nine call sites,
 * because otherwise the next palette measurement re-breaks all of them, and
 * because a part that keeps its hue at the bottom of its range is always a
 * better answer than one that loses it.
 */
const FLOOR = 0.045

export function createTinter(random: () => number) {
  return (
    key: keyof MedievalPalette,
    /** Lightness shift. Negative darkens. */
    lift = 0,
    /** Deviation multiplier. 0 gives a completely flat colour. */
    spread = 1,
  ): Color => {
    const scratch = new Color(MEDIEVAL_PALETTE[key])
    // `offsetHSL` is get-add-set, and this is the same thing with the lightness
    // clamped before the set rather than after. Clamping afterwards is not the
    // same: a colour that has already reached zero has no hue or saturation
    // left to read back, so lifting it returns grey instead of dark timber.
    const hsl = { h: 0, s: 0, l: 0 }
    scratch.getHSL(hsl)
    scratch.setHSL(
      hsl.h + jitter(random, 0.012 * spread),
      hsl.s + jitter(random, 0.05 * spread),
      Math.max(FLOOR, hsl.l + lift + jitter(random, 0.05 * spread)),
    )
    return scratch
  }
}

export type Tinter = ReturnType<typeof createTinter>
