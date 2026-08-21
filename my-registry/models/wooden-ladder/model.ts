/**
 * @medieval-kit/wooden-ladder
 *
 * İki dikme, aralarında basamaklar. Kitin en ucuz modeli ve sahne değeri en
 * yüksek olanlardan biri: bir sahneye dikey hareket önerir.
 *
 * Basamaklar dikmelerin İÇİNE giriyor (geçme), yani hiçbir yüzey dikmelerin
 * yüzeyiyle aynı düzleme oturmuyor.
 */
import { Color } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
} from '../core/index.ts'

export interface WoodenLadderConfig {
  readonly height: number
  /** Dikmeler arası mesafe (metre). */
  readonly width: number
  readonly rungCount: number
  /** Dikmelerin üste doğru incelmesi. 0 = paralel. */
  readonly taper: number
  readonly seed: number
}

export const woodenLadderDefaults: WoodenLadderConfig = {
  height: 2.2,
  width: 0.42,
  rungCount: 8,
  taper: 0.18,
  seed: 4,
}

export type WoodenLadderParts = 'rails' | 'rungs'

export function createModel(overrides: Partial<WoodenLadderConfig> = {}) {
  return createKitModel<WoodenLadderConfig, 'oak', WoodenLadderParts>({
    id: 'wooden-ladder',
    defaults: woodenLadderDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const shade = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.055))
        return tint
      }

      const railThickness = config.width * 0.1
      const half = config.width / 2

      // Dikmeler üste doğru birbirine yaklaşır; bu tek detay merdiveni
      // "iki tahta" olmaktan çıkarıp merdiven yapıyor.
      const lean = half * config.taper
      const rails = [-1, 1].map((side) => {
        const rail = chamferedBoxGeometry(
        [railThickness, railThickness * 1.35],
        [railThickness * 0.85, railThickness * 1.15],
        config.height,
        railThickness * 0.16,
        [0, 0, 0],
        shade(),
      )
        // Z ekseni etrafında hafif eğ: alt uç dışta, üst uç içte.
        rail.rotateZ((side * -lean) / config.height)
        rail.translate(side * half, 0, 0)
        return rail
      })

      const rungs = []
      const count = Math.max(2, config.rungCount)
      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.5) / count
        const y = -config.height / 2 + t * config.height
        // Basamak, o yükseklikteki dikme aralığından biraz UZUN: uçları
        // dikmelerin içinde kalsın.
        const span = (half - lean * t) * 2 + railThickness * 0.9
        rungs.push(chamferedBoxGeometry(
        [span, railThickness * 1.05],
        [span, railThickness * 1.05],
        railThickness * 0.8,
        railThickness * 0.16,
        [0, y, 0],
        shade(0.03),
      ))
      }

      return {
        rails: { slot: 'oak', geometry: mergeColoured(rails) },
        rungs: { slot: 'oak', geometry: mergeColoured(rungs) },
      }
    },
  }, overrides)
}
