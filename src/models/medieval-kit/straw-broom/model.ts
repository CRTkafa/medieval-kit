/**
 * @medieval-kit/straw-broom
 *
 * Süpürge: bir sopa, bir demet süpürge otu, iki tur ip. Dönemin süpürgesi
 * gerçekten bu kadar basitti ve tam da bu yüzden her iç mekân sahnesinde
 * bulunuyordu.
 *
 * Modelin bütün işi ALT UÇTA. Sap zaten kitin bildiği bir şey; asıl mesele
 * demeti demet gibi göstermek. Üç kural çıktı:
 *
 *   - Teller AYNI noktadan çıkmalı, aşağıda yelpaze gibi açılmalı. Paralel
 *     teller fırça olur, süpürge olmaz.
 *   - Uçları AYNI hizada bitmemeli. Eşit boy her zaman fabrikasyon okunuyor.
 *   - Bağ demeti gerçekten SIKMALI, yani tellerin bağ hizasındaki dağılımı
 *     bağın yarıçapıyla sınırlı olmalı. Üstüne çizilmiş bir ip işe yaramıyor.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  taperedBoxGeometry,
  type Level,
} from '../core/index.ts'

export interface StrawBroomConfig {
  /** Toplam boy (metre). */
  readonly length: number
  /** Sap yarıçapı (metre). */
  readonly shaftRadius: number
  /** Demetin boyu, toplam boyun oranı olarak. */
  readonly headLength: number
  /** Demetin alt uçta açılma miktarı. */
  readonly flare: number
  /** Tel sayısı. */
  readonly bristles: number
  /** Kaç tur bağ. */
  readonly bindings: number
  readonly seed: number
}

export const strawBroomDefaults: StrawBroomConfig = {
  length: 1.24,
  shaftRadius: 0.017,
  headLength: 0.4,
  flare: 0.34,
  bristles: 52,
  bindings: 2,
  seed: 59,
}

export type StrawBroomParts = 'shaft' | 'bristles' | 'bindings'

export function createModel(overrides: Partial<StrawBroomConfig> = {}) {
  return createKitModel<StrawBroomConfig, 'oak' | 'straw' | 'cloth', StrawBroomParts>({
    id: 'straw-broom',
    defaults: strawBroomDefaults,
    slots: ['oak', 'straw', 'cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.length / 2
      const headLength = config.length * config.headLength
      // Demetin tepesi: teller buradan çıkıp aşağı iniyor.
      const headTop = -half + headLength

      // --- Sap -------------------------------------------------------------
      // Demetin İÇİNE giriyor: gerçek süpürgede sopa demetin ortasına saplanır
      // ve ucu tellerin arasında kaybolur.
      const shaftProfile: Level[] = [
        { y: -half + headLength * 0.35, radius: config.shaftRadius * 0.86 },
        { y: headTop, radius: config.shaftRadius },
        { y: half - config.length * 0.06, radius: config.shaftRadius * 1.02 },
        { y: half, radius: config.shaftRadius * 0.78 },
      ]
      const shaft = mergeColoured([latheGeometry(shaftProfile, 6, [0, 0, 0],
        tint('oak', -0.04), { colourTop: tint('oak', 0.04) })])

      // --- Teller -----------------------------------------------------------
      const count = Math.max(3, Math.round(config.bristles))
      const bristles: BufferGeometry[] = []
      const gather = config.shaftRadius * 2.6   // bağ hizasındaki yarıçap

      // Demet İKİ ÖLÇEKTE kuruluyor ve bunun bir sebebi var: tek tek tel
      // dizmek işe yaramadı. Elli iki ayrı çubuk bile bir koni yüzeyine
      // dağılınca aralarındaki boşluk kapanmıyor, sonuç süpürge değil ÇIRPICI
      // oluyordu. Yüzlerce tel dizmek ise lowpoly bütçesini yiyor.
      //
      // Çözüm gerçek süpürgenin kendi yapısı: süpürge otu tek tek değil KÜÇÜK
      // DEMETLER hâlinde bağlanır. Yassı bir levha bir demeti temsil ediyor,
      // ince çubuklar da o demetlerden fırlayan tek telleri. Kütle levhalardan,
      // dağınıklık çubuklardan geliyor.
      const sheaves = Math.max(5, Math.round(count * 0.28))
      const stalks = Math.max(0, count - sheaves)

      for (let i = 0; i < sheaves; i += 1) {
        const angle = (i / sheaves) * Math.PI * 2 + jitter(random, 0.12)
        const length = headLength * (0.9 + random() * 0.2)
        const width = config.shaftRadius * (1.5 + random() * 0.5)
        const depth = config.shaftRadius * (0.4 + random() * 0.2)

        // Levha aşağı doğru YAYILIYOR: üstte dar (bağın içinde), altta geniş.
        const sheaf = taperedBoxGeometry(
          [width * 1.5, depth * 0.85],
          [width * 0.45, depth],
          length,
          [0, -length / 2, 0],   // üst ucu ORİJİNDE: demet oradan asılıyor
          // Renk sırası TERS gibi görünüyor ama doğru olan bu: aşağıdaki uç
          // sapın KESİLDİĞİ yer, yani en açık nokta. Koyu uçlu ilk hâlde
          // süpürge zifte batırılmış gibi duruyordu.
          tint('strawPale', 0.07, 1.5),
          tint('straw', -0.08, 1.5),
        )
        // Açılma: dönüş orijin etrafında olduğu için üst uç yerinde kalıyor.
        // Demetin tepeden toplanıp aşağı yayılmasının tamamı bu tek dönüşten.
        // Küçük bir yan eğiklik: `flare` sıfırken bütün levhalar birbirine
        // TAM PARALEL kalıyor ve komşu yüzleri aynı düzleme oturup titriyordu.
        // Doğal olan da bu — elle bağlanmış bir demette hiçbir tel diğerine
        // paralel değildir.
        sheaf.rotateZ(jitter(random, 0.09))
        sheaf.rotateX(config.flare * (0.85 + random() * 0.3) + jitter(random, 0.035))
        sheaf.rotateY(angle)
        sheaf.translate(
          Math.sin(angle) * gather * 0.4,
          headTop + jitter(random, headLength * 0.02),
          Math.cos(angle) * gather * 0.4,
        )
        bristles.push(sheaf)
      }

      for (let i = 0; i < stalks; i += 1) {
        // Altın oran açısı: ardışık teller birbirinin üstüne düşmüyor ve
        // hiçbir yerde sıra oluşmuyor. Eşit aralık verseydim demet dilimli
        // bir yelpaze gibi görünürdü.
        const angle = i * 2.399963
        const ring = 0.5 + Math.sqrt((i + 0.5) / stalks) * 0.5
        const length = headLength * (0.82 + random() * 0.3)
        const thickness = config.shaftRadius * (0.16 + random() * 0.14)

        const bristle = taperedBoxGeometry(
          [thickness * 1.3, thickness * 1.3],
          [thickness * 0.7, thickness * 0.7],
          length,
          [0, -length / 2, 0],
          tint('strawPale', 0.1, 1.5),
          tint('straw', -0.02, 1.5),
        )
        bristle.rotateX(config.flare * ring * (0.8 + random() * 0.6))
        bristle.rotateY(angle)
        bristle.translate(
          Math.sin(angle) * gather * ring * 0.5,
          headTop + jitter(random, headLength * 0.03),
          Math.cos(angle) * gather * ring * 0.5,
        )
        bristles.push(bristle)
      }

      // --- Bağlar ------------------------------------------------------------
      const bindings: BufferGeometry[] = []
      const turns = Math.max(0, Math.round(config.bindings))
      for (let i = 0; i < turns; i += 1) {
        const t = turns === 1 ? 0.18 : (i / (turns - 1)) * 0.3
        const y = headTop - headLength * (0.05 + t)
        // Bağın yarıçapı tellerin O YÜKSEKLİKTEKİ dağılımına oturuyor:
        // yukarıda dar, aşağıda geniş.
        const drop = (headTop - y) / headLength
        const radius = gather * 0.6 + Math.tan(config.flare) * headLength * drop * 0.8
        bindings.push(bandGeometry(radius, y, config.shaftRadius * 0.55,
          config.shaftRadius * 0.22, 8, tint('cloth', -0.16, 0.9)))
      }

      return {
        shaft: { slot: 'oak' as const, geometry: shaft },
        bristles: { slot: 'straw' as const, geometry: mergeColoured(bristles) },
        bindings: bindings.length > 0
          ? { slot: 'cloth' as const, geometry: mergeColoured(bindings) }
          : undefined,
      }
    },
  }, overrides)
}
