/**
 * @medieval-kit/forge-hearth
 *
 * A smith's forge: a raised stone hearth with a chimney back and a bellows
 * beside it.
 *
 * The kit has had an anvil since early on and nothing to heat anything in. An
 * anvil alone is a lump of iron; what makes a corner a smithy is the fire, and
 * what makes the fire a forge rather than a hearth is the bellows blowing
 * through the side of it.
 *
 * The parts follow the way it is used:
 *
 *   - `hearth`  — the stone block, waist high, with a kerb round its top. The
 *                 height is the whole point: a smith works standing, and a fire
 *                 on the floor is a cooking fire.
 *   - `fire`    — charcoal and embers in the bed. `setLit` puts it out without
 *                 taking the charcoal with it, the same split the cauldron uses.
 *   - `chimney` — the tapering stack over the back. It draws the smoke off the
 *                 work, which is the only reason a smith can stand at the fire
 *                 at all.
 *   - `bellows` — two boards with leather between them, a nozzle into the side
 *                 of the hearth, and a lever above to work it by.
 *
 * The masonry is a compromise the well taught. Laying every course as separate
 * blocks reads far better than a smooth box, and it also costs 12 triangles a
 * block — at four faces and four courses that is most of the budget. So the
 * blocks go where they are read, which is the kerb around the fire and the top
 * course of the walls, and the body below is a roughened slab.
 */
import { type BufferGeometry } from 'three'

import {
  createKitModel,
  dishedSheetGeometry,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  taperedBoxGeometry,
  type Level,
  type SheetLevel,
} from '../core/index.ts'

export interface ForgeHearthConfig {
  /** Length of the hearth block along the smith's side (metres). */
  readonly length: number
  /** Depth of the hearth block (metres). */
  readonly depth: number
  /** Height of the block to the top of its kerb (metres). */
  readonly height: number
  /** Height of the chimney above the hearth's top (metres). */
  readonly chimney: number
  /** Blocks around the kerb of the fire. */
  readonly kerbBlocks: number
  /** Whether the fire is lit (0/1). */
  readonly lit: number
  readonly seed: number
}

export const forgeHearthDefaults: ForgeHearthConfig = {
  length: 1.15,
  depth: 0.82,
  height: 0.78,
  chimney: 1.1,
  kerbBlocks: 16,
  lit: 1,
  seed: 37,
}

export type ForgeHearthParts = 'hearth' | 'fire' | 'chimney' | 'bellows'

export interface ForgeHearthActions {
  setLit(on: boolean): void
  isLit(): boolean
}

export function createModel(overrides: Partial<ForgeHearthConfig> = {}) {
  let lit = true

  return createKitModel<ForgeHearthConfig, 'stone' | 'char' | 'ember' | 'oak' | 'leather' | 'iron', ForgeHearthParts, ForgeHearthActions>({
    id: 'forge-hearth',
    defaults: forgeHearthDefaults,
    slots: ['stone', 'char', 'ember', 'oak', 'leather', 'iron'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = config.length
      const D = config.depth
      const H = config.height
      // The forge stands on the ground rather than about its own centre: it has
      // one face that matters and that face is the top, so measuring from the
      // floor is what keeps the working height honest.
      const floor = 0
      const wall = Math.min(L, D) * 0.17
      const kerbH = H * 0.14
      const bodyTop = H - kerbH

      // --- Hearth block --------------------------------------------------
      const masonry: BufferGeometry[] = []
      // Four wall slabs rather than four walls of blocks. The saving is what
      // pays for the kerb, which is the course anyone actually looks at.
      for (const [dx, dz, sx, sz] of [
        [0, -(D - wall) / 2, L, wall],
        [0, (D - wall) / 2, L, wall],
        [-(L - wall) / 2, 0, wall, D - wall * 2],
        [(L - wall) / 2, 0, wall, D - wall * 2],
      ] as const) {
        masonry.push(taperedBoxGeometry(
          [sx, sz],
          [sx * 0.99, sz * 0.99],
          bodyTop,
          [dx, floor + bodyTop / 2, dz],
          tint('stone', jitter(random, 0.07)),
        ))
      }
      // The floor of the fire bed, so the hearth is not open to the ground.
      masonry.push(taperedBoxGeometry(
        [L - wall * 1.6, D - wall * 1.6],
        [L - wall * 1.8, D - wall * 1.8],
        wall * 0.7,
        [0, floor + bodyTop - wall * 0.3, 0],
        tint('stone', -0.05),
      ))

      // Kerb: individual blocks all the way round the top, staggered where the
      // corners meet so the ring does not read as four sticks.
      const kerbCount = Math.max(8, Math.round(config.kerbBlocks))
      const halfL = L / 2 - wall / 2
      const halfD = D / 2 - wall / 2
      const perimeter = (halfL + halfD) * 4
      for (let i = 0; i < kerbCount; i += 1) {
        const t = ((i + 0.5) / kerbCount) * perimeter
        // Walk the rectangle rather than a circle: a forge is square and the
        // blocks have to turn its corners.
        let x = 0
        let z = 0
        let along: 'x' | 'z' = 'x'
        let s = t
        if (s < halfL * 2) { x = -halfL + s; z = -halfD; along = 'x' }
        else if ((s -= halfL * 2) < halfD * 2) { x = halfL; z = -halfD + s; along = 'z' }
        else if ((s -= halfD * 2) < halfL * 2) { x = halfL - s; z = halfD; along = 'x' }
        else { s -= halfL * 2; x = -halfL; z = halfD - s; along = 'z' }
        const run = perimeter / kerbCount
        const size: [number, number] = along === 'x'
          ? [run * (1.05 + jitter(random, 0.06)), wall * (1.02 + jitter(random, 0.05))]
          : [wall * (1.02 + jitter(random, 0.05)), run * (1.05 + jitter(random, 0.06))]
        masonry.push(taperedBoxGeometry(
          size,
          [size[0] * 0.94, size[1] * 0.94],
          kerbH * (1.04 + jitter(random, 0.05)),
          [x, floor + bodyTop + kerbH * 0.46, z],
          tint('stone', 0.03 + jitter(random, 0.08)),
        ))
      }
      // String courses: thin bands standing proud of each wall.
      //
      // The walls are slabs, which is what pays for the kerb, and a slab of one
      // colour is a slab however much it is mottled -- the body of the forge
      // came out as a smooth grey box under a course of real stones. Three
      // ribs to a face, twelve boxes in all, is enough to say COURSED without
      // laying two hundred blocks. They stand proud rather than sitting flush,
      // because a dry wall's stones never line up on one plane and a rib that
      // is level with its wall is invisible.
      for (const at of [0.22, 0.5, 0.78]) {
        for (const [dx, dz, sx, sz] of [
          [0, -(D + wall * 0.12) / 2, L * 0.99, wall * 0.12],
          [0, (D + wall * 0.12) / 2, L * 0.99, wall * 0.12],
          [-(L + wall * 0.12) / 2, 0, wall * 0.12, D * 0.99],
          [(L + wall * 0.12) / 2, 0, wall * 0.12, D * 0.99],
        ] as const) {
          masonry.push(taperedBoxGeometry(
            [sx, sz],
            [sx * 0.99, sz * 0.9],
            bodyTop * 0.055,
            [dx, floor + bodyTop * at, dz],
            tint('stone', -0.07 + jitter(random, 0.05)),
          ))
        }
      }

      const hearth = mergeColoured(masonry)
      roughenGeometry(hearth, wall * 0.05, { salt: 23 })

      // --- Fire ------------------------------------------------------------
      // The bed is LUMPS, not a plate.
      //
      // A smooth disc of charcoal colour is the darkest value in the palette
      // spread flat, and it reads as a hole cut in the hearth with a few sparks
      // in it. A fire bed is broken: irregular lumps of charcoal with the glow
      // coming up BETWEEN them, and the only way to get that from vertex colour
      // is to build the lumps. They are cheap -- five-sided prisms, eight
      // triangles each -- and they are the whole difference between a forge and
      // a stone box with a black lid.
      const bedX = L * 0.5 - wall * 1.1
      const bedZ = D * 0.5 - wall * 1.1
      const bedY = floor + bodyTop
      const coals: BufferGeometry[] = []
      const embers: BufferGeometry[] = []
      const lumps = 26

      for (let i = 0; i < lumps; i += 1) {
        // Golden-angle spiral over an ellipse, so the bed fills evenly rather
        // than ringing.
        const a = i * 2.399963
        const ring = Math.sqrt((i + 0.35) / lumps)
        const size = Math.min(bedX, bedZ) * (0.16 + random() * 0.13)
        // The middle of a working fire is where the air arrives, so that is
        // where it glows; the edges are burnt out.
        const hot = ring < 0.52 && i % 2 === 0
        const lump = prismGeometry(
          size, size * 0.5, size * 0.8, 5, [0, 0, 0],
          hot
            ? tint(i % 3 === 0 ? 'emberTip' : 'ember', jitter(random, 0.05), 0.4)
            : tint('char', 0.05 + jitter(random, 0.08)),
          { capBottom: false },
        )
        lump.rotateX(jitter(random, 0.5))
        lump.rotateZ(jitter(random, 0.5))
        lump.rotateY(random() * Math.PI * 2)
        lump.translate(
          Math.sin(a) * bedX * 0.78 * ring,
          bedY + kerbH * (hot ? 0.34 : 0.26),
          Math.cos(a) * bedZ * 0.78 * ring,
        )
        ;(hot ? embers : coals).push(lump)
      }

      // A dark floor under the lumps so the bed is not see-through where they
      // do not quite meet.
      coals.push(taperedBoxGeometry(
        [bedX * 1.9, bedZ * 1.9],
        [bedX * 1.8, bedZ * 1.8],
        kerbH * 0.4,
        [0, bedY + kerbH * 0.16, 0],
        tint('char', 0.02),
      ))
      const coal = mergeColoured(coals)

      // --- Chimney ----------------------------------------------------------
      // Rises from the BACK of the hearth and tapers. Its foot reaches down
      // inside the kerb rather than standing on it, so the joint is an overlap.
      // A stack, not a post. At 1.5 wall thicknesses deep it was a slab seen
      // edge-on from most angles; a forge chimney is a chest of masonry that
      // gathers the whole back of the hearth.
      const stackW = L * 0.66
      const stackD = D * 0.42
      const stack = taperedBoxGeometry(
        [stackW, stackD],
        [stackW * 0.55, stackD * 0.62],
        config.chimney,
        [0, floor + bodyTop + config.chimney / 2 - kerbH * 0.3, -(D / 2 - stackD * 0.46)],
        tint('stone', -0.03),
      )
      roughenGeometry(stack, wall * 0.05, { salt: 29 })
      const cap = taperedBoxGeometry(
        [stackW * 0.68, stackD * 0.72],
        [stackW * 0.66, stackD * 0.7],
        wall * 0.5,
        [0, floor + bodyTop + config.chimney - kerbH * 0.3, -(D / 2 - stackD * 0.46)],
        tint('stone', 0.06),
      )

      // --- Bellows ----------------------------------------------------------
      // On the +X side, blowing in through the wall. Two boards with the
      // leather between them, a nozzle, a post and the lever that works it.
      const bx = L / 2
      const bellowsL = D * 0.86
      const bellowsW = D * 0.55
      const bellowsY = floor + bodyTop - H * 0.14
      const timber: BufferGeometry[] = []
      const hide: BufferGeometry[] = []
      const metal: BufferGeometry[] = []

      // The boards and the leather are SHAPED PLATES, laid flat.
      //
      // They were built as tapered boxes and turned into place with two
      // rotations, and the pair of them put the thickness along Z and the
      // length along Y -- the boards ended up standing on edge, both in nearly
      // the same plane, with every face coplanar with its neighbour. The
      // z-fight check found them immediately and kept finding them while I
      // rearranged the leather, because the leather was never what was wrong.
      //
      // `dishedSheetGeometry` is the right tool and its own docstring says so:
      // a plate whose width varies along its length, which is what a bellows
      // board is. It builds in the XY plane with its thickness along Z, so one
      // tilt lays it flat and one turn points it out from the hearth.
      const lay = (g: BufferGeometry): BufferGeometry => {
        g.rotateX(-Math.PI / 2)
        g.rotateY(-Math.PI / 2)
        return g
      }
      // `w` scales the LENGTH as well as the width, and it has to.
      //
      // Sized only across, every plate -- both boards, the gusset and both ribs
      // -- ran to exactly the same back edge, and five end caps in one plane is
      // five coplanar faces. Scaling both ways staggers those edges and is also
      // the truer shape: a rib that swells wider swells longer with it.
      const teardrop = (w: number, t: number): SheetLevel[] => [
        { y: 0, halfWidth: bellowsW * 0.15 * w, thickness: t, curve: 0 },
        { y: bellowsL * 0.28 * w, halfWidth: bellowsW * 0.4 * w, thickness: t, curve: 0 },
        { y: bellowsL * 0.72 * w, halfWidth: bellowsW * 0.5 * w, thickness: t * 0.95, curve: 0 },
        { y: bellowsL * w, halfWidth: bellowsW * 0.38 * w, thickness: t * 0.9, curve: 0 },
      ]

      for (const [board, at] of [[0, -1], [1, 1]] as const) {
        timber.push(lay(dishedSheetGeometry(
          teardrop(board === 0 ? 1 : 0.97, D * 0.035), 5,
          tint('oak', (board === 0 ? 0.03 : -0.04) + jitter(random, 0.04)),
        // The nose is staggered as well as the tail. Scaling the plates only
        // spread their BACK edges; they all still began at y = 0, so after
        // being laid down every one of them started at the same x and the five
        // nose caps were coplanar in their turn. A few millimetres apart is
        // invisible and is the difference between five faces in a plane and
        // none.
        )).translate(bx + board * D * 0.014, bellowsY + at * D * 0.11, 0))
      }

      // One gusset of leather spanning board to board, and two ribs on it at
      // different sizes so no two of their faces can line up.
      // The leather BULGES past the boards. Cut narrower than them it sat
      // hidden in the gap and the bellows read as a stack of loose planks with
      // daylight between; a bellows is a bag under pressure and its widest
      // point is the leather, not the wood.
      hide.push(lay(dishedSheetGeometry(
        teardrop(1.18, D * 0.235), 5, tint('leather', -0.06, 0.9),
      )).translate(bx + D * 0.032, bellowsY, 0))
      for (const [i, at] of [-0.34, 0.34].entries()) {
        hide.push(lay(dishedSheetGeometry(
          teardrop(1.26 + i * 0.07, D * 0.03), 5,
          tint('leather', -0.01 + i * 0.04, 0.9),
        )).translate(bx + D * (0.022 + i * 0.019), bellowsY + at * D * 0.11, 0))
      }

      // Nozzle, through the hearth wall.
      metal.push(latheGeometry(
        [
          { y: -bellowsL * 0.16, radius: D * 0.055 },
          { y: bellowsL * 0.06, radius: D * 0.038 },
          { y: bellowsL * 0.2, radius: D * 0.028 },
        ] as Level[],
        8, [0, 0, 0], tint('iron', 0.02, 0.7),
      ).rotateZ(Math.PI / 2).translate(bx - wall * 0.4, bellowsY, 0))

      // Post and lever.
      const postX = bx + bellowsL * 0.16
      const postTop = floor + bodyTop + H * 0.42
      timber.push(taperedBoxGeometry(
        [D * 0.07, D * 0.07],
        [D * 0.06, D * 0.06],
        postTop - floor,
        [postX, (floor + postTop) / 2, 0],
        tint('oak', -0.06),
      ))
      // The lever, laid along X with ONE rotation.
      //
      // Chaining rotateZ and rotateY to get it there put its length along Z --
      // running across the bellows instead of over it, reaching the post at
      // neither end, which the support check reported as a floating bar. This
      // is the third time in this one model that a two-rotation chain has put
      // a piece on the wrong axis, so it is built the plain way: the helper
      // gives a bar along Y, and a single turn about Z lays it along X with
      // its tilt folded into the same angle.
      const leverLength = bellowsL * 1.02
      const leverTilt = 0.26
      const lever = taperedBoxGeometry(
        [D * 0.055, D * 0.05],
        [D * 0.045, D * 0.045],
        leverLength,
        [0, 0, 0],
        tint('oak', 0.05),
      )
      lever.rotateZ(Math.PI / 2 + leverTilt)
      // Pivots ON the post and reaches back over the bellows' broad end.
      lever.translate(
        postX + Math.cos(leverTilt) * leverLength * 0.46,
        postTop - D * 0.06 - Math.sin(leverTilt) * leverLength * 0.46,
        0,
      )
      timber.push(lever)

      return {
        hearth: { slot: 'stone' as const, geometry: hearth },
        fire: {
          slot: 'char' as const,
          geometry: coal,
          extras: [{ slot: 'ember' as const, geometry: mergeColoured(embers) }],
        },
        chimney: { slot: 'stone' as const, geometry: mergeColoured([stack, cap]) },
        bellows: {
          slot: 'oak' as const,
          geometry: mergeColoured(timber),
          extras: [
            { slot: 'leather' as const, geometry: mergeColoured(hide) },
            { slot: 'iron' as const, geometry: mergeColoured(metal) },
          ],
        },
      }
    },

    actions: ({ parts, getConfig }) => {
      lit = getConfig().lit >= 0.5
      // The embers are the fire part's SECOND body; hiding the part itself
      // would take the charcoal with it and leave an empty stone box.
      const glow = parts.fire.anchor.children[1]
      if (glow) glow.visible = lit
      return {
        setLit: (on) => {
          lit = on
          const body = parts.fire.anchor.children[1]
          if (body) body.visible = on
        },
        isLit: () => lit,
      }
    },
  }, overrides)
}
