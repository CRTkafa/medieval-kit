/**
 * @medieval-kit/wooden-fence
 *
 * Modüler çit bölümü. Kitin tek "tekrarlanabilir" parçası: `sections` alanını
 * artırarak uzatılır, ya da tek bölüm alıp sahnede kopyalanır.
 *
 * Direkler yatay kirişlerden dışa taşıyor; kirişlerin uçları direklerin içinde
 * kalıyor. İkisi de z-fighting'i yapı gereği imkânsız kılıyor.
 */
import { Color } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
} from '../core/index.ts'

export interface WoodenFenceConfig {
  /** Bölüm sayısı. Her bölüm iki direk arası. */
  readonly sections: number
  /** Bir bölümün uzunluğu (metre). */
  readonly sectionLength: number
  readonly height: number
  /** Yatay kiriş sayısı. */
  readonly railCount: number
  readonly seed: number
}

export const woodenFenceDefaults: WoodenFenceConfig = {
  sections: 3,
  sectionLength: 1.6,
  height: 1.1,
  railCount: 2,
  seed: 12,
}

export type WoodenFenceParts = 'posts' | 'rails'

export function createModel(overrides: Partial<WoodenFenceConfig> = {}) {
  return createKitModel<WoodenFenceConfig, 'oak', WoodenFenceParts>({
    id: 'wooden-fence',
    defaults: woodenFenceDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const shade = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.06))
        return tint
      }

      const sections = Math.max(1, config.sections)
      const post = config.height * 0.085
      const total = sections * config.sectionLength
      const half = config.height / 2

      const posts = []
      for (let i = 0; i <= sections; i += 1) {
        const x = -total / 2 + i * config.sectionLength
        // Her direk kendi boyunda: sıra hâlinde dizildiğinde tekdüze durmasın.
        const lift = jitter(random, config.height * 0.035)
        posts.push(chamferedBoxGeometry(
        [post, post],
        [post * 0.78, post * 0.78],
        config.height + lift,
        post * 0.13,
        [x, lift / 2, 0],
        shade(-0.03),
      ))
      }

      const rails = []
      const count = Math.max(1, config.railCount)
      for (let r = 0; r < count; r += 1) {
        const t = count === 1 ? 0.55 : 0.28 + (0.5 * r) / (count - 1)
        const y = -half + t * config.height
        for (let i = 0; i < sections; i += 1) {
          const x = -total / 2 + (i + 0.5) * config.sectionLength
          // Kirişin uçları komşu direklerin ORTASINA kadar uzanır.
          rails.push(chamferedBoxGeometry(
        [config.sectionLength + post * 0.6, post * 0.5],
        [config.sectionLength + post * 0.6, post * 0.5],
        post * 0.62,
        post * 0.13,
        [x, y + jitter(random, config.height * 0.012), 0],
        shade(0.02),
      ))
        }
      }

      return {
        posts: { slot: 'oak', geometry: mergeColoured(posts) },
        rails: { slot: 'oak', geometry: mergeColoured(rails) },
      }
    },
  }, overrides)
}
