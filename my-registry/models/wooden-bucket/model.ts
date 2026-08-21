/**
 * @medieval-kit/wooden-bucket
 *
 * Kova aslında küçük bir fıçıdır: daralan tahtalar, demir çember, tabanı içeri
 * gömülü. Fıçıyla aynı `staveGeometry`'yi kullanması tesadüf değil — yan yana
 * konduklarında aynı katalogdan geldikleri bir bakışta okunsun diye.
 *
 * Fıçıdan farkı: konik (fıçı gibi göbekli değil), üstü açık, ve demir bir kulbu
 * var.
 */
import { Color, type BufferGeometry } from 'three'

import {
  MEDIEVAL_PALETTE,
  arcBarGeometry,
  bandGeometry,
  createKitModel,
  headGeometry,
  jitter,
  mergeColoured,
  staveGeometry,
  type Level,
} from '../core/index.ts'

export interface WoodenBucketConfig {
  /** Yükseklik (metre). */
  readonly height: number
  /** Ağız yarıçapı. Taban her zaman daha dar. */
  readonly radius: number
  /** Tabanın ağza göre daralması. 0.25 = taban %75 genişlikte. */
  readonly taper: number
  /** Tahta sayısı. */
  readonly staveCount: number
  /** Demir çember sayısı. */
  readonly hoopCount: number
  /** Kulp var mı (1) yok mu (0). */
  readonly handle: number
  readonly seed: number
}

export const woodenBucketDefaults: WoodenBucketConfig = {
  height: 0.32,
  radius: 0.15,
  taper: 0.26,
  staveCount: 11,
  hoopCount: 2,
  handle: 1,
  seed: 5,
}

export type WoodenBucketParts = 'staves' | 'base' | 'hoops' | 'handle'

/** t ∈ [0,1], 0 = taban, 1 = ağız. */
function profileAt(t: number, taper: number): number {
  return 1 - taper * (1 - t)
}

export function createModel(overrides: Partial<WoodenBucketConfig> = {}) {
  return createKitModel<WoodenBucketConfig, 'oak' | 'iron', WoodenBucketParts>({
    id: 'wooden-bucket',
    defaults: woodenBucketDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      const half = config.height / 2
      const wall = config.radius * 0.11
      const tint = new Color()

      // --- duvar tahtaları ---
      const step = (Math.PI * 2) / config.staveCount
      // Tahtalar arasında BOŞLUK YOK. Fıçıda görünür bir dikiş hoş duruyordu
      // ama kova su taşır: 11 tahta arasındaki 4 mm'lik yarıklar kovayı süzgece
      // çeviriyordu. Dikiş okunuşu artık tahta başına yarıçap sapmasından
      // geliyor — komşusundan biraz farklı çıkan her tahta kendi gölgesini
      // düşürüyor, ama delik bırakmıyor.
      const gap = 0
      const levels = [0, 0.5, 1]
      const staves: BufferGeometry[] = []

      for (let i = 0; i < config.staveCount; i += 1) {
        const bias = 1 + jitter(random, 0.006)
        const rimBias = jitter(random, 0.004)
        const shaped: Level[] = levels.map((t, index) => ({
          y: -half + t * config.height + (index === levels.length - 1 ? rimBias : 0),
          radius: config.radius * profileAt(t, config.taper) * bias,
        }))
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.014), jitter(random, 0.05), jitter(random, 0.06))
        staves.push(staveGeometry(shaped, i * step + gap / 2, (i + 1) * step - gap / 2, wall, tint))
      }

      // --- taban: gövdenin içine oturur ---
      const baseRadius = config.radius * profileAt(0, config.taper) - wall * 0.85
      tint.copy(MEDIEVAL_PALETTE.oakEnd)
      tint.offsetHSL(0, jitter(random, 0.03), jitter(random, 0.04))
      const base = headGeometry(baseRadius, -half + config.height * 0.07, config.staveCount, 'up', tint, 3, 0.05)

      // --- demir çemberler ---
      const hoops: BufferGeometry[] = []
      for (let i = 0; i < config.hoopCount; i += 1) {
        // Üstten ve alttan içe doğru; tek çember varsa ortada.
        const t = config.hoopCount === 1 ? 0.5 : 0.14 + (0.72 * i) / (config.hoopCount - 1)
        tint.copy(MEDIEVAL_PALETTE.iron)
        tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.05))
        hoops.push(bandGeometry(
          config.radius * profileAt(t, config.taper) + config.radius * 0.02,
          -half + t * config.height,
          config.height * 0.055,
          config.radius * 0.05,
          config.staveCount,
          tint,
        ))
      }

      // --- kulp (bail): ağzın hemen üstünde yarım yay ---
      let handle: BufferGeometry | undefined
      if (config.handle >= 0.5) {
        tint.copy(MEDIEVAL_PALETTE.iron)
        tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.04))
        const span = config.radius * profileAt(1, config.taper) + config.radius * 0.02
        // Yay XY düzleminde üretiliyor; kova ekseni Y olduğu için olduğu gibi
        // duruyor, sadece ağız hizasına kaydırılıyor.
        handle = arcBarGeometry(span, config.radius * 0.055, 0, Math.PI, 9, [0, half * 0.92, 0], tint)
      }

      return {
        staves: { slot: 'oak', geometry: mergeColoured(staves) },
        base: { slot: 'oak', geometry: base },
        hoops: hoops.length ? { slot: 'iron', geometry: mergeColoured(hoops) } : undefined,
        handle: handle ? { slot: 'iron', geometry: handle } : undefined,
      }
    },
  }, overrides)
}
