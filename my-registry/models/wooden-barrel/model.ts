/**
 * @medieval-kit/wooden-barrel
 *
 * Gerçek bir fıçı tek parça değildir: uçlara doğru daralan ayrı tahtalardan
 * (stave) kurulur, demir çemberlerle sıkıştırılır, kapağı gövdenin içine
 * gömülür ve tahtalar kapağın üstünde bir bilezik (chime) bırakır. Bu model
 * onu böyle kuruyor — şişirilmiş bir silindir olarak değil.
 *
 * Bağımlılıklar: düz `three` ve `@medieval-kit/core`. scifi-kit'in
 * primitive/aşınma boru hattına hiç dokunmuyor; WebGL yeterli.
 */
import { Color, Group, Mesh, type BufferGeometry, type Material } from 'three'

import type { ConfigureResult, MaterialBindings, ModelInstance, PartHandle } from '@vibe3d/model.ts'
import { ResourceScope } from '@vibe3d/ownership.ts'

import {
  MEDIEVAL_PALETTE,
  bandGeometry,
  createMedievalMaterials,
  createPart,
  createRandom,
  headGeometry,
  jitter,
  mergeColoured,
  staveGeometry,
  type Level,
} from '../core/index.ts'

export interface WoodenBarrelConfig {
  /** Toplam yükseklik (metre). */
  readonly height: number
  /** Göbekteki (bilge) dış yarıçap (metre). */
  readonly radius: number
  /** Uçların göbeğe göre ne kadar daraldığı. 0.16 = uçlar %84 genişlikte. */
  readonly taper: number
  /** Tahta sayısı. Tek sayı, mükemmel simetriyi kırdığı için varsayılan. */
  readonly staveCount: number
  /** Demir çember sayısı. */
  readonly hoopCount: number
  /** Varyasyon tohumu. Aynı tohum her zaman aynı fıçıyı verir. */
  readonly seed: number
}

export const woodenBarrelDefaults: WoodenBarrelConfig = {
  height: 1.04,
  radius: 0.41,
  taper: 0.17,
  staveCount: 13,
  hoopCount: 4,
  seed: 7,
}

export interface WoodenBarrelParts {
  /** Duvar tahtaları. */
  readonly staves: PartHandle<Group>
  /** Üst ve alt kapaklar. */
  readonly heads: PartHandle<Group>
  /** Demir çemberler. */
  readonly hoops: PartHandle<Group>
}

const SLOTS = ['oak', 'iron'] as const
type Slot = (typeof SLOTS)[number]

/** Fıçı profili: t ∈ [-1,1], uçlarda dar, göbekte geniş. */
function profileAt(t: number, taper: number): number {
  return 1 - taper * t * t
}

/**
 * Çemberler uçtan içe doğru simetrik yerleşir: en dıştakiler "chime" (uç)
 * çemberi, içtekiler "bilge" (göbek) çemberi.
 */
function hoopPositions(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  const outer = 0.87
  const inner = count <= 2 ? 0.87 : 0.33
  const pairs = Math.floor(count / 2)
  const positions: number[] = []
  for (let i = 0; i < pairs; i += 1) {
    const t = pairs === 1 ? outer : outer - (outer - inner) * (i / (pairs - 1))
    positions.push(t, -t)
  }
  if (count % 2 === 1) positions.push(0)
  return positions
}

export function createModel(
  overrides: Partial<WoodenBarrelConfig> = {},
): ModelInstance<WoodenBarrelConfig, WoodenBarrelParts> {
  let config: WoodenBarrelConfig = { ...woodenBarrelDefaults, ...overrides }

  // Modelin sahip olduğu kaynaklar. Tüketicinin verdiği materyaller buraya
  // girmez, dolayısıyla dispose() onlara dokunmaz.
  const scope = new ResourceScope()
  const defaults = createMedievalMaterials(scope, SLOTS)
  const overridesBySlot = new Map<Slot, Material>()
  const resolve = (slot: Slot): Material => overridesBySlot.get(slot) ?? defaults[slot]

  // Kök ve anchor'lar modelin ömrü boyunca aynı NESNE kalır. configure() sadece
  // içlerini yeniden kurar, böylece tüketicinin anchor'a taktığı ışık, etiket
  // veya gameplay nesnesi rebuild'i atlatır.
  const root = new Group()
  root.name = 'wooden-barrel'
  const staves = createPart('wooden-barrel/staves')
  const heads = createPart('wooden-barrel/heads')
  const hoops = createPart('wooden-barrel/hoops')
  root.add(staves.anchor, heads.anchor, hoops.anchor)

  let owned: BufferGeometry[] = []

  function buildStaves(random: () => number, half: number, levels: number[]): BufferGeometry {
    const wallThickness = config.radius * 0.13
    const step = (Math.PI * 2) / config.staveCount
    // Tahtalar arasında ince bir boşluk — "tek parça" değil "monte edilmiş"
    // okunmasını sağlayan tek detay bu.
    const gap = step * 0.055
    const tint = new Color()
    const pieces: BufferGeometry[] = []

    for (let index = 0; index < config.staveCount; index += 1) {
      // Her tahta kendi ufak sapmalarını taşır: yarıçap, uç yüksekliği, ton.
      // Mükemmel tekrar "üretilmiş" gibi okunur; kural: aynaları kır.
      const radiusBias = 1 + jitter(random, 0.014)
      const topBias = jitter(random, 0.006)
      const bottomBias = jitter(random, 0.006)

      const shaped: Level[] = levels.map((t, level) => {
        const edge = level === 0 ? bottomBias : level === levels.length - 1 ? topBias : 0
        return {
          y: t * half + edge,
          radius: config.radius * profileAt(t, config.taper) * radiusBias,
        }
      })

      tint.copy(MEDIEVAL_PALETTE.oak)
      tint.offsetHSL(jitter(random, 0.014), jitter(random, 0.05), jitter(random, 0.055))

      pieces.push(staveGeometry(
        shaped,
        index * step + gap / 2,
        (index + 1) * step - gap / 2,
        wallThickness,
        tint,
      ))
    }

    return mergeColoured(pieces)
  }

  function buildHeads(random: () => number, half: number): BufferGeometry {
    const wallThickness = config.radius * 0.13
    const endRadius = config.radius * profileAt(1, config.taper)
    // Kapak gövdenin İÇİNE oturur ve uçtan biraz geride kalır; tahtaların
    // üstte bıraktığı bilezik (chime) fıçıyı fıçı yapan siluet detayı.
    const seatRadius = endRadius - wallThickness * 0.9
    const inset = config.height * 0.055
    const tint = new Color(MEDIEVAL_PALETTE.oakEnd)
    tint.offsetHSL(0, jitter(random, 0.03), jitter(random, 0.03))

    return mergeColoured([
      headGeometry(seatRadius, half - inset, config.staveCount, 'up', tint, 3, 0.06),
      headGeometry(seatRadius, -half + inset, config.staveCount, 'down', tint, 3, 0.06),
    ])
  }

  function buildHoops(random: () => number, half: number): BufferGeometry | undefined {
    const positions = hoopPositions(config.hoopCount)
    if (positions.length === 0) return undefined

    const tint = new Color()
    const pieces: BufferGeometry[] = []

    for (const t of positions) {
      const seat = config.radius * profileAt(t, config.taper)
      // Uç çemberleri daha geniştir: en çok zorlanan yer orası.
      const bandHeight = config.height * (0.045 + 0.03 * Math.abs(t))
      tint.copy(MEDIEVAL_PALETTE.iron)
      tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.05))

      pieces.push(bandGeometry(
        seat + config.radius * 0.022,
        t * half,
        bandHeight,
        config.radius * 0.05,
        config.staveCount,
        tint,
      ))
    }

    return mergeColoured(pieces)
  }

  function build(): void {
    for (const geometry of owned) geometry.dispose()
    owned = []
    // reset() sadece üretilmiş içeriği değiştirir; anchor ve ona takılanlar kalır.
    const staveTarget = staves.reset()
    const headTarget = heads.reset()
    const hoopTarget = hoops.reset()

    const random = createRandom(config.seed)
    const half = config.height / 2
    // Beş seviye: uçlar, çeyrekler ve göbek. Lowpoly bir fıçı eğrisi için
    // yeterli; altıncı seviye siluete ölçülebilir bir şey katmıyor.
    const levels = [-1, -0.58, 0, 0.58, 1]

    const staveGeometryData = buildStaves(random, half, levels)
    owned.push(staveGeometryData)
    const staveMesh = new Mesh(staveGeometryData, resolve('oak'))
    staveMesh.name = 'wooden-barrel/staves'
    staveMesh.userData.vibe3d = { model: '@medieval-kit/wooden-barrel', part: 'staves', materialSlot: 'oak' }
    staveTarget.add(staveMesh)

    const headGeometryData = buildHeads(random, half)
    owned.push(headGeometryData)
    const headMesh = new Mesh(headGeometryData, resolve('oak'))
    headMesh.name = 'wooden-barrel/heads'
    headMesh.userData.vibe3d = { model: '@medieval-kit/wooden-barrel', part: 'heads', materialSlot: 'oak' }
    headTarget.add(headMesh)

    const hoopGeometryData = buildHoops(random, half)
    if (hoopGeometryData) {
      owned.push(hoopGeometryData)
      const hoopMesh = new Mesh(hoopGeometryData, resolve('iron'))
      hoopMesh.name = 'wooden-barrel/hoops'
      hoopMesh.userData.vibe3d = { model: '@medieval-kit/wooden-barrel', part: 'hoops', materialSlot: 'iron' }
      hoopTarget.add(hoopMesh)
    }
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
    parts: { staves, heads, hoops },
    actions: {},
    materials,
    getConfig: () => config,
    configure: (patch): ConfigureResult => {
      const next = { ...config, ...patch }
      const changed = (Object.keys(next) as Array<keyof WoodenBarrelConfig>)
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
      staves.reset()
      heads.reset()
      hoops.reset()
      // Sadece modelin kendi materyallerini siler; override edilenlere dokunmaz.
      scope.dispose()
    },
  }
}
