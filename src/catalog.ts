/**
 * The viewer catalogue.
 *
 * Everything here is derived from `my-registry/meta.ts` — slider ranges,
 * titles, descriptions. The viewer used to keep its own list by hand and the
 * same information lived in two places; at seventeen models the two had started
 * to drift apart.
 *
 * The only things left by hand are two mappings: the model's FACTORY
 * (`createModel`) and its ACTION, if it has one. Neither can be derived from
 * metadata, because one is code and the other is a model-specific interface.
 */
import { Box3, Group, Vector3 } from 'three/webgpu'
import type { Color, Material, Object3D } from 'three/webgpu'

import { MODEL_META } from '../my-registry/meta.ts'

import { createModel as createGauge } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'
import { createModel as createBucket } from '@/models/medieval-kit/wooden-bucket/model.ts'
import { createModel as createCrate } from '@/models/medieval-kit/wooden-crate/model.ts'
import { createModel as createAnvil } from '@/models/medieval-kit/iron-anvil/model.ts'
import { createModel as createLadder } from '@/models/medieval-kit/wooden-ladder/model.ts'
import { createModel as createFence } from '@/models/medieval-kit/wooden-fence/model.ts'
import { createModel as createStool } from '@/models/medieval-kit/wooden-stool/model.ts'
import { createModel as createHoe } from '@/models/medieval-kit/wooden-hoe/model.ts'
import { createModel as createShovel } from '@/models/medieval-kit/wooden-shovel/model.ts'
import { createModel as createPitchfork } from '@/models/medieval-kit/wooden-pitchfork/model.ts'
import { createModel as createTable } from '@/models/medieval-kit/trestle-table/model.ts'
import { createModel as createWheel } from '@/models/medieval-kit/cart-wheel/model.ts'
import { createModel as createLogPile } from '@/models/medieval-kit/log-pile/model.ts'
import { createModel as createChest } from '@/models/medieval-kit/wooden-chest/model.ts'
import { createModel as createBench } from '@/models/medieval-kit/wooden-bench/model.ts'
import { createModel as createTorch } from '@/models/medieval-kit/pitch-torch/model.ts'
import { createModel as createBale } from '@/models/medieval-kit/hay-bale/model.ts'
import { createModel as createSack } from '@/models/medieval-kit/linen-sack/model.ts'
import { createModel as createBroom } from '@/models/medieval-kit/straw-broom/model.ts'
import { createModel as createTankard } from '@/models/medieval-kit/oak-tankard/model.ts'
import { createModel as createBell } from '@/models/medieval-kit/bronze-bell/model.ts'
import { createModel as createLantern } from '@/models/medieval-kit/iron-lantern/model.ts'
import { createModel as createSign } from '@/models/medieval-kit/tavern-sign/model.ts'
import { createModel as createBook } from '@/models/medieval-kit/leather-book/model.ts'
import { createModel as createPhial } from '@/models/medieval-kit/glass-phial/model.ts'
import { createModel as createPouch } from '@/models/medieval-kit/coin-pouch/model.ts'
import { createModel as createBasket } from '@/models/medieval-kit/wicker-basket/model.ts'
import { createModel as createMill } from '@/models/medieval-kit/post-mill/model.ts'
import { createModel as createWell } from '@/models/medieval-kit/stone-well/model.ts'
import { createModel as createCauldron } from '@/models/medieval-kit/iron-cauldron/model.ts'
import { createModel as createCart } from '@/models/medieval-kit/hand-cart/model.ts'
import { createModel as createVeg } from '@/models/medieval-kit/vegetables/model.ts'

export interface ParamSpec {
  readonly key: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
}

export interface ParamGroup {
  readonly specs: readonly ParamSpec[]
  current(): Record<string, number>
  apply(patch: Record<string, number>): void
}

/**
 * The model's PROTOCOL surface — what the inspector actually shows.
 *
 * vibe3d's own inspector shows the model as a single block. But the promise of
 * the protocol is exactly the opposite: the model is made of semantic PARTS and
 * its materials can be swapped SLOT by slot. If those are not visible, the
 * consumer does not know what they bought.
 */
export interface Inspection {
  readonly parts: readonly string[]
  readonly slots: readonly string[]
  /** Hides/shows the part. Works on the anchor, so it survives a rebuild. */
  setPartVisible(part: string, visible: boolean): void
  isPartVisible(part: string): boolean
  /** The slot's current colour (#rrggbb). */
  slotColour(slot: string): string
  /** Paints the slot with a temporary tint. Does NOT touch the default material. */
  tintSlot(slot: string, hex: string): void
  resetSlot(slot: string): void
  isTinted(slot: string): boolean
}

export interface Entry {
  readonly id: string
  readonly namespace: string
  readonly address: string
  readonly who: string
  /** Builds the model; returns the root plus optional update/action. */
  build(): {
    root: Group
    update?: (deltaSeconds: number) => void
    action?: { label(): string; run(): void }
    params?: ParamGroup
    inspect?: Inspection
    dispose(): void
  }
}

/**
 * Everything the viewer needs from a model.
 *
 * Structural on purpose: the viewer knows no model's config type, it only sees
 * "an object with numeric fields". That the keys really exist is checked at
 * runtime by `scripts/verify-model.ts` — and over a wider scope than the
 * compiler could manage, because it validates the `parts` and `materialSlots`
 * declarations at the same time.
 */
interface KitModel {
  readonly root: Group
  readonly parts: Readonly<Record<string, { readonly anchor: Object3D }>>
  readonly materials: {
    get(slot: string): Material | undefined
    override(slot: string, material: Material): void
    reset(slot: string): void
  }
  getConfig(): Readonly<Record<string, unknown>>
  configure(patch: Record<string, number>): unknown
  update(deltaSeconds: number): void
  dispose(): void
  readonly actions: Readonly<Record<string, unknown>>
}

const as = (make: () => unknown) => make as () => KitModel

/** Registry name → factory. The first thing that cannot be derived from metadata. */
const FACTORIES: Readonly<Record<string, () => KitModel>> = {
  'wooden-barrel': as(createBarrel),
  'wooden-bucket': as(createBucket),
  'wooden-crate': as(createCrate),
  'wooden-chest': as(createChest),
  'trestle-table': as(createTable),
  'wooden-bench': as(createBench),
  'wooden-stool': as(createStool),
  'iron-anvil': as(createAnvil),
  'cart-wheel': as(createWheel),
  'log-pile': as(createLogPile),
  'hay-bale': as(createBale),
  'pitch-torch': as(createTorch),
  'linen-sack': as(createSack),
  'straw-broom': as(createBroom),
  'oak-tankard': as(createTankard),
  'bronze-bell': as(createBell),
  'iron-lantern': as(createLantern),
  'tavern-sign': as(createSign),
  'leather-book': as(createBook),
  'glass-phial': as(createPhial),
  'coin-pouch': as(createPouch),
  'wicker-basket': as(createBasket),
  'post-mill': as(createMill),
  'stone-well': as(createWell),
  'iron-cauldron': as(createCauldron),
  'hand-cart': as(createCart),
  'vegetables': as(createVeg),
  'wooden-ladder': as(createLadder),
  'wooden-fence': as(createFence),
  'wooden-hoe': as(createHoe),
  'wooden-shovel': as(createShovel),
  'wooden-pitchfork': as(createPitchfork),
}

/**
 * The models that have an action. The second thing that cannot be derived from
 * metadata: every action has its own interface, there is no common "action"
 * schema — and there should not be one, because `setOpen(boolean)` and
 * `setLit(boolean)` are not the same thing.
 */
const ACTIONS: Readonly<Record<string, (model: KitModel) => { label(): string; run(): void }>> = {
  'wooden-chest': (model) => {
    const chest = model.actions as { isOpen(): boolean; toggle(): boolean }
    return {
      label: () => (chest.isOpen() ? 'Close the lid' : 'Open the lid'),
      run: () => { chest.toggle() },
    }
  },
  'pitch-torch': (model) => {
    const torch = model.actions as { isLit(): boolean; setLit(lit: boolean): void }
    return {
      label: () => (torch.isLit() ? 'Snuff out' : 'Light'),
      run: () => { torch.setLit(!torch.isLit()) },
    }
  },
  'iron-lantern': (model) => {
    const lantern = model.actions as { isLit(): boolean; setLit(lit: boolean): void }
    return {
      label: () => (lantern.isLit() ? 'Snuff out' : 'Light'),
      run: () => { lantern.setLit(!lantern.isLit()) },
    }
  },
  'bronze-bell': (model) => {
    const bell = model.actions as { ring(): void; strikes(): number }
    return {
      // The label shows the strike counter: the model has no sound, but this is
      // how you see that the signal a consumer would read to play one works.
      label: () => `Ring${bell.strikes() > 0 ? ` · ${bell.strikes()} strikes` : ''}`,
      run: () => { bell.ring() },
    }
  },
  'tavern-sign': (model) => {
    const sign = model.actions as { push(strength?: number): void }
    return { label: () => 'Push', run: () => { sign.push() } }
  },
}

function entryFor(id: string): Entry {
  const meta = MODEL_META[id]
  if (!meta) throw new Error(`no MODEL_META entry for ${id}`)
  const factory = FACTORIES[id]
  if (!factory) throw new Error(`no factory registration for ${id}`)

  const specs: ParamSpec[] = Object.entries(meta.controls).map(([key, control]) => ({
    key,
    label: control.label,
    min: control.min,
    max: control.max,
    step: control.step,
    ...(control.unit === undefined ? {} : { unit: control.unit }),
  }))

  return {
    id,
    namespace: '@medieval-kit',
    address: `@medieval-kit/${id}`,
    who: meta.description,
    build: () => {
      const model = factory()
      const action = ACTIONS[id]?.(model)

      // The slots' DEFAULT materials, before any override. Tinting clones
      // these: cloning an already-overridden material would stack the tints on
      // top of each other.
      const defaults = new Map<string, Material>()
      for (const slot of meta.materialSlots) {
        const material = model.materials.get(slot)
        if (material) defaults.set(slot, material)
      }
      // The materials the inspector CREATES. The model does not own them
      // (`dispose()` does not touch borrowed materials), so disposing them is
      // our job.
      const owned = new Map<string, Material>()

      const inspect: Inspection = {
        parts: meta.parts,
        slots: meta.materialSlots,
        setPartVisible: (part, visible) => {
          const handle = model.parts[part]
          if (handle) handle.anchor.visible = visible
        },
        isPartVisible: (part) => model.parts[part]?.anchor.visible ?? false,
        slotColour: (slot) => {
          const material = model.materials.get(slot) as { color?: Color } | undefined
          return material?.color ? `#${material.color.getHexString()}` : '#ffffff'
        },
        tintSlot: (slot, hex) => {
          const base = defaults.get(slot)
          if (!base) return
          // The material's `color` is MULTIPLIED with the vertex colour. So
          // tinting does not erase the model's own variation, it rides on top
          // of it — because all of the kit's colour information lives in the
          // geometry, colour configuration is already possible without adding
          // a new field to the protocol.
          const tinted = base.clone()
          tinted.name = `${base.name} · viewer tint`
          ;(tinted as unknown as { color?: Color }).color?.set(hex)
          model.materials.override(slot, tinted)
          owned.get(slot)?.dispose()
          owned.set(slot, tinted)
        },
        resetSlot: (slot) => {
          model.materials.reset(slot)
          owned.get(slot)?.dispose()
          owned.delete(slot)
        },
        isTinted: (slot) => owned.has(slot),
      }

      return {
        root: model.root,
        update: (dt) => { model.update(dt) },
        ...(action ? { action } : {}),
        params: {
          specs,
          current: () => model.getConfig() as Record<string, number>,
          apply: (patch) => { model.configure(patch) },
        },
        inspect,
        dispose: () => {
          model.dispose()
          for (const material of owned.values()) material.dispose()
          owned.clear()
        },
      }
    },
  }
}

/** The kit's order: arranged by what you reach for first when dressing a scene. */
const MEDIEVAL_ORDER = [
  'wooden-chest', 'wooden-barrel', 'wooden-crate', 'wooden-bucket',
  'trestle-table', 'wooden-bench', 'wooden-stool',
  'pitch-torch', 'iron-lantern', 'iron-anvil', 'cart-wheel',
  'log-pile', 'hay-bale', 'linen-sack',
  'oak-tankard', 'straw-broom', 'bronze-bell', 'tavern-sign',
  'wicker-basket', 'leather-book', 'glass-phial', 'coin-pouch',
  'wooden-ladder', 'wooden-fence',
  'wooden-hoe', 'wooden-shovel', 'wooden-pitchfork',
  // Last, because it is the landmark: a 6 m mill after a row of hand tools is
  // the order that makes the scale of it land.
  'iron-cauldron', 'hand-cart', 'vegetables',
  'stone-well',
  'post-mill',
] as const

// Keep the order list and the factory list from drifting apart: if one gets an
// entry and the other is forgotten, the model would silently vanish from the viewer.
const missing = Object.keys(FACTORIES).filter((id) => !MEDIEVAL_ORDER.includes(id as never))
if (missing.length > 0) throw new Error(`model missing from the ordering: ${missing.join(', ')}`)


/**
 * The WHOLE kit in one scene.
 *
 * vibe3d's inspector shows one model at a time, and that is right for a MODEL.
 * But the question asked of a KIT is a different one: "do these belong
 * together?" Scale inconsistency, tone drift and style breaks only become
 * visible when the models are placed side by side — looked at one at a time,
 * they all look fine.
 *
 * This view answers that question. It is also what shows what the kit is at a
 * glance, so it is both a verification tool and a shop window.
 *
 * The layout is shelf packing: models are laid out in order along +X, and when
 * a row exceeds the target width it drops down along +Z. Every model takes
 * space according to its OWN footprint, so a thin tool does not occupy as much
 * room as a wide table.
 */
function kitEntry(): Entry {
  return {
    id: 'kit',
    namespace: '@medieval-kit',
    address: '@medieval-kit',
    who: `the whole kit · ${MEDIEVAL_ORDER.length} models in one scene · scale and tone consistency show up here`,
    build: () => {
      const root = new Group()
      root.name = 'medieval-kit'
      const models = MEDIEVAL_ORDER.map((id) => ({ id, model: FACTORIES[id]!() }))

      // Order: TALLEST to shortest. The first row placed ends up FURTHEST BACK
      // (small Z), so the tall pieces fall to the back and the small props to
      // the front, and the kit reads like a market stall. In the reverse order
      // the ladder and the fence came to the front and hid everything behind them.
      const placed = models.map(({ id, model }) => {
        const box = new Box3().setFromObject(model.root)
        return { id, model, box, size: box.getSize(new Vector3()) }
      })
      placed.sort((a, b) => b.size.y - a.size.y)

      const gap = 0.42
      const rowWidth = 5.6
      let cursorX = 0
      let cursorZ = 0
      let rowDepth = 0

      for (const item of placed) {
        if (cursorX > 0 && cursorX + item.size.x > rowWidth) {
          cursorX = 0
          cursorZ += rowDepth + gap
          rowDepth = 0
        }
        const centre = item.box.getCenter(new Vector3())
        // Seat the model in the centre of its cell and on the GROUND: kits are
        // only comparable if they share a common ground plane.
        item.model.root.position.set(
          cursorX + item.size.x / 2 - centre.x,
          -item.box.min.y,
          cursorZ + item.size.z / 2 - centre.z,
        )
        root.add(item.model.root)
        cursorX += item.size.x + gap
        rowDepth = Math.max(rowDepth, item.size.z)
      }

      // Centre the whole kit on the ORIGIN, otherwise the camera framing looks at a corner.
      const whole = new Box3().setFromObject(root)
      const middle = whole.getCenter(new Vector3())
      for (const item of placed) {
        item.model.root.position.x -= middle.x
        item.model.root.position.z -= middle.z
      }

      // The union of the slots: tinting one slot affects every model that USES
      // it. Changing the kit's tone in a single move is exactly this.
      const slots = [...new Set(MEDIEVAL_ORDER.flatMap((id) => MODEL_META[id]!.materialSlots))]
      const owned = new Map<string, Material[]>()
      const withSlot = (slot: string) =>
        placed.filter(({ id }) => MODEL_META[id]!.materialSlots.includes(slot))

      const inspect: Inspection = {
        parts: [],
        slots,
        setPartVisible: () => undefined,
        isPartVisible: () => true,
        slotColour: (slot) => {
          const first = withSlot(slot)[0]
          const material = first?.model.materials.get(slot) as { color?: Color } | undefined
          return material?.color ? `#${material.color.getHexString()}` : '#ffffff'
        },
        tintSlot: (slot, hex) => {
          for (const material of owned.get(slot) ?? []) material.dispose()
          const created: Material[] = []
          for (const { model } of withSlot(slot)) {
            const base = model.materials.get(slot)
            if (!base) continue
            const tinted = base.clone()
            tinted.name = `${base.name} · kit tint`
            ;(tinted as unknown as { color?: Color }).color?.set(hex)
            model.materials.override(slot, tinted)
            created.push(tinted)
          }
          owned.set(slot, created)
        },
        resetSlot: (slot) => {
          for (const { model } of withSlot(slot)) model.materials.reset(slot)
          for (const material of owned.get(slot) ?? []) material.dispose()
          owned.delete(slot)
        },
        isTinted: (slot) => owned.has(slot),
      }

      return {
        root,
        update: (dt) => { for (const { model } of placed) model.update(dt) },
        action: {
          label: () => 'Play them all',
          run: () => {
            // Fires every model that has an action at once: seeing all of the
            // kit's moving parts at the same time is a far quicker check than
            // looking at them one by one.
            for (const { id, model } of placed) ACTIONS[id]?.(model).run()
          },
        },
        inspect,
        dispose: () => {
          for (const { model } of placed) model.dispose()
          for (const list of owned.values()) for (const material of list) material.dispose()
          owned.clear()
        },
      }
    },
  }
}

export const REGISTRIES = [
  {
    namespace: '@scifi-kit',
    scheme: 'npm:',
    rest: '@scifi-kit/registry',
    entries: ['pressure-gauge'] as readonly string[],
  },
  {
    namespace: '@medieval-kit',
    scheme: 'file:',
    rest: 'my-registry/dist/registry.json',
    // 'kit' first: what whoever opens the inspector sees first is the whole kit.
    entries: ['kit', ...MEDIEVAL_ORDER] as readonly string[],
  },
] as const

/**
 * Numeric control ranges for a model, without building it.
 *
 * The showcase plans its whole timeline before the first frame, so it needs the
 * ranges for models that are not on screen yet. Reading them from the metadata
 * keeps that free — building 27 models just to ask their slider bounds would
 * stall the start of a recording.
 */
export function controlsFor(id: string): ReadonlyArray<{
  key: string
  min: number
  max: number
  step: number
}> {
  const meta = MODEL_META[id]
  if (!meta) return []
  return Object.entries(meta.controls).map(([key, control]) => ({
    key,
    min: control.min,
    max: control.max,
    step: control.step,
  }))
}

/** The medieval models in tour order, without the whole-kit entry. */
export const SHOWCASE_ORDER: readonly string[] = MEDIEVAL_ORDER

export const CATALOG: Record<string, Entry> = {
  'pressure-gauge': {
    id: 'pressure-gauge',
    namespace: '@scifi-kit',
    address: '@scifi-kit/pressure-gauge',
    who: 'written by the vibe3d team · installed from <b>npm</b> · 539 lines of TypeScript',
    build: () => {
      const gauge = createGauge()
      return {
        root: gauge.root,
        update: gauge.update,
        action: { label: () => 'Pressure test', run: () => gauge.triggerPressureTest() },
        dispose: () => gauge.dispose(),
      }
    },
  },
  kit: kitEntry(),
  ...Object.fromEntries(MEDIEVAL_ORDER.map((id) => [id, entryFor(id)])),
}
