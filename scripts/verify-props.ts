/**
 * The gate the contemporary kit did not have.
 *
 * `verify-model.ts` walks the medieval kit and it walks it by hand: every model
 * is an explicit import and the metadata comes from `my-registry/meta.ts`. When
 * the second registry arrived nothing extended it, so for fifteen models the
 * only automated check was `check-model.ts`, which is per-model, run by a human,
 * and reports geometry rather than judging it.
 *
 * The cost of that showed up the first time anyone opened the viewer: a park
 * bench flickering along every slat, a picnic table flickering at every joint,
 * a pepper mill flickering where it touched the table. Fifty coplanar faces on
 * one model, and nothing in the repository would have said so.
 *
 * This is deliberately narrow. It does not duplicate the medieval gate's
 * thousand assertions; it runs the two checks that catch what a human looking
 * at a still render cannot -- surfaces that share a plane, and pieces that hang
 * in the air -- across whatever the catalogue says the kit contains. Adding a
 * model to `CONTEMPORARY_ORDER` is all it takes to be covered.
 */
import { Box3, Vector3 } from 'three/webgpu'

import { CATALOG } from '@/catalog.ts'
import { findZFighting } from './zfight.ts'
import { findFloating } from './support.ts'

const NAMESPACE = '@contemporary-props'

let failed = 0
let checked = 0

for (const [id, entry] of Object.entries(CATALOG)) {
  const record = entry as unknown as {
    namespace: string
    build(): { root: import('three/webgpu').Object3D; dispose?(): void }
  }
  if (record.namespace !== NAMESPACE) continue
  checked += 1

  const built = record.build()
  const { root } = built
  root.updateMatrixWorld(true)

  const problems: string[] = []

  // Surfaces sharing a plane. Two of them cannot be ordered, so the renderer
  // picks per pixel and the pair flickers as the camera moves. The medieval
  // kit has held at zero since this check was written; so does this one.
  const z = findZFighting(root)
  if (z.overlaps > 0) {
    problems.push(`${z.overlaps} overlapping coplanar face(s) in ${z.coplanarGroups} group(s)`)
    for (const sample of z.samples.slice(0, 3)) problems.push(`  ${sample}`)
  }

  // Nothing may hang in the air with nothing under it.
  const support = findFloating(root, { resolution: 96 })
  if (support.floating.length > 0) {
    problems.push(`${support.floating.length} floating piece(s) in ${support.components} component(s)`)
    for (const piece of support.floating.slice(0, 3)) {
      problems.push(`  ${(piece.clearance * 1000).toFixed(0)}mm clear · ${piece.parts.join(', ')}`)
    }
  }

  // Precise, for the reason `support.ts` says: the loose bound is the box
  // around each part's own rotated box, and a hinged model reads 60 mm taller
  // than its tallest vertex.
  const box = new Box3().setFromObject(root, true)
  const size = box.getSize(new Vector3())
  if (!Number.isFinite(size.x + size.y + size.z) || size.y <= 0) {
    problems.push('bounds are not finite')
  }

  /*
   * ...and it has to be ON the ground, which nothing here was checking.
   *
   * `findFloating` measures a model against ITSELF: it looks for pieces with
   * nothing under them, so a model whose every piece is correctly stacked
   * passes even when the whole assembly is a metre in the air. The cable drum
   * shipped like that -- 600 mm up, because it was written in world coordinates
   * and then given an origin as well, which places it twice -- and every gate
   * in the repository said it rested on the ground.
   *
   * The tolerance is ASYMMETRIC, because the two directions are not the same
   * fault. A millimetre in the air is a model that will hover over any surface
   * it is placed on. A couple of millimetres under is the outermost corner of a
   * chamfered foot, or the end of a centre line offset perpendicular to its own
   * direction, and the ground hides it -- so it is allowed up to a percent of
   * the model's own height, which scales from a mug to a bus shelter.
   */
  if (Number.isFinite(box.min.y)) {
    if (box.min.y > 0.001) {
      problems.push(`floats ${(box.min.y * 1000).toFixed(0)}mm above the ground`)
    } else if (-box.min.y > Math.max(0.004, size.y * 0.01)) {
      problems.push(`sinks ${(-box.min.y * 1000).toFixed(0)}mm below the ground`)
    }
  }

  if (problems.length > 0) {
    failed += 1
    console.log(`\n  FAIL  ${id}`)
    for (const line of problems) console.log(`        ${line}`)
  } else {
    console.log(`  PASS  ${id}`)
  }

  built.dispose?.()
}

console.log(`\n${checked} model(s) in ${NAMESPACE}`)
if (failed > 0) {
  console.log(`${failed} failing.`)
  process.exit(1)
}
console.log('All checks passed.')
