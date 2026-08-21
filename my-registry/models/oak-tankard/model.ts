/**
 * @medieval-kit/oak-tankard
 *
 * Meşe maşrapa: fıçının avuç içi boyutundaki hâli. Aynı tahta dili, aynı demir
 * çember, sadece ölçek değişiyor — kitin kendi sözlüğünü ne kadar taşıdığını
 * gösteren örnek.
 *
 * Cam kupa ARAMAYIN: ortaçağda içki kabı tahta, deri ya da kalaydı. Şeffaf cam
 * bardak dönem hatası olurdu ve kitin geri kalanının yanında da yabancı
 * dururdu.
 *
 * Kulp bir mesele oldu. Yuvarlak bir çubuk kulp modern kupa gibi duruyordu;
 * gerçek maşrapanın kulpu YASSI bir tahta ya da demir şerittir, gövdeye iki
 * noktadan tutturulur. Kavis `bendGeometry` ile veriliyor.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  bendGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  headGeometry,
  jitter,
  mergeColoured,
  staveGeometry,
  type Level,
} from '../core/index.ts'

export interface OakTankardConfig {
  /** Yükseklik (metre). */
  readonly height: number
  /** Ağız yarıçapı (metre). */
  readonly radius: number
  /** Tabana doğru daralma. 0 = silindir. */
  readonly taper: number
  /** Tahta sayısı. */
  readonly staveCount: number
  /** Demir çember sayısı. */
  readonly hoopCount: number
  /** Kulp var mı (0/1). */
  readonly handle: number
  readonly seed: number
}

export const oakTankardDefaults: OakTankardConfig = {
  height: 0.175,
  radius: 0.047,
  taper: 0.05,
  staveCount: 10,
  hoopCount: 2,
  handle: 1,
  seed: 61,
}

export type OakTankardParts = 'staves' | 'base' | 'hoops' | 'handle'

export function createModel(overrides: Partial<OakTankardConfig> = {}) {
  return createKitModel<OakTankardConfig, 'oak' | 'iron', OakTankardParts>({
    id: 'oak-tankard',
    defaults: oakTankardDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const staves = Math.max(5, Math.round(config.staveCount))
      const thickness = config.radius * 0.13
      const bottomRadius = config.radius * (1 - config.taper)

      // --- Tahtalar ---------------------------------------------------------
      const stavePieces: BufferGeometry[] = []
      const step = (Math.PI * 2) / staves
      for (let i = 0; i < staves; i += 1) {
        // Tahtalar arasında ince bir pay: bitişik tahtalar yan yüzlerinden
        // aynı düzleme oturuyordu ve fıçıda bu titremeye yol açmıştı.
        const gap = step * 0.035
        const levels: Level[] = [
          { y: -half, radius: bottomRadius * (1 + jitter(random, 0.012)) },
          { y: -half + config.height * 0.5, radius: config.radius * (0.985 + jitter(random, 0.012)) },
          { y: half, radius: config.radius * (1 + jitter(random, 0.012)) },
        ]
        stavePieces.push(staveGeometry(
          levels, i * step + gap, (i + 1) * step - gap, thickness,
          tint('oak', jitter(random, 0.06)),
        ))
      }

      // --- Taban -------------------------------------------------------------
      // Tahtaların içine oturan disk; kenarı onların içinde kalıyor.
      const base = headGeometry(
        bottomRadius - thickness * 0.55, -half + config.height * 0.055,
        staves, 'up', tint('oakEnd', 0.02), 3, 0.06,
      )

      // --- Çemberler ----------------------------------------------------------
      const hoops = Math.max(0, Math.round(config.hoopCount))
      const hoopPieces: BufferGeometry[] = []
      for (let i = 0; i < hoops; i += 1) {
        const t = hoops === 1 ? 0.5 : 0.13 + (i / (hoops - 1)) * 0.74
        const y = -half + config.height * t
        const radius = bottomRadius + (config.radius - bottomRadius) * t
        hoopPieces.push(bandGeometry(
          radius + thickness * 0.42, y, config.height * 0.055,
          thickness * 0.32, staves, tint('iron', jitter(random, 0.05), 0.6),
        ))
      }

      // --- Kulp ----------------------------------------------------------------
      let handle: BufferGeometry | undefined
      if (config.handle >= 0.5) {
        const span = config.height * 0.72
        const strap = boxGeometry(
          [config.radius * 0.3, span, thickness * 1.1],
          [0, 0, 0],
          tint('oak', -0.05),
        )
        // Yassı şerit, gövdeden dışa doğru kavisleniyor. Kavis merkezi
        // orijinde olduğu için iki ucu da gövdeye yaklaşıyor — kulpun
        // gövdeye tutunduğu izlenimi tam olarak buradan geliyor.
        bendGeometry(strap, -2.05 / span)
        // Kaydırma miktarı hesapla bulunuyor, gözle değil: yay orta noktasını
        // yerinde bırakıp UÇLARINI geriye çekiyor, dolayısıyla kulbun ortası
        // gövdeden yeterince uzağa itilmezse uçlar değil ORTASI tahtanın
        // içinde kalıyor. İlk denemede kulp tamamen görünmezdi.
        //
        // Yarım açı a = (span/2)·k, uçların geri çekilmesi (1−cos a)/k.
        const drop = (1 - Math.cos(span * 0.5 * (2.05 / span))) / (2.05 / span)
        strap.translate(0, 0, config.radius + drop + thickness * 0.6)
        // İki uç gövdenin İÇİNE girsin diye küçük takozlar.
        const pegs = [1, -1].map((sign) => boxGeometry(
          [config.radius * 0.3, thickness * 1.6, config.radius * 0.55],
          [0, sign * span * 0.42, config.radius * 0.88],
          tint('oak', -0.1),
        ))
        handle = mergeColoured([strap, ...pegs])
      }

      return {
        staves: { slot: 'oak' as const, geometry: mergeColoured(stavePieces) },
        base: { slot: 'oak' as const, geometry: mergeColoured([base]) },
        hoops: hoopPieces.length > 0
          ? { slot: 'iron' as const, geometry: mergeColoured(hoopPieces) }
          : undefined,
        handle: handle ? { slot: 'oak' as const, geometry: handle } : undefined,
      }
    },
  }, overrides)
}
