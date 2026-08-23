/**
 * Measures the oak against the numbers taken off the reference photographs.
 *
 * Rendering the tree and looking at it says "the crown is a ring of separate
 * balls". That is a real observation and a useless one to act on, because it
 * does not say by how much or where. This prints the four numbers the
 * references gave, measured off the built geometry the same way they were
 * measured off the photographs:
 *
 *   crown width / height        reference 1.32 – 1.43
 *   height of the widest point  reference 0.24
 *   bole width / height at 0.02 reference 0.130, at 0.10 reference 0.073
 *
 * and one number the photographs cannot give, because a photograph of a tree
 * is a single connected mass by definition: how many SEPARATE PIECES the crown
 * is in. A crown of one piece is foliage. A crown of fourteen is broccoli.
 */
import { Box3, Vector3, type Mesh, type Object3D } from 'three'

import { createModel } from '@/models/medieval-kit/oak-tree/model.ts'

const model = createModel()
const box = new Box3().setFromObject(model.root)
const size = box.getSize(new Vector3())
const H = size.y
const W = Math.max(size.x, size.z)
console.log(`overall  ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`)
console.log(`CROWN WIDTH / HEIGHT = ${(W / H).toFixed(3)}   (reference 1.32 – 1.43)`)

/** Every triangle of a part, in world space. */
function triangles(part: Object3D): Float32Array[] {
  const out: Float32Array[] = []
  part.updateWorldMatrix(true, true)
  part.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position')
    const v = new Vector3()
    const tri = new Float32Array(9)
    for (let i = 0; i < pos.count; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        v.fromBufferAttribute(pos, i + k).applyMatrix4(mesh.matrixWorld)
        tri[k * 3] = v.x; tri[k * 3 + 1] = v.y; tri[k * 3 + 2] = v.z
      }
      out.push(tri.slice())
    }
  })
  return out
}

// --- width profile, sampled the same way the photographs were: by height band
const N = 25
const bands: Array<{ min: number; max: number }> = Array.from(
  { length: N }, () => ({ min: Infinity, max: -Infinity }),
)
for (const t of triangles(model.root)) {
  for (let k = 0; k < 3; k += 1) {
    const y = t[k * 3 + 1]!
    const r = Math.hypot(t[k * 3]!, t[k * 3 + 2]!)
    const b = Math.min(N - 1, Math.max(0, Math.floor(((y - box.min.y) / H) * N)))
    // The EXTENT of the row, not twice its radius.
    //
    // The photographs were measured by counting how far apart the leftmost and
    // rightmost tree pixels were on each row. Measuring our own geometry as
    // 2 x max-radius instead is a different quantity on any tree that is not
    // symmetric -- which is every tree -- and it read 42% for a crown whose
    // widest ROW is much lower down. Comparing a number against a reference
    // means measuring it the same way the reference was measured.
    bands[b]!.min = Math.min(bands[b]!.min, t[k * 3]!)
    bands[b]!.max = Math.max(bands[b]!.max, t[k * 3]!)
  }
}
let widest = { at: 0, w: 0 }
console.log('\nheight%   width    profile')
for (let b = 0; b < N; b += 1) {
  const w = bands[b]!.max === -Infinity ? 0 : bands[b]!.max - bands[b]!.min
  const pct = ((b + 0.5) / N) * 100
  if (w > widest.w) widest = { at: pct, w }
  console.log(`  ${pct.toFixed(0).padStart(3)}%  ${w.toFixed(2).padStart(6)}  ${'#'.repeat(Math.round((w / W) * 46))}`)
}
console.log(`widest at ${widest.at.toFixed(0)}% of height   (reference 24%)`)

// --- where the crown starts. The reference's lowest leaves are at 11% of the
// height and it is at full width by 24%; a crown that reaches lower than that
// is a bush, and one that starts higher is a lollipop.
if (model.parts.crown) {
  const ys = triangles(model.parts.crown.anchor).flatMap((t) => [t[1]!, t[4]!, t[7]!])
  console.log(`crown hangs from ${(((Math.min(...ys)) - box.min.y) / H * 100).toFixed(0)}% of the height   (reference 11%)`)
}

// --- the bole, measured at the two heights the photograph was measured at
const trunkTris = triangles(model.parts.trunk.anchor)
for (const at of [0.02, 0.06, 0.1, 0.38]) {
  const y = box.min.y + H * at
  let r = 0
  for (const t of trunkTris) {
    for (let k = 0; k < 3; k += 1) {
      if (Math.abs(t[k * 3 + 1]! - y) < H * 0.012) r = Math.max(r, Math.hypot(t[k * 3]!, t[k * 3 + 2]!))
    }
  }
  console.log(`bole at ${(at * 100).toFixed(0).padStart(2)}% of height: ${(r * 2 / H).toFixed(4)} of height wide`)
}

/**
 * How many separate pieces is the crown in?
 *
 * The same voxel trick the support check uses: drop every triangle corner into
 * a grid, then flood fill through the 26 neighbours. Two clumps that overlap
 * share cells and come out as one piece; two that merely sit near each other
 * do not.
 */
const crown = model.parts.crown?.anchor
if (crown) {
  const cell = W / 90
  const key = (x: number, y: number, z: number): string => `${x},${y},${z}`
  const cells = new Set<string>()
  for (const t of triangles(crown)) {
    // Sample along each edge as well as at the corners, or a large flat facet
    // spans several cells and tears into separate pieces on its own.
    for (let e = 0; e < 3; e += 1) {
      const a = e * 3
      const b = ((e + 1) % 3) * 3
      const steps = Math.max(1, Math.ceil(
        Math.hypot(t[b]! - t[a]!, t[b + 1]! - t[a + 1]!, t[b + 2]! - t[a + 2]!) / (cell * 0.6),
      ))
      for (let s = 0; s <= steps; s += 1) {
        const f = s / steps
        cells.add(key(
          Math.round((t[a]! + (t[b]! - t[a]!) * f) / cell),
          Math.round((t[a + 1]! + (t[b + 1]! - t[a + 1]!) * f) / cell),
          Math.round((t[a + 2]! + (t[b + 2]! - t[a + 2]!) * f) / cell),
        ))
      }
    }
  }
  const seen = new Set<string>()
  const sizes: Array<{ count: number; cells: string[] }> = []
  for (const start of cells) {
    if (seen.has(start)) continue
    let count = 0
    const piece: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length > 0) {
      const at = stack.pop()!
      count += 1
      piece.push(at)
      const [x, y, z] = at.split(',').map(Number) as [number, number, number]
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            const n = key(x + dx, y + dy, z + dz)
            if (cells.has(n) && !seen.has(n)) { seen.add(n); stack.push(n) }
          }
        }
      }
    }
    sizes.push({ count, cells: piece })
  }
  sizes.sort((a, b) => b.count - a.count)
  console.log(`\nCROWN IS IN ${sizes.length} SEPARATE PIECE(S)   (a crown should be 1)`)
  // WHERE a piece is matters more than how big it is: a tear low down means
  // the bottom limbs have outrun the rest, a tear at one bearing means a gap
  // between two neighbours, a tear far out means a limb reaching past its
  // fellows. Guessing which of the three it was cost two rounds of tuning that
  // each fixed nothing.
  for (const piece of sizes.slice(0, 6)) {
    let y0 = Infinity, y1 = -Infinity, r0 = Infinity, r1 = -Infinity
    const bearings: number[] = []
    for (const c of piece.cells) {
      const [x, y, z] = c.split(',').map(Number) as [number, number, number]
      const yy = (y * cell - box.min.y) / H * 100
      const rr = Math.hypot(x * cell, z * cell)
      if (yy < y0) y0 = yy
      if (yy > y1) y1 = yy
      if (rr < r0) r0 = rr
      if (rr > r1) r1 = rr
      bearings.push(((Math.atan2(z, x) * 180) / Math.PI + 360) % 360)
    }
    bearings.sort((a, b) => a - b)
    console.log(`  ${String(piece.count).padStart(6)} cells  `
      + `height ${y0.toFixed(0)}-${y1.toFixed(0)}%  `
      + `radius ${r0.toFixed(1)}-${r1.toFixed(1)}m  `
      + `bearing ${bearings[0]!.toFixed(0)}-${bearings[bearings.length - 1]!.toFixed(0)}deg`)
  }
}

model.dispose()
