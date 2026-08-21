/**
 * @medieval-kit/wicker-basket
 *
 * Söğüt çubuğundan örülmüş sepet, isteğe bağlı olarak meyveyle dolu.
 *
 * Kitin en çok "nasıl yapıldığını" taklit eden modeli, çünkü hasırda biçim ile
 * yapım aynı şey: sepet, dikey çubukların (stake) etrafından geçen yatay
 * çubukların (withy) BİR ÖNÜNDEN BİR ARKASINDAN dolanmasıdır. O dolanma
 * olmadan elde ettiğin şey üstüne çizgi çizilmiş bir kova oluyor.
 *
 * Örgü hilesi kısa: her yatay halka önce düz bir bant olarak üretiliyor, sonra
 * köşeleri AÇILARINA bağlı olarak içeri-dışarı itiliyor —
 *
 *     yarıçap × (1 + genlik · cos(dikeySayısı · açı + faz))
 *
 * Ardışık sıralarda faz π kadar kaydırılıyor, yani bir sıranın dışarı çıktığı
 * yerde bir sonraki içeri giriyor. Gerçek örgü tam olarak budur ve maliyeti
 * fazladan tek bir üçgen değil.
 *
 * Meyveler ayrı bir yuvada ve renkleri `hue` alanından geliyor: aynı modelden
 * elma, şalgam ya da lahana sepeti çıkabiliyor. Domates ARAMAYIN — Amerika'dan
 * gelme ve Avrupa mutfağına 16. yüzyıldan önce girmiyor.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
  createKitModel,
  createTinter,
  flipGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  type Level,
} from '../core/index.ts'

export interface WickerBasketConfig {
  /** Sepet yüksekliği, kulp hariç (metre). */
  readonly height: number
  /** Ağız yarıçapı (metre). */
  readonly radius: number
  /** Tabana doğru daralma. 0 = silindir. */
  readonly taper: number
  /** Dikey çubuk sayısı. Örgünün "dalga sayısı" da bu. */
  readonly stakes: number
  /** Yatay örgü sırası. */
  readonly rows: number
  /** İçindeki meyve sayısı. 0 = boş sepet. */
  readonly produce: number
  /** Meyve rengi, renk çemberi üzerinde 0–1. */
  readonly hue: number
  readonly seed: number
}

export const wickerBasketDefaults: WickerBasketConfig = {
  height: 0.21,
  radius: 0.17,
  taper: 0.26,
  stakes: 11,
  rows: 6,
  produce: 9,
  hue: 0.02,
  seed: 97,
}

export type WickerBasketParts = 'weave' | 'rim' | 'contents'

export function createModel(overrides: Partial<WickerBasketConfig> = {}) {
  return createKitModel<WickerBasketConfig, 'straw' | 'produce', WickerBasketParts>({
    id: 'wicker-basket',
    defaults: wickerBasketDefaults,
    slots: ['straw', 'produce'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const stakes = Math.max(5, Math.round(config.stakes))
      const rows = Math.max(1, Math.round(config.rows))
      const bottomRadius = config.radius * (1 - config.taper)
      const withy = config.height * 0.05          // çubuk kalınlığı
      const amplitude = 0.055                     // örgünün içeri-dışarı payı

      const radiusAt = (t: number): number => bottomRadius + (config.radius - bottomRadius) * t

      /**
       * Bandı örgüye çeviren dönüşüm: her köşe, KENDİ açısına bağlı olarak
       * merkeze yaklaşıp uzaklaşıyor. Y'ye dokunulmuyor, dolayısıyla halka
       * düzlemde kalıyor ve komşu sıralarla çakışmıyor.
       */
      const undulate = (geometry: BufferGeometry, phase: number): BufferGeometry => {
        const position = geometry.getAttribute('position')
        for (let i = 0; i < position.count; i += 1) {
          const x = position.getX(i)
          const z = position.getZ(i)
          const distance = Math.hypot(x, z)
          if (distance < 1e-6) continue
          const scale = 1 + amplitude * Math.cos(stakes * Math.atan2(x, z) + phase)
          position.setX(i, x * scale)
          position.setZ(i, z * scale)
        }
        position.needsUpdate = true
        geometry.computeVertexNormals()
        return geometry
      }

      // --- Dikey çubuklar ------------------------------------------------------
      // Örgünün İÇİNDEN geçiyorlar: yatay halkalar onların bir önünden bir
      // arkasından dolandığı için burada gizlenip orada görünüyorlar.
      const pieces: BufferGeometry[] = []
      for (let i = 0; i < stakes; i += 1) {
        const angle = (i / stakes) * Math.PI * 2
        const stake = prismGeometry(
          withy * 0.42, withy * 0.36, config.height * 1.02, 4,
          [0, 0, 0], tint('straw', -0.09, 1.2),
        )
        // Önce eğ, sonra taşı: daralan bir sepette dikmeler de yatık.
        stake.rotateX(Math.atan2(config.radius - bottomRadius, config.height))
        stake.rotateY(angle)
        const mid = (bottomRadius + config.radius) / 2
        stake.translate(Math.sin(angle) * mid, 0, Math.cos(angle) * mid)
        pieces.push(stake)
      }

      // --- Yatay örgü ----------------------------------------------------------
      // Dikey çubuk başına İKİ segment: `cos(stakes·θ)` tam olarak her çubukta
      // bir kez artı, bir kez eksi örnekleniyor, yani dalga en az üçgenle tam
      // çözülüyor. Dört segment daha yumuşak bir dalga veriyordu ama halka
      // başına üçgeni ikiye katlıyor ve sepet lowpoly bütçesini aşıyordu.
      //
      // Halkaların İÇ YÜZÜ üretilmiyor. Onun yerine tek parça bir iç astar var
      // (aşağıda): altı halkanın altı ayrı iç yüzeyi ~800 üçgen tutuyordu,
      // astar 44 tutuyor ve içeriden bakınca aradaki fark görünmüyor.
      for (let r = 0; r < rows; r += 1) {
        const t = (r + 0.5) / rows
        const y = -half + config.height * t
        const ring = bandGeometry(
          radiusAt(t), y, config.height * 0.11, withy * 0.8, stakes * 2,
          tint('straw', jitter(random, 0.07), 1.2),
        )
        // Faz her sırada yarım dalga kayıyor: bir sıranın dışarı çıktığı yerde
        // bir sonrakinin içeri girmesi, örgüyü örgü yapan şey.
        pieces.push(undulate(ring, r % 2 === 0 ? 0 : Math.PI))
      }

      // İç astar: örgünün arkasını kapatan tek yüzey. Normalleri eksene baksın
      // diye ters sarımlı.
      pieces.push(flipGeometry(latheGeometry([
        { y: -half + config.height * 0.03, radius: bottomRadius * (1 - amplitude) },
        { y: half - config.height * 0.02, radius: config.radius * (1 - amplitude) },
      ], stakes * 2, [0, 0, 0], tint('straw', -0.2, 1.1), {
        capTop: false,
        capBottom: false,
      })))

      // --- Taban ---------------------------------------------------------------
      pieces.push(latheGeometry([
        { y: -half - config.height * 0.01, radius: bottomRadius * 0.94 },
        { y: -half + config.height * 0.05, radius: bottomRadius * 0.99 },
      ], stakes * 2, [0, 0, 0], tint('straw', -0.14, 1.2), { capTop: true }))

      // --- Kenar ---------------------------------------------------------------
      // Örgüyü bitiren kalın bükme. Sepetin en görünür detayı ve olmadığı
      // zaman kenar "kesilmiş" duruyor.
      const rim = mergeColoured([
        bandGeometry(config.radius * 1.015, half - config.height * 0.03,
          config.height * 0.1, withy * 1.5, stakes * 2,
          tint('straw', 0.07, 1.2), { inner: true }),
      ])

      // --- İçindekiler ----------------------------------------------------------
      const count = Math.max(0, Math.round(config.produce))
      const contents: BufferGeometry[] = []
      const hue = ((config.hue % 1) + 1) % 1
      for (let i = 0; i < count; i += 1) {
        const size = config.radius * (0.2 + random() * 0.07)
        // Elma profili: üstte ve altta çukur, ortada geniş.
        const fruit = latheGeometry([
          { y: -size * 0.86, radius: size * 0.3 },
          { y: -size * 0.6, radius: size * 0.78 },
          { y: 0, radius: size },
          { y: size * 0.58, radius: size * 0.82 },
          { y: size * 0.84, radius: size * 0.34 },
        ] as Level[], 7, [0, 0, 0], new Color().setHSL(
          (hue + jitter(random, 0.03) + 1) % 1,
          0.52 + random() * 0.2,
          0.3 + random() * 0.12,
        ))

        // Yerleşim: altın oran açısı + kökle artan uzaklık. Meyveler ağzın
        // hizasında bir kubbe oluşturuyor, çünkü dolu bir sepet düz bitmez.
        const angle = i * 2.399963
        const ring = Math.sqrt((i + 0.4) / count)
        const spread = config.radius * 0.62 * ring
        fruit.rotateX(jitter(random, 0.6))
        fruit.rotateZ(jitter(random, 0.6))
        fruit.translate(
          Math.sin(angle) * spread,
          half - size * (0.15 + ring * 0.75) + jitter(random, size * 0.1),
          Math.cos(angle) * spread,
        )
        contents.push(fruit)
      }

      return {
        weave: { slot: 'straw' as const, geometry: mergeColoured(pieces) },
        rim: { slot: 'straw' as const, geometry: rim },
        contents: contents.length > 0
          ? { slot: 'produce' as const, geometry: mergeColoured(contents) }
          : undefined,
      }
    },
  }, overrides)
}
