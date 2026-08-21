/**
 * @medieval-kit/tavern-sign
 *
 * Duvara tutturulmuş dövme demir kolun ucunda sallanan tahta tabela.
 *
 * Okuma yazma nadir olduğu için dönemin tabelası YAZI değil RESİM taşırdı:
 * çelenk şarapçıyı, çizme kunduracıyı, havan eczacıyı gösterirdi. Bu yüzden
 * model panonun kendisini veriyor, üstündeki işareti değil — tüketici
 * `parts.board.anchor`'a ne isterse takar. Protokolün semantik parça fikri
 * tam olarak bu işe yarıyor.
 *
 * Sallanma çanınkinden farklı bir sarkaç: burada geri çağırma kuvveti yerçekimi
 * değil, iki halkanın sürtünmesi. Yani duran bir tabela hep DÜZ durur ama
 * itildiğinde uzun süre salınır. Çanın sert, hızlı sönümlemesinin yanına
 * konduğunda ikisinin farkı hemen okunuyor.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  bendGeometry,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
} from '../core/index.ts'

export interface TavernSignConfig {
  /** Pano genişliği (metre). */
  readonly width: number
  /** Pano yüksekliği (metre). */
  readonly height: number
  /** Kolun duvardan çıkıntısı (metre). */
  readonly reach: number
  /** Askı zincirinin boyu (metre). */
  readonly drop: number
  /** Tahta sayısı. */
  readonly plankCount: number
  /** Sallanmanın sönümlenme hızı. */
  readonly damping: number
  readonly seed: number
}

export const tavernSignDefaults: TavernSignConfig = {
  width: 0.54,
  height: 0.38,
  reach: 0.62,
  drop: 0.12,
  plankCount: 3,
  damping: 0.42,
  seed: 73,
}

// Zincirler ayrı bir parça DEĞİL: panoyla birlikte sallanmak zorundalar,
// dolayısıyla onun `extras` gövdesi olarak yaşıyorlar.
export type TavernSignParts = 'bracket' | 'board'

export interface TavernSignActions {
  /** Tabelayı iter: rüzgâr ya da kapıdan çıkan biri. */
  push(strength?: number): void
  still(): void
  /** Anlık salınım açısı (radyan). */
  lean(): number
}

export function createModel(overrides: Partial<TavernSignConfig> = {}) {
  let angle = 0
  let velocity = 0

  return createKitModel<TavernSignConfig, 'oak' | 'iron', TavernSignParts, TavernSignActions>({
    id: 'tavern-sign',
    defaults: tavernSignDefaults,
    slots: ['oak', 'iron'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const bar = config.reach * 0.035
      // Dönme ekseni: zincirlerin koldan çıktığı hat. Pano ve zincirler bu
      // noktaya GÖRE yazılıyor.
      const pivotY = config.height * 0.5 + config.drop
      const armY = pivotY
      const hangX = config.width * 0.4

      // --- Kol ---------------------------------------------------------------
      // Duvara sıfır Z'de oturuyor, +Z yönüne uzanıyor.
      const iron: BufferGeometry[] = []
      iron.push(boxGeometry(
        [bar * 4.4, config.height * 0.9, bar * 1.6],
        [0, armY - config.height * 0.1, bar * 0.4],
        tint('iron', -0.05, 0.7),
      ))
      // Yatay kol.
      iron.push(boxGeometry(
        [bar * 1.5, bar * 1.7, config.reach],
        [0, armY + bar * 0.5, config.reach / 2],
        tint('iron', 0.02, 0.7),
      ))
      // Payanda: kolu duvara bağlayan eğri destek. Onsuz kol havada duruyor
      // gibi görünüyor ve gözün "bu nasıl taşınıyor" sorusu cevapsız kalıyor.
      const braceLength = config.reach * 0.72
      const brace = boxGeometry(
        [bar * 1.1, braceLength, bar * 1.1],
        [0, braceLength / 2, 0],
        tint('iron', -0.02, 0.7),
      )
      bendGeometry(brace, -1.15 / braceLength)
      brace.rotateX(Math.PI / 4)
      brace.translate(0, armY - config.height * 0.42, bar)
      iron.push(brace)
      // Kolun ucundaki kıvrım: dövme demirin imzası.
      const curl = boxGeometry(
        [bar * 0.9, config.reach * 0.3, bar * 0.9],
        [0, config.reach * 0.15, 0],
        tint('iron', 0.06, 0.7),
      )
      bendGeometry(curl, 5.2 / (config.reach * 0.3))
      curl.rotateX(Math.PI / 2)
      curl.translate(0, armY + bar * 0.5, config.reach)
      iron.push(curl)

      // --- Zincirler ------------------------------------------------------------
      // Panoyla BİRLİKTE sallanmak zorundalar, o yüzden panonun `extras`
      // gövdesi. Ayrı parça olsalardı pano sallanırken zincir dimdik kalırdı.
      const links: BufferGeometry[] = []
      for (const side of [-1, 1]) {
        const count = 3
        for (let i = 0; i < count; i += 1) {
          const y = -config.drop * ((i + 0.5) / count)
          const ring = bandGeometry(config.drop * 0.16, 0, bar * 0.6, bar * 0.35, 6,
            tint('iron', jitter(random, 0.05), 0.7), { inner: true })
          // Ardışık halkalar dik açıyla geçmeli — zincir budur.
          ring.rotateX(i % 2 === 0 ? Math.PI / 2 : 0)
          ring.rotateZ(i % 2 === 0 ? 0 : Math.PI / 2)
          ring.translate(side * hangX, y, config.reach * 0.86 * (side === 0 ? 1 : 1))
          links.push(ring)
        }
      }

      // --- Pano ------------------------------------------------------------------
      const planks = Math.max(1, Math.round(config.plankCount))
      const plankHeight = config.height / planks
      const board: BufferGeometry[] = []
      for (let i = 0; i < planks; i += 1) {
        const y = -config.drop - config.height + plankHeight * (i + 0.5)
        board.push(chamferedBoxGeometry(
          [config.width, config.height * 0.055],
          [config.width * 0.997, config.height * 0.05],
          plankHeight * 0.94,
          config.height * 0.012,
          [0, y, config.reach * 0.86],
          tint('oak', jitter(random, 0.05)),
        ))
      }
      // Arkadaki iki çıta: tahtaları birbirine bağlayan şey. Tahtaların İÇİNE
      // giriyorlar ki hiçbir yüz aynı düzleme oturmasın.
      for (const side of [-1, 1]) {
        board.push(boxGeometry(
          [config.width * 0.07, config.height * 0.94, config.height * 0.045],
          [side * config.width * 0.36, -config.drop - config.height / 2, config.reach * 0.86 - config.height * 0.045],
          tint('oak', -0.09),
        ))
      }
      // Panoyu zincire bağlayan iki demir kulak.
      for (const side of [-1, 1]) {
        links.push(boxGeometry(
          [bar * 1.2, config.drop * 0.4, bar * 1.4],
          [side * hangX, -config.drop - config.drop * 0.06, config.reach * 0.86],
          tint('iron', 0.04, 0.7),
        ))
      }

      return {
        bracket: { slot: 'iron' as const, geometry: mergeColoured(iron) },
        board: {
          slot: 'oak' as const,
          geometry: mergeColoured(board),
          origin: [0, pivotY, 0] as const,
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(links) }],
        },
      }
    },

    actions: ({ parts }) => {
      parts.board.anchor.rotation.x = angle
      return {
        push: (strength = 1) => {
          // Mevcut hareketi güçlendiriyor, sıfırlamıyor: art arda gelen
          // itmeler gerçek bir rüzgâr gibi birikmeli.
          velocity += (velocity >= 0 ? 1 : -1) * 1.6 * strength
        },
        still: () => { angle = 0; velocity = 0; parts.board.anchor.rotation.x = 0 },
        lean: () => angle,
      }
    },

    update: (dt, { parts, getConfig }) => {
      const step = Math.min(0.05, Math.max(0, dt))
      if (step === 0) return
      if (Math.abs(angle) < 1e-5 && Math.abs(velocity) < 1e-5) return
      // Çandan daha YUMUŞAK bir sarkaç: geri çağırma zayıf, sönümleme az.
      // Ağır bir panonun uzun ve tembel salınımı böyle görünüyor.
      velocity += -angle * 11 * step - velocity * getConfig().damping * step
      angle += velocity * step
      // Sınır: pano kola çarpmadan önce durmalı.
      const limit = 0.55
      if (Math.abs(angle) > limit) {
        angle = Math.sign(angle) * limit
        velocity *= -0.4
      }
      parts.board.anchor.rotation.x = angle
    },
  }, overrides)
}
