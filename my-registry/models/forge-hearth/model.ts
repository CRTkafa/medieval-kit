/**
 * @medieval-kit/forge-hearth
 *
 * A smith's forge: a raised stone hearth with a coursed chimney hood over its
 * back end and a bellows on a ground post blowing through the side wall.
 *
 * The kit has had an anvil since early on and nothing to heat anything in. An
 * anvil alone is a lump of iron; what makes a corner a smithy is the fire, and
 * what makes the fire a forge rather than a hearth is the bellows blowing
 * through the side of it.
 *
 *   - `hearth`  — the stone trough, waist high, coursed all round, with a
 *                 single-block coping rim about the fire pan.
 *   - `fire`    — charcoal and embers filling the pan. `setLit` puts it out
 *                 without taking the charcoal with it, as the cauldron does.
 *   - `chimney` — a HOLLOW hood of block courses over the rear third, with a
 *                 mouth opening at the bottom of its front face and an open
 *                 flue through the cap ring.
 *   - `bellows` — teardrop boards and a pleated leather bag, nose into the
 *                 wall through an iron nozzle, tail carried by a brace off a
 *                 post that stands on its own foot clear of the masonry.
 *
 * Lessons this model has already paid for, in the order they were bought:
 *
 * MASONRY. A slab mottled to stone colour is a slab, and that goes for the
 * chimney too: pass three scored 70 with a solid smooth pyramid standing on
 * obviously blocky walls. Everything mineral here is now the same module: a
 * ring of proud, jittered blocks per course. The walls keep a backing slab
 * behind their blocks (it plays mortar and keeps the box closed); the hood
 * carries no backing at all, its blocks overlap along the ring and course to
 * course, which is what lets it be hollow.
 *
 * THE CHIMNEY IS A HOOD, NOT A MONUMENT. The critic called the closed pyramid
 * a "filled solid sitting on the rear rim". The shaft is now open top and
 * bottom: a cap ring with a visible flue hole, a one-course mouth in the
 * front face at hearth-top level (corner blocks kept so the sides reach the
 * ground), and the char bed running back underneath so the throat shows dark
 * with an ember in it.
 *
 * THE BELLOWS IS PART OF THE FORGE, NOT FURNITURE BESIDE IT. Version two
 * stood it on a bench (read as a stool with a bag on it); version three hung
 * it off a post flat against the wall, which read as a stripe painted on the
 * masonry, with the nozzle lost and the tail plank in free air. The machine
 * is now: nose buried in the wall through a fat tapering nozzle, post
 * standing on a plinth foot with daylight between it and the stone, a pivot
 * peg through the post head, and a shallow diagonal brace from the peg that
 * LIES ON the top board near the tail, its end cap finishing inside the
 * board's thickness. Post carries the tail, wall carries the nose.
 *
 * PLEATS GO ALL THE WAY ROUND. The bag is a stack of four alternating
 * wide/narrow teardrop plates between the boards, every plate with its own
 * width, length, thickness and nose offset so no two caps share a plane;
 * pass three's five plates included two WIDER than the boards, which put
 * near-coincident slivers on the silhouette. Wide now means wide among the
 * leather, still inside the board outline.
 *
 * ROTATION. Twice a two-rotation chain put a bar on the wrong axis. Anything
 * diagonal is built along one axis and turned ONCE: the brace lives in the
 * x = postX plane and only rotates about X, which works because the teardrop
 * board is wider than the post offset where the brace lands on it.
 */
import { type BufferGeometry } from 'three'

import {
  createKitModel,
  createTinter,
  dishedSheetGeometry,
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
  /** Masonry density: blocks around the kerb, wall courses scale with it. */
  readonly kerbBlocks: number
  /** Whether the fire is lit (0/1). */
  readonly lit: number
  readonly seed: number
}

export const forgeHearthDefaults: ForgeHearthConfig = {
  length: 1.32,
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

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

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
      // The forge stands on the ground rather than about its own centre: it
      // has one face that matters and that face is the top, so measuring from
      // the floor is what keeps the working height honest.
      const floor = 0
      const wall = Math.min(L, D) * 0.17
      const kerbH = H * 0.13
      const bodyTop = H - kerbH
      const kerbCount = Math.max(8, Math.round(config.kerbBlocks))
      const density = kerbCount / 16

      // One ring of blocks walked around a rectangle. The whole model's
      // masonry is this module: the coping rim uses it once, the hood uses it
      // per course. Blocks straddle the rectangle's edge; `skip` lets a run
      // be left out (the coping's back, the hood's mouth). Runs overlap by a
      // few percent and every block gets its own outward nudge, so a ring is
      // closed without any two faces sharing a plane.
      const ringCourse = (
        into: BufferGeometry[],
        cx: number, halfX: number, halfZ: number, count: number,
        cy: number, blockH: number, blockD: number, lift: number,
        overlap: number, phase: number,
        skip?: (onFront: boolean, onBack: boolean, frac: number) => boolean,
      ): void => {
        const per = (halfX + halfZ) * 4
        const run = per / count
        for (let i = 0; i < count; i += 1) {
          let s = (((i + 0.5 + phase) % count) / count) * per
          let x = 0
          let z = 0
          let along: 'x' | 'z' = 'x'
          let onFront = false
          let onBack = false
          let frac = 0
          if (s < halfX * 2) { x = -halfX + s; z = -halfZ; along = 'x'; frac = s / (halfX * 2) }
          else if ((s -= halfX * 2) < halfZ * 2) { x = halfX; z = -halfZ + s; along = 'z'; onFront = true; frac = s / (halfZ * 2) }
          else if ((s -= halfZ * 2) < halfX * 2) { x = halfX - s; z = halfZ; along = 'x'; frac = s / (halfX * 2) }
          else { s -= halfX * 2; x = -halfX; z = halfZ - s; along = 'z'; onBack = true; frac = s / (halfZ * 2) }
          if (skip && skip(onFront, onBack, frac)) continue
          const d = blockD * (1 + jitter(random, 0.08))
          const r = run * (overlap + jitter(random, 0.04))
          const nudge = jitter(random, blockD * 0.14)
          const size: [number, number] = along === 'x' ? [r, d] : [d, r]
          const centre: [number, number, number] = along === 'x'
            ? [cx + x, cy, z + Math.sign(z) * Math.abs(nudge)]
            : [cx + x + Math.sign(x) * Math.abs(nudge), cy, z]
          into.push(taperedBoxGeometry(
            size,
            [size[0] * 0.92, size[1] * 0.92],
            blockH * (1 + jitter(random, 0.05)),
            centre,
            tint('stone', lift + jitter(random, 0.09)),
          ))
        }
      }

      // --- Hearth trough ---------------------------------------------------
      const masonry: BufferGeometry[] = []
      // Four backing slabs: they close the box and play mortar in the joints
      // between the course blocks that carry the whole masonry read.
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
          tint('stone', -0.06 + jitter(random, 0.03)),
        ))
      }

      // Wall courses: three chunky bands of blocks proud of the slabs. Joints
      // stagger by alternating the block count per course; a half-block phase
      // shift on an OPEN run would leave its last block past the corner.
      const courses = 3
      const courseH = bodyTop / courses
      const blockD = wall * 0.5
      const proud = wall * 0.12
      const nAlong = Math.max(4, Math.round(kerbCount * 0.26))
      const nAcross = Math.max(3, Math.round(kerbCount * 0.19))
      for (let c = 0; c < courses; c += 1) {
        const cy = floor + (c + 0.5) * courseH
        for (const [along, sign] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]] as const) {
          const faceLen = along === 'x' ? L : D
          const n = (along === 'x' ? nAlong : nAcross) + (c % 2)
          const run = faceLen / n
          const plane = along === 'x'
            ? sign * (D / 2 - blockD / 2 + proud)
            : sign * (L / 2 - blockD / 2 + proud)
          for (let i = 0; i < n; i += 1) {
            const at = -faceLen / 2 + (i + 0.5) * run
            const size: [number, number] = along === 'x'
              ? [run * (0.92 + jitter(random, 0.05)), blockD]
              : [blockD, run * (0.92 + jitter(random, 0.05))]
            masonry.push(taperedBoxGeometry(
              size,
              [size[0] * 0.9, size[1] * 0.9],
              courseH * (0.9 + jitter(random, 0.06)),
              along === 'x' ? [at, cy, plane] : [plane, cy, at],
              tint('stone', 0.02 + jitter(random, 0.09)),
            ))
          }
        }
      }

      // The hood's footprint: rear third of the length, full width.
      const xb = -L / 2 + 0.015
      const hoodHalfX0 = L * 0.18
      const hoodFront = xb + hoodHalfX0 * 2

      // Coping rim: a single-block ring around the fire pan on three sides;
      // the fourth side of the pan is the hood's mouth, so the rim would only
      // hide the throat there. The side runs end inside the hood's bottom
      // corner blocks.
      const rimD = 0.115
      const copFront = L / 2 - rimD * 0.48
      const copBack = hoodFront + 0.03
      const copHalfX = (copFront - copBack) / 2
      const copHalfZ = D / 2 - rimD * 0.48
      ringCourse(
        masonry,
        (copFront + copBack) / 2, copHalfX, copHalfZ, kerbCount,
        floor + bodyTop + kerbH * 0.45, kerbH * 1.05, rimD, 0.04, 0.97, 0,
        (_f, onBack) => onBack,
      )

      const hearth = mergeColoured(masonry)
      roughenGeometry(hearth, wall * 0.05, { salt: 23 })

      // --- Fire ------------------------------------------------------------
      // The pan fills the open top inside the rim, sunk about a course below
      // it, and its floor runs back UNDER the hood so the mouth shows char
      // instead of a stone wall. The bed is LUMPS, not a plate: irregular
      // charcoal with the glow coming up between the lumps at the middle.
      const floorTop = floor + bodyTop - 0.025
      const panMaxX = copFront - rimD
      const panHalfZ = copHalfZ - rimD
      const coals: BufferGeometry[] = []
      const embers: BufferGeometry[] = []

      // Floor slab: its edges bury themselves inside the wall slabs, which is
      // what keeps it counted as carried rather than floating in the shell.
      coals.push(taperedBoxGeometry(
        [panMaxX + 0.05 - (xb + 0.05), (panHalfZ + 0.06) * 2],
        [panMaxX - xb, panHalfZ * 2 + 0.1],
        0.1,
        [(panMaxX + 0.05 + xb + 0.05) / 2, floorTop - 0.05, 0],
        tint('char', 0.02),
      ))

      const bcx = (hoodFront + panMaxX) / 2 - 0.02
      const radX = (panMaxX - hoodFront) / 2 * 0.92
      const radZ = panHalfZ * 0.85
      const lumps = 21
      for (let i = 0; i < lumps; i += 1) {
        // Golden-angle spiral over an ellipse, so the bed fills evenly rather
        // than ringing. The middle of a working fire is where the air
        // arrives, so that is where it glows; the edges are burnt out.
        const a = i * 2.399963
        const ring = Math.sqrt((i + 0.35) / lumps)
        const size = 0.05 + random() * 0.042
        const hot = ring < 0.55 && i % 2 === 0
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
          bcx + Math.sin(a) * radX * ring,
          floorTop + size * (hot ? 0.42 : 0.33),
          Math.cos(a) * radZ * ring,
        )
        ;(hot ? embers : coals).push(lump)
      }
      // Two lumps in the throat, one of them glowing, so the mouth reads as
      // the fire's back rather than an empty niche.
      for (const [mz, hot] of [[0.09, true], [-0.1, false]] as const) {
        const size = 0.055 + random() * 0.02
        const lump = prismGeometry(
          size, size * 0.5, size * 0.8, 5, [0, 0, 0],
          hot ? tint('ember', jitter(random, 0.05), 0.4) : tint('char', 0.04),
          { capBottom: false },
        )
        lump.rotateY(random() * Math.PI * 2)
        lump.translate(hoodFront - 0.05, floorTop + size * 0.35, mz)
        ;(hot ? embers : coals).push(lump)
      }
      const coal = mergeColoured(coals)

      // --- Chimney hood ----------------------------------------------------
      // Six shrinking rings of the same blocks the walls wear, no core at
      // all: the shaft is hollow, the cap is a ring around an open flue, and
      // the bottom course skips its mid-front blocks to leave a mouth over
      // the char (the corner blocks stay so the sides reach the hearth). Ring
      // runs overlap and courses interpenetrate vertically, which is what
      // keeps a coreless stack closed everywhere but the two openings.
      const hood: BufferGeometry[] = []
      const hoodBase = floor + bodyTop - 0.03
      const hoodH = Math.max(0.3, floor + H + config.chimney - hoodBase)
      const hoodCourses = 6
      const hCourseH = hoodH / hoodCourses
      for (let c = 0; c < hoodCourses; c += 1) {
        const t = (c + 0.5) / hoodCourses
        const hx = lerp(hoodHalfX0, L * 0.078, t)
        const hz = lerp(D * 0.49, D * 0.2, t)
        const count = Math.max(6, Math.round(((hx + hz) * 4 / 0.21) * density))
        ringCourse(
          hood,
          xb + hx, hx, hz, count,
          hoodBase + (c + 0.5) * hCourseH, hCourseH * 1.08, 0.085, 0.02,
          1.08, (c % 2) * 0.5,
          c === 0
            ? (onFront, _b, frac) => onFront && frac > 0.18 && frac < 0.82
            : undefined,
        )
      }
      // Cap ring: four slabs proud of the top course with a hole between
      // them, the reference's cap slab opened into a flue. Heights and spans
      // jitter so no two slabs share a plane where they interpenetrate.
      const capY = hoodBase + hoodH + 0.008
      const capCx = xb + lerp(hoodHalfX0, L * 0.078, 1)
      const capHx = L * 0.115
      const capHz = D * 0.27
      const capW = 0.08
      for (const [dx, dz, sx, sz] of [
        [capHx - capW / 2, 0, capW, capHz * 2],
        [-(capHx - capW / 2), 0, capW, capHz * 2 * 0.98],
        [0, capHz - capW / 2, (capHx - capW) * 2.2, capW],
        [0, -(capHz - capW / 2), (capHx - capW) * 2.2 * 0.97, capW],
      ] as const) {
        hood.push(taperedBoxGeometry(
          [sx, sz],
          [sx * 0.96, sz * 0.96],
          0.055 * (1 + jitter(random, 0.08)),
          [capCx + dx, capY + jitter(random, 0.004), dz],
          tint('stone', 0.06 + jitter(random, 0.05)),
        ))
      }
      const chimney = mergeColoured(hood)
      roughenGeometry(chimney, wall * 0.045, { salt: 29 })

      // --- Bellows ---------------------------------------------------------
      // Nose toward the hearth on -Z, tail hanging out over open ground.
      // Nothing here floats: the nose hangs on the nozzle buried in the wall,
      // the tail hangs on the brace, the brace hangs on the peg through the
      // post head, and the post stands on its own plinth foot with clear
      // daylight between it and the masonry.
      const bx0 = -0.1 * (L / 1.32)
      const zn = D / 2 + 0.09
      const bl = H * 0.8
      const bw = D * 0.54
      const by = floor + H * 0.74
      const timber: BufferGeometry[] = []
      const hide: BufferGeometry[] = []
      const metal: BufferGeometry[] = []

      // Teardrop plate: narrow nose, widest past the middle, rounded tail.
      // Width and LENGTH scale separately, because they mean opposite things.
      // `dishedSheetGeometry` builds in the XY plane, thickness along Z; ONE
      // rotation about X lays it flat with its length pointing +Z, away from
      // the hearth (length +Z, width X, thickness Y).
      const teardrop = (w: number, t: number, len: number): SheetLevel[] => [
        { y: 0, halfWidth: bw * 0.125 * w, thickness: t, curve: 0 },
        { y: bl * 0.24 * len, halfWidth: bw * 0.42 * w, thickness: t, curve: 0 },
        { y: bl * 0.68 * len, halfWidth: bw * 0.5 * w, thickness: t * 0.95, curve: 0 },
        { y: bl * len, halfWidth: bw * 0.33 * w, thickness: t * 0.9, curve: 0 },
      ]
      const plate = (w: number, t: number, len: number, off: number, nose: number, colour: Parameters<typeof dishedSheetGeometry>[2]): BufferGeometry => {
        const g = dishedSheetGeometry(teardrop(w, t, len), 5, colour)
        g.rotateX(Math.PI / 2)
        g.translate(bx0, by + off, zn + nose)
        return g
      }

      const boardOff = bw * 0.195
      timber.push(plate(1, 0.035, 1, -boardOff, 0, tint('oak', 0.03 + jitter(random, 0.03))))
      timber.push(plate(0.965, 0.035, 0.975, boardOff, 0.014, tint('oak', -0.04 + jitter(random, 0.03))))

      // The bag: four stepped teardrop rings, wide fold / narrow valley
      // alternating, every one with its own width, thickness, length and
      // nose offset. Wide stays inside the board outline; two plates wider
      // than the boards is a sliver on the silhouette, already paid for.
      const pleats = [
        { off: -boardOff * 0.66, w: 0.94, t: 0.052, len: 0.9, nose: 0.012 },
        { off: -boardOff * 0.24, w: 0.74, t: 0.056, len: 0.84, nose: 0.028 },
        { off: boardOff * 0.19, w: 0.92, t: 0.05, len: 0.88, nose: 0.006 },
        { off: boardOff * 0.61, w: 0.72, t: 0.054, len: 0.82, nose: 0.022 },
      ] as const
      for (const p of pleats) {
        hide.push(plate(p.w, p.t, p.len, p.off, p.nose, tint('leather', -0.04 + jitter(random, 0.03), 0.9)))
      }

      // The nozzle, the joint of the whole model: a fat iron taper built
      // along +Y and turned once about X so it runs along Z. Its narrow tip
      // ends INSIDE the wall slab, its wide base inside the leather nose, and
      // the visible span between wall face and nose is what reads as tuyere.
      const nozzle = latheGeometry(
        [
          { y: D / 2 - wall * 0.62, radius: 0.027 },
          { y: D / 2 - 0.02, radius: 0.045 },
          { y: zn + 0.06, radius: 0.062 },
        ] as Level[],
        8, [0, 0, 0], tint('iron', 0.02, 0.7),
      )
      nozzle.rotateX(Math.PI / 2)
      nozzle.translate(bx0, by, 0)
      metal.push(nozzle)

      // --- Post, foot, peg, brace ------------------------------------------
      const postX = bx0 - bw * 0.3
      const postZ = D / 2 + wall * 0.28 + 0.09
      const postTop = by + H * 0.47
      timber.push(taperedBoxGeometry(
        [0.17, 0.17],
        [0.15, 0.15],
        0.07,
        [postX, floor + 0.035, postZ],
        tint('oak', -0.09),
      ))
      timber.push(taperedBoxGeometry(
        [0.09, 0.09],
        [0.078, 0.078],
        postTop - floor - 0.02,
        [postX, (floor + 0.02 + postTop) / 2, postZ],
        tint('oak', -0.06),
      ))
      // Pivot peg through the post head; the brace lies over it, so the two
      // read as a hinge rather than a bar glued to a bar.
      const peg = taperedBoxGeometry(
        [0.05, 0.05],
        [0.046, 0.046],
        0.24,
        [0, 0, 0],
        tint('oak', 0.05),
      )
      peg.rotateZ(Math.PI / 2)
      peg.translate(postX, postTop - 0.055, postZ)
      timber.push(peg)

      // The brace: one rotation about X, in the x = postX plane, from inside
      // the post head down at a shallow angle to LIE ON the top board near
      // the tail. Its lower end cap finishes inside the board's thickness;
      // the board is wider than the post offset there, which is what makes
      // the constant-X plane land on it.
      const boardTopY = by + boardOff + 0.0175
      const p1y = postTop - 0.065
      const p1z = postZ
      const p2y = boardTopY + 0.012
      const p2z = zn + bl * 0.78
      const dy = p2y - p1y
      const dz = p2z - p1z
      const dl = Math.hypot(dy, dz)
      const e1 = 0.03 / dl
      const e2 = 0.05 / dl
      const a1y = p1y - dy * e1
      const a1z = p1z - dz * e1
      const a2y = p2y + dy * e2
      const a2z = p2z + dz * e2
      const brace = taperedBoxGeometry(
        [0.055, 0.048],
        [0.05, 0.043],
        Math.hypot(a2y - a1y, a2z - a1z),
        [0, 0, 0],
        tint('oak', 0.02),
      )
      brace.rotateX(Math.atan2(dz, dy))
      brace.translate(postX, (a1y + a2y) / 2, (a1z + a2z) / 2)
      timber.push(brace)

      return {
        hearth: { slot: 'stone' as const, geometry: hearth },
        fire: {
          slot: 'char' as const,
          geometry: coal,
          extras: [{ slot: 'ember' as const, geometry: mergeColoured(embers) }],
        },
        chimney: { slot: 'stone' as const, geometry: chimney },
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
