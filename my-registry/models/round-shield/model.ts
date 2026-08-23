/**
 * @medieval-kit/round-shield
 *
 * A planked round shield with a rawhide rim and an iron boss.
 *
 * The kit had no arms or armour at all, which for a medieval catalogue is a
 * whole category missing rather than a gap. This is the cheapest way in: a
 * shield is the one piece of war gear that stands on its own in a scene —
 * leaning on a wall, stacked by a door — without needing a person to hold it.
 *
 * Three things make it a shield rather than a disc, and all three are
 * structural rather than decorative:
 *
 *   - It is BOARDS, not a plate. A round shield is planks butted edge to edge
 *     and held by the rim and the boss; the plank lines are the first thing
 *     the eye finds and a smooth face reads as a lid.
 *   - The rim binds the ENDS of those planks. Without it the boards would
 *     split off one by one at the first blow, and without it in the model the
 *     silhouette is a wafer.
 *   - The boss is a dome over a HOLE. The hand goes behind it, gripping a bar
 *     across the back, so the boss is not ornament — it is the knuckle guard,
 *     and it is why the centre of the face is iron.
 *
 * The face is quartered because that is what a painted shield looks like and
 * because it costs nothing: each plank is built in two halves anyway, so the
 * upper and lower halves simply take different colours. `hue` turns both
 * quarters together and keeps them opposite, so the slider always produces a
 * pair that belongs together.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface RoundShieldConfig {
  /** Radius of the shield (metres). */
  readonly radius: number
  /** Planks across the face. */
  readonly planks: number
  /** Thickness of the boards (metres). */
  readonly thickness: number
  /** How far it leans back from upright (radians). */
  readonly lean: number
  /** Paint colour, 0–1 around the wheel. The second quarter sits opposite. */
  readonly hue: number
  /** Rivets around the boss. */
  readonly rivets: number
  readonly seed: number
}

export const roundShieldDefaults: RoundShieldConfig = {
  radius: 0.36,
  planks: 9,
  thickness: 0.016,
  lean: 0.22,
  hue: 0.02,
  rivets: 10,
  seed: 83,
}

export type RoundShieldParts = 'boards' | 'rim' | 'boss'

export function createModel(overrides: Partial<RoundShieldConfig> = {}) {
  return createKitModel<RoundShieldConfig, 'oak' | 'leather' | 'iron', RoundShieldParts>({
    id: 'round-shield',
    defaults: roundShieldDefaults,
    slots: ['oak', 'leather', 'iron'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const R = config.radius
      const T = config.thickness
      const planks = Math.max(3, Math.round(config.planks))
      const hue = ((config.hue % 1) + 1) % 1

      const paint = (h: number, dark: number): Color =>
        new Color().setHSL(
          (h + jitter(random, 0.01) + 1) % 1,
          0.42 + jitter(random, 0.06),
          dark + jitter(random, 0.04),
        )

      // --- Boards ---------------------------------------------------------
      // Each plank is built in two halves so the face can be quartered without
      // any extra geometry: the split the paint needs is a split the boards
      // already have to make anyway.
      const boards: BufferGeometry[] = []
      const step = (R * 2) / planks
      const upper = paint(hue, 0.34)
      const lower = paint((hue + 0.55) % 1, 0.3)

      for (let i = 0; i < planks; i += 1) {
        const x = -R + step * (i + 0.5)
        // The plank is a chord of the circle, so its length is set by how far
        // out it sits. Squaring off every plank at full width would give a
        // square with a rim drawn on it.
        const halfSpan = Math.sqrt(Math.max(0, R * R - Math.pow(Math.abs(x) + step * 0.5, 2)))
        if (halfSpan <= step * 0.2) continue
        for (const half of [-1, 1]) {
          // The two halves of one plank are quartered on the DIAGONAL: the
          // left-hand planks take one colour above and the other below, and
          // the right-hand ones the reverse. That is what makes a quartered
          // shield read as quartered rather than as banded.
          const left = x < 0
          const colour = (half < 0) === left ? upper : lower
          boards.push(taperedBoxGeometry(
            [step * 0.97, T],
            [step * 0.94, T * 0.92],
            halfSpan,
            [x, half * halfSpan * 0.5, 0],
            new Color(colour),
          ))
        }
      }

      // --- Rim ------------------------------------------------------------
      // A rawhide binding folded over the edge. It is a band whose thickness
      // reaches INSIDE the boards' own radius, so it grips them rather than
      // sitting against their ends.
      const rim = bandGeometry(
        R * 1.02, 0, T * 2.6, R * 0.055, planks * 3,
        tint('leather', -0.04, 0.9), { inner: true },
      )
      rim.rotateX(Math.PI / 2)

      // --- Boss -----------------------------------------------------------
      const bossR = R * 0.26
      const iron: BufferGeometry[] = []
      // The dome. Its back is open, because behind it is the hole the hand
      // goes into, and a cap there would be a face nobody can see.
      iron.push(latheGeometry(
        [
          { y: 0, radius: bossR * 0.98 },
          { y: bossR * 0.42, radius: bossR * 0.86 },
          { y: bossR * 0.78, radius: bossR * 0.54 },
          { y: bossR * 0.94, radius: bossR * 0.16 },
        ] as Level[],
        11, [0, 0, 0], tint('iron', 0.05, 0.7), { capBottom: false },
        // +90, not -90. The dome is turned about Y, and -90 sends its point
        // to -Z -- into the back of the shield, where the only thing visible
        // from the front was the open rim of it. That is why the boss read as a
        // flat black ring.
      ).rotateX(Math.PI / 2).translate(0, 0, T * 0.5))
      // The flange it is riveted through.
      iron.push(bandGeometry(
        bossR * 1.34, 0, T * 1.1, bossR * 0.36, 11,
        tint('iron', -0.02, 0.7), { inner: true },
      ).rotateX(Math.PI / 2).translate(0, 0, T * 0.55))

      const rivets = Math.max(0, Math.round(config.rivets))
      for (let i = 0; i < rivets; i += 1) {
        const a = (i / rivets) * Math.PI * 2 + 0.2
        // Flared outwards, like the barrel's: a stud that tapers away from the
        // surface tilts its side normals back towards it, which the radial
        // check reads as reversed winding, and a hammered rivet flares anyway.
        const stud = prismGeometry(
          R * 0.016, R * 0.022, T * 1.4, 4, [0, 0, 0],
          tint('iron', 0.09, 0.6), { capBottom: false },
        )
        stud.rotateX(-Math.PI / 2)
        iron.push(stud.translate(
          Math.sin(a) * bossR * 1.16,
          Math.cos(a) * bossR * 1.16,
          T * 0.8,
        ))
      }

      // --- Back ------------------------------------------------------------
      // The grip bar across the hole, and two battens holding the planks. Cheap
      // and invisible from the front, but a shield seen from behind with
      // nothing to hold is worse than one with no back at all.
      const back: BufferGeometry[] = []
      back.push(boxGeometry(
        [R * 1.2, R * 0.09, T * 1.6],
        [0, 0, -T * 1.1],
        new Color(tint('oak', -0.1)),
      ))
      for (const at of [-0.46, 0.46]) {
        back.push(boxGeometry(
          [R * 1.5, R * 0.07, T * 1.2],
          [0, at * R, -T * 0.9],
          new Color(tint('oak', -0.14)),
        ))
      }

      const face = mergeColoured([...boards, ...back])
      const boss = mergeColoured(iron)

      // Leaned back from UPRIGHT, not tipped up from flat.
      //
      // Everything is authored in the XY plane facing +Z, which is already a
      // shield standing on its edge. Rotating by -90 degrees and then adding
      // the lean laid it face-up on the floor with a slight tilt, which is a
      // shield somebody dropped. The lean is the whole rotation.
      for (const g of [face, rim, boss]) g.rotateX(config.lean)
      // Set down by measuring, not by trigonometry: the boss stands proud of
      // the face and the rim wraps past it, so which piece is lowest depends on
      // the lean and is not worth deriving.
      const all = mergeColoured([face, rim, boss])
      all.computeBoundingBox()
      const drop = all.boundingBox?.min.y ?? 0
      for (const g of [face, rim, boss]) g.translate(0, -drop, 0)

      return {
        boards: { slot: 'oak' as const, geometry: face },
        rim: { slot: 'leather' as const, geometry: rim },
        boss: { slot: 'iron' as const, geometry: boss },
      }
    },
  }, overrides)
}
