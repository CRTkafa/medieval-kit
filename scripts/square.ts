/**
 * The market square: the kit arranged as a place rather than as a catalogue.
 *
 * The whole-kit scene in `catalog.ts` packs the models onto shelves, which is
 * the right picture for the question it answers: laid out in rows on one ground
 * plane, a model whose scale or tone is off has nowhere to hide. It is the
 * wrong picture for a camera to move through, because rows read as rows and a
 * camera travelling down one is travelling down a shelf.
 *
 * This is the other picture. Objects stand where somebody would have put them:
 * the anvil beside the forge, tankards on the tavern table, tools leaning on
 * the fence they were left against, the mill behind all of it. Nothing here is
 * packed or fitted; every position is authored, which is the point.
 *
 * Coordinates are metres. +X is right, +Z is toward the camera's entry, and the
 * mill sits at the far end so that a camera coming in from +Z has something to
 * arrive at. The lane between roughly x = -1.5 and x = +3 is kept clear from
 * the front edge to the well, because that is where the camera goes.
 */
import { Box3, Group, Vector3 } from 'three/webgpu'

import { FACTORIES } from '@/catalog.ts'

import { buildGround, buildHouses } from './scenery.ts'

export interface Placement {
  readonly id: string
  /** Footprint centre, in metres. */
  readonly at: readonly [number, number]
  /** Turn about the vertical, radians. */
  readonly yaw?: number
  /**
   * Tilt about X and Z, for the things that are leaning on something.
   *
   * A ladder standing upright in the open reads as a prop nobody used. Leaned
   * against the stall it reads as a ladder. The tilt is applied before the
   * model is seated, so a leaning object still touches the ground.
   */
  readonly lean?: readonly [number, number]
  /** Height to seat it at. The tavern table's top is 0.68. */
  readonly on?: number
  readonly patch?: Record<string, number>
}

/**
 * Where everything stands.
 *
 * Every model in the kit appears at least once, because the scene is also the
 * catalogue's advertisement and a model left out of it is a model nobody sees.
 * Several appear more than once for the opposite reason: one barrel is a prop,
 * two barrels and a crate are a market.
 */
/**
 * The square's edges, tiled from one model.
 *
 * The rail is 2.70 m wide, so a run is that pitch with a few hundredths of a
 * radian of wander on each post: a fence built by people is never straight, and
 * a row of identical modules at exactly one angle reads as a repeated asset,
 * which is the one thing it must not read as.
 */
const FENCE_RUNS: readonly Placement[] = [
  ...[-8.6, -5.9, -3.2, -0.5, 2.2, 4.9].map((z, i): Placement => ({
    id: 'wooden-fence',
    at: [-10.5 + (i % 2) * 0.06, z],
    yaw: Math.PI / 2 + (i % 3 - 1) * 0.018,
  })),
  ...[-8.6, -5.9, -3.2, -0.5, 2.2, 4.9].map((z, i): Placement => ({
    id: 'wooden-fence',
    at: [10.5 - (i % 2) * 0.06, z],
    yaw: Math.PI / 2 - (i % 3 - 1) * 0.018,
  })),
  ...[-8.1, -5.4, -2.7, 0, 2.7, 5.4].map((x, i): Placement => ({
    id: 'wooden-fence',
    at: [x, -11.6 + (i % 2) * 0.05],
    yaw: (i % 3 - 1) * 0.02,
  })),
]

export const SQUARE: readonly Placement[] = [
  // --- The mill and the yard behind it ------------------------------------
  { id: 'post-mill', at: [-0.38, -7.02], yaw: 0.25 },
  { id: 'log-pile', at: [-3.75, -5.93], yaw: 0.3 },
  { id: 'hay-bale', at: [3.45, -6.08], yaw: -0.2 },
  { id: 'hay-bale', at: [4.28, -5.38], yaw: 0.4 },


  // --- The forge, on the left ----------------------------------------------
  { id: 'forge-hearth', at: [-4.8, -2.81], yaw: 0.42 },
  { id: 'iron-anvil', at: [-3.53, -2.03], yaw: -0.5 },
  { id: 'grindstone', at: [-5.18, -1.09], yaw: 0.25 },
  { id: 'wooden-bucket', at: [-4.05, -1.17] },
  { id: 'iron-cauldron', at: [-6.0, -3.59], yaw: 0.2 },
  { id: 'round-shield', at: [-3.97, -3.59], yaw: 0.5, lean: [-0.28, 0] },
  { id: 'straw-broom', at: [-5.7, -1.87], lean: [0.16, 0.1] },
  { id: 'pitch-torch', at: [-6.0, -0.47] },
  { id: 'wooden-crate', at: [-4.43, -0.31], yaw: 0.35 },

  // --- The tavern, on the right --------------------------------------------
  { id: 'tavern-sign', at: [4.72, -2.65], yaw: -0.35 },
  { id: 'trestle-table', at: [3.68, -1.09], yaw: 0.18 },
  { id: 'wooden-bench', at: [3.68, -0.35], yaw: 0.18 },
  { id: 'wooden-bench', at: [3.68, -1.83], yaw: 0.18 },
  { id: 'wooden-stool', at: [4.72, -0.78], yaw: -0.4 },
  { id: 'oak-tankard', at: [3.34, -1.17], on: 0.68 },
  { id: 'oak-tankard', at: [3.86, -0.98], on: 0.68 },
  { id: 'leather-book', at: [4.01, -1.25], on: 0.68, yaw: 0.3 },
  { id: 'glass-phial', at: [3.56, -1.29], on: 0.68 },
  { id: 'coin-pouch', at: [3.71, -0.94], on: 0.68, yaw: -0.4 },
  { id: 'iron-lantern', at: [4.16, -1.05], on: 0.68 },
  { id: 'wooden-chest', at: [5.25, -1.87], yaw: -0.3 },
  { id: 'wooden-barrel', at: [5.47, -0.7] },

  // --- The square itself ---------------------------------------------------
  { id: 'stone-well', at: [0.3, -2.34], yaw: 0.15 },
  { id: 'stone-trough', at: [-1.58, -1.25], yaw: 0.55 },
  { id: 'bronze-bell', at: [1.72, -3.28], yaw: -0.25 },

  // --- The stall, front left -----------------------------------------------
  { id: 'market-stall', at: [-2.55, 1.4], yaw: 0.22 },
  { id: 'vegetables', at: [-2.92, 1.99], yaw: 0.1 },
  { id: 'wicker-basket', at: [-2.03, 2.03] },
  { id: 'linen-sack', at: [-3.45, 1.87], yaw: 0.3 },
  { id: 'wooden-crate', at: [-3.97, 1.33], yaw: 0.45 },
  { id: 'wooden-barrel', at: [-1.58, 2.11] },
  { id: 'wooden-ladder', at: [-4.8, 0.94], yaw: 0.3, lean: [0.22, 0] },

  // --- The cart and the tools, front right ---------------------------------
  { id: 'hand-cart', at: [2.7, 1.87], yaw: -0.4 },
  { id: 'cart-wheel', at: [4.43, 1.25], yaw: -0.6, lean: [-0.2, 0] },
  { id: 'wooden-hoe', at: [5.03, 0.31], yaw: 0.2, lean: [0.18, 0.1] },
  { id: 'wooden-shovel', at: [5.21, 0.58], yaw: 0.1, lean: [0.2, 0.06] },
  { id: 'wooden-pitchfork', at: [5.4, 0.86], yaw: -0.1, lean: [0.16, -0.08] },
  { id: 'wooden-stool', at: [1.95, 1.17], yaw: 0.5 },
  { id: 'pitch-torch', at: [1.5, 0.16] },
  // The boundary, and it is the kit's own fence rather than anything invented:
  // 2.7 m modules run end to end down both sides and across the back. A kit
  // whose fence cannot make a fence is not much of a fence.
  ...FENCE_RUNS,
  // Foreground, so the near half of the frame is not bare floor. A camera at
  // standing height sees a lot of ground and nothing else unless something is
  // close enough to pass it.
  { id: 'wooden-crate', at: [4.6, 4.2], yaw: -0.3 },
  { id: 'wooden-barrel', at: [5.6, 3.4] },
  { id: 'linen-sack', at: [4.0, 4.7], yaw: 0.5 },
  { id: 'hay-bale', at: [-8.6, 2.6], yaw: 0.3 },
  { id: 'pitch-torch', at: [-2.2, -6.0] },
]

/**
 * What is switched on before the camera arrives.
 *
 * Every one of these is off by default, which is right for a catalogue picture
 * and wrong for a place: an unlit forge is a stone box, and a mill whose sails
 * are stopped is the one thing in the scene a viewer will read as broken.
 */
const WAKE: Readonly<Record<string, (actions: Record<string, (arg?: unknown) => unknown>) => void>> = {
  'post-mill': (a) => { a.setTurning?.(true) },
  'forge-hearth': (a) => { a.setLit?.(true) },
  'iron-cauldron': (a) => { a.setLit?.(true) },
  'pitch-torch': (a) => { a.setLit?.(true) },
  'iron-lantern': (a) => { a.setLit?.(true) },
  'grindstone': (a) => { a.crank?.() },
  'tavern-sign': (a) => { a.push?.() },
}

export interface Square {
  readonly root: Group
  /**
   * The floor, kept out of `root` so it can be drawn before the shadows.
   *
   * A ground plane rasterised with everything else paints over every contact
   * shadow in the picture, and being on the floor itself, darkens itself from
   * edge to edge.
   */
  readonly ground: Group
  /** Called once per frame, so the sails turn and the forge burns. */
  readonly update: (seconds: number) => void
  readonly dispose: () => void
  readonly height: number
}

/** Builds the square. Every placement is a fresh model, so repeats are cheap. */
export function buildSquare(
  layout: readonly Placement[] = SQUARE,
  options: { readonly houses?: boolean } = {},
): Square {
  const root = new Group()
  root.name = 'market-square'
  const built: { update?: (s: number) => void; dispose: () => void }[] = []

  for (const spot of layout) {
    const make = FACTORIES[spot.id]
    if (!make) throw new Error(`not in catalog: ${spot.id}`)
    const model = make()
    if (spot.patch) model.configure(spot.patch)

    const [lx, lz] = spot.lean ?? [0, 0]
    model.root.rotation.set(lx, spot.yaw ?? 0, lz)
    model.root.updateMatrixWorld(true)

    // Seat it AFTER the turn: the box of a leaning ladder is not the box of a
    // standing one, and seating on the standing box leaves it in the air.
    const box = new Box3().setFromObject(model.root)
    const centre = box.getCenter(new Vector3())
    model.root.position.set(
      spot.at[0] - centre.x,
      (spot.on ?? 0) - box.min.y,
      spot.at[1] - centre.z,
    )
    WAKE[spot.id]?.(model.actions as Record<string, (arg?: unknown) => unknown>)
    root.add(model.root)
    built.push(model)
  }

  if (options.houses !== false) root.add(buildHouses())
  root.updateMatrixWorld(true)
  const ground = buildGround()
  ground.updateMatrixWorld(true)
  const height = new Box3().setFromObject(root).getSize(new Vector3()).y

  return {
    root,
    ground,
    height,
    update: (seconds: number) => {
      for (const model of built) model.update?.(seconds)
      root.updateMatrixWorld(true)
    },
    dispose: () => {
      for (const model of built) model.dispose()
    },
  }
}
