/**
 * @medieval-kit/hay-bale
 *
 * Bağlanmış saman demeti.
 *
 * Bir uyarı yerinde: bugün "balya" denince akla gelen dikdörtgen prizma
 * makinenin işidir ve 19. yüzyıla aittir. Ortaçağda saman ya gevşek yığılır ya
 * da elle bağlanıp demet yapılırdı. Bu model ikincisi.
 *
 * İKİNCİ deneme. İlki dilim dilim kutulardan kuruluydu ve render'a bakınca
 * kararı verdiren şey netti: SOLGUN BİR TAHTA SANDIK gibi duruyordu. İki ayrı
 * hata vardı ve ikisi de biçimle ilgiliydi, renkle değil:
 *
 *   - Kesit dikdörtgendi. Keskin köşe + düz yüz = marangoz işi. Bağlanmış bir
 *     demetin kesiti yuvarlaktır, çünkü ipi çeken şey onu yuvarlatır.
 *   - Yüzeyler kusursuz düzdü. Saman hiçbir yerde düz değildir.
 *
 * Bu yüzden gövde artık bir dönel gövde — ipin sıktığı yerde daralan, sonra
 * `roughenGeometry` ile bozulan bir silindir. O iki değişiklik renk hiç
 * değişmeden modeli tanınır hâle getirdi.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface HayBaleConfig {
  /** Uzunluk (metre). */
  readonly length: number
  /** Yükseklik (metre). */
  readonly height: number
  /** Derinlik (metre). */
  readonly depth: number
  /** Kaç ip bağı. */
  readonly ropeCount: number
  /** Yüzeyden fırlayan gevşek sap sayısı. */
  readonly wisps: number
  /** Yüzey düzensizliği. 0 = pürüzsüz gövde. */
  readonly rough: number
  readonly seed: number
}

export const hayBaleDefaults: HayBaleConfig = {
  length: 0.88,
  height: 0.42,
  depth: 0.46,
  ropeCount: 2,
  wisps: 34,
  rough: 1,
  seed: 47,
}

export type HayBaleParts = 'bale' | 'wisps' | 'ropes'

export function createModel(overrides: Partial<HayBaleConfig> = {}) {
  return createKitModel<HayBaleConfig, 'straw' | 'cloth', HayBaleParts>({
    id: 'hay-bale',
    defaults: hayBaleDefaults,
    slots: ['straw', 'cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const ropes = Math.max(0, Math.round(config.ropeCount))
      const halfLength = config.length / 2

      // Gövde önce YARIÇAP 1 olan bir dönel gövde olarak kuruluyor, sonra
      // gerçek en/boy oranına ezileceği için. Böylece ipin daralttığı miktar
      // tek bir sayı — iki eksende ayrı ayrı hesaplamak gerekmiyor.
      const ropeXs = Array.from({ length: ropes }, (_, i) =>
        ropes === 1 ? 0 : (i / (ropes - 1) - 0.5) * config.length * 0.54)
      const cinch = (x: number): number => {
        let tightest = 1
        for (const rx of ropeXs) {
          const distance = Math.abs(x - rx) / (config.length * 0.19)
          if (distance < 1) tightest = Math.min(tightest, 1 - 0.13 * (1 - distance * distance))
        }
        return tightest
      }

      // --- Gövde ---------------------------------------------------------
      const rings = 11
      const levels: Level[] = Array.from({ length: rings }, (_, i) => {
        const t = i / (rings - 1)
        const x = -halfLength + config.length * t
        // Uçlar yuvarlanıyor: ilk ve son halka belirgin şekilde dar, yoksa
        // demet iki ucundan kesilmiş bir boru gibi duruyor.
        const endFade = 1 - Math.pow(Math.abs(t - 0.5) * 2, 6) * 0.34
        return { y: x, radius: 0.5 * cinch(x) * endFade * (1 + jitter(random, 0.05)) }
      })

      const body = latheGeometry(levels, 7, [0, 0, 0], tint('straw', -0.06, 1.6), {
        colourTop: tint('strawPale', 0.02, 1.6),
      })
      // Dikey kurulup yatırılıyor: dönel gövde yardımcısı Y ekseni etrafında
      // çalışıyor, demet ise X boyunca uzanıyor.
      body.rotateZ(Math.PI / 2)
      body.scale(1, config.height, config.depth)
      roughenGeometry(body, config.height * 0.045 * config.rough, { salt: 11 })

      // --- Fırlayan saplar ------------------------------------------------
      // Yüzeydeki gevşek saplar ve iki uçtan püsküren damar uçları. İkincisi
      // önemli: bağlanmış bir demette sapların KESİLMİŞ uçları hep iki uçtadır
      // ve demeti "kesilmiş bitki" olarak okutan tek işaret odur.
      const wispPieces: BufferGeometry[] = []
      const wispCount = Math.max(0, Math.round(config.wisps))
      const thickness = config.height * 0.016

      for (let i = 0; i < wispCount; i += 1) {
        const fromEnd = i % 3 === 0
        const length = config.height * (fromEnd ? 0.2 + random() * 0.24 : 0.13 + random() * 0.17)
        const wisp = boxGeometry(
          [length, thickness * (0.6 + random() * 0.9), thickness],
          [length * 0.3, 0, 0],   // kökü orijinin gerisinde: gövdeye gömülü
          tint('strawPale', 0.05, 1.4),
        )

        if (fromEnd) {
          // Uç sapları: X ekseni boyunca dışarı, hafif saçılarak.
          const side = i % 6 === 0 ? 1 : -1
          const angle = random() * Math.PI * 2
          const radius = 0.5 * (0.15 + random() * 0.8)
          wisp.rotateZ(jitter(random, 0.4))
          wisp.rotateX(jitter(random, 0.4))
          if (side < 0) wisp.rotateY(Math.PI)
          wisp.translate(
            side * halfLength * (0.86 + random() * 0.1),
            Math.sin(angle) * radius * config.height,
            Math.cos(angle) * radius * config.depth,
          )
        } else {
          // Yüzey sapları: gövdenin yan yüzeyinden dışarı.
          const x = (random() - 0.5) * config.length * 0.88
          const angle = random() * Math.PI * 2
          const shrink = cinch(x)
          wisp.rotateZ(jitter(random, 0.9))
          wisp.rotateY(angle + Math.PI / 2)
          wisp.translate(
            x,
            Math.sin(angle) * 0.47 * config.height * shrink,
            Math.cos(angle) * 0.47 * config.depth * shrink,
          )
        }
        wispPieces.push(wisp)
      }

      // --- İpler ----------------------------------------------------------
      // Gövde yuvarlak olduğu için ip artık dört çubuktan değil gerçek bir
      // HALKADAN kuruluyor. Aynı ezme dönüşümünden geçiyor, dolayısıyla
      // demetin kesitine tam oturuyor.
      const ropePieces: BufferGeometry[] = []
      const cord = config.height * 0.03
      for (const x of ropeXs) {
        // Serbest duran halka: iç yüzü de gerekli, yoksa kapalı katı olmuyor.
        const ring = bandGeometry(0.5 * cinch(x) + cord * 0.35, 0, cord * 1.5, cord, 7,
          tint('cloth', -0.07), { inner: true })
        ring.rotateZ(Math.PI / 2)
        ring.scale(1, config.height, config.depth)
        ring.translate(x, 0, 0)
        ropePieces.push(ring)
      }

      return {
        bale: { slot: 'straw' as const, geometry: mergeColoured([body]) },
        wisps: wispPieces.length > 0
          ? { slot: 'straw' as const, geometry: mergeColoured(wispPieces) }
          : undefined,
        ropes: ropePieces.length > 0
          ? { slot: 'cloth' as const, geometry: mergeColoured(ropePieces) }
          : undefined,
      }
    },
  }, overrides)
}
