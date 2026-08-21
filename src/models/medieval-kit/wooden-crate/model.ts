/**
* @medieval-kit/wooden-crate
*
* Sandık, kutu değildir: dört köşe dikmesine çakılmış yatay tahta sıralarıdır.
* Aradaki ince boşluklar ve dikmelerin dışa taşması, siluete "monte edilmiş"
* okunuşunu veren şey. Bu model onu böyle kuruyor.
*
* Fıçıyla aynı core'u paylaşıyor: aynı meşe tonu, aynı deterministik
* rastgelelik, aynı vertex-renk tekniği. Yan yana koyduğunuzda aynı
* katalogdan gelmiş gibi durmalarının sebebi bu.
*/
import { Color, type BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  createRandom,
  jitter,
  MEDIEVAL_PALETTE,
  mergeColoured,
  type Vec3,
} from '../core/index.ts'

export interface WoodenCrateConfig {
  /** Genişlik (X ekseni, metre). */
  readonly width: number
  /** Yükseklik (metre). */
  readonly height: number
  /** Derinlik (Z ekseni, metre). */
  readonly depth: number
  /** Her yüzdeki yatay tahta sırası sayısı. */
  readonly plankRows: number
  /** Demir kayış sayısı. 0 = sade ahşap sandık. */
  readonly strapCount: number
  /** Varyasyon tohumu. */
  readonly seed: number
}

export const woodenCrateDefaults: WoodenCrateConfig = {
  width: 0.66,
  height: 0.52,
  depth: 0.52,
  plankRows: 3,
  strapCount: 2,
  seed: 3,
}

export type WoodenCrateParts = 'posts' | 'planks' | 'straps'

const SLOTS = ['oak', 'iron'] as const
type Slot = (typeof SLOTS)[number]

export function createModel(overrides: Partial<WoodenCrateConfig> = {}) {
  return createKitModel<WoodenCrateConfig, 'oak' | 'iron', WoodenCrateParts>({
      id: 'wooden-crate',
      defaults: woodenCrateDefaults,
      slots: SLOTS,
      build: ({ config, random }) => {
        /**
        * Ölçü sözleşmesi.
        *
        * Z-FIGHTING KURALI: hiçbir iki yüzey aynı düzlemde, aynı yöne bakarak
        * örtüşmemeli. Gerçek marangozlukta parçalar birbirine geçer; burada da öyle
        * yapıyoruz. Dikmeler tahtalardan dışarı taşıyor, kapak ve taban çerçeveden
        * biraz sarkıyor, tahtalar birbirine küt ekleniyor. Böylece her yüzey kendi
        * düzleminde tek başına.
        */
        const dims = () => {
          const post = Math.min(config.width, config.depth) * 0.11
          const board = post * 0.5
          return {
            post,
            board,
            /** Dikmelerin tahta yüzeyinden ne kadar dışarı taştığı. */
            postProud: board * 0.45,
            /** Kapak ve tabanın çerçeveden sarkması. */
            overhang: board * 0.6,
            half: config.height / 2,
          }
        }

        function buildPosts(random: () => number): BufferGeometry {
          const { post, board, half } = dims()
          const tint = new Color()
          const pieces: BufferGeometry[] = []
          const x = config.width / 2 - post / 2
          const z = config.depth / 2 - post / 2
          // Dikmeler kapak ve tabanın İÇİNE giriyor; uçları o katı parçaların
          // içinde kaldığı için görünmez ve hiçbir yüzeyle hizalanmaz.
          const reach = half - board * 0.3

          for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
            tint.copy(MEDIEVAL_PALETTE.oak)
            // Dikmeler gövdeden biraz daha koyu: farklı kesim, daha çok yıpranma.
            tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), -0.045 + jitter(random, 0.02))
            pieces.push(chamferedBoxGeometry(
                [post, post], [post, post], reach * 2,
                board * 0.16, [sx * x, 0, sz * z], tint,
            ))
          }

          return mergeColoured(pieces)
        }

        function buildPlanks(random: () => number): BufferGeometry {
          const { board, postProud, overhang, half } = dims()
          const tint = new Color()
          const pieces: BufferGeometry[] = []

          // Yan tahtalar dikmelerin ARKASINA çekili: dış yüzleri ±width/2 değil,
          // ±(width/2 - postProud). Dikmelerle aynı düzleme oturmamalarının sebebi bu.
          const faceX = config.width / 2 - postProud - board / 2
          const faceZ = config.depth / 2 - postProud - board / 2
          // Küt ek (butt joint): ön/arka tahtalar yan tahtaların iç yüzüne dayanır.
          // Değiyorlar ama örtüşmüyorlar — kenar teması z-fighting üretmez.
          const spanX = (config.width / 2 - postProud - board) * 2
          const spanZ = (config.depth / 2 - postProud - board) * 2

          // Sıralar kapak ve tabanın içine girecek kadar uzanıyor, ama dikmelerin
          // uçlarından FARKLI bir yükseklikte bitiyor.
          const wallTop = half - board * 0.65
          const rows = Math.max(1, config.plankRows)
          const gap = config.height * 0.012
          const rowHeight = (wallTop * 2 - gap * (rows - 1)) / rows

          for (let row = 0; row < rows; row += 1) {
            const y = -wallTop + rowHeight / 2 + row * (rowHeight + gap)
            for (const side of [-1, 1] as const) {
              tint.copy(MEDIEVAL_PALETTE.oak)
              tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), jitter(random, 0.06))
              pieces.push(chamferedBoxGeometry(
                  [spanX, board], [spanX, board], rowHeight,
                  board * 0.16, [0, y, side * faceZ], tint,
              ))

              tint.copy(MEDIEVAL_PALETTE.oak)
              tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), jitter(random, 0.06))
              pieces.push(chamferedBoxGeometry(
                  [board, spanZ], [board, spanZ], rowHeight,
                  board * 0.16, [side * faceX, y, 0], tint,
              ))
            }
          }

          // Kapak ve taban: çerçevenin üstüne/altına oturan, biraz sarkan tahta
          // levhalar. Sarkma sayesinde yan yüzleri dikmelerin yüzleriyle hizalanmıyor.
          const slabWidth = config.width + overhang * 2
          const slabDepth = config.depth + overhang * 2
          const slabBoards = 3
          const slabGap = slabDepth * 0.014
          const boardDepth = (slabDepth - slabGap * (slabBoards - 1)) / slabBoards

          for (const [y, shade] of [[half - board / 2, 0.03], [-half + board / 2, -0.05]] as const) {
            for (let i = 0; i < slabBoards; i += 1) {
              tint.copy(MEDIEVAL_PALETTE.oakEnd)
              tint.offsetHSL(jitter(random, 0.01), jitter(random, 0.04), shade + jitter(random, 0.05))
              pieces.push(chamferedBoxGeometry(
                  [slabWidth, boardDepth],
                  [slabWidth, boardDepth],
                  board,
                  board * 0.16,
                  [0, y, -slabDepth / 2 + boardDepth / 2 + i * (boardDepth + slabGap)],
                  tint,
              ))
            }
          }

          return mergeColoured(pieces)
        }

        function buildStraps(random: () => number): BufferGeometry | undefined {
          if (config.strapCount <= 0) return undefined

          const { post } = dims()
          const tint = new Color()
          const pieces: BufferGeometry[] = []
          const bandHeight = config.height * 0.07
          const proud = post * 0.3

          for (let i = 0; i < config.strapCount; i += 1) {
            // Kayışlar üstten ve alttan içe doğru simetrik yerleşir.
            const t = config.strapCount === 1
            ? 0
            : 0.6 - (1.2 * i) / (config.strapCount - 1)
            const y = (t * config.height) / 2
            tint.copy(MEDIEVAL_PALETTE.iron)
            tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.06))

            // Ön/arka kayışlar köşelerde dışa taşıyor; yan kayışlar onlara VARMADAN
            // bitiyor. Böylece dört parçanın üst yüzleri köşede üst üste binmiyor.
            pieces.push(
              chamferedBoxGeometry([config.width + proud * 2, proud], [config.width + proud * 2, proud], bandHeight, proud * 0.22, [0, y, config.depth / 2], tint),
              chamferedBoxGeometry([config.width + proud * 2, proud], [config.width + proud * 2, proud], bandHeight, proud * 0.22, [0, y, -config.depth / 2], tint),
              chamferedBoxGeometry([proud, config.depth - proud], [proud, config.depth - proud], bandHeight, proud * 0.22, [config.width / 2, y, 0], tint),
              chamferedBoxGeometry([proud, config.depth - proud], [proud, config.depth - proud], bandHeight, proud * 0.22, [-config.width / 2, y, 0], tint),
            )
          }

          return mergeColoured(pieces)
        }

        // Çağrı SIRASI korunmalı: tohuma bağlı rastgelelik akış hâlinde
        // ilerliyor, sıra değişirse geometri de değişir.
        const postsPart = buildPosts(random)
        const planksPart = buildPlanks(random)
        const strapsPart = buildStraps(random)

        return {
          posts: { slot: 'oak' as const, geometry: postsPart },
          planks: { slot: 'oak' as const, geometry: planksPart },
          straps: strapsPart ? { slot: 'iron' as const, geometry: strapsPart } : undefined,
        }
      },
    }, overrides)
}
