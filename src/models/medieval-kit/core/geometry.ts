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
 * Pahlı kutu — kitin en önemli primitive'i. Daralabilir.
 *
 * Keskin 90° köşe doğada yoktur. Elle rendelenmiş bir tahtanın kenarı kırılır,
 * dövme demirin köşesi yuvarlanır. Pah bandı ışığı komşu yüzlerden farklı
 * açıyla yakalar ve nesne "kutu" olmaktan çıkıp fiziksel bir parçaya döner.
 * Kitin ilk hâli baştan sona pahsız kutuydu ve hepsi oyuncak gibi duruyordu.
 *
 * Alt ve üst kesiti farklı verilebildiği için hem düz kutunun hem daralan
 * kutunun yerini tutuyor — ikisini ayrı primitive olarak tutmak, birine pah
 * ekleyip diğerini keskin bırakma riskini sürekli açık tutardı.
 *
 * Tek fasetli pah (vibe3d modelleme kuralı 2: varsayılan bir faset, ikincisi
 * yalnızca silueti taşıyan kütlelere). Maliyet 12 üçgen yerine 44.
 *
 * Sarım: 6 yüz elle çözüldü; 12 kenar ve 8 köşe beklenen dış yöne göre KENDİNİ
 * DÜZELTİYOR. Yirmi parçanın sarımını elle çıkarmak hataya davet, beklenen
 * normal ise zaten biliniyor — ters çıkanı çevirmek hem kısa hem kesin.
 */
export function chamferedBoxGeometry(
  bottom: readonly [number, number],
  top: readonly [number, number],
  height: number,
  chamfer: number,
  centre: Vec3,
  colour: Color,
  colourTop?: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const [cx, cy, cz] = centre
  const hy = height / 2
  const minHalf = Math.min(bottom[0], bottom[1], top[0], top[1]) / 2
  const c = Math.max(1e-6, Math.min(chamfer, minHalf * 0.5, hy * 0.5))
  const upper = colourTop ?? colour

  /**
   * `full` ekseni tam uçta, diğerleri pah kadar içeride.
   * Yatay yarı-ölçüler yüksekliğe göre alt/üst kesit arasında yorumlanıyor.
   */
  const p = (sx: number, sy: number, sz: number, full: 0 | 1 | 2): Vec3 => {
    const y = cy + sy * (full === 1 ? hy : hy - c)
    const t = height <= 1e-9 ? 0 : (y - (cy - hy)) / height
    const hx = (bottom[0] + (top[0] - bottom[0]) * t) / 2
    const hz = (bottom[1] + (top[1] - bottom[1]) * t) / 2
    return [
      cx + sx * (full === 0 ? hx : hx - c),
      y,
      cz + sz * (full === 2 ? hz : hz - c),
    ]
  }
  const shade = (v: Vec3): Color =>
    colourTop ? new Color().copy(colour).lerp(upper, (v[1] - (cy - hy)) / Math.max(1e-9, height)) : colour

  const face = (a: Vec3, b: Vec3, d: Vec3, e: Vec3): void => {
    tri(sink, a, b, d, shade(a)); tri(sink, a, d, e, shade(a))
  }
  face(p(-1, -1, 1, 2), p(1, -1, 1, 2), p(1, 1, 1, 2), p(-1, 1, 1, 2))     // +Z
  face(p(1, -1, -1, 2), p(-1, -1, -1, 2), p(-1, 1, -1, 2), p(1, 1, -1, 2)) // -Z
  face(p(1, -1, 1, 0), p(1, -1, -1, 0), p(1, 1, -1, 0), p(1, 1, 1, 0))     // +X
  face(p(-1, -1, -1, 0), p(-1, -1, 1, 0), p(-1, 1, 1, 0), p(-1, 1, -1, 0)) // -X
  face(p(-1, 1, 1, 1), p(1, 1, 1, 1), p(1, 1, -1, 1), p(-1, 1, -1, 1))     // +Y
  face(p(-1, -1, -1, 1), p(1, -1, -1, 1), p(1, -1, 1, 1), p(-1, -1, 1, 1)) // -Y

  /** Üçgeni beklenen dış yöne göre, gerekirse çevirerek yazar. */
  const oriented = (a: Vec3, b: Vec3, d: Vec3, outward: readonly number[]): void => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
    const n = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ]
    const dot = n[0]! * outward[0]! + n[1]! * outward[1]! + n[2]! * outward[2]!
    if (dot >= 0) tri(sink, a, b, d, shade(a))
    else tri(sink, a, d, b, shade(a))
  }

  const signs = [-1, 1] as const
  for (const axis of [0, 1, 2] as const) {
    const [u, v] = [0, 1, 2].filter((i) => i !== axis) as [0 | 1 | 2, 0 | 1 | 2]
    for (const su of signs) for (const sv of signs) {
      const at = (along: number, full: 0 | 1 | 2): Vec3 => {
        const sign: [number, number, number] = [0, 0, 0]
        sign[axis] = along; sign[u] = su; sign[v] = sv
        return p(sign[0], sign[1], sign[2], full)
      }
      const outward = [0, 1, 2].map((i) => (i === u ? su : i === v ? sv : 0))
      oriented(at(-1, u), at(-1, v), at(1, v), outward)
      oriented(at(-1, u), at(1, v), at(1, u), outward)
    }
  }
  for (const sx of signs) for (const sy of signs) for (const sz of signs) {
    oriented(p(sx, sy, sz, 0), p(sx, sy, sz, 1), p(sx, sy, sz, 2), [sx, sy, sz])
  }

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
 * Tornalanmış yüzey: bir profili Y ekseni etrafında döndürür.
 *
 * `prismGeometry` bunun iki seviyeli hâli. Çok seviye gerektiğinde bu kullanılır
 * ve arada İÇ YÜZEY OLUŞMAZ — üst üste prizma yığmak yerine bunu kullanmanın
 * asıl sebebi bu: yığılmış prizmalar birbirine değdiği yerde çakışan yüz çifti
 * bırakır, tek lathe bırakmaz.
 *
 * Kitin yuvarlak her şeyi bundan çıkıyor: alet sapı ve kabza şişkinliği, koni
 * soket, yaba dişi, ileride testi/şamdan/tekerlek göbeği.
 */
export function latheGeometry(
  levels: readonly Level[],
  segments: number,
  centre: Vec3,
  colour: Color,
  options: { readonly capTop?: boolean; readonly capBottom?: boolean; readonly colourTop?: Color } = {},
): BufferGeometry {
  if (levels.length < 2) throw new Error('latheGeometry en az iki seviye ister')
  const sink: Sink = { position: [], color: [] }
  const { capTop = true, capBottom = true } = options
  const top = options.colourTop ?? colour
  const [cx, cy, cz] = centre
  const stepAngle = (Math.PI * 2) / segments
  const shift = (p: Vec3): Vec3 => [p[0] + cx, p[1] + cy, p[2] + cz]
  const lerp = (t: number): Color => new Color().copy(colour).lerp(top, t)

  for (let i = 0; i < levels.length - 1; i += 1) {
    const low = levels[i]!
    const high = levels[i + 1]!
    const tLow = i / (levels.length - 1)
    const tHigh = (i + 1) / (levels.length - 1)
    const cLow = lerp(tLow)
    const cHigh = lerp(tHigh)

    for (let j = 0; j < segments; j += 1) {
      const a0 = j * stepAngle
      const a1 = (j + 1) * stepAngle
      const l0 = shift(point(a0, low.radius, low.y))
      const l1 = shift(point(a1, low.radius, low.y))
      const h0 = shift(point(a0, high.radius, high.y))
      const h1 = shift(point(a1, high.radius, high.y))
      // Yarıçapı sıfır olan seviyede o kenar bir noktaya iner; dejenere üçgen
      // üretmemek için tek üçgenle kapatılır.
      if (low.radius <= 1e-6) { triShaded(sink, l0, h1, h0, cLow, cHigh, cHigh); continue }
      if (high.radius <= 1e-6) { triShaded(sink, l0, l1, h0, cLow, cLow, cHigh); continue }
      triShaded(sink, l0, l1, h1, cLow, cLow, cHigh)
      triShaded(sink, l0, h1, h0, cLow, cHigh, cHigh)
    }
  }

  const first = levels[0]!
  const last = levels.at(-1)!
  for (let j = 0; j < segments; j += 1) {
    const a0 = j * stepAngle
    const a1 = (j + 1) * stepAngle
    if (capBottom && first.radius > 1e-6) {
      tri(sink, shift([0, first.y, 0]),
        shift(point(a1, first.radius, first.y)), shift(point(a0, first.radius, first.y)), colour)
    }
    if (capTop && last.radius > 1e-6) {
      tri(sink, shift([0, last.y, 0]),
        shift(point(a0, last.radius, last.y)), shift(point(a1, last.radius, last.y)), top)
    }
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
  options: {
    /**
     * İç yüzü de üret.
     *
     * Varsayılan olarak üretilmiyor, çünkü çember hep bir gövdeyi sarıyor ve
     * iç yüz görünmüyor — üretmemek bedava üçgen tasarrufu. Ama serbest duran
     * bir halka (çuvalın ipi, balyanın bağı) böyle KAPALI OLMAYAN bir katı
     * oluyor ve doğrulamadaki "ters yüz yok" kontrolü haklı olarak düşüyor.
     * Bu bayrak o durum için.
     */
    readonly inner?: boolean
  } = {},
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
    // İç yüz: normali EKSENE doğru baksın diye köşe sırası dıştakinin tersi.
    if (options.inner) {
      quad(sink, innerHigh0, innerHigh1, innerLow1, innerLow0, colour)
    }
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
 * Daralan kutu: alt ve üst dikdörtgeni farklı olabilen bir gövde.
 *
 * Örs boynuzu, tabure ayağı, çit direği ucu, alet sapı — kitin "kutu ama
 * yontulmuş" parçalarının hepsi bu. Sarım boxGeometry ile aynı mantıkta.
 */
export function taperedBoxGeometry(
  bottom: readonly [number, number],
  top: readonly [number, number],
  height: number,
  centre: Vec3,
  colour: Color,
  colourTop?: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const [cx, cy, cz] = centre
  const low = cy - height / 2
  const high = cy + height / 2
  const upper = colourTop ?? colour

  // b = alt köşeler, t = üst köşeler; ikisi de aynı sırada:
  // (-x,+z) (+x,+z) (+x,-z) (-x,-z)
  const corner = (size: readonly [number, number], y: number, sx: number, sz: number): Vec3 =>
    [cx + (sx * size[0]) / 2, y, cz + (sz * size[1]) / 2]

  const b0 = corner(bottom, low, -1, 1), b1 = corner(bottom, low, 1, 1)
  const b2 = corner(bottom, low, 1, -1), b3 = corner(bottom, low, -1, -1)
  const t0 = corner(top, high, -1, 1), t1 = corner(top, high, 1, 1)
  const t2 = corner(top, high, 1, -1), t3 = corner(top, high, -1, -1)

  const side = (bl: Vec3, br: Vec3, tr: Vec3, tl: Vec3): void => {
    triShaded(sink, bl, br, tr, colour, colour, upper)
    triShaded(sink, bl, tr, tl, colour, upper, upper)
  }
  side(b0, b1, t1, t0)  // +Z
  side(b2, b3, t3, t2)  // -Z
  side(b1, b2, t2, t1)  // +X
  side(b3, b0, t0, t3)  // -X

  quad(sink, t0, t1, t2, t3, upper)  // üst → +Y
  quad(sink, b3, b2, b1, b0, colour) // alt → -Y
  return finish(sink)
}

/**
 * Yay boyunca süpürülmüş kare kesitli çubuk — kova kulpu, halka, kanca.
 *
 * Kesit, süpürme yönüne (teğet) göre saat yönünün tersinde diziliyor; dış
 * yüzlerin dışa bakmasını sağlayan şey bu. Yay XY düzleminde üretilir, model
 * onu istediği gibi döndürür.
 */
export function arcBarGeometry(
  radius: number,
  thickness: number,
  fromAngle: number,
  toAngle: number,
  segments: number,
  centre: Vec3,
  colour: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const h = thickness / 2
  const [cx, cy, cz] = centre
  const rings: Vec3[][] = []

  for (let i = 0; i <= segments; i += 1) {
    const a = fromAngle + ((toAngle - fromAngle) * i) / segments
    // p: yay üzerindeki nokta. r: yarıçap yönü. z: düzlem normali.
    const px = cx + Math.cos(a) * radius
    const py = cy + Math.sin(a) * radius
    const rx = Math.cos(a), ry = Math.sin(a)
    const at = (su: number, sv: number): Vec3 =>
      [px + sv * h * rx, py + sv * h * ry, cz + su * h]
    // u = düzlem normali, v = yarıçap yönü. u×v teğete eşit olduğu için bu
    // sıralama süpürme yönüne göre saat yönünün tersi.
    rings.push([at(1, 1), at(-1, 1), at(-1, -1), at(1, -1)])
  }

  for (let i = 0; i < segments; i += 1) {
    const a = rings[i]!, b = rings[i + 1]!
    for (let j = 0; j < 4; j += 1) {
      const k = (j + 1) % 4
      quad(sink, a[j]!, a[k]!, b[k]!, b[j]!, colour)
    }
  }

  const first = rings[0]!, last = rings[segments]!
  quad(sink, first[0]!, first[3]!, first[2]!, first[1]!, colour) // baş kapak
  quad(sink, last[0]!, last[1]!, last[2]!, last[3]!, colour)     // son kapak
  return finish(sink)
}

export interface SheetLevel {
  /** Dikey konum. */
  readonly y: number
  /** O yükseklikte yarım genişlik. */
  readonly halfWidth: number
  /** Levha kalınlığı. */
  readonly thickness: number
  /** Kavis yüksekliği: kenarların ortaya göre ne kadar kalktığı. 0 = düz. */
  readonly curve: number
}

/**
 * Kavisli levha — tek parça, dikişsiz içbükey yüzey.
 *
 * Kürek ağzını üç ayrı düz panelden kurmayı iki kez denedim ve ikisinde de
 * sonuç "üç tahta yan yana" oldu: paneller kendi merkezleri etrafında döndüğü
 * için aralarında kademe kalıyor, göz onu tek yüzey olarak okumuyordu.
 *
 * Doğrusu enine kesiti eğri olan TEK bir levha üretmek. Kesit her seviyede
 * `curve` kadar kavisli bir yay; genişlik ve kalınlık seviyeden seviyeye
 * değişebiliyor. Çukur +Z yönüne bakar.
 *
 * Küreğin yanında kalkan, yalak, çatı örtüsü ve değirmen kanadı da bunu ister.
 */
export function dishedSheetGeometry(
  levels: readonly SheetLevel[],
  segments: number,
  colour: Color,
  colourTop?: Color,
): BufferGeometry {
  if (levels.length < 2) throw new Error('dishedSheetGeometry en az iki seviye ister')
  const sink: Sink = { position: [], color: [] }
  const top = colourTop ?? colour
  const shade = (i: number): Color =>
    colourTop ? new Color().copy(colour).lerp(top, i / (levels.length - 1)) : colour

  // front[i][j] / back[i][j]: seviye i, kesit boyunca j
  const front: Vec3[][] = []
  const back: Vec3[][] = []
  for (const level of levels) {
    const f: Vec3[] = []
    const b: Vec3[] = []
    for (let j = 0; j <= segments; j += 1) {
      const u = (j / segments) * 2 - 1          // -1 .. +1
      const x = u * level.halfWidth
      // Parabolik kesit: ortada 0, kenarlarda `curve`. Kenarların kalkması
      // çukuru oluşturuyor.
      const z = level.curve * u * u
      f.push([x, level.y, z + level.thickness / 2])
      b.push([x, level.y, z - level.thickness / 2])
    }
    front.push(f)
    back.push(b)
  }

  const last = levels.length - 1
  for (let i = 0; i < last; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      // Ön yüz: +Z'ye bakar. (a→b = +X, a→c = +X+Y, çarpım +Z.)
      triShaded(sink, front[i]![j]!, front[i]![j + 1]!, front[i + 1]![j + 1]!,
        shade(i), shade(i), shade(i + 1))
      triShaded(sink, front[i]![j]!, front[i + 1]![j + 1]!, front[i + 1]![j]!,
        shade(i), shade(i + 1), shade(i + 1))
      // Arka yüz: ters sarım.
      triShaded(sink, back[i]![j]!, back[i + 1]![j + 1]!, back[i]![j + 1]!,
        shade(i), shade(i + 1), shade(i))
      triShaded(sink, back[i]![j]!, back[i + 1]![j]!, back[i + 1]![j + 1]!,
        shade(i), shade(i + 1), shade(i + 1))
    }

    // Yan kenarlar: sağ +X'e, sol -X'e bakar.
    quad(sink, front[i]![segments]!, back[i]![segments]!,
      back[i + 1]![segments]!, front[i + 1]![segments]!, shade(i))
    quad(sink, back[i]![0]!, front[i]![0]!,
      front[i + 1]![0]!, back[i + 1]![0]!, shade(i))
  }

  // Üst ve alt kenar şeritleri.
  for (let j = 0; j < segments; j += 1) {
    quad(sink, front[last]![j]!, front[last]![j + 1]!,
      back[last]![j + 1]!, back[last]![j]!, shade(last))
    quad(sink, back[0]![j]!, back[0]![j + 1]!,
      front[0]![j + 1]!, front[0]![j]!, shade(0))
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
  // Girdilerin normalleri atılıyor. Sebebi bir tuzak: bu fonksiyon
  // birleştirmeden SONRA normal hesapladığı için çıktısının `normal`
  // attribute'u oluyor, ham geometrilerin olmuyor. İkisini bir arada
  // birleştirmeye kalkınca mergeGeometries "attribute sayıları uyuşmuyor"
  // diyerek düşüyordu. Zaten aşağıda yeniden hesaplandığı için girdideki
  // normal bilgisinin hiçbir değeri yok.
  for (const geometry of geometries) geometry.deleteAttribute('normal')

  const merged = mergeGeometries(geometries as BufferGeometry[], false)
  if (!merged) throw new Error('Geometriler birleştirilemedi: attribute setleri uyuşmuyor')
  for (const geometry of geometries) geometry.dispose()
  merged.computeVertexNormals()
  return merged
}

/**
 * Düz bir gövdeyi yay hâline büker (Y ekseni boyunca, YZ düzleminde).
 *
 * Yaba dişleri için yazıldı. Düz bir diş, ne kadar kalın olursa olsun, teknik
 * resim gibi duruyor; hafif bir kavis onu dövülmüş bir alete çeviriyor. Aynı
 * ihtiyaç kanca, boynuz ve tırpanda da var.
 *
 * Basit "her noktayı kendi yüksekliğiyle orantılı döndür" yaklaşımı gövdeyi
 * uzatıp inceltiyordu. Buradaki dönüşüm gerçek bir yay eşlemesi: gövde,
 * yarıçapı 1/curvature olan bir çemberin üstüne SARILIYOR, dolayısıyla merkez
 * hattının uzunluğu korunuyor.
 *
 * İKİ TUZAK, ikisi de ölçülerek bulundu:
 *
 * 1. Yay y=0 etrafında sarılıyor, dolayısıyla SONUÇ GEOMETRİNİN Y'DE NEREDE
 *    DURDUĞUNA BAĞLI. Tabanı orijinde olan bir çubuk gerçekten kıvrılır; y=0'da
 *    ORTALANMIŞ bir gövde ise simetrik bükülür — iki ucu aynı yöne gider, orta
 *    yerinde kalır ve siluet neredeyse hiç değişmez. Çapanın ağzında tam bu
 *    olmuştu: 0.235 m'lik ağızda kıvrılma 14 mm kayma üretiyor ama Z aralığını
 *    0.0337'den 0.0327'ye DÜŞÜRÜYORDU. Aynı ağzı tabanı orijinde kurup bükünce
 *    kaçış 44 mm, aralık 0.078 oluyor. Bükmek istediğin şeyi orijinden BAŞLAT.
 *
 * 2. Yay, geometrinin Y ekseni boyunca kaç KESİTİ olduğu kadar pürüzsüz.
 *    İki seviyeli bir kutu (chamferedBoxGeometry) bükülünce yay değil
 *    eğrilmiş bir kutu verir. Gerçek yay için `latheGeometry` gibi ara
 *    seviyeleri olan bir gövde gerekiyor.
 *
 * @param curvature 1/yarıçap. Pozitif değer +Z yönüne büker. 0 hiçbir şey yapmaz.
 */
export function bendGeometry(geometry: BufferGeometry, curvature: number): BufferGeometry {
  if (Math.abs(curvature) < 1e-9) return geometry
  const position = geometry.getAttribute('position')
  const radius = 1 / curvature
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i)
    const z = position.getZ(i)
    const angle = y * curvature
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    // Merkez hattı + kesitin teğete dik kaydırması.
    position.setY(i, radius * sin - z * sin)
    position.setZ(i, radius * (1 - cos) + z * cos)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** Konumdan türetilen deterministik karma. Aynı nokta hep aynı değeri verir. */
function positionHash(x: number, y: number, z: number, salt: number): number {
  // Nokta 0.1 mm ızgarasına yuvarlanıyor: kayan nokta gürültüsü yüzünden
  // "aynı" köşelerin farklı karma alması, yüzeyi yırtan tek hataydı.
  let h = Math.imul(Math.round(x * 1e4) | 0, 0x27d4eb2d)
  h ^= Math.imul(Math.round(y * 1e4) | 0, 0x165667b1)
  h ^= Math.imul(Math.round(z * 1e4) | 0, 0x9e3779b1)
  h = Math.imul(h ^ salt, 0x85ebca6b)
  h ^= h >>> 13
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

export interface RoughenOptions {
  /** Aynı geometriyi farklı biçimde bozmak için. */
  readonly salt?: number
  /** Y ekseninde sapma çarpanı. Saman balyasında düşük tutuluyor. */
  readonly scaleY?: number
}

/**
 * Yüzeyi düzensizleştirir: her köşe kendi konumundan türeyen sabit bir miktar
 * kayar.
 *
 * Neden konumdan türetiliyor: bu geometriler İNDEKSSİZ, yani her üçgen kendi
 * köşelerini taşıyor ve bir noktada üç-dört kopya bulunuyor. Köşeleri
 * bağımsızca oynatmak yüzeyi yırtıyor — ilk denemede saman balyası delik
 * deşik olmuştu. Konum karması aynı noktadaki bütün kopyalara AYNI kaymayı
 * verdiği için yüzey kapalı kalıyor.
 *
 * Bu, samanı samana benzeten tek şey: düzgün bir kutu ne renk verirsen ver
 * sünger gibi duruyor.
 */
export function roughenGeometry(
  geometry: BufferGeometry,
  amount: number,
  options: RoughenOptions = {},
): BufferGeometry {
  if (amount <= 0) return geometry
  const salt = options.salt ?? 0
  const scaleY = options.scaleY ?? 1
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    position.setXYZ(
      i,
      x + positionHash(x, y, z, salt + 1) * amount,
      y + positionHash(x, y, z, salt + 2) * amount * scaleY,
      z + positionHash(x, y, z, salt + 3) * amount,
    )
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

export interface MottleOptions {
  /** Aynı geometriye farklı desen vermek için. */
  readonly salt?: number
  /**
   * Beneklerin büyüklüğü (metre). Konumlar bu ızgaraya yuvarlanıp
   * karmalandığı için aynı hücredeki köşeler aynı tonu alıyor — yani gürültü
   * değil LEKE oluşuyor. Küçük değer kum, büyük değer alacalı yüzey verir.
   */
  readonly cell?: number
  /** Ton kaymasının parlaklığa göre oranı. Yüksek değer alacayı renklendirir. */
  readonly hue?: number
}

/**
 * Vertex renklerine yüzey alacası işler.
 *
 * "Doku konusunda ne yapacağız?" sorusunun bu kitteki cevabı bu. Bitmap doku
 * üç şey isterdi: UV koordinatları (geometrimizde yok), registry'nin taşıması
 * gereken görüntü dosyaları ve kitin kimliğinin değişmesi. Üçü de bedeli
 * kazancından büyük.
 *
 * Yerine yüzeyin KENDİ konumundan türeyen bir leke deseni kullanılıyor.
 * `bakeOcclusion` yüzeyin BİÇİMİNDEN gölge üretiyordu; bu da yüzeye malzeme
 * dokusu veriyor. İkisi birlikte, tek bir doku dosyası olmadan, düz renkli
 * lowpoly yüzeyi malzeme gibi gösteriyor.
 *
 * Sınırı dürüstçe söylemek gerekir: benekler geometrinin köşelerinde
 * örnekleniyor, dolayısıyla çözünürlüğü üçgen yoğunluğu belirliyor. Geniş ve
 * az bölünmüş bir yüzeyde `cell` küçültmek işe yaramaz — orada çare üçgeni
 * bölmek, ki bu da lowpoly bütçesini yer.
 */
export function mottleGeometry(
  geometry: BufferGeometry,
  amount: number,
  options: MottleOptions = {},
): BufferGeometry {
  const colour = geometry.getAttribute('color')
  if (!colour || amount <= 0) return geometry
  const position = geometry.getAttribute('position')
  const salt = options.salt ?? 0
  const cell = options.cell ?? 0.05
  const hue = options.hue ?? 0.35

  for (let i = 0; i < colour.count; i += 1) {
    const x = Math.round(position.getX(i) / cell) * cell
    const y = Math.round(position.getY(i) / cell) * cell
    const z = Math.round(position.getZ(i) / cell) * cell
    const shade = 1 + positionHash(x, y, z, salt + 7) * amount
    // Kanallar arasında küçük bir fark: gerçek malzemede açılan yer sadece
    // parlaklaşmaz, biraz da doygunluk kaybeder.
    const warm = positionHash(x, y, z, salt + 8) * amount * hue
    colour.setXYZ(
      i,
      Math.max(0, colour.getX(i) * (shade + warm)),
      Math.max(0, colour.getY(i) * shade),
      Math.max(0, colour.getZ(i) * (shade - warm)),
    )
  }
  colour.needsUpdate = true
  return geometry
}
