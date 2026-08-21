/**
 * @medieval-kit/linen-sack
 *
 * Ağzı iple bağlanmış tahıl çuvalı. Depo, değirmen, pazar tezgâhı, at arabası —
 * kitin en çok yere yakışan parçalarından.
 *
 * Çuvalı çuval yapan şey, içindeki şeyin biçimini ALMASI. Bu yüzden gövde
 * silindir değil: dipte tahılın ağırlığıyla yayvanlaşıyor, ortada şişiyor,
 * ağza doğru toplanıyor. Sonra `roughenGeometry` yüzeyi bozuyor, çünkü dolu
 * bir çuvalın hiçbir yeri düz olmaz.
 *
 * Dip köşeleri ayrı bir mesele: gerçek çuval dört köşesinden büzülür ve o
 * köşeler kulak gibi dışarı çıkar. Onlar olmadan model bir vazoya benziyordu.
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

export interface LinenSackConfig {
  /** Toplam yükseklik (metre). */
  readonly height: number
  /** En geniş yerin yarıçapı (metre). */
  readonly radius: number
  /** Ne kadar dolu. 1 = tıka basa, 0.4 = yarı boş ve sarkık. */
  readonly fill: number
  /** Ağzın üstünde kalan bez payı, yüksekliğin oranı olarak. */
  readonly collar: number
  /** Dipteki büzülme kulakları. */
  readonly ears: number
  readonly seed: number
}

export const linenSackDefaults: LinenSackConfig = {
  height: 0.52,
  radius: 0.16,
  fill: 0.85,
  collar: 0.14,
  ears: 4,
  seed: 53,
}

export type LinenSackParts = 'body' | 'collar' | 'cord'

export function createModel(overrides: Partial<LinenSackConfig> = {}) {
  return createKitModel<LinenSackConfig, 'cloth', LinenSackParts>({
    id: 'linen-sack',
    defaults: linenSackDefaults,
    slots: ['cloth'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const fill = Math.max(0.15, Math.min(1, config.fill))
      // Ağız boğumunun yeri: dolu çuvalda yukarıda, boş çuvalda aşağıda kalır.
      const neckY = half - config.height * config.collar
      const bodyTop = neckY - config.height * 0.06

      // --- Gövde ----------------------------------------------------------
      // Profil doluluğa bağlı: az dolu bir çuval hem alçalır hem yanlara
      // yayılır. Tek bir `fill` sayısının siluetin tamamını değiştirmesi,
      // aynı modelden dolu ve yarı boş iki çuval çıkarabilmek demek.
      const wide = config.radius * (0.72 + fill * 0.36)
      const profile: Level[] = [
        { y: -half, radius: wide * 0.72 },
        { y: -half + config.height * 0.05, radius: wide * 0.95 },
        { y: -half + config.height * 0.26 * fill, radius: wide },
        { y: -half + config.height * 0.52 * fill, radius: wide * 0.93 },
        { y: bodyTop - config.height * 0.16, radius: wide * 0.7 },
        { y: bodyTop, radius: config.radius * 0.34 },
      ]
      const body = latheGeometry(profile, 9, [0, 0, 0], tint('cloth', -0.06, 1.3), {
        colourTop: tint('cloth', 0.05, 1.3),
      })
      // Bez sert değil: yüzey bozulması burada dokunun kendisi.
      roughenGeometry(body, config.radius * 0.05, { salt: 21, scaleY: 0.7 })

      const pieces: BufferGeometry[] = [body]

      // --- Dip kulakları ---------------------------------------------------
      // Çuval dikişten büzülür ve köşeleri dışarı fırlar. Onlar olmadan
      // silindir bir vazo çıkıyor.
      const ears = Math.max(0, Math.round(config.ears))
      for (let i = 0; i < ears; i += 1) {
        const angle = (i / ears) * Math.PI * 2 + jitter(random, 0.12)
        const reach = wide * (0.3 + random() * 0.16)
        const ear = boxGeometry(
          [reach, config.height * 0.05, config.radius * 0.2],
          [reach * 0.36, 0, 0],   // kökü gövdenin İÇİNDE kalsın
          tint('cloth', -0.1, 1.2),
        )
        // Önce yönlendir, sonra taşı — ters sıra kulağı yörüngeye savurur.
        ear.rotateZ(-0.22 + jitter(random, 0.1))
        ear.rotateY(-angle)
        ear.translate(
          Math.sin(angle) * wide * 0.6,
          -half + config.height * 0.035,
          Math.cos(angle) * wide * 0.6,
        )
        pieces.push(ear)
      }

      // --- Ağız payı -------------------------------------------------------
      // Bağın ÜSTÜNDE kalan, dışa devrilen bez. Çuvalı kapalı bir torbadan
      // ayıran şey bu: bağlanmış bir ağzın hep fazlası olur.
      const collarPieces: BufferGeometry[] = []
      const flare: Level[] = [
        { y: neckY - config.height * 0.02, radius: config.radius * 0.3 },
        { y: neckY + config.height * 0.03, radius: config.radius * 0.27 },
        { y: half - config.height * 0.02, radius: config.radius * 0.46 },
        { y: half, radius: config.radius * 0.4 },
      ]
      const collar = latheGeometry(flare, 9, [0, 0, 0], tint('cloth', 0.02, 1.3), {
        colourTop: tint('cloth', 0.1, 1.3),
        capTop: true,
      })
      roughenGeometry(collar, config.radius * 0.035, { salt: 22, scaleY: 0.6 })
      collarPieces.push(collar)

      // --- İp ---------------------------------------------------------------
      const cord = bandGeometry(config.radius * 0.29, neckY, config.height * 0.035,
        config.radius * 0.045, 9, tint('cloth', -0.24, 0.8), { inner: true })

      return {
        body: { slot: 'cloth' as const, geometry: mergeColoured(pieces) },
        collar: { slot: 'cloth' as const, geometry: mergeColoured(collarPieces) },
        cord: { slot: 'cloth' as const, geometry: mergeColoured([cord]) },
      }
    },
  }, overrides)
}
