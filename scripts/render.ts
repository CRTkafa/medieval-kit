/**
 * Çevrimdışı model görüntüleyici — tarayıcısız, GPU'suz.
 *
 * Neden var: kitin bugüne kadarki bütün doğrulaması GEOMETRİKTİ. Üçgen sayısı,
 * sarım yönü, eş düzlem yüzler, sınır kutusu... Hepsi gerçek hataları yakaladı
 * ama hiçbiri "bu kürek küreğe benzemiyor" diyemedi. O cümleyi kurabilmek için
 * modele BAKMAK gerekiyor.
 *
 * Bu yüzden burada minik bir yazılım rasterleyici var: üçgenleri topluyor,
 * kamerayla yansıtıyor, z-tamponuyla dolduruyor ve PNG yazıyor. Amaç güzel
 * görüntü değil OKUNUR SİLUET — gölgeleme, siluetin ne olduğunu anlamaya
 * yetecek kadar var, bir milim fazlası yok.
 *
 * Kullanım:
 *   bun scripts/render.ts                    → hepsini + kontak sayfası
 *   bun scripts/render.ts --one wooden-chest → tek model, büyük
 *   bun scripts/render.ts --size 640
 */
import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'

import {
  Box3,
  Mesh,
  PerspectiveCamera,
  Sphere,
  Vector3,
  type Object3D,
} from 'three/webgpu'

import { CATALOG } from '@/catalog.ts'

/* ------------------------------------------------------------------ üçgenler */

interface Triangle {
  readonly a: Vector3
  readonly b: Vector3
  readonly c: Vector3
  /** Köşe renkleri, LİNEER uzayda. */
  readonly ca: [number, number, number]
  readonly cb: [number, number, number]
  readonly cc: [number, number, number]
  readonly metalness: number
  readonly roughness: number
  /** Işık almayan yüzey (alev). Vertex rengi doğrudan sonuçtur. */
  readonly unlit: boolean
  readonly opacity: number
}

function collect(root: Object3D): Triangle[] {
  root.updateMatrixWorld(true)
  const out: Triangle[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const geometry = object.geometry
    const position = geometry.getAttribute('position')
    if (!position) return
    const colour = geometry.getAttribute('color')
    const index = geometry.getIndex()
    const count = index ? index.count : position.count

    const material = object.material as {
      metalness?: number
      roughness?: number
      opacity?: number
      transparent?: boolean
      isMeshBasicMaterial?: boolean
    }
    const unlit = material.isMeshBasicMaterial === true
    const opacity = material.transparent ? (material.opacity ?? 1) : 1

    const vertex = (i: number): { p: Vector3; c: [number, number, number] } => {
      const v = index ? index.getX(i) : i
      const p = new Vector3().fromBufferAttribute(position, v).applyMatrix4(object.matrixWorld)
      const c: [number, number, number] = colour
        ? [colour.getX(v), colour.getY(v), colour.getZ(v)]
        : [0.8, 0.8, 0.8]
      return { p, c }
    }

    for (let i = 0; i < count; i += 3) {
      const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2)
      out.push({
        a: a.p, b: b.p, c: c.p,
        ca: a.c, cb: b.c, cc: c.c,
        metalness: material.metalness ?? 0,
        roughness: material.roughness ?? 0.8,
        unlit,
        opacity,
      })
    }
  })
  return out
}

/* ---------------------------------------------------------------- rasterleme */

const LIGHT = new Vector3(0.48, 0.82, 0.31).normalize()
const SKY: [number, number, number] = [0.42, 0.52, 0.68]
const GROUND: [number, number, number] = [0.24, 0.2, 0.16]

/** Lineer → sRGB. Palet renkleri three içinde lineer saklanıyor. */
function encode(value: number): number {
  const v = Math.min(1, Math.max(0, value))
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  return Math.round(s * 255)
}

interface Frame {
  readonly width: number
  readonly height: number
  readonly colour: Float32Array   // rgb
  readonly depth: Float32Array
}

function newFrame(width: number, height: number): Frame {
  const colour = new Float32Array(width * height * 3)
  // Arka plan: üstten alta doğru koyulaşan sakin bir gri-mavi. Düz renk,
  // modelin siluetini okumayı zorlaştıran tek şeydi.
  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1)
    const r = 0.052 + 0.028 * (1 - t)
    const g = 0.058 + 0.034 * (1 - t)
    const b = 0.068 + 0.046 * (1 - t)
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      colour[i] = r; colour[i + 1] = g; colour[i + 2] = b
    }
  }
  return { width, height, colour, depth: new Float32Array(width * height).fill(Infinity) }
}

interface Projected {
  x: number
  y: number
  z: number
  behind: boolean
}

function project(point: Vector3, camera: PerspectiveCamera, frame: Frame): Projected {
  const v = point.clone().project(camera)
  return {
    x: (v.x * 0.5 + 0.5) * frame.width,
    y: (1 - (v.y * 0.5 + 0.5)) * frame.height,
    z: v.z,
    // Kameranın arkasındaki köşeler yansıtıldığında işaret değiştirip üçgeni
    // ekranın karşı tarafına savuruyor. Kırpma yapmak yerine böyle üçgenleri
    // tamamen atıyoruz — inceleyici kamerası her zaman modeli çerçeveliyor,
    // dolayısıyla bu durum ancak bir hata varsa oluşur.
    behind: v.z < -1 || v.z > 1,
  }
}

function shade(tri: Triangle, normal: Vector3, albedo: [number, number, number]): [number, number, number] {
  if (tri.unlit) return albedo

  const ndl = Math.max(0, normal.dot(LIGHT))
  // Yarıküre ortamı: yukarı bakan yüzeyler gökyüzünü, aşağı bakanlar yeri
  // görür. Metaller neredeyse tamamen buradan besleniyor — çevre haritası
  // olmayan bir metal aksi hâlde kapkara çıkar.
  const up = normal.y * 0.5 + 0.5
  const ambient: [number, number, number] = [
    GROUND[0] + (SKY[0] - GROUND[0]) * up,
    GROUND[1] + (SKY[1] - GROUND[1]) * up,
    GROUND[2] + (SKY[2] - GROUND[2]) * up,
  ]

  const metal = tri.metalness
  const diffuseStrength = (1 - metal * 0.85) * (0.28 + ndl * 1.05)
  const envStrength = 0.35 + metal * 0.9

  // Blinn-Phong parlaklık: pürüzlülükten üs türetiliyor.
  const exponent = Math.pow(2, (1 - tri.roughness) * 10) + 1
  const half = LIGHT.clone().add(new Vector3(0, 0, 1)).normalize()
  const spec = Math.pow(Math.max(0, normal.dot(half)), exponent) * (1 - tri.roughness) * 1.6

  return [0, 1, 2].map((i) => {
    const base = albedo[i]!
    const lit = base * diffuseStrength + base * ambient[i]! * envStrength
    // Metalde yansıma rengi albedodan gelir, dielektrikte beyazdır.
    const tint = metal > 0.5 ? base : 1
    return lit + spec * tint * (0.35 + metal * 0.9)
  }) as [number, number, number]
}

function raster(frame: Frame, camera: PerspectiveCamera, triangles: readonly Triangle[]): void {
  // Saydamlar en sona: derinlik testi yapıyorlar ama derinlik YAZMIYORLAR,
  // yoksa camın arkasındaki fitil kayboluyor.
  const ordered = [...triangles].sort((a, b) => (a.opacity === b.opacity ? 0 : a.opacity < 1 ? 1 : -1))

  for (const tri of ordered) {
    const pa = project(tri.a, camera, frame)
    const pb = project(tri.b, camera, frame)
    const pc = project(tri.c, camera, frame)
    if (pa.behind || pb.behind || pc.behind) continue

    // Ekran uzayında işaretli alan: negatifse üçgen bize arkasını dönüyor.
    // Arka yüz ayıklaması burada ÖNEMLİ — sarım yönü hatası yapan bir model
    // görüntüde içi dışına çıkmış görünsün istiyoruz, gizlenmesin.
    const area = (pb.x - pa.x) * (pc.y - pa.y) - (pc.x - pa.x) * (pb.y - pa.y)
    if (area >= 0) continue

    const normal = new Vector3()
      .subVectors(tri.b, tri.a)
      .cross(new Vector3().subVectors(tri.c, tri.a))
      .normalize()

    const minX = Math.max(0, Math.floor(Math.min(pa.x, pb.x, pc.x)))
    const maxX = Math.min(frame.width - 1, Math.ceil(Math.max(pa.x, pb.x, pc.x)))
    const minY = Math.max(0, Math.floor(Math.min(pa.y, pb.y, pc.y)))
    const maxY = Math.min(frame.height - 1, Math.ceil(Math.max(pa.y, pb.y, pc.y)))

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5, py = y + 0.5
        const w0 = ((pb.x - pa.x) * (py - pa.y) - (px - pa.x) * (pb.y - pa.y)) / area
        const w1 = ((pc.x - pb.x) * (py - pb.y) - (px - pb.x) * (pc.y - pb.y)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue

        // w1 → a, w2 → b, w0 → c (kenar fonksiyonlarının karşı köşeleri)
        const z = pa.z * w1 + pb.z * w2 + pc.z * w0
        const at = y * frame.width + x
        if (z >= frame.depth[at]!) continue

        const albedo: [number, number, number] = [
          tri.ca[0] * w1 + tri.cb[0] * w2 + tri.cc[0] * w0,
          tri.ca[1] * w1 + tri.cb[1] * w2 + tri.cc[1] * w0,
          tri.ca[2] * w1 + tri.cb[2] * w2 + tri.cc[2] * w0,
        ]
        const rgb = shade(tri, normal, albedo)
        const i = at * 3
        const alpha = tri.opacity
        frame.colour[i] = frame.colour[i]! * (1 - alpha) + rgb[0] * alpha
        frame.colour[i + 1] = frame.colour[i + 1]! * (1 - alpha) + rgb[1] * alpha
        frame.colour[i + 2] = frame.colour[i + 2]! * (1 - alpha) + rgb[2] * alpha
        if (alpha >= 1) frame.depth[at] = z
      }
    }
  }
}

/** Zemin teması gölgesi: modeli y=taban düzlemine yassıltıp koyu çiziyoruz. */
function contactShadow(frame: Frame, camera: PerspectiveCamera, triangles: readonly Triangle[], floor: number): void {
  for (const tri of triangles) {
    if (tri.unlit) continue
    const flat = (v: Vector3): Vector3 => new Vector3(v.x, floor + 0.0005, v.z)
    const pa = project(flat(tri.a), camera, frame)
    const pb = project(flat(tri.b), camera, frame)
    const pc = project(flat(tri.c), camera, frame)
    if (pa.behind || pb.behind || pc.behind) continue
    const area = (pb.x - pa.x) * (pc.y - pa.y) - (pc.x - pa.x) * (pb.y - pa.y)
    if (area === 0) continue

    const minX = Math.max(0, Math.floor(Math.min(pa.x, pb.x, pc.x)))
    const maxX = Math.min(frame.width - 1, Math.ceil(Math.max(pa.x, pb.x, pc.x)))
    const minY = Math.max(0, Math.floor(Math.min(pa.y, pb.y, pc.y)))
    const maxY = Math.min(frame.height - 1, Math.ceil(Math.max(pa.y, pb.y, pc.y)))
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5, py = y + 0.5
        const w0 = ((pb.x - pa.x) * (py - pa.y) - (px - pa.x) * (pb.y - pa.y)) / area
        const w1 = ((pc.x - pb.x) * (py - pb.y) - (px - pb.x) * (pc.y - pb.y)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue
        const i = (y * frame.width + x) * 3
        for (let k = 0; k < 3; k += 1) frame.colour[i + k] = frame.colour[i + k]! * 0.55
      }
    }
  }
}

/* ---------------------------------------------------------------------- PNG */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i += 1) body[i] = type.charCodeAt(i)
  body.set(data, 4)
  const out = new Uint8Array(8 + data.length + 4)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(body, 4)
  view.setUint32(out.length - 4, crc32(body))
  return out
}

function encodePng(frame: Frame): Uint8Array {
  const { width, height, colour } = frame
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 3
      const to = row + 1 + x * 3
      raw[to] = encode(colour[from]!)
      raw[to + 1] = encode(colour[from + 1]!)
      raw[to + 2] = encode(colour[from + 2]!)
    }
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8      // bit derinliği
  ihdr[9] = 2      // renk tipi: truecolour
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const png = new Uint8Array(total)
  let at = 0
  for (const part of parts) { png.set(part, at); at += part.length }
  return png
}

/* ------------------------------------------------------------------- çerçeve */

/** Modeli kadraja oturtan kamera. Viewer'daki çerçevelemenin aynısı. */
function frameCamera(root: Object3D, width: number, height: number): { camera: PerspectiveCamera; floor: number } {
  const box = new Box3().setFromObject(root)
  const sphere = box.getBoundingSphere(new Sphere())
  const camera = new PerspectiveCamera(32, width / height, 0.01, 100)
  const distance = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.12
  // Dörtte üç görüş: iki yüzü birden gösteren tek açı. Tam karşıdan bakmak
  // derinliği tamamen gizliyor.
  const direction = new Vector3(0.78, 0.5, 1).normalize()
  camera.position.copy(sphere.center).addScaledVector(direction, distance)
  camera.lookAt(sphere.center)
  camera.updateMatrixWorld(true)
  return { camera, floor: box.min.y }
}

function renderOne(
  id: string,
  size: number,
  patch?: Record<string, number>,
  /** Modelin Y ekseni etrafında ön dönüşü (radyan). Turntable için. */
  spin = 0,
): Frame {
  const entry = CATALOG[id]
  if (!entry) throw new Error(`katalogda yok: ${id}`)
  const built = entry.build()
  if (patch && built.params) built.params.apply(patch)
  // Animasyonlu modelleri hareketin ortasında yakala: sabit alev, alevin
  // titrediğini göstermez.
  built.update?.(0.42)
  // Kamerayı değil MODELİ döndürüyoruz: çerçeveleme ve gölge hesabı sabit
  // yönde kalıyor, dolayısıyla turntable kareleri birebir karşılaştırılabilir.
  built.root.rotation.y = spin
  const triangles = collect(built.root)
  const frame = newFrame(size, size)
  const { camera, floor } = frameCamera(built.root, size, size)
  contactShadow(frame, camera, triangles, floor)
  raster(frame, camera, triangles)
  built.dispose()
  return frame
}

/* ------------------------------------------------------------------ giriş */

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}

const outDir = flag('out') ?? 'renders'
const one = flag('one')
const size = Number(flag('size') ?? (one ? 720 : 300))

const only = flag('ids')?.split(',')

await mkdir(outDir, { recursive: true })

function ids0(): string {
  throw new Error('--sweep için --one <model> gerekli')
}

/** Kareleri ızgaraya dizer. */
function tile(list: readonly Frame[], size: number, columns: number): Frame {
  const rows = Math.ceil(list.length / columns)
  const sheet = newFrame(columns * size, rows * size)
  list.forEach((frame, index) => {
    const ox = (index % columns) * size
    const oy = Math.floor(index / columns) * size
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const from = (y * size + x) * 3
        const to = ((oy + y) * sheet.width + ox + x) * 3
        sheet.colour[to] = frame.colour[from]!
        sheet.colour[to + 1] = frame.colour[from + 1]!
        sheet.colour[to + 2] = frame.colour[from + 2]!
      }
    }
  })
  return sheet
}

// Süpürme: aynı modeli tek bir parametrenin farklı değerleriyle yan yana
// koyar. Bir oranı gözle seçmek, sayıyı değiştirip tek tek bakmaktan çok daha
// hızlı — çapanın ağız açısını böyle seçtim.
// Turntable: aynı modeli Y ekseni etrafında eşit aralıklarla döndürüp yan yana
// koyar. Tek bir 3/4 açı yanıltıcı olabiliyor — çit ancak tam yandan bakınca
// "cılız" görünüyor, süpürge ancak tepeden bakınca "seyrek".
const angles = Number(flag('angles') ?? 0)
if (angles > 1) {
  const target = one ?? (only?.[0])
  if (!target) throw new Error('--angles için --one <model> ya da --ids gerekli')
  const frames = Array.from({ length: angles }, (_, i) =>
    renderOne(target, size, undefined, (i / angles) * Math.PI * 2))
  await writeFile(`${outDir}/_turntable.png`, encodePng(tile(frames, size, angles)))
  console.log(`${target} · ${angles} açı → ${outDir}/_turntable.png`)
  process.exit(0)
}

const sweep = flag('sweep')
if (sweep) {
  const [key, values] = sweep.split('=')
  const list = values!.split('|').map(Number)
  const target = one ?? ids0()
  const rendered = list.map((value) => renderOne(target, size, { [key!]: value }))
  await writeFile(`${outDir}/_sweep.png`, encodePng(tile(rendered, size, list.length)))
  console.log(`${target} · ${key} = ${list.join(', ')} → ${outDir}/_sweep.png`)
  process.exit(0)
}

const ids = one ? [one]
  : only ?? Object.keys(CATALOG).filter((id) => id !== 'pressure-gauge')
const frames = new Map<string, Frame>()

for (const id of ids) {
  const frame = renderOne(id, size)
  frames.set(id, frame)
  await writeFile(`${outDir}/${id}.png`, encodePng(frame))
  console.log(`  ${id}`)
}

if (!one && frames.size > 1) {
  // Kontak sayfası: hepsi tek görüntüde. Modelleri tek tek açmak yerine
  // yan yana görmek, aralarındaki ölçek ve ton tutarsızlıklarını gösteriyor —
  // ki bunlar tek başına bakınca fark edilmeyen türden hatalar.
  const columns = Number(flag('columns') ?? 6)
  const sheet = tile([...frames.values()], size, columns)
  await writeFile(`${outDir}/_sheet.png`, encodePng(sheet))
  console.log(`\n${frames.size} model → ${outDir}/_sheet.png (${sheet.width}×${sheet.height})`)
}
