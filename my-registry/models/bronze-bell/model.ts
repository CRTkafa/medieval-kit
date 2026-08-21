/**
 * @medieval-kit/bronze-bell
 *
 * Boyunduruğa asılı tunç çan. Kilise kulesi, köy meydanı, gemi güvertesi.
 *
 * Kitin en çok "makine" olan parçası: çanın kendisi kolay, asıl mesele
 * ÇALIŞMASI. İki gövde birbirinden bağımsız sallanıyor —
 *
 *   - Çan boyunduruk ekseninde sönümlü bir sarkaç gibi gidip geliyor.
 *   - TOKMAK aynı eksende ama GECİKMELİ. Çanı çalan şey tam olarak bu gecikme:
 *     çan bir yöne giderken tokmak geride kalıyor, sonra yetişip kenara
 *     çarpıyor. İkisi birlikte hareket etseydi çan sessiz olurdu — nitekim
 *     ilk denemede tokmağı çanın `extras` gövdesi yapmıştım ve tam olarak öyle
 *     oldu: çan sallanıyor, hiçbir şey olmuyordu.
 *
 * Ses YOK. Model sahnenin ses sistemi hakkında varsayım yapamaz; ihtiyacı olan
 * `actions.strikes()` sayacını okuyup kendi sesini çalar.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  flipGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  type Level,
} from '../core/index.ts'

export interface BronzeBellConfig {
  /** Çanın ağız çapı (metre). */
  readonly diameter: number
  /** Çanın kendi yüksekliği (metre). */
  readonly height: number
  /** Boyunduruk kirişinin uzunluğu, çapın oranı olarak. */
  readonly yoke: number
  /** Tam savrulmadaki açı (derece). */
  readonly swing: number
  /** Sönümlenme hızı. Büyük değer çabuk durur. */
  readonly damping: number
  readonly seed: number
}

export const bronzeBellDefaults: BronzeBellConfig = {
  diameter: 0.36,
  height: 0.4,
  yoke: 1.35,
  swing: 34,
  damping: 0.55,
  seed: 67,
}

export type BronzeBellParts = 'bell' | 'clapper' | 'yoke'

export interface BronzeBellActions {
  /** Çanı çalar: sarkacı tam savrulmadan başlatır. */
  ring(): void
  /** Hareketi anında durdurur. */
  still(): void
  /** Çan hâlâ sallanıyor mu. */
  isRinging(): boolean
  /**
   * Tokmağın kenara kaç kez çarptığı. Ses çalmak isteyen tüketici bu sayacı
   * izler: `update()` sonrası artmışsa vuruş olmuş demektir.
   */
  strikes(): number
}

export function createModel(overrides: Partial<BronzeBellConfig> = {}) {
  // Sarkacın durumu inşanın DIŞINDA: `configure()` çanı susturmamalı.
  let angle = 0
  let velocity = 0
  let clapper = 0
  let clapperVelocity = 0
  let strikes = 0
  let lastSide = 0

  return createKitModel<BronzeBellConfig, 'brass' | 'iron' | 'oak', BronzeBellParts, BronzeBellActions>({
    id: 'bronze-bell',
    defaults: bronzeBellDefaults,
    slots: ['brass', 'iron', 'oak'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const radius = config.diameter / 2
      // Dönme ekseni: boyunduruğun kirişi. Her şey buna göre konumlanıyor.
      const pivotY = config.height * 0.62
      const half = config.height / 2

      // --- Çan gövdesi ------------------------------------------------------
      // Çan eğrisi keyfi değil: yukarıda dik omuz, ortada içbükey bel, ağza
      // doğru dışa açılan etek ve en altta kalınlaşan bir dudak (ses halkası).
      // O dudak olmadan silüet plastik bir huniye benziyor.
      const bellProfile: Level[] = [
        { y: -half + config.height * 0.02, radius: radius },
        { y: -half + config.height * 0.07, radius: radius * 0.855 },  // dudağın keskin açılımı
        { y: -half + config.height * 0.15, radius: radius * 0.75 },
        { y: -half + config.height * 0.36, radius: radius * 0.665 },  // bel: neredeyse düz
        { y: -half + config.height * 0.6, radius: radius * 0.615 },
        { y: -half + config.height * 0.79, radius: radius * 0.57 },
        { y: -half + config.height * 0.92, radius: radius * 0.49 },   // omuz dönüşü
        { y: half, radius: radius * 0.38 },
      ]
      // Çan bir KABUK: dışı, içi ve ikisini ağızda birleştiren bir dudak.
      // Tepesi kapalı (taç masif), ağzı açık.
      const skirt = latheGeometry(bellProfile, 12, [0, 0, 0], tint('brass', -0.06, 0.7), {
        colourTop: tint('brass', 0.05, 0.7),
        capBottom: false,   // ağız AÇIK: çanın içi görünmeli
        capTop: true,
      })
      // İç yüzey. Sarımı `flipGeometry` ile çevriliyor — `scale(-1, 1, 1)` ile
      // aynalamak da normalleri çeviriyor ama geometriyi de aynalıyor ve
      // kapağı ters yöne bakar hâlde bırakıyordu: çanın tepesinde delik
      // görünmesinin sebebi buydu.
      const innerProfile = bellProfile.map((level) => ({
        y: level.y + config.height * 0.02,
        radius: level.radius * 0.88,
      }))
      const inner = flipGeometry(latheGeometry(
        innerProfile, 12, [0, 0, 0], tint('brass', -0.24, 0.5),
        { capBottom: false, capTop: false },
      ))
      // Ağız dudağı: iç ve dış kabuğu birleştiren halka. Onsuz ağız kenarında
      // kabuk kalınlığı kadar bir yarık kalıyor ve çanın içi "hiçlik" oluyor.
      const lipY = -half + config.height * 0.02
      const lip = bandGeometry(
        radius * 0.995, lipY, config.height * 0.035,
        radius * 0.115, 12, tint('brass', -0.12, 0.6),
      )

      // Taç: çanı boyunduruğa bağlayan kulaklar.
      const crown: BufferGeometry[] = [skirt, inner, lip]
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2
        const ear = chamferedBoxGeometry(
          [radius * 0.13, radius * 0.1],
          [radius * 0.1, radius * 0.08],
          config.height * 0.16,
          radius * 0.03,
          [0, 0, 0],
          tint('brass', 0.08, 0.6),
        )
        ear.translate(Math.sin(a) * radius * 0.17, half + config.height * 0.05, Math.cos(a) * radius * 0.17)
        crown.push(ear)
      }

      const bell = mergeColoured(crown)
      bell.translate(0, -pivotY, 0)   // menteşe orijine gelsin

      // --- Tokmak ------------------------------------------------------------
      // Askı çubuğu + top. Askı çubuğu ekseninden aşağı iniyor, top ağız
      // hizasının biraz üstünde: gerçek tokmak çanın dudağına vurur.
      const drop = pivotY + half * 0.55
      const stem = prismGeometry(radius * 0.035, radius * 0.028, drop, 5,
        [0, -drop / 2, 0], tint('iron', -0.02, 0.7))
      const ball = latheGeometry([
        { y: -radius * 0.12, radius: radius * 0.04 },
        { y: -radius * 0.06, radius: radius * 0.11 },
        { y: radius * 0.04, radius: radius * 0.115 },
        { y: radius * 0.1, radius: radius * 0.05 },
      ], 7, [0, -drop, 0], tint('iron', 0.05, 0.7))
      const clapperGeometry = mergeColoured([stem, ball])

      // --- Boyunduruk ---------------------------------------------------------
      // SALLANMAZ: çanın asıldığı sabit parça. Kendi orijini yok, yani model
      // uzayında duruyor.
      const beamLength = config.diameter * config.yoke
      const beamY = pivotY + radius * 0.2
      // Kiriş ZATEN yatay üretiliyor: `chamferedBoxGeometry`'nin ilk iki
      // argümanı X–Z ayak izi, üçüncüsü Y yüksekliği. Buraya bir `rotateZ`
      // koymuştum ve kirişi dikleştirip çanın tepesinden bir direk gibi
      // çıkarmıştı — yardımcının hangi ekseni "yükseklik" saydığını yanlış
      // hatırlamanın bedeli.
      const beam = chamferedBoxGeometry(
        [beamLength, radius * 0.24],
        [beamLength * 0.98, radius * 0.21],
        radius * 0.3,
        radius * 0.04,
        [0, beamY, 0],
        tint('oak', 0.02),
      )
      const yokePieces: BufferGeometry[] = [beam]

      // Yataklar: kirişi taşıyan iki demir kulak. Kirişin ÜSTÜNE taşıyorlar —
      // hem gerçek yatak öyledir hem de üst yüzleri kirişinkiyle aynı hizada
      // olduğunda ikisi aynı düzleme oturup titriyordu.
      for (const side of [-1, 1]) {
        yokePieces.push(boxGeometry(
          [radius * 0.09, radius * 0.56, radius * 0.28],
          [side * beamLength * 0.34, beamY - radius * 0.02, 0],
          tint('iron', jitter(random, 0.04), 0.7),
        ))
      }

      return {
        bell: { slot: 'brass' as const, geometry: bell, origin: [0, pivotY, 0] as const },
        clapper: {
          slot: 'iron' as const,
          geometry: clapperGeometry,
          origin: [0, pivotY, 0] as const,
        },
        yoke: {
          slot: 'oak' as const,
          geometry: mergeColoured([yokePieces[0]!]),
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(yokePieces.slice(1)) }],
        },
      }
    },

    actions: ({ parts }) => {
      const apply = (): void => {
        parts.bell.anchor.rotation.z = angle
        parts.clapper.anchor.rotation.z = clapper
      }
      apply()
      return {
        ring: () => {
          // Hep AYNI yönden başlamıyor: art arda çalınan bir çan makine gibi
          // duruyordu. Yön mevcut hıza göre seçiliyor, yani devam eden bir
          // sallanmaya vurmak onu güçlendiriyor.
          const direction = velocity >= 0 ? 1 : -1
          velocity += direction * 3.4
        },
        still: () => {
          angle = 0; velocity = 0; clapper = 0; clapperVelocity = 0
          apply()
        },
        isRinging: () => Math.abs(angle) > 1e-4 || Math.abs(velocity) > 1e-4,
        strikes: () => strikes,
      }
    },

    update: (dt, { parts, getConfig }) => {
      const step = Math.min(0.05, Math.max(0, dt))
      if (step === 0) return
      const config = getConfig()
      const limit = (config.swing * Math.PI) / 180
      if (Math.abs(angle) < 1e-5 && Math.abs(velocity) < 1e-5
        && Math.abs(clapper) < 1e-5 && Math.abs(clapperVelocity) < 1e-5) return

      // Çan: sönümlü sarkaç. Geri çağırma kuvveti açıyla orantılı (küçük açı
      // yaklaşımı), sürtünme hızla orantılı.
      velocity += -angle * 26 * step - velocity * config.damping * step
      angle += velocity * step
      if (Math.abs(angle) > limit) {
        angle = Math.sign(angle) * limit
        velocity *= -0.35   // boyunduruk sınırına çarpma
      }

      // Tokmak: kendi sarkacı, ama askısı ÇANLA birlikte taşınıyor. Sürüklenme
      // terimi (angle - clapper) tam olarak gecikmeyi üretiyor.
      clapperVelocity += (angle - clapper) * 34 * step - clapperVelocity * 0.9 * step
      clapper += clapperVelocity * step

      // Çarpma: tokmak çanın iç duvarına değdiğinde. Duvar çanla birlikte
      // döndüğü için sınır MUTLAK değil, çana GÖRE.
      const reach = 0.26
      const relative = clapper - angle
      if (Math.abs(relative) > reach) {
        const side = Math.sign(relative)
        clapper = angle + side * reach
        clapperVelocity *= -0.55
        // Aynı yönde art arda sayılmasın: bir vuruş, bir yön değişimi.
        if (side !== lastSide) { strikes += 1; lastSide = side }
      } else if (Math.abs(relative) < reach * 0.4) {
        lastSide = 0
      }

      parts.bell.anchor.rotation.z = angle
      parts.clapper.anchor.rotation.z = clapper
    },
  }, overrides)
}
