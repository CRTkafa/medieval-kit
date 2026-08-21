/**
 * @medieval-kit/glass-phial
 *
 * Mantar tıpalı, mumla mühürlenmiş cam şişe. Simyacı rafı, şifacı çantası,
 * envanterde bir slot.
 *
 * Kitin `glass` yuvasını kullanan ikinci modeli ve camın asıl sınandığı yer:
 * fenerde cam bir KAFESİN paneliydi, burada kabın kendisi. İki sonucu var —
 *
 *   - İçerik cam kabuğun İÇİNDE ayrı bir gövde. `ember` yuvasında, yani ışık
 *     almıyor kendi rengini veriyor: dibi karanlık bir sıvı, iksir değil kirli
 *     su gibi duruyordu.
 *   - Sıvı yüzeyi düz bir disk. Camın içinden bakınca o düz çizgi "burası
 *     dolu" diyen tek işaret; küresel bir sıvı gövdesi yüzeysiz kalıyor ve
 *     şişe boş görünüyor.
 *
 * Dönem notu: berrak, renksiz cam çok geç bir şey. Dönemin camı demir
 * safsızlığından yeşilimsi ve kabarcıklıydı; palette `glass` rengi bu yüzden
 * yeşile çalıyor.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
  createKitModel,
  createTinter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface GlassPhialConfig {
  /** Tıpa dâhil toplam yükseklik (metre). */
  readonly height: number
  /** Gövdenin en geniş yarıçapı (metre). */
  readonly radius: number
  /** Boyun uzunluğu, yüksekliğin oranı olarak. */
  readonly neck: number
  /** Doluluk. 0 boş, 1 ağzına kadar. */
  readonly fill: number
  /**
   * Sıvının rengi, renk çemberi üzerinde 0–1.
   *
   * Sabit bir renk yerine parametre olmasının sebebi kitin geri kalanıyla aynı:
   * tek bir modelden kırmızı şifa, yeşil zehir ve mavi mana iksiri çıkabilmeli.
   * Palete üç ayrı renk eklemek aynı şeyi daha katı biçimde yapardı.
   */
  readonly hue: number
  /** Mum mühür var mı (0/1). */
  readonly seal: number
  readonly seed: number
}

export const glassPhialDefaults: GlassPhialConfig = {
  height: 0.14,
  radius: 0.032,
  neck: 0.34,
  fill: 0.62,
  hue: 0.33,
  seal: 1,
  seed: 83,
}

export type GlassPhialParts = 'bottle' | 'liquid' | 'stopper'

export function createModel(overrides: Partial<GlassPhialConfig> = {}) {
  return createKitModel<GlassPhialConfig, 'glass' | 'ember' | 'oak' | 'char', GlassPhialParts>({
    id: 'glass-phial',
    defaults: glassPhialDefaults,
    slots: ['glass', 'ember', 'oak', 'char'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const neckLength = config.height * config.neck
      const bodyTop = half - neckLength
      const bodyBottom = -half
      const neckRadius = config.radius * 0.36

      // --- Şişe ---------------------------------------------------------------
      // Üflemeli cam: dipte hafif içe çekik (pontil izi), gövde küresel, omuz
      // dar boyna hızlıca daralıyor, ağızda dışa devrilmiş bir dudak.
      const profile: Level[] = [
        { y: bodyBottom + config.height * 0.02, radius: config.radius * 0.5 },
        { y: bodyBottom + config.height * 0.06, radius: config.radius * 0.86 },
        { y: bodyBottom + config.height * 0.19, radius: config.radius },
        { y: bodyBottom + (bodyTop - bodyBottom) * 0.72, radius: config.radius * 0.88 },
        { y: bodyTop, radius: config.radius * 0.5 },
        { y: bodyTop + neckLength * 0.34, radius: neckRadius },
        { y: half - config.height * 0.05, radius: neckRadius * 0.96 },
        { y: half - config.height * 0.02, radius: neckRadius * 1.28 },  // dudak
      ]
      const bottle = latheGeometry(profile, 9, [0, 0, 0], tint('glass', -0.02, 0.4), {
        colourTop: tint('glass', 0.06, 0.4),
        capTop: false,   // ağız AÇIK: tıpa oraya oturuyor
      })
      // Üflemeli cam kusursuz simetrik değildir; sapma çok küçük tutuluyor
      // çünkü saydam bir yüzeyde büyük düzensizlik buzlu cam gibi okunuyor.
      roughenGeometry(bottle, config.radius * 0.02, { salt: 41 })

      // --- İçerik -------------------------------------------------------------
      // Sıvı seviyesi doluluktan hesaplanıyor ve gövdenin O YÜKSEKLİKTEKİ
      // yarıçapına oturuyor — sabit bir yarıçap kullanmak sıvıyı camdan
      // taşırıyor ya da ortada asılı bırakıyordu.
      const fill = Math.max(0, Math.min(1, config.fill))
      let liquid: BufferGeometry | undefined
      if (fill > 0.02) {
        const surfaceY = bodyBottom + config.height * 0.04
          + (bodyTop + neckLength * 0.4 - bodyBottom - config.height * 0.04) * fill
        const inner = profile
          .filter((level) => level.y < surfaceY)
          .map((level) => ({ y: level.y, radius: level.radius * 0.88 }))
        const radiusAt = (y: number): number => {
          for (let i = 1; i < profile.length; i += 1) {
            const a = profile[i - 1]!
            const b = profile[i]!
            if (y <= b.y) {
              const t = (y - a.y) / Math.max(1e-6, b.y - a.y)
              return (a.radius + (b.radius - a.radius) * t) * 0.88
            }
          }
          return profile.at(-1)!.radius * 0.88
        }
        inner.push({ y: surfaceY, radius: radiusAt(surfaceY) })
        // Sıvı `ember` yuvasında, yani IŞIK ALMIYOR: vertex rengi doğrudan
        // ekrana giden son renk. Bu bir tercih — camın arkasındaki bir sıvı
        // sahnenin ışığına göre kararınca iksir değil kirli su gibi duruyordu.
        const hue = ((config.hue % 1) + 1) % 1
        const deep = new Color().setHSL(hue, 0.78, 0.36)
        const bright = new Color().setHSL((hue + 0.03) % 1, 0.72, 0.58)
        liquid = mergeColoured([latheGeometry(
          inner, 9, [0, 0, 0], deep,
          { colourTop: bright, capTop: true },
        )])
      }

      // --- Tıpa ---------------------------------------------------------------
      const stopper: BufferGeometry[] = [prismGeometry(
        neckRadius * 1.02, neckRadius * 1.24, config.height * 0.11, 8,
        [0, half - config.height * 0.035, 0], tint('oak', 0.08),
      )]
      if (config.seal >= 0.5) {
        // Mum mühür: tıpayı ve şişe ağzını birlikte saran halka.
        stopper.push(bandGeometry(
          neckRadius * 1.36, half - config.height * 0.035, config.height * 0.055,
          neckRadius * 0.24, 8, tint('charHot', -0.1, 0.6), { inner: true },
        ))
      }

      return {
        bottle: { slot: 'glass' as const, geometry: mergeColoured([bottle]) },
        liquid: liquid ? { slot: 'ember' as const, geometry: liquid } : undefined,
        stopper: {
          slot: 'oak' as const,
          geometry: mergeColoured([stopper[0]!]),
          ...(stopper.length > 1
            ? { extras: [{ slot: 'char' as const, geometry: mergeColoured(stopper.slice(1)) }] }
            : {}),
        },
      }
    },
  }, overrides)
}
