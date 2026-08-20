/**
 * @medieval-kit/iron-brazier
 *
 * Kitin ilk HAREKETLİ modeli. Fıçı ve sandık statik: kurulurlar ve öyle
 * kalırlar. Mangal, vibe3d protokolünün onların hiç dokunmadığı iki parçasını
 * çalıştırıyor:
 *
 *   - tipli `actions`  → yak / söndür
 *   - `update(dt)`     → alev titremesi ve ışık dalgalanması
 *
 * Ayrım önemli: `configure()` topolojiyi yeniden kurar ve pahalıdır, kullanıcı
 * ayarı içindir. Kare başına değişen her şey `update()` içinde olmalı.
 *
 * Model ayrıca bir PointLight taşıyor. Işık `flame` anchor'ına takılı, yani
 * configure() geometriyi yeniden kursa bile ışık hayatta kalıyor.
 */
import {
  Color,
  Group,
  Mesh,
  PointLight,
  type BufferGeometry,
  type Material,
} from 'three'

import type { ConfigureResult, MaterialBindings, ModelInstance, PartHandle } from '@vibe3d/model.ts'
import { ResourceScope } from '@vibe3d/ownership.ts'

import {
  MEDIEVAL_PALETTE,
  bandGeometry,
  boxGeometry,
  createMedievalMaterials,
  createPart,
  createRandom,
  flipGeometry,
  jitter,
  mergeColoured,
  prismGeometry,
} from '../core/index.ts'

export interface IronBrazierConfig {
  /** Ayak dâhil toplam yükseklik (metre). */
  readonly height: number
  /** Kâsenin üst ağız yarıçapı (metre). */
  readonly bowlRadius: number
  /** Kâse çevresindeki köşe sayısı. Düşük tut — lowpoly silueti bu belirler. */
  readonly bowlSegments: number
  /** Ayak sayısı. */
  readonly legCount: number
  /** Alev dili sayısı. 0 = alev yok, sadece kömür. */
  readonly flameCount: number
  /** Varyasyon tohumu. */
  readonly seed: number
}

export const ironBrazierDefaults: IronBrazierConfig = {
  height: 0.86,
  bowlRadius: 0.26,
  bowlSegments: 12,
  legCount: 3,
  flameCount: 5,
  seed: 11,
}

export interface IronBrazierParts {
  /** Kâse ve ağız çemberi. */
  readonly bowl: PartHandle<Group>
  /** Ayaklar ve pabuçlar. */
  readonly legs: PartHandle<Group>
  /** Sönmüş kömürler. */
  readonly coals: PartHandle<Group>
  /** Alev dilleri, kor kömürler ve ışık. Söndürülünce gizlenir. */
  readonly flame: PartHandle<Group>
}

export interface IronBrazierActions {
  /** Ateşi yakar ya da söndürür. */
  setLit(lit: boolean): void
  /** Şu anda yanıyor mu. */
  isLit(): boolean
}

const SLOTS = ['iron', 'char', 'ember'] as const
type Slot = (typeof SLOTS)[number]

interface Blade {
  readonly mesh: Group
  readonly phase: number
  readonly speed: number
  readonly reach: number
}

export function createModel(
  overrides: Partial<IronBrazierConfig> = {},
): ModelInstance<IronBrazierConfig, IronBrazierParts, IronBrazierActions> {
  let config: IronBrazierConfig = { ...ironBrazierDefaults, ...overrides }

  const scope = new ResourceScope()
  const defaults = createMedievalMaterials(scope, SLOTS)
  const overridesBySlot = new Map<Slot, Material>()
  const resolve = (slot: Slot): Material => overridesBySlot.get(slot) ?? defaults[slot]

  const root = new Group()
  root.name = 'iron-brazier'
  const bowl = createPart('iron-brazier/bowl')
  const legs = createPart('iron-brazier/legs')
  const coals = createPart('iron-brazier/coals')
  const flame = createPart('iron-brazier/flame')
  root.add(bowl.anchor, legs.anchor, coals.anchor, flame.anchor)

  // Işık ANCHOR'a takılı, üretilen içeriğe değil. Anchor rebuild'de
  // değişmediği için configure() ateşi söndürmüyor — tüketicinin kendi
  // eklediği nesneler de aynı sebeple hayatta kalıyor.
  const light = new PointLight(0xffa04d, 0, 6, 2)
  light.name = 'iron-brazier/firelight'
  flame.anchor.add(light)

  let owned: BufferGeometry[] = []
  let blades: Blade[] = []
  let lit = true
  let elapsed = 0

  /** Kâsenin üst ağzının dünya yüksekliği. */
  const bowlTop = (): number => config.height * 0.5
  const bowlDepth = (): number => config.bowlRadius * 0.78

  function buildBowl(random: () => number): BufferGeometry {
    const tint = new Color()
    const shade = (): Color => {
      tint.copy(MEDIEVAL_PALETTE.iron)
      tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.055))
      return tint
    }

    const depth = bowlDepth()
    const centreY = bowlTop() - depth / 2
    const outerBottom = config.bowlRadius * 0.56
    const wall = config.bowlRadius * 0.055

    // Dış kabuk ve iç kabuk aynı koni; içteki ters çevrilmiş, çünkü kâsenin
    // içine bakıldığında yüzeyler bize dönük olmalı.
    const outer = prismGeometry(
      outerBottom, config.bowlRadius, depth, config.bowlSegments,
      [0, centreY, 0], shade(), { capTop: false, capBottom: true },
    )
    const inner = flipGeometry(prismGeometry(
      outerBottom - wall, config.bowlRadius - wall, depth, config.bowlSegments,
      [0, centreY + wall, 0], shade(), { capTop: false, capBottom: true },
    ))
    // Ağız çemberi dış ve iç kabuğun arasındaki boşluğu kapatır ve dövme bir
    // dudak izlenimi verir.
    const rim = bandGeometry(
      config.bowlRadius + wall * 0.4, bowlTop(), wall * 2.6, wall * 1.6,
      config.bowlSegments, shade(),
    )

    return mergeColoured([outer, inner, rim])
  }

  function buildLegs(random: () => number): BufferGeometry {
    const tint = new Color()
    const pieces: BufferGeometry[] = []
    const attachY = bowlTop() - bowlDepth()
    const legLength = attachY * 1.16
    const thickness = config.bowlRadius * 0.1
    const tilt = 0.24

    for (let i = 0; i < Math.max(1, config.legCount); i += 1) {
      const angle = (i / Math.max(1, config.legCount)) * Math.PI * 2
      tint.copy(MEDIEVAL_PALETTE.iron)
      tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.05))

      // Önce origin'in ALTINA sarkan bir çubuk kur, sonra dışa yatır, sonra
      // yerine döndür. Sıra önemli: rotate her zaman origin etrafında döner.
      const leg = boxGeometry([thickness, legLength, thickness], [0, -legLength / 2, 0], tint)
      leg.rotateZ(tilt)
      leg.rotateY(angle)
      leg.translate(0, attachY, 0)
      pieces.push(leg)

      // Pabuç: ayağın yere bastığı yassı taban.
      const spread = Math.sin(tilt) * legLength
      const foot = boxGeometry(
        [thickness * 2.1, thickness * 0.7, thickness * 2.1],
        [0, 0, 0],
        tint,
      )
      foot.rotateY(angle)
      foot.translate(
        Math.sin(angle) * spread,
        attachY - Math.cos(tilt) * legLength + thickness * 0.35,
        Math.cos(angle) * spread,
      )
      pieces.push(foot)
    }

    return mergeColoured(pieces)
  }

  /** Kâsenin içine dağılmış kömür parçaları. `hot` olanlar ışıldar. */
  function coalPieces(random: () => number, hot: boolean): BufferGeometry[] {
    const tint = new Color()
    const pieces: BufferGeometry[] = []
    const floor = bowlTop() - bowlDepth() + config.bowlRadius * 0.06
    const count = hot ? 4 : 7

    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * config.bowlRadius * 0.62
      const size = config.bowlRadius * (0.13 + random() * 0.1)
      tint.copy(hot ? MEDIEVAL_PALETTE.charHot : MEDIEVAL_PALETTE.char)
      tint.offsetHSL(jitter(random, 0.02), jitter(random, 0.08), jitter(random, hot ? 0.09 : 0.05))

      const coal = boxGeometry(
        [size, size * 0.62, size * 0.86],
        [0, 0, 0],
        tint,
      )
      coal.rotateY(random() * Math.PI)
      coal.rotateX(jitter(random, 0.25))
      coal.translate(
        Math.sin(angle) * radius,
        floor + size * 0.31 + (hot ? size * 0.12 : 0),
        Math.cos(angle) * radius,
      )
      pieces.push(coal)
    }

    return pieces
  }

  /**
   * Alev dilleri. Her biri ayrı bir Group içinde, çünkü update() onları tek
   * tek ölçekleyip döndürecek — birleştirilmiş tek geometri kıpırdayamazdı.
   */
  function buildFlame(random: () => number, target: Group): { geometries: BufferGeometry[]; blades: Blade[] } {
    const geometries: BufferGeometry[] = []
    const madeBlades: Blade[] = []
    const base = bowlTop() - bowlDepth() * 0.35
    const material = resolve('ember')
    const hot = new Color()
    const tip = new Color()

    for (let i = 0; i < config.flameCount; i += 1) {
      const angle = (i / Math.max(1, config.flameCount)) * Math.PI * 2 + jitter(random, 0.4)
      const radius = config.bowlRadius * (0.1 + random() * 0.42)
      const reach = config.bowlRadius * (0.85 + random() * 1.15)
      const width = config.bowlRadius * (0.16 + random() * 0.13)

      hot.copy(MEDIEVAL_PALETTE.ember).offsetHSL(0, jitter(random, 0.04), jitter(random, 0.05))
      tip.copy(MEDIEVAL_PALETTE.emberTip).offsetHSL(jitter(random, 0.02), 0, jitter(random, 0.05))

      // Uç yarıçapı sıfır: koni. Renk dipten uca geçiş yapıyor, alevin dibi ile
      // ucu aynı renk değildir.
      const blade = prismGeometry(
        width, 0, reach, 5,
        [0, reach / 2, 0], hot,
        { capBottom: true, capTop: false, colourTop: tip },
      )
      geometries.push(blade)

      const holder = new Group()
      holder.name = `iron-brazier/flame-${i}`
      holder.position.set(Math.sin(angle) * radius, base, Math.cos(angle) * radius)
      const mesh = new Mesh(blade, material)
      mesh.name = `iron-brazier/flame-${i}/blade`
      mesh.userData.vibe3d = { model: '@medieval-kit/iron-brazier', part: 'flame', materialSlot: 'ember' }
      holder.add(mesh)
      target.add(holder)

      madeBlades.push({
        mesh: holder,
        phase: random() * Math.PI * 2,
        speed: 2.6 + random() * 2.9,
        reach,
      })
    }

    return { geometries, blades: madeBlades }
  }

  function attach(target: Group, geometry: BufferGeometry, part: string, slot: Slot): void {
    owned.push(geometry)
    const mesh = new Mesh(geometry, resolve(slot))
    mesh.name = `iron-brazier/${part}`
    mesh.userData.vibe3d = { model: '@medieval-kit/iron-brazier', part, materialSlot: slot }
    target.add(mesh)
  }

  function build(): void {
    for (const geometry of owned) geometry.dispose()
    owned = []
    blades = []
    // reset() sadece üretilmiş içeriği değiştirir; anchor'lar ve onlara
    // takılanlar (ışık dâhil) yerinde kalır.
    const random = createRandom(config.seed)
    attach(bowl.reset(), buildBowl(random), 'bowl', 'iron')
    attach(legs.reset(), buildLegs(random), 'legs', 'iron')
    attach(coals.reset(), mergeColoured(coalPieces(random, false)), 'coals', 'char')

    const flameTarget = flame.reset()
    const glowing = coalPieces(random, true)
    const built = buildFlame(random, flameTarget)
    owned.push(...built.geometries)
    blades = built.blades

    const hotCoals = mergeColoured(glowing)
    owned.push(hotCoals)
    const hotMesh = new Mesh(hotCoals, resolve('ember'))
    hotMesh.name = 'iron-brazier/hot-coals'
    hotMesh.userData.vibe3d = { model: '@medieval-kit/iron-brazier', part: 'flame', materialSlot: 'ember' }
    flameTarget.add(hotMesh)

    applyLit()
  }

  function applyLit(): void {
    // Üretilen alev içeriği content'te; ışık anchor'da. İkisi de sönmeli.
    flame.content.visible = lit
    light.visible = lit
    light.position.y = bowlTop()
    if (!lit) light.intensity = 0
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
    parts: { bowl, legs, coals, flame },
    actions: {
      setLit: (next: boolean) => {
        if (next === lit) return
        lit = next
        applyLit()
      },
      isLit: () => lit,
    },
    materials,
    getConfig: () => config,
    configure: (patch): ConfigureResult => {
      const next = { ...config, ...patch }
      const changed = (Object.keys(next) as Array<keyof IronBrazierConfig>)
        .some((keyName) => next[keyName] !== config[keyName])
      if (!changed) return { rebuilt: false }
      config = next
      build()
      return { rebuilt: true }
    },
    update: (deltaSeconds: number) => {
      if (!lit) return
      // Kare atlamalarında alevin fırlamaması için adımı sınırla.
      elapsed += Math.min(Math.max(deltaSeconds, 0), 0.05)

      let brightness = 0
      for (const blade of blades) {
        // İki farklı frekansın toplamı: tek sinüs fazla düzenli, "nefes alan"
        // bir ritim veriyor; ateş öyle yanmaz.
        const wave =
          Math.sin(elapsed * blade.speed + blade.phase) * 0.6 +
          Math.sin(elapsed * blade.speed * 2.7 + blade.phase * 1.9) * 0.4
        blade.mesh.scale.y = 1 + wave * 0.22
        blade.mesh.scale.x = 1 - wave * 0.07
        blade.mesh.scale.z = blade.mesh.scale.x
        blade.mesh.rotation.z = wave * 0.09
        brightness += wave
      }

      const average = blades.length > 0 ? brightness / blades.length : 0
      light.intensity = 2.4 + average * 0.9
    },
    dispose: () => {
      for (const geometry of owned) geometry.dispose()
      owned = []
      blades = []
      bowl.reset()
      legs.reset()
      coals.reset()
      flame.reset()
      scope.dispose()
    },
  }
}
