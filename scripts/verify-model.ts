/**
 * Verifies the built models without a browser.
 *
 * There are three classes of check:
 *
 *   1. Protocol — the parts of vibe3d's conformance list that can actually be
 *      tested: finite geometry, root and anchor identity preserved across
 *      configure(), a consumer attachment surviving the rebuild, material
 *      ownership, idempotent dispose().
 *   2. Winding — in hand-written geometry a reversed winding quietly leaves
 *      faces that are only visible from the inside. There are two criteria
 *      because there are two kinds of geometry: radial alignment for bodies
 *      of revolution, signed volume for closed solids.
 *   3. Z-fighting — surfaces on the same plane, facing the same way, with
 *      overlapping areas.
 *
 * Run: bun scripts/verify-model.ts
 */
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three/webgpu'

import { findZFighting } from './zfight.ts'
import { findFloating } from './support.ts'
import { MODEL_META } from '../my-registry/meta.ts'
import { createModel as createGauge } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'
import { createModel as createCrate } from '@/models/medieval-kit/wooden-crate/model.ts'
import { createModel as createBucket } from '@/models/medieval-kit/wooden-bucket/model.ts'
import { createModel as createAnvil } from '@/models/medieval-kit/iron-anvil/model.ts'
import { createModel as createLadder } from '@/models/medieval-kit/wooden-ladder/model.ts'
import { createModel as createFence } from '@/models/medieval-kit/wooden-fence/model.ts'
import { createModel as createStool } from '@/models/medieval-kit/wooden-stool/model.ts'
import { createModel as createHoe } from '@/models/medieval-kit/wooden-hoe/model.ts'
import { createModel as createShovel } from '@/models/medieval-kit/wooden-shovel/model.ts'
import { createModel as createPitchfork } from '@/models/medieval-kit/wooden-pitchfork/model.ts'
import { createModel as createTable } from '@/models/medieval-kit/trestle-table/model.ts'
import { createModel as createWheel } from '@/models/medieval-kit/cart-wheel/model.ts'
import { createModel as createLogPile } from '@/models/medieval-kit/log-pile/model.ts'
import { createModel as createChest } from '@/models/medieval-kit/wooden-chest/model.ts'
import { createModel as createBench } from '@/models/medieval-kit/wooden-bench/model.ts'
import { createModel as createTorch } from '@/models/medieval-kit/pitch-torch/model.ts'
import { createModel as createBale } from '@/models/medieval-kit/hay-bale/model.ts'
import { createModel as createSack } from '@/models/medieval-kit/linen-sack/model.ts'
import { createModel as createBroom } from '@/models/medieval-kit/straw-broom/model.ts'
import { createModel as createTankard } from '@/models/medieval-kit/oak-tankard/model.ts'
import { createModel as createBell } from '@/models/medieval-kit/bronze-bell/model.ts'
import { createModel as createLantern } from '@/models/medieval-kit/iron-lantern/model.ts'
import { createModel as createSign } from '@/models/medieval-kit/tavern-sign/model.ts'
import { createModel as createBook } from '@/models/medieval-kit/leather-book/model.ts'
import { createModel as createPhial } from '@/models/medieval-kit/glass-phial/model.ts'
import { createModel as createPouch } from '@/models/medieval-kit/coin-pouch/model.ts'
import { createModel as createBasket } from '@/models/medieval-kit/wicker-basket/model.ts'

const failures: string[] = []
function expect(label: string, condition: boolean): void {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) failures.push(label)
}

/* ------------------------------------------------------------ measurement */

function inspect(root: Object3D) {
  let meshes = 0
  let triangles = 0
  let nonFinite = 0
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute('position')) return
    meshes += 1
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    triangles += (index ? index.count : position.count) / 3
    const array = position.array as ArrayLike<number>
    for (let i = 0; i < array.length; i += 1) if (!Number.isFinite(array[i])) nonFinite += 1
  })
  const size = new Box3().setFromObject(root).getSize(new Vector3())
  return {
    meshes,
    triangles,
    nonFinite,
    size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)] as [number, number, number],
  }
}

function worldTriangles(root: Object3D): Array<[Vector3, Vector3, Vector3]> {
  const out: Array<[Vector3, Vector3, Vector3]> = []
  root.updateWorldMatrix(true, true)
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute('position')) return
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    const count = index ? index.count : position.count
    for (let i = 0; i < count; i += 3) {
      out.push([0, 1, 2].map((k) => {
        const v = index ? index.getX(i + k) : i + k
        return object.localToWorld(new Vector3().fromBufferAttribute(position, v))
      }) as [Vector3, Vector3, Vector3])
    }
  })
  return out
}

/**
 * Bodies of revolution: the RADIAL faces of the outer shell must face outward.
 *
 * The definition of "outer shell" is critical. One radius threshold does not
 * work on a TAPERING body: in a cone-shaped bucket even the INNER surfaces high
 * on the wall are wider than the outer surfaces below, so they get counted as
 * "reversed winding" even though they rightly face inwards. That is why the
 * comparison is made by height: every triangle is compared against the largest
 * radius in its own height band.
 *
 * Tangential faces (the side faces of the staves) cannot be judged by this
 * criterion — the product is ~0 by definition and its sign is nothing but
 * floating point noise. They are filtered out and how many were filtered out is
 * reported; they are not dropped silently.
 */
function radialWinding(root: Object3D, shellRatio = 0.94) {
  const triangles = worldTriangles(root)
  if (triangles.length === 0) return { radial: 0, inward: 0, tangential: 0 }

  const centroids = triangles.map(([a, b, c]) => a.clone().add(b).add(c).divideScalar(3))
  let minY = Infinity
  let maxY = -Infinity
  for (const m of centroids) {
    minY = Math.min(minY, m.y)
    maxY = Math.max(maxY, m.y)
  }

  // Height bands: each band has its own widest radius.
  const BANDS = 12
  const span = Math.max(1e-9, maxY - minY)
  const bandOf = (y: number): number =>
    Math.min(BANDS - 1, Math.max(0, Math.floor(((y - minY) / span) * BANDS)))
  const bandMax = new Array<number>(BANDS).fill(0)
  for (const m of centroids) {
    const band = bandOf(m.y)
    bandMax[band] = Math.max(bandMax[band]!, Math.hypot(m.x, m.z))
  }

  let radial = 0
  let inward = 0
  let tangential = 0
  for (let i = 0; i < triangles.length; i += 1) {
    const [a, b, c] = triangles[i]!
    const m = centroids[i]!
    const limit = bandMax[bandOf(m.y)]!
    if (limit <= 0 || Math.hypot(m.x, m.z) < limit * shellRatio) continue

    const n = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a))
    if (n.lengthSq() === 0) continue
    n.normalize()
    if (Math.abs(n.y) > 0.7) continue

    const alignment = n.dot(new Vector3(m.x, 0, m.z).normalize())
    if (Math.abs(alignment) < 0.5) { tangential += 1; continue }
    radial += 1
    if (alignment < 0) inward += 1
  }
  return { radial, inward, tangential }
}

/**
 * Closed solids: Σ a·(b×c)/6. Comes out positive if the winding faces outward.
 *
 * Only valid on FULLY closed models. `bandGeometry` deliberately does not build
 * the inner surface (invisible, saves triangles), so this criterion cannot be
 * used on models carrying iron hoops — those get the radial test instead.
 */
function signedVolume(root: Object3D): number {
  let v = 0
  for (const [a, b, c] of worldTriangles(root)) v += a.dot(new Vector3().crossVectors(b, c)) / 6
  return v
}

/**
 * Edge balance — the test that catches a single reversed face.
 *
 * On a CLOSED surface every edge is traversed equally often in both directions:
 * neighbouring triangles use the shared edge in opposite directions. Flip one
 * face and that face's three edges fall out of balance.
 *
 * Demanding "no edge may repeat" would have been wrong: kit models are unions
 * of separate solids and two boxes making a butt joint can share the same edge
 * — that is design, not a bug. Balance is unaffected by the sharing, because
 * the two solids use that edge in opposite directions.
 *
 * Only valid on closed models: `bandGeometry` does not build the inner surface,
 * so its boundary edges stay one-directional and balance breaks by definition.
 *
 * This test closes the gap left by signed volume — there, flipping one face of
 * the crate dropped the volume from 0.058 to 0.039 but it stayed positive and
 * the test passed.
 */
function edgeBalance(root: Object3D): { edges: number; unbalanced: number } {
  const counts = new Map<string, number>()
  const key = (v: Vector3): string =>
    `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`

  let edges = 0
  for (const [a, b, c] of worldTriangles(root)) {
    const ka = key(a), kb = key(b), kc = key(c)
    for (const [from, to] of [[ka, kb], [kb, kc], [kc, ka]] as const) {
      if (from === to) continue
      edges += 1
      // Undirected key; the direction is carried by the sign.
      const forward = from < to
      const id = forward ? `${from}|${to}` : `${to}|${from}`
      counts.set(id, (counts.get(id) ?? 0) + (forward ? 1 : -1))
    }
  }
  let unbalanced = 0
  for (const value of counts.values()) if (value !== 0) unbalanced += 1
  return { edges, unbalanced }
}

/**
 * Full fingerprint of the model: the position AND color data of every mesh.
 *
 * Looking at the first vertex was not enough: in most models the seed changes
 * the color, not the position (anvil, ladder, tools), so the first vertex came
 * out the same for every seed and the test cried FAIL in the wrong place.
 */
function fingerprint(model: { root: Object3D }): string {
  let hash = 2166136261
  const mix = (value: number): void => {
    hash ^= Math.round(value * 1e6) | 0
    hash = Math.imul(hash, 16777619)
  }
  model.root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    for (const name of ['position', 'color'] as const) {
      const attribute = o.geometry.getAttribute(name)
      if (!attribute) continue
      const array = attribute.array as ArrayLike<number>
      for (let i = 0; i < array.length; i += 1) mix(array[i]!)
    }
  })
  return (hash >>> 0).toString(16)
}

/* ---------------------------------------------------------- kit model test */

interface KitModel {
  root: Object3D
  parts: Record<string, { anchor: Object3D; content: Object3D }>
  materials: { get(slot: string): unknown; override(slot: string, m: never): void }
  getConfig(): Readonly<Record<string, unknown>>
  configure(patch: Record<string, number>): { rebuilt: boolean }
  update(deltaSeconds: number): void
  dispose(): void
}

interface Case {
  readonly id: string
  make(overrides?: Record<string, number>): KitModel
  readonly patch: Record<string, number>
  readonly parts: number
  readonly ownSlot: string
  readonly borrowSlot: string
  /** Is it a body of revolution? */
  readonly radial?: boolean
  /**
   * Which part the radial test is applied to. Defaults to the root.
   * Needed on the bucket: the widest radius belongs to the HANDLE, not the body
   * — measuring via the root mistakes the handle's arcs for the "outer shell"
   * and gives a meaningless result.
   */
  readonly radialPart?: string
  /**
   * What fraction of the largest radius is enough to count as outer shell.
   * Must be lowered on conical bodies: on the bucket 0.94 catches only the
   * topmost hoop and the test never sees a meaningful sample.
   */
  readonly shellRatio?: number
  /** Is it a fully closed solid? */
  readonly closed?: boolean
  /** Extra configurations for z-fight. */
  readonly variants?: ReadonlyArray<Record<string, number>>
  /**
   * Dimensions the bounding box must not exceed in the default configuration.
   *
   * This check exists to catch one class of bug: `rotate` always turns about
   * the ORIGIN, so putting a part in place first and rotating it afterwards
   * flings it away. That is exactly what happened on the hoe — the blade neck
   * shot 0.23 m forward, the model grew to 0.42 m deep, and no test objected.
   */
  readonly maxSize?: readonly [number, number, number]
}

const as = <T>(make: (o?: never) => T) => (o?: Record<string, number>): KitModel =>
  (make as unknown as (x?: Record<string, number>) => KitModel)(o)

const CASES: readonly Case[] = [
  { id: 'wooden-barrel', make: as(createBarrel), patch: { staveCount: 22, hoopCount: 6 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak', radial: true , maxSize: [1, 1.2, 1] },
  { id: 'wooden-crate', make: as(createCrate), patch: { plankRows: 5, strapCount: 3 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak', closed: true,
    variants: [{ plankRows: 1 }, { plankRows: 6 }, { strapCount: 4 }] , maxSize: [0.9, 0.7, 0.75] },
  { id: 'wooden-bucket', make: as(createBucket), patch: { staveCount: 15, hoopCount: 3 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', radial: true, radialPart: 'staves',
    variants: [{ handle: 0 }, { hoopCount: 0 }] , maxSize: [0.45, 0.6, 0.45] },
  { id: 'iron-anvil', make: as(createAnvil), patch: { hornReach: 0.7 },
    parts: 6, ownSlot: 'steel', borrowSlot: 'iron', closed: true , maxSize: [0.6, 0.85, 0.42] },
  { id: 'wooden-ladder', make: as(createLadder), patch: { rungCount: 12 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ rungCount: 3 }, { taper: 0 }] , maxSize: [0.6, 2.4, 0.12] },
  { id: 'wooden-fence', make: as(createFence), patch: { sections: 5, railCount: 4 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ sections: 1 }, { railCount: 1 }, { railCount: 4 }, { rough: 0 }, { brace: 0 }] , maxSize: [5.3, 1.5, 0.45] },
  { id: 'wooden-stool', make: as(createStool), patch: { legCount: 4, splay: 0.35 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ legCount: 5 }, { splay: 0 }] , maxSize: [0.5, 0.55, 0.5] },
  { id: 'wooden-hoe', make: as(createHoe), patch: { bladeWidth: 0.26, neckSweep: 130 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ neckSweep: 45 }, { bladeWidth: 0.3 }, { dish: 0 }] , maxSize: [0.32, 1.6, 0.42] },
  { id: 'wooden-shovel', make: as(createShovel), patch: { bladeWidth: 0.3, bladeLength: 0.36, dish: 0.22 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ bladeLength: 0.18 }, { bladeLength: 0.4 }, { dish: 0 }, { bladeAngle: 25 }] , maxSize: [0.3, 1.4, 0.15] },
  { id: 'wooden-pitchfork', make: as(createPitchfork), patch: { tineCount: 5, spread: 0.3 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ tineCount: 2 }, { spread: 0 }, { tineCount: 6 }] , maxSize: [0.3, 1.9, 0.15] },
  { id: 'trestle-table', make: as(createTable), patch: { plankCount: 6, splay: 0.35 },
    parts: 3, ownSlot: 'oak', borrowSlot: 'oak', closed: true, maxSize: [2.2, 0.9, 1.3],
    variants: [{ plankCount: 2 }, { splay: 0 }] },
  { id: 'cart-wheel', make: as(createWheel), patch: { spokeCount: 14, tyre: 0.07 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', maxSize: [1.2, 1.2, 0.35],
    variants: [{ spokeCount: 6 }, { spokeCount: 16 }, { width: 0.16 }] },
  { id: 'wooden-chest', make: as(createChest), patch: { bandCount: 4, width: 1.1 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', closed: true,
    variants: [{ bandCount: 0 }, { bandCount: 1 }, { depth: 0.7 }] , maxSize: [1, 0.62, 0.62] },
  { id: 'wooden-bench', make: as(createBench), patch: { length: 2.1, splay: 0.4 },
    parts: 3, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ splay: 0 }, { inset: 0.02 }, { width: 0.45 }] , maxSize: [1.7, 0.5, 0.35] },
  { id: 'pitch-torch', make: as(createTorch), patch: { wrapLength: 0.42, flameHeight: 2.2 },
    parts: 3, ownSlot: 'char', borrowSlot: 'oak', radial: true, radialPart: 'shaft',
    variants: [{ flicker: 0 }, { radius: 0.04 }] , maxSize: [0.14, 0.95, 0.14] },
  { id: 'hay-bale', make: as(createBale), patch: { ropeCount: 3, wisps: 40 },
    parts: 3, ownSlot: 'cloth', borrowSlot: 'straw', closed: true,
    variants: [{ ropeCount: 0 }, { wisps: 0 }, { ropeCount: 1 }] , maxSize: [1.14, 0.68, 0.68] },
  { id: 'linen-sack', make: as(createSack), patch: { fill: 0.45, ears: 5 },
    parts: 3, ownSlot: 'cloth', borrowSlot: 'cloth', closed: true,
    variants: [{ ears: 0 }, { fill: 1 }, { collar: 0.28 }],
    maxSize: [0.5, 0.56, 0.5] },
  { id: 'straw-broom', make: as(createBroom), patch: { bristles: 52, tipRadius: 0.16 },
    parts: 3, ownSlot: 'cloth', borrowSlot: 'oak',
    variants: [{ bindings: 0 }, { tipRadius: 0.06 }, { bristles: 10 }],
    maxSize: [0.42, 1.3, 0.42] },
  { id: 'oak-tankard', make: as(createTankard), patch: { staveCount: 14, hoopCount: 3 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', radial: true, radialPart: 'staves',
    variants: [{ handle: 0 }, { hoopCount: 0 }, { taper: 0.25 }],
    maxSize: [0.13, 0.2, 0.19] },
  { id: 'bronze-bell', make: as(createBell), patch: { diameter: 0.5, yoke: 1.8 },
    // shellRatio is high: the bell is HOLLOW and its inner shell's normals
    // deliberately face the axis. A lower threshold mistook it for the "outer
    // shell" and rightly failed — what we want here is only the outer surface.
    // The frame makes this bigger and adds a part. It is not optional: without
    // it the bell, the clapper and the yoke hang in mid-air with nothing
    // holding them, which the support check rejects — correctly.
    parts: 4, ownSlot: 'iron', borrowSlot: 'brass', radial: true, radialPart: 'bell',
    shellRatio: 0.93, variants: [{ height: 0.6 }, { yoke: 1 }],
    maxSize: [0.72, 0.85, 0.5] },
  { id: 'iron-lantern', make: as(createLantern), patch: { sides: 8, flameHeight: 0.3 },
    parts: 4, ownSlot: 'glass', borrowSlot: 'iron',
    variants: [{ sides: 4 }, { flicker: 0 }, { radius: 0.12 }],
    maxSize: [0.2, 0.36, 0.2] },
  { id: 'tavern-sign', make: as(createSign), patch: { plankCount: 4, width: 0.8 },
    // Now a standing signpost rather than a wall bracket, so it is much taller
    // and carries a third part. A wall-mounted version floated: the model did
    // not contain the wall it was bolted to.
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ plankCount: 1 }, { drop: 0.3 }, { reach: 1 }, { postHeight: 3.2 }],
    maxSize: [0.95, 3.7, 1.0] },
  { id: 'leather-book', make: as(createBook), patch: { bands: 5, clasps: 2 },
    parts: 3, ownSlot: 'brass', borrowSlot: 'leather', closed: true,
    variants: [{ bands: 0 }, { clasps: 0 }, { thickness: 0.14 }],
    maxSize: [0.25, 0.09, 0.3] },
  { id: 'glass-phial', make: as(createPhial), patch: { fill: 0.9, neck: 0.5 },
    parts: 3, ownSlot: 'ember', borrowSlot: 'glass', radial: true, radialPart: 'bottle',
    shellRatio: 0.85, variants: [{ fill: 0 }, { seal: 0 }, { hue: 0.7 }],
    maxSize: [0.09, 0.15, 0.09] },
  { id: 'coin-pouch', make: as(createPouch), patch: { coins: 18, fill: 0.4 },
    parts: 3, ownSlot: 'brass', borrowSlot: 'leather', radial: true, radialPart: 'pouch',
    shellRatio: 0.8, variants: [{ coins: 0 }, { fill: 1 }, { coinRadius: 0.02 }],
    maxSize: [0.32, 0.14, 0.32] },
  { id: 'wicker-basket', make: as(createBasket), patch: { stakes: 14, rows: 9 },
    parts: 3, ownSlot: 'produce', borrowSlot: 'oak', radial: true, radialPart: 'rim',
    variants: [{ produce: 0 }, { taper: 0 }, { rows: 2 }],
    maxSize: [0.42, 0.32, 0.42] },
  { id: 'log-pile', make: as(createLogPile), patch: { rows: 4, perRow: 7, variation: 0.4 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', maxSize: [1.6, 0.9, 0.9],
    variants: [{ rows: 1 }, { taperRows: 0 }, { perRow: 9 }] },
]

console.log('\n@scifi-kit/pressure-gauge')
{
  const gauge = createGauge()
  const r = inspect(gauge.root)
  console.log(`  ${r.meshes} mesh · ${r.triangles} triangles · ${r.size.join(' x ')} m`)
  expect('geometry produced', r.meshes > 0 && r.triangles > 0)
  expect('no NaN/Infinity vertices', r.nonFinite === 0)

  const before = new Map<Object3D, number>()
  gauge.root.traverse((o) => before.set(o, o.rotation.z))
  gauge.triggerPressureTest()
  for (let i = 0; i < 30; i += 1) gauge.update(1 / 60)
  let animated = 0
  gauge.root.traverse((o) => { if (Math.abs(o.rotation.z - (before.get(o) ?? 0)) > 1e-6) animated += 1 })
  expect('update() moves the needle', animated === 1)
  gauge.dispose()
  gauge.dispose()
  expect('dispose() idempotent', true)
}

let totalTriangles = 0
for (const testCase of CASES) {
  console.log(`\n@medieval-kit/${testCase.id}`)
  const model = testCase.make()
  const report = inspect(model.root)
  totalTriangles += report.triangles
  console.log(`  ${report.meshes} mesh · ${report.triangles} triangles · ${report.size.join(' x ')} m`)

  expect('geometry produced', report.meshes > 0 && report.triangles > 0)
  expect('no NaN/Infinity vertices', report.nonFinite === 0)
  expect('bounds finite', report.size.every(Number.isFinite))
  expect('within lowpoly budget (< 2500 triangles)', report.triangles < 2500)
  if (testCase.maxSize) {
    const over = report.size
      .map((value, i) => (value > testCase.maxSize![i]! ? `${'xyz'[i]}=${value}>${testCase.maxSize![i]}` : ''))
      .filter(Boolean)
    expect(`dimensions within expected limits${over.length ? ' — EXCEEDS: ' + over.join(', ') : ''}`, over.length === 0)
  }
  // --- Nothing may float ---------------------------------------------------
  //
  // The kit's hardest structural rule and the last one to get a test. Every
  // other check here looks at surfaces — winding, coplanarity, triangle counts
  // — and none of them can see a piece of the model hanging in the air with
  // nothing holding it up. A chest lid separated from its chest passed all of
  // them.
  //
  // The check runs on the CONFIGURED model as well as the default one, because
  // a slider is allowed to change proportions and is not allowed to take the
  // object apart. That distinction found real breakage: at the far end of its
  // sliders the cart wheel shed an arc of its tyre onto the floor, the ladder's
  // top rungs floated between rails that splayed the other way from what the
  // rung length assumed, and the basket's fruit hung level with the rim of a
  // basket deep enough to swallow it.
  {
    const report = findFloating(model.root as never, { resolution: 64 })
    const detail = report.floating
      .map((piece) => `${piece.parts.join('+')} @${piece.clearance}m`)
      .join(', ')
    expect(`nothing floats${detail ? ' — FLOATING: ' + detail : ''}`,
      report.floating.length === 0)
  }

  expect(`${testCase.parts} semantic parts`, Object.keys(model.parts).length === testCase.parts)

  // --- Does the metadata really describe the model? ------------------------
  //
  // `my-registry/meta.ts` is the source for both registry.json and the viewer
  // sliders. So a lie in there has consequences in two separate places: a wrong
  // contract for the registry consumer, a dead slider in the viewer.
  //
  // This check takes over work the compiler used to do, and reaches further
  // than it did: only the slider keys were checked before, now part names and
  // material slots are checked too.
  if (testCase.id !== 'pressure-gauge') {
    const meta = MODEL_META[testCase.id]
    expect('meta entry exists', meta !== undefined)
    if (meta) {
      const config = model.getConfig() as Record<string, unknown>

      const patchKeys = [testCase.patch, ...(testCase.variants ?? [])].flatMap(Object.keys)
      const strayPatch = [...new Set(patchKeys)].filter((key) => !(key in config))
      expect(`test patches point at real fields${strayPatch.length ? ' — MISSING: ' + strayPatch.join(', ') : ''}`,
        strayPatch.length === 0)

      const strayControls = Object.keys(meta.controls).filter((key) => !(key in config))
      expect(`meta.controls keys exist in config${strayControls.length ? ' — MISSING: ' + strayControls.join(', ') : ''}`,
        strayControls.length === 0)

      const declared = [...meta.parts].sort().join(',')
      const actual = Object.keys(model.parts).sort().join(',')
      expect(`meta.parts matches the model's parts${declared === actual ? '' : ` — meta:${declared} model:${actual}`}`,
        declared === actual)

      // Every declared slot must REALLY exist...
      const unresolved = meta.materialSlots.filter((slot) => model.materials.get(slot) === undefined)
      expect(`meta.materialSlots all resolve${unresolved.length ? ' — UNRESOLVED: ' + unresolved.join(', ') : ''}`,
        unresolved.length === 0)

      // ...and no mesh may use an undeclared slot. This direction matters
      // more: an extra declaration is only noise, a missing one means a hidden
      // material the consumer cannot override.
      const used = new Set<string>()
      model.root.traverse((object: Object3D) => {
        const slot = (object.userData?.vibe3d as { materialSlot?: string } | undefined)?.materialSlot
        if (slot) used.add(slot)
      })
      const undeclared = [...used].filter((slot) => !meta.materialSlots.includes(slot))
      expect(`every mesh uses a declared slot${undeclared.length ? ' — UNDECLARED: ' + undeclared.join(', ') : ''}`,
        undeclared.length === 0)
    }
  }


  if (testCase.closed) {
    const balance = edgeBalance(model.root)
    console.log(`  edge balance: ${balance.edges} edges · unbalanced: ${balance.unbalanced}`)
    expect('edge balance intact (no reversed face)', balance.unbalanced === 0)
  }

  if (testCase.radial) {
    const target = testCase.radialPart ? model.parts[testCase.radialPart]!.anchor : model.root
    const w = radialWinding(target, testCase.shellRatio ?? 0.94)
    console.log(`  radial outer faces: ${w.radial} · reversed winding: ${w.inward} · tangential (skipped): ${w.tangential}`)
    expect('no reversed winding on the outer shell', w.inward === 0)
    expect('test saw a meaningful number of radial faces', w.radial >= 20)
  }
  if (testCase.closed) {
    const volume = signedVolume(model.root)
    const box = report.size[0] * report.size[1] * report.size[2]
    console.log(`  signed volume: ${volume.toFixed(5)} m³ (bounding box ${box.toFixed(5)})`)
    expect('signed volume positive (winding faces outward)', volume > 0)
    expect('volume smaller than the bounding box', volume < box)
  }

  for (const variant of [{}, ...(testCase.variants ?? [])]) {
    const named = Object.keys(variant).length > 0
    const sample = named ? testCase.make(variant) : model
    const z = findZFighting(sample.root)
    const label = named ? JSON.stringify(variant) : 'default'
    console.log(`  z-fight ${label}: ${z.faces} faces · coplanar ${z.coplanarGroups} · overlaps ${z.overlaps}`)
    for (const s of z.samples) console.log(`      ${s}`)
    expect(`no z-fight ${label}`, z.overlaps === 0)
    if (named) sample.dispose()
  }

  const twinA = testCase.make({ seed: 21 })
  const twinB = testCase.make({ seed: 21 })
  const other = testCase.make({ seed: 22 })
  expect('same seed same geometry', fingerprint(twinA) === fingerprint(twinB))
  expect('different seed different model', fingerprint(twinA) !== fingerprint(other))
  twinA.dispose()
  twinB.dispose()
  other.dispose()

  const rootBefore = model.root
  const anchorName = Object.keys(model.parts)[0]!
  const anchorBefore = model.parts[anchorName]!.anchor
  // A consumer attachment must survive the rebuild — the protocol's real promise.
  const marker = new Mesh()
  marker.name = 'consumer-marker'
  anchorBefore.add(marker)
  expect('configure() rebuilt=true', model.configure(testCase.patch).rebuilt)
  expect('root object identity preserved', model.root === rootBefore)
  expect('anchor object identity preserved', model.parts[anchorName]!.anchor === anchorBefore)
  expect('consumer attachment still there after rebuild', anchorBefore.children.includes(marker))
  expect('unchanged patch rebuilt=false', model.configure(testCase.patch).rebuilt === false)

  let ownDisposed = false
  ;(model.materials.get(testCase.ownSlot) as MeshStandardMaterial)
    .addEventListener('dispose', () => { ownDisposed = true })
  let borrowedDisposed = false
  const borrowed = new MeshStandardMaterial({ name: 'consumer-owned' })
  borrowed.addEventListener('dispose', () => { borrowedDisposed = true })
  model.materials.override(testCase.borrowSlot, borrowed as never)
  expect('override material reads back', model.materials.get(testCase.borrowSlot) === borrowed)
  model.dispose()
  model.dispose()
  // On models that use the same slot for both the ownership and the borrowed
  // test (the single-material anvil) the first check would be meaningless.
  if (testCase.ownSlot !== testCase.borrowSlot) {
    expect('the model disposed its own material', ownDisposed)
  }
  expect('borrowed material left untouched', !borrowedDisposed)
  expect('dispose() idempotent', true)
}


// --- Actions ---------------------------------------------------------------
//
// The chest is the kit's first model with actions, so we test the `actions` and
// `update` contract here in one go. An action is NOT configuration: opening the
// lid does not change the chest's identity, so it must not trigger a rebuild
// and it must also survive one.
console.log('\n@medieval-kit/wooden-chest actions')
{
  const chest = createChest()
  const lid = chest.parts.lid.anchor
  const angle = chest.getConfig().openAngle * Math.PI / 180

  expect('closed to begin with', !chest.actions.isOpen() && chest.actions.openness() === 0)
  expect('lid unrotated to begin with', lid.rotation.x === 0)

  // The target and the INSTANTANEOUS state are separate: setOpen only sets the target.
  chest.actions.setOpen(true)
  expect('setOpen changed the target', chest.actions.isOpen())
  expect('setOpen on its own did not move the lid', lid.rotation.x === 0)

  // The same duration at two different frame rates: the exponential approach
  // must depend on total TIME, not on frame COUNT. A naive `p += (target - p) * k`
  // would blow up here — it would open slower at 30 fps than at 120 fps.
  const fast = createChest()
  const slow = createChest()
  fast.actions.setOpen(true)
  slow.actions.setOpen(true)
  for (let i = 0; i < 12; i += 1) fast.update(0.2 / 12)
  for (let i = 0; i < 3; i += 1) slow.update(0.2 / 3)
  expect('motion independent of frame rate',
    Math.abs(fast.actions.openness() - slow.actions.openness()) < 1e-6)
  expect('most of the way covered after 0.2 s', fast.actions.openness() > 0.8)
  fast.dispose()
  slow.dispose()

  for (let i = 0; i < 120; i += 1) chest.update(1 / 60)
  expect('fully open after enough time', chest.actions.openness() === 1)
  expect('lid reached the open angle', Math.abs(lid.rotation.x + angle) < 1e-9)

  // An object the consumer attaches to the lid must turn with the lid — a
  // candlestick set on the lid must not hang in mid-air when the lid opens.
  const candle = new Mesh()
  lid.add(candle)
  candle.position.set(0, 0.05, 0.1)
  lid.updateMatrixWorld(true)
  const lifted = new Vector3().setFromMatrixPosition(candle.matrixWorld)
  expect('object attached to the lid turned with it', lifted.z < 0.06)

  // A rebuild must not clobber the lid: the angle is kept OUTSIDE the build.
  expect('configure() rebuilt=true after an action', chest.configure({ width: 1.05 }).rebuilt)
  expect('lid still open after the rebuild', Math.abs(lid.rotation.x + angle) < 1e-9)
  expect('object still on the lid after the rebuild', lid.children.includes(candle))

  chest.actions.setOpen(false)
  chest.actions.snap()
  expect('snap() landed on the target at once', chest.actions.openness() === 0 && lid.rotation.x === 0)
  expect('toggle() returns the new state', chest.actions.toggle() === true)

  // `extras`: the lid is a single PART but carries two material slots.
  const lidSlots = new Set<string>()
  chest.parts.lid.content.traverse((object: Object3D) => {
    const slot = (object.userData?.vibe3d as { materialSlot?: string } | undefined)?.materialSlot
    if (slot) lidSlots.add(slot)
  })
  expect('lid carries both an oak and an iron body', lidSlots.has('oak') && lidSlots.has('iron'))

  // On models without actions `update` must quietly do nothing.
  const plain = createBarrel()
  plain.update(0.016)
  expect('update() harmless on a model without actions', Object.keys(plain.actions).length === 0)
  plain.dispose()

  chest.dispose()
}



// --- Bell mechanics --------------------------------------------------------
//
// The kit's most complex motion. What rings the bell is not the bell SWINGING
// but the clapper LAGGING BEHIND — two bodies swing on the same axis with
// different damping and the difference produces the strike. Without testing
// that split we would not notice a model that swings but never strikes at all
// (which is exactly what the first attempt did).
console.log('\n@medieval-kit/bronze-bell mechanics')
{
  const bell = createBell()
  const body = bell.parts.bell.anchor
  const clapper = bell.parts.clapper.anchor

  expect('motionless to begin with', !bell.actions.isRinging() && bell.actions.strikes() === 0)
  expect('update() does nothing until it is rung',
    (() => { for (let i = 0; i < 30; i += 1) bell.update(1 / 60); return body.rotation.z === 0 })())

  bell.actions.ring()
  for (let i = 0; i < 10; i += 1) bell.update(1 / 60)
  expect('starts swinging once rung', Math.abs(body.rotation.z) > 0.01)

  // The strike: a bell that swings long enough MUST strike.
  for (let i = 0; i < 180; i += 1) bell.update(1 / 60)
  expect(`clapper struck (${bell.actions.strikes()} strikes)`, bell.actions.strikes() > 0)

  // And the clapper must be INDEPENDENT of the bell: at the same angle every
  // instant they would never strike. We measure the largest gap over one run.
  let apart = 0
  bell.actions.still()
  bell.actions.ring()
  for (let i = 0; i < 120; i += 1) {
    bell.update(1 / 60)
    apart = Math.max(apart, Math.abs(clapper.rotation.z - body.rotation.z))
  }
  expect(`clapper diverges from the bell (at most ${apart.toFixed(3)} rad)`, apart > 0.05)

  // Swing limit: it must not exceed the angle from the configuration.
  const limit = (bell.getConfig().swing * Math.PI) / 180
  let peak = 0
  for (let i = 0; i < 40; i += 1) { bell.actions.ring(); bell.update(1 / 60) }
  for (let i = 0; i < 200; i += 1) { bell.update(1 / 60); peak = Math.max(peak, Math.abs(body.rotation.z)) }
  expect(`swing limit held (${peak.toFixed(3)} ≤ ${limit.toFixed(3)})`, peak <= limit + 1e-9)

  // Damping: a bell left alone must come to rest. A pendulum that swings
  // forever burns frames in the scene forever.
  for (let i = 0; i < 2400; i += 1) bell.update(1 / 60)
  expect('comes to rest on its own', !bell.actions.isRinging())

  bell.actions.still()
  expect('still() resets everything',
    body.rotation.z === 0 && clapper.rotation.z === 0 && !bell.actions.isRinging())

  bell.dispose()
}


console.log(`\nkit total: ${CASES.length} models · ${totalTriangles} triangles`)
console.log(failures.length === 0 ? 'All checks passed.' : `${failures.length} checks FAILED.`)
if (failures.length > 0) process.exitCode = 1
