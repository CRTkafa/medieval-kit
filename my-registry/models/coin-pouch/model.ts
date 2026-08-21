/**
 * @medieval-kit/coin-pouch
 *
 * Büzgülü deri kese ve yanına dökülmüş sikkeler.
 *
 * Kesenin tek başına bir sorunu var: kapalı bir deri torba, uzaktan bakınca
 * taştan ayırt edilemiyor. İçindekini gösteren şey DÖKÜLEN sikkeler; onlar
 * olmadan model "kese" değil "yumru" oluyor. Bu yüzden sikkeler isteğe bağlı
 * bir süs değil, modelin okunmasının kendisi.
 *
 * Sikke yerleşimi de düşünülmüş: yere dökülen madenî para düzgün bir çember
 * yapmaz, kesenin ağzından bir yöne saçılır ve bir kısmı üst üste biner. Eşit
 * aralıklı bir halka her zaman "yerleştirilmiş" görünüyordu.
 *
 * Dönem notu: gümüş peni ince ve KÜÇÜKTÜR — bir santimden biraz büyük. Kalın,
 * altın, iri sikke fantezi görüntüsüdür; burada oran gerçeğe yakın tutuldu ve
 * bu, kesenin ölçeğini de doğru okutuyor.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface CoinPouchConfig {
  /** Kesenin yüksekliği (metre). */
  readonly height: number
  /** Kesenin en geniş yarıçapı (metre). */
  readonly radius: number
  /** Ne kadar dolu. 0.3 yarı boş ve sarkık, 1 tıka basa. */
  readonly fill: number
  /** Dışarı dökülmüş sikke sayısı. */
  readonly coins: number
  /** Sikke yarıçapı (metre). */
  readonly coinRadius: number
  readonly seed: number
}

export const coinPouchDefaults: CoinPouchConfig = {
  height: 0.1,
  radius: 0.042,
  fill: 0.85,
  coins: 9,
  coinRadius: 0.011,
  seed: 89,
}

export type CoinPouchParts = 'pouch' | 'cord' | 'coins'

export function createModel(overrides: Partial<CoinPouchConfig> = {}) {
  return createKitModel<CoinPouchConfig, 'leather' | 'cloth' | 'brass', CoinPouchParts>({
    id: 'coin-pouch',
    defaults: coinPouchDefaults,
    slots: ['leather', 'cloth', 'brass'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const fill = Math.max(0.15, Math.min(1, config.fill))
      const floor = 0                       // kese yere oturuyor
      const wide = config.radius * (0.68 + fill * 0.4)
      const neckY = config.height * (0.62 + fill * 0.14)

      // --- Kese ---------------------------------------------------------------
      // Çuvalın küçüğü ama profili farklı: kese ipin ÜSTÜNDE büzülüp yukarı
      // toplanıyor, çuvalınki gibi dışa devrilmiyor. Aradaki fark bir kese ile
      // bir torba arasındaki fark.
      const profile: Level[] = [
        { y: floor, radius: wide * 0.62 },
        { y: config.height * 0.1, radius: wide * 0.94 },
        { y: config.height * 0.3 * fill + config.height * 0.12, radius: wide },
        { y: neckY - config.height * 0.14, radius: wide * 0.78 },
        { y: neckY, radius: config.radius * 0.3 },
        { y: neckY + config.height * 0.16, radius: config.radius * 0.26 },
        { y: neckY + config.height * 0.28, radius: config.radius * 0.34 },
      ]
      const pouch = latheGeometry(profile, 9, [0, 0, 0], tint('leather', -0.05, 0.9), {
        colourTop: tint('leather', 0.06, 0.9),
        capTop: true,
      })
      roughenGeometry(pouch, config.radius * 0.055, { salt: 51, scaleY: 0.6 })

      // --- Büzgü ipi -----------------------------------------------------------
      const cordPieces: BufferGeometry[] = [bandGeometry(
        config.radius * 0.31, neckY, config.height * 0.05, config.radius * 0.055, 8,
        tint('cloth', -0.18, 0.8), { inner: true },
      )]
      // Sarkan iki uç. Önce yönlendir, sonra taşı.
      for (const side of [-1, 1]) {
        const tail = prismGeometry(
          config.radius * 0.04, config.radius * 0.028, config.height * 0.3, 4,
          [0, -config.height * 0.15, 0], tint('cloth', -0.12, 0.8),
        )
        tail.rotateZ(side * 0.7 + jitter(random, 0.15))
        tail.rotateY(random() * Math.PI * 2)
        tail.translate(side * config.radius * 0.28, neckY, 0)
        cordPieces.push(tail)
      }

      // --- Dökülen sikkeler ------------------------------------------------------
      const count = Math.max(0, Math.round(config.coins))
      const coinPieces: BufferGeometry[] = []
      // Saçılma YÖNÜ: tek bir yöne doğru, çünkü dökülen para bir yana akar.
      const spillAngle = random() * Math.PI * 2
      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.6) / count
        // Uzaklık kökle artıyor: kesenin dibinde yığılma, uzakta seyrelme.
        const distance = wide * (1.15 + Math.sqrt(t) * 2.4)
        const spread = jitter(random, 0.75) * (0.35 + t * 0.65)
        const angle = spillAngle + spread
        const thickness = config.coinRadius * (0.13 + random() * 0.06)
        // Üst üste binenler: her üçüncü sikke bir öncekinin üstüne düşüyor.
        const stack = i % 3 === 2 ? thickness * 1.6 : 0

        const coin = prismGeometry(
          config.coinRadius * (0.92 + random() * 0.16),
          config.coinRadius * (0.9 + random() * 0.16),
          thickness, 9, [0, 0, 0], tint('brass', jitter(random, 0.06), 0.5),
        )
        // Bir kısmı yatık düşmez: kenarına yaslananlar yığına derinlik veriyor.
        const tilt = random() < 0.22 ? 0.5 + random() * 0.7 : jitter(random, 0.12)
        coin.rotateX(tilt)
        coin.rotateY(random() * Math.PI * 2)
        coin.translate(
          Math.sin(angle) * distance,
          floor + thickness / 2 + stack + Math.sin(tilt) * config.coinRadius * 0.5,
          Math.cos(angle) * distance,
        )
        coinPieces.push(coin)
      }

      return {
        pouch: { slot: 'leather' as const, geometry: mergeColoured([pouch]) },
        cord: { slot: 'cloth' as const, geometry: mergeColoured(cordPieces) },
        coins: coinPieces.length > 0
          ? { slot: 'brass' as const, geometry: mergeColoured(coinPieces) }
          : undefined,
      }
    },
  }, overrides)
}
