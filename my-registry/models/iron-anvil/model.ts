/**
 * @medieval-kit/iron-anvil
 *
 * Örsün silueti dövme sürecinin kendisidir: geniş bir kaide, dara bir bel,
 * üstte geniş bir yüz, bir yanda sivrilen boynuz. Geometri neredeyse tamamen
 * kutu — karakteri veren şey oranlar.
 *
 * Kitin ilk "yer kuran" parçası: tek başına bir demirci köşesi önerir.
 */
import { Color } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  steelTint,
} from '../core/index.ts'

export interface IronAnvilConfig {
  /** Toplam yükseklik (metre). Gerçek bir örs kütüğüyle birlikte ~0.75 m olur. */
  readonly height: number
  /** Üst yüzün uzunluğu (metre). */
  readonly faceLength: number
  /** Üst yüzün genişliği (metre). */
  readonly faceWidth: number
  /** Boynuzun yüzden ne kadar uzadığı, yüz uzunluğunun oranı olarak. */
  readonly hornReach: number
  readonly seed: number
}

export const ironAnvilDefaults: IronAnvilConfig = {
  height: 0.34,
  faceLength: 0.46,
  faceWidth: 0.13,
  hornReach: 0.52,
  seed: 9,
}

export type IronAnvilParts = 'base' | 'waist' | 'body' | 'face' | 'horn'

export function createModel(overrides: Partial<IronAnvilConfig> = {}) {
  return createKitModel<IronAnvilConfig, 'iron' | 'steel', IronAnvilParts>({
    id: 'iron-anvil',
    defaults: ironAnvilDefaults,
    slots: ['iron', 'steel'],
    build: ({ config, random }) => {
      const tint = new Color()
      const shade = (amount = 0.05): Color => {
        tint.copy(MEDIEVAL_PALETTE.iron)
        tint.offsetHSL(0, jitter(random, 0.02), jitter(random, amount))
        return tint
      }

      const half = config.height / 2
      const baseHeight = config.height * 0.2
      const bodyHeight = config.height * 0.3
      const waistHeight = config.height - baseHeight - bodyHeight

      // Kaide: en geniş parça, aşağı doğru hafif yayvan.
      const baseLength = config.faceLength * 0.58
      const baseWidth = config.faceWidth * 1.5
      const base = mergeColoured([
        chamferedBoxGeometry(
        [baseLength * 1.08, baseWidth * 1.08],
        [baseLength, baseWidth],
        baseHeight,
        config.faceWidth * 0.06,
        [0, -half + baseHeight / 2, 0],
        shade(),
      ),
      ])

      // Bel: örsü örs yapan dar boğaz.
      const waist = chamferedBoxGeometry(
        [baseLength * 0.5, baseWidth * 0.46],
        [baseLength * 0.5, baseWidth * 0.46],
        waistHeight,
        config.faceWidth * 0.06,
        [0, -half + baseHeight + waistHeight / 2, 0],
        shade(),
      )

      // Gövde: belden yukarı doğru genişler ve üstte çelik plakayı taşır.
      //
      // Örs gerçekten iki metalden yapılır: dövme demir gövdenin üstüne sert
      // çelik bir plaka kaynatılır. Çekiç hep o plakaya iner, o yüzden yıllar
      // içinde ayna gibi parlar; gövde ise oksitli ve mat kalır. Modelde bunu
      // ayrı bir parça + ayrı materyal yuvası olarak veriyoruz, çünkü fark
      // renkte değil PÜRÜZLÜLÜKTE ve vertex color pürüzlülük taşıyamaz.
      const plateHeight = config.height * 0.055
      const bodyY = half - bodyHeight / 2
      const body = mergeColoured([
        chamferedBoxGeometry(
          [baseLength * 0.62, baseWidth * 0.52],
          [config.faceLength * 0.62, config.faceWidth],
          bodyHeight,
          config.faceWidth * 0.06,
          [0, bodyY, 0],
          shade(0.06),
        ),
      ])

      // Plaka gövdeye BATIRILIYOR: kendi kalınlığının yarısı kadar içeri
      // giriyor, ayrıca dört yanda azıcık taşıyor. İkisi birlikte hiçbir yüz
      // çiftinin aynı düzleme oturmamasını garanti ediyor (z-fighting kuralı).
      const face = mergeColoured([
        chamferedBoxGeometry(
          [config.faceLength * 0.628, config.faceWidth * 1.012],
          [config.faceLength * 0.622, config.faceWidth * 1.006],
          plateHeight,
          config.faceWidth * 0.035,
          [0, half - plateHeight * 0.32, 0],
          steelTint(random),
        ),
      ])

      // Boynuz: gövdeden yatay çıkan, ucu sivrilen koni. Dikey bir daralan kutu
      // üretip Z ekseni etrafında çeyrek tur çevirmek, ayrı bir primitive
      // yazmaktan daha az kod ve aynı sonuç.
      const reach = config.faceLength * config.hornReach
      const horn = chamferedBoxGeometry(
        [config.faceWidth * 0.92, config.faceWidth * 0.86],
        [config.faceWidth * 0.1, config.faceWidth * 0.1],
        reach,
        config.faceWidth * 0.06,
        [0, 0, 0],
        shade(0.04),
      )
      horn.rotateZ(-Math.PI / 2)
      // Gövdenin İÇİNE gir: uç yüzü katı parçanın içinde kalsın ki hiçbir yüzey
      // gövdeyle aynı düzleme oturmasın (z-fighting kuralı).
      horn.translate(config.faceLength * 0.31 + reach / 2 - config.faceWidth * 0.35, bodyY + bodyHeight * 0.12, 0)

      return {
        base: { slot: 'iron', geometry: base },
        waist: { slot: 'iron', geometry: waist },
        body: { slot: 'iron', geometry: body },
        face: { slot: 'steel', geometry: face },
        horn: { slot: 'iron', geometry: horn },
      }
    },
  }, overrides)
}
