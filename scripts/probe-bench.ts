/**
 * Measures what stands proud of the bench, and where.
 *
 * "There is something sticking out of the bench again" is a real report and an
 * unmeasurable one. The first time it came in I planed the through-tenons from
 * 42 mm to 3 and called it done — which answered the tenons rather than the
 * question. The question is: over the whole thing a person sits on and swings
 * their legs past, what stands proud, and by how much?
 *
 * Two measurements, because there turned out to be two kinds:
 *
 *   1. Above the SEAT. The tenons, and anything else ending up over the
 *      surface. 3 mm is a plane's shaving; 10 mm you feel; 40 mm you sit on.
 *   2. A STEP in the leg's silhouette. A leg board that widens smoothly on the
 *      way down is a splayed leg; one that suddenly juts outward is a shoulder
 *      at shin height, and that is what was actually wrong.
 *
 * Both are swept across the sliders, because a bench that is smooth at one
 * setting and studded at another is still a bench you would not sit on.
 */
import { Mesh, type Object3D } from 'three/webgpu'

import { createModel } from '@/models/medieval-kit/wooden-bench/model.ts'

/** Every triangle of a part as nine numbers. */
function triangles(part: Object3D): number[][] {
  const out: number[][] = []
  part.updateWorldMatrix(true, true)
  part.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i += 3) {
      const t: number[] = []
      for (let k = 0; k < 3; k += 1) {
        t.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k))
      }
      out.push(t)
    }
  })
  return out
}

/**
 * The silhouette's half-width at a height, by SLICING the triangles.
 *
 * The first version of this sampled vertices into height bands and reported a
 * 0.0 mm step for a leg carrying a 17 mm shoulder. A tapered box has corners
 * only at its top and its bottom, so every band between them came out empty,
 * got skipped, and the comparison that would have caught the fault never ran —
 * the same failure as a check that passes by not running. Cutting the actual
 * triangles gives a width at any height, whether a corner happens to be there
 * or not.
 */
function halfWidthAt(tris: number[][], y: number): number {
  let widest = 0
  for (const t of tris) {
    for (let e = 0; e < 3; e += 1) {
      const a = e * 3
      const b = ((e + 1) % 3) * 3
      const ya = t[a + 1]!
      const yb = t[b + 1]!
      if (ya === yb) continue
      if ((ya - y) * (yb - y) > 0) continue
      const f = (y - ya) / (yb - ya)
      widest = Math.max(widest, Math.abs(t[a]! + (t[b]! - t[a]!) * f))
    }
  }
  return widest
}

const CASES: Array<[string, Record<string, number>]> = [
  ['default', {}],
  ['short', { length: 0.9 }],
  ['long', { length: 2.4 }],
  ['low', { height: 0.32 }],
  ['tall', { height: 0.58 }],
  ['narrow', { width: 0.2 }],
  ['wide', { width: 0.42 }],
  ['splayed', { splay: 0.5 }],
  ['upright', { splay: 0 }],
  ['inset out', { inset: 0.04 }],
  ['inset in', { inset: 0.24 }],
]

console.log('case          above the seat     worst step in the leg silhouette')
let worstProud = 0
let worstStep = 0
for (const [label, patch] of CASES) {
  const model = createModel(patch as never)

  const seatTris = triangles(model.parts.seat.anchor)
  const seatTop = Math.max(...seatTris.flatMap((t) => [t[1]!, t[4]!, t[7]!]))
  const legTris = triangles(model.parts.legs.anchor)
  // The bench used to carry a stretcher and no longer does: the reference has
  // none, and the open span under the seat is most of what separates a bench
  // from a table. Only the legs can stand proud of the seat now.
  const other = legTris
  const peak = Math.max(...other.flatMap((t) => [t[1]!, t[4]!, t[7]!]))
  const proud = peak - seatTop
  worstProud = Math.max(worstProud, proud)

  /**
   * Walk up the leg BELOW THE SEAT. A shoulder shows as the width dropping.
   *
   * Stopping at the seat's underside is not a convenience, it is the
   * difference between measuring the fault and measuring the design. Scanned
   * to the full height of the part, the biggest drop is 66 mm at 86% of the
   * way up — which is precisely where the leg board ends and only the through
   * tenon carries on into the seat. That is what a tenon IS. Reporting it as a
   * shoulder buries the real one, at the feet, under a bigger number that is
   * not a fault at all.
   */
  const seatBottom = Math.min(...seatTris.flatMap((t) => [t[1]!, t[4]!, t[7]!]))
  const ys = legTris.flatMap((t) => [t[1]!, t[4]!, t[7]!])
  const low = Math.min(...ys)
  const high = seatBottom
  const steps = 220
  let drop = 0
  let at = 0
  let previous = halfWidthAt(legTris, low + (high - low) * 0.004)
  for (let i = 1; i <= steps; i += 1) {
    const f = 0.004 + (i / steps) * 0.98
    const w = halfWidthAt(legTris, low + (high - low) * f)
    if (w > 0 && previous > 0 && previous - w > drop) {
      drop = previous - w
      at = f * 100
    }
    if (w > 0) previous = w
  }
  worstStep = Math.max(worstStep, drop)
  console.log(
    `${label.padEnd(12)}  ${(proud * 1000).toFixed(1).padStart(6)} mm       `
    + `${(drop * 1000).toFixed(1).padStart(6)} mm at ${at.toFixed(0).padStart(2)}% of the leg`,
  )
  model.dispose()
}

console.log('')
console.log(`worst proud of the seat : ${(worstProud * 1000).toFixed(1)} mm`)
console.log(`worst shoulder on a leg : ${(worstStep * 1000).toFixed(1)} mm`)
if (worstProud > 0.006 || worstStep > 0.004) {
  console.log('FAIL — you would feel that.')
  process.exit(1)
}
console.log('Nothing on this bench catches.')
