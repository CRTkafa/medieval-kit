/**
 * @medieval-kit/iron-lantern
 *
 * Elde taşınan ya da bir çengele asılan demir fener: altıgen bir kafes, cam
 * paneller, içinde yağ kandili.
 *
 * Meşaleden farkı sadece biçim değil. Meşale sarf malzemesi, fener ALET —
 * pahalı, saklanan, miras kalan bir şey. Bu yüzden geometri de daha "yapılmış"
 * görünüyor: dövme köşe dikmeleri, havalandırma bacası, taşıma halkası.
 *
 * Camın iki sonucu var ve ikisi de burada görünür:
 *
 *   - `glass` yuvası SAYDAM ve `depthWrite` kapalı. Bu olmadan cam, arkasındaki
 *     fitili gizliyordu; şeffaf bir yüzey derinlik yazmamalı.
 *   - Cam paneller kafesin `extras` gövdesi. Ayrı parça yapmak mantıklı
 *     gelmişti ama yanlış: kafes ile cam TEK ANLAM — biri hareket ederse
 *     diğeri de eder. Bölünen şey sadece materyal.
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
  prismGeometry,
  type Level,
} from '../core/index.ts'

export interface IronLanternConfig {
  /** Gövde yüksekliği, halka hariç (metre). */
  readonly height: number
  /** Kafesin köşeden köşeye yarıçapı (metre). */
  readonly radius: number
  /** Kaç köşe. 4 fener, 6 daha zengin. */
  readonly sides: number
  /** Alev boyu, gövde yüksekliğinin oranı olarak. */
  readonly flameHeight: number
  /** Titremenin genliği. 0 = sabit alev. */
  readonly flicker: number
  readonly seed: number
}

export const ironLanternDefaults: IronLanternConfig = {
  height: 0.26,
  radius: 0.075,
  sides: 6,
  flameHeight: 0.22,
  flicker: 1,
  seed: 71,
}

export type IronLanternParts = 'frame' | 'font' | 'flame' | 'handle'

export interface IronLanternActions {
  setLit(lit: boolean): void
  isLit(): boolean
}

export function createModel(overrides: Partial<IronLanternConfig> = {}) {
  let lit = true
  let elapsed = 0

  return createKitModel<IronLanternConfig, 'iron' | 'glass' | 'char' | 'ember', IronLanternParts, IronLanternActions>({
    id: 'iron-lantern',
    defaults: ironLanternDefaults,
    slots: ['iron', 'glass', 'char', 'ember'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      const sides = Math.max(3, Math.round(config.sides))
      const bar = config.radius * 0.13
      // Camlı bölüm gövdenin ortası: altta yağ haznesi, üstte baca için yer.
      const glassBottom = -half + config.height * 0.2
      const glassTop = half - config.height * 0.26

      // --- Kafes -------------------------------------------------------------
      const iron: BufferGeometry[] = []

      // Taban tabağı ve tepe şapkası: ikisi de altıgen, biri düz biri konik.
      iron.push(prismGeometry(
        config.radius * 1.08, config.radius, config.height * 0.11, sides,
        [0, -half + config.height * 0.055, 0], tint('iron', -0.04, 0.7),
      ))
      iron.push(prismGeometry(
        config.radius * 1.12, config.radius * 0.42, config.height * 0.19, sides,
        [0, half - config.height * 0.16, 0], tint('iron', 0.03, 0.7),
      ))
      // Baca: sıcak hava çıkmazsa alev söner. İşlevsel bir detay ve siluetin
      // tepesini feneri fener yapan şey.
      iron.push(prismGeometry(
        config.radius * 0.4, config.radius * 0.34, config.height * 0.09, sides,
        [0, half - config.height * 0.025, 0], tint('iron', 0.07, 0.7),
      ))

      // Köşe dikmeleri: cam panellerin arasında kalan dövme demir çubuklar.
      const step = (Math.PI * 2) / sides
      for (let i = 0; i < sides; i += 1) {
        const a = i * step
        const post = boxGeometry(
          [bar, glassTop - glassBottom + config.height * 0.1, bar * 1.15],
          [0, 0, 0],
          tint('iron', jitter(random, 0.05), 0.7),
        )
        // Önce yönlendir, sonra taşı — ters sıra dikmeyi yörüngeye savurur.
        post.rotateY(a)
        post.translate(
          Math.sin(a) * config.radius * 0.97,
          (glassBottom + glassTop) / 2,
          Math.cos(a) * config.radius * 0.97,
        )
        iron.push(post)
      }
      // Cam panelleri tutan alt ve üst çerçeve.
      for (const y of [glassBottom, glassTop]) {
        iron.push(bandGeometry(config.radius * 0.99, y, bar * 1.1, bar * 0.8, sides,
          tint('iron', -0.02, 0.7)))
      }

      // --- Cam -----------------------------------------------------------------
      // Paneller dikmelerden biraz İÇERİDE: aynı yarıçapta olsalardı yan
      // yüzleri dikmelerin yüzleriyle aynı düzleme oturur ve titrerdi.
      const glass = prismGeometry(
        config.radius * 0.9, config.radius * 0.9, glassTop - glassBottom, sides,
        [0, (glassBottom + glassTop) / 2, 0], tint('glass', 0.04, 0.4),
        { capTop: false, capBottom: false },
      )

      // --- Yağ haznesi ve fitil --------------------------------------------------
      const fontTop = glassBottom + config.height * 0.16
      const font = latheGeometry([
        { y: glassBottom - config.height * 0.02, radius: config.radius * 0.5 },
        { y: glassBottom + config.height * 0.06, radius: config.radius * 0.62 },
        { y: fontTop, radius: config.radius * 0.44 },
      ], sides * 2, [0, 0, 0], tint('glass', -0.05, 0.4), { capTop: true })

      const wick = prismGeometry(
        config.radius * 0.075, config.radius * 0.05, config.height * 0.09, 4,
        [0, fontTop + config.height * 0.035, 0], tint('char', 0.05),
      )

      // --- Alev --------------------------------------------------------------
      // Meşalenin alevinin küçüğü ve daha sakini: kapalı bir fenerde alev
      // rüzgâr almaz, o yüzden titremesi de daha az.
      const flameHeight = config.height * config.flameHeight
      const flameBase = fontTop + config.height * 0.07
      const flameProfile: Level[] = [
        { y: 0, radius: flameHeight * 0.2 },
        { y: flameHeight * 0.22, radius: flameHeight * 0.3 },
        { y: flameHeight * 0.58, radius: flameHeight * 0.19 },
        { y: flameHeight, radius: flameHeight * 0.03 },
      ]
      const flame = mergeColoured([
        latheGeometry(flameProfile, 6, [0, 0, 0], tint('ember', 0.06, 0.35),
          { colourTop: tint('emberTip', 0.02, 0.35) }),
      ])

      // --- Taşıma halkası ------------------------------------------------------
      const handle: BufferGeometry[] = [bandGeometry(
        config.radius * 0.3, half + config.height * 0.1, bar * 0.9, bar * 0.55, 8,
        tint('iron', 0.06, 0.7), { inner: true },
      )]
      // Halkayı bacaya bağlayan dil.
      handle.push(boxGeometry(
        [bar * 1.1, config.height * 0.1, bar],
        [0, half + config.height * 0.045, 0],
        tint('iron', 0.02, 0.7),
      ))

      return {
        frame: {
          slot: 'iron' as const,
          geometry: mergeColoured(iron),
          extras: [{ slot: 'glass' as const, geometry: mergeColoured([glass]) }],
        },
        font: {
          slot: 'glass' as const,
          geometry: mergeColoured([font]),
          extras: [{ slot: 'char' as const, geometry: mergeColoured([wick]) }],
        },
        flame: {
          slot: 'ember' as const,
          geometry: flame,
          origin: [0, flameBase, 0] as const,
        },
        handle: { slot: 'iron' as const, geometry: mergeColoured(handle) },
      }
    },

    actions: ({ parts }) => {
      parts.flame.anchor.visible = lit
      return {
        setLit: (next) => { lit = next; parts.flame.anchor.visible = next },
        isLit: () => lit,
      }
    },

    update: (dt, { parts, getConfig }) => {
      if (!lit) return
      const amount = getConfig().flicker
      if (amount === 0) return
      elapsed += Math.max(0, dt)
      // Meşaleninkinden yavaş ve küçük: cam alevi rüzgârdan koruyor.
      const pulse = Math.sin(elapsed * 6.4) * 0.06 + Math.sin(elapsed * 11.1 + 0.9) * 0.035
      const anchor = parts.flame.anchor
      anchor.scale.set(1 - pulse * 0.4 * amount, 1 + pulse * amount, 1 - pulse * 0.4 * amount)
      anchor.rotation.z = Math.sin(elapsed * 4.7 + 1.3) * 0.03 * amount
    },
  }, overrides)
}
