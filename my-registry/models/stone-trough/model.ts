/**
 * @medieval-kit/stone-trough
 *
 * A watering trough cut from one block of limestone.
 *
 * The kit could water nobody. It has a well, a bucket and a cauldron, and all
 * three are things you carry water IN; a trough is the thing a village keeps
 * water in, standing in the street outside the smithy where the horses are.
 *
 * It is not the same ROCK as the well. `stone` in this palette was measured
 * off dressed and rubble masonry and is grey, because a wall is quarried and
 * laid face out. One block left in the open for a century reads hue 36 and
 * saturation 0.16 against the wall's 44 and 0.05 — warmer, three times more
 * saturated, lighter. Hence `limestone`, and the rendered block now matches
 * the reference to within a fifth of a degree of hue and 0.004 of lightness.
 *
 * What took three attempts was making it read as CARVED rather than sawn, and
 * the two failures are worth keeping because they are opposite errors:
 *
 *   1. Each wall in two tiers, to give `roughenGeometry` more corners to move.
 *      The tiers' corners sit at different positions, so the hash moved them
 *      by different amounts and left a hard seam right round the block — a lid
 *      on a base.
 *   2. One box per wall, roughened harder to compensate. A box has eight
 *      corners and every face is two triangles, so moving those corners folded
 *      each wall along its own diagonal. Not stone: creased cardboard.
 *
 * Both tried to get subdivision out of the wrong thing. The walls are
 * `dishedSheetGeometry` — one continuous body with levels along its length,
 * which is what that helper's own docstring says the trough wants. The rim
 * undulates because each level carries its own height, the wall thickens and
 * thins because each carries its own thickness, and there is no join anywhere
 * for a seam to open in.
 *
 * The basin is made the way everything hollow in this kit is made: by not
 * filling it. Four walls and a floor, no boolean, corners overlapping.
 */
import { Color, type BufferGeometry } from 'three'

import {
  boxGeometry,
  createKitModel,
  createTinter,
  dishedSheetGeometry,
  jitter,
  mergeColoured,
  roughenGeometry,
  type SheetLevel,
} from '../core/index.ts'

export interface StoneTroughConfig {
  /** Along the trough (metres). */
  readonly length: number
  /** Across it (metres). */
  readonly width: number
  /** Height of the block (metres). */
  readonly height: number
  /** Wall thickness as a fraction of the width. */
  readonly wall: number
  /** How full it stands, as a fraction of the basin's depth. 0 is dry. */
  readonly water: number
  readonly seed: number
}

export const stoneTroughDefaults: StoneTroughConfig = {
  length: 1.5,
  width: 0.58,
  height: 0.44,
  // Heavy, but not as heavy as I first made it. A trough is a block with a
  // dish taken out of it rather than a vessel, and at 0.27 the two walls came
  // to more than half the width and the basin shut so far that a three-quarter
  // view showed only its inner face. The reference's opening is about three
  // fifths of the block across, which is this.
  wall: 0.21,
  // Nearly full, and that is the reference rather than a preference: its water
  // stands a couple of centimetres under the rim. It is also the only level at
  // which the water is VISIBLE from anywhere but straight above — at 0.55 the
  // surface sits below the near rim and the trough reads as dry from every
  // angle anyone will look at it from.
  water: 0.85,
  seed: 19,
}

export type StoneTroughParts = 'block' | 'water'

export function createModel(overrides: Partial<StoneTroughConfig> = {}) {
  return createKitModel<StoneTroughConfig, 'stone' | 'water', StoneTroughParts>({
    id: 'stone-trough',
    defaults: stoneTroughDefaults,
    slots: ['stone', 'water'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const L = Math.max(0.3, config.length)
      const W = Math.max(0.2, config.width)
      const H = Math.max(0.15, config.height)
      const wall = Math.max(0.02, Math.min(0.4, config.wall)) * W
      // The floor is thicker than the walls. A trough wears out from the
      // inside and the bottom is what is left when it does.
      const floor = H * 0.3
      const basin = H - floor

      /**
       * One wall as a single sheet, laid along +X and centred on the origin.
       *
       * `dishedSheetGeometry` builds in the XY plane: levels run along Y,
       * `halfWidth` spans X, `thickness` spans Z. One turn about Z lays that
       * down so the levels run along the trough and the half-width becomes the
       * wall's HEIGHT — which is the whole trick, because every level can then
       * carry a different height and the rim undulates on its own, with no
       * roughening involved and no seam to tear open.
       */
      const wallSheet = (len: number, thick: number, tall: number, lift: number): BufferGeometry => {
        const steps = 7
        const levels: SheetLevel[] = []
        for (let i = 0; i < steps; i += 1) {
          levels.push({
            y: len * (i / (steps - 1)),
            halfWidth: (tall / 2) * (1 + jitter(random, 0.035)),
            thickness: thick * (0.88 + random() * 0.24),
            curve: 0,
          })
        }
        const sheet = dishedSheetGeometry(levels, 2, tint('limestone', lift, 0.85))
        sheet.rotateZ(-Math.PI / 2)
        sheet.translate(-len / 2, 0, 0)
        return sheet
      }

      const stone: BufferGeometry[] = []

      /**
       * The solid bottom, and the ONLY thing that touches the ground.
       *
       * Built as four walls standing on the floor, every piece had a face on
       * the ground plane, and where the corners overlapped — which is exactly
       * where they are meant to overlap — two downward faces shared the plane
       * y = 0. The checker found it twice, and the second time was after I had
       * "fixed" it by lifting the basin floor, which only moved the pairing
       * from floor-against-wall to wall-against-wall.
       *
       * The answer is not to separate the overlaps but to stop there being
       * four things down there. A trough IS solid below the water line: one
       * block from the ground to the basin, and the walls stand on top of it.
       * One piece on the ground, one bottom face, nothing to pair with.
       */
      const foot = wall * 0.5
      stone.push(boxGeometry(
        [L - foot, floor, W - foot],
        [0, floor / 2, 0],
        new Color(tint('limestone', -0.05, 0.7)),
      ))

      /**
       * The four walls, sunk into that block by DIFFERENT amounts.
       *
       * Sunk, so their undersides are buried in solid stone rather than
       * meeting its top face in a plane. By different amounts, because the
       * long pair and the end pair overlap each other at the corners, and two
       * buried faces in one plane are still two faces in one plane whether
       * anybody can see them or not.
       *
       * The WALLS are flush with the block's nominal outline and the base is
       * tucked in behind them, not the other way round. Standing the walls
       * inset on a full-width base put a sharp ledge right round the bottom and
       * the thing read as a planter on a concrete plinth. Tucked under, the
       * base is invisible from above and the block is one face from rim to
       * ground.
       *
       * Their outer faces cannot land in the base's plane by accident either:
       * each level of a sheet carries its own thickness, so a wall's outer
       * surface is a run of slightly different planes rather than one.
       */
      const inset = 0
      const longSink = H * 0.06
      const endSink = H * 0.095
      for (const side of [-1, 1] as const) {
        const w = wallSheet(L - inset * 2, wall, basin + longSink, jitter(random, 0.04))
        stone.push(w.translate(
          0,
          floor - longSink + (basin + longSink) / 2,
          (side * (W - wall - inset * 2)) / 2,
        ))
      }
      for (const side of [-1, 1] as const) {
        const end = wallSheet(W - wall * 0.5, wall, basin + endSink, 0.03 + jitter(random, 0.04))
        // Built along +X like the others, then turned a quarter about Y, which
        // sends +X to -Z and leaves the height alone.
        end.rotateY(Math.PI / 2)
        stone.push(end.translate(
          (side * (L - wall - inset * 2)) / 2,
          floor - endSink + (basin + endSink) / 2,
          0,
        ))
      }

      const block = mergeColoured(stone)
      // Light, now that the sheets carry the shape themselves. This is grain
      // on a face, not the shape of the block.
      roughenGeometry(block, wall * 0.09, { salt: 41, scaleY: 0.5 })

      /**
       * Put the block back on the floor.
       *
       * Roughening moves every corner including the ones on the ground, and so
       * does the per-level height jitter, so the block ends up balanced on
       * three corners with daylight under the rest of it. The same treatment
       * the oak's bole gets: flatten everything below the bottom band back to
       * exactly zero, leaving all of the irregularity above that line.
       */
      const position = block.getAttribute('position')
      for (let i = 0; i < position.count; i += 1) {
        if (position.getY(i) < H * 0.04) position.setY(i, 0)
      }
      position.needsUpdate = true
      block.computeVertexNormals()

      // --- Water ------------------------------------------------------------
      // A film, not a body. It is a slab rather than a plane because a plane
      // seen edge-on from a low angle vanishes, and a trough is looked into
      // from above and along. Sunk into the floor rather than resting on it,
      // because a surface laid exactly ON another leaves two faces in a plane.
      const level = Math.max(0, Math.min(1, config.water))
      const depth = basin * level
      const sink = H * 0.035
      const water = depth > H * 0.01
        ? boxGeometry(
          [L - wall * 1.6, depth + sink, W - wall * 1.6],
          [0, floor - sink + (depth + sink) / 2, 0],
          new Color(tint('water', jitter(random, 0.03), 0.6)),
        )
        : undefined

      return {
        block: { slot: 'stone' as const, geometry: block },
        // Present and undefined when it is dry, never missing: the kit clears a
        // part's anchor before it checks whether there is anything to put in
        // it, so a key that is absent leaves last build's water hanging there.
        water: water ? { slot: 'water' as const, geometry: water } : undefined,
      }
    },
  }, overrides)
}
