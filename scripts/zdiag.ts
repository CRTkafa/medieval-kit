import { createModel } from '@/models/medieval-kit/wooden-fence/model.ts'
import { findZFighting } from './zfight.ts'
for (const patch of [{}, { rough: 0 }, { railCount: 1 }]) {
  const m = createModel(patch as never)
  m.root.updateMatrixWorld(true)
  const r = findZFighting(m.root)
  console.log(JSON.stringify(patch), '→ çakışma', r.overlaps)
  for (const s of r.samples.slice(0, 4)) console.log('   ', s)
  m.dispose()
}
