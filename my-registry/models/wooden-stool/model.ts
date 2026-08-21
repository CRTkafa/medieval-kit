/**
 * @medieval-kit/wooden-stool
 *
 * Üç ayaklı tabure. Üç ayak tesadüf değil: düzgün olmayan zeminde üç ayak her
 * zaman basar, dördüncüsü sallanır — köy mobilyası bu yüzden üç ayaklıdır.
 *
 * Sahnede işlevi: "burada biri oturuyor" demek. Tek başına bir prop değil,
 * insan varlığının işareti.
 */
import { Color } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  prismGeometry,
} from '../core/index.ts'

export interface WoodenStoolConfig {
  readonly height: number
  /** Oturak yarıçapı (metre). */
  readonly seatRadius: number
  readonly legCount: number
  /** Ayakların dışa açıklığı. 0 = dik. */
  readonly splay: number
  readonly seed: number
}

export const woodenStoolDefaults: WoodenStoolConfig = {
  height: 0.46,
  seatRadius: 0.17,
  legCount: 3,
  splay: 0.22,
  seed: 17,
}

export type WoodenStoolParts = 'seat' | 'legs'

export function createModel(overrides: Partial<WoodenStoolConfig> = {}) {
  return createKitModel<WoodenStoolConfig, 'oak', WoodenStoolParts>({
    id: 'wooden-stool',
    defaults: woodenStoolDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const half = config.height / 2
      const seatThickness = config.seatRadius * 0.22

      // Oturak: kalın bir ahşap disk — yani kısa bir silindir. Kenarı aşağı
      // doğru hafif daralıyor, bu da kütükten yontulmuş izlenimi veriyor.
      tint.copy(MEDIEVAL_PALETTE.oakEnd)
      tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), jitter(random, 0.04))
      const seatTop = half
      const seat = prismGeometry(
        config.seatRadius * 0.94,
        config.seatRadius,
        seatThickness,
        12,
        [0, seatTop - seatThickness / 2, 0],
        tint,
      )

      const legs = []
      const count = Math.max(3, config.legCount)
      const legLength = config.height - seatThickness
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + jitter(random, 0.06)
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), jitter(random, 0.06))
        const thick = config.seatRadius * 0.2

        // Ayak: origin'in altına sarkan, aşağı doğru incelen bir çubuk.
        // Sıra kritik: önce eğ, sonra YARIÇAPA TAŞI, sonra döndür. Yarıçapa
        // taşıma adımı olmadan splay=0 iken üç ayak da eksende üst üste biner.
        const leg = chamferedBoxGeometry(
        [thick * 0.72, thick * 0.72],
        [thick, thick],
        legLength,
        thick * 0.16,
        [0, -legLength / 2, 0],
        tint,
      )
        leg.rotateZ(config.splay)
        leg.translate(config.seatRadius * 0.6, 0, 0)
        leg.rotateY(angle)
        // Oturak diskinin İÇİNE gir: üst uç görünmez ve hiçbir düzlemle hizalanmaz.
        leg.translate(0, seatTop - seatThickness * 0.35, 0)
        legs.push(leg)
      }

      return {
        seat: { slot: 'oak', geometry: seat },
        legs: { slot: 'oak', geometry: mergeColoured(legs) },
      }
    },
  }, overrides)
}
