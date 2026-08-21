/**
 * @medieval-kit/cart-wheel
 *
 * Fıçıdan sonra en ikonik ortaçağ nesnesi. Tek başına da kullanılır — duvara
 * yaslanmış bir tekerlek bir sahneyi anında köy yapar.
 *
 * Gerçek yapımı dıştan içe dört katman: demir bandaj, ahşap ispit (felloe),
 * parmaklar, göbek. İspit tek parça değil, düz parçalardan kurulur — yani
 * lowpoly çokgen jant burada bir basitleştirme değil, doğru inşa.
 *
 * Tekerlek XY düzleminde duruyor; ekseni Z. Yatırmak isteyen `root.rotation.x`
 * ile çevirir.
 */
import { Color, type BufferGeometry } from 'three'

import {
  MEDIEVAL_PALETTE,
  chamferedBoxGeometry,
  createKitModel,
  jitter,
  latheGeometry,
  mergeColoured,
  type Level,
} from '../core/index.ts'

export interface CartWheelConfig {
  /** Dış yarıçap, demir bandaj dâhil (metre). */
  readonly radius: number
  /** Parmak sayısı. İspit parça sayısı da buna bağlı. */
  readonly spokeCount: number
  /** Tekerlek kalınlığı (metre). */
  readonly width: number
  /** Göbeğin uzunluğu, kalınlığın katı olarak. */
  readonly hubLength: number
  /** Demir bandaj kalınlığı, yarıçapın oranı olarak. */
  readonly tyre: number
  readonly seed: number
}

export const cartWheelDefaults: CartWheelConfig = {
  radius: 0.52,
  spokeCount: 10,
  width: 0.09,
  hubLength: 2.1,
  tyre: 0.045,
  seed: 27,
}

export type CartWheelParts = 'hub' | 'spokes' | 'felloe' | 'tyre'

export function createModel(overrides: Partial<CartWheelConfig> = {}) {
  return createKitModel<CartWheelConfig, 'oak' | 'iron', CartWheelParts>({
    id: 'cart-wheel',
    defaults: cartWheelDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      const tint = new Color()
      const oak = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.05))
        return tint
      }
      const iron = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.iron)
        tint.offsetHSL(0, jitter(random, 0.02), lift + jitter(random, 0.05))
        return tint
      }

      const spokes = Math.max(4, config.spokeCount)
      const tyreThickness = config.radius * config.tyre
      const felloeOuter = config.radius - tyreThickness
      const felloeInner = felloeOuter * 0.82
      const hubRadius = config.radius * 0.17
      const hubLength = config.width * config.hubLength

      // --- göbek: iki ucu pahlı, ortası şişkin tornalanmış kütük ---
      const hubProfile: Level[] = [
        { y: -hubLength / 2, radius: hubRadius * 0.68 },
        { y: -hubLength / 2 + hubLength * 0.1, radius: hubRadius * 0.92 },
        { y: -hubLength * 0.16, radius: hubRadius },
        { y: hubLength * 0.16, radius: hubRadius },
        { y: hubLength / 2 - hubLength * 0.1, radius: hubRadius * 0.92 },
        { y: hubLength / 2, radius: hubRadius * 0.68 },
      ]
      const hub = latheGeometry(hubProfile, 8, [0, 0, 0], oak(-0.05), { colourTop: oak(-0.03) })
      // Göbeğin ekseni Z olmalı: tekerlek dik duruyor.
      hub.rotateX(Math.PI / 2)

      // --- parmaklar: göbekten ispite, dışa doğru incelen ---
      const spokePieces: BufferGeometry[] = []
      const spokeLength = felloeInner - hubRadius * 0.6
      for (let i = 0; i < spokes; i += 1) {
        const angle = (i / spokes) * Math.PI * 2
        const spoke = chamferedBoxGeometry(
          [config.width * 0.42, config.width * 0.5],
          [config.width * 0.3, config.width * 0.38],
          spokeLength,
          config.width * 0.07,
          [0, spokeLength / 2 + hubRadius * 0.6, 0],
          oak(),
        )
        // Elle yontulmuş parmak tam ortalanmaz; küçük bir sapma veriyoruz.
        spoke.rotateZ(angle + jitter(random, 0.012))
        spokePieces.push(spoke)
      }

      // --- ispit: düz ahşap parçalardan kurulu çokgen jant ---
      const felloePieces: BufferGeometry[] = []
      const segments = spokes
      const step = (Math.PI * 2) / segments
      // Kiriş uzunluğu: komşu iki köşe arasındaki mesafe. Parçalar birbirine
      // GİRSİN diye biraz fazla uzun, uç uca değil.
      const chord = 2 * felloeOuter * Math.sin(step / 2) * 1.03
      const midRadius = (felloeOuter + felloeInner) / 2
      for (let i = 0; i < segments; i += 1) {
        const angle = (i + 0.5) * step
        // Her parça kendi kalınlığında. Bu hem doğru (elle kesilmiş ispit
        // parçaları eşit olmaz) hem de zorunlu: hepsi tam aynı kalınlıkta
        // olsaydı yan yüzleri aynı düzlemde olur ve bindirdikleri yerde
        // z-fighting yaparlardı.
        const thickness = config.width * (1 + jitter(random, 0.07))
        const piece = chamferedBoxGeometry(
          [chord, thickness],
          [chord, thickness],
          felloeOuter - felloeInner,
          config.width * 0.09,
          [0, 0, 0],
          oak(0.03),
        )
        // Parça origin'de kuruluyor: X = teğet (kiriş boyu), Y = radyal
        // kalınlık, Z = tekerlek kalınlığı. Yani angle=0 için zaten doğru
        // yönde. Yarıçapa taşıyıp tek bir dönüşle yerine götürmek yeterli —
        // araya fazladan çevirme koymak parçaların bir kısmını birbirine
        // paralel hâle getiriyor ve uç yüzleri çakışıyordu.
        piece.translate(0, midRadius, 0)
        piece.rotateZ(angle)
        felloePieces.push(piece)
      }

      // --- demir bandaj: ispiti çevreleyen tek parça çember ---
      const tyre = latheGeometry([
        { y: -config.width / 2, radius: config.radius },
        { y: -config.width / 2 + tyreThickness * 0.3, radius: config.radius + tyreThickness * 0.06 },
        { y: config.width / 2 - tyreThickness * 0.3, radius: config.radius + tyreThickness * 0.06 },
        { y: config.width / 2, radius: config.radius },
      ], segments, [0, 0, 0], iron(), { capTop: false, capBottom: false })
      const tyreInner = latheGeometry([
        { y: -config.width / 2, radius: felloeOuter * 0.995 },
        { y: config.width / 2, radius: felloeOuter * 0.995 },
      ], segments, [0, 0, 0], iron(-0.04), { capTop: false, capBottom: false })
      const tyreRings = mergeColoured([tyre, tyreInner])
      tyreRings.rotateX(Math.PI / 2)

      return {
        hub: { slot: 'oak', geometry: hub },
        spokes: { slot: 'oak', geometry: mergeColoured(spokePieces) },
        felloe: { slot: 'oak', geometry: mergeColoured(felloePieces) },
        tyre: { slot: 'iron', geometry: tyreRings },
      }
    },
  }, overrides)
}
