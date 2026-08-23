/**
 * @medieval-kit/stone-well
 *
 * A village well: a drystone kerb, a timber frame over it, and a windlass to
 * wind the bucket up on.
 *
 * The kerb is the point of the thing and it is worth saying why. A well is a
 * hole; what makes it an OBJECT is the ring of stone built round its mouth, and
 * that ring is there for a reason — it keeps the surface water, and whatever the
 * surface water is carrying, from running back down into the drinking water. So
 * the courses are laid dry, staggered, and stand well proud of the ground.
 *
 * Four parts:
 *
 *   - `kerb`    — the stone ring. Every block is placed individually, because a
 *                 turned cylinder with lines drawn on it reads as a pot.
 *   - `frame`   — two uprights standing OUTSIDE the kerb, and the head beam
 *                 across them with their tenons showing through it.
 *   - `windlass`— the roller between the uprights, its end collars, and the
 *                 crank. The rope is wound on the middle of the roller.
 *   - `bucket`  — rope and bucket, hung from the roller. Its origin is the
 *                 roller's axis, so `setDepth` lowers it down the shaft without
 *                 moving anything else.
 *
 * This is the model that brought `stone` into the palette. The kit had no
 * masonry at all, which for a medieval catalogue is a hole rather than an
 * omission.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
  staveGeometry,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface StoneWellConfig {
  /** Outer radius of the stone kerb (metres). */
  readonly radius: number
  /** Height of the kerb above the ground (metres). */
  readonly wallHeight: number
  /** Courses of stone. */
  readonly courses: number
  /** Blocks in each course. */
  readonly blocks: number
  /** Height from the ground to the top of the head beam (metres). */
  readonly frameHeight: number
  /** How far down the bucket hangs. 0 = at the roller, 1 = at the water. */
  readonly depth: number
  readonly seed: number
}

export const stoneWellDefaults: StoneWellConfig = {
  radius: 0.62,
  wallHeight: 0.66,
  courses: 4,
  blocks: 11,
  frameHeight: 1.95,
  depth: 0.34,
  seed: 17,
}

export type StoneWellParts = 'kerb' | 'frame' | 'windlass' | 'bucket'

export interface StoneWellActions {
  /** Sends the bucket down (1) or brings it up (0). */
  setDepth(t: number): void
  depth(): number
  /** Winds continuously until stopped. Positive winds up. */
  setWinding(speed: number): void
}

export function createModel(overrides: Partial<StoneWellConfig> = {}) {
  let depth = 0
  let winding = 0
  let travel = 0
  /**
   * Where the part's own origin put the anchor.
   *
   * `origin` places the anchor at the roller's axis at build time, and the
   * geometry is authored around it. Writing an absolute `position.y` here
   * therefore DESTROYS that placement -- which is what the first version did,
   * setting it to 0 and dropping the whole rope and bucket by the height of the
   * roller, so the rope started a hand's width below the barrel it hangs from.
   * Everything the actions do is now an offset from this.
   */
  let restY = 0

  return createKitModel<StoneWellConfig, 'stone' | 'oak' | 'iron' | 'cloth', StoneWellParts, StoneWellActions>({
    id: 'stone-well',
    defaults: stoneWellDefaults,
    slots: ['stone', 'oak', 'iron', 'cloth'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = config.frameHeight
      const floor = -H / 2
      const R = config.radius
      const wall = R * 0.34

      // --- Kerb ---------------------------------------------------------------
      const masonry: BufferGeometry[] = []
      const courses = Math.max(1, Math.round(config.courses))
      const blocks = Math.max(5, Math.round(config.blocks))
      const courseH = config.wallHeight / courses
      const midR = R - wall / 2

      for (let c = 0; c < courses; c += 1) {
        // Every other course is offset by half a block: a joint running
        // straight up through four courses is a crack waiting to happen, and a
        // waller knows it. It is also what stops the ring reading as a stack of
        // identical rings.
        const phase = (c % 2) * 0.5
        for (let b = 0; b < blocks; b += 1) {
          const a = ((b + phase) / blocks) * Math.PI * 2
          const arc = (Math.PI * 2 * midR) / blocks
          // Plain tapered boxes, not chamfered ones. A chamfer is 44 triangles
          // against 12, and at forty-four blocks that is 1 900 of them spent on
          // edges the `roughenGeometry` pass below softens anyway. Stone is the
          // one material in this kit where a sharp arris is not wrong.
          // ARC first, WALL second. `rotateY(a)` carries the footprint's +Z out
          // along the radius and its +X round the circumference, so writing the
          // wall thickness first put every block across the ring instead of
          // along it: each one stuck a block's length out of a wall a block's
          // width thick, and the kerb came out as rubble thrown at a circle.
          // The variation is small on purpose. At +-10% on the arc and +-9% on
          // the thickness, every block sat at its own radius and its own width:
          // the ring came out as rubble rather than as courses, and a waller
          // who laid it like that would be looking for other work. A dry wall
          // is irregular in the way a hand-cut stone is irregular, which is a
          // few percent, not a tenth.
          // Blocks are cut a little LONGER than their share of the arc, and
          // courses a little taller than their share of the height, so
          // neighbours bite into each other.
          //
          // A flat-faced box on a curve cannot close the joint at its outer
          // corner: the chord is shorter than the arc, so anything sized to its
          // exact share leaves a wedge of daylight at every joint and the wall
          // reads as a ring of separate stones. Letting them overlap is the
          // same rule the rest of the kit follows for joints, and it is safe
          // here because each block is rotated to its own angle, so no two
          // adjoining faces are parallel.
          const block = taperedBoxGeometry(
            [arc * (1.04 + jitter(random, 0.03)), wall * (0.99 + jitter(random, 0.04))],
            [arc * (1.02 + jitter(random, 0.03)), wall * (0.95 + jitter(random, 0.04))],
            courseH * (1.03 + jitter(random, 0.025)),
            [0, 0, 0],
            tint('stone', jitter(random, 0.09)),
          )
          // Built facing +Z and swung round: rotating first and placing second
          // is what keeps each block square to the ring rather than to the axes.
          block.rotateY(a)
          block.translate(
            Math.sin(a) * midR,
            floor + courseH * (c + 0.5),
            Math.cos(a) * midR,
          )
          masonry.push(block)
        }
      }
      // Rough dressing. Small: the blocks are already irregular in size, and
      // displacing them further only opens the dry joints between them.
      const kerb = mergeColoured(masonry)
      roughenGeometry(kerb, wall * 0.03, { salt: 13 })

      // --- Frame --------------------------------------------------------------
      const timber: BufferGeometry[] = []
      const postSide = R * 0.24
      const postX = R + postSide * 0.55
      const beamH = R * 0.2
      const beamY = floor + H - beamH / 2
      // The uprights run PAST the beam and show as tenons on top of it.
      const postTop = floor + H + beamH * 0.34

      for (const side of [-1, 1]) {
        timber.push(chamferedBoxGeometry(
          [postSide * 1.06, postSide * 1.06],
          [postSide * 0.94, postSide * 0.94],
          postTop - floor,
          postSide * 0.09,
          [side * postX, (floor + postTop) / 2, 0],
          tint('oak', -0.03 + jitter(random, 0.04)),
        ))
      }
      timber.push(chamferedBoxGeometry(
        [postX * 2 + postSide * 2.2, beamH * 0.86],
        [postX * 2 + postSide * 1.9, beamH * 0.78],
        beamH,
        beamH * 0.09,
        [0, beamY, 0],
        tint('oak', 0.03),
      ))

      // --- Windlass -----------------------------------------------------------
      // The roller sits well below the beam: the rope has to come off it and
      // fall clear down the middle of the well, and a roller tucked under the
      // beam would foul it.
      const rollerY = floor + H * 0.62
      const rollerR = R * 0.15
      const rollerHalf = postX - postSide * 0.25
      const gear: BufferGeometry[] = []
      const iron: BufferGeometry[] = []

      const rollerProfile: Level[] = [
        { y: -rollerHalf, radius: rollerR * 0.86 },
        { y: -rollerHalf * 0.88, radius: rollerR },
        { y: rollerHalf * 0.88, radius: rollerR },
        { y: rollerHalf, radius: rollerR * 0.86 },
      ]
      const roller = latheGeometry(rollerProfile, 9, [0, 0, 0], tint('oak', 0.02, 1.2))
      // Built along Y like every lathe here; +90 about Z lays it along X,
      // spanning the gap between the uprights.
      roller.rotateZ(Math.PI / 2)
      roller.translate(0, rollerY, 0)
      gear.push(roller)

      // End collars: the raised shoulders that keep the rope from wandering off
      // the barrel and into the bearing.
      for (const side of [-1, 1]) {
        const collar = bandGeometry(
          rollerR * 1.5, 0, rollerR * 0.55, rollerR * 0.5, 9,
          tint('oak', -0.06, 1.2), { inner: true },
        )
        collar.rotateZ(Math.PI / 2)
        collar.translate(side * rollerHalf * 0.62, rollerY, 0)
        gear.push(collar)
      }

      // The rope wound on the barrel, between the collars.
      const coil = bandGeometry(
        rollerR * 1.34, 0, rollerR * 1.05, rollerR * 0.34, 9,
        tint('cloth', -0.04, 1.3), { inner: true },
      )
      coil.rotateZ(Math.PI / 2)
      coil.translate(0, rollerY, 0)
      gear.push(coil)

      // Crank: an iron elbow through the upright with a wooden grip on the end.
      const crankOut = postX + postSide * 0.9
      iron.push(taperedBoxGeometry(
        [rollerR * 0.5, rollerR * 0.5],
        [rollerR * 0.42, rollerR * 0.42],
        postSide * 2.4,
        [0, 0, 0],
        tint('iron', 0.02, 0.7),
      ).rotateZ(Math.PI / 2).translate(postX + postSide * 0.5, rollerY, 0))
      iron.push(boxGeometry(
        [rollerR * 0.46, rollerR * 2.6, rollerR * 0.46],
        [crankOut, rollerY - rollerR * 1.2, 0],
        new Color(tint('iron', -0.02, 0.7)),
      ))
      gear.push(taperedBoxGeometry(
        [rollerR * 0.72, rollerR * 0.72],
        [rollerR * 0.58, rollerR * 0.58],
        rollerR * 2.1,
        [0, 0, 0],
        tint('oak', 0.05),
      ).rotateZ(Math.PI / 2).translate(crankOut + rollerR * 0.9, rollerY - rollerR * 2.2, 0))

      // --- Rope and bucket ----------------------------------------------------
      // Authored hanging from the ROLLER'S AXIS, which is where the part's
      // origin goes, so lowering the bucket is one rotation-free translation.
      const bucketR = R * 0.3
      const bucketH = bucketR * 1.5
      const fall = H * 0.34 * Math.min(1, Math.max(0, config.depth))
      const hanging: BufferGeometry[] = []

      // The rope from barrel to bail. It has to stretch with the drop, so its
      // length is derived rather than fixed.
      // The rope leaves the COIL, not the axis.
      //
      // Starting it at y = 0 put its whole surface inside the roller's hollow
      // interior, touching nothing -- these are surfaces, not solids, so a rope
      // threaded up the middle of a barrel is joined to it only in the sense
      // that it is inside it. The support check called the bucket floating and
      // it was right. Beginning just inside the coil's inner face means the
      // rope crosses the coil's outer face on its way down.
      // Inside the coil's MATERIAL, which is the band from 1.0 to 1.34 of the
      // roller radius -- not at 0.95, which is the hole through the middle of
      // it. Starting there the rope hung in the ring's eye touching nothing;
      // starting at 1.15 it begins within the wound rope and crosses its outer
      // face on the way down.
      const ropeTop = -rollerR * 1.15
      const ropeLength = Math.max(rollerR * 1.6, fall) - ropeTop
      hanging.push(latheGeometry(
        [
          { y: ropeTop - ropeLength, radius: rollerR * 0.11 },
          { y: ropeTop, radius: rollerR * 0.12 },
        ] as Level[],
        6, [0, 0, 0], tint('cloth', -0.08, 1.3),
        { capTop: false, capBottom: false },
      ))

      // Bail: the iron loop the bucket hangs by.
      const bail = bandGeometry(
        bucketR * 0.94, 0, rollerR * 0.16, rollerR * 0.13, 9,
        tint('iron', 0.04, 0.7), { inner: true },
      )
      bail.rotateX(Math.PI / 2)
      bail.translate(0, ropeTop - ropeLength - bucketR * 0.5, 0)
      hanging.push(bail)

      // A small stave bucket, built the way the kit's bucket is: separate
      // boards, not a turned cup.
      const staves = 11
      const step = (Math.PI * 2) / staves
      const bucketY = ropeTop - ropeLength - bucketR * 0.5 - bucketH * 0.52
      for (let i = 0; i < staves; i += 1) {
        hanging.push(staveGeometry(
          [
            { y: bucketY - bucketH / 2, radius: bucketR * 0.82 },
            { y: bucketY + bucketH / 2, radius: bucketR },
          ] as Level[],
          i * step + step * 0.06,
          (i + 1) * step - step * 0.06,
          bucketR * 0.14,
          tint('oak', jitter(random, 0.06)),
        ))
      }
      for (const at of [-0.34, 0.32]) {
        const hoop = bandGeometry(
          bucketR * (at < 0 ? 0.88 : 1.01), bucketY + bucketH * at,
          bucketH * 0.1, bucketR * 0.05, staves,
          tint('iron', 0.03, 0.7),
        )
        hanging.push(hoop)
      }
      hanging.push(latheGeometry(
        [
          { y: bucketY - bucketH * 0.44, radius: bucketR * 0.78 },
          { y: bucketY - bucketH * 0.38, radius: bucketR * 0.8 },
        ] as Level[],
        staves, [0, 0, 0], tint('oak', -0.1),
      ))

      return {
        kerb: { slot: 'stone' as const, geometry: kerb },
        frame: { slot: 'oak' as const, geometry: mergeColoured(timber) },
        windlass: {
          slot: 'oak' as const,
          geometry: mergeColoured(gear),
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(iron) }],
        },
        bucket: {
          slot: 'oak' as const,
          geometry: mergeColoured(hanging),
          origin: [0, rollerY, 0] as const,
        },
      }
    },

    actions: ({ parts, getConfig }) => {
      depth = getConfig().depth
      travel = 0
      restY = parts.bucket.anchor.position.y
      return {
        setDepth: (t) => {
          winding = 0
          depth = Math.min(1, Math.max(0, t))
          travel = 0
        },
        depth: () => depth,
        setWinding: (speed) => { winding = speed },
      }
    },

    update: (deltaSeconds, { parts, getConfig }) => {
      if (winding === 0) return
      // Winding moves the bucket by TRANSLATION rather than by rebuilding the
      // rope, so the action costs nothing per frame. The rope's own length is
      // fixed by `depth` at build time; between rebuilds the bucket slides on
      // it, which is exactly what a bucket on a rope does.
      const H = getConfig().frameHeight
      travel = Math.min(H * 0.34, Math.max(-H * 0.2, travel + winding * deltaSeconds * H * 0.18))
      parts.bucket.anchor.position.y = restY + travel
    },
  }, overrides)
}
