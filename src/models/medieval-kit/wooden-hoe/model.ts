/**
 * @medieval-kit/wooden-hoe
 *
 * Kaz boyunlu tarla çapası: dişbudak sap, sapın ucundan öne-aşağı kıvrılan
 * dövme demir boyun ve onun ucundaki çukur ağız.
 *
 * ÜÇÜNCÜ deneme ve öncekilerin ikisi de aynı şeyi kaçırmıştı: KAZ BOYNU.
 * Çapayı çapa yapan şey ağız değil, ağzı sapın ekseninden ÖNE taşıyan kıvrık
 * boyundur. Onsuz elde ettiğin şey bir direğin tepesine dengelenmiş yassı bir
 * levha — render'da tam olarak "kürsü", "nota sehpası", "yol tabelası" diye
 * okundu. Boyun ayrıca siluete negatif boşluk katıyor: sap ile ağız arasındaki
 * o açıklık, nesneyi uzaktan ayırt eden şey.
 *
 * İkinci denemede ağza `bendGeometry` ile kavis vermeye çalışmış ve yorumda
 * "bu tek detay siluetteki asıl sorunu çözüyor" yazmıştım. Ölçünce yanlış
 * olduğu çıktı: ağız y=0'da ORTALANMIŞ kurulduğu için büküm simetrikti, iki uç
 * aynı yöne gidiyor, orta yerinde kalıyordu. 0.235 m'lik ağızda Z aralığı
 * 0.0337'den 0.0327'ye DÜŞÜYORDU, yani kavis siluette hiç görünmüyordu. Aynı
 * ağız tabanı orijinde kurulunca kaçış 44 mm. Artık hem boyun hem ağız
 * orijinden başlatılıyor.
 */
import type { BufferGeometry } from 'three'

import {
  bendGeometry,
  chamferedBoxGeometry,
  createKitModel,
  ironTint,
  steelTint,
  jitter,
  latheGeometry,
  mergeColoured,
  toolShaft,
  toolSocket,
  type Level,
} from '../core/index.ts'

export interface WoodenHoeConfig {
  /** Sap boyu (metre). */
  readonly length: number
  readonly shaftRadius: number
  /** Ağzın genişliği (metre). */
  readonly bladeWidth: number
  /** Kaz boynunun toplam dönüşü (derece). 0 = düz boyun, çapa olmaktan çıkar. */
  readonly neckSweep: number
  /** Ağzın çukurluğu. 0 = düz levha. */
  readonly dish: number
  readonly seed: number
}

export const woodenHoeDefaults: WoodenHoeConfig = {
  length: 1.14,
  shaftRadius: 0.021,
  bladeWidth: 0.2,
  neckSweep: 112,
  dish: 1,
  seed: 23,
}

export type WoodenHoeParts = 'shaft' | 'socket' | 'blade'

export function createModel(overrides: Partial<WoodenHoeConfig> = {}) {
  return createKitModel<WoodenHoeConfig, 'oak' | 'iron' | 'steel', WoodenHoeParts>({
    id: 'wooden-hoe',
    defaults: woodenHoeDefaults,
    slots: ['oak', 'iron', 'steel'],
    build: ({ config, random }) => {
      const shaft = toolShaft({ length: config.length, radius: config.shaftRadius, random })
      const socketLength = config.length * 0.075
      const socket = toolSocket({
        y: shaft.top - socketLength * 0.42,
        shaftRadius: shaft.topRadius,
        length: socketLength,
        random,
      })

      // --- Kaz boynu ----------------------------------------------------------
      // Tabanı ORİJİNDE kuruluyor ve oradan bükülüyor; y=0'da ortalansaydı
      // simetrik bükülür ve hiçbir şey olmazdı.
      //
      // `latheGeometry` seçilmesinin sebebi ara seviyeleri olması: iki
      // seviyeli bir kutuyu bükmek yay değil, eğrilmiş bir kutu verir.
      const neckLength = config.length * 0.17
      const bar = config.shaftRadius * 0.85
      const sweep = (config.neckSweep * Math.PI) / 180
      const curvature = sweep / neckLength

      const neckLevels: Level[] = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6
        return { y: neckLength * t, radius: bar * (1.05 - 0.28 * t) }
      })
      const neck = latheGeometry(neckLevels, 5, [0, 0, 0], ironTint(random, -0.02), {
        colourTop: ironTint(random, 0.04),
      })
      // Dövme boyun yuvarlak değil YASSI: çekiçle enine dövülür. Ölçekleme
      // bükümden ÖNCE ve yalnız X'te — Z'de ölçeklemek yayın düzlemini bozardı.
      neck.scale(1.75, 1, 0.62)
      bendGeometry(neck, curvature)
      neck.translate(0, shaft.top - neckLength * 0.12, 0)

      // Boynun UCU ve oradaki teğet, yay eşlemesinin kendisinden çıkıyor —
      // gözle konumlandırmak yerine hesaplanıyor, böylece `neckSweep`
      // değiştiğinde ağız kendiliğinden takip ediyor.
      const tipY = shaft.top - neckLength * 0.12 + Math.sin(sweep) / curvature
      const tipZ = (1 - Math.cos(sweep)) / curvature

      // --- Ağız ----------------------------------------------------------------
      // Boyun ucundan devam ediyor. Tabanı orijinde kuruluyor ki çukurluk
      // gerçekten görünsün.
      const bladeLength = config.length * 0.115
      const thick = config.length * 0.028
      const thin = config.length * 0.006
      const blade = chamferedBoxGeometry(
        [config.bladeWidth * 0.72, thick],
        [config.bladeWidth, thin],
        bladeLength,
        thin * 0.6,
        [0, bladeLength / 2, 0],
        steelTint(random, -0.04),
        steelTint(random, 0.05),
      )
      // Çukurluk: kesme kenarı kullanıcıya doğru kıvrılıyor, toprağı önünde
      // tutabilmesi için. NEGATİF eğrilik, yoksa çapa toprağı kendinden uzağa
      // iten bir kepçeye dönüyor.
      if (config.dish > 0) bendGeometry(blade, (-0.9 * config.dish) / bladeLength)
      // Dövme bir ağız kusursuz simetrik değildir.
      blade.rotateY(jitter(random, 0.04))
      // Boynun ucundaki teğet yönüne hizala, sonra oraya taşı — sıra kritik.
      blade.rotateX(sweep)
      blade.translate(0, tipY, tipZ)

      // Bilezik: boyun ile ağzın birleştiği yerdeki dövme kalınlaşma. İki
      // parçanın nasıl tutunduğu sorusunu cevaplayan tek detay.
      const collar = latheGeometry([
        { y: -bar * 0.9, radius: bar * 1.05 },
        { y: 0, radius: bar * 1.5 },
        { y: bar * 1.1, radius: bar * 1.15 },
      ], 6, [0, 0, 0], ironTint(random, 0.06))
      collar.scale(1.7, 1, 0.7)
      collar.rotateX(sweep)
      collar.translate(0, tipY, tipZ)

      const ironwork: BufferGeometry = mergeColoured([socket, neck, collar])

      return {
        shaft: { slot: 'oak', geometry: shaft.geometry },
        socket: { slot: 'iron', geometry: ironwork },
        blade: { slot: 'steel', geometry: mergeColoured([blade]) },
      }
    },
  }, overrides)
}
