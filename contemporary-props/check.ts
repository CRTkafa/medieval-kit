/**
 * Checks one model, straight from the folder it is written in.
 *
 *   bun contemporary-props/check.ts ceramic-vase
 *   bun contemporary-props/check.ts ceramic-vase --size 900 --angles 6
 *
 * Why this exists rather than reusing the kit-wide gate: the gate rebuilds the
 * registry and reinstalls it into the demo before it checks anything, and those
 * two steps write files the whole repository shares. One person can run them
 * safely. Several workers cannot, because each install overwrites the last and
 * every one of them then verifies somebody else's code. That has already
 * happened once here: a cart was fixed, the reinstall was skipped, and the old
 * geometry passed while the new geometry was never looked at.
 *
 * So this touches nothing outside `renders/`. It imports the model directly,
 * builds it, measures it, asks whether any of it floats, and draws it. The
 * kit-wide gate still runs afterwards, once, in one place.
 *
 * The render is the point. Every measurement below can pass on a model that
 * looks nothing like the thing it is named after, and no geometric check ever
 * written can say "that is not a vase".
 */
import { mkdir, writeFile } from 'node:fs/promises'

import { Box3, Vector3, type Object3D } from 'three/webgpu'

import { encodePng, renderObject, tile, type Frame } from '../scripts/raster.ts'
import { findFloating } from '../scripts/support.ts'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}

const id = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true)
if (!id) throw new Error('usage: bun contemporary-props/check.ts <model-id> [--size N] [--angles N]')

const size = Number(flag('size') ?? 720)
const angles = Number(flag('angles') ?? 0)
const outDir = 'contemporary-props/renders'

const module_ = await import(`./models/${id}/model.ts`) as {
  createModel?: (overrides?: Record<string, unknown>) => {
    root: Object3D
    parts: Record<string, unknown>
    actions?: Record<string, unknown>
    getConfig(): Record<string, unknown>
    update(dt: number): void
    dispose(): void
  }
}
if (!module_.createModel) throw new Error(`${id}/model.ts does not export createModel`)

const model = module_.createModel()
model.update(0.42)   // catch anything animated mid-motion
model.root.updateMatrixWorld(true)

/* ----------------------------------------------------------------- measure */

let triangles = 0
const slots = new Set<string>()
model.root.traverse((object) => {
  const mesh = object as { isMesh?: boolean; geometry?: { getIndex(): { count: number } | null; getAttribute(n: string): { count: number } }; userData?: Record<string, { materialSlot?: string }> }
  if (!mesh.isMesh || !mesh.geometry) return
  const index = mesh.geometry.getIndex()
  triangles += (index ? index.count : mesh.geometry.getAttribute('position').count) / 3
  const slot = mesh.userData?.vibe3d?.materialSlot
  if (slot) slots.add(slot)
})

const box = new Box3().setFromObject(model.root)
const size3 = box.getSize(new Vector3())
const support = findFloating(model.root, { resolution: 96 })

console.log(`\n${id}`)
console.log(`  ${triangles} triangles · ${size3.x.toFixed(2)} x ${size3.y.toFixed(2)} x ${size3.z.toFixed(2)} m`)
console.log(`  parts:  ${Object.keys(model.parts).join(', ') || '(none)'}`)
console.log(`  slots:  ${[...slots].sort().join(', ') || '(none)'}`)
console.log(`  actions: ${Object.keys(model.actions ?? {}).join(', ') || '(none)'}`)
console.log(`  config: ${Object.keys(model.getConfig()).join(', ')}`)

/* -------------------------------------------------------------- structure */

let failed = false
const fail = (message: string): void => { console.log(`  FAIL  ${message}`); failed = true }

if (triangles === 0) fail('no geometry at all')
if (!Number.isFinite(size3.x + size3.y + size3.z)) fail('bounds are not finite')
if (support.floating.length > 0) {
  fail(`${support.floating.length} piece(s) float, in ${support.components} components:`)
  for (const piece of support.floating) {
    console.log(`          ${(piece.clearance * 1000).toFixed(0)}mm clear, ${piece.voxels} voxels, parts: ${piece.parts.join(', ')}`)
  }
} else {
  console.log(`  rests on the ground · ${support.components} connected component(s)`)
}

/* ---------------------------------------------------------------- picture */

await mkdir(outDir, { recursive: true })
let frame: Frame
if (angles > 1) {
  // A single three-quarter view is how a model gets called finished while it is
  // still wrong from the other side. The fence only looks thin edge on.
  const frames: Frame[] = []
  for (let i = 0; i < angles; i += 1) {
    const spun = module_.createModel!()
    spun.update(0.42)
    frames.push(renderObject(spun.root, { size, spin: (i / angles) * Math.PI * 2 }))
    spun.dispose()
  }
  frame = tile(frames, size, angles)
} else {
  frame = renderObject(model.root, { size })
}
const file = `${outDir}/${id}${angles > 1 ? '-turntable' : ''}.png`
await writeFile(file, encodePng(frame))
console.log(`\n  ${file} — now LOOK at it`)

model.dispose()
process.exit(failed ? 1 : 0)
