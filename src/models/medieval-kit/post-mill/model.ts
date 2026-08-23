/**
 * @medieval-kit/post-mill
 *
 * A post mill: the medieval windmill, and the largest thing in this kit.
 *
 * The name is the whole design. The entire body — millstones, gearing, miller
 * and all — is balanced on ONE massive vertical post and turns bodily on it, so
 * that the sails can be pointed into whatever wind there is. The miller does
 * that by walking the tail ladder round, which is why the ladder is not a way
 * up but a lever, and why it reaches so far behind the mill.
 *
 * That gives the model its four parts and the order they have to be built in:
 *
 *   - `trestle` — two cross-trees laid on the ground, the post standing on
 *     them, and four quarter-bars bracing post to cross-tree. Nothing is
 *     fastened to the ground: a post mill stands on its own weight, and the
 *     cross-trees are what stop it walking off.
 *   - `body` — the buck, a boarded timber box with a pitched roof, sitting on
 *     the post's crown.
 *   - `sails` — four lattice sails on a windshaft that leaves the front gable
 *     tilted a little upwards. This part has its own origin at the shaft, so
 *     `setTurning` can spin it without moving anything else.
 *   - `ladder` — the tail ladder, from the back of the buck down to the ground
 *     well behind it.
 *
 * The sails are the reason the triangle count is where it is. A sail is not a
 * blade, it is a LATTICE: a whip with a frame beside it and a run of bars
 * across, which the miller dresses with canvas according to the wind. Drawn as
 * a solid blade the silhouette is wrong in the one place everybody looks, so
 * the bars are modelled and the budget is spent there rather than on the
 * boarding of the buck, which reads perfectly well as vertex colour.
 */
import { Color, type BufferGeometry } from 'three'

import {
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  taperedBoxGeometry,
} from '../core/index.ts'

export interface PostMillConfig {
  /** Height to the ridge of the roof (metres). Sails reach past it. */
  readonly height: number
  /** Sail span, tip to tip (metres). */
  readonly sailSpan: number
  /** Bars across each sail. */
  readonly sailBars: number
  /** Width of the lattice beside each whip, as a fraction of the sail's length. */
  readonly sailWidth: number
  /** Rungs in the tail ladder. */
  readonly ladderRungs: number
  /** Current sail angle (radians). */
  readonly spin: number
  readonly seed: number
}

export const postMillDefaults: PostMillConfig = {
  height: 6.2,
  // The lowest sail tip has to clear the ground. At 7.4 against a 6.2 m mill
  // it came down to within 0.27 m of it, which reads as a mill about to plough
  // its own field; the reference leaves roughly a tenth of the height.
  sailSpan: 6.6,
  // The lattice is what says "windmill" at any distance, and nine bars over a
  // 3.3 m sail spaces them like ladder rungs. The reference reads as a fine
  // grid.
  sailBars: 13,
  sailWidth: 0.17,
  ladderRungs: 13,
  spin: 0,
  seed: 43,
}

export type PostMillParts = 'trestle' | 'body' | 'sails' | 'ladder'

export interface PostMillActions {
  /** Starts or stops the sails. */
  setTurning(on: boolean): void
  isTurning(): boolean
  /** Puts the sails at a given angle and stops them there. */
  setAngle(radians: number): void
}

export function createModel(overrides: Partial<PostMillConfig> = {}) {
  let turning = false
  let angle = 0

  return createKitModel<PostMillConfig, 'oak' | 'iron', PostMillParts, PostMillActions>({
    id: 'post-mill',
    defaults: postMillDefaults,
    slots: ['oak', 'iron'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = config.height
      const half = H / 2
      const floor = -half

      // Heights are fractions of the mill's own height, so every slider keeps
      // the proportions of the reference rather than stretching one piece.
      const postTop = floor + H * 0.42
      const bodyHeight = H * 0.30
      const bodyBottom = postTop
      const bodyTop = bodyBottom + bodyHeight
      const bodyWidth = H * 0.29      // across the sails' axis
      const bodyDepth = H * 0.34      // along it
      const ridge = bodyTop + H * 0.13

      // --- Trestle -------------------------------------------------------------
      const timber: BufferGeometry[] = []
      const postSide = H * 0.075
      const treeSpan = H * 0.62
      const treeSide = H * 0.055

      // Two cross-trees, laid one over the other. They are NOT coplanar: the
      // upper one rides on top of the lower, which is how they actually sit and
      // which keeps their faces out of each other.
      for (const [index, along] of ([0, 1] as const).entries()) {
        const lower = index === 0
        const size: [number, number] = along === 0
          ? [treeSpan, treeSide]
          : [treeSide, treeSpan]
        timber.push(chamferedBoxGeometry(
          size,
          [size[0] * 0.97, size[1] * 0.97],
          treeSide,
          treeSide * 0.12,
          [0, floor + (lower ? treeSide * 0.5 : treeSide * 1.4), 0],
          tint('oak', lower ? -0.1 : -0.05),
        ))
      }

      // The post. Slightly tapered, because it is a whole tree and a tree is.
      const postBase = floor + treeSide * 1.1
      const postHeight = postTop - postBase
      timber.push(taperedBoxGeometry(
        [postSide * 1.15, postSide * 1.15],
        [postSide * 0.92, postSide * 0.92],
        postHeight,
        [0, postBase + postHeight / 2, 0],
        tint('oak', -0.02),
      ))

      // Four quarter-bars, one to each arm of the cross-trees. Their feet sit
      // ON the cross-tree and their heads run INTO the post, so both joints are
      // overlaps rather than faces meeting.
      const barFoot = treeSpan * 0.36
      const barHead = postTop - H * 0.075
      const barRise = barHead - (floor + treeSide * 1.6)
      const barLength = Math.hypot(barFoot, barRise)
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2
        const bar = chamferedBoxGeometry(
          [H * 0.036, H * 0.05],
          [H * 0.03, H * 0.042],
          barLength * 1.04,
          H * 0.006,
          [0, 0, 0],
          tint('oak', -0.07 + jitter(random, 0.03)),
        )
        // Built upright, leaned outwards, then swung to its arm. Rotating about
        // X leans it in the YZ plane; rotating about Y carries that lean round.
        bar.rotateX(Math.atan2(barFoot, barRise))
        bar.rotateY(a)
        bar.translate(
          Math.sin(a) * barFoot * 0.5,
          (floor + treeSide * 1.6 + barHead) / 2,
          Math.cos(a) * barFoot * 0.5,
        )
        timber.push(bar)
      }

      // Crown: the beam the whole body turns on, laid across the post's head.
      timber.push(chamferedBoxGeometry(
        [bodyWidth * 1.05, H * 0.07],
        [bodyWidth * 0.98, H * 0.06],
        H * 0.05,
        H * 0.006,
        [0, postTop - H * 0.012, 0],
        tint('oak', 0.02),
      ))

      // --- Body ----------------------------------------------------------------
      const shell: BufferGeometry[] = []
      shell.push(chamferedBoxGeometry(
        [bodyWidth, bodyDepth],
        [bodyWidth * 0.99, bodyDepth * 0.99],
        bodyHeight,
        H * 0.008,
        [0, bodyBottom + bodyHeight / 2, 0],
        tint('oak', 0.04),
        tint('oak', -0.03),
      ))

      // Roof: two pitched sheets meeting at a ridge. Built as tapered boxes
      // leaned in rather than as a prism, so the gable ends stay flat and the
      // eaves can overhang the walls, which is what keeps rain off boarding.
      const eave = bodyWidth * 0.62
      const roofRise = ridge - bodyTop
      const slope = Math.hypot(eave, roofRise)
      for (const side of [-1, 1]) {
        // `slope`, not `slope * 2`. Each pitch covers HALF the roof: the slope
        // is already the hypotenuse from ridge to eave. Doubled, the two came
        // out 2.79 m across a building 1.80 m wide, and the roof stopped being
        // a roof and became the largest thing in the silhouette.
        const pitch = chamferedBoxGeometry(
          [slope * 1.03, bodyDepth * 1.08],
          [slope * 1.03, bodyDepth * 1.08],
          H * 0.016,
          H * 0.004,
          [0, 0, 0],
          tint('oak', -0.12),
        )
        // The pitch starts as a slab lying FLAT -- `chamferedBoxGeometry` takes
        // an X-Z footprint and a Y height -- so the tilt is the roof's angle
        // measured from the horizontal, and it is negative on the +X side so
        // the eave drops rather than rises. Both earlier attempts used the
        // complement of this angle, which stood the pitches up like the covers
        // of an open book.
        pitch.rotateZ(-side * Math.atan2(roofRise, eave))
        pitch.translate(side * eave * 0.5, bodyTop + roofRise * 0.5, 0)
        shell.push(pitch)
      }
      // Ridge board, capping the join so the two pitches do not meet in a seam.
      shell.push(chamferedBoxGeometry(
        [H * 0.03, bodyDepth * 1.1],
        [H * 0.024, bodyDepth * 1.1],
        H * 0.022,
        H * 0.004,
        [0, ridge - H * 0.008, 0],
        tint('oak', -0.16),
      ))

      // The door, in the tail wall above the gallery.
      //
      // The ladder has to arrive somewhere. A mill is entered from its tail,
      // through the one wall the sails never sweep past, and the miller comes
      // up the same ladder he turns the mill with -- so a flight of steps
      // ending at blank boarding is the one thing about this model that could
      // not be true.
      //
      // Boarded proud of the wall rather than cut into it: there are no
      // booleans here, and a door of applied planks with a frame round it is
      // how a plank building is actually closed.
      const doorWidth = bodyWidth * 0.42
      const doorHeight = bodyHeight * 0.66
      const doorY = bodyBottom + H * 0.035 + doorHeight / 2
      const doorZ = -bodyDepth / 2
      shell.push(chamferedBoxGeometry(
        [doorWidth, H * 0.018],
        [doorWidth * 0.99, H * 0.016],
        doorHeight,
        H * 0.004,
        [0, doorY, doorZ - H * 0.004],
        tint('oak', -0.14),
      ))
      // Two iron-dark ledges across it, and the frame: what stops a plank door
      // being a rectangle drawn on a wall.
      for (const at of [-0.28, 0.3]) {
        shell.push(chamferedBoxGeometry(
          [doorWidth * 1.04, H * 0.012],
          [doorWidth * 1.02, H * 0.01],
          H * 0.022,
          H * 0.003,
          [0, doorY + doorHeight * at, doorZ - H * 0.012],
          tint('oak', -0.22),
        ))
      }

      // The tail gallery: the little platform the ladder arrives at.
      shell.push(chamferedBoxGeometry(
        [bodyWidth * 0.92, H * 0.05],
        [bodyWidth * 0.88, H * 0.045],
        H * 0.018,
        H * 0.004,
        [0, bodyBottom + H * 0.02, -bodyDepth * 0.52],
        tint('oak', -0.06),
      ))

      // --- Sails ---------------------------------------------------------------
      // The windshaft leaves the front gable pointing +Z and tilted up a little,
      // which is what stops the sails striking the body as they come round.
      // The sail disc has to clear the front of the buck.
      //
      // A tilted shaft spreads its sails through Z: at 0.14 rad a 3.5 m sail
      // swings +-0.49 m fore and aft, and with the hub only 0.08 m in front of
      // the gable the whole lower half of the disc passed through the building.
      // Two changes, and both are what a real mill does. The shaft tilts only a
      // few degrees -- just enough to keep the sails off the body and to take
      // some of their weight onto the thrust bearing -- and it projects a good
      // way out, so the sweep happens clear of the wall.
      const shaftTilt = 0.075
      // Far enough forward and no further. The clearance the disc needs is
      // sailLength * sin(tilt), about 0.26 m here; pushing the hub out to 0.86
      // of the body's depth left the sails hanging most of a metre off the
      // gable with nothing but the shaft between them, where the reference has
      // them sweeping close past the boarding.
      const hubZ = bodyDepth * 0.72
      const hubY = bodyBottom + bodyHeight * 0.72
      const sailLength = config.sailSpan / 2
      const hubRadius = H * 0.035
      const barT = H * 0.014
      const latticeWidth = sailLength * config.sailWidth
      const bars = Math.max(2, Math.round(config.sailBars))

      const rig: BufferGeometry[] = []
      const ironWork: BufferGeometry[] = []
      // Windshaft: iron-banded oak, poking out of the gable ALONG Z.
      //
      // `taperedBoxGeometry` takes its third argument as a Y height, so written
      // without a rotation this was a short vertical post standing inside the
      // buck rather than a shaft projecting from the front of it. Hidden inside
      // the body it went unseen through every render; it only surfaced when the
      // iron bands were added and turned out to be coaxial with it, which the
      // z-fight check reported at once.
      // Long enough to reach back into the gable it comes out of.
      const shaftLength = H * 0.20
      const shaft = taperedBoxGeometry(
        [hubRadius * 2.1, hubRadius * 2.1],
        [hubRadius * 1.5, hubRadius * 1.5],
        shaftLength,
        [0, 0, 0],
        tint('oak', -0.04),
      )
      shaft.rotateX(Math.PI / 2)
      shaft.translate(0, 0, -shaftLength * 0.32)
      rig.push(shaft)
      // The bands themselves, and they are not decoration. Four sails pull on
      // one shaft from four directions; what holds the whips to it is iron
      // strapping, and this model declared an `iron` slot while using it
      // nowhere -- the shaft was described in the comment above as iron-banded
      // and then painted oak like everything else.
      for (const at of [-0.02, 0.03]) {
        const band = taperedBoxGeometry(
          [hubRadius * 2.4, hubRadius * 2.4],
          [hubRadius * 2.3, hubRadius * 2.3],
          H * 0.014,
          [0, 0, 0],
          tint('iron', 0.02, 0.7),
        )
        band.rotateX(Math.PI / 2)
        band.translate(0, 0, H * at)
        ironWork.push(band)
      }

      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2
        const sail: BufferGeometry[] = []
        const tone = tint('oak', -0.05 + jitter(random, 0.04))

        // Whip: the spar the whole sail hangs on, running out from the hub.
        sail.push(boxGeometry(
          [barT * 1.3, sailLength - hubRadius, barT * 1.6],
          [0, hubRadius + (sailLength - hubRadius) / 2, 0],
          new Color(tone),
        ))
        // The outer rail of the frame, parallel to the whip.
        sail.push(boxGeometry(
          [barT * 0.9, (sailLength - hubRadius) * 0.9, barT * 1.1],
          [latticeWidth, hubRadius + (sailLength - hubRadius) * 0.5, 0],
          new Color(tint('oak', -0.1)),
        ))
        // And the bars across. These are the sail: a solid blade would read as
        // a propeller, and the lattice is what says "windmill" at any distance.
        for (let b = 0; b < bars; b += 1) {
          const t = (b + 0.6) / bars
          sail.push(boxGeometry(
            [latticeWidth * 1.12, barT * 0.7, barT * 0.9],
            [latticeWidth * 0.5, hubRadius + (sailLength - hubRadius) * t, 0],
            new Color(tint('oak', -0.02 + jitter(random, 0.05))),
          ))
        }

        const merged = mergeColoured(sail)
        // Cant: each sail is twisted a few degrees about its own length so it
        // presents a face to the wind. Without it the four read as a flat cross.
        merged.rotateY(0.18)
        merged.rotateZ(a)
        // Opposite pairs sit at different depths along the shaft.
        //
        // This is how the sails are actually carried: TWO stocks pass through
        // the windshaft at right angles to each other, one behind the other,
        // and each stock carries a sail at both of its ends. Built all in one
        // plane the four converge on the hub in perfect symmetry, and the
        // z-fight check found their faces meeting there -- correctly, because
        // four timbers cannot occupy one crossing.
        merged.translate(0, 0, (i % 2 === 0 ? -1 : 1) * barT * 2.1)
        rig.push(merged)
      }

      const sails = mergeColoured(rig)
      const shaftBands = mergeColoured(ironWork)
      shaftBands.rotateX(-shaftTilt)
      // The rig is authored around the hub and the part's origin goes there, so
      // `setTurning` spins it about the shaft instead of about the model.
      sails.rotateX(-shaftTilt)

      // --- Ladder --------------------------------------------------------------
      // Long and shallow: it is the lever the mill is turned with, not a stair.
      const steps: BufferGeometry[] = []
      // Long and shallow. The tail ladder is the lever the mill is turned by,
      // so it reaches well behind: at 0.42 of the height it came down at 47
      // degrees, which is a staircase. The reference lands much further back.
      const footZ = -bodyDepth * 0.5 - H * 0.62
      const headZ = -bodyDepth * 0.52
      const headY = bodyBottom + H * 0.02
      const run = headZ - footZ
      const rise = headY - floor
      const railLength = Math.hypot(run, rise)
      const lean = Math.atan2(run, rise)
      const railGap = bodyWidth * 0.34

      // The whole ladder is lifted by one offset, rails and rungs together.
      //
      // The foot has to land ON the ground, level with the cross-trees, and two
      // things push it under. The rail is built 3% long so it can bury its head
      // in the gallery, and half of that overrun hangs off the bottom; and once
      // tilted, the lowest CORNER of its end face drops below that face's
      // centre by half the rail's depth times sin(lean). Left uncorrected the
      // ladder sat 0.10 m under the trestle, so the mill's floor was its stair
      // and the whole thing hovered above whatever it was placed on.
      //
      // Correcting only the rails is worse than not correcting at all. The
      // second term displaces them PERPENDICULAR to their own axis by very
      // nearly a rung's half-depth, so the rungs -- placed on the original
      // centre line -- came away from the rails entirely. The support audit
      // caught that at the small end of the height slider as loose rungs
      // floating beside the ladder.
      const railDepth = H * 0.038
      const liftY = railLength * 0.015 * Math.cos(lean) + (railDepth / 2) * Math.sin(lean)
      const liftZ = -railLength * 0.015 * Math.sin(lean)

      for (const side of [-1, 1]) {
        const rail = chamferedBoxGeometry(
          [H * 0.022, railDepth],
          [H * 0.018, H * 0.032],
          railLength * 1.03,
          H * 0.004,
          [0, 0, 0],
          tint('oak', -0.08),
        )
        // +lean, not -lean. `run` is positive -- the ladder's head sits at a
        // LARGER z than its foot -- and rotateX(+t) carries +Y towards +Z, so
        // the negative sign laid the rails along the opposite diagonal to the
        // one the rungs are placed on. The two crossed near the middle and
        // diverged towards the ends, which is exactly what the support audit
        // reported: the middle rungs held, the outer ones floated. The bounding
        // box looked right the whole time, because the translation put the
        // ladder where it belonged and only its internals were wrong.
        rail.rotateX(lean)
        rail.translate(
          side * railGap,
          (floor + headY) / 2 + liftY,
          (footZ + headZ) / 2 + liftZ,
        )
        steps.push(rail)
      }

      const rungs = Math.max(2, Math.round(config.ladderRungs))
      for (let i = 0; i < rungs; i += 1) {
        const t = (i + 0.5) / rungs
        // Spanning PAST both rails, so each rung is housed in them rather than
        // ending at their inner faces.
        // The rung is DEEPER than the rail it passes through (0.048 against
        // 0.038), so its faces stand proud on both sides.
        //
        // Made thinner than the rail, a rung that "passes through" it has its
        // whole surface buried inside the rail's hollow interior, touching
        // nothing: these are surfaces, not solids. At the default height the
        // voxel grid was coarse enough to bridge the gap and the support check
        // passed; shrink the mill to the bottom of the height slider and the
        // finer grid separated three of the five rungs from the ladder. The
        // check was right both times -- the joint was never real.
        const rung = boxGeometry(
          [railGap * 2 + H * 0.03, H * 0.02, H * 0.048],
          [0, 0, 0],
          new Color(tint('oak', -0.03 + jitter(random, 0.04))),
        )
        rung.rotateX(lean)
        rung.translate(0, floor + rise * t + liftY, footZ + run * t + liftZ)
        steps.push(rung)
      }

      return {
        trestle: { slot: 'oak' as const, geometry: mergeColoured(timber) },
        body: { slot: 'oak' as const, geometry: mergeColoured(shell) },
        sails: {
          slot: 'oak' as const,
          geometry: sails,
          // The bands belong here, not with the trestle. They are authored
          // around the hub, so in any other part's frame they land at the
          // model's origin and hang in the air -- which is where the support
          // check found them. They also turn with the shaft, because in a real
          // mill the shaft is what the sails are keyed to.
          extras: [{ slot: 'iron' as const, geometry: shaftBands }],
          origin: [0, hubY, hubZ] as const,
        },
        ladder: { slot: 'oak' as const, geometry: mergeColoured(steps) },
      }
    },

    actions: ({ parts, getConfig }) => {
      angle = getConfig().spin
      parts.sails.anchor.rotation.z = angle
      return {
        setTurning: (on) => { turning = on },
        isTurning: () => turning,
        setAngle: (radians) => {
          turning = false
          angle = radians
          parts.sails.anchor.rotation.z = angle
        },
      }
    },

    update: (deltaSeconds, { parts }) => {
      if (!turning) return
      // A working post mill turns slowly — on the order of ten revolutions a
      // minute at the sail tips, not the blur people draw.
      angle += deltaSeconds * 1.05
      parts.sails.anchor.rotation.z = angle
    },
  }, overrides)
}
