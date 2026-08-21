/**
 * @medieval-kit/trestle-table
 *
 * Sehpa masa: ortaçağın standart masası. Tabla ayaklara ÇAKILI DEĞİL, üstüne
 * konur — yemek bitince kaldırılıp salon boşaltılabilsin diye. O yüzden tabla
 * tahtaları ayaklardan bağımsız durur ve aralarında boşluk vardır.
 *
 * Sehpa (trestle): yatay bir başlık, ondan aşağı açılan iki ayak, altta bir
 * pabuç. İki sehpa bir gergiyle birbirine bağlanır.
 */
import { Color } from 'three'

import {
  MEDIEVAL_PALETTE,
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  mergeColoured,
} from '../core/index.ts'

export interface TrestleTableConfig {
  /** Tabla uzunluğu (metre). */
  readonly length: number
  /** Tabla genişliği (metre). */
  readonly width: number
  readonly height: number
  /** Tabla tahtası sayısı. */
  readonly plankCount: number
  /** Ayakların dışa açıklığı. */
  readonly splay: number
  readonly seed: number
}

export const trestleTableDefaults: TrestleTableConfig = {
  length: 1.9,
  width: 0.78,
  height: 0.74,
  plankCount: 4,
  splay: 0.22,
  seed: 19,
}

export type TrestleTableParts = 'top' | 'trestles' | 'stretcher'

export function createModel(overrides: Partial<TrestleTableConfig> = {}) {
  return createKitModel<TrestleTableConfig, 'oak', TrestleTableParts>({
    id: 'trestle-table',
    defaults: trestleTableDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const oak = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.055))
        return tint
      }
      const half = config.height / 2
      const board = config.height * 0.045
      const timber = config.height * 0.075

      // --- tabla: ayrı tahtalar, aralarında ince boşluk ---
      const planks = []
      const count = Math.max(1, config.plankCount)
      const gap = config.width * 0.008
      const plankWidth = (config.width - gap * (count - 1)) / count
      for (let i = 0; i < count; i += 1) {
        const z = -config.width / 2 + plankWidth / 2 + i * (plankWidth + gap)
        // Her tahta kendi kalınlığında ve tonunda: kesilmiş, rendelenmiş,
        // yıllarca kullanılmış bir tabla tekdüze olmaz.
        const thickness = board * (1 + jitter(random, 0.08))
        planks.push(chamferedBoxGeometry(
          [config.length, plankWidth],
          [config.length, plankWidth],
          thickness,
          board * 0.22,
          [jitter(random, config.length * 0.004), half - thickness / 2, z],
          oak(0.04),
        ))
      }

      // --- sehpalar ---
      const trestles = []
      const trestleX = config.length * 0.31
      const legSpan = config.height - board
      for (const side of [-1, 1] as const) {
        const x = side * trestleX
        // Başlık: tablayı taşıyan yatay kiriş.
        trestles.push(chamferedBoxGeometry(
          [timber * 1.1, config.width * 0.72],
          [timber * 1.1, config.width * 0.72],
          timber * 0.9,
          timber * 0.16,
          [x, half - board - timber * 0.45, 0],
          oak(-0.02),
        ))
        // İki ayak: başlıktan aşağı açılarak iner.
        for (const dir of [-1, 1] as const) {
          const leg = chamferedBoxGeometry(
            [timber * 0.9, timber * 0.8],
            [timber * 1.05, timber * 0.95],
            legSpan,
            timber * 0.15,
            [0, -legSpan / 2, 0],
            oak(),
          )
          leg.rotateX(dir * config.splay)
          // Ayaklar başlığa AYRI noktalardan geçer; iki kalas aynı deliği
          // paylaşamaz. Bu kaydırma olmadan splay=0 iken ikisi üst üste biner.
          leg.translate(x, half - board - timber * 0.3, dir * timber * 0.62)
          trestles.push(leg)
        }
        // Merkez dikme: başlıktan pabuca inen düşey kalas. Gergi bunun içinden
        // geçer — onsuz gergi iki sehpanın ARASINDA havada kalıyordu, çünkü
        // ayaklar açıldıkça z ekseninde uzaklaşıp gergiye değmiyorlardı.
        trestles.push(chamferedBoxGeometry(
          [timber * 0.8, timber * 0.85],
          [timber * 0.9, timber * 0.9],
          config.height - board - timber * 0.5,
          timber * 0.14,
          [x, -half + (config.height - board - timber * 0.5) / 2 + timber * 0.2, 0],
          oak(-0.01),
        ))

        // Pabuç: yere basan enine ayak. Zemin düzgün olmadığı için bu şart.
        const spread = Math.sin(config.splay) * legSpan
        trestles.push(chamferedBoxGeometry(
          [timber * 1.2, config.width * 0.62 + spread * 2],
          [timber * 1.05, config.width * 0.58 + spread * 2],
          timber * 0.62,
          timber * 0.14,
          [x, -half + timber * 0.31, 0],
          oak(-0.04),
        ))
      }

      // --- gergi: iki sehpayı bağlayan uzun kiriş, ayakların içine girer ---
      const stretcher = chamferedBoxGeometry(
        [trestleX * 2 + timber * 1.6, timber * 0.7],
        [trestleX * 2 + timber * 1.6, timber * 0.7],
        timber * 0.85,
        timber * 0.15,
        [0, -half + config.height * 0.24, 0],
        oak(-0.03),
      )

      return {
        top: { slot: 'oak', geometry: mergeColoured(planks) },
        trestles: { slot: 'oak', geometry: mergeColoured(trestles) },
        stretcher: { slot: 'oak', geometry: stretcher },
      }
    },
  }, overrides)
}
