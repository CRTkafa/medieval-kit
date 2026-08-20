import { BufferAttribute, BufferGeometry, Color } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Kitin geometri dili.
 *
 * Hepsi INDEKSSİZ üretiliyor. Sebep: indekssiz geometride
 * computeVertexNormals() her üçgene kendi normalini verir, yani düz gölgeleme
 * (flat shading) geometrinin doğal sonucu olur — materyal bayrağına gerek
 * kalmaz. Lowpoly'de istediğimiz tam olarak bu.
 *
 * Konum çerçevesi: point(a, r, y) = (sin a · r, y, cos a · r)
 * Yani a = 0 → +Z yönü; a büyüdükçe +X'e doğru.
 *
 * Sarımlar elle çözüldü ve `scripts/verify-model.ts` içindeki denetim onları
 * mutasyonla sınıyor: dış kabuktaki radyal yüzler eksenden dışa bakmalı.
 */

export type Vec3 = readonly [number, number, number]

export interface Level {
  /** Dikey konum (metre). */
  readonly y: number
  /** O yükseklikteki DIŞ yarıçap (metre). */
  readonly radius: number
}

function point(angle: number, radius: number, y: number): Vec3 {
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius]
}

interface Sink {
  readonly position: number[]
  readonly color: number[]
}

function tri(sink: Sink, a: Vec3, b: Vec3, c: Vec3, colour: Color): void {
  sink.position.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  for (let i = 0; i < 3; i += 1) sink.color.push(colour.r, colour.g, colour.b)
}

/** Üç köşesi ayrı renkli üçgen — dikey renk geçişleri için. */
function triShaded(sink: Sink, a: Vec3, b: Vec3, c: Vec3, ca: Color, cb: Color, cc: Color): void {
  sink.position.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  sink.color.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b)
}

/** Dörtgeni (a,b,c,d) sırasıyla iki üçgene böler. Normal a→b→c sarımından çıkar. */
function quad(sink: Sink, a: Vec3, b: Vec3, c: Vec3, d: Vec3, colour: Color): void {
  tri(sink, a, b, c, colour)
  tri(sink, a, c, d, colour)
}

function finish(sink: Sink): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(sink.position), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(sink.color), 3))
  return geometry
}

/**
 * Eksen hizalı kutu. Kitin en çok kullanılan parçası: tahta, kiriş, demir
 * kayış, ayak — hepsi bu.
 */
export function boxGeometry(
  size: Vec3,
  centre: Vec3,
  colour: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2]
  const [cx, cy, cz] = centre
  const v = (sx: number, sy: number, sz: number): Vec3 => [cx + sx * hx, cy + sy * hy, cz + sz * hz]

  quad(sink, v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), colour)     // +Z
  quad(sink, v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), colour) // -Z
  quad(sink, v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), colour)     // +X
  quad(sink, v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), colour) // -X
  quad(sink, v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), colour)     // +Y
  quad(sink, v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), colour) // -Y

  return finish(sink)
}

/**
 * Kesik koni / prizma: ayak, sap, kâse, alev dili.
 *
 * `colourTop` verilirse renk yüksekliğe göre geçiş yapar — alev için gerekli,
 * çünkü alevin dibi ile ucu aynı renk değildir.
 */
export function prismGeometry(
  radiusBottom: number,
  radiusTop: number,
  height: number,
  segments: number,
  centre: Vec3,
  colour: Color,
  options: { readonly capTop?: boolean; readonly capBottom?: boolean; readonly colourTop?: Color } = {},
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const { capTop = true, capBottom = true } = options
  const top = options.colourTop ?? colour
  const [cx, cy, cz] = centre
  const low = cy - height / 2
  const high = cy + height / 2
  const stepAngle = (Math.PI * 2) / segments
  const shift = (p: Vec3): Vec3 => [p[0] + cx, p[1], p[2] + cz]

  for (let i = 0; i < segments; i += 1) {
    const a0 = i * stepAngle
    const a1 = (i + 1) * stepAngle
    const l0 = shift(point(a0, radiusBottom, low))
    const l1 = shift(point(a1, radiusBottom, low))
    const h0 = shift(point(a0, radiusTop, high))
    const h1 = shift(point(a1, radiusTop, high))

    // Yan yüz: dışa bakar.
    triShaded(sink, l0, l1, h1, colour, colour, top)
    triShaded(sink, l0, h1, h0, colour, top, top)

    if (capTop && radiusTop > 0) tri(sink, [cx, high, cz], h0, h1, top)
    if (capBottom && radiusBottom > 0) tri(sink, [cx, low, cz], l1, l0, colour)
  }

  return finish(sink)
}

/**
 * Bir fıçı tahtası (stave): halkanın bir dilimi, kalınlığı olan kapalı bir katı.
 *
 * Her seviyede dört köşe var:
 *   A = dış/başlangıç açısı   B = dış/bitiş açısı
 *   C = iç/bitiş açısı        D = iç/başlangıç açısı
 */
export function staveGeometry(
  levels: readonly Level[],
  angleStart: number,
  angleEnd: number,
  thickness: number,
  colour: Color,
): BufferGeometry {
  if (levels.length < 2) throw new Error('staveGeometry en az iki seviye ister')

  const sink: Sink = { position: [], color: [] }

  const corners = levels.map((level) => {
    // Kalınlık, en ince yarıçapın yarısını geçemez; yoksa iç yüzey dışa taşar.
    const inner = Math.max(level.radius * 0.5, level.radius - thickness)
    return {
      a: point(angleStart, level.radius, level.y),
      b: point(angleEnd, level.radius, level.y),
      c: point(angleEnd, inner, level.y),
      d: point(angleStart, inner, level.y),
    }
  })

  for (let i = 0; i < corners.length - 1; i += 1) {
    const low = corners[i]!
    const high = corners[i + 1]!
    quad(sink, low.a, low.b, high.b, high.a, colour)  // dış yüz  → dışa bakar
    quad(sink, low.c, low.d, high.d, high.c, colour)  // iç yüz   → eksene bakar
    quad(sink, low.d, low.a, high.a, high.d, colour)  // başlangıç kenarı
    quad(sink, low.b, low.c, high.c, high.b, colour)  // bitiş kenarı
  }

  const top = corners.at(-1)!
  const bottom = corners[0]!
  quad(sink, top.a, top.b, top.c, top.d, colour)             // üst kapak → +Y
  quad(sink, bottom.d, bottom.c, bottom.b, bottom.a, colour) // alt kapak → -Y

  return finish(sink)
}

/**
 * Demir çember: dikdörtgen kesitli bir halka.
 *
 * İç yüzey kasten üretilmiyor — yaslandığı gövde onu her kameradan gizler.
 * Üçgen bütçesinin dörtte biri buradan kazanılıyor.
 */
export function bandGeometry(
  radius: number,
  y: number,
  height: number,
  thickness: number,
  segments: number,
  colour: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const half = height / 2
  const inner = radius - thickness
  const stepAngle = (Math.PI * 2) / segments

  for (let i = 0; i < segments; i += 1) {
    const a0 = i * stepAngle
    const a1 = (i + 1) * stepAngle

    const outerLow0 = point(a0, radius, y - half)
    const outerLow1 = point(a1, radius, y - half)
    const outerHigh0 = point(a0, radius, y + half)
    const outerHigh1 = point(a1, radius, y + half)
    const innerHigh0 = point(a0, inner, y + half)
    const innerHigh1 = point(a1, inner, y + half)
    const innerLow0 = point(a0, inner, y - half)
    const innerLow1 = point(a1, inner, y - half)

    quad(sink, outerLow0, outerLow1, outerHigh1, outerHigh0, colour)   // dış → dışa
    quad(sink, outerHigh0, outerHigh1, innerHigh1, innerHigh0, colour) // üst → +Y
    quad(sink, innerLow0, innerLow1, outerLow1, outerLow0, colour)     // alt → -Y
  }

  return finish(sink)
}

/**
 * Yelpaze disk: fıçı kapağı, kâse dibi.
 *
 * Tek parça ahşap değil, birkaç tahtadan kurulmuş gibi okunması için her
 * üçgen, merkezinin X konumuna göre bir "tahta bandına" düşer ve o bandın tonu
 * vertex color'a yazılır. Geometri maliyeti sıfır.
 */
export function headGeometry(
  radius: number,
  y: number,
  segments: number,
  facing: 'up' | 'down',
  colour: Color,
  plankCount: number,
  plankShade: number,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const centre: Vec3 = [0, y, 0]
  const stepAngle = (Math.PI * 2) / segments
  const plankWidth = (radius * 2) / Math.max(1, plankCount)
  const tint = new Color()

  for (let i = 0; i < segments; i += 1) {
    const p0 = point(i * stepAngle, radius, y)
    const p1 = point((i + 1) * stepAngle, radius, y)

    // Tahtalar X ekseni boyunca dilimlenmiş şeritler; üçgenin ağırlık
    // merkezinin X'i hangi şeride düşüyorsa onun tonunu alır.
    const centroidX = (p0[0] + p1[0]) / 3
    const band = Math.floor((centroidX + radius) / plankWidth)
    tint.copy(colour).multiplyScalar(1 + (band % 2 === 0 ? plankShade : -plankShade))

    if (facing === 'up') tri(sink, centre, p0, p1, tint)
    else tri(sink, centre, p1, p0, tint)
  }

  return finish(sink)
}

/**
 * Her üçgenin sarımını ters çevirir, yani tüm normalleri döndürür.
 *
 * İçi görünen kaplar için gerekli: bir kâsenin dış yüzeyi dışa, iç yüzeyi içe
 * bakmalı. İkisini ayrı ayrı yazmak yerine aynı koniyi üretip birini
 * çeviriyoruz.
 */
export function flipGeometry(geometry: BufferGeometry): BufferGeometry {
  for (const name of ['position', 'color'] as const) {
    const attribute = geometry.getAttribute(name)
    if (!attribute) continue
    const array = attribute.array as Float32Array
    const stride = attribute.itemSize
    // Üçgenin 2. ve 3. köşesini takas etmek sarımı ters çevirir.
    for (let i = 0; i < attribute.count; i += 3) {
      for (let k = 0; k < stride; k += 1) {
        const b = (i + 1) * stride + k
        const c = (i + 2) * stride + k
        const swap = array[b]!
        array[b] = array[c]!
        array[c] = swap
      }
    }
    attribute.needsUpdate = true
  }
  return geometry
}

/**
 * Aynı materyali paylaşan parçaları tek geometriye indirger — materyal başına
 * tek çizim çağrısı. Normaller birleştirmeden SONRA hesaplanır: indekssiz
 * geometride bu her üçgene kendi normalini verir, yani düz gölgeleme.
 */
export function mergeColoured(geometries: readonly BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geometries as BufferGeometry[], false)
  if (!merged) throw new Error('Geometriler birleştirilemedi: attribute setleri uyuşmuyor')
  for (const geometry of geometries) geometry.dispose()
  merged.computeVertexNormals()
  return merged
}
