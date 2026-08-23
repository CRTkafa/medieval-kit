/**
 * @medieval-kit/oak-tree
 *
 * A free-standing oak: flared bole, sweeping limbs, a broad low crown.
 *
 * The kit had nothing growing in it at all. Every other model is something a
 * person made, and a village of nothing but made things reads as a warehouse
 * yard — so this is the first piece of the site rather than of the inventory,
 * and it is also by some way the largest thing here.
 *
 * It was built against two reference photographs, and both of them contradicted
 * what I was going to build. Worth writing down, because the default lowpoly
 * tree — a tall bare pole with a ball on top — is wrong in every measurement
 * that matters:
 *
 *   - CROWN WIDTH / TREE HEIGHT = 1.32 to 1.43. An open-grown oak is HALF
 *     AGAIN as wide as it is tall. Nothing else in this kit is wider than it
 *     is tall, and getting this one number right is most of what makes the
 *     silhouette read as an oak rather than as a lollipop.
 *   - THE CROWN IS WIDEST AT 24% OF THE HEIGHT. Not halfway up, not at the
 *     top: a quarter of the way up, just above the ground. The lowest limbs
 *     are the longest ones and they leave the trunk almost horizontally.
 *   - THE TRUNK RUNS TO 72% OF THE HEIGHT before it stops being the widest
 *     single thing. It does not fork low into equal leaders, which is what I
 *     had assumed from the leafy photograph alone; the winter photograph shows
 *     one continuous bole with everything else hung off it.
 *   - THE FLARE IS SHARP AND SHORT. The trunk is 0.130 of the tree's height
 *     wide at 2% of the height and 0.073 at 10% — it nearly halves in the
 *     bottom tenth, then barely tapers at all through the next quarter.
 *
 * The limbs SWEEP. A branch leaves the trunk at a shallow angle and turns
 * upward at its outer end, which is the profile a lowpoly tree most often
 * misses, and it comes free here: `bendGeometry` on a limb built along its own
 * axis, before it is rotated into place.
 *
 * The honest limit: what fills a real winter silhouette is thousands of twigs,
 * and no triangle budget here reaches them. At `leafiness: 0` this is a bare
 * tree of LIMBS, which is a fine dead or winter tree and is not a photograph
 * of one.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bendGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface OakTreeConfig {
  /** Height to the top of the crown (metres). */
  readonly height: number
  /** Crown width as a multiple of the height. The reference oaks measure 1.32–1.43. */
  readonly spread: number
  /** Radius of the clear bole, as a fraction of the height. */
  readonly bole: number
  /** Primary limbs off the trunk. */
  readonly limbs: number
  /** 0 leaves it bare; 1 is full summer leaf. */
  readonly leafiness: number
  /** 0 is green, 1 turns the crown to russet and gold. */
  readonly autumn: number
  readonly seed: number
}

export const oakTreeDefaults: OakTreeConfig = {
  height: 7,
  spread: 1.3,
  // 0.037, straight off the reference: the bole measured 0.073 of the tree's
  // height ACROSS at the point where it has finished flaring.
  bole: 0.037,
  limbs: 9,
  leafiness: 1,
  autumn: 0,
  seed: 11,
}

export type OakTreeParts = 'trunk' | 'boughs' | 'crown'

export function createModel(overrides: Partial<OakTreeConfig> = {}) {
  return createKitModel<OakTreeConfig, 'oak' | 'leaf', OakTreeParts>({
    id: 'oak-tree',
    defaults: oakTreeDefaults,
    slots: ['oak', 'leaf'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.max(0.5, config.height)
      const R = Math.max(0.004, config.bole) * H
      const crownR = (Math.max(0.2, config.spread) * H) / 2
      const leafiness = Math.max(0, Math.min(1, config.leafiness))
      const autumn = Math.max(0, Math.min(1, config.autumn))
      const limbCount = Math.max(3, Math.min(14, Math.round(config.limbs)))

      /**
       * How far a limb turns from root to tip, in radians.
       *
       * It is an ANGLE rather than a curvature so that every limb turns by the
       * same amount whatever its length: a short top limb and a long bottom
       * one then read as the same tree. 0.42 rad is 24 degrees, which is what
       * the reference's limbs do between leaving the bole and their outer end.
       */
      const SWEEP = 0.42

      /**
       * The measured taper, as (height fraction, radius in bole radii).
       *
       * These are not shaped by eye. Each pair is a row read off the winter
       * photograph by finding the run of trunk pixels at that height, and the
       * profile they make is the whole character of the bole: a violent flare
       * in the bottom twentieth, then a shaft that hardly tapers for a quarter
       * of the tree, then a steady run out to nothing at 78%.
       */
      const TAPER: ReadonlyArray<readonly [number, number]> = [
        [0.00, 1.95],
        [0.02, 1.76],
        [0.06, 1.14],
        [0.11, 1.00],
        [0.38, 0.94],
        [0.50, 0.71],
        [0.62, 0.50],
        [0.74, 0.16],
      ]
      const trunkTop = H * TAPER[TAPER.length - 1]![0]

      /** The bole's radius at a height, so a limb can be sized to where it grows. */
      const boleAt = (y: number): number => {
        const f = y / H
        for (let i = 0; i < TAPER.length - 1; i += 1) {
          const [f0, r0] = TAPER[i]!
          const [f1, r1] = TAPER[i + 1]!
          if (f <= f1) {
            const t = (f - f0) / (f1 - f0)
            return R * (r0 + (r1 - r0) * Math.max(0, Math.min(1, t)))
          }
        }
        return R * TAPER[TAPER.length - 1]![1]
      }

      /**
       * Foliage colour. Green at `autumn` 0, russet and gold at 1.
       *
       * The turn is a HUE ROTATION of the same measured green rather than a
       * second palette entry, because that is what happens in the leaf: the
       * chlorophyll goes and what was already underneath it shows. Saturation
       * climbs with it — an autumn oak is a more saturated object than a
       * summer one, which is the opposite of what fading suggests.
       */
      const leafColour = (lift: number): Color => {
        const c = tint('leaf', lift, 1)
        // Darker clumps are MORE saturated, which is the measurement and is the
        // opposite of the intuition that shadow drains colour: across the
        // reference the darkest tenth of the crown reads 0.44 saturation and
        // the lightest 0.32. A highlight on a leaf is a specular reflection of
        // a white sky, and it washes the green out of it.
        // -0.145 of a turn, which is 52 degrees, taking the measured green at
        // 78 down to 26: RUSSET. The first attempt turned it 41 degrees to
        // amber and lifted the lightness, and an oak came out of it the colour
        // of a lemon. An oak in October is a dark red-brown -- it goes DOWN in
        // value as well as round in hue, which is why the lightness term is
        // negative here and was the thing that made the difference.
        c.offsetHSL(-0.145 * autumn, -lift * 0.55 + 0.14 * autumn, -0.03 * autumn)
        return c
      }

      // --- The bole ---------------------------------------------------------
      const trunk = latheGeometry(
        TAPER.map(([f, r]) => ({ y: H * f, radius: R * r })) as Level[],
        // Capped at BOTH ends. Leaving the top open was the obvious economy --
        // the crown's own clumps swallow it -- but `leafiness: 0` takes the
        // crown away and leaves you looking down an open pipe.
        8, [0, 0, 0], tint('bark', -0.02, 0.8),
      )
      roughenGeometry(trunk, R * 0.3, { salt: 9, scaleY: 0.4 })

      /**
       * Put the foot back on the floor.
       *
       * `roughenGeometry` moves every corner by its own position, the bottom
       * ring included, so a roughened trunk ends up standing on five points
       * with daylight between them and its lowest vertex a few centimetres
       * underground. Neither is visible in a render and both are wrong. The
       * bole is the only thing in this model that touches the ground, so its
       * foot is flattened back to exactly zero afterwards — the flare keeps
       * every bit of its irregularity above that line.
       */
      const plant = (geometry: BufferGeometry, below: number): void => {
        const position = geometry.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          if (position.getY(i) < below) position.setY(i, 0)
        }
        position.needsUpdate = true
        geometry.computeVertexNormals()
      }
      plant(trunk, R * 0.4)

      // --- Limbs ------------------------------------------------------------
      const wood: BufferGeometry[] = []
      const crown: BufferGeometry[] = []

      /**
       * One faceted clump of leaves.
       *
       * A lathe whose profile is a circle, so the poles close to a point and
       * need no caps: five levels by six segments is 36 triangles, which is
       * what makes it affordable to hang three dozen of them in a crown. The
       * per-level radius jitter matters more than it looks — without it every
       * clump is the same ball at a different size and the crown reads as
       * bubbles.
       */
      const clump = (radius: number, at: readonly [number, number, number], lift: number): BufferGeometry => {
        // Three rings, not four: a hexagonal barrel with a point at each end,
        // 24 triangles. Halving the cost per clump is what pays for there
        // being half again as many of them, and more smaller clumps is what
        // makes a crown of LOBES instead of one lump.
        const rings = 3
        const levels: Level[] = []
        for (let i = 0; i <= rings; i += 1) {
          const t = i / rings
          const profile = Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2)))
          levels.push({
            // Squat: a clump of leaves is wider than it is deep, because it
            // grows out along a branch rather than around it.
            y: at[1] + radius * 0.78 * (2 * t - 1),
            radius: radius * profile * (0.84 + random() * 0.34),
          })
        }
        // Five sides, not six. The kit's budget is 2500 triangles a model and
        // this one has to buy sixty-odd clumps with it; a side costs four
        // triangles across every clump in the crown, and at this size nobody
        // counts them. What the budget must not buy is fewer clumps, because
        // the clump count is what holds the crown together.
        return latheGeometry(levels, 5, [at[0], 0, at[2]], leafColour(lift))
      }

      /**
       * Sized to MERGE, not to look right on its own.
       *
       * At 0.185 of the crown radius the clumps came out as fourteen separate
       * balls -- and not as a judgement call: voxelising the crown and flood
       * filling it found four disconnected pieces, three of them single limb
       * ends floating clear of the mass. A crown is one piece.
       *
       * 0.27 fixed that and overshot into the other failure: one smooth lump
       * with a notch in it, because clumps a quarter of the crown across leave
       * no room for the crown to have parts. The answer is not a radius at all
       * but a COUNT -- more, smaller clumps gathered per limb, so each limb
       * carries its own lobe and the lobes meet at seams instead of dissolving
       * into each other. Which is how the reference is built, one mass of
       * foliage to each big bough.
       */
      const clumpR = crownR * 0.23 * (0.55 + 0.45 * leafiness)
      // The tips stop short of the crown radius by most of a clump, so that
      // `spread` describes the width of the FINISHED crown rather than of the
      // bare branchwork inside it.
      const reach = crownR - clumpR * 0.8

      for (let i = 0; i < limbCount; i += 1) {
        const f = limbCount === 1 ? 0 : i / (limbCount - 1)
        /**
         * Limbs crowd towards the BOTTOM of their range.
         *
         * Spaced evenly up the bole, the crown's mass began at 29% of the
         * height while two long bottom limbs carried their leaves out at 10%
         * to 30% with nothing around them -- and the flood fill found exactly
         * that: a 7000-cell piece at bearing 228-313 degrees, reaching 5.7 m
         * out where the main mass stopped at 4.5, torn off vertically rather
         * than sideways. Two rounds of widening clumps and evening out the
         * bearings had each failed because neither was the gap.
         *
         * The reference is at full width by 24% of its height and holds it to
         * 44%, which means most of its limbs are in the bottom half. Raising f
         * to a power puts them there: nine limbs land at 30, 33, 36, 41, 47,
         * 53, 59, 64 and 70% instead of evenly every 5%.
         */
        const g = Math.pow(f, 1.35)
        const ay = H * (0.24 + 0.44 * g) + jitter(random, H * 0.015)
        const ty = H * (0.34 + 0.54 * g) + jitter(random, H * 0.02)

        // Driven by g, the same crowded parameter the heights use, so that a
        // limb low on the bole is also a LONG one -- which is the reference's
        // arrangement and the reason its crown is widest near the bottom.
        // Leaving this on the even f while the heights moved to g put the
        // widest row up at 54%.
        //
        // And the spread narrowed from +/-12% to +/-6%: at 12% the single
        // longest limb reached 5.6 m where its neighbours stopped at 4.5, and
        // its lobe was stranded out there on its own with nothing to touch. It
        // is the same tear the flood fill kept finding, and no amount of
        // widening the clumps reaches across a gap made by one limb outrunning
        // the rest -- the fix is for it not to outrun them.
        const tr = reach * (1 - 0.8 * g) * (0.94 + random() * 0.12)

        // Straight from the geometry, not chosen: a limb whose tip lands level
        // with its own root is horizontal, and atan2 says so without any
        // special case.
        //
        // Plus HALF THE SWEEP, which is the part I had missed. Bending a limb
        // does not just curve it, it swings the whole chord from root to tip up
        // by half the arc -- so a limb aimed at its intended tip and then bent
        // lands well above it. Every limb was arriving 0.21 rad high and the
        // crown's widest point had climbed from the 24% of the reference to
        // 38%. Aiming low by exactly the amount the bend will lift is the
        // whole correction, and it is a constant because SWEEP is an angle.
        const rise = ty - ay
        const tilt = Math.atan2(tr, rise) + SWEEP / 2
        const len = Math.hypot(tr, rise)

        const local: BufferGeometry[] = []
        const leaves: BufferGeometry[] = []

        // 0.85 of the bole where it grows, not 0.55. A main limb on the
        // reference is very nearly as thick as the trunk it leaves, and thin
        // limbs are invisible under the crown -- which cost the model the
        // whole radiating structure that says "tree" before the leaves do.
        const r0 = boleAt(ay) * 0.85
        const limb = latheGeometry(
          [0, 0.25, 0.5, 0.75, 1].map((t, k) => ({
            y: len * t,
            radius: r0 * [1, 0.72, 0.52, 0.36, 0.22][k]!,
          })) as Level[],
          // Not lifted. A bough lifted above the bole's own tone came out
          // sandy next to it, which is invisible under a full crown and is the
          // entire model at `leafiness: 0`.
          5, [0, 0, 0], tint('bark', -0.02, 0.9),
        )
        local.push(limb)

        /**
         * Everything for this limb is built along +Y with its foot at the
         * ORIGIN, and only turned into place at the end.
         *
         * That is what makes the forks and the clumps free: they are placed in
         * the limb's own frame, where "along the branch" is just +Y, and the
         * bend and the two rotations are then applied to the whole assembly at
         * once. Nothing can come adrift from the limb it belongs to, because
         * nothing is ever positioned in world space.
         *
         * It also means the limb's foot sits ON the trunk's axis, buried a
         * whole bole radius inside the bole. There is no join to get wrong.
         */
        const forks = 2
        for (let j = 0; j < forks; j += 1) {
          // Outboard. At 0.58 the first fork threw its leaves back towards
          // the trunk and packed the space around the bole solid, so the crown
          // came down as an unbroken dome and the tree lost the one thing that
          // separates it from a bush: you could not see the bole rise into it.
          const at = len * (0.62 + 0.23 * j)
          // Always positive, and that is the whole of the fix.
          //
          // The rise of a fork works out as sin(splay) * sin(spin), so it is
          // the SIGN OF THE PRODUCT that decides up or down. Constraining the
          // spin to the upper half circle and then alternating the splay
          // between + and - left every second fork pointing at the floor -- and
          // the measurement said so plainly while the reasoning had said the
          // opposite. With the splay kept positive the spin alone carries the
          // variety, and it still swings the fork right round through the
          // horizontal because cos(spin) runs from +1 to -1 across the range.
          const splay = 0.42 + random() * 0.26
          /**
           * Which way the fork throws, and it may not throw DOWNWARD.
           *
           * Spun freely through the whole circle, a fork on a near-horizontal
           * bottom limb can come off 39 degrees below the horizontal, drop the
           * best part of a metre, and hang its clump on the floor -- which is
           * how the crown came to be 7 m wide at 2% of the tree's height, where
           * the reference has nothing but bare bole.
           *
           * In the limb's own frame +Z is the direction `rotateX` will send
           * upward, so keeping the spin inside (0, PI) keeps the fork's rise
           * positive whatever the limb is doing. Side shoots on a real bough
           * grow up and out; none of them grow down.
           */
          const spin = Math.PI / 2 + jitter(random, 1.5)
          const secLen = len * (0.34 - 0.1 * j) * (0.8 + random() * 0.4)
          const secR = r0 * (0.42 - 0.12 * j)

          // Three levels on four sides: a fork is short, half buried in the
          // clump on its end, and never seen in silhouette. It is the cheapest
          // thing in the model to make cheaper.
          const sec = latheGeometry(
            [0, 0.55, 1].map((t, k) => ({
              y: secLen * t,
              radius: secR * [1, 0.5, 0.2][k]!,
            })) as Level[],
            4, [0, 0, 0], tint('bark', 0.0, 0.9),
          )
          sec.rotateZ(splay)
          sec.rotateY(spin)
          sec.translate(0, at, 0)
          local.push(sec)

          if (leafiness > 0) {
            // The tip, worked out rather than guessed: rotateZ then rotateY
            // sends +Y to this direction, and a clump centred there is
            // guaranteed to contain the branch end it hangs on.
            const dir: readonly [number, number, number] = [
              -Math.sin(splay) * Math.cos(spin),
              Math.cos(splay),
              Math.sin(splay) * Math.sin(spin),
            ]
            const tip: readonly [number, number, number] = [
              dir[0] * secLen, at + dir[1] * secLen, dir[2] * secLen,
            ]
            for (let k = 0; k < 2; k += 1) {
              const r = clumpR * (0.78 + random() * 0.5)
              // Offsets stay inside the clump's own radius, so consecutive
              // clumps always overlap and the branch tip is always inside one.
              leaves.push(clump(r, [
                tip[0] + jitter(random, r * 0.5),
                tip[1] + jitter(random, r * 0.45),
                tip[2] + jitter(random, r * 0.5),
              ], jitter(random, 0.09)))
            }
          }
        }

        if (leafiness > 0) {
          /**
           * Along the bough, INCLUDING well inboard.
           *
           * 0.38 is the one that matters and it took four failed rounds to
           * arrive at. The crown kept coming apart into two pieces, and every
           * attempt to close the gap treated it as a gap between LOBES --
           * wider clumps, evener bearings, more limbs, less length jitter --
           * none of which worked, because the crown was never short of foliage
           * where those fixes put it.
           *
           * What was missing was the middle. I had pushed the leaves outboard
           * to open up the space under the crown and taken the inside out with
           * it, so nine lobes hung off a bare hub with nothing joining them.
           * Looking at the reference again: its crown is FULL from the bole
           * outward, and the clear space is underneath, not within. An inner
           * clump on every bough gives them all a common core, and it is
           * guaranteed to work rather than tuned to, because every bough passes
           * through the middle.
           */
          for (const along of [0.38, 0.8, 0.95]) {
            const r = clumpR * (0.85 + random() * 0.45)
            leaves.push(clump(r, [
              jitter(random, r * 0.55), len * along + jitter(random, r * 0.3), jitter(random, r * 0.55),
            ], jitter(random, 0.09)))
          }
        }

        /**
         * Bend, then tilt, then spin — in that order and no other.
         *
         * `bendGeometry` only curves toward +Z, so the tilt has to be a
         * rotation about X: `rotateX(-tilt)` lays the limb over toward -Z while
         * the bend is pushing toward +Z, and the two opposing each other is
         * exactly the oak profile — out near horizontal, then turning up at the
         * end. Tilting about Z instead would have left the bend pointing
         * sideways out of the limb's own plane, and the limb would have curved
         * ACROSS rather than up.
         *
         * The arc angle is `curvature * length`, so a fixed sweep divided by
         * the length gives every limb the same 24 degrees of turn whatever its
         * size — which is what keeps a short top limb looking like the same
         * tree as a long bottom one.
         */
        const curvature = SWEEP / len
        /**
         * Evenly divided, not the golden angle.
         *
         * The golden angle is the right answer for a great many leaves and the
         * wrong one for nine limbs: it is uniform in the limit, but at this
         * count it left azimuth gaps ranging from 17 to 52 degrees, and the
         * widest gap was where the crown tore into two pieces. An even
         * division gives every gap 40 degrees, and the jitter keeps it from
         * looking like a wheel.
         */
        const spin = (i / limbCount) * Math.PI * 2 + jitter(random, 0.3)
        for (const group of [local, leaves]) {
          if (group.length === 0) continue
          const merged = mergeColoured(group)
          bendGeometry(merged, curvature)
          merged.rotateX(-tilt)
          merged.rotateY(spin)
          merged.translate(0, ay, 0)
          ;(group === local ? wood : crown).push(merged)
        }
      }

      // The leader: the bole's own top, which is a branch tip like any other
      // and gets its clump for the same reason.
      if (leafiness > 0) {
        // Two, sitting lower. Three clumps perched a third of a radius above
        // the bole's tip put a cap on the crown, and the profile showed it:
        // our top rows measured 0.63 and 0.55 of our widest against the
        // reference's 0.46 and 0.35. An oak tapers to its top; it does not
        // finish in a knob.
        for (let i = 0; i < 2; i += 1) {
          const r = clumpR * (0.8 + random() * 0.4)
          crown.push(clump(r, [
            jitter(random, r * 0.9),
            trunkTop + r * 0.1 + jitter(random, r * 0.35),
            jitter(random, r * 0.9),
          ], jitter(random, 0.09)))
        }
      }

      const boughs = mergeColoured(wood)
      roughenGeometry(boughs, R * 0.09, { salt: 17 })
      const leaves = crown.length > 0 ? mergeColoured(crown) : undefined

      /**
       * Make `height` mean the height.
       *
       * Everything above is laid out in fractions of H, but the clumps sit
       * PROUD of the tips they hang on, so the finished tree overshot by 8%
       * and the control was quietly lying. Rather than shave the numbers that
       * came off the reference until they happen to land right -- which would
       * have to be redone for every change to the clump size -- the assembly
       * is measured and scaled to fit. Uniformly, so that every ratio the
       * references gave survives it.
       */
      const all = [trunk, boughs, ...(leaves ? [leaves] : [])]
      let low = Infinity
      let high = -Infinity
      for (const g of all) {
        const position = g.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          const y = position.getY(i)
          if (y < low) low = y
          if (y > high) high = y
        }
      }
      const grown = high - low
      if (grown > 1e-6) {
        const k = H / grown
        for (const g of all) {
          g.scale(k, k, k)
          g.translate(0, -low * k, 0)
          g.computeVertexNormals()
        }
      }

      /**
       * And make `spread` mean the spread, the same way.
       *
       * A uniform scale fixes the height but cannot fix the width, because the
       * crown's width is not 2x its radius: seven limbs on a golden-angle
       * spiral never put two of them opposite each other, so the bounding box
       * is always narrower than the reach that produced it -- 1.12 against the
       * 1.30 asked for. The shortfall depends on the limb count, so it cannot
       * be a constant either.
       *
       * The stretch is horizontal only and it is applied to the LIMBS AND THE
       * CROWN, never to the bole: stretching the trunk would throw away the one
       * profile in this model that was read off a photograph row by row. It
       * cannot pull anything loose, because every limb's foot sits exactly on
       * the axis and a scale about the axis leaves the axis where it is.
       */
      const spread = [boughs, ...(leaves ? [leaves] : [])]
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
      for (const g of spread) {
        const position = g.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          const x = position.getX(i)
          const z = position.getZ(i)
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (z < z0) z0 = z
          if (z > z1) z1 = z
        }
      }
      // The EXTENT, not the radius. Scaling until the furthest tip sat at the
      // crown radius left the tree at 1.10 for 1.30 asked, because the furthest
      // tip has nothing opposite it -- which is the very asymmetry this is here
      // to correct for. The width of a thing is max minus min.
      const widest = Math.max(x1 - x0, z1 - z0)
      if (widest > 1e-6) {
        const kx = (Math.max(0.2, config.spread) * H) / widest
        for (const g of spread) {
          g.scale(kx, 1, kx)
          g.computeVertexNormals()
        }
      }

      /**
       * Break the crown's outline up, or it is a pile of boulders.
       *
       * This is the difference between foliage and rock and it is a
       * SILHOUETTE property, not a colour one. A clump built as a six-sided
       * lathe has a smooth, regular outline, and a smooth outline at this
       * scale reads as stone however green it is -- the first render of this
       * crown looked like a cairn with moss on it. Roughening the merged crown
       * ragged-edges every facet, and because the shift is derived from each
       * corner's own position the surface stays closed and the clumps stay
       * fused into the one mass they were sized to make.
       *
       * It goes AFTER both scalings so the amount is in finished metres.
       */
      if (leaves) {
        roughenGeometry(leaves, clumpR * 0.17, { salt: 31 })
      }

      return {
        trunk: { slot: 'oak' as const, geometry: trunk },
        boughs: { slot: 'oak' as const, geometry: boughs },
        // Explicitly `undefined` when bare, never omitted. The kit resets a
        // part's anchor before it checks whether there is anything to put in
        // it, so a key that is present and undefined empties the crown --
        // where a MISSING key would never be visited and last build's leaves
        // would still be hanging there.
        crown: leaves ? { slot: 'leaf' as const, geometry: leaves } : undefined,
      }
    },
  }, overrides)
}
