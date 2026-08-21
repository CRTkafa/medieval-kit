/**
 * @medieval-kit/wooden-pitchfork
 *
 * Yabayı uzaktan ayırt ettiren şey dişlerin arasındaki boşluk. O yüzden diş
 * sayısı ve açıklığı siluetin tamamını belirliyor.
 *
 * İlk hâlimde dişler kare kesitli kutulardı ve hepsi birebir aynıydı. Gerçek
 * diş dövme ve yuvarlaktır, uca doğru sivrilir, ve hiçbiri komşusuyla tam aynı
 * açıda değildir. Üçü de burada düzeltildi.
 */
import { type BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  ironTint,
  steelTint,
  jitter,
  bendGeometry,
  latheGeometry,
  mergeColoured,
  toolShaft,
  toolSocket,
  type Level,
} from '../core/index.ts'

export interface WoodenPitchforkConfig {
  readonly length: number
  readonly shaftRadius: number
  /** Diş sayısı. */
  readonly tineCount: number
  /** Dişlerin dışa açılması (radyan). */
  readonly spread: number
  /** Diş uzunluğu, toplam boyun oranı olarak. */
  readonly tineLength: number
  readonly seed: number
}

export const woodenPitchforkDefaults: WoodenPitchforkConfig = {
  length: 1.5,
  shaftRadius: 0.021,
  tineCount: 3,
  spread: 0.2,
  tineLength: 0.24,
  seed: 37,
}

export type WoodenPitchforkParts = 'shaft' | 'socket' | 'tines'

export function createModel(overrides: Partial<WoodenPitchforkConfig> = {}) {
  return createKitModel<WoodenPitchforkConfig, 'oak' | 'iron' | 'steel', WoodenPitchforkParts>({
    id: 'wooden-pitchfork',
    defaults: woodenPitchforkDefaults,
    slots: ['oak', 'iron', 'steel'],
    build: ({ config, random }) => {
      const tineSpan = config.length * config.tineLength
      const shaftLength = config.length - tineSpan * 0.86
      const shaft = toolShaft({ length: shaftLength, radius: config.shaftRadius, random })

      const socketLength = config.length * 0.045
      const socket = toolSocket({
        y: shaft.top - socketLength * 0.3,
        shaftRadius: shaft.topRadius,
        length: socketLength,
        random,
      })

      const count = Math.max(2, config.tineCount)
      const base = shaft.top + config.length * 0.006
      const pieces: BufferGeometry[] = []

      // Enine dövme: dişleri sokete bağlayan yassı demir. Uçlara doğru inceliyor.
      const crossWidth = config.shaftRadius * 2.6 * count
      pieces.push(chamferedBoxGeometry(
        [crossWidth, config.shaftRadius * 2],
        [crossWidth * 0.94, config.shaftRadius * 1.3],
        config.length * 0.026,
        config.shaftRadius * 0.25,
        [0, base, 0],
        ironTint(random, -0.03),
      ))

      for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1
        // Diş KALIN olmalı. İlk hâlde yarıçap sapın yarısı kadardı, yani 1 cm;
        // model uzaktan üç saç teli gibi görünüyordu. Gerçek yaba dişi 2–3 cm
        // çapında dövme demirdir ve siluette sapın kendisi kadar yer kaplar.
        const radius = config.shaftRadius * 0.88
        const profile: Level[] = [
          { y: 0, radius: radius * 1.2 },
          { y: tineSpan * 0.2, radius },
          { y: tineSpan * 0.66, radius: radius * 0.78 },
          { y: tineSpan * 0.9, radius: radius * 0.42 },
          { y: tineSpan, radius: radius * 0.12 },  // sivri ama sıfır değil
        ]
        const tine = latheGeometry(profile, 6, [0, 0, 0], steelTint(random, -0.05), {
          capTop: false,
          colourTop: steelTint(random, 0.05),
        })
        // Kavis: düz bir diş teknik resim gibi duruyor. Gerçek yaba dişi öne
        // doğru kıvrıktır — kaldırdığı samanı düşürmesin diye.
        bendGeometry(tine, 0.42 / tineSpan + jitter(random, 0.06 / tineSpan))
        // Her diş komşusundan biraz farklı açıda: dövme bir yaba kusursuz
        // simetrik olmaz, ve bu tek detay onu "üretilmiş" olmaktan çıkarıyor.
        tine.rotateZ(-t * config.spread + jitter(random, 0.02))
        tine.rotateX(jitter(random, 0.025))
        tine.translate(t * config.shaftRadius * 2.5, base + config.length * 0.008, 0)
        pieces.push(tine)
      }

      return {
        shaft: { slot: 'oak', geometry: shaft.geometry },
        socket: { slot: 'iron', geometry: socket },
        tines: { slot: 'steel', geometry: mergeColoured(pieces) },
      }
    },
  }, overrides)
}
