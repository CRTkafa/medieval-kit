/**
 * Generates the model table in REFERENCE.md.
 *
 * A hand-written table goes stale the moment the first model is added — and it
 * had gone stale: the document said "four items" while the kit had twenty-three.
 * The table is now read from the models THEMSELVES, so for it to be wrong the
 * model itself has to be broken.
 *
 *   bun scripts/catalog-table.ts
 */
import { Box3, Mesh } from 'three/webgpu'

import { MODEL_META } from '../my-registry/meta.ts'
import { CATALOG } from '@/catalog.ts'

const rows: string[] = []
let total = 0
const slots = new Set<string>()

for (const id of Object.keys(CATALOG)) {
  const meta = MODEL_META[id]
  if (!meta) continue

  const built = CATALOG[id]!.build()
  let triangles = 0
  built.root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const index = object.geometry.getIndex()
    triangles += (index ? index.count : object.geometry.getAttribute('position').count) / 3
  })
  const box = new Box3().setFromObject(built.root)
  const size = box.getSize(box.max.clone())
  const animated = built.action !== undefined
  built.dispose()

  for (const slot of meta.materialSlots) slots.add(slot)
  total += triangles
  const dims = `${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}`
  rows.push(
    `| \`${id}\` | ${meta.category} | ${triangles} | ${meta.parts.length} | ${dims} | `
    + `${meta.materialSlots.join(', ')} | ${animated ? '✔' : ''} |`,
  )
}

console.log('| Model | Category | Triangles | Parts | Size (m) | Material slots | Animated |')
console.log('| --- | --- | ---: | ---: | --- | --- | :-: |')
console.log(rows.join('\n'))
console.log(`\n${rows.length} models · ${total} triangles · ${slots.size} material slots`)
