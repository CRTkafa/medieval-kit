/**
 * @medieval-kit/iron-brazier
 *
 * The first MOVING model in the kit. The barrel and the chest are static: they
 * are built and they stay that way. The brazier exercises two parts of the
 * vibe3d protocol that those two never touch:
 *
 *   - typed `actions`  → light / extinguish
 *   - `update(dt)`     → flame flicker and light fluctuation
 *
 * The distinction matters: `configure()` rebuilds the topology and is
 * expensive, it is meant for user settings. Everything that changes per frame
 * must live inside `update()`.
 *
 * The model also carries a PointLight. The light is attached to the `flame`
 * anchor, so even when configure() rebuilds the geometry the light survives.
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
  /** Total height including the legs (metres). */
  readonly height: number
  /** Radius of the bowl's top rim (metres). */
  readonly bowlRadius: number
  /** Corner count around the bowl. Keep it low — it sets the lowpoly silhouette. */
  readonly bowlSegments: number
  /** Number of legs. */
  readonly legCount: number
  /** Number of flame blades. 0 = no flame, coals only. */
  readonly flameCount: number
  /** Variation seed. */
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
  /** The bowl and its rim hoop. */
  readonly bowl: PartHandle<Group>
  /** The legs and their feet. */
  readonly legs: PartHandle<Group>
  /** Burnt-out coals. */
  readonly coals: PartHandle<Group>
  /** Flame blades, glowing coals and the light. Hidden when extinguished. */
  readonly flame: PartHandle<Group>
}

export interface IronBrazierActions {
  /** Lights or extinguishes the fire. */
  setLit(lit: boolean): void
  /** Whether it is currently lit. */
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

  // The light is attached to the ANCHOR, not to the generated content. Because
  // the anchor does not change on rebuild, configure() does not put the fire
  // out — objects the consumer added itself also survive for the same reason.
  const light = new PointLight(0xffa04d, 0, 6, 2)
  light.name = 'iron-brazier/firelight'
  flame.anchor.add(light)

  let owned: BufferGeometry[] = []
  let blades: Blade[] = []
  let lit = true
  let elapsed = 0

  /** World height of the bowl's top rim. */
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

    // The outer shell and the inner shell are the same cone; the inner one is
    // flipped, because when you look into the bowl the faces must face us.
    const outer = prismGeometry(
      outerBottom, config.bowlRadius, depth, config.bowlSegments,
      [0, centreY, 0], shade(), { capTop: false, capBottom: true },
    )
    const inner = flipGeometry(prismGeometry(
      outerBottom - wall, config.bowlRadius - wall, depth, config.bowlSegments,
      [0, centreY + wall, 0], shade(), { capTop: false, capBottom: true },
    ))
    // The rim hoop closes the gap between the outer and inner shells and gives
    // the impression of a forged lip.
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

      // First build a stick hanging BELOW the origin, then tilt it outwards, then
      // rotate it into place. Order matters: rotate always turns about the origin.
      const leg = boxGeometry([thickness, legLength, thickness], [0, -legLength / 2, 0], tint)
      leg.rotateZ(tilt)
      leg.rotateY(angle)
      leg.translate(0, attachY, 0)
      pieces.push(leg)

      // Foot: the flat base where the leg stands on the ground.
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

  /** Coal pieces scattered inside the bowl. The `hot` ones glow. */
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
   * Flame blades. Each one sits in its own Group, because update() will scale
   * and rotate them one by one — a single merged geometry could not move.
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

      // Tip radius zero: a cone. The colour shifts from base to tip, because the
      // bottom of a flame and its tip are not the same colour.
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
    // reset() only replaces the generated content; the anchors and whatever is
    // attached to them (the light included) stay in place.
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
    // The generated flame content is in content, the light on the anchor. Both go out.
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
      // Clamp the step so the flame does not shoot up when frames are dropped.
      elapsed += Math.min(Math.max(deltaSeconds, 0), 0.05)

      let brightness = 0
      for (const blade of blades) {
        // The sum of two different frequencies: a single sine is too regular and
        // gives a "breathing" rhythm; fire does not burn like that.
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
