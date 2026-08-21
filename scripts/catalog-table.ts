/**
 * REFERENCE.md'deki model tablosunu üretir.
 *
 * Elle yazılmış bir tablo ilk eklenen modelde bayatlıyor — nitekim bayatlamıştı
 * da: doküman "dört item" diyordu, kitte yirmi üç vardı. Tablo artık modellerin
 * KENDİSİNDEN okunuyor, dolayısıyla yanlış olması için modelin bozulması lazım.
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

console.log('| Model | Kategori | Üçgen | Parça | Ölçü (m) | Materyal yuvaları | Eylemli |')
console.log('| --- | --- | ---: | ---: | --- | --- | :-: |')
console.log(rows.join('\n'))
console.log(`\n${rows.length} model · ${total} üçgen · ${slots.size} materyal yuvası`)
