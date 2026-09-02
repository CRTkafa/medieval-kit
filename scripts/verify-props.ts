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
  const size = new Box3().setFromObject(root, true).getSize(new Vector3())
  if (!Number.isFinite(size.x + size.y + size.z) || size.y <= 0) {
    problems.push('bounds are not finite')
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
