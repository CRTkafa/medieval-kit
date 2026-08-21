import { Color, type BufferGeometry } from 'three'

import { latheGeometry, mergeColoured, type Level } from './geometry.ts'
import { jitter } from './random.ts'
import { MEDIEVAL_PALETTE } from './materials.ts'

/**
 * El aletlerinin ortak dili.
 *
 * İlk denemede üç alet de düz bir prizma sap + kutu bir uçtan ibaretti ve
 * oyuncak gibi duruyorlardı. Sebebi tek tek küçük şeylerdi:
 *
 *   - Sap boydan boya aynı kalınlıktaydı. Gerçek sapın dibinde şişkinlik
 *     (kabza) vardır — el kaymasın diye. Silueti okunur yapan tek detay bu.
 *   - Uç, sapa doğrudan yapışıyordu. Gerçek alette koni biçimli bir soket
 *     vardır; sap onun içine girer.
 *   - Hiçbir yerde geometrik varyasyon yoktu, sadece renk değişiyordu. Dövme
 *     bir alet kusursuz simetrik değildir.
 *
 * Bu modül üçünü de tek yerden veriyor, yani kite yeni alet eklemek artık
 * "ucu ne" sorusunu cevaplamaktan ibaret.
 */

export interface ShaftOptions {
  readonly length: number
  readonly radius: number
  /** Kaç köşe. 6 yeterli: elde tutulan bir çubukta 8 siluete bir şey katmıyor. */
  readonly segments?: number
  readonly random: () => number
}

export interface ToolShaft {
  readonly geometry: BufferGeometry
  /** Sapın üst ucunun Y konumu — uç buraya oturur. */
  readonly top: number
  /** Sapın üst uçtaki yarıçapı. */
  readonly topRadius: number
}

/**
 * Alet sapı: dipte kabza şişkinliği, ortada uzun düz gövde, üste doğru hafif
 * incelme. Tek bir lathe olarak üretiliyor — üst üste prizma yığmak aralarında
 * çakışan yüz çifti bırakırdı.
 */
export function toolShaft(options: ShaftOptions): ToolShaft {
  const { length, radius, random } = options
  const segments = options.segments ?? 6
  const bottom = -length / 2
  const top = length / 2
  const r = (scale: number): number => radius * scale * (1 + jitter(random, 0.02))

  const profile: Level[] = [
    { y: bottom, radius: r(0.78) },              // dip: yuvarlatılmış uç
    { y: bottom + length * 0.012, radius: r(1.18) }, // kabza şişkinliğinin altı
    { y: bottom + length * 0.075, radius: r(1.1) },  // kabzanın tepesi
    { y: bottom + length * 0.14, radius: r(0.94) },  // kabza ile gövde arası bel
    { y: bottom + length * 0.55, radius: r(1) },     // gövde
    { y: top, radius: r(0.9) },                      // uca doğru incelme
  ]

  const tint = new Color(MEDIEVAL_PALETTE.oak)
  tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), 0.05 + jitter(random, 0.05))
  const tintTop = new Color(MEDIEVAL_PALETTE.oak)
  // Uç tarafı elden daha az geçtiği için biraz daha koyu.
  tintTop.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), -0.02 + jitter(random, 0.04))

  return {
    geometry: latheGeometry(profile, segments, [0, 0, 0], tint, { colourTop: tintTop }),
    top,
    topRadius: profile.at(-1)!.radius,
  }
}

export interface SocketOptions {
  /** Soketin oturduğu Y konumu (sapın üst ucu). */
  readonly y: number
  /** Sapın o noktadaki yarıçapı. */
  readonly shaftRadius: number
  /** Soket uzunluğu. */
  readonly length: number
  readonly segments?: number
  readonly random: () => number
}

/**
 * Dövme soket: sapı saran, yukarı doğru genişleyen koni ve üstünde bir bilezik.
 *
 * Sapın İÇİNE doğru uzatılıyor — alt ucu sapın gövdesinde kaldığı için hiçbir
 * yüzey sapın yüzeyiyle aynı düzleme oturmuyor.
 */
export function toolSocket(options: SocketOptions): BufferGeometry {
  const { y, shaftRadius, length, random } = options
  const segments = options.segments ?? 6
  const tint = new Color(MEDIEVAL_PALETTE.iron)
  tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.05))
  const collar = new Color(MEDIEVAL_PALETTE.iron)
  collar.offsetHSL(0, jitter(random, 0.02), 0.04 + jitter(random, 0.04))

  const profile: Level[] = [
    { y: y - length * 0.9, radius: shaftRadius * 1.12 },
    { y: y - length * 0.45, radius: shaftRadius * 1.34 },
    { y: y + length * 0.1, radius: shaftRadius * 1.5 },
    { y: y + length * 0.22, radius: shaftRadius * 1.72 },  // bilezik
    { y: y + length * 0.34, radius: shaftRadius * 1.46 },
  ]
  return mergeColoured([latheGeometry(profile, segments, [0, 0, 0], tint, { colourTop: collar })])
}

/** Demir tonu, küçük bir sapma ile. Üç alette de aynı elden çıkmış görünsün diye. */
export function ironTint(random: () => number, lift = 0): Color {
  const tint = new Color(MEDIEVAL_PALETTE.iron)
  tint.offsetHSL(0, jitter(random, 0.02), lift + jitter(random, 0.05))
  return tint
}

/**
 * Parlamış çelik tonu — `steel` yuvası için.
 *
 * Sapma `ironTint`ten dar tutuluyor: parlak bir yüzeyin rengini belirleyen şey
 * kendi pigmenti değil yansıttığı ortam. Vertex renginde ton oynatmak burada
 * kirli görünür, bu yüzden sadece parlaklıkta minik bir kıpırdanma var.
 */
export function steelTint(random: () => number, lift = 0): Color {
  const tint = new Color(MEDIEVAL_PALETTE.steel)
  tint.offsetHSL(0, jitter(random, 0.008), lift + jitter(random, 0.025))
  return tint
}
