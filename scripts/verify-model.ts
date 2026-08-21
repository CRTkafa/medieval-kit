/**
 * Kurulan modelleri tarayıcı olmadan doğrular.
 *
 * Üç sınıf kontrol var:
 *
 *   1. Protokol — vibe3d'nin conformance listesinden gerçekten test
 *      edilebilenler: sonlu geometri, configure() sonrası kök ve anchor
 *      kimliğinin korunması, tüketici eklentisinin rebuild'i atlatması,
 *      materyal sahipliği, idempotent dispose().
 *   2. Sarım — elle yazılmış geometride ters sarım sessizce içten görünen
 *      yüzler bırakır. İki ölçüt var çünkü iki geometri türü var: dönel
 *      gövdeler için radyal hizalama, kapalı katılar için işaretli hacim.
 *   3. Z-fighting — aynı düzlemde, aynı yöne bakan, alanları örtüşen yüzeyler.
 *
 * Çalıştır: bun scripts/verify-model.ts
 */
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three/webgpu'

import { findZFighting } from './zfight.ts'
import { MODEL_META } from '../my-registry/meta.ts'
import { createModel as createGauge } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'
import { createModel as createCrate } from '@/models/medieval-kit/wooden-crate/model.ts'
import { createModel as createBucket } from '@/models/medieval-kit/wooden-bucket/model.ts'
import { createModel as createAnvil } from '@/models/medieval-kit/iron-anvil/model.ts'
import { createModel as createLadder } from '@/models/medieval-kit/wooden-ladder/model.ts'
import { createModel as createFence } from '@/models/medieval-kit/wooden-fence/model.ts'
import { createModel as createStool } from '@/models/medieval-kit/wooden-stool/model.ts'
import { createModel as createHoe } from '@/models/medieval-kit/wooden-hoe/model.ts'
import { createModel as createShovel } from '@/models/medieval-kit/wooden-shovel/model.ts'
import { createModel as createPitchfork } from '@/models/medieval-kit/wooden-pitchfork/model.ts'
import { createModel as createTable } from '@/models/medieval-kit/trestle-table/model.ts'
import { createModel as createWheel } from '@/models/medieval-kit/cart-wheel/model.ts'
import { createModel as createLogPile } from '@/models/medieval-kit/log-pile/model.ts'
import { createModel as createChest } from '@/models/medieval-kit/wooden-chest/model.ts'
import { createModel as createBench } from '@/models/medieval-kit/wooden-bench/model.ts'
import { createModel as createTorch } from '@/models/medieval-kit/pitch-torch/model.ts'
import { createModel as createBale } from '@/models/medieval-kit/hay-bale/model.ts'
import { createModel as createSack } from '@/models/medieval-kit/linen-sack/model.ts'
import { createModel as createBroom } from '@/models/medieval-kit/straw-broom/model.ts'
import { createModel as createTankard } from '@/models/medieval-kit/oak-tankard/model.ts'
import { createModel as createBell } from '@/models/medieval-kit/bronze-bell/model.ts'
import { createModel as createLantern } from '@/models/medieval-kit/iron-lantern/model.ts'
import { createModel as createSign } from '@/models/medieval-kit/tavern-sign/model.ts'
import { createModel as createBook } from '@/models/medieval-kit/leather-book/model.ts'
import { createModel as createPhial } from '@/models/medieval-kit/glass-phial/model.ts'
import { createModel as createPouch } from '@/models/medieval-kit/coin-pouch/model.ts'

const failures: string[] = []
function expect(label: string, condition: boolean): void {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) failures.push(label)
}

/* ------------------------------------------------------------------ ölçüm */

function inspect(root: Object3D) {
  let meshes = 0
  let triangles = 0
  let nonFinite = 0
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute('position')) return
    meshes += 1
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    triangles += (index ? index.count : position.count) / 3
    const array = position.array as ArrayLike<number>
    for (let i = 0; i < array.length; i += 1) if (!Number.isFinite(array[i])) nonFinite += 1
  })
  const size = new Box3().setFromObject(root).getSize(new Vector3())
  return {
    meshes,
    triangles,
    nonFinite,
    size: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)] as [number, number, number],
  }
}

function worldTriangles(root: Object3D): Array<[Vector3, Vector3, Vector3]> {
  const out: Array<[Vector3, Vector3, Vector3]> = []
  root.updateWorldMatrix(true, true)
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute('position')) return
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    const count = index ? index.count : position.count
    for (let i = 0; i < count; i += 3) {
      out.push([0, 1, 2].map((k) => {
        const v = index ? index.getX(i + k) : i + k
        return object.localToWorld(new Vector3().fromBufferAttribute(position, v))
      }) as [Vector3, Vector3, Vector3])
    }
  })
  return out
}

/**
 * Dönel gövdeler: dış kabuğun RADYAL yüzleri eksenden dışa bakmalı.
 *
 * "Dış kabuk" tanımı kritik. Tek bir yarıçap eşiği DARALAN gövdede çalışmaz:
 * koni biçimli bir kovada, duvarın üst kısmındaki İÇ yüzeyler bile alttaki dış
 * yüzeylerden geniş olur ve haklı olarak içe baktıkları hâlde "ters sarım"
 * sayılırlar. Bu yüzden karşılaştırma yüksekliğe göre yapılıyor: her üçgen,
 * kendi yükseklik bandındaki en büyük yarıçapla kıyaslanır.
 *
 * Teğetsel yüzler (tahtaların yan yüzleri) bu ölçütle yargılanamaz — çarpım
 * tanımı gereği ~0'dır ve işareti sadece kayan nokta gürültüsü. Ayıklanır ve
 * kaç tane ayıklandığı raporlanır; sessizce elenmez.
 */
function radialWinding(root: Object3D, shellRatio = 0.94) {
  const triangles = worldTriangles(root)
  if (triangles.length === 0) return { radial: 0, inward: 0, tangential: 0 }

  const centroids = triangles.map(([a, b, c]) => a.clone().add(b).add(c).divideScalar(3))
  let minY = Infinity
  let maxY = -Infinity
  for (const m of centroids) {
    minY = Math.min(minY, m.y)
    maxY = Math.max(maxY, m.y)
  }

  // Yükseklik bantları: her bandın kendi en geniş yarıçapı var.
  const BANDS = 12
  const span = Math.max(1e-9, maxY - minY)
  const bandOf = (y: number): number =>
    Math.min(BANDS - 1, Math.max(0, Math.floor(((y - minY) / span) * BANDS)))
  const bandMax = new Array<number>(BANDS).fill(0)
  for (const m of centroids) {
    const band = bandOf(m.y)
    bandMax[band] = Math.max(bandMax[band]!, Math.hypot(m.x, m.z))
  }

  let radial = 0
  let inward = 0
  let tangential = 0
  for (let i = 0; i < triangles.length; i += 1) {
    const [a, b, c] = triangles[i]!
    const m = centroids[i]!
    const limit = bandMax[bandOf(m.y)]!
    if (limit <= 0 || Math.hypot(m.x, m.z) < limit * shellRatio) continue

    const n = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a))
    if (n.lengthSq() === 0) continue
    n.normalize()
    if (Math.abs(n.y) > 0.7) continue

    const alignment = n.dot(new Vector3(m.x, 0, m.z).normalize())
    if (Math.abs(alignment) < 0.5) { tangential += 1; continue }
    radial += 1
    if (alignment < 0) inward += 1
  }
  return { radial, inward, tangential }
}

/**
 * Kapalı katılar: Σ a·(b×c)/6. Sarım dışa bakıyorsa pozitif çıkar.
 *
 * Sadece TAMAMEN kapalı modellerde geçerli. `bandGeometry` iç yüzeyi kasten
 * üretmiyor (görünmez, üçgen tasarrufu), o yüzden demir çember taşıyan
 * modellerde bu ölçüt kullanılamaz — onlarda radyal test var.
 */
function signedVolume(root: Object3D): number {
  let v = 0
  for (const [a, b, c] of worldTriangles(root)) v += a.dot(new Vector3().crossVectors(b, c)) / 6
  return v
}

/**
 * Kenar dengesi — tek bir ters yüzü yakalayan test.
 *
 * KAPALI bir yüzeyde her kenar iki yönde eşit sayıda geçer: komşu üçgenler
 * ortak kenarı ters yönlerde kullanır. Bir yüz ters çevrilirse o yüzün üç
 * kenarı dengeden çıkar.
 *
 * "Tekrarlanmasın" demek yanlış olurdu: kit modelleri ayrı katı cisimlerin
 * birleşimi ve küt ek yapan iki kutu aynı kenarı paylaşabilir — bu tasarım,
 * hata değil. Denge ise paylaşımdan etkilenmez, çünkü iki cisim o kenarı ters
 * yönlerde kullanır.
 *
 * Yalnızca kapalı modellerde geçerli: `bandGeometry` iç yüzeyi üretmediği için
 * sınır kenarları tek yönde kalır ve denge tanımı gereği bozulur.
 *
 * Bu test işaretli hacmin boşluğunu kapatıyor — orada kutunun bir yüzü ters
 * çevrildiğinde hacim 0.058'den 0.039'a düşüyor ama pozitif kalıp testi
 * geçiyordu.
 */
function edgeBalance(root: Object3D): { edges: number; unbalanced: number } {
  const counts = new Map<string, number>()
  const key = (v: Vector3): string =>
    `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`

  let edges = 0
  for (const [a, b, c] of worldTriangles(root)) {
    const ka = key(a), kb = key(b), kc = key(c)
    for (const [from, to] of [[ka, kb], [kb, kc], [kc, ka]] as const) {
      if (from === to) continue
      edges += 1
      // Yönsüz anahtar; yön işaretle taşınıyor.
      const forward = from < to
      const id = forward ? `${from}|${to}` : `${to}|${from}`
      counts.set(id, (counts.get(id) ?? 0) + (forward ? 1 : -1))
    }
  }
  let unbalanced = 0
  for (const value of counts.values()) if (value !== 0) unbalanced += 1
  return { edges, unbalanced }
}

/**
 * Modelin tam parmak izi: her mesh'in konum VE renk verisi.
 *
 * İlk vertex'e bakmak yetmiyordu: çoğu modelde tohum konumu değil rengi
 * değiştirir (örs, merdiven, aletler), o yüzden ilk vertex her tohumda aynı
 * çıkıyordu ve test yanlış yere BAŞARISIZ diyordu.
 */
function fingerprint(model: { root: Object3D }): string {
  let hash = 2166136261
  const mix = (value: number): void => {
    hash ^= Math.round(value * 1e6) | 0
    hash = Math.imul(hash, 16777619)
  }
  model.root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    for (const name of ['position', 'color'] as const) {
      const attribute = o.geometry.getAttribute(name)
      if (!attribute) continue
      const array = attribute.array as ArrayLike<number>
      for (let i = 0; i < array.length; i += 1) mix(array[i]!)
    }
  })
  return (hash >>> 0).toString(16)
}

/* --------------------------------------------------------- kit model testi */

interface KitModel {
  root: Object3D
  parts: Record<string, { anchor: Object3D; content: Object3D }>
  materials: { get(slot: string): unknown; override(slot: string, m: never): void }
  getConfig(): Readonly<Record<string, unknown>>
  configure(patch: Record<string, number>): { rebuilt: boolean }
  update(deltaSeconds: number): void
  dispose(): void
}

interface Case {
  readonly id: string
  make(overrides?: Record<string, number>): KitModel
  readonly patch: Record<string, number>
  readonly parts: number
  readonly ownSlot: string
  readonly borrowSlot: string
  /** Dönel gövde mi? */
  readonly radial?: boolean
  /**
   * Radyal test hangi parçaya uygulansın. Verilmezse kök.
   * Kovada gerekli: en geniş yarıçap KULPA ait, gövdeye değil — kök üzerinden
   * ölçmek kulbun yaylarını "dış kabuk" sanıp anlamsız sonuç veriyor.
   */
  readonly radialPart?: string
  /**
   * Dış kabuk sayılmak için en büyük yarıçapın hangi oranı yeterli.
   * Konik gövdelerde düşürülmeli: kovada 0.94 sadece en üst halkayı yakalıyor
   * ve test anlamlı bir örneklem göremiyor.
   */
  readonly shellRatio?: number
  /** Tamamen kapalı katı mı? */
  readonly closed?: boolean
  /** Z-fight için ek yapılandırmalar. */
  readonly variants?: ReadonlyArray<Record<string, number>>
  /**
   * Varsayılan yapılandırmada sınır kutusunun aşmaması gereken ölçüler.
   *
   * Bu kontrol bir hata sınıfını yakalamak için var: `rotate` her zaman ORIGIN
   * etrafında döner, dolayısıyla bir parçayı önce yerine koyup sonra
   * döndürmek onu savurur. Çapada tam bu olmuştu — ağız boynu 0.23 m öne
   * fırlamış, model 0.42 m derinliğe çıkmıştı ve hiçbir test itiraz etmemişti.
   */
  readonly maxSize?: readonly [number, number, number]
}

const as = <T>(make: (o?: never) => T) => (o?: Record<string, number>): KitModel =>
  (make as unknown as (x?: Record<string, number>) => KitModel)(o)

const CASES: readonly Case[] = [
  { id: 'wooden-barrel', make: as(createBarrel), patch: { staveCount: 22, hoopCount: 6 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak', radial: true , maxSize: [1, 1.2, 1] },
  { id: 'wooden-crate', make: as(createCrate), patch: { plankRows: 5, strapCount: 3 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak', closed: true,
    variants: [{ plankRows: 1 }, { plankRows: 6 }, { strapCount: 4 }] , maxSize: [0.9, 0.7, 0.75] },
  { id: 'wooden-bucket', make: as(createBucket), patch: { staveCount: 15, hoopCount: 3 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', radial: true, radialPart: 'staves',
    variants: [{ handle: 0 }, { hoopCount: 0 }] , maxSize: [0.45, 0.6, 0.45] },
  { id: 'iron-anvil', make: as(createAnvil), patch: { hornReach: 0.7 },
    parts: 5, ownSlot: 'steel', borrowSlot: 'iron', closed: true , maxSize: [0.6, 0.5, 0.3] },
  { id: 'wooden-ladder', make: as(createLadder), patch: { rungCount: 12 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ rungCount: 3 }, { taper: 0 }] , maxSize: [0.6, 2.4, 0.12] },
  { id: 'wooden-fence', make: as(createFence), patch: { sections: 5, railCount: 3 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ sections: 1 }, { railCount: 1 }, { railCount: 4 }] , maxSize: [5.2, 1.3, 0.2] },
  { id: 'wooden-stool', make: as(createStool), patch: { legCount: 4, splay: 0.35 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ legCount: 5 }, { splay: 0 }] , maxSize: [0.5, 0.55, 0.5] },
  { id: 'wooden-hoe', make: as(createHoe), patch: { bladeWidth: 0.24, bladeAngle: 120 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ bladeAngle: 90 }, { bladeWidth: 0.3 }] , maxSize: [0.25, 1.6, 0.3] },
  { id: 'wooden-shovel', make: as(createShovel), patch: { bladeWidth: 0.3, bladeLength: 0.36, dish: 0.22 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ bladeLength: 0.18 }, { bladeLength: 0.4 }, { dish: 0 }, { bladeAngle: 25 }] , maxSize: [0.3, 1.4, 0.15] },
  { id: 'wooden-pitchfork', make: as(createPitchfork), patch: { tineCount: 5, spread: 0.3 },
    parts: 3, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ tineCount: 2 }, { spread: 0 }, { tineCount: 6 }] , maxSize: [0.3, 1.9, 0.15] },
  { id: 'trestle-table', make: as(createTable), patch: { plankCount: 6, splay: 0.35 },
    parts: 3, ownSlot: 'oak', borrowSlot: 'oak', closed: true, maxSize: [2.2, 0.9, 1.3],
    variants: [{ plankCount: 2 }, { splay: 0 }] },
  { id: 'cart-wheel', make: as(createWheel), patch: { spokeCount: 14, tyre: 0.07 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', maxSize: [1.2, 1.2, 0.35],
    variants: [{ spokeCount: 6 }, { spokeCount: 16 }, { width: 0.16 }] },
  { id: 'wooden-chest', make: as(createChest), patch: { bandCount: 4, width: 1.1 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', closed: true,
    variants: [{ bandCount: 0 }, { bandCount: 1 }, { depth: 0.7 }] , maxSize: [1, 0.62, 0.62] },
  { id: 'wooden-bench', make: as(createBench), patch: { length: 2.1, splay: 0.4 },
    parts: 3, ownSlot: 'oak', borrowSlot: 'oak', closed: true,
    variants: [{ splay: 0 }, { inset: 0.02 }, { width: 0.45 }] , maxSize: [1.7, 0.5, 0.35] },
  { id: 'pitch-torch', make: as(createTorch), patch: { wrapLength: 0.42, flameHeight: 2.2 },
    parts: 3, ownSlot: 'char', borrowSlot: 'oak', radial: true, radialPart: 'shaft',
    variants: [{ flicker: 0 }, { radius: 0.04 }] , maxSize: [0.14, 0.95, 0.14] },
  { id: 'hay-bale', make: as(createBale), patch: { ropeCount: 3, wisps: 40 },
    parts: 3, ownSlot: 'cloth', borrowSlot: 'straw', closed: true,
    variants: [{ ropeCount: 0 }, { wisps: 0 }, { ropeCount: 1 }] , maxSize: [1.14, 0.68, 0.68] },
  { id: 'linen-sack', make: as(createSack), patch: { fill: 0.45, ears: 5 },
    parts: 3, ownSlot: 'cloth', borrowSlot: 'cloth', closed: true,
    variants: [{ ears: 0 }, { fill: 1 }, { collar: 0.28 }],
    maxSize: [0.5, 0.56, 0.5] },
  { id: 'straw-broom', make: as(createBroom), patch: { bristles: 70, flare: 0.55 },
    parts: 3, ownSlot: 'cloth', borrowSlot: 'oak',
    variants: [{ bindings: 0 }, { flare: 0 }, { bristles: 12 }],
    maxSize: [0.55, 1.3, 0.55] },
  { id: 'oak-tankard', make: as(createTankard), patch: { staveCount: 14, hoopCount: 3 },
    parts: 4, ownSlot: 'iron', borrowSlot: 'oak', radial: true, radialPart: 'staves',
    variants: [{ handle: 0 }, { hoopCount: 0 }, { taper: 0.25 }],
    maxSize: [0.13, 0.2, 0.19] },
  { id: 'bronze-bell', make: as(createBell), patch: { diameter: 0.5, yoke: 1.8 },
    // shellRatio yüksek: çan İÇİ BOŞ ve iç kabuğunun normalleri bilerek
    // eksene bakıyor. Düşük bir eşik onu "dış kabuk" sanıp haklı olarak
    // düşüyordu — burada ölçmek istediğimiz şey yalnızca dış yüzey.
    parts: 3, ownSlot: 'iron', borrowSlot: 'brass', radial: true, radialPart: 'bell',
    shellRatio: 0.93, variants: [{ height: 0.6 }, { yoke: 1 }],
    maxSize: [0.52, 0.55, 0.42] },
  { id: 'iron-lantern', make: as(createLantern), patch: { sides: 8, flameHeight: 0.3 },
    parts: 4, ownSlot: 'glass', borrowSlot: 'iron',
    variants: [{ sides: 4 }, { flicker: 0 }, { radius: 0.12 }],
    maxSize: [0.2, 0.36, 0.2] },
  { id: 'tavern-sign', make: as(createSign), patch: { plankCount: 4, width: 0.8 },
    parts: 2, ownSlot: 'iron', borrowSlot: 'oak',
    variants: [{ plankCount: 1 }, { drop: 0.3 }, { reach: 1 }],
    maxSize: [0.6, 0.85, 0.75] },
  { id: 'leather-book', make: as(createBook), patch: { bands: 5, clasps: 2 },
    parts: 3, ownSlot: 'brass', borrowSlot: 'leather', closed: true,
    variants: [{ bands: 0 }, { clasps: 0 }, { thickness: 0.14 }],
    maxSize: [0.25, 0.09, 0.3] },
  { id: 'glass-phial', make: as(createPhial), patch: { fill: 0.9, neck: 0.5 },
    parts: 3, ownSlot: 'ember', borrowSlot: 'glass', radial: true, radialPart: 'bottle',
    shellRatio: 0.85, variants: [{ fill: 0 }, { seal: 0 }, { hue: 0.7 }],
    maxSize: [0.09, 0.15, 0.09] },
  { id: 'coin-pouch', make: as(createPouch), patch: { coins: 18, fill: 0.4 },
    parts: 3, ownSlot: 'brass', borrowSlot: 'leather', radial: true, radialPart: 'pouch',
    shellRatio: 0.8, variants: [{ coins: 0 }, { fill: 1 }, { coinRadius: 0.02 }],
    maxSize: [0.32, 0.14, 0.32] },
  { id: 'log-pile', make: as(createLogPile), patch: { rows: 4, perRow: 7, variation: 0.4 },
    parts: 2, ownSlot: 'oak', borrowSlot: 'oak', maxSize: [1.6, 0.9, 0.9],
    variants: [{ rows: 1 }, { taperRows: 0 }, { perRow: 9 }] },
]

console.log('\n@scifi-kit/pressure-gauge')
{
  const gauge = createGauge()
  const r = inspect(gauge.root)
  console.log(`  ${r.meshes} mesh · ${r.triangles} üçgen · ${r.size.join(' x ')} m`)
  expect('geometri üretildi', r.meshes > 0 && r.triangles > 0)
  expect('NaN/Infinity vertex yok', r.nonFinite === 0)

  const before = new Map<Object3D, number>()
  gauge.root.traverse((o) => before.set(o, o.rotation.z))
  gauge.triggerPressureTest()
  for (let i = 0; i < 30; i += 1) gauge.update(1 / 60)
  let animated = 0
  gauge.root.traverse((o) => { if (Math.abs(o.rotation.z - (before.get(o) ?? 0)) > 1e-6) animated += 1 })
  expect('update() ibreyi hareket ettiriyor', animated === 1)
  gauge.dispose()
  gauge.dispose()
  expect('dispose() idempotent', true)
}

let totalTriangles = 0
for (const testCase of CASES) {
  console.log(`\n@medieval-kit/${testCase.id}`)
  const model = testCase.make()
  const report = inspect(model.root)
  totalTriangles += report.triangles
  console.log(`  ${report.meshes} mesh · ${report.triangles} üçgen · ${report.size.join(' x ')} m`)

  expect('geometri üretildi', report.meshes > 0 && report.triangles > 0)
  expect('NaN/Infinity vertex yok', report.nonFinite === 0)
  expect('sınırlar sonlu', report.size.every(Number.isFinite))
  expect('lowpoly bütçesinde (< 2500 üçgen)', report.triangles < 2500)
  if (testCase.maxSize) {
    const over = report.size
      .map((value, i) => (value > testCase.maxSize![i]! ? `${'xyz'[i]}=${value}>${testCase.maxSize![i]}` : ''))
      .filter(Boolean)
    expect(`ölçüler beklenen sınırlarda${over.length ? ' — AŞAN: ' + over.join(', ') : ''}`, over.length === 0)
  }
  expect(`${testCase.parts} semantik parça`, Object.keys(model.parts).length === testCase.parts)

  // --- Metadata modeli gerçekten anlatıyor mu? -----------------------------
  //
  // `my-registry/meta.ts` hem registry.json'a hem viewer kaydırıcılarına
  // kaynaklık ediyor. Yani oradaki bir yalanın iki ayrı yerde sonucu var:
  // registry tüketicisine yanlış sözleşme, viewer'a çalışmayan kaydırıcı.
  //
  // Bu kontrol daha önce derleyicinin yaptığı işin yerini alıyor ve ondan
  // geniş: eskiden yalnızca kaydırıcı anahtarları denetleniyordu, artık parça
  // adları ve materyal yuvaları da denetleniyor.
  if (testCase.id !== 'pressure-gauge') {
    const meta = MODEL_META[testCase.id]
    expect('meta girdisi var', meta !== undefined)
    if (meta) {
      const config = model.getConfig() as Record<string, unknown>
      const strayControls = Object.keys(meta.controls).filter((key) => !(key in config))
      expect(`meta.controls anahtarları config'te var${strayControls.length ? ' — YOK: ' + strayControls.join(', ') : ''}`,
        strayControls.length === 0)

      const declared = [...meta.parts].sort().join(',')
      const actual = Object.keys(model.parts).sort().join(',')
      expect(`meta.parts modelin parçalarıyla aynı${declared === actual ? '' : ` — meta:${declared} model:${actual}`}`,
        declared === actual)

      // Bildirilen her yuva GERÇEKTEN var olmalı...
      const unresolved = meta.materialSlots.filter((slot) => model.materials.get(slot) === undefined)
      expect(`meta.materialSlots çözümleniyor${unresolved.length ? ' — ÇÖZÜLMEYEN: ' + unresolved.join(', ') : ''}`,
        unresolved.length === 0)

      // ...ve hiçbir mesh bildirilmemiş bir yuva kullanmamalı. Bu yön daha
      // önemli: fazladan bildirim sadece gürültü, eksik bildirim tüketicinin
      // override edemeyeceği gizli bir materyal demek.
      const used = new Set<string>()
      model.root.traverse((object: Object3D) => {
        const slot = (object.userData?.vibe3d as { materialSlot?: string } | undefined)?.materialSlot
        if (slot) used.add(slot)
      })
      const undeclared = [...used].filter((slot) => !meta.materialSlots.includes(slot))
      expect(`her mesh bildirilmiş bir yuva kullanıyor${undeclared.length ? ' — BİLDİRİLMEMİŞ: ' + undeclared.join(', ') : ''}`,
        undeclared.length === 0)
    }
  }


  if (testCase.closed) {
    const balance = edgeBalance(model.root)
    console.log(`  kenar dengesi: ${balance.edges} kenar · dengesiz: ${balance.unbalanced}`)
    expect('kenar dengesi bozulmamış (ters yüz yok)', balance.unbalanced === 0)
  }

  if (testCase.radial) {
    const target = testCase.radialPart ? model.parts[testCase.radialPart]!.anchor : model.root
    const w = radialWinding(target, testCase.shellRatio ?? 0.94)
    console.log(`  radyal dış yüz: ${w.radial} · ters sarım: ${w.inward} · teğetsel (atlandı): ${w.tangential}`)
    expect('dış kabukta ters sarım yok', w.inward === 0)
    expect('test anlamlı sayıda radyal yüz gördü', w.radial >= 20)
  }
  if (testCase.closed) {
    const volume = signedVolume(model.root)
    const box = report.size[0] * report.size[1] * report.size[2]
    console.log(`  işaretli hacim: ${volume.toFixed(5)} m³ (sınır kutusu ${box.toFixed(5)})`)
    expect('işaretli hacim pozitif (sarım dışa bakıyor)', volume > 0)
    expect('hacim sınır kutusundan küçük', volume < box)
  }

  for (const variant of [{}, ...(testCase.variants ?? [])]) {
    const named = Object.keys(variant).length > 0
    const sample = named ? testCase.make(variant) : model
    const z = findZFighting(sample.root)
    const label = named ? JSON.stringify(variant) : 'varsayılan'
    console.log(`  z-fight ${label}: ${z.faces} yüz · eş düzlem ${z.coplanarGroups} · çakışma ${z.overlaps}`)
    for (const s of z.samples) console.log(`      ${s}`)
    expect(`z-fight yok ${label}`, z.overlaps === 0)
    if (named) sample.dispose()
  }

  const twinA = testCase.make({ seed: 21 })
  const twinB = testCase.make({ seed: 21 })
  const other = testCase.make({ seed: 22 })
  expect('aynı tohum aynı geometri', fingerprint(twinA) === fingerprint(twinB))
  expect('farklı tohum farklı model', fingerprint(twinA) !== fingerprint(other))
  twinA.dispose()
  twinB.dispose()
  other.dispose()

  const rootBefore = model.root
  const anchorName = Object.keys(model.parts)[0]!
  const anchorBefore = model.parts[anchorName]!.anchor
  // Tüketici eklentisi rebuild'i atlatmalı — protokolün asıl vaadi bu.
  const marker = new Mesh()
  marker.name = 'consumer-marker'
  anchorBefore.add(marker)
  expect('configure() rebuilt=true', model.configure(testCase.patch).rebuilt)
  expect('kök nesne kimliği korundu', model.root === rootBefore)
  expect('anchor nesne kimliği korundu', model.parts[anchorName]!.anchor === anchorBefore)
  expect('tüketicinin taktığı nesne rebuild sonrası duruyor', anchorBefore.children.includes(marker))
  expect('değişmeyen patch rebuilt=false', model.configure(testCase.patch).rebuilt === false)

  let ownDisposed = false
  ;(model.materials.get(testCase.ownSlot) as MeshStandardMaterial)
    .addEventListener('dispose', () => { ownDisposed = true })
  let borrowedDisposed = false
  const borrowed = new MeshStandardMaterial({ name: 'consumer-owned' })
  borrowed.addEventListener('dispose', () => { borrowedDisposed = true })
  model.materials.override(testCase.borrowSlot, borrowed as never)
  expect('override materyali geri okunuyor', model.materials.get(testCase.borrowSlot) === borrowed)
  model.dispose()
  model.dispose()
  // Aynı yuvayı hem sahiplik hem ödünç testi için kullanan modellerde
  // (tek materyalli örs) ilk kontrol anlamsız olur.
  if (testCase.ownSlot !== testCase.borrowSlot) {
    expect('modelin kendi materyali dispose edildi', ownDisposed)
  }
  expect('ödünç materyale dokunulmadı', !borrowedDisposed)
  expect('dispose() idempotent', true)
}


// --- Eylemler --------------------------------------------------------------
//
// Sandık kitin ilk eylemli modeli, dolayısıyla `actions` ve `update`
// sözleşmesini burada tek seferde sınıyoruz. Eylem yapılandırma DEĞİL: kapağı
// açmak sandığın kimliğini değiştirmez, o yüzden rebuild tetiklememeli ve
// rebuild'den de sağ çıkmalı.
console.log('\n@medieval-kit/wooden-chest eylemleri')
{
  const chest = createChest()
  const lid = chest.parts.lid.anchor
  const angle = chest.getConfig().openAngle * Math.PI / 180

  expect('başlangıçta kapalı', !chest.actions.isOpen() && chest.actions.openness() === 0)
  expect('başlangıçta kapak dönmemiş', lid.rotation.x === 0)

  // Hedef ile ANLIK durum ayrı şeyler: setOpen sadece hedefi koyar.
  chest.actions.setOpen(true)
  expect('setOpen hedefi değiştirdi', chest.actions.isOpen())
  expect('setOpen tek başına kapağı oynatmadı', lid.rotation.x === 0)

  // Aynı süre iki farklı kare hızıyla: üstel yaklaşma toplam SÜREYE bağlı
  // olmalı, kare SAYISINA değil. Saf bir `p += (hedef - p) * k` burada patlardı
  // — 30 fps'te 120 fps'ten yavaş açardı.
  const fast = createChest()
  const slow = createChest()
  fast.actions.setOpen(true)
  slow.actions.setOpen(true)
  for (let i = 0; i < 12; i += 1) fast.update(0.2 / 12)
  for (let i = 0; i < 3; i += 1) slow.update(0.2 / 3)
  expect('hareket kare hızından bağımsız',
    Math.abs(fast.actions.openness() - slow.actions.openness()) < 1e-6)
  expect('0.2 sn sonra yolun çoğu alındı', fast.actions.openness() > 0.8)
  fast.dispose()
  slow.dispose()

  for (let i = 0; i < 120; i += 1) chest.update(1 / 60)
  expect('yeterli süre sonra tam açık', chest.actions.openness() === 1)
  expect('kapak açılma açısına ulaştı', Math.abs(lid.rotation.x + angle) < 1e-9)

  // Tüketicinin kapağa taktığı nesne kapakla birlikte dönmeli — kapağın üstüne
  // konan bir şamdan kapak açılınca havada kalmamalı.
  const candle = new Mesh()
  lid.add(candle)
  candle.position.set(0, 0.05, 0.1)
  lid.updateMatrixWorld(true)
  const lifted = new Vector3().setFromMatrixPosition(candle.matrixWorld)
  expect('kapağa takılan nesne kapakla birlikte döndü', lifted.z < 0.06)

  // Rebuild kapağı çarpmamalı: açı inşanın DIŞINDA tutuluyor.
  expect('eylem sonrası configure() rebuilt=true', chest.configure({ width: 1.05 }).rebuilt)
  expect('rebuild sonrası kapak hâlâ açık', Math.abs(lid.rotation.x + angle) < 1e-9)
  expect('rebuild sonrası nesne kapakta duruyor', lid.children.includes(candle))

  chest.actions.setOpen(false)
  chest.actions.snap()
  expect('snap() hedefe anında oturttu', chest.actions.openness() === 0 && lid.rotation.x === 0)
  expect('toggle() yeni durumu döndürüyor', chest.actions.toggle() === true)

  // `extras`: kapak tek PARÇA ama iki materyal yuvası taşıyor.
  const lidSlots = new Set<string>()
  chest.parts.lid.content.traverse((object: Object3D) => {
    const slot = (object.userData?.vibe3d as { materialSlot?: string } | undefined)?.materialSlot
    if (slot) lidSlots.add(slot)
  })
  expect('kapak hem meşe hem demir gövde taşıyor', lidSlots.has('oak') && lidSlots.has('iron'))

  // Eylemsiz modellerde `update` sessizce hiçbir şey yapmalı.
  const plain = createBarrel()
  plain.update(0.016)
  expect('eylemsiz modelde update() zararsız', Object.keys(plain.actions).length === 0)
  plain.dispose()

  chest.dispose()
}



// --- Çanın mekaniği --------------------------------------------------------
//
// Kitin en karmaşık hareketi. Çanı çalan şey çanın SALLANMASI değil, tokmağın
// GERİDE KALMASI — iki gövde aynı eksende ama farklı sönümlemeyle salınıyor ve
// aradaki fark vuruşu üretiyor. Bu ayrımı test etmezsek, çan sallanırken hiç
// vurmayan bir modeli fark etmeyiz (ilk denemede tam olarak öyle olmuştu).
console.log('\n@medieval-kit/bronze-bell mekaniği')
{
  const bell = createBell()
  const body = bell.parts.bell.anchor
  const clapper = bell.parts.clapper.anchor

  expect('başlangıçta hareketsiz', !bell.actions.isRinging() && bell.actions.strikes() === 0)
  expect('çalınmadan update() hiçbir şey yapmıyor',
    (() => { for (let i = 0; i < 30; i += 1) bell.update(1 / 60); return body.rotation.z === 0 })())

  bell.actions.ring()
  for (let i = 0; i < 10; i += 1) bell.update(1 / 60)
  expect('çalınca sallanmaya başladı', Math.abs(body.rotation.z) > 0.01)

  // Vuruş: yeterli süre salınan bir çan MUTLAKA vurmalı.
  for (let i = 0; i < 180; i += 1) bell.update(1 / 60)
  expect(`tokmak vurdu (${bell.actions.strikes()} vuruş)`, bell.actions.strikes() > 0)

  // Ve tokmak çandan BAĞIMSIZ olmalı: her an aynı açıda olsalardı hiç
  // vurmazlardı. Bir tur boyunca aradaki en büyük farkı ölçüyoruz.
  let apart = 0
  bell.actions.still()
  bell.actions.ring()
  for (let i = 0; i < 120; i += 1) {
    bell.update(1 / 60)
    apart = Math.max(apart, Math.abs(clapper.rotation.z - body.rotation.z))
  }
  expect(`tokmak çandan ayrışıyor (en çok ${apart.toFixed(3)} rad)`, apart > 0.05)

  // Savrulma sınırı: yapılandırmadaki açıyı aşmamalı.
  const limit = (bell.getConfig().swing * Math.PI) / 180
  let peak = 0
  for (let i = 0; i < 40; i += 1) { bell.actions.ring(); bell.update(1 / 60) }
  for (let i = 0; i < 200; i += 1) { bell.update(1 / 60); peak = Math.max(peak, Math.abs(body.rotation.z)) }
  expect(`savrulma sınırı korundu (${peak.toFixed(3)} ≤ ${limit.toFixed(3)})`, peak <= limit + 1e-9)

  // Sönümlenme: bırakılan bir çan durmalı. Sonsuza kadar salınan bir sarkaç
  // sahnede sonsuza kadar kare harcar.
  for (let i = 0; i < 2400; i += 1) bell.update(1 / 60)
  expect('kendiliğinden duruyor', !bell.actions.isRinging())

  bell.actions.still()
  expect('still() her şeyi sıfırlıyor',
    body.rotation.z === 0 && clapper.rotation.z === 0 && !bell.actions.isRinging())

  bell.dispose()
}


console.log(`\nkit toplamı: ${CASES.length} model · ${totalTriangles} üçgen`)
console.log(failures.length === 0 ? 'Tüm kontroller geçti.' : `${failures.length} kontrol BAŞARISIZ.`)
if (failures.length > 0) process.exitCode = 1
