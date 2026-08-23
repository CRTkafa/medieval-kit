/**
 * @medieval-kit/vegetables
 *
 * A loose heap of vegetables, mixed from six kinds.
 *
 * Eight kinds, and the mix is a slider rather than a fixed recipe.
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
 * The heap is two parts — `bulbs` for the things that sit on their base and
 * `roots` for the things that lie on their side — because those are the two
 * ways a vegetable rests, and a consumer wanting only one of them should not
 * have to take both.
 *
 * Every vegetable is authored with its LOWEST POINT AT THE ORIGIN. Placing a
 * heap then costs one translate per item and nothing can end up hovering,
 * which is not a small thing: the pile is the only model in the kit made
 * entirely of loose objects, so it is the one with the most ways to float.
 */
import { Color, type BufferGeometry } from 'three'

import {
  createKitModel,
  createRandom,
  jitter,
  latheGeometry,
  mergeColoured,
  taperedBoxGeometry,
  type Level,
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
  // Tight enough to be a heap. At 2.6 the vegetables were laid out in a ring
  // with daylight between every one of them, which is a display, not a pile.
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

export function createModel(overrides: Partial<VegetablesConfig> = {}) {
  return createKitModel<VegetablesConfig, 'produce', VegetablesParts>({
    id: 'vegetables',
    defaults: vegetablesDefaults,
    slots: ['produce'],

    build: ({ config, random }) => {
      const S = config.size
      const hsl = (h: number, s: number, l: number, r: () => number): Color =>
        new Color().setHSL(
          (h + jitter(r, 0.012) + 1) % 1,
          Math.min(1, Math.max(0, s + jitter(r, 0.06))),
          Math.min(1, Math.max(0, l + jitter(r, 0.05))),
        )

      /**
       * One vegetable, built with its lowest point at y = 0 and its own axis
       * up. Whatever lies down is laid down here, so the caller never has to
       * know which is which.
       */
      function grow(kind: Kind, r: () => number): { geometry: BufferGeometry; rest: number } {
        const pieces: BufferGeometry[] = []
        const scale = S * (0.86 + r() * 0.3)
        let widest = scale * 0.5   // body radius, used while shaping

        if (kind === 'turnip') {
          // A squat globe, flat on top, drawn down to a root at the bottom. The
          // purple is only on the shoulder: it is where the sun reached it
          // above the soil, which is why it stops in a line.
          const R = scale * 0.5
          widest = R
          const pale = hsl(0.11, 0.16, 0.79, r)
          const purple = hsl(0.83, 0.3, 0.5, r)
          // Two lathes, not one gradient. `colourTop` interpolates across the
          // WHOLE profile, so a purple crown on a cream body bled all the way
          // down and the turnip came out lavender to its root. On a real one
          // the purple stops in a LINE -- it is the part that stood above the
          // soil and caught the sun -- and a line is a second piece, overlapped
          // into the first so there is no seam between them.
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.1 },
              { y: R * 0.22, radius: R * 0.72 },
              { y: R * 0.62, radius: R },
              { y: R * 0.92, radius: R * 0.97 },
            ] as Level[],
            // No top cap: it is buried under the shoulder. Two turnips
            // touching in a tight heap met on exactly these hidden discs,
            // which is the same saving `bandGeometry` makes on the inside of
            // a hoop -- free, and here it removes a whole class of collision.
            9, [0, 0, 0], pale, { colourTop: pale, capTop: false },
          ))
          // The shoulder is PROUD of the body it caps. Started at the same
          // radius, the two lathes ran parallel through their overlap and met
          // in coplanar faces -- visible the moment a heap was made of nothing
          // but turnips. A few percent wider makes the surfaces cross instead,
          // and the widest point of a turnip really is its shoulder.
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
          const R = scale * 0.62
          widest = R
          const inner = hsl(0.23, 0.38, 0.62, r)
          const outer = hsl(0.27, 0.44, 0.36, r)
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.42 },
              { y: R * 0.34, radius: R * 0.92 },
              { y: R * 0.86, radius: R },
              { y: R * 1.4, radius: R * 0.86 },
              { y: R * 1.7, radius: R * 0.3 },
            ] as Level[],
            9, [0, 0, 0], inner, { colourTop: inner },
          ))
          // Three loose outer leaves. A cabbage that is a smooth ball is a
          // melon; what says cabbage is the leaves that have not closed.
          for (let i = 0; i < 3; i += 1) {
            const a = (i / 3) * Math.PI * 2 + r() * 1.4
            // Built AT THE ORIGIN, rotated, and only then carried to where it
            // grows. Rotation turns a body about the origin, so a leaf built
            // already in place is flung away from the cabbage by its own
            // distance times the sine of the angle. That is exactly what
            // happened, and why the support check found loose leaves lying
            // beside the heap with nothing holding them.
            const leaf = taperedBoxGeometry(
              [R * 0.95, R * 0.1],
              [R * 0.5, R * 0.07],
              R * 1.05,
              [0, 0, 0],
              outer,
            )
            leaf.rotateZ(0.95 + r() * 0.4)
            leaf.rotateY(a)
            leaf.translate(Math.sin(a) * R * 0.42, R * 0.62, Math.cos(a) * R * 0.42)
            pieces.push(leaf)
          }
        } else if (kind === 'onion') {
          const R = scale * 0.44
          widest = R
          const skin = hsl(0.09, 0.52, 0.52, r)
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.16 },
              { y: R * 0.3, radius: R * 0.84 },
              { y: R * 0.78, radius: R },
              { y: R * 1.3, radius: R * 0.72 },
              { y: R * 1.62, radius: R * 0.2 },
              { y: R * 1.95, radius: R * 0.07 },
            ] as Level[],
            9, [0, 0, 0], skin, { colourTop: hsl(0.11, 0.35, 0.66, r) },
          ))
        } else if (kind === 'leek') {
          // White at the root, pale green through the middle, dark flat leaves
          // at the top. Built standing and laid down at the end.
          const len = scale * 3.4
          const R = scale * 0.19
          widest = R
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.5 },
              { y: len * 0.06, radius: R },
              { y: len * 0.4, radius: R * 0.96 },
              { y: len * 0.62, radius: R * 0.88 },
            ] as Level[],
            7, [0, 0, 0], hsl(0.13, 0.1, 0.86, r),
            { colourTop: hsl(0.28, 0.38, 0.56, r) },
          ))
          for (let i = 0; i < 3; i += 1) {
            const a = (i / 3) * Math.PI * 2 + r() * 1.2
            // Same rule as the cabbage's leaves: origin, rotate, place.
            const blade = taperedBoxGeometry(
              [R * 1.5, R * 0.16],
              [R * 0.5, R * 0.1],
              len * 0.46,
              [0, 0, 0],
              hsl(0.3, 0.44, 0.3, r),
            )
            blade.rotateX(0.2 + r() * 0.35)
            blade.rotateY(a)
            blade.translate(
              Math.sin(a) * R * 0.4,
              len * 0.62 + len * 0.19,
              Math.cos(a) * R * 0.4,
            )
            pieces.push(blade)
          }
          // Root whiskers.
          pieces.push(latheGeometry(
            [
              { y: -len * 0.05, radius: R * 0.06 },
              { y: len * 0.04, radius: R * 0.5 },
            ] as Level[],
            6, [0, 0, 0], hsl(0.11, 0.14, 0.7, r), { capTop: false },
          ))
        } else if (kind === 'tomato') {
          // Squat, flattened top and bottom, with the calyx still on it. The
          // dimple where the stem was is what stops it reading as an apple.
          const R = scale * 0.42
          widest = R
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
          const green = hsl(0.28, 0.5, 0.3, r)
          for (let i = 0; i < 5; i += 1) {
            const a = (i / 5) * Math.PI * 2
            const sepal = taperedBoxGeometry(
              [R * 0.3, R * 0.07],
              [R * 0.1, R * 0.05],
              R * 0.6,
              [0, 0, 0],
              green,
            )
            sepal.rotateZ(1.15)
            sepal.rotateY(a)
            sepal.translate(Math.sin(a) * R * 0.22, R * 1.24, Math.cos(a) * R * 0.22)
            pieces.push(sepal)
          }
        } else if (kind === 'potato') {
          // Lumpy and asymmetric on purpose. A smooth ellipsoid is an egg; a
          // potato is a body of revolution that has been knocked about, so its
          // levels wander instead of describing a curve.
          const R = scale * 0.4
          widest = R * 1.25
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
          // Parsnip and carrot are the same shape at different proportions: a
          // long cone with a broad shoulder. The carrot is ORANGE, which is a
          // seventeenth-century Dutch selection rather than a medieval one,
          // and is also the only carrot anybody recognises.
          const carrot = kind === 'carrot'
          const len = scale * (carrot ? 3.1 : 2.7)
          const R = scale * (carrot ? 0.24 : 0.32)
          widest = R
          const body = carrot ? hsl(0.07, 0.82, 0.47, r) : hsl(0.1, 0.2, 0.78, r)
          pieces.push(latheGeometry(
            [
              { y: 0, radius: R * 0.05 },
              { y: len * 0.3, radius: R * 0.55 },
              { y: len * 0.72, radius: R * 0.9 },
              { y: len * 0.94, radius: R },
              { y: len, radius: R * 0.88 },
            ] as Level[],
            7, [0, 0, 0], body, { colourTop: carrot ? hsl(0.08, 0.7, 0.55, r) : hsl(0.12, 0.18, 0.84, r) },
          ))
          // The cut crown, always paler than the root.
          pieces.push(latheGeometry(
            [
              { y: len * 0.98, radius: R * 0.7 },
              { y: len * 1.1, radius: R * 0.4 },
            ] as Level[],
            6, [0, 0, 0], hsl(0.14, 0.24, 0.62, r), { capBottom: false },
          ))
        }

        const geometry = mergeColoured(pieces)
        if (LIES_DOWN.has(kind)) {
          geometry.rotateZ(Math.PI / 2)
        }
        // EVERY vegetable is turned, not only the ones that lie down.
        //
        // These are faceted bodies of revolution, and two of them built at the
        // same phase have parallel faces all the way round. Left unturned they
        // were fine while the heap was loose and z-fought the moment it was
        // tightened -- worst with the mix set to a single kind, where every
        // neighbour is the same shape as well as the same phase. Nothing in a
        // pile of vegetables shares an orientation anyway.
        geometry.rotateY(r() * Math.PI * 2)

        // The vegetable is set down by MEASURING it, not by working out where
        // its lowest point ought to be.
        //
        // Lifting a lying root by its body radius is right for the root and
        // wrong for everything attached to it: a leek's blades lean away from
        // the axis by four times that radius, and a cabbage's loose leaves hang
        // below its base. Both were left under the ground, and since the floor
        // is the whole model's lowest point, whichever vegetable dug in
        // deepest made every other one look as though it were hovering. Reading
        // the bounding box makes the claim in this file's header -- that every
        // vegetable's lowest point is at the origin -- true by construction
        // rather than by an argument that has to be right about six shapes.
        geometry.computeBoundingBox()
        const low = geometry.boundingBox?.min.y ?? 0
        geometry.translate(0, -low, 0)
        return { geometry, rest: -low }
      }

      // --- The heap -------------------------------------------------------
      const count = Math.max(1, Math.round(config.count))
      const kindCount = Math.min(KINDS.length, Math.max(1, Math.round(config.kinds)))
      const lead = ((Math.round(config.lead) % KINDS.length) + KINDS.length) % KINDS.length

      // The mix starts at `lead` and takes the next `kinds` of them, so the
      // slider reads as "which one, and how mixed" rather than as an opaque
      // index into a list.
      const mix = Array.from({ length: kindCount }, (_, i) => KINDS[(lead + i) % KINDS.length]!)

      const bulbs: BufferGeometry[] = []
      const roots: BufferGeometry[] = []

      for (let i = 0; i < count; i += 1) {
        // The lead kind gets roughly twice the share of the others, which is
        // what "a heap of turnips with some onions in" actually looks like.
        const pick = i % 3 === 0 ? mix[0]! : mix[1 + (i % Math.max(1, kindCount - 1))] ?? mix[0]!
        // A separate stream per item, so adding one vegetable does not reshuffle
        // every vegetable after it.
        const r = createRandom(config.seed * 31 + i * 977)
        const { geometry } = grow(pick, r)

        const angle = i * 2.399963
        const ring = Math.sqrt((i + 0.5) / count)
        const at = S * config.spread * ring
        geometry.translate(
          Math.sin(angle) * at + jitter(r, S * 0.12),
          0,
          Math.cos(angle) * at + jitter(r, S * 0.12),
        )
        ;(LIES_DOWN.has(pick) ? roots : bulbs).push(geometry)
      }

      // `random` is the model's own stream and every vegetable uses its own, so
      // draw from it once to keep the seed meaningful at this level too.
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
