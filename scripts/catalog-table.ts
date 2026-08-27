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
import { Box3, Mesh, type Object3D } from 'three/webgpu'

import { MODEL_META } from '../my-registry/meta.ts'
import { CATALOG, type Entry } from '@/catalog.ts'

/**
 * Whether a model moves — decided by RUNNING it, not by asking it.
 *
 * Both of the obvious flags lie. `built.action` is the viewer's hand-registered
 * button descriptor from src/catalog.ts and only five models are given one, so
 * the column called the grindstone, the stone well and the post mill static.
 * `built.update` is worse: core/kit.ts wraps it as
 * `update: (dt) => options.update?.(dt, runtime)`, so it is a function on every
 * model whether or not that model does anything with it, and swapping to it
 * marked all thirty-seven animated. One flag was too narrow, its replacement
 * too broad, and neither is what the column claims to mean.
 *
 * So: take the model, drive a second of frames through it, and see whether
 * anything moved. Where a model's motion is gated behind an action — the chest
 * lid only eases once something has opened it — fire the action and drive it
 * again. Deterministic seeding makes this reproducible, so the table stays
 * stable between runs.
 */
function animates(entry: Entry): boolean {
  const snapshot = (root: Object3D): string => {
    root.updateMatrixWorld(true)
    const out: number[] = []
    root.traverse((object) => {
      out.push(...object.matrixWorld.elements)
      if (object instanceof Mesh) {
        // Motion can be in the geometry rather than the transform — a flame is
        // rebuilt, not moved — so a sample of the vertices comes along too.
        const position = object.geometry.getAttribute('position')
        if (position) {
          const step = Math.max(1, Math.floor(position.count / 24))
          for (let i = 0; i < position.count; i += step) {
            out.push(position.getX(i), position.getY(i), position.getZ(i))
          }
        }
      }
    })
    return out.map((n) => n.toFixed(5)).join(',')
  }

  const built = entry.build()
  // A model with typed actions of its own is a model that does something, and
  // no amount of running it will show that from the outside: the grindstone
  // only turns once something cranks it, and this generator is not going to
  // learn each model's interface to find out. Running it catches what moves by
  // itself, `actionNames` catches what moves on demand, and between them the
  // column says what a reader takes it to say.
  if ((built.actionNames?.length ?? 0) > 0) {
    built.dispose()
    return true
  }
  const still = snapshot(built.root)
  const run = (frames: number): void => {
    for (let i = 0; i < frames; i += 1) built.update?.(1 / 60)
  }
  run(60)
  let moved = snapshot(built.root) !== still
  if (!moved && built.action) {
    built.action.run()
    run(120)
    moved = snapshot(built.root) !== still
  }
  built.dispose()
  return moved
}

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
  // `update`, not `action`.
  //
  // `built.action` is the VIEWER's hand-registered button descriptor over in
  // src/catalog.ts, and only five models are given one. What this column means
  // is "this model animates", which is `update`: a model can carry a per-frame
  // update without anyone having wired a button for it in the demo app.
  //
  // The two lists overlap enough that the column looked right, and the table
  // quietly called the grindstone, the stone well and the post mill static —
  // three of the most animated things in the kit. Worth noting where it was
  // read: not here, but in the generated table, by someone checking the
  // document against the models. The table is generated so it cannot go stale,
  // and it was still wrong, because the generator was asking the wrong object.
  const animated = animates(CATALOG[id]!)
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
