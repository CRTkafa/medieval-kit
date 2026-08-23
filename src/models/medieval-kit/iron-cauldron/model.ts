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
 */
import { type BufferGeometry } from 'three'

import {
  arcBarGeometry,
  bandGeometry,
  createKitModel,
  createTinter,
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
        // Cut long, like the well's kerb: a flat-faced block on a curve cannot
        // close its joint otherwise, and a fire ring with daylight through it
        // is not a fire ring.
        const stone = taperedBoxGeometry(
          [arc * (1.06 + jitter(random, 0.08)), stoneH * (1 + jitter(random, 0.1))],
          [arc * (0.78 + jitter(random, 0.1)), stoneH * (0.72 + jitter(random, 0.12))],
          stoneH * (0.86 + jitter(random, 0.14)),
          [0, 0, 0],
          tint('stone', jitter(random, 0.1)),
        )
        stone.rotateY(a)
        stone.translate(
          Math.sin(a) * ringR,
          floor + stoneH * 0.4,
          Math.cos(a) * ringR,
        )
        stones.push(stone)
      }
      const hearth = mergeColoured(stones)
      roughenGeometry(hearth, stoneH * 0.08, { salt: 19 })

      // Ash bed inside the ring, and the embers on it. The bed is char and the
      // embers sit slightly proud of it; separating them is what lets the fire
      // be put out without the ashes going with it.
      const ashR = ringR - stoneH * 0.42
      const ash = latheGeometry(
        [
          { y: floor + hearthR * 0.005, radius: ashR },
          { y: floor + hearthR * 0.055, radius: ashR * 0.9 },
        ] as Level[],
        11, [0, 0, 0], tint('char', 0.04),
      )

      const emberPieces: BufferGeometry[] = []
      const emberCount = Math.max(4, Math.round(count * 0.7))
      for (let i = 0; i < emberCount; i += 1) {
        const a = i * 2.399963
        const r = ashR * 0.72 * Math.sqrt((i + 0.4) / emberCount)
        const size = hearthR * (0.05 + random() * 0.045)
        const coal = prismGeometry(
          size, size * 0.6, size * 0.7, 5, [0, 0, 0],
          tint(i % 3 === 0 ? 'emberTip' : 'ember', jitter(random, 0.05), 0.4),
        )
        coal.rotateY(random() * Math.PI * 2)
        coal.translate(
          Math.sin(a) * r,
          floor + hearthR * 0.06,
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
      const pot: BufferGeometry[] = []
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

      // The cauldron itself. The widest point is BELOW the mouth.
      const belly = potHang
      const profile: Level[] = [
        { y: belly - R * 0.82, radius: R * 0.34 },
        { y: belly - R * 0.62, radius: R * 0.66 },
        { y: belly - R * 0.2, radius: R * 0.97 },
        { y: belly + R * 0.1, radius: R },
        { y: belly + R * 0.5, radius: R * 0.86 },
        { y: belly + R * 0.72, radius: R * 0.82 },
      ]
      pot.push(latheGeometry(profile, 11, [0, 0, 0], tint('char', 0.05, 0.5), {
        colourTop: tint('char', 0.11, 0.5),
        capTop: false,
      }))
      // The inside, so the mouth is not a hole through to nothing.
      pot.push(latheGeometry(
        [
          { y: belly - R * 0.55, radius: R * 0.6 },
          { y: belly + R * 0.72, radius: R * 0.76 },
        ] as Level[],
        11, [0, 0, 0], tint('char', -0.06, 0.4), { capTop: false },
      ))
      // Rim, and the girth band round the belly: cast ridges, and the two lines
      // that stop the body reading as a smooth blob.
      potIron.push(bandGeometry(
        R * 0.86, belly + R * 0.7, R * 0.1, R * 0.06, 11,
        tint('iron', -0.04, 0.6),
      ))
      potIron.push(bandGeometry(
        R * 1.02, belly + R * 0.06, R * 0.07, R * 0.05, 11,
        tint('iron', -0.08, 0.6),
      ))

      // Three feet. Short, splayed, and the reason it can stand in the ashes.
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 + 0.9
        const foot = taperedBoxGeometry(
          [R * 0.14, R * 0.14],
          [R * 0.1, R * 0.1],
          R * 0.38,
          [0, 0, 0],
          tint('iron', -0.05, 0.6),
        )
        foot.rotateX(0.22)
        foot.rotateY(a)
        foot.translate(
          Math.sin(a) * R * 0.52,
          belly - R * 0.86,
          Math.cos(a) * R * 0.52,
        )
        potIron.push(foot)
      }

      // Bail: a real arc, pinned to two lugs. `arcBarGeometry` sweeps from 0 to
      // PI in the XY plane, which is already the shape of a handle standing
      // over the pot, so no rotation is involved.
      const bailR = R * 0.92
      potIron.push(arcBarGeometry(
        bailR, barT * 0.75, -0.22, Math.PI + 0.22, 9,
        [0, belly + R * 0.42, 0],
        tint('iron', 0.06, 0.7),
      ))
      for (const side of [-1, 1]) {
        potIron.push(bandGeometry(
          R * 0.13, belly + R * 0.5, R * 0.13, R * 0.06, 6,
          tint('iron', 0.02, 0.6), { inner: true },
        ).translate(side * bailR * 0.94, 0, 0))
      }

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
          slot: 'char' as const,
          geometry: mergeColoured(pot),
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(potIron) }],
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
