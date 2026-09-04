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

// --- @contemporary-props. Its metadata is a sidecar per model rather than
// one shared record, so it is imported as JSON rather than read off a map.
import { createModel as createCpCeramicVase } from '@/models/contemporary-props/ceramic-vase/model.ts'
import { createModel as createCpCoffeeMug } from '@/models/contemporary-props/coffee-mug/model.ts'
import { createModel as createCpWineGlass } from '@/models/contemporary-props/wine-glass/model.ts'
import { createModel as createCpPepperMill } from '@/models/contemporary-props/pepper-mill/model.ts'
import { createModel as createCpStockpot } from '@/models/contemporary-props/stockpot/model.ts'
import { createModel as createCpTrafficCone } from '@/models/contemporary-props/traffic-cone/model.ts'
import { createModel as createCpStreetBollard } from '@/models/contemporary-props/street-bollard/model.ts'
import { createModel as createCpGasCylinder } from '@/models/contemporary-props/gas-cylinder/model.ts'
import { createModel as createCpFireExtinguisher } from '@/models/contemporary-props/fire-extinguisher/model.ts'
import { createModel as createCpPedestalBasin } from '@/models/contemporary-props/pedestal-basin/model.ts'
import { createModel as createCpJerseyBarrier } from '@/models/contemporary-props/jersey-barrier/model.ts'
import { createModel as createCpPicnicTable } from '@/models/contemporary-props/picnic-table/model.ts'
import { createModel as createCpParkBench } from '@/models/contemporary-props/park-bench/model.ts'
import { createModel as createCpBikeRack } from '@/models/contemporary-props/bike-rack/model.ts'
import { createModel as createCpCableDrum } from '@/models/contemporary-props/cable-drum/model.ts'
import { createModel as createCpLitterBin } from '@/models/contemporary-props/litter-bin/model.ts'
import { createModel as createCpFencePanel } from '@/models/contemporary-props/temporary-fence-panel/model.ts'
import { createModel as createCpWasteBin } from '@/models/contemporary-props/wheeled-waste-bin/model.ts'
import { createModel as createCpUtilityCabinet } from '@/models/contemporary-props/utility-cabinet/model.ts'
import { createModel as createCpPavementSign } from '@/models/contemporary-props/pavement-sign-board/model.ts'
import { createModel as createCpLectern } from '@/models/contemporary-props/lectern/model.ts'
import cpMetaCeramicVase from '../contemporary-props/models/ceramic-vase/meta.json'
import cpMetaCoffeeMug from '../contemporary-props/models/coffee-mug/meta.json'
import cpMetaWineGlass from '../contemporary-props/models/wine-glass/meta.json'
import cpMetaPepperMill from '../contemporary-props/models/pepper-mill/meta.json'
import cpMetaStockpot from '../contemporary-props/models/stockpot/meta.json'
import cpMetaTrafficCone from '../contemporary-props/models/traffic-cone/meta.json'
import cpMetaStreetBollard from '../contemporary-props/models/street-bollard/meta.json'
import cpMetaGasCylinder from '../contemporary-props/models/gas-cylinder/meta.json'
import cpMetaFireExtinguisher from '../contemporary-props/models/fire-extinguisher/meta.json'
import cpMetaPedestalBasin from '../contemporary-props/models/pedestal-basin/meta.json'
import cpMetaJerseyBarrier from '../contemporary-props/models/jersey-barrier/meta.json'
import cpMetaPicnicTable from '../contemporary-props/models/picnic-table/meta.json'
import cpMetaParkBench from '../contemporary-props/models/park-bench/meta.json'
import cpMetaBikeRack from '../contemporary-props/models/bike-rack/meta.json'
import cpMetaCableDrum from '../contemporary-props/models/cable-drum/meta.json'
import cpMetaLitterBin from '../contemporary-props/models/litter-bin/meta.json'
import cpMetaFencePanel from '../contemporary-props/models/temporary-fence-panel/meta.json'
import cpMetaWasteBin from '../contemporary-props/models/wheeled-waste-bin/meta.json'
import cpMetaUtilityCabinet from '../contemporary-props/models/utility-cabinet/meta.json'
import cpMetaPavementSign from '../contemporary-props/models/pavement-sign-board/meta.json'
import cpMetaLectern from '../contemporary-props/models/lectern/meta.json'
import { createModel as createShield } from '@/models/medieval-kit/round-shield/model.ts'
import { createModel as createForge } from '@/models/medieval-kit/forge-hearth/model.ts'
import { createModel as createTrough } from '@/models/medieval-kit/stone-trough/model.ts'
import { createModel as createGrind } from '@/models/medieval-kit/grindstone/model.ts'
import { createModel as createStall } from '@/models/medieval-kit/market-stall/model.ts'

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
    /** Names of the model's own typed actions. Empty when it has none. */
    actionNames?: readonly string[]
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

/**
 * Registry name → factory. The first thing that cannot be derived from metadata.
 *
 * Exported because the viewer's own `build()` hands back what a viewer needs,
 * which is one primary action and a label for its button. A scene needs the
 * model's own typed actions: nothing in the viewer's shape can tell a mill to
 * turn.
 */
export const FACTORIES: Readonly<Record<string, () => KitModel>> = {
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
  'round-shield': as(createShield),
  'forge-hearth': as(createForge),
  'stone-trough': as(createTrough),
  'grindstone': as(createGrind),
  'market-stall': as(createStall),
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

/**
 * The second kit, kept apart from the first on purpose.
 *
 * Nothing is shared but the viewer: different palette, different vocabulary,
 * different century. Holding both in one map would mean one namespace for two
 * kits and a lookup that cannot say which one an id belongs to.
 */
/**
 * What the viewer needs out of a model's metadata, whichever kit wrote it.
 *
 * The medieval kit types this precisely in its own `meta.ts`; the contemporary
 * one is JSON and arrives untyped. Structural is the honest description: the
 * catalogue only reads these fields and neither kit's extra ones concern it.
 */
interface ModelMetaLike {
  readonly title: string
  readonly description: string
  readonly controls: Readonly<Record<string, {
    label: string; min: number; max: number; step: number; unit?: string
  }>>
  readonly materialSlots: readonly string[]
  readonly parts: readonly string[]
}

/**
 * Build order, and it is the one thing here that has to be kept up by hand.
 *
 * Three models had been written, verified and committed without reaching this
 * list, which means they were never in the browser viewer and never in
 * `verify:glb` -- the GLB gate walks CATALOG, so a model missing from here is
 * a model nothing round-trips. It read as passing because the count it printed
 * was never checked against the number of folders on disk.
 */
const CONTEMPORARY_ORDER = [
  'ceramic-vase', 'coffee-mug', 'wine-glass', 'pepper-mill',
  'stockpot', 'traffic-cone', 'street-bollard', 'gas-cylinder',
  'fire-extinguisher', 'pedestal-basin', 'jersey-barrier',
  'picnic-table', 'park-bench', 'pavement-sign-board',
  'lectern',
  'bike-rack',
  'cable-drum',
  'litter-bin',
  'temporary-fence-panel',
  'wheeled-waste-bin',
  'utility-cabinet',
] as const

const CONTEMPORARY_FACTORIES: Readonly<Record<string, () => KitModel>> = {
  'ceramic-vase': as(createCpCeramicVase),
  'coffee-mug': as(createCpCoffeeMug),
  'wine-glass': as(createCpWineGlass),
  'pepper-mill': as(createCpPepperMill),
  'stockpot': as(createCpStockpot),
  'traffic-cone': as(createCpTrafficCone),
  'street-bollard': as(createCpStreetBollard),
  'gas-cylinder': as(createCpGasCylinder),
  'fire-extinguisher': as(createCpFireExtinguisher),
  'pedestal-basin': as(createCpPedestalBasin),
  'jersey-barrier': as(createCpJerseyBarrier),
  'picnic-table': as(createCpPicnicTable),
  'park-bench': as(createCpParkBench),
  'bike-rack': as(createCpBikeRack),
  'cable-drum': as(createCpCableDrum),
  'litter-bin': as(createCpLitterBin),
  'temporary-fence-panel': as(createCpFencePanel),
  'wheeled-waste-bin': as(createCpWasteBin),
  'utility-cabinet': as(createCpUtilityCabinet),
  'pavement-sign-board': as(createCpPavementSign),
  'lectern': as(createCpLectern),
}

const CONTEMPORARY_META: Readonly<Record<string, ModelMetaLike>> = {
  'ceramic-vase': cpMetaCeramicVase as ModelMetaLike,
  'coffee-mug': cpMetaCoffeeMug as ModelMetaLike,
  'wine-glass': cpMetaWineGlass as ModelMetaLike,
  'pepper-mill': cpMetaPepperMill as ModelMetaLike,
  'stockpot': cpMetaStockpot as ModelMetaLike,
  'traffic-cone': cpMetaTrafficCone as ModelMetaLike,
  'street-bollard': cpMetaStreetBollard as ModelMetaLike,
  'gas-cylinder': cpMetaGasCylinder as ModelMetaLike,
  'fire-extinguisher': cpMetaFireExtinguisher as ModelMetaLike,
  'pedestal-basin': cpMetaPedestalBasin as ModelMetaLike,
  'jersey-barrier': cpMetaJerseyBarrier as ModelMetaLike,
  'picnic-table': cpMetaPicnicTable as ModelMetaLike,
  'park-bench': cpMetaParkBench as ModelMetaLike,
  'bike-rack': cpMetaBikeRack as ModelMetaLike,
  'cable-drum': cpMetaCableDrum as ModelMetaLike,
  'litter-bin': cpMetaLitterBin as ModelMetaLike,
  'temporary-fence-panel': cpMetaFencePanel as ModelMetaLike,
  'wheeled-waste-bin': cpMetaWasteBin as ModelMetaLike,
  'utility-cabinet': cpMetaUtilityCabinet as ModelMetaLike,
  'pavement-sign-board': cpMetaPavementSign as ModelMetaLike,
  'lectern': cpMetaLectern as ModelMetaLike,
}

/**
 * One catalogue entry, from whichever kit the model belongs to.
 *
 * The namespace and the two maps used to be hard-coded to the medieval kit,
 * which was correct while there was one. Passing them in is the whole of what
 * a second registry needed: nothing else in here knows or cares which kit it
 * is looking at, because both describe themselves the same way.
 */
function entryFor(
  id: string,
  namespace = '@medieval-kit',
  metaOf: Readonly<Record<string, ModelMetaLike>> = MODEL_META as unknown as Readonly<Record<string, ModelMetaLike>>,
  factoryOf: Readonly<Record<string, () => KitModel>> = FACTORIES,
): Entry {
  const meta = metaOf[id]
  if (!meta) throw new Error(`no metadata for ${id}`)
  const factory = factoryOf[id]
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
    namespace,
    address: `${namespace}/${id}`,
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
        /**
         * The names of the model's OWN typed actions.
         *
         * Distinct from `action` below, which is the single button this demo
         * registers by hand for five models. A model can carry a whole set of
         * actions and have no button: the grindstone is cranked, the mill's
         * sails are set turning, the well's bucket is lowered. Nothing outside
         * the model could see any of that, so the generated table called those
         * three static — a document wrong about the most animated things in
         * the kit, and generated, so nobody thought to doubt it.
         */
        actionNames: Object.keys((model as { actions?: object }).actions ?? {}),
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
  'iron-cauldron', 'hand-cart', 'vegetables', 'round-shield', 'forge-hearth',
  'stone-well',
  'stone-trough',
  'grindstone',
  'market-stall',
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
      /**
       * Sorted by DEPTH, which is the dimension a shelf's height is set by.
       *
       * It used to sort by the models' own height, and the two are unrelated:
       * the post mill is 6.98 m deep and the ladder 0.06 m, so a row that
       * happened to hold both was 6.98 m deep for all of them and the ladder
       * sat at the front of six metres of empty floor. Three models shared that
       * row with the mill. The camera then had to frame a plan mostly made of
       * gaps, which is what "zoomed out" actually was.
       *
       * Sorting by depth makes every row about as deep as the things standing
       * in it. Tall still lands at the back, because among these models the
       * deep ones are the tall ones.
       */
      placed.sort((a, b) => b.size.z - a.size.z)

      const gap = 0.26
      /**
       * The row width is MEASURED from the models, not fixed at 5.6 m.
       *
       * 5.6 was right for a kit of tankards and barrels and became wrong the
       * moment anything bigger than a row went in: the oak is 8.6 m across and
       * the mill 6.6, so each of them took a row to itself while the small
       * props packed four and five deep, and the arrangement stretched into a
       * long thin diagonal. A camera fits a bounding sphere, and the sphere
       * around a diagonal line is enormous next to the things in it -- the kit
       * ended up occupying about a quarter of its own picture with the rest
       * empty floor.
       *
       * Packing to roughly a SQUARE plan is what fixes that, and the width
       * that does it is the square root of the total footprint: rows then come
       * out about as deep as they are wide whatever is in the kit. The 1.24
       * covers the waste at the end of each row, and the floor is the widest
       * single model, since no row can be narrower than the thing standing
       * in it.
       */
      const footprint = placed.reduce(
        (sum, item) => sum + (item.size.x + gap) * (item.size.z + gap), 0,
      )
      const widest = placed.reduce((most, item) => Math.max(most, item.size.x), 0)
      const rowWidth = Math.max(widest, Math.sqrt(footprint) * 1.0)
      let cursorX = 0
      let cursorZ = 0
      let rowDepth = 0

      for (const item of placed) {
        // Anything as wide as most of a row takes the row to itself. The post
        // mill is 6.6 m across and 7 m deep, so whatever shared its row stood
        // at the front of seven metres of empty floor with the mill beside it
        // and a gap between them the width of the mill. One item, one row, and
        // the rest pack against each other instead of against it.
        const oversized = item.size.x > rowWidth * 0.6
        if (cursorX > 0 && (oversized || cursorX + item.size.x > rowWidth)) {
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
        if (oversized) {
          cursorX = 0
          cursorZ += rowDepth + gap
          rowDepth = 0
        }
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
  {
    namespace: '@contemporary-props',
    scheme: 'file:',
    rest: 'contemporary-props/dist/registry.json',
    entries: [...CONTEMPORARY_ORDER] as readonly string[],
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
  ...Object.fromEntries(CONTEMPORARY_ORDER.map((id) => [
    id,
    entryFor(id, '@contemporary-props', CONTEMPORARY_META, CONTEMPORARY_FACTORIES),
  ])),
}
