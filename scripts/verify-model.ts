/**
 * Kurulan modelleri tarayıcı olmadan doğrular.
 *
 * vibe3d'nin conformance listesinden gerçekten test edilebilir olanlar:
 * sonlu geometri ve geçerli sınırlar, configure() sonrası kök nesnenin
 * kimliğini koruması, materyal sahipliği ve idempotent dispose().
 *
 * Buna ek olarak kendi kitimiz için sarım (winding) denetimi var — elle
 * yazılmış geometride yanlış sarım sessizce içten görünen yüzler bırakır ve
 * bu ancak belirli bir kamera açısında fark edilir. İki ayrı ölçüt kullanılıyor
 * çünkü iki ayrı geometri türü var: dönel gövdeler için radyal hizalama,
 * kapalı katılar için işaretli hacim.
 *
 * Çalıştır: bun scripts/verify-model.ts
 */
import { Box3, Mesh, MeshStandardMaterial, PointLight, Vector3, type Object3D } from 'three/webgpu'

import { findZFighting } from './zfight.ts'
import { createModel as createGauge } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'
import { createModel as createCrate } from '@/models/medieval-kit/wooden-crate/model.ts'
import { createModel as createBrazier } from '@/models/medieval-kit/iron-brazier/model.ts'

const failures: string[] = []
function expect(label: string, condition: boolean): void {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) failures.push(label)
}

/* ------------------------------------------------------------------ ölçüm */

interface GeometryReport {
  meshes: number
  triangles: number
  nonFinitePositions: number
  sizeMetres: [number, number, number]
}

function inspect(root: Object3D): GeometryReport {
  let meshes = 0
  let triangles = 0
  let nonFinitePositions = 0

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    meshes += 1
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    triangles += (index ? index.count : position.count) / 3
    const array = position.array as ArrayLike<number>
    for (let i = 0; i < array.length; i += 1) {
      if (!Number.isFinite(array[i])) nonFinitePositions += 1
    }
  })

  const size = new Box3().setFromObject(root).getSize(new Vector3())
  return {
    meshes,
    triangles,
    nonFinitePositions,
    sizeMetres: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)],
  }
}

/**
 * Bir parçanın altındaki ilk Mesh.
 *
 * Anchor'ın doğrudan çocuğu artık mesh DEĞİL, değiştirilebilir content
 * Group'u — protokolün gerektirdiği yapı bu. Test de o yüzden aşağı iniyor.
 */
function firstMesh(part: { anchor: Object3D }): Mesh {
  let found: Mesh | undefined
  part.anchor.traverse((object) => {
    if (!found && object instanceof Mesh) found = object
  })
  if (!found) throw new Error(`${part.anchor.name} altında mesh yok`)
  return found
}

/** Dünya uzayındaki tüm üçgenleri toplar. */
function worldTriangles(root: Object3D): Array<[Vector3, Vector3, Vector3]> {
  const triangles: Array<[Vector3, Vector3, Vector3]> = []
  root.updateWorldMatrix(true, true)
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    const count = index ? index.count : position.count
    for (let i = 0; i < count; i += 3) {
      const corners = [0, 1, 2].map((k) => {
        const vertex = index ? index.getX(i + k) : i + k
        return object.localToWorld(new Vector3().fromBufferAttribute(position, vertex))
      }) as [Vector3, Vector3, Vector3]
      triangles.push(corners)
    }
  })
  return triangles
}

/**
 * Dönel gövdeler için: dış kabuğun RADYAL yüzeyleri eksenden dışa bakmalı.
 *
 * Ölçüt: yüzey normali · (eksenden ağırlık merkezine birim vektör).
 * Dışa bakanda +1'e, ters sarımda -1'e yakın.
 *
 * Kritik ayrım: tahtaların yan (boşluk) yüzeyleri teğetseldir, yani bu çarpım
 * onlar için tanımı gereği ~0'dır ve işareti sadece kayan nokta gürültüsüdür.
 * Radyal bir test onları yargılayamaz, o yüzden ayıklanır ve kaç tane
 * ayıklandığı raporlanır — sessizce elenmezler.
 */
const RADIAL_THRESHOLD = 0.5

function radialWinding(root: Object3D, shellRatio = 0.94): {
  radialFaces: number
  inwardFaces: number
  tangentialSkipped: number
} {
  const triangles = worldTriangles(root)
  let maxRadius = 0
  for (const [a, b, c] of triangles) {
    const centroid = a.clone().add(b).add(c).divideScalar(3)
    maxRadius = Math.max(maxRadius, Math.hypot(centroid.x, centroid.z))
  }

  let radialFaces = 0
  let inwardFaces = 0
  let tangentialSkipped = 0

  for (const [a, b, c] of triangles) {
    const centroid = a.clone().add(b).add(c).divideScalar(3)
    if (Math.hypot(centroid.x, centroid.z) < maxRadius * shellRatio) continue

    const normal = new Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
    if (normal.lengthSq() === 0) continue
    normal.normalize()
    if (Math.abs(normal.y) > 0.7) continue

    const outward = new Vector3(centroid.x, 0, centroid.z).normalize()
    const alignment = normal.dot(outward)

    if (Math.abs(alignment) < RADIAL_THRESHOLD) {
      tangentialSkipped += 1
      continue
    }
    radialFaces += 1
    if (alignment < 0) inwardFaces += 1
  }

  return { radialFaces, inwardFaces, tangentialSkipped }
}

/**
 * Kapalı katılar için: işaretli hacim.
 *
 * Kapalı bir yüzeyin hacmi Σ a·(b×c)/6 ile bulunur. Sarım dışa bakıyorsa
 * pozitif, içe bakıyorsa negatif çıkar. Sandık tamamen kapalı kutulardan
 * kurulu olduğu için bu ölçüt orada radyal testten daha keskin.
 */
function signedVolume(root: Object3D): number {
  let volume = 0
  for (const [a, b, c] of worldTriangles(root)) {
    volume += a.dot(new Vector3().crossVectors(b, c)) / 6
  }
  return volume
}

/**
 * Eş düzlemli çakışma denetimi.
 *
 * Aynı düzlemde, aynı yöne bakan ve alanları örtüşen iki yüzey, kamera
 * oynadıkça sırayla kazanır ve yüzey titrer. Kenardan değen yüzeyler sorun
 * değildir, o yüzden ölçüt gerçek alan örtüşmesi.
 *
 * Bu kontrol gözle bulunan bir hatadan sonra eklendi: sandığın dikmeleri, yan
 * tahtaları ve kapağı dış yüzeylerini aynı düzleme koyuyordu.
 */
function checkNoZFighting(label: string, root: Object3D): void {
  const report = findZFighting(root)
  console.log(`  ${label}: ${report.faces} yüz · eş düzlem grubu ${report.coplanarGroups} · çakışma ${report.overlaps}`)
  for (const sample of report.samples) console.log(`      ${sample}`)
  expect(`${label} eş düzlemli çakışma yok`, report.overlaps === 0)
}

/* ----------------------------------------------------- ortak protokol testi */

interface ProtocolModel {
  root: Object3D
  parts: Record<string, { anchor: Object3D; content: Object3D }>
  materials: { get(slot: string): unknown; override(slot: string, material: never): void }
  configure(patch: Record<string, number>): { rebuilt: boolean }
  dispose(): void
}

function checkOwnership(model: ProtocolModel, ownSlot: string, borrowSlot: string): void {
  let ownDisposed = false
  ;(model.materials.get(ownSlot) as MeshStandardMaterial)
    .addEventListener('dispose', () => { ownDisposed = true })

  let borrowedDisposed = false
  const borrowed = new MeshStandardMaterial({ name: 'consumer-owned' })
  borrowed.addEventListener('dispose', () => { borrowedDisposed = true })
  model.materials.override(borrowSlot, borrowed as never)
  expect('override materyali geri okunuyor', model.materials.get(borrowSlot) === borrowed)

  model.dispose()
  model.dispose()
  expect('modelin kendi materyali dispose edildi', ownDisposed)
  expect('ödünç materyale dokunulmadı', !borrowedDisposed)
  expect('dispose() idempotent (iki kez çağrıldı, hata yok)', true)
}

function checkStableIdentity(
  model: ProtocolModel,
  anchorName: string,
  patch: Record<string, number>,
): void {
  const rootBefore = model.root
  const anchorBefore = model.parts[anchorName]!.anchor
  const result = model.configure(patch)
  expect('configure() rebuilt=true bildiriyor', result.rebuilt)
  expect('kök nesne kimliği korundu', model.root === rootBefore)
  expect('anchor nesne kimliği korundu', model.parts[anchorName]!.anchor === anchorBefore)
  expect('değişmeyen patch rebuilt=false', model.configure(patch).rebuilt === false)
}

/* ------------------------------------------------------------------ testler */

console.log('\n@scifi-kit/pressure-gauge')
{
  const gauge = createGauge()
  const report = inspect(gauge.root)
  console.log(`  ${report.meshes} mesh · ${report.triangles} üçgen · ${report.sizeMetres.join(' x ')} m`)

  expect('geometri üretildi', report.meshes > 0 && report.triangles > 0)
  expect('NaN/Infinity vertex yok', report.nonFinitePositions === 0)
  expect('sınırlar sonlu', report.sizeMetres.every(Number.isFinite))

  const before = new Map<Object3D, number>()
  gauge.root.traverse((object) => before.set(object, object.rotation.z))
  gauge.triggerPressureTest()
  for (let i = 0; i < 30; i += 1) gauge.update(1 / 60)
  let animated = 0
  gauge.root.traverse((object) => {
    if (Math.abs(object.rotation.z - (before.get(object) ?? 0)) > 1e-6) animated += 1
  })
  expect('update() ibreyi hareket ettiriyor', animated === 1)

  gauge.dispose()
  gauge.dispose()
  expect('dispose() idempotent (iki kez çağrıldı, hata yok)', true)
}

console.log('\n@medieval-kit/wooden-barrel')
{
  const barrel = createBarrel()
  const report = inspect(barrel.root)
  console.log(`  ${report.meshes} mesh · ${report.triangles} üçgen · ${report.sizeMetres.join(' x ')} m`)

  expect('geometri üretildi', report.meshes > 0 && report.triangles > 0)
  expect('NaN/Infinity vertex yok', report.nonFinitePositions === 0)
  expect('üç semantik parça (tahtalar, kapaklar, çemberler)', report.meshes === 3)
  expect('lowpoly bütçesinde (< 1500 üçgen)', report.triangles < 1500)

  checkNoZFighting('z-fight', barrel.root)

  const winding = radialWinding(barrel.root)
  console.log(
    `  radyal dış yüz: ${winding.radialFaces} · ters sarım: ${winding.inwardFaces}` +
    ` · teğetsel (yargılanamaz, atlandı): ${winding.tangentialSkipped}`,
  )
  expect('dış kabukta ters sarım yok', winding.inwardFaces === 0)
  expect('test anlamlı sayıda radyal yüz gördü', winding.radialFaces >= 50)

  const colour = firstMesh(barrel.parts.staves).geometry.getAttribute('color')
  const distinct = new Set<string>()
  for (let i = 0; i < colour.count; i += 1) {
    distinct.add(`${colour.getX(i).toFixed(3)},${colour.getY(i).toFixed(3)},${colour.getZ(i).toFixed(3)}`)
  }
  expect(`tahta başına ayrı ton (${distinct.size} farklı renk)`, distinct.size >= 10)

  const twinA = createBarrel({ seed: 21 })
  const twinB = createBarrel({ seed: 21 })
  const other = createBarrel({ seed: 22 })
  const firstVertex = (model: ReturnType<typeof createBarrel>): string => {
    const position = firstMesh(model.parts.staves).geometry.getAttribute('position')
    return `${position.getX(0)},${position.getY(0)},${position.getZ(0)}`
  }
  expect('aynı tohum aynı geometri', firstVertex(twinA) === firstVertex(twinB))
  expect('farklı tohum farklı geometri', firstVertex(twinA) !== firstVertex(other))
  twinA.dispose(); twinB.dispose(); other.dispose()

  checkStableIdentity(barrel as unknown as ProtocolModel, 'staves', { staveCount: 22, hoopCount: 6 })
  expect('yeni topoloji üretildi', inspect(barrel.root).triangles > report.triangles)
  checkOwnership(barrel as unknown as ProtocolModel, 'iron', 'oak')
}

console.log('\n@medieval-kit/wooden-crate')
{
  const crate = createCrate()
  const report = inspect(crate.root)
  console.log(`  ${report.meshes} mesh · ${report.triangles} üçgen · ${report.sizeMetres.join(' x ')} m`)

  expect('geometri üretildi', report.meshes > 0 && report.triangles > 0)
  expect('NaN/Infinity vertex yok', report.nonFinitePositions === 0)
  expect('üç semantik parça (dikmeler, tahtalar, kayışlar)', report.meshes === 3)
  expect('lowpoly bütçesinde (< 1500 üçgen)', report.triangles < 1500)

  // Sandık tamamen kapalı kutulardan kurulu, yani işaretli hacmi pozitif olmalı.
  const volume = signedVolume(crate.root)
  const boundingVolume = report.sizeMetres[0] * report.sizeMetres[1] * report.sizeMetres[2]
  console.log(`  işaretli hacim: ${volume.toFixed(4)} m³ · sınır kutusu: ${boundingVolume.toFixed(4)} m³`)
  expect('işaretli hacim pozitif (sarım dışa bakıyor)', volume > 0)
  expect('hacim sınır kutusundan küçük (içi boş sandık)', volume < boundingVolume * 0.6)

  // Üretilen içerik content'te; anchor her zaman o content Group'unu taşır.
  expect('kayışsız yapılandırma çalışıyor',
    createCrate({ strapCount: 0 }).parts.straps.content.children.length === 0)

  // Sandık tamamen kutulardan kurulu, yani z-fighting'e en açık model.
  // Birkaç yapılandırmada birden denetleniyor.
  checkNoZFighting('z-fight (varsayılan)', crate.root)
  for (const variant of [{ plankRows: 1 }, { plankRows: 6 }, { strapCount: 4 }]) {
    const sample = createCrate(variant)
    checkNoZFighting(`z-fight ${JSON.stringify(variant)}`, sample.root)
    sample.dispose()
  }

  checkStableIdentity(crate as unknown as ProtocolModel, 'planks', { plankRows: 5, strapCount: 3 })
  checkOwnership(crate as unknown as ProtocolModel, 'iron', 'oak')
}

console.log('\n@medieval-kit/iron-brazier')
{
  const brazier = createBrazier()
  const report = inspect(brazier.root)
  console.log(`  ${report.meshes} mesh · ${report.triangles} üçgen · ${report.sizeMetres.join(' x ')} m`)

  expect('geometri üretildi', report.meshes > 0 && report.triangles > 0)
  expect('NaN/Infinity vertex yok', report.nonFinitePositions === 0)
  expect('lowpoly bütçesinde (< 1500 üçgen)', report.triangles < 1500)

  // Kâsenin dış kabuğu dönel; ayaklar ve kömürler dış yarıçapın altında kaldığı
  // için bu filtre onları zaten eliyor.
  checkNoZFighting('z-fight', brazier.root)

  const winding = radialWinding(brazier.root, 0.97)
  console.log(
    `  radyal dış yüz: ${winding.radialFaces} · ters sarım: ${winding.inwardFaces}` +
    ` · teğetsel (atlandı): ${winding.tangentialSkipped}`,
  )
  expect('kâse dış kabuğunda ters sarım yok', winding.inwardFaces === 0)

  // Ateş ışığı modelin kendi parçası ve flame anchor'ında yaşıyor.
  const light = brazier.parts.flame.anchor.children.find((child) => child instanceof PointLight)
  expect('model bir PointLight taşıyor', light instanceof PointLight)

  // Tipli actions — fıçı ve sandıkta olmayan protokol parçası.
  expect('varsayılan olarak yanıyor', brazier.actions.isLit())

  const bladeScales = (): number[] => brazier.parts.flame.content.children
    .filter((child) => child.name.startsWith('iron-brazier/flame-'))
    .map((child) => child.scale.y)

  const restScales = bladeScales()
  expect('alev dilleri var', restScales.length === 5)
  for (let i = 0; i < 40; i += 1) brazier.update(1 / 60)
  const movedScales = bladeScales()
  const moved = movedScales.some((value, i) => Math.abs(value - restScales[i]!) > 1e-4)
  expect('update() alevi titretiyor', moved)
  expect('ışık şiddeti sıfırdan büyük', (light as PointLight).intensity > 0)

  // Söndür: alev gizlenmeli, ışık kapanmalı, update() bir şey yapmamalı.
  brazier.actions.setLit(false)
  expect('setLit(false) sonrası isLit() false', !brazier.actions.isLit())
  expect('ışık kapandı', (light as PointLight).intensity === 0)
  expect('alev ve kor kömürler gizlendi', !brazier.parts.flame.content.visible)
  const beforeIdle = bladeScales()
  for (let i = 0; i < 40; i += 1) brazier.update(1 / 60)
  expect('sönükken update() hiçbir şeyi kıpırdatmıyor',
    bladeScales().every((value, i) => value === beforeIdle[i]))

  brazier.actions.setLit(true)
  expect('tekrar yakılabiliyor', brazier.actions.isLit())

  // Tüketici eklentisi rebuild'i atlatmalı — protokolün asıl vaadi bu.
  const marker = new PointLight(0x00ff00, 1)
  marker.name = 'consumer-marker'
  brazier.parts.bowl.anchor.add(marker)
  brazier.configure({ bowlSegments: 8 })
  expect('tüketicinin taktığı nesne rebuild sonrası duruyor',
    brazier.parts.bowl.anchor.children.includes(marker))
  expect('modelin ışığı rebuild sonrası duruyor',
    brazier.parts.flame.anchor.children.includes(light as PointLight))

  checkOwnership(brazier as unknown as ProtocolModel, 'iron', 'char')
}

console.log(failures.length === 0 ? '\nTüm kontroller geçti.' : `\n${failures.length} kontrol BAŞARISIZ.`)
if (failures.length > 0) process.exitCode = 1
