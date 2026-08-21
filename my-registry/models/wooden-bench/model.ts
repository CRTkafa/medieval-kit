/**
 * @medieval-kit/wooden-bench
 *
 * Sehpa masanın yanına oturan bank. Ortaçağda sandalye statü nesnesiydi;
 * insanların oturduğu şey banktı, o yüzden bir salon sahnesinde masadan bile
 * çok gerekir.
 *
 * Yapısı masanınkinin sadeleştirilmişi: iki kalın uç tahtası, aralarında bir
 * gergi, üstte oturak. Ama masadan bir farkı var — oturak ayaklara ÇAKILI.
 * Masanın tablası kaldırılabilirdi, bankın oturağı kaldırılmaz; bu yüzden
 * ayaklar oturağın içine geçen zıvanalarla bağlanıyor ve o zıvanalar oturağın
 * üstünden görünüyor. Ortaçağ marangozluğunun imzası bu.
 */
import {
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  taperedBoxGeometry,
} from '../core/index.ts'

export interface WoodenBenchConfig {
  /** Bank uzunluğu (metre). */
  readonly length: number
  /** Oturak yüksekliği (metre). */
  readonly height: number
  /** Oturak genişliği (metre). */
  readonly width: number
  /** Ayakların dışa açıklığı. 0 = dik. */
  readonly splay: number
  /** Ayakların uçlardan ne kadar içeride durduğu, uzunluğun oranı olarak. */
  readonly inset: number
  readonly seed: number
}

export const woodenBenchDefaults: WoodenBenchConfig = {
  length: 1.62,
  height: 0.45,
  width: 0.3,
  splay: 0.24,
  inset: 0.13,
  seed: 31,
}

export type WoodenBenchParts = 'seat' | 'legs' | 'stretcher'

export function createModel(overrides: Partial<WoodenBenchConfig> = {}) {
  return createKitModel<WoodenBenchConfig, 'oak', WoodenBenchParts>({
    id: 'wooden-bench',
    defaults: woodenBenchDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const seatThickness = config.height * 0.09
      const seatTop = half
      const seatBottom = seatTop - seatThickness
      const timber = config.width * 0.09

      // --- Oturak --------------------------------------------------------
      // Tek bir kalın tahta. Bankta iki tahta kullanmak masadaki gibi doğal
      // değil: oturağın arası boş olmamalı.
      const seatPieces = [chamferedBoxGeometry(
        [config.length, config.width * 0.95],
        [config.length * 0.995, config.width],
        seatThickness,
        timber * 0.4,
        [0, seatBottom + seatThickness / 2, 0],
        tint('oak', 0.05),
      )]

      // --- Ayaklar -------------------------------------------------------
      const legX = config.length * (0.5 - config.inset)
      const legHeight = seatBottom - (-half)
      const legWidth = config.width * 0.66
      const spread = legWidth * config.splay

      const legPieces = []
      for (const side of [-1, 1]) {
        // Ayak tahtası: aşağı doğru yayvanlaşıyor. Yayvanlık ölçüde, açıda
        // değil — döndürmek yerine alt yüzü genişletmek hem daha ucuz hem de
        // tabanı yere TAM basıyor, oysa döndürülmüş bir ayak kenarı üstünde
        // durur.
        legPieces.push(taperedBoxGeometry(
          [legWidth + spread * 2, timber * 1.35],
          [legWidth, timber * 1.35],
          legHeight,
          [side * legX, -half + legHeight / 2, 0],
          tint('oak', -0.02),
        ))

        // Zıvana: ayağın oturağın İÇİNDEN geçip üstünde görünen ucu. Oturağın
        // üst yüzünü de aşıyor — ortaçağ bankının en tanınır detayı bu.
        legPieces.push(chamferedBoxGeometry(
          [legWidth * 0.34, timber * 0.85],
          [legWidth * 0.32, timber * 0.8],
          seatThickness * 1.9,
          timber * 0.16,
          [side * legX, seatBottom + seatThickness * 0.75, jitter(random, timber * 0.1)],
          tint('oak', 0.09),
        ))
      }

      // --- Gergi ---------------------------------------------------------
      // İki ayağı birbirine bağlayan çıta. Ayakların İÇİNE giriyor: uçları
      // katı malzemenin içinde kalsın ki hiçbir yüz aynı düzleme oturmasın.
      const stretcherY = -half + legHeight * 0.34
      const stretcher = mergeColoured([boxGeometry(
        [legX * 2 + legWidth * 0.4, timber * 1.5, timber * 0.95],
        [0, stretcherY, 0],
        tint('oak', -0.06),
      )])

      return {
        seat: { slot: 'oak' as const, geometry: mergeColoured(seatPieces) },
        legs: { slot: 'oak' as const, geometry: mergeColoured(legPieces) },
        stretcher: { slot: 'oak' as const, geometry: stretcher },
      }
    },
  }, overrides)
}
