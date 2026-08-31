/**
 * @medieval-kit/iron-cauldron
 *
 * A cauldron slung from a tripod over a ring of hearth stones.
 *
 * The kit had two light sources — a torch and a lantern — and no HEARTH, which
 * is the wrong way round for a medieval catalogue. A cooking fire is where
 * everyone in the scene is facing, and it is the only light in most of them.
 *
 * Three things about the shape are worth stating because they are what make it
 * read as a cauldron rather than as a pot:
 *
 *   - The belly is WIDER than the mouth. A cauldron is bulbous, so that its
 *     contents sit over the fire rather than beside it, and so that the walls
 *     take the heat evenly. Straight-sided, it is a bucket.
 *   - It has three short feet. It spends as much time standing in the ashes as
 *     hanging over them, and a round-bottomed pot cannot stand at all.
 *   - It hangs by a BAIL — a semicircular loop pinned to two lugs — and not by
 *     the rim. The bail is what the chain grips, and it swings, which is how a
 *     cauldron is taken off the fire without touching it.
 *
 * Parts: `hearth` (the stone ring and its bed of embers), `tripod`, and `pot`
 * (the cauldron with its bail and the chain it hangs on). The chain belongs to
 * the pot rather than to the tripod because it moves with what it carries.
 *
 * FOURTH PASS, after a blind critique (68, worst axis material: "clay or wood
 * before iron"). What it found and what was done, so none of it is re-tried:
 *
 *   - The previous pass DESCRIBED a flipped interior lathe but never called
 *     `flipGeometry`: the inner lathe faced outward and rendered as a pale
 *     dome plugging the mouth, which the critic read as a lidless flat disc.
 *     The interior is now genuinely flipped — wall faces inward, the bottom
 *     cap flips to face UP and becomes the dark interior floor, dropped about
 *     a quarter of the pot height below the lip.
 *   - The previous pass also hand-rolled a `soot()` HSL helper on the `char`
 *     entry and kept the body in the matte `char` slot; it came out mid-grey,
 *     LIGHTER than the tripod, and the two darker bands then read as barrel
 *     hoops on a pale stave body. The body now lives in the IRON slot and is
 *     tinted `iron` exactly like the legs and chain, so slot metalness and
 *     palette agree; the two contrasting bands are gone and the one girth
 *     bead at the widest point carries the SAME colour as the body, so it
 *     shows as a shading break, not a stripe.
 *   - The bail ears were horizontal rings floating tangent to the flank (the
 *     "cross-shaped fitting in mid-air"). They are now solid lug blocks sunk
 *     into the outer wall just below the lip at exactly opposite points, and
 *     the bail is a symmetric arc about the pot's axis whose slightly
 *     over-swept ends terminate INSIDE those blocks.
 *   - The straight collar between shoulder and rim is deleted: the profile
 *     now runs lip, immediate bulge, widest just below half height, tuck
 *     under to a small flat base, with the mouth about 0.9 of the belly.
 *   - The stone ring showed daylight: bases hovered (translate was fixed at
 *     0.4·stoneH regardless of each stone's own height) and the taper opened
 *     wedge gaps between neighbours. Each stone is now buried by its own
 *     height, cut longer at the base so neighbours interpenetrate, and the
 *     ash bed extends UNDER the ring so any remaining gap shows ash, not
 *     background. The coals ride proud of the ash plane instead of level
 *     with it, which is what had them clipping against its silhouette.
 */
import { type BufferGeometry } from 'three'

import {
  arcBarGeometry,
  bandGeometry,
  createKitModel,
  createTinter,
  flipGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface IronCauldronConfig {
  /** Height from the ground to the tripod's apex (metres). */
  readonly height: number
  /** Outer radius of the ring of hearth stones (metres). */
  readonly hearthRadius: number
  /** Stones in the ring. */
  readonly stones: number
  /** Radius of the cauldron at its belly (metres). */
  readonly potRadius: number
  /** Links in the chain. */
  readonly links: number
  /** Whether the fire is lit (0/1). */
  readonly lit: number
  readonly seed: number
}

export const ironCauldronDefaults: IronCauldronConfig = {
  height: 1.28,
  hearthRadius: 0.46,
  stones: 12,
  potRadius: 0.22,
  links: 4,
  lit: 1,
  seed: 29,
}

export type IronCauldronParts = 'hearth' | 'tripod' | 'pot'

export interface IronCauldronActions {
  /** Lights or puts out the fire. When out, the embers are hidden. */
  setLit(on: boolean): void
  isLit(): boolean
}

export function createModel(overrides: Partial<IronCauldronConfig> = {}) {
  let lit = true

  return createKitModel<IronCauldronConfig, 'stone' | 'iron' | 'char' | 'ember', IronCauldronParts, IronCauldronActions>({
    id: 'iron-cauldron',
    defaults: ironCauldronDefaults,
    slots: ['stone', 'iron', 'char', 'ember'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = config.height
      const floor = -H / 2
      const hearthR = config.hearthRadius

      // --- Hearth -------------------------------------------------------------
      const stones: BufferGeometry[] = []
      const count = Math.max(5, Math.round(config.stones))
      const stoneH = hearthR * 0.32
      const ringR = hearthR - stoneH * 0.5

      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + jitter(random, 0.05)
        const arc = (Math.PI * 2 * ringR) / count
        // Cut LONG at the base, like the well's kerb: a flat-faced block on a
        // curve cannot close its joint otherwise, and the taper towards the
        // top otherwise opens wedge gaps between neighbours that drop straight
        // through to the background.
        const h = stoneH * (0.92 + jitter(random, 0.12))
        const stone = taperedBoxGeometry(
          [arc * (1.18 + jitter(random, 0.08)), stoneH * (1.05 + jitter(random, 0.1))],
          [arc * (0.86 + jitter(random, 0.1)), stoneH * (0.74 + jitter(random, 0.12))],
          h,
          [0, 0, 0],
          tint('stone', jitter(random, 0.1)),
        )
        stone.rotateY(a)
        // Buried by each stone's OWN height. The old translate was a fixed
        // fraction of the nominal height, so short stones hovered and the
        // roughening pass then lifted some bottoms clean off the ground —
        // the black bars the critique saw under the front of the ring.
        stone.translate(
          Math.sin(a) * ringR,
          floor + h * 0.5 - stoneH * 0.08,
          Math.cos(a) * ringR,
        )
        stones.push(stone)
      }
      const hearth = mergeColoured(stones)
      roughenGeometry(hearth, stoneH * 0.08, { salt: 19 })

      // Ash bed. It runs UNDER the stone ring, not up to its inner face, so a
      // gap between two stones shows ash behind it rather than background.
      const ashTop = floor + hearthR * 0.055
      const ash = latheGeometry(
        [
          { y: floor + hearthR * 0.005, radius: ringR + stoneH * 0.25 },
          { y: ashTop, radius: ringR - stoneH * 0.05 },
        ] as Level[],
        11, [0, 0, 0], tint('char', 0.04),
      )

      // The embers sit PROUD of the ash plane — base buried, top clear of it —
      // rather than level with it, which is what had them clipping against
      // the ash disc's silhouette. Separate from the ash so the fire can be
      // put out without the ashes going with it.
      const emberPieces: BufferGeometry[] = []
      const emberR = ringR - stoneH * 0.7
      const emberCount = Math.max(4, Math.round(count * 0.7))
      for (let i = 0; i < emberCount; i += 1) {
        const a = i * 2.399963
        const r = emberR * 0.8 * Math.sqrt((i + 0.4) / emberCount)
        const size = hearthR * (0.05 + random() * 0.045)
        const coalH = size * 0.6
        const coal = prismGeometry(
          size, size * 0.7, coalH, 5, [0, 0, 0],
          tint(i % 3 === 0 ? 'emberTip' : 'ember', jitter(random, 0.05), 0.4),
        )
        coal.rotateY(random() * Math.PI * 2)
        coal.translate(
          Math.sin(a) * r,
          ashTop + coalH * 0.2,
          Math.cos(a) * r,
        )
        emberPieces.push(coal)
      }

      // --- Tripod -------------------------------------------------------------
      const apexY = floor + H
      const iron: BufferGeometry[] = []
      const legFoot = hearthR * 1.34
      const legRise = apexY - floor
      const legLength = Math.hypot(legFoot, legRise)
      const barT = hearthR * 0.045

      for (let i = 0; i < 3; i += 1) {
        // Three legs, not four. A tripod cannot rock: whatever the ground does,
        // three feet are always on it, which is why every cooking fire in
        // Europe stood on one.
        const a = (i / 3) * Math.PI * 2 + 0.4
        const leg = taperedBoxGeometry(
          [barT * 1.15, barT * 1.15],
          [barT * 0.8, barT * 0.8],
          legLength * 1.02,
          [0, 0, 0],
          tint('iron', -0.02 + jitter(random, 0.04), 0.7),
        )
        // NEGATIVE. `rotateX(+t)` carries the bar's TOP towards +Z, and the
        // translate that follows also moves it +Z, so the two add: the head
        // ends up at the full outboard radius and the foot at the axis. The
        // brace stands on its head, splayed at the top and gathered at the
        // bottom, which is the opposite of what carries a load. The bounding
        // box is identical either way, which is why it survives inspection.
        leg.rotateX(-Math.atan2(legFoot, legRise))
        leg.rotateY(a)
        leg.translate(
          Math.sin(a) * legFoot * 0.5,
          (floor + apexY) / 2,
          Math.cos(a) * legFoot * 0.5,
        )
        iron.push(leg)
      }
      // Apex ring: what gathers the three heads and carries the chain.
      iron.push(bandGeometry(
        barT * 2.3, apexY - barT * 0.9, barT * 1.8, barT * 0.7, 8,
        tint('iron', 0.05, 0.7), { inner: true },
      ))

      // --- Pot ----------------------------------------------------------------
      // Authored hanging from the APEX, which is where the part's origin goes,
      // so the whole assembly can be raised and lowered on its chain later
      // without any of it being rebuilt.
      const R = config.potRadius
      // Low over the fire, which is the only place a cooking pot is any use.
      // At 0.36 of the tripod's height the cauldron hung half a metre clear of
      // the embers -- close enough to look like a cauldron and far enough to
      // cook nothing.
      const potHang = -H * 0.62
      const potChar: BufferGeometry[] = []
      const potIron: BufferGeometry[] = []

      // Chain, from the apex ring down to the bail.
      const linkCount = Math.max(2, Math.round(config.links))
      const chainDrop = -potHang - R * 1.5
      // The link radius comes from the SPACING the links are actually laid out
      // at, which is over (count - 1) gaps, not over count. Dividing by the
      // count made each link a little smaller than half its own gap, so the
      // chain came apart the moment the drop grew -- the same arithmetic slip
      // the tavern sign's chain had, and the support check caught this one for
      // the same reason it caught that one.
      const linkGap = (chainDrop - barT * 1.2) / Math.max(1, linkCount - 1)
      const linkR = Math.max(barT * 0.9, linkGap * 0.62)
      for (let i = 0; i < linkCount; i += 1) {
        const y = -barT * 1.2 - linkGap * i
        const ring = bandGeometry(
          linkR, 0, barT * 0.7, barT * 0.42, 6,
          tint('iron', jitter(random, 0.05), 0.7), { inner: true },
        )
        // Successive links pass through each other at right angles.
        ring.rotateY(i * 0.41)
        ring.rotateX(i % 2 === 0 ? Math.PI / 2 : 0)
        ring.rotateZ(i % 2 === 0 ? 0 : Math.PI / 2)
        ring.translate(0, y, 0)
        potIron.push(ring)
      }

      // The cauldron itself: lip, immediate bulge, widest just below half
      // height, tuck under to a small flat base. No straight collar — the
      // collar is what made the profile read as a barrel. One colour for the
      // whole vessel, taken off the SAME palette entry as the tripod and the
      // chain, because the critique's whole material complaint reduces to the
      // pot not being the colour of its own hardware.
      const belly = potHang
      const cast = tint('iron', -0.02, 0.35)
      const profile: Level[] = [
        { y: belly - R * 0.78, radius: R * 0.36 },
        { y: belly - R * 0.62, radius: R * 0.66 },
        { y: belly - R * 0.38, radius: R * 0.9 },
        { y: belly - R * 0.12, radius: R },
        { y: belly + R * 0.14, radius: R * 0.965 },
        { y: belly + R * 0.42, radius: R * 0.9 },
      ]
      potIron.push(latheGeometry(profile, 11, [0, 0, 0], cast, {
        colourTop: tint('iron', 0.02, 0.35),
        capTop: false,
      }))
      // The interior, FLIPPED: the wall faces inward and the bottom cap flips
      // to face up, so from above the mouth is an open cavity with a dark
      // floor about a quarter of the pot height below the lip — not a plug.
      // It stays in the matte char slot (soot does not gleam), but its colour
      // comes off the iron entry: the char entry is warm, and a warm interior
      // read as clay or as contents rather than as an empty black pot.
      potChar.push(flipGeometry(latheGeometry(
        [
          { y: belly + R * 0.13, radius: R * 0.7 },
          { y: belly + R * 0.46, radius: R * 0.82 },
        ] as Level[],
        11, [0, 0, 0], tint('iron', -0.05, 0.3), { capTop: false },
      )))
      // The rim: an outer ring that closes the annulus between the outer wall
      // and the interior wall — both wall tops end inside it. Same colour as
      // the body, so it reads as a cast lip, not a stripe.
      potIron.push(bandGeometry(
        R * 0.95, belly + R * 0.44, R * 0.09, R * 0.16, 11,
        cast, { inner: true },
      ))
      // One girth bead at the widest point, in the body's own colour: a
      // shading break, the way the reference shows it. The two contrasting
      // dark hoops of the last pass are gone — they were the barrel.
      potIron.push(bandGeometry(
        R * 1.04, belly - R * 0.12, R * 0.07, R * 0.06, 11,
        cast,
      ))

      // Three feet. Short, splayed, and the reason it can stand in the ashes.
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 + 0.9
        const foot = taperedBoxGeometry(
          [R * 0.15, R * 0.15],
          [R * 0.1, R * 0.1],
          R * 0.4,
          [0, 0, 0],
          tint('iron', -0.05, 0.6),
        )
        foot.rotateX(0.2)
        foot.rotateY(a)
        foot.translate(
          Math.sin(a) * R * 0.5,
          belly - R * 0.83,
          Math.cos(a) * R * 0.5,
        )
        potIron.push(foot)
      }

      // Bail: one symmetric arc about the pot's axis, hung between two solid
      // lug blocks sunk into the outer wall at opposite points just below the
      // lip. The arc is swept a little past the half circle so both end caps
      // terminate INSIDE the lugs; nothing rests on the rim's top plane and
      // nothing floats beside the belly.
      const lugY = belly + R * 0.29
      for (const side of [-1, 1]) {
        potIron.push(taperedBoxGeometry(
          [R * 0.14, R * 0.13],
          [R * 0.11, R * 0.1],
          R * 0.24,
          [side * R * 0.99, lugY, 0],
          tint('iron', 0.02, 0.5),
        ))
      }
      potIron.push(arcBarGeometry(
        R * 0.95, barT * 0.75, -0.08, Math.PI + 0.08, 9,
        [0, lugY, 0],
        tint('iron', 0.06, 0.7),
      ))

      return {
        hearth: {
          slot: 'stone' as const,
          geometry: hearth,
          extras: [
            { slot: 'char' as const, geometry: ash },
            { slot: 'ember' as const, geometry: mergeColoured(emberPieces) },
          ],
        },
        tripod: { slot: 'iron' as const, geometry: mergeColoured(iron) },
        pot: {
          slot: 'iron' as const,
          geometry: mergeColoured(potIron),
          extras: [{ slot: 'char' as const, geometry: mergeColoured(potChar) }],
          origin: [0, apexY, 0] as const,
        },
      }
    },

    actions: ({ parts, getConfig }) => {
      lit = getConfig().lit >= 0.5
      // The embers are the SECOND body of the hearth part. Hiding the part
      // itself would take the stones with it.
      const embers = parts.hearth.anchor.children[2]
      if (embers) embers.visible = lit
      return {
        setLit: (on) => {
          lit = on
          const body = parts.hearth.anchor.children[2]
          if (body) body.visible = on
        },
        isLit: () => lit,
      }
    },
  }, overrides)
}
