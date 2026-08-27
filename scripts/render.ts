/**
 * Offline model viewer — no browser, no GPU.
 *
 * The renderer itself lives in `raster.ts`; this is the command line over it,
 * and the place where the ways of looking at a model are defined: one large,
 * all of them on a contact sheet, one across a parameter sweep, one turning on
 * the spot.
 *
 * Usage:
 *   bun scripts/render.ts                    → all of them + contact sheet
 *   bun scripts/render.ts --one wooden-chest → one model, large
 *   bun scripts/render.ts --size 640
 *   bun scripts/render.ts --one hand-cart --angles 8   → turntable
 *   bun scripts/render.ts --one hoe --sweep bladeAngle=0.2|0.4|0.6
 *   bun scripts/render.ts --ground 0b0e12    → flat background, not the gradient
 */
import { mkdir, writeFile } from 'node:fs/promises'

import { encodePng, renderOne, tile, toLinear, type Frame } from './raster.ts'
import { CATALOG } from '@/catalog.ts'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}

const outDir = flag('out') ?? 'renders'
const one = flag('one')
const size = Number(flag('size') ?? (one ? 720 : 300))
const tall = Number(flag('height') ?? size)

const only = flag('ids')?.split(',')

const groundHex = flag('ground')
const ground = groundHex ? toLinear(groundHex) : undefined

await mkdir(outDir, { recursive: true })

function ids0(): string {
  throw new Error('--sweep needs --one <model>')
}

// Sweep: puts the same model side by side with different values of a single
// parameter. Picking a ratio by eye is far faster than changing the number and
// looking at each one on its own — that is how I picked the hoe's blade angle.
// Turntable: rotates the same model around the Y axis at equal steps and puts
// the results side by side. A single 3/4 angle can mislead — the fence only
// looks "thin" straight from the side, the besom only "sparse" from above.
const angles = Number(flag('angles') ?? 0)
if (angles > 1) {
  const target = one ?? (only?.[0])
  if (!target) throw new Error('--angles needs --one <model> or --ids')
  const frames = Array.from({ length: angles }, (_, i) =>
    renderOne(target, { size, ground, spin: (i / angles) * Math.PI * 2 }))
  await writeFile(`${outDir}/_turntable.png`, encodePng(tile(frames, size, angles, ground)))
  console.log(`${target} · ${angles} angles → ${outDir}/_turntable.png`)
  process.exit(0)
}

const sweep = flag('sweep')
if (sweep) {
  const [key, values] = sweep.split('=')
  const list = values!.split('|').map(Number)
  const target = one ?? ids0()
  const rendered = list.map((value) => renderOne(target, { size, ground, patch: { [key!]: value } }))
  await writeFile(`${outDir}/_sweep.png`, encodePng(tile(rendered, size, list.length, ground)))
  console.log(`${target} · ${key} = ${list.join(', ')} → ${outDir}/_sweep.png`)
  process.exit(0)
}

const ids = one ? [one]
  // `kit` is the whole catalogue arranged in one scene, not a model. Squeezed
  // into a cell of the contact sheet it is an illegible smear, and it was the
  // FIRST cell — the top left of the image this README opens with. It gets
  // rendered on its own instead: `bun scripts/render.ts --one kit`.
  : only ?? Object.keys(CATALOG).filter((id) => id !== 'pressure-gauge' && id !== 'kit')
const frames = new Map<string, Frame>()

for (const id of ids) {
  const frame = renderOne(id, { size, tall, ground })
  frames.set(id, frame)
  await writeFile(`${outDir}/${id}.png`, encodePng(frame))
  console.log(`  ${id}`)
}

if (!one && frames.size > 1) {
  // Contact sheet: all of them in one image. Seeing the models side by side
  // instead of opening them one by one exposes the scale and tone
  // inconsistencies between them — the kind of bug you miss looking at one.
  const columns = Number(flag('columns') ?? 6)
  const sheet = tile([...frames.values()], size, columns, ground)
  await writeFile(`${outDir}/_sheet.png`, encodePng(sheet))
  console.log(`\n${frames.size} models → ${outDir}/_sheet.png (${sheet.width}×${sheet.height})`)
}
