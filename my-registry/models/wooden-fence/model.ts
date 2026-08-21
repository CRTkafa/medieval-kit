/**
 * @medieval-kit/wooden-fence
 *
 * Zıvanalı riven çit: yarılmış kalın direkler, direğin İÇİNDEN geçen kirişler.
 *
 * İKİNCİ deneme ve sebebi tek kelimeyle söylenebilir: BİRLEŞİM. İlk hâlde
 * dört kare çubuk ve önlerine konmuş iki ince lata vardı; hiçbir noktada iki
 * parçanın birbirine nasıl tutunduğu görünmüyordu, dolayısıyla nesnenin bütün
 * konusu eksikti. Render'da çit değil "çitin teknik resmi" gibi okunuyordu —
 * 4.89 × 1.10 × 0.09 m, yani derinlik/boy oranı 54:1, karton.
 *
 * Gerçek riven post-and-rail çitinde direğe DİKDÖRTGEN BİR DELİK açılır ve
 * kiriş o delikten geçer. Modelin tamamı bu tek gerçeğin etrafında yeniden
 * kuruldu:
 *
 *   - Direk artık tek kutu değil: iki YANAK ve aralarındaki KÖPRÜ blokları.
 *     Delik böylece geometrik olarak var oluyor, boyanmış bir çentik değil.
 *     `bakeOcclusion` da ağzını kendiliğinden karartıyor.
 *   - Kiriş delikten geçip çitin iki ucunda karşı yüzden TAŞIYOR. Zıvana dili
 *     siluete giren tek yatay çıkıntı ve "bu nasıl duruyor" sorusunu tek
 *     başına cevaplıyor.
 *   - Kiriş delikten dar: her yanda birkaç milimlik boşluk kalıyor, yani delik
 *     kapanmıyor. Deliği delik gösteren şey o boşluk.
 *
 * Bir de dizilim: eski kiriş dağılımı `0.28 + 0.5·r/(count−1)` idi, yani kaç
 * kiriş olursa olsun HEP 0.28–0.78 aralığını dolduruyordu. Üstü ve altı
 * doldurmak yapısal olarak imkânsızdı; siluetin üst kenarı bu yüzden boştu.
 */
import { Color } from 'three'
import type { BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  taperedBoxGeometry,
} from '../core/index.ts'

export interface WoodenFenceConfig {
  /** Bölüm sayısı. Her bölüm iki direk arası. */
  readonly sections: number
  /** Bir bölümün uzunluğu (metre). Kiriş bir kütükten yarıldığı için 2–3 m. */
  readonly sectionLength: number
  readonly height: number
  /** Yatay kiriş sayısı. */
  readonly railCount: number
  /** Direklerin eğrilik ve boy sapması. 0 = fabrikasyon düzgünlük. */
  readonly rough: number
  /** Bir uca payanda konsun mu (0/1). */
  readonly brace: number
  readonly seed: number
}

export const woodenFenceDefaults: WoodenFenceConfig = {
  sections: 2,
  sectionLength: 2.4,
  height: 1.25,
  railCount: 3,
  rough: 1,
  brace: 1,
  seed: 12,
}

export type WoodenFenceParts = 'posts' | 'rails'

export function createModel(overrides: Partial<WoodenFenceConfig> = {}) {
  return createKitModel<WoodenFenceConfig, 'oak', WoodenFenceParts>({
    id: 'wooden-fence',
    // Alaca hücresi elle veriliyor: çit 4.8 m uzun, otomatik türetme onu
    // modelin ölçeğinden çıkarınca tek direk tek hücreye düşüyor ve doku
    // sistemi hiçbir şey yapmıyor. Ahşabın damar lekesi nesnenin boyundan
    // bağımsız olarak birkaç santimdir.
    mottle: { cell: 0.05 },
    defaults: woodenFenceDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const shade = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.06))
        return tint
      }
      /** Damar ucu: yarılmış yüzey ve kesik uçlar. Çit bunu hiç kullanmıyordu. */
      const endGrain = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oakEnd)
        tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), lift + jitter(random, 0.05))
        return tint
      }
      const soil = (): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.01), -0.3 + jitter(random, 0.04), -0.19 + jitter(random, 0.04))
        return tint
      }

      const sections = Math.max(1, Math.round(config.sections))
      const count = Math.max(1, Math.round(config.railCount))
      const total = sections * config.sectionLength
      const half = config.height / 2
      const rough = Math.max(0, config.rough)

      // --- Ölçüler, hepsi yükseklikten türetiliyor --------------------------
      const postW = config.height * 0.12          // direğin çit boyunca genişliği
      const mortise = config.height * 0.062       // deliğin Z açıklığı
      const cheek = config.height * 0.03          // deliğin iki yanındaki et
      const postD = mortise + cheek * 2           // direğin toplam derinliği
      const railH = config.height * 0.098         // kirişin dikey yüksekliği
      const railD = config.height * 0.053         // kirişin derinliği — delikten DAR
      const tenon = config.height * 0.088         // uçlardaki taşma

      // Kiriş yükseklikleri. Üs 1.12: aralıklar aşağı doğru sıkışıyor, çünkü
      // altından geçmeye çalışan hayvan küçük olandır.
      const railT = Array.from({ length: count }, (_, r) =>
        count === 1 ? 0.55 : 0.19 + 0.71 * Math.pow(r / (count - 1), 1.12))

      // --- Direkler -----------------------------------------------------------
      const postPieces: BufferGeometry[] = []
      const slotHalf = railH / 2 + config.height * 0.008

      for (let i = 0; i <= sections; i += 1) {
        const x = -total / 2 + i * config.sectionLength
        const postH = config.height + jitter(random, 0.075 * rough)
        const pieces: BufferGeometry[] = []

        // İki yanak: deliğin duvarları. Tam boy, tabandan tepeye.
        for (const side of [-1, 1]) {
          pieces.push(chamferedBoxGeometry(
            [postW, cheek],
            [postW * 0.81, cheek * 0.94],
            postH,
            cheek * 0.2,
            [0, postH / 2, side * (mortise + cheek) / 2],
            shade(-0.11),
            shade(0.02),
          ))
        }

        // Köprüler: yuvaların ARASINI dolduran bloklar. Delik tam olarak
        // bunların bıraktığı boşluk. Kesitleri yanakların İÇİNDE kalıyor
        // (±Z yüzleri yanak katısına gömülü), yani hiçbir yüz çifti eş
        // düzlemde değil.
        //
        // Köprüler direğin iki UCUNA kadar gitmiyor: uçları yanakların
        // uçlarıyla aynı düzleme oturup titriyordu. İçeri çekilen paylar
        // görünmüyor — alttaki toprak yığınının, üstteki başlığın içinde
        // kalıyor.
        const inset = cheek * 0.3
        const bounds = [0, ...railT.flatMap((t) => [t * postH - slotHalf, t * postH + slotHalf]), postH]
        for (let k = 0; k + 1 < bounds.length; k += 2) {
          const lo = Math.max(inset, bounds[k]!)
          const hi = Math.min(postH - inset, bounds[k + 1]!)
          if (hi - lo < 1e-4) continue
          const taper = 1 - 0.19 * (lo / postH)
          pieces.push(taperedBoxGeometry(
            [postW * taper * 0.96, mortise + cheek * 1.1],
            [postW * (taper - 0.03) * 0.96, mortise + cheek * 1.1],
            hi - lo,
            [0, (lo + hi) / 2, 0],
            shade(-0.07),
          ))
        }

        // Başlık: baltayla yontulmuş, suyu akıtan sırt. Tabanı gövdenin İÇİNDE
        // ve kesiti gövdenin o yükseklikteki kesitinden BÜYÜK — `toolSocket`
        // deseninin aynısı, eş düzlem yüz çifti bu yüzden oluşmuyor.
        pieces.push(taperedBoxGeometry(
          [postW * 0.88, postD * 0.98],
          [postW * 0.74, postD * 0.13],
          config.height * 0.1,
          [0, postH - config.height * 0.016, 0],
          endGrain(-0.03),
          endGrain(0.07),
        ))

        // Kur → DÖNDÜR → taşı. Eski kod merkezi doğrudan geometri çağrısına
        // geçirdiği için döndürmek imkânsızdı; ızgara gibi dizilmesinin sebebi
        // buydu. Dönüşler küçük tutuluyor: 0.045 rad, delik yolunda 7 mm yanal
        // kayma demek ve delik payı 8 mm.
        const post = mergeColoured(pieces)
        post.rotateY(jitter(random, 0.045 * rough))
        post.rotateZ(jitter(random, 0.03 * rough))
        post.rotateX(jitter(random, 0.018 * rough))
        const sink = config.height * (0.012 + Math.abs(jitter(random, 0.012)))
        post.translate(x, -half - sink, 0)
        postPieces.push(post)

        // Toprak yığını. DÖNMEZ: direğin eğikliği yığını yerden kaldırırdı.
        postPieces.push(taperedBoxGeometry(
          [postW * 2.2, postD * 2],
          [postW * 1.25, postD * 1.15],
          config.height * 0.11,
          [x, -half + config.height * 0.018, 0],
          soil(),
        ))
      }

      // --- Kirişler -------------------------------------------------------------
      const railPieces: BufferGeometry[] = []
      for (let r = 0; r < count; r += 1) {
        const y = -half + railT[r]! * config.height + jitter(random, config.height * 0.005)
        for (let i = 0; i < sections; i += 1) {
          const xc = -total / 2 + (i + 0.5) * config.sectionLength
          // Gövde iki komşu direğin deliğine giriyor ve orada komşu bölmenin
          // gövdesiyle uç uca buluşuyor.
          const body = chamferedBoxGeometry(
            [config.sectionLength + postW * 0.55, railD],
            [config.sectionLength + postW * 0.55, railD * 0.88],
            railH,
            railH * 0.09,
            [xc, y, jitter(random, railD * 0.06)],
            shade(0.05),
            shade(0.1),
          )
          railPieces.push(body)
        }

        // Zıvana dili: YALNIZ iki uçta. Karşı yüzden taşan bu parça siluete
        // giren tek yatay çıkıntı; kirişin direğin içinden geçtiğini tek
        // başına anlatıyor. Ara direklerde taşma yok, çünkü orada iki gövde
        // deliğin içinde buluşuyor.
        for (const side of [-1, 1]) {
          const px = side * total / 2
          railPieces.push(taperedBoxGeometry(
            [tenon * 2, railD * 0.9],
            [tenon * 1.7, railD * 0.76],
            railH * 0.82,
            [px + side * tenon * 0.72, y, 0],
            shade(0.02),
            endGrain(0.05),
          ))
        }
      }

      // --- Payanda ---------------------------------------------------------------
      // Modelin tek eksen dışı hattı. Uç direği tarlaya doğru destekliyor.
      if (config.brace >= 0.5) {
        const rise = config.height * 0.72
        const run = config.sectionLength * 0.3
        const length = Math.hypot(run, rise)
        const atStart = random() < 0.5
        const brace = chamferedBoxGeometry(
          [postW * 0.72, postD * 0.36],
          [postW * 0.56, postD * 0.3],
          length,
          postW * 0.06,
          [0, 0, 0],
          shade(-0.05),
          endGrain(0.02),
        )
        // İşaret TERS görünüyor ama doğrusu bu: payandanın TEPESİ direğe
        // yaslanır, AYAĞI tarlaya basar. Ters çevrildiğinde ayağı direğin
        // dibinde, tepesi havada kalan bir çubuk çıkıyordu — hiçbir şeyi
        // desteklemeyen bir payanda.
        const angle = Math.atan2(run, rise)
        brace.rotateZ(atStart ? angle : -angle)
        brace.translate(
          (atStart ? -1 : 1) * (total / 2 - run / 2),
          -half + rise / 2 + config.height * 0.02,
          // Direğin arka yüzü EĞİK (konik), payandanınki dik — hiçbir
          // yükseklikte eş düzleme gelmiyorlar.
          -postD * 0.62,
        )
        postPieces.push(brace)
      }

      return {
        posts: { slot: 'oak', geometry: mergeColoured(postPieces) },
        rails: { slot: 'oak', geometry: mergeColoured(railPieces) },
      }
    },
  }, overrides)
}
