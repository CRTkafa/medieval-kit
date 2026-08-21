/**
 * @medieval-kit/straw-broom
 *
 * Besom: fındık çubuğundan sap, ucuna söğüt bağıyla tutturulmuş huş çalısı
 * demeti. Dönemin süpürgesi gerçekten bu kadar basitti ve tam da bu yüzden her
 * iç mekân sahnesinde bulunuyordu.
 *
 * ÜÇÜNCÜ deneme. İlkinde teller tek tek çubuktu ve demet çırpıcı gibi
 * duruyordu; ikincisinde yassı levhalara geçtim, kütle geldi ama render'da
 * ortaya çıkan şey yine süpürge değildi: "sapa geçirilmiş bir abajur",
 * "kapalı bir şemsiye". Sebebi tek ve yapısaldı — bütün levhalar TEK BİR
 * HALKADA duruyordu, yani demet içi boş bir koni KABUĞUYDU. Üstelik yukarıdan
 * tek noktada toplanıp aşağı açıldığı için silueti koniydi, oysa besom
 * hafifçe açılmış bir SİLİNDİRDİR.
 *
 * Üç değişiklik bunu çözüyor:
 *
 *   - Demet üç EŞMERKEZLİ halkadan kuruluyor (6 / 10 / 16). İç halkaların
 *     eğimi daha az, dolayısıyla ortası doluyor. Kabuk kütleye dönüşüyor.
 *   - Açılma artık elle verilen bir açı değil: bağ yarıçapı ile uç yarıçapı
 *     veriliyor, eğim ikisinden TÜREVİ. Silueti belirleyen şey doğrudan
 *     ölçülebilir iki sayı.
 *   - Bağların yarıçapı demetin O YÜKSEKLİKTEKİ yarıçapıyla aynı kaynaktan
 *     geliyor. Eskiden ayrı bir tahmin formülü vardı ve bağ demetin havasında
 *     asılı kalıyordu.
 */
import type { BufferGeometry } from 'three'

import {
  arcBarGeometry,
  bandGeometry,
  bendGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  roughenGeometry,
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
  /** Bağ hizasındaki demet yarıçapı (metre). */
  readonly tieRadius: number
  /** Süpürme ucundaki demet yarıçapı (metre). Açılma bu ikisinden türer. */
  readonly tipRadius: number
  /** Toplam çalı sayısı. */
  readonly bristles: number
  /** Kaç tur bağ. */
  readonly bindings: number
  readonly seed: number
}

export const strawBroomDefaults: StrawBroomConfig = {
  length: 1.2,
  shaftRadius: 0.018,
  headLength: 0.42,
  tieRadius: 0.058,
  tipRadius: 0.102,
  bristles: 32,
  bindings: 3,
  seed: 59,
}

export type StrawBroomParts = 'shaft' | 'bristles' | 'bindings'

export function createModel(overrides: Partial<StrawBroomConfig> = {}) {
  return createKitModel<StrawBroomConfig, 'oak' | 'straw' | 'cloth', StrawBroomParts>({
    id: 'straw-broom',
    // Otomatik türetilen değerler 1.2 m'lik bir nesne için fazla iri kalıyor:
    // kapanma demeti battaniye gibi karartıyor, alaca hücresi levha başına
    // birkaç örneğe düşüyor. İkisi de çalının ölçeğine bağlanıyor.
    occlusion: { radius: 0.055 },
    mottle: { cell: 0.022 },
    defaults: strawBroomDefaults,
    slots: ['oak', 'straw', 'cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.length / 2
      const headLength = config.length * config.headLength
      const headTop = -half + headLength

      // --- Demetin biçimi, tek kaynaktan --------------------------------------
      const tieY = headTop - config.length * 0.017
      const sweepY = -half + config.length * 0.025
      const span = Math.max(0.02, tieY - sweepY)
      const tieRadius = config.tieRadius
      const tipRadius = Math.max(tieRadius * 1.05, config.tipRadius)
      // `tieRadius` ve `tipRadius` demetin DIŞ yarıçapı — kullanıcının bir
      // süpürgeye baktığında ölçeceği şey. Halkalar buradan geri hesaplanıyor:
      // dış yüzey = halka yarıçapı + levhanın yarı genişliği.
      const halfWidth = config.shaftRadius * 0.95
      /** Demetin `y` yüksekliğindeki DIŞ yarıçapı. Bağlar da bunu kullanıyor. */
      const bundleRadius = (y: number): number =>
        tieRadius + (tipRadius - tieRadius) * Math.min(1, Math.max(0, (tieY - y) / span))

      // Süpürgenin bir YÜZÜ var: elde tutulurken hep aynı tarafı yere değer ve
      // o taraf daha çok aşınır. Yön tohuma bağlı olarak bir kez seçiliyor.
      const faceAngle = random() * Math.PI * 2

      // --- Çalı: üç eşmerkezli halka --------------------------------------------
      // İç halkaların eğimi az, dış halkanınki tam. Demetin içi bu yüzden
      // doluyor; tek halka bıraksaydım yine kabuk olurdu.
      const total = Math.max(6, Math.round(config.bristles))
      const core = Math.max(config.shaftRadius, tieRadius - halfWidth)
      const rings = [
        { share: 0.19, radius: core * 0.34, slope: 0.3, offset: 0 },
        { share: 0.31, radius: core * 0.62, slope: 0.68, offset: Math.PI / 7 },
        { share: 0.5, radius: core * 0.92, slope: 1, offset: Math.PI / 14 },
      ]
      const fullFlare = Math.atan((tipRadius - tieRadius) / span)

      const bristles: BufferGeometry[] = []
      for (const ring of rings) {
        const n = Math.max(3, Math.round(total * ring.share))
        for (let i = 0; i < n; i += 1) {
          const angle = (i / n) * Math.PI * 2 + ring.offset + jitter(random, 0.1)
          const flare = fullFlare * ring.slope * (0.92 + random() * 0.16)
          // Aşınmış yüz daha kısa: asimetri buradan geliyor, demeti yassıltarak
          // değil. (Yassı yelpaze süpürge 19. yy Shaker icadı, burada anakronizm.)
          const wear = 1 + 0.1 * Math.cos(angle - faceAngle)
          const length = (span / Math.cos(flare)) * wear * (0.97 + random() * 0.06)

          const width = config.shaftRadius * (1.7 + random() * 0.28)
          const depth = config.shaftRadius * (0.78 + random() * 0.16)
          // Kesit AŞAĞI DOĞRU İNCELİYOR. Önceki hâlde tam tersiydi — alt uç
          // hem geniş hem kalındı, yani demet aşağı doğru şişiyordu; oysa
          // süpürülen uç yıllar içinde aşınıp incelir.
          const sheaf = taperedBoxGeometry(
            [width * 1.12, depth * 0.62],
            [width, depth],
            length,
            [0, -length / 2, 0],   // üst uç ORİJİNDE: demet bağdan asılıyor
            tint('straw', 0.02, 1.5),
            tint('strawPale', 0.12, 1.5),
          )
          roughenGeometry(sheaf, config.shaftRadius * 0.09, { salt: i, scaleY: 0.4 })

          // İŞARET: levha -Y yönünde uzuyor. `rotateX(+f)` onun ucunu -Z'ye
          // atıyor ve sonraki `rotateY(angle)` -Z'yi EKSENE DOĞRU çeviriyor —
          // yani artı işaret demeti dışa değil İÇERİ açıyor. Önceki iki
          // sürümde de bu böyleydi: levhalar ekseni geçip karşı tarafa
          // savruluyor, demet bu yüzden içi boş bir kabuk oluyordu. Ölçüyle
          // yakalandı, gözle değil — demetin genişliği 0.23 m beklerken
          // 0.13 m çıkıyordu.
          sheaf.rotateZ(jitter(random, 0.09))
          sheaf.rotateX(-flare)
          sheaf.rotateY(angle)
          sheaf.translate(
            Math.sin(angle) * ring.radius,
            tieY + jitter(random, config.length * 0.005),
            Math.cos(angle) * ring.radius,
          )
          bristles.push(sheaf)
        }
      }

      // --- Yaka: bağın üstünde kalan kesik dipler --------------------------------
      // Hem sapın demete girdiği yeri örtüyor hem de "bu bir demet" demenin en
      // ucuz yolu: yukarı devrilmiş kısa kütükler.
      for (let i = 0; i < 9; i += 1) {
        const angle = i * 2.399963   // altın oran açısı: hiçbir yerde sıra oluşmuyor
        const stub = config.shaftRadius * (1.6 + random() * 1.2)
        const piece = taperedBoxGeometry(
          [config.shaftRadius * 0.62, config.shaftRadius * 0.4],
          [config.shaftRadius * 0.5, config.shaftRadius * 0.34],
          stub,
          [0, stub / 2, 0],   // merkez ALT uçta: bu parça yukarı fırlıyor
          tint('strawPale', 0.16, 1.4),
          tint('straw', 0.04, 1.4),
        )
        // Bu parça +Y yönünde uzuyor, yani işaret levhaların TERSİ: artı değer
        // ucunu +Z'ye atıyor ve `rotateY` onu dışa çeviriyor.
        piece.rotateZ(jitter(random, 0.08))
        piece.rotateX(0.28 + random() * 0.24)
        piece.rotateY(angle)
        piece.translate(
          Math.sin(angle) * tieRadius * 0.8,
          tieY + config.length * 0.008,
          Math.cos(angle) * tieRadius * 0.8,
        )
        bristles.push(piece)
      }

      // --- Bağlar ----------------------------------------------------------------
      const turns = Math.max(0, Math.round(config.bindings))
      const bindings: BufferGeometry[] = []
      for (let i = 0; i < turns; i += 1) {
        const y = tieY - config.length * (0.01 + i * 0.042)
        // Bağ demetin DIŞ yüzeyine oturuyor, biraz da ısırıyor. İlk hâlde
        // yarıçap halka yarıçapından hesaplanıyordu, yani bağ levhaların
        // İÇİNDE kalıyor ve hiç görünmüyordu.
        const radius = bundleRadius(y) - config.shaftRadius * 0.16
        bindings.push(bandGeometry(
          radius, y, config.shaftRadius * 1.15, config.shaftRadius * 0.42, 12,
          tint('cloth', -0.28, 0.9), { inner: true },
        ))
      }
      if (turns > 0) {
        // Sıkıştırılmış söğüt ucu: bağın kendisinin nasıl bağlandığını gösteren
        // tek parça. Bandın 30°'lik fasetiyle paralel kalmasın diye kaydırılıyor.
        const withy = arcBarGeometry(
          bundleRadius(tieY) + config.shaftRadius * 0.24, config.shaftRadius * 0.32,
          -0.5, 0.9, 3, [0, 0, 0], tint('cloth', -0.34, 0.7),
        )
        withy.rotateX(Math.PI / 2)
        withy.rotateY(0.26 + Math.PI / 12)
        withy.translate(0, tieY - config.length * 0.006, 0)
        bindings.push(withy)
      }

      // --- Sap ---------------------------------------------------------------------
      // Torna mili değil, ormandan kesilmiş bir fındık çubuğu: yarıçap boyunca
      // dalgalanıyor, elde tutulan yerde kabza şişkinliği var, üst ucu
      // yontulmuş. Ve hafifçe eğri — düz bir çubuk hep fabrikasyon okunuyor.
      //
      // ORİJİNDE kurulup bükülüyor, SONRA taşınıyor: nihai koordinatta bükmek
      // bütün sopayı savururdu.
      const shaftBottom = headTop - config.length * 0.1
      const shaftLength = half - shaftBottom
      const r = config.shaftRadius
      const shaftLevels: Level[] = [
        { y: -shaftLength / 2, radius: r * 0.26 },
        { y: -shaftLength / 2 + shaftLength * 0.07, radius: r * 0.82 },
        { y: -shaftLength / 2 + shaftLength * 0.16, radius: r * 1.02 },
        { y: shaftLength * 0.06, radius: r * 0.93 },
        { y: shaftLength / 2 - shaftLength * 0.07, radius: r * 1.14 },   // kabza
        { y: shaftLength / 2, radius: r * 0.84 },
      ].map((level) => ({ y: level.y, radius: level.radius * (1 + jitter(random, 0.05)) }))

      const shaft = latheGeometry(shaftLevels, 6, [0, 0, 0], tint('oak', -0.05), {
        colourTop: tint('oak', 0.05),
      })
      bendGeometry(shaft, jitter(random, 0.22) / shaftLength)
      shaft.rotateY(random() * Math.PI * 2)
      shaft.translate(0, shaftBottom + shaftLength / 2, 0)

      return {
        shaft: { slot: 'oak' as const, geometry: mergeColoured([shaft]) },
        bristles: { slot: 'straw' as const, geometry: mergeColoured(bristles) },
        bindings: bindings.length > 0
          ? { slot: 'cloth' as const, geometry: mergeColoured(bindings) }
          : undefined,
      }
    },
  }, overrides)
}
