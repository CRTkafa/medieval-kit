/**
 * @medieval-kit/vegetables
 *
 * A market bundle of vegetables, mixed from eight kinds.
 *
 * Six of them are what a medieval European kitchen had -- turnip, cabbage,
 * onion, leek, parsnip and carrot -- and the last two, tomato and potato, are
 * New World crops that only reach Europe after 1492. They are here because a
 * kit is more useful than it is a museum, and the carrot is orange rather than
 * the purple a medieval one would have been. Anyone who wants the strictly
 * period set can have it without thinking about it: the kinds are ordered so
 * that `lead: 0` with `kinds: 6` gives exactly those six and never reaches the
 * two after them.
 *
 * The heap is two parts -- `bulbs` for the things that sit on their base and
 * `roots` for the things that lie on their side -- because those are the two
 * ways a vegetable rests, and a consumer wanting only one of them should not
 * have to take both.
 *
 * FOURTH VERSION. The third authored the composition as a slot list and that
 * held; what failed was the reading of the individual vegetables. The critic
 * saw an agave, two artichokes and a plank: the greens were straight rigid
 * triangles half the model tall, the two cabbages were olive balls with
 * pointed spikes, the lone carrot lay flat enough to read as a board, and the
 * parsnips vanished under it. So this pass:
 * - The reference's four diagonal parsnips are now four authored lay slots,
 *   tips overhanging the front-left edge, crowns tucked under the leek's
 *   shank near the centre. The carrot slot is gone (the reference has no
 *   carrot; the kind survives for configs that ask for it).
 * - The two cabbages merged into ONE at ~2.3 turnip diameters, slightly
 *   oblate, with broad blunt-tipped leaves leaning OUT from the base and only
 *   gently curling back, instead of narrow spikes hugging the head. The old
 *   spikes' tips also arced to the floor and became the "detached shadow
 *   cards" under the balls; the new lean keeps every tip above the equator.
 * - The greens are five broad drooping blades on a VISIBLE stem bundle that
 *   stands on the ground behind the bulb row (base hidden by the pile), not
 *   seven straight triangles converging on a buried point. Each blade bends
 *   through four levels so the tip falls below horizontal.
 * - The leek is longer (about twice the bulb-cluster width), tapers, stays
 *   pale for its lower half and ends in four splayed flat straps; the tomato
 *   left the authored bundle (its slot is an onion, which the reference
 *   actually has) and the onions went golden.
 *
 * Dead ends worth not repeating:
 * - The leek was three crossed single-sided quads and read as broken geometry.
 *   A leaf is `dishedSheetGeometry` (a real V cross-section with thickness)
 *   put through `bendGeometry` to droop. Do NOT build the V from two tapered
 *   boxes: the taper walks their inner edges apart and leaves a slit.
 * - Carrot and parsnip had a separate pale "cut crown" lathe butted on the
 *   thick end. It read as a white hexagonal plug from a different toy. The
 *   taper must run continuously tip to shoulder in ONE lathe, and the crown is
 *   a flare plus green stubs whose bases end inside the body.
 * - `colourTop` interpolates across the WHOLE profile, so a purple crown on a
 *   cream turnip bled to its root. The purple stops in a line on the real
 *   thing, and a line is a second lathe overlapped a few percent PROUD of the
 *   first so the surfaces cross instead of sharing coplanar faces.
 * - Leaves are built AT THE ORIGIN, rotated, then carried into place.
 * - Nothing is set down by arguing where its lowest point ought to be. The
 *   bounding box is measured after posing and the piece is translated so the
 *   claim "lowest point at zero" is true by construction.
 * - Cabbage leaves given a hard positive droop curl toward their own hollow,
 *   which faces the head: the tips dig back in and pit the surface. Lean the
 *   leaf out with rotateX and keep the droop mild instead.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bendGeometry,
  createKitModel,
  createRandom,
  dishedSheetGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  taperedBoxGeometry,
  type Level,
  type SheetLevel,
} from '../core/index.ts'

export interface VegetablesConfig {
  /** How many vegetables in the heap. */
  readonly count: number
  /** How many of the eight kinds appear in the mix. */
  readonly kinds: number
  /**
   * Which kind leads the mix, and where it starts counting:
   * 0 turnip, 1 cabbage, 2 onion, 3 leek, 4 parsnip, 5 carrot, 6 tomato,
   * 7 potato.
   */
  readonly lead: number
  /** Overall size of one vegetable (metres). */
  readonly size: number
  /** How far the heap spreads, as a multiple of its own size. */
  readonly spread: number
  readonly seed: number
}

export const vegetablesDefaults: VegetablesConfig = {
  count: 15,
  kinds: 8,
  lead: 0,
  size: 0.1,
  // The authored bundle is designed at 1.5; the slider scales it looser or
  // tighter around that.
  spread: 1.5,
  seed: 71,
}

export type VegetablesParts = 'bulbs' | 'roots'

/** Kinds in the order the `lead` slider indexes them. */
// Ordered so the first six are the period-correct set: `lead: 0` with
// `kinds: 6` yields exactly those and never reaches the two after them.
const KINDS = [
  'turnip', 'cabbage', 'onion', 'leek', 'parsnip', 'carrot', 'tomato', 'potato',
] as const
type Kind = (typeof KINDS)[number]

/** Which of them sit on a base and which lie on their side. */
const LIES_DOWN: ReadonlySet<Kind> = new Set(['leek', 'parsnip', 'carrot'])

/**
 * The authored bundle. Coordinates are in units of `size`, scaled by `spread`
 * horizontally. Ordered so that supporters come before the supported: every
 * lying root crosses only slots earlier than itself, so a small `count` still
 * yields a coherent little pile instead of an unsupported one.
 *
 * The map of it, matching the reference: turnips and golden onions in a front
 * row, the potato pair among them, the one big cabbage back right, the leek
 * lying diagonally with its cut butt overhanging the front right, and FOUR
 * parsnips laid at 25-35 degrees across the bulb row, tips out past the
 * front-left edge, crowns tucked under the leek shank near the centre.
 */
interface SitSlot {
  readonly kind: Kind
  readonly pose: 'sit'
  readonly x: number
  readonly z: number
  /** Extra height, for pieces resting on the tier below. */
  readonly lift?: number
}
interface LaySlot {
  readonly kind: Kind
  readonly pose: 'lay'
  /** Where the thin end goes (x, z) and how high it is. */
  readonly tip: readonly [number, number]
  readonly tipY: number
  /** Where the thick end aims (x, z) and how high it is. */
  readonly crown: readonly [number, number]
  readonly crownY: number
  /** Anchors to use instead when the kind had to be substituted. */
  readonly alt?: Omit<LaySlot, 'kind' | 'pose' | 'alt'>
}
type Slot = SitSlot | LaySlot

const SLOTS: readonly Slot[] = [
  { kind: 'turnip', pose: 'sit', x: 0.05, z: 0.70 },
  { kind: 'onion', pose: 'sit', x: 0.85, z: 0.60 },
  { kind: 'turnip', pose: 'sit', x: -0.75, z: 0.55 },
  { kind: 'onion', pose: 'sit', x: 0.45, z: -0.10 },
  { kind: 'potato', pose: 'sit', x: -0.50, z: -0.40 },
  // The one big cabbage, back right, on the ground: lifted it showed a slice
  // of daylight under its base from the rear views. It sits BEHIND the leek's
  // line: at (0.75, -0.75) the shank ran straight through its heart.
  { kind: 'cabbage', pose: 'sit', x: 0.95, z: -0.95 },
  { kind: 'onion', pose: 'sit', x: 1.50, z: 0.45 },
  // The leek lies diagonally across the whole pile: butt overhanging the
  // front right, shank wedged over the right onion and resting on the centre
  // onion, straps ending in the air over the greens at the back left, and the
  // whole line passing in FRONT of the cabbage.
  {
    kind: 'leek', pose: 'lay',
    tip: [2.10, 0.90], tipY: 0.52, crown: [-0.15, -0.10], crownY: 1.27,
    alt: { tip: [1.90, 1.20], tipY: 0.10, crown: [0.20, -0.20], crownY: 1.00 },
  },
  // Left-edge supporters for the parsnip shafts.
  { kind: 'turnip', pose: 'sit', x: -1.40, z: 0.55 },
  { kind: 'potato', pose: 'sit', x: -0.85, z: 1.45 },
  // The reference's signature: four parsnips on the same diagonal, lying
  // NEARLY LEVEL on the bulb shoulders with only the tips overhanging.
  // Pitched harder (tips at 0.3, crowns at 0.9) the tips pointed at the
  // ground and read as fangs from the back views.
  {
    kind: 'parsnip', pose: 'lay',
    tip: [-1.70, 1.05], tipY: 0.44, crown: [0.50, -0.05], crownY: 0.88,
  },
  {
    kind: 'parsnip', pose: 'lay',
    tip: [-1.85, 0.55], tipY: 0.48, crown: [0.40, -0.30], crownY: 0.90,
  },
  {
    kind: 'parsnip', pose: 'lay',
    tip: [-1.20, 1.40], tipY: 0.42, crown: [1.05, -0.10], crownY: 0.78,
  },
  {
    kind: 'parsnip', pose: 'lay',
    tip: [-0.95, 1.75], tipY: 0.40, crown: [0.90, 0.60], crownY: 0.70,
  },
  { kind: 'onion', pose: 'sit', x: 1.20, z: 1.10 },
]

export function createModel(overrides: Partial<VegetablesConfig> = {}) {
  return createKitModel<VegetablesConfig, 'produce', VegetablesParts>({
    id: 'vegetables',
    defaults: vegetablesDefaults,
    slots: ['produce'],

    build: ({ config, random }) => {
      const S = config.size
      const spreadK = config.spread / 1.5
      const hsl = (h: number, s: number, l: number, r: () => number): Color =>
        new Color().setHSL(
          (h + jitter(r, 0.012) + 1) % 1,
          Math.min(1, Math.max(0, s + jitter(r, 0.06))),
          Math.min(1, Math.max(0, l + jitter(r, 0.05))),
        )

      /**
       * One leaf blade: a V-section strip with real thickness, drooping away
       * from its base. Built along +Y with the hollow facing +Z; the bend
       * curls it toward the hollow, so rotateX a little, rotateY to aim, and
       * the blade arcs over in that direction. Four levels so the bend is an
       * arc and the outer half actually turns over instead of shearing.
       * `baseF`/`tipF` set how much of `width` the root and the tip keep: the
       * greens want a narrow petiole out of a thin stem, the cabbage wants a
       * blunt ruffled tip.
       */
      function leafBlade(
        len: number, width: number, cup: number, thick: number,
        base: Color, tipColour: Color, droop: number,
        baseF = 0.42, tipF = 0.12,
      ): BufferGeometry {
        const levels: SheetLevel[] = [
          { y: 0, halfWidth: width * baseF, thickness: thick, curve: cup },
          { y: len * 0.42, halfWidth: width * 0.5, thickness: thick, curve: cup * 0.8 },
          { y: len * 0.74, halfWidth: width * 0.4, thickness: thick, curve: cup * 0.5 },
          { y: len, halfWidth: width * tipF, thickness: thick, curve: cup * 0.15 },
        ]
        return bendGeometry(dishedSheetGeometry(levels, 2, base, tipColour), droop)
      }

      /**
       * One vegetable, built STANDING at the origin with its base near y = 0
       * and its own axis up. Posing (laying the roots down, tilting, settling
       * onto the ground) is the placement's job, because the pose depends on
       * where in the bundle the piece goes.
       */
      function grow(kind: Kind, r: () => number): BufferGeometry {
        const pieces: BufferGeometry[] = []
        const scale = S * (0.86 + r() * 0.3)

        if (kind === 'turnip') {
          // A squat globe, flat on top, drawn down to a root at the bottom.
          const R = scale * 0.5
          const pale = hsl(0.11, 0.16, 0.79, r)
          const purple = hsl(0.8, 0.32, 0.42, r)
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.1 },
              { y: R * 0.22, radius: R * 0.72 },
              { y: R * 0.62, radius: R },
              { y: R * 0.92, radius: R * 0.97 },
            ] as Level[],
            // No top cap: it is buried under the shoulder.
            9, [0, 0, 0], pale, { colourTop: pale, capTop: false },
          ))
          // The purple shoulder, a few percent PROUD of the body so the two
          // surfaces cross instead of meeting in coplanar faces.
          pieces.push(latheGeometry(
            [
              { y: R * 0.78, radius: R * 1.04 },
              { y: R * 1.18, radius: R * 0.9 },
              { y: R * 1.42, radius: R * 0.44 },
            ] as Level[],
            9, [0, 0, 0], purple, { colourTop: purple, capBottom: false },
          ))
          // The cut stalk, a pale nub on the crown.
          pieces.push(latheGeometry(
            [
              { y: R * 1.34, radius: R * 0.2 },
              { y: R * 1.52, radius: R * 0.12 },
            ] as Level[],
            6, [0, 0, 0], hsl(0.16, 0.22, 0.66, r), { capBottom: false },
          ))
        } else if (kind === 'cabbage') {
          // ONE savoy head at about 2.3 turnip diameters, slightly wider than
          // tall. Two of these at 1.2 diameters read as artichokes.
          const R = scale * 1.15
          const heart = hsl(0.17, 0.50, 0.28, r)
          const outer = hsl(0.18, 0.55, 0.17, r)
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.5 },
              { y: R * 0.4, radius: R * 0.9 },
              { y: R * 0.9, radius: R },
              { y: R * 1.4, radius: R * 0.88 },
              { y: R * 1.75, radius: R * 0.4 },
            ] as Level[],
            9, [0, 0, 0], heart, { colourTop: heart },
          ))
          // Broad blunt outer leaves cupping the LOWER half. They lean out
          // from the base with only a mild curl: a hard positive droop curls a
          // leaf into its own hollow -- which faces the head -- and the tips
          // dig in; a hard lean with a long blade sent the old tips to the
          // floor, where they read as detached shadow cards.
          for (let i = 0; i < 5; i += 1) {
            const a = (i / 5) * Math.PI * 2 + r() * 0.7
            const leaf = leafBlade(
              R * 1.15, R * 1.35, R * 0.5, scale * 0.05,
              outer, hsl(0.21, 0.50, 0.22, r), 1.6 + r() * 0.8,
              0.42, 0.26,
            )
            leaf.rotateX(-0.62 - r() * 0.15)
            leaf.rotateY(a + Math.PI)
            leaf.translate(Math.sin(a) * R * 0.72, R * 0.06, Math.cos(a) * R * 0.72)
            pieces.push(leaf)
          }
        } else if (kind === 'onion') {
          // Golden: the reference onions are the warmest thing in the bundle,
          // and the old cream skin was read as "a squat orange tomato" next to
          // them because only the tomato carried any saturation.
          const R = scale * 0.44
          const skin = hsl(0.075, 0.62, 0.40, r)
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.16 },
              { y: R * 0.3, radius: R * 0.84 },
              { y: R * 0.78, radius: R },
              { y: R * 1.3, radius: R * 0.72 },
              { y: R * 1.62, radius: R * 0.2 },
              { y: R * 1.95, radius: R * 0.07 },
            ] as Level[],
            9, [0, 0, 0], skin, { colourTop: hsl(0.09, 0.52, 0.52, r) },
          ))
        } else if (kind === 'leek') {
          // A SOLID shank, pale at the cut butt grading to green, with flat
          // splayed straps at the top. The butt cap is real: in the bundle it
          // faces the viewer. Long: the reference leek spans about twice the
          // bulb cluster and overhangs the front right.
          const L = scale * 4.3
          const R = scale * 0.24
          // The colour lerp runs level by level, so the pale half is held by
          // crowding the levels toward the butt: the midpoint of the blend
          // sits at 70% of the length.
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R },
              { y: L * 0.5, radius: R * 0.96 },
              { y: L * 0.7, radius: R * 0.9 },
              { y: L * 0.86, radius: R * 0.82 },
              { y: L, radius: R * 0.72 },
            ] as Level[],
            10, [0, 0, 0], hsl(0.14, 0.16, 0.66, r),
            { colourTop: hsl(0.22, 0.50, 0.20, r) },
          ))
          // Three-to-four flat dark straps splaying from the top, fanned only
          // across the local +X half: in the lay pose rotateZ carries local +X
          // upward, so this is what keeps a strap from diving down through
          // the pile like a thrown knife.
          for (let i = 0; i < 4; i += 1) {
            const a = 0.35 + (i / 3) * (Math.PI - 0.7) + jitter(r, 0.12)
            const strap = leafBlade(
              L * 0.40 * (0.9 + r() * 0.2), R * 2.3, R * 0.35, scale * 0.045,
              hsl(0.23, 0.50, 0.16, r), hsl(0.26, 0.55, 0.10, r),
              1.1 + r() * 0.7, 0.30, 0.16,
            )
            strap.rotateX(0.12 + r() * 0.18)
            strap.rotateY(a)
            strap.translate(Math.sin(a) * R * 0.3, L * 0.94, Math.cos(a) * R * 0.3)
            pieces.push(strap)
          }
        } else if (kind === 'tomato') {
          // Squat, flattened top and bottom, with the calyx still on it.
          const R = scale * 0.42
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.34 },
              { y: R * 0.24, radius: R * 0.86 },
              { y: R * 0.7, radius: R },
              { y: R * 1.18, radius: R * 0.84 },
              { y: R * 1.36, radius: R * 0.3 },
            ] as Level[],
            9, [0, 0, 0], hsl(0.02, 0.76, 0.42, r),
            { colourTop: hsl(0.03, 0.7, 0.34, r) },
          ))
          const green = hsl(0.18, 0.62, 0.14, r)
          for (let i = 0; i < 5; i += 1) {
            const a = (i / 5) * Math.PI * 2
            const sepal = taperedBoxGeometry(
              [R * 0.3, R * 0.07],
              [R * 0.1, R * 0.05],
              R * 0.6,
              [0, 0, 0],
              green,
            )
            // Flat on the shoulder and sunk so the base half is inside the
            // crown: sat higher they floated as loose slivers over the top.
            sepal.rotateZ(1.32)
            sepal.rotateY(a)
            sepal.translate(Math.sin(a) * R * 0.16, R * 1.12, Math.cos(a) * R * 0.16)
            pieces.push(sepal)
          }
        } else if (kind === 'potato') {
          // Lumpy and asymmetric on purpose: its levels wander instead of
          // describing a curve, because a smooth ellipsoid is an egg.
          const R = scale * 0.4
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.4 },
              { y: R * 0.34, radius: R * (0.88 + jitter(r, 0.12)) },
              { y: R * 0.82, radius: R * (1.02 + jitter(r, 0.14)) },
              { y: R * 1.3, radius: R * (0.94 + jitter(r, 0.14)) },
              { y: R * 1.72, radius: R * (0.7 + jitter(r, 0.1)) },
              { y: R * 2, radius: R * 0.3 },
            ] as Level[],
            8, [0, 0, 0], hsl(0.09, 0.3, 0.56, r),
            { colourTop: hsl(0.08, 0.26, 0.5, r) },
          ))
        } else {
          // Parsnip and carrot: ONE continuous lathe from a thin fibrous tip
          // through a flared shoulder, closed by a rounded crown carrying a
          // cluster of green leaf stubs whose bases end inside the body.
          const carrot = kind === 'carrot'
          const len = scale * (carrot ? 3.1 : 2.7)
          const R = scale * (carrot ? 0.24 : 0.30)
          // The parsnip is TAN, not white: pale as it is next to a carrot, at
          // full lightness it read as a set of horns lying on the pile.
          const body = carrot ? hsl(0.07, 0.82, 0.47, r) : hsl(0.095, 0.38, 0.58, r)
          const crown = carrot ? hsl(0.08, 0.62, 0.56, r) : hsl(0.10, 0.34, 0.64, r)
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.05 },
              { y: len * 0.18, radius: R * 0.38 },
              { y: len * 0.55, radius: R * 0.74 },
              { y: len * 0.88, radius: R * 0.95 },
              { y: len * 0.97, radius: R * 1.03 },
              { y: len, radius: R * 0.5 },
            ] as Level[],
            8, [0, 0, 0], body, { colourTop: crown },
          ))
          // A couple of fibrous rootlets at the tip, bases inside the cone.
          const fibre = hsl(0.09, 0.28, 0.44, r)
          for (let i = 0; i < 2; i += 1) {
            const f = taperedBoxGeometry(
              [R * 0.1, R * 0.08], [R * 0.02, R * 0.02], len * 0.12, [0, 0, 0], fibre,
            )
            f.rotateZ(Math.PI - (0.35 + r() * 0.3))
            f.rotateY(r() * Math.PI * 2)
            f.translate(0, len * 0.09, 0)
            pieces.push(f)
          }
          const stub = hsl(0.17, 0.46, 0.17, r)
          for (let i = 0; i < 3; i += 1) {
            const a = (i / 3) * Math.PI * 2 + jitter(r, 0.6)
            const s = taperedBoxGeometry(
              [R * 0.26, R * 0.2], [R * 0.1, R * 0.08], len * 0.14, [0, 0, 0], stub,
            )
            s.rotateZ(0.24 + r() * 0.2)
            s.rotateY(a)
            s.translate(Math.sin(a) * R * 0.16, len * 0.985, Math.cos(a) * R * 0.16)
            pieces.push(s)
          }
        }

        return mergeColoured(pieces)
      }

      /** Lowest point to y = 0, measured, not argued. */
      function settle(g: BufferGeometry): void {
        g.computeBoundingBox()
        g.translate(0, -(g.boundingBox?.min.y ?? 0), 0)
      }

      // --- The bundle -----------------------------------------------------
      const count = Math.max(1, Math.round(config.count))
      const kindCount = Math.min(KINDS.length, Math.max(1, Math.round(config.kinds)))
      const lead = ((Math.round(config.lead) % KINDS.length) + KINDS.length) % KINDS.length
      const mix = Array.from({ length: kindCount }, (_, i) => KINDS[(lead + i) % KINDS.length]!)
      const sitters = mix.filter((k) => !LIES_DOWN.has(k))
      const liers = mix.filter((k) => LIES_DOWN.has(k))

      /** The slot's kind if the mix allows it, else one of matching posture. */
      function pickKind(i: number, prefer: Kind, wantsLie: boolean): Kind {
        if (mix.includes(prefer)) return prefer
        const pool = wantsLie
          ? (liers.length > 0 ? liers : mix)
          : (sitters.length > 0 ? sitters : mix)
        return pool[i % pool.length]!
      }

      const bulbs: BufferGeometry[] = []
      const roots: BufferGeometry[] = []

      for (let i = 0; i < count; i += 1) {
        // A separate stream per item, so adding one vegetable does not
        // reshuffle every vegetable after it.
        const r = createRandom(config.seed * 31 + i * 977)
        const slot = SLOTS[i]

        if (slot !== undefined && slot.pose === 'lay') {
          const kind = pickKind(i, slot.kind, true)
          const g = grow(kind, r)
          // A substituted kind has its own proportions, so it may carry its
          // own anchors.
          const a = kind !== slot.kind && slot.alt ? slot.alt : slot
          const K = S * spreadK
          const dx = (a.crown[0] - a.tip[0]) * K
          const dz = (a.crown[1] - a.tip[1]) * K
          const pitch = Math.atan2((a.crownY - a.tipY) * S, Math.hypot(dx, dz))
          g.rotateZ(Math.PI / 2 - pitch)
          g.rotateY(Math.atan2(dz, -dx))
          g.translate(a.tip[0] * K, a.tipY * S, a.tip[1] * K)
          // The anchors put the AXIS at tipY; a substituted round kind is
          // fatter below its axis than the roots these slots were drawn for
          // and can breach the ground. Lifting is allowed, sinking is not.
          g.computeBoundingBox()
          const under = g.boundingBox?.min.y ?? 0
          if (under < 0) g.translate(0, -under, 0)
          ;(LIES_DOWN.has(kind) ? roots : bulbs).push(g)
        } else {
          // Sitting slot, or the overflow ring past the authored bundle.
          const inRing = slot === undefined
          const kind = inRing
            ? mix[i % mix.length]!
            : pickKind(i, (slot as SitSlot).kind, false)
          const g = grow(kind, r)
          if (LIES_DOWN.has(kind)) {
            // A lying kind in a sitting spot is laid flat where it stands.
            g.rotateZ(Math.PI / 2)
          } else {
            g.rotateX(jitter(r, 0.09))
            g.rotateZ(jitter(r, 0.09))
          }
          g.rotateY(r() * Math.PI * 2)
          settle(g)
          if (inRing) {
            const angle = i * 2.399963
            const ring = S * spreadK * (1.9 + 0.3 * Math.floor(i / SLOTS.length))
            g.translate(Math.sin(angle) * ring, 0, Math.cos(angle) * ring)
          } else {
            const s = slot as SitSlot
            g.translate(s.x * S * spreadK, (s.lift ?? 0) * S, s.z * S * spreadK)
          }
          ;(LIES_DOWN.has(kind) ? roots : bulbs).push(g)
        }
      }

      // The greens: a narrow stem bundle standing on the ground behind the
      // bulb row (its foot hidden between the potato and the cabbage), with
      // five broad blades fanning from its top, each bending over so the tip
      // falls below horizontal. Dressing, not a counted vegetable. The old
      // version was seven straight blades converging on a buried point, and
      // it read as an agave.
      {
        const r = createRandom(config.seed * 31 + 991)
        const pieces: BufferGeometry[] = []
        const stemTop = 1.6 * S
        pieces.push(latheGeometry(
          [
            { y: 0, radius: 0.20 * S },
            { y: 0.9 * S, radius: 0.17 * S },
            { y: stemTop, radius: 0.13 * S },
          ] as Level[],
          7, [0, 0, 0], hsl(0.20, 0.35, 0.42, r),
          { colourTop: hsl(0.22, 0.45, 0.30, r) },
        ))
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + jitter(r, 0.4)
          const len = S * (1.35 + r() * 0.35)
          const leaf = leafBlade(
            len, S * 1.4, S * 0.30, S * 0.05,
            hsl(0.24, 0.52, 0.15, r), hsl(0.21, 0.58, 0.21, r),
            6.0 + r() * 2.0, 0.14, 0.18,
          )
          leaf.rotateX(0.5 + r() * 0.2)
          leaf.rotateY(a)
          // Base sunk below the stem's top so every petiole is rooted.
          leaf.translate(Math.sin(a) * 0.06 * S, stemTop - 0.15 * S, Math.cos(a) * 0.06 * S)
          pieces.push(leaf)
        }
        const bunch = mergeColoured(pieces)
        bunch.translate(-0.90 * S * spreadK, 0, -0.55 * S * spreadK)
        // A hard-drooping blade can arc below the stem's foot; lift, never
        // sink.
        bunch.computeBoundingBox()
        const under = bunch.boundingBox?.min.y ?? 0
        if (under < 0) bunch.translate(0, -under, 0)
        bulbs.push(bunch)
      }

      // `random` is the model's own stream and every vegetable uses its own,
      // so draw from it once to keep the seed meaningful at this level too.
      void random()

      return {
        bulbs: { slot: 'produce' as const, geometry: mergeColoured(bulbs.length ? bulbs : roots) },
        roots: roots.length > 0 && bulbs.length > 0
          ? { slot: 'produce' as const, geometry: mergeColoured(roots) }
          : undefined,
      }
    },
  }, overrides)
}
