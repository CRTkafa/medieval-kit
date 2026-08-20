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
import { Color, Group, Mesh, type BufferGeometry, type Material } from 'three'

import type { ConfigureResult, MaterialBindings, ModelInstance, PartHandle } from '@vibe3d/model.ts'
import { ResourceScope } from '@vibe3d/ownership.ts'

import {
  MEDIEVAL_PALETTE,
  boxGeometry,
  createMedievalMaterials,
  createPart,
  createRandom,
  jitter,
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

export interface WoodenCrateParts {
  /** Köşe dikmeleri. */
  readonly posts: PartHandle<Group>
  /** Yan, üst ve alt tahtalar. */
  readonly planks: PartHandle<Group>
  /** Demir kayışlar. */
  readonly straps: PartHandle<Group>
}

const SLOTS = ['oak', 'iron'] as const
type Slot = (typeof SLOTS)[number]

export function createModel(
  overrides: Partial<WoodenCrateConfig> = {},
): ModelInstance<WoodenCrateConfig, WoodenCrateParts> {
  let config: WoodenCrateConfig = { ...woodenCrateDefaults, ...overrides }

  const scope = new ResourceScope()
  const defaults = createMedievalMaterials(scope, SLOTS)
  const overridesBySlot = new Map<Slot, Material>()
  const resolve = (slot: Slot): Material => overridesBySlot.get(slot) ?? defaults[slot]

  const root = new Group()
  root.name = 'wooden-crate'
  const posts = createPart('wooden-crate/posts')
  const planks = createPart('wooden-crate/planks')
  const straps = createPart('wooden-crate/straps')
  root.add(posts.anchor, planks.anchor, straps.anchor)

  let owned: BufferGeometry[] = []

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
      pieces.push(boxGeometry([post, reach * 2, post], [sx * x, 0, sz * z], tint))
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
        pieces.push(boxGeometry([spanX, rowHeight, board], [0, y, side * faceZ], tint))

        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), jitter(random, 0.06))
        pieces.push(boxGeometry([board, rowHeight, spanZ], [side * faceX, y, 0], tint))
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
        pieces.push(boxGeometry(
          [slabWidth, board, boardDepth],
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
        boxGeometry([config.width + proud * 2, bandHeight, proud], [0, y, config.depth / 2], tint),
        boxGeometry([config.width + proud * 2, bandHeight, proud], [0, y, -config.depth / 2], tint),
        boxGeometry([proud, bandHeight, config.depth - proud], [config.width / 2, y, 0], tint),
        boxGeometry([proud, bandHeight, config.depth - proud], [-config.width / 2, y, 0], tint),
      )
    }

    return mergeColoured(pieces)
  }

  function attach(target: Group, geometry: BufferGeometry | undefined, part: string, slot: Slot): void {
    if (!geometry) return
    owned.push(geometry)
    const mesh = new Mesh(geometry, resolve(slot))
    mesh.name = `wooden-crate/${part}`
    mesh.userData.vibe3d = { model: '@medieval-kit/wooden-crate', part, materialSlot: slot }
    target.add(mesh)
  }

  function build(): void {
    for (const geometry of owned) geometry.dispose()
    owned = []
    // reset() sadece üretilmiş içeriği değiştirir; anchor ve ona takılanlar kalır.
    const random = createRandom(config.seed)
    attach(posts.reset(), buildPosts(random), 'posts', 'oak')
    attach(planks.reset(), buildPlanks(random), 'planks', 'oak')
    attach(straps.reset(), buildStraps(random), 'straps', 'iron')
  }

  build()

  const materials: MaterialBindings = {
    get: (slot) => (SLOTS.includes(slot as Slot) ? resolve(slot as Slot) : undefined),
    override: (slot, material) => {
      if (!SLOTS.includes(slot as Slot)) return
      overridesBySlot.set(slot as Slot, material)
      build()
    },
    reset: (slot) => {
      if (!overridesBySlot.delete(slot as Slot)) return
      build()
    },
  }

  return {
    root,
    parts: { posts, planks, straps },
    actions: {},
    materials,
    getConfig: () => config,
    configure: (patch): ConfigureResult => {
      const next = { ...config, ...patch }
      const changed = (Object.keys(next) as Array<keyof WoodenCrateConfig>)
        .some((keyName) => next[keyName] !== config[keyName])
      if (!changed) return { rebuilt: false }
      config = next
      build()
      return { rebuilt: true }
    },
    update: () => undefined,
    dispose: () => {
      for (const geometry of owned) geometry.dispose()
      owned = []
      posts.reset()
      planks.reset()
      straps.reset()
      scope.dispose()
    },
  }
}
