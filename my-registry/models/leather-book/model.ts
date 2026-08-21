/**
 * @medieval-kit/leather-book
 *
 * Deri kaplı, tokalı el yazması. Masa, raf, sandık içi, kürsü.
 *
 * Modelin bütün meselesi SAYFA YIĞINI. Kitabı kitap yapan şey kapağı değil,
 * kapaktan taşan ve düzgün olmayan kâğıt kütlesi. Onu düz bir kutu olarak
 * vermek, kapağı ne kadar iyi yaparsan yap, tuğla gibi duruyor.
 *
 * İki dönem ayrıntısı geometriye yön verdi:
 *
 *   - Sayfalar KÂĞIT DEĞİL tirşe (parşömen), yani hayvan derisi. Bu yüzden
 *     kalın, sararmış ve dalgalı. `roughenGeometry` yığının kenarına o
 *     dalgalanmayı veriyor.
 *   - Kitap kapalı DURMAZ: tirşe nemi çekip kabarır. Bu yüzden gerçek el
 *     yazmalarında toka vardır — süs değil, işlev. Toka olmadan model
 *     dönemsizleşiyor.
 */
import type { BufferGeometry } from 'three'

import {
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  roughenGeometry,
} from '../core/index.ts'

export interface LeatherBookConfig {
  /** Kapak genişliği (metre). */
  readonly width: number
  /** Kapak boyu (metre). */
  readonly length: number
  /** Kapalı kitabın toplam kalınlığı (metre). */
  readonly thickness: number
  /** Sırttaki kabartma bant sayısı. */
  readonly bands: number
  /** Toka sayısı. */
  readonly clasps: number
  readonly seed: number
}

export const leatherBookDefaults: LeatherBookConfig = {
  width: 0.19,
  length: 0.27,
  thickness: 0.062,
  bands: 3,
  clasps: 1,
  seed: 79,
}

export type LeatherBookParts = 'cover' | 'pages' | 'clasps'

export function createModel(overrides: Partial<LeatherBookConfig> = {}) {
  return createKitModel<LeatherBookConfig, 'leather' | 'cloth' | 'brass', LeatherBookParts>({
    id: 'leather-book',
    defaults: leatherBookDefaults,
    slots: ['leather', 'cloth', 'brass'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.thickness / 2
      const boardThickness = config.thickness * 0.11
      const halfWidth = config.width / 2
      const spineX = -halfWidth

      // --- Kapaklar ----------------------------------------------------------
      // Sadece iki tahta değil: sırt onları saran tek parça deri. O yüzden
      // sırt, kapakların yan yüzeyleriyle aynı düzlemde DEĞİL, onları biraz
      // aşıyor — hem gerçek ciltçilik hem de eş düzlem yüzden kaçınma.
      const cover: BufferGeometry[] = []
      for (const side of [-1, 1]) {
        cover.push(chamferedBoxGeometry(
          [config.width, config.length],
          [config.width * 0.995, config.length * 0.997],
          boardThickness,
          config.thickness * 0.035,
          [0, side * (half - boardThickness / 2), 0],
          tint('leather', side > 0 ? 0.03 : -0.03, 0.9),
        ))
      }

      // Sırt: kapakları saran, dışa doğru kavisli deri.
      const spine = chamferedBoxGeometry(
        [config.thickness * 1.06, config.length * 1.01],
        [config.thickness * 1.06, config.length * 1.01],
        config.width * 0.1,
        config.thickness * 0.05,
        [0, 0, 0],
        tint('leather', -0.06, 0.9),
      )
      // Dikey kutu olarak kurulup yatırılıyor: SIRA önemli, orijinde döndür,
      // sonra taşı.
      spine.rotateZ(Math.PI / 2)
      spine.translate(spineX + config.width * 0.03, 0, 0)
      cover.push(spine)

      // Sırt bantları: cilt dikişinin altında kalan iplerin yaptığı kabartma.
      // El yazmasını basılı kitaptan ayıran en okunur işaret bu.
      const bandCount = Math.max(0, Math.round(config.bands))
      for (let i = 0; i < bandCount; i += 1) {
        const t = (i + 1) / (bandCount + 1)
        const band = boxGeometry(
          [config.width * 0.09, config.thickness * 1.12, config.length * 0.055],
          [spineX + config.width * 0.03, 0, (t - 0.5) * config.length * 0.86],
          tint('leather', 0.06, 0.9),
        )
        cover.push(band)
      }

      // --- Sayfa yığını -------------------------------------------------------
      // Kapaktan üç yönde taşıyor (sırt hariç) ve kenarları düzensiz.
      const pages = chamferedBoxGeometry(
        [config.width * 1.035, config.length * 1.03],
        [config.width * 1.03, config.length * 1.025],
        config.thickness - boardThickness * 2.4,
        config.thickness * 0.02,
        [config.width * 0.018, 0, 0],
        tint('cloth', 0.09, 0.7),
      )
      // Tirşe düz değil: kenardaki dalgalanma yığını kâğıt yığını yapıyor.
      roughenGeometry(pages, config.thickness * 0.035, { salt: 31, scaleY: 0.35 })

      // --- Tokalar -------------------------------------------------------------
      const claspCount = Math.max(0, Math.round(config.clasps))
      const claspPieces: BufferGeometry[] = []
      for (let i = 0; i < claspCount; i += 1) {
        const t = claspCount === 1 ? 0.5 : 0.25 + (i / (claspCount - 1)) * 0.5
        const z = (t - 0.5) * config.length * 0.62
        // Ön yüzden kıvrılıp arkaya geçen şerit: üç parçadan kuruluyor çünkü
        // tek bir kutu kitabın kenarını saramaz.
        claspPieces.push(boxGeometry(
          [config.width * 0.2, config.thickness * 0.035, config.length * 0.075],
          [halfWidth * 0.86, half - boardThickness * 0.35, z + jitter(random, 0.002)],
          tint('brass', 0.04, 0.5),
        ))
        claspPieces.push(boxGeometry(
          [config.width * 0.045, config.thickness * 0.9, config.length * 0.07],
          [halfWidth * 1.012, 0, z],
          tint('brass', -0.02, 0.5),
        ))
        claspPieces.push(boxGeometry(
          [config.width * 0.12, config.thickness * 0.035, config.length * 0.07],
          [halfWidth * 0.92, -half + boardThickness * 0.35, z],
          tint('brass', 0.07, 0.5),
        ))
      }

      return {
        cover: { slot: 'leather' as const, geometry: mergeColoured(cover) },
        pages: { slot: 'cloth' as const, geometry: mergeColoured([pages]) },
        clasps: claspPieces.length > 0
          ? { slot: 'brass' as const, geometry: mergeColoured(claspPieces) }
          : undefined,
      }
    },
  }, overrides)
}
