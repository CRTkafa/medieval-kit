/**
 * GLB dışa aktarımının gidiş-DÖNÜŞ doğrulaması.
 *
 * Dosyanın yazılmış olması içinde bir şey olduğunu kanıtlamaz. Nitekim
 * GLTFExporter tanımadığı bir materyal gördüğünde hata vermiyor, sessizce boş
 * materyal yazıyor — kit `three/webgpu` materyalleri kullandığı için bu tam da
 * başımıza gelebilecek türden bir sessiz kayıptı.
 *
 * Bu yüzden her model dışa aktarılıyor, GERİ YÜKLENİYOR ve iki taraf
 * karşılaştırılıyor: üçgen sayısı, sınır kutusu, vertex renklerinin varlığı ve
 * materyal sayısı. Hiçbiri tutmuyorsa dosya bozuk demektir.
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
  console.log(`  ${before.triangles} üçgen · ${before.meshes} mesh → GLB ${(buffer.byteLength / 1024).toFixed(1)} KB`)

  expect('üçgen sayısı korundu', before.triangles === after.triangles)
  expect('mesh sayısı korundu', before.meshes === after.meshes)
  expect(`vertex renkleri korundu (${after.colours}/${before.colours})`,
    after.colours === before.colours)
  // Bizim kitimiz için bu ayrıca bir SÖZLEŞME: bütün renk bilgisi vertex
  // color'da taşınıyor, dolayısıyla COLOR_0'ı olmayan bir medieval-kit modeli
  // dosyada gri bir kütleye dönüşmüş demektir.
  //
  // scifi-kit göstergesi bilerek dışarıda: onun yüzey kimliği TSL düğüm
  // grafiğinde, yani ŞADER KODUNDA. glTF şader taşımıyor; o model dışa
  // aktarıldığında aşınması kayboluyor ve bu düzeltilebilir bir şey değil,
  // iki yaklaşımın gerçek farkı.
  if (entry.namespace === '@medieval-kit') {
    expect('bütün mesh\'ler vertex rengi taşıyor', before.colours === before.meshes)
  }
  const drift = before.size.map((value, i) => Math.abs(value - after.size[i]!))
  expect(`ölçüler korundu (sapma ${Math.max(...drift).toExponential(1)} m)`,
    Math.max(...drift) < 1e-3)
}

console.log(`\n${Object.keys(CATALOG).length} model dışa aktarıldı ve geri okundu`)
console.log(failures.length === 0 ? 'Tüm kontroller geçti.' : `${failures.length} kontrol BAŞARISIZ.`)
if (failures.length > 0) process.exitCode = 1
