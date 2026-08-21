/**
 * @medieval-kit/wooden-hoe
 *
 * Çapayı çapa yapan şey ağzın sapa göre açısı. Dik değil — yaklaşık 105°, yani
 * ağız öne ve aşağı bakar; toprağı çekerken kendiliğinden gömülsün diye.
 *
 * Ağız dövme bir levha: alt kenarı ince (kesen taraf), sokete doğru kalınlaşır.
 * `taperedBoxGeometry` bunu tek parçada veriyor — alt ve üst dikdörtgeni farklı
 * olduğu için hem daralma hem incelme aynı anda çıkıyor.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bendGeometry,
  chamferedBoxGeometry,
  createKitModel,
  ironTint,
  steelTint,
  jitter,
  mergeColoured,
  toolShaft,
  toolSocket,
} from '../core/index.ts'

export interface WoodenHoeConfig {
  readonly length: number
  readonly shaftRadius: number
  /** Ağız genişliği (metre). */
  readonly bladeWidth: number
  /** Ağzın sapa göre açısı (derece). 90 = tam dik. */
  readonly bladeAngle: number
  readonly seed: number
}

export const woodenHoeDefaults: WoodenHoeConfig = {
  length: 1.12,
  shaftRadius: 0.021,
  bladeWidth: 0.215,
  bladeAngle: 66,
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
      const socketLength = config.length * 0.055
      const socket = toolSocket({
        y: shaft.top - socketLength * 0.4,
        shaftRadius: shaft.topRadius,
        length: socketLength,
        random,
      })

      const bladeLength = config.length * 0.21
      const thin = config.length * 0.009
      const thick = config.length * 0.03

      // Ağız: aşağı doğru hem genişler hem incelir. Alt kenar kesen taraf.
      //
      // Oranlar iki kez değişti ve ikisinin de sebebi aynıydı: SİLUET.
      //   - İlk hâlde ağız sapın onda biri kadardı, uzaktan çekiç gibi
      //     okunuyordu. Çapayı çapa yapan şey geniş ağızdır.
      //   - Sonra ağız boyun tarafında yarı genişlikteydi, yani öne doğru
      //     ikiye katlanan bir yelpazeydi; tepeden bakınca bayrak gibi
      //     duruyordu. Gerçek çapa ağzı neredeyse DİKDÖRTGENDİR, kesme
      //     kenarına doğru sadece azıcık açılır.
      const blade = chamferedBoxGeometry(
        [config.bladeWidth * 0.88, thick],
        [config.bladeWidth, thin],
        bladeLength,
        config.shaftRadius * 0.3,
        [0, 0, 0],
        steelTint(random, -0.03),
        steelTint(random, 0.03),
      )
      // Kavis: çapa ağzı düz bir levha DEĞİLDİR, kullanıcıya doğru hafifçe
      // kıvrılır — toprağı iterken önünde tutabilmesi için. Üstelik bu tek
      // detay siluetteki asıl sorunu çözüyor: düz bir levha yukarıdan bakınca
      // raf gibi okunuyor, kıvrık olan "toprağa dalan ağız" gibi.
      bendGeometry(blade, -0.5 / bladeLength)
      // Dövme bir ağız kusursuz simetrik değildir; ufak bir eğiklik veriyoruz.
      blade.rotateY(jitter(random, 0.05))
      // Aşağı-öne çevir. 180° tam ters olurdu; bladeAngle sapla ağız arasındaki
      // açıyı belirliyor. Varsayılan 66° gözle seçildi: 62–134 arasını yan yana
      // render edip baktım. 98° civarında ağız neredeyse yatay kalıyor ve
      // 3/4 açıdan bakan bir kameraya TAM KENARINDAN görünüyor — yani modelin
      // en karakteristik yüzeyi siluetten tamamen siliniyor. Dar açıda ağzın
      // yüzü öne dönüyor ve çapa ilk bakışta çapa olarak okunuyor.
      blade.rotateX(Math.PI - (config.bladeAngle * Math.PI) / 180)
      blade.translate(0, shaft.top - bladeLength * 0.12, bladeLength * 0.42)

      // Boyun: ağzı sokete bağlayan kısa demir. İkisinin de içine giriyor.
      //
      // SIRA KRİTİK: parça ORIGIN'de kurulur, döndürülür, SONRA yerine taşınır.
      // Önce yerine koyup döndürmek onu origin etrafında savurur — boyun
      // y≈0.71'de olduğu için 0.35 rad'lık dönüş onu 0.23 m öne fırlatıyordu.
      const neckTint = new Color(ironTint(random, -0.02))
      const neck = chamferedBoxGeometry(
        [config.shaftRadius * 2.8, config.shaftRadius * 2.3],
        [config.shaftRadius * 2.4, config.shaftRadius * 2],
        config.length * 0.075,
        config.shaftRadius * 0.3,
        [0, 0, 0],
        neckTint,
      )
      // Boyun ağzı takip etmeli: geriye yatan bir boyun sapın tepesinde
      // baca gibi duruyordu.
      neck.rotateX(0.5)
      neck.translate(0, shaft.top - config.length * 0.012, config.length * 0.016)

      const head: BufferGeometry = mergeColoured([blade, neck])

      return {
        shaft: { slot: 'oak', geometry: shaft.geometry },
        socket: { slot: 'iron', geometry: socket },
        blade: { slot: 'steel', geometry: head },
      }
    },
  }, overrides)
}
