import { Group, Mesh, type BufferGeometry, type Material } from 'three'

import type { ConfigureResult, MaterialBindings, ModelInstance, PartHandle } from '@/lib/vibe3d/model.ts'
import { ResourceScope } from '@/lib/vibe3d/ownership.ts'

import type { Vec3 } from './geometry.ts'
import { mottleGeometry } from './geometry.ts'
import { bakeOcclusion, type OcclusionOptions } from './occlusion.ts'
import { createPart, type PartSlot } from './parts.ts'
import { createRandom } from './random.ts'
import { createMedievalMaterials, type MedievalSlot, type SlotMaterial } from './materials.ts'

/**
 * Kit model scaffold.
 *
 * Every model has to set up the same contract: resource ownership, material
 * resolution and overrides, fixed anchor + replaceable content, a configure()
 * that does not break identity, an idempotent dispose(). Writing that by hand
 * in every model means ~80 lines of repetition plus a chance to get it wrong
 * on each repetition — and indeed I got the anchor/content split wrong in the
 * first three models at once.
 *
 * From here on, writing a model is just producing geometry: `build` returns a
 * part name → geometry mapping, this function handles the rest.
 */

/** The body of a part that uses a single material slot. */
export interface PartBody<S extends string> {
  readonly slot: S
  readonly geometry: BufferGeometry
}

export interface BuiltPart<S extends string> extends PartBody<S> {
  /**
   * Extra bodies belonging to the same part that use a DIFFERENT slot.
   *
   * Parts are sibling children of the root, so when one moves the others
   * cannot follow it. A chest's lid is oak boards and iron bands and the
   * lock's hasp all at once, and the three MUST rotate together — if they were
   * separate parts, the bands would hang in mid-air as the lid opened.
   *
   * So this field does not preserve the assumption "one part = one mesh", it
   * preserves the principle "one part = one meaning". The meaning is not
   * split, only the material is.
   */
  readonly extras?: readonly PartBody<S>[]
  /**
   * The part's own centre of rotation (in model space).
   *
   * When given, the anchor is positioned here and the geometry is assumed to
   * have been written RELATIVE TO THIS POINT. This is the only thing needed
   * for a chest lid to rotate around its hinge: the lid geometry is produced
   * at the hinge origin, the anchor is moved to the hinge, and
   * `anchor.rotation.x` now opens the lid.
   *
   * Objects the consumer attached to the anchor join this rotation too — a
   * candle placed on top of the lid rises with the lid. That is the correct
   * behaviour.
   */
  readonly origin?: Vec3
}

export interface BuildContext<C, S extends MedievalSlot> {
  readonly config: Readonly<C>
  /** Seed-bound deterministic randomness. Starts over on every rebuild. */
  readonly random: () => number
  /** The slot's current material (the override, if there is one). */
  resolve(slot: S): Material
  /** The slot's default material — even if it has been overridden. */
  readonly defaults: Pick<SlotMaterial, S>
}

/**
 * The runtime context handed to actions and to `update`.
 *
 * It gives access to the PARTS, not to the geometry: an action must not
 * trigger a rebuild, it should only move something in the scene graph. Opening
 * the lid does not change the model's identity, so it is not `configure()`'s
 * job.
 */
export interface RuntimeContext<C, P extends string> {
  readonly parts: Record<P, PartHandle<Group>>
  getConfig(): Readonly<C>
}

export interface KitModelOptions<
  C extends { seed: number },
  S extends MedievalSlot,
  P extends string,
  A extends object = Record<string, never>,
> {
  /** Registry item name; used in mesh names and in userData. */
  readonly id: string
  readonly defaults: C
  readonly slots: readonly S[]
  /** Part name → geometry. `undefined` means absent in that configuration. */
  build(context: BuildContext<C, S>): Record<P, BuiltPart<S> | undefined>
  /**
   * Ambient occlusion to bake into the vertex colours. `false` turns it off.
   *
   * All parts are evaluated TOGETHER: the place where a board darkens is the
   * surface of the neighbouring post, not its own surface.
   */
  readonly occlusion?: OcclusionOptions | false
  /**
   * Surface mottle written into the vertex colours. `false` turns it off.
   *
   * The amount is scaled BY SLOT (see the table below): burnished steel is not
   * mottled, straw is mottled badly. The model does not have to do anything
   * else.
   */
  readonly mottle?: { readonly amount?: number; readonly cell?: number } | false
  /**
   * The model's typed actions. Set up once, after the first build — so state
   * held in the closure (is the lid open, which flame phase) survives a
   * rebuild.
   */
  actions?(context: RuntimeContext<C, P>): A
  /** Called each frame. If the consumer never calls it, the model stays fully static. */
  update?(deltaSeconds: number, context: RuntimeContext<C, P>): void
}

/**
 * Mottle multiplier per slot.
 *
 * The rule comes from the physics of the material: the more polished a surface
 * is, the more it becomes a SINGLE COLOUR, because the light reaching the eye
 * comes from the reflection rather than from the surface's own pigment. For
 * straw and cloth the exact opposite holds.
 *
 * Tying this to the slot is better than tuning it separately in every model:
 * within the kit the same material looks the same everywhere.
 */
const MOTTLE_BY_SLOT: Readonly<Record<MedievalSlot, number>> = {
  straw: 1.35,
  cloth: 1.15,
  oak: 1,
  char: 0.85,
  leather: 0.7,
  produce: 0.6,
  iron: 0.5,
  brass: 0.35,
  steel: 0.22,
  glass: 0.15,
  // Between timber and iron. Rubble masonry varies block to block, but each
  // block is fairly even in itself, so the mottle wants to read at the scale
  // of a stone rather than of a grain.
  stone: 0.75,
  ember: 0,   // a flame is not mottled: its colour is already the final colour
  // Just under oak, and it started at 1.5 for a reason that turned out to be
  // the straw trap wearing a different hat.
  //
  // The measurement was real: across one oak in full leaf the darkest tenth of
  // the crown reads lightness 0.16 and the lightest 0.61, a spread of 0.45 and
  // the widest of anything in this kit. What it does not say is that the
  // spread has to come from HERE. Clump-to-clump tint, this mottle and the
  // baked occlusion are three separate mechanisms all reproducing the same
  // shadow, and stacked at full strength they went through the floor: 10.8%
  // of the rendered crown clipped to pure black, against 0.01% of the
  // photograph. A statistic taken off fine detail cannot be added on top of
  // the machinery that already reproduces that detail -- which is the third
  // time this kit has learned that, after straw's saturation and bark's value.
  leaf: 0.95,
}

export function createKitModel<
  C extends { seed: number },
  S extends MedievalSlot,
  P extends string,
  A extends object = Record<string, never>,
>(
  options: KitModelOptions<C, S, P, A>,
  overrides: Partial<C> = {},
): ModelInstance<C, Record<P, PartHandle<Group>>, A> {
  let config: C = { ...options.defaults, ...overrides }

  // The resources the model owns. Materials handed in by the consumer never
  // enter here, so dispose() does not touch them.
  const scope = new ResourceScope()
  const defaults = createMedievalMaterials(scope, options.slots)
  const overridesBySlot = new Map<S, Material>()
  const resolve = (slot: S): Material => overridesBySlot.get(slot) ?? defaults[slot]

  const root = new Group()
  root.name = options.id

  const parts = {} as Record<P, PartSlot>
  let owned: BufferGeometry[] = []

  function build(): void {
    for (const geometry of owned) geometry.dispose()
    owned = []

    const produced = options.build({
      config,
      random: createRandom(config.seed),
      resolve,
      defaults,
    })

    const built = Object.values(produced)
      .filter((part): part is BuiltPart<S> => part !== undefined)
    const geometriesOf = (part: BuiltPart<S>): BufferGeometry[] =>
      [part, ...(part.extras ?? [])]
        // A flame neither TAKES shadow nor CASTS one. `ember` is an unlit
        // material, so its vertex colour is the final colour going straight to
        // the screen — if occlusion darkened it, the flame would go out. The
        // rule is tied to the slot itself, not to a per-model flag: it must
        // not be possible to forget it.
        .filter((body) => body.slot !== 'ember')
        .map((body) => body.geometry)

    if (options.occlusion !== false) {
      // Occlusion has to be computed in ASSEMBLY space: a lid written at its
      // own origin looks as though it sits inside the body rather than beside
      // it, and darkens the wrong places. So everything is first moved into
      // place, baked, then moved back — the resulting geometries stay
      // hinge-local.
      const moved = built.filter((part) => part.origin !== undefined)
      for (const part of moved) {
        const [x, y, z] = part.origin!
        for (const geometry of geometriesOf(part)) geometry.translate(x, y, z)
      }
      bakeOcclusion(built.flatMap(geometriesOf), options.occlusion ?? {})
      for (const part of moved) {
        const [x, y, z] = part.origin!
        for (const geometry of geometriesOf(part)) geometry.translate(-x, -y, -z)
      }
    }

    if (options.mottle !== false) {
      const amount = options.mottle?.amount ?? 0.125
      // The mottle size is derived from the model's scale, but WITH ABSOLUTE
      // BOUNDS.
      //
      // The bounds were added later and closed a real bug: with scale used on
      // its own, a 4.89 m fence got a 0.27 m cell. The fence's post is 0.09 m
      // — so the entire post fell into ONE cell and came out completely flat.
      // The model paid the cost of the texture system and got nothing back.
      //
      // The truth is this: wood grain mottle is 2–8 cm and has nothing to do
      // with the size of the object. A fence post and a tankard stave come out
      // of the same tree.
      const extent = built.reduce((largest, part) => {
        part.geometry.computeBoundingBox()
        const box = part.geometry.boundingBox
        if (!box) return largest
        return Math.max(largest, box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z)
      }, 0)
      const cell = options.mottle?.cell ?? Math.min(0.08, Math.max(0.015, extent * 0.055))
      for (const part of built) {
        for (const body of [part, ...(part.extras ?? [])]) {
          mottleGeometry(body.geometry, amount * MOTTLE_BY_SLOT[body.slot], { cell, salt: 3 })
        }
      }
    }

    for (const [name, part] of Object.entries(produced) as Array<[P, BuiltPart<S> | undefined]>) {
      // The anchor is created on first setup and NEVER changes again; only its
      // content is renewed. That is why objects the consumer attached to the
      // anchor survive a rebuild.
      let slot = parts[name]
      if (!slot) {
        slot = createPart(`${options.id}/${name}`)
        parts[name] = slot
        root.add(slot.anchor)
      }
      const target = slot.reset()
      if (!part) continue

      // The position is updated but the ROTATION is not: the angle an action
      // moved has to survive a rebuild, otherwise the chest's lid slams shut
      // every time `configure()` is called.
      if (part.origin) slot.anchor.position.set(...part.origin)

      for (const body of [part, ...(part.extras ?? [])]) {
        owned.push(body.geometry)
        const mesh = new Mesh(body.geometry, resolve(body.slot))
        mesh.name = `${options.id}/${name}`
        mesh.userData.vibe3d = {
          model: `@medieval-kit/${options.id}`,
          part: name,
          materialSlot: body.slot,
        }
        target.add(mesh)
      }
    }
  }

  build()

  const runtime: RuntimeContext<C, P> = {
    parts: parts as unknown as Record<P, PartHandle<Group>>,
    getConfig: () => config,
  }
  const actions = (options.actions?.(runtime) ?? {}) as A

  const materials: MaterialBindings = {
    get: (slot) => (options.slots.includes(slot as S) ? resolve(slot as S) : undefined),
    override: (slot, material) => {
      if (!options.slots.includes(slot as S)) return
      overridesBySlot.set(slot as S, material)
      build()
    },
    reset: (slot) => {
      if (!overridesBySlot.delete(slot as S)) return
      build()
    },
  }

  return {
    root,
    parts: parts as unknown as Record<P, PartHandle<Group>>,
    actions,
    materials,
    getConfig: () => config,
    configure: (patch): ConfigureResult => {
      const next = { ...config, ...patch }
      const changed = (Object.keys(next) as Array<keyof C>).some((key) => next[key] !== config[key])
      if (!changed) return { rebuilt: false }
      config = next
      build()
      return { rebuilt: true }
    },
    update: (deltaSeconds) => options.update?.(deltaSeconds, runtime),
    dispose: () => {
      for (const geometry of owned) geometry.dispose()
      owned = []
      for (const part of Object.values(parts) as PartSlot[]) part.reset()
      scope.dispose()
    },
  }
}
