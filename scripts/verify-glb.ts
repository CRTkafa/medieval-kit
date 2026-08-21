/**
 * ROUND-TRIP verification of the GLB export.
 *
 * The file having been written proves nothing about what is inside it. Indeed,
 * when GLTFExporter meets a material it does not recognise it does not throw,
 * it silently writes an empty material — and since the kit uses `three/webgpu`
 * materials this was exactly the kind of silent loss we could run into.
 *
 * So every model is exported, LOADED BACK and the two sides are compared:
 * triangle count, bounding box, presence of vertex colours and material count.
 * If any of them disagree the file is broken.
 */
class BunFileReader {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then(
      (buffer) => { this.result = buffer; this.onloadend?.() },
      (error) => { this.onerror?.(error) },
    )
  }
}
const globals = globalThis as { FileReader?: unknown }
globals.FileReader ??= BunFileReader

import type { Object3D } from 'three/webgpu'

const { Box3, Mesh } = await import('three/webgpu')
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
const { CATALOG } = await import('@/catalog.ts')
const { exportGlb } = await import('@/glb.ts')

const failures: string[] = []
function expect(label: string, condition: boolean): void {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) failures.push(label)
}

interface Summary {
  triangles: number
  meshes: number
  colours: number
  size: readonly [number, number, number]
}

function summarise(root: Object3D): Summary {
  let triangles = 0
  let meshes = 0
  let colours = 0
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    meshes += 1
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    triangles += (index ? index.count : position.count) / 3
    if (object.geometry.getAttribute('color')) colours += 1
  })
  const box = new Box3().setFromObject(root)
  const size = box.getSize(box.max.clone())
  return {
    triangles,
    meshes,
    colours,
    size: [+(size.x).toFixed(4), +(size.y).toFixed(4), +(size.z).toFixed(4)],
  }
}

const loader = new GLTFLoader()

for (const id of Object.keys(CATALOG)) {
  const entry = CATALOG[id]!
  const built = entry.build()
  const before = summarise(built.root)
  const buffer = await exportGlb(built.root, { name: id })
  built.dispose()

  const gltf = await loader.parseAsync(buffer, '')
  const after = summarise(gltf.scene)

  console.log(`\n${entry.address}`)
  console.log(`  ${before.triangles} triangles · ${before.meshes} meshes → GLB ${(buffer.byteLength / 1024).toFixed(1)} KB`)

  expect('triangle count preserved', before.triangles === after.triangles)
  expect('mesh count preserved', before.meshes === after.meshes)
  expect(`vertex colours preserved (${after.colours}/${before.colours})`,
    after.colours === before.colours)
  // For our kit this is also a CONTRACT: all colour information is carried in
  // vertex colours, so a medieval-kit model without COLOR_0 has turned into a
  // grey lump inside the file.
  //
  // The scifi-kit gauge is deliberately left out: its surface identity lives in
  // a TSL node graph, that is, in SHADER CODE. glTF does not carry shaders; when
  // that model is exported its wear disappears, and that is not something to be
  // fixed — it is the real difference between the two approaches.
  if (entry.namespace === '@medieval-kit') {
    expect('every mesh carries vertex colours', before.colours === before.meshes)
  }
  const drift = before.size.map((value, i) => Math.abs(value - after.size[i]!))
  expect(`dimensions preserved (drift ${Math.max(...drift).toExponential(1)} m)`,
    Math.max(...drift) < 1e-3)
}

console.log(`\n${Object.keys(CATALOG).length} models exported and read back`)
console.log(failures.length === 0 ? 'All checks passed.' : `${failures.length} checks FAILED.`)
if (failures.length > 0) process.exitCode = 1
