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

/**
 * The heights of the things you can put something down on, measured off the
 * models rather than guessed.
 *
 * Guessing is how a basket ends up hovering a centimetre over a stall, or sunk
 * into it, and at this scale both are visible. `on` seats a model's underside
 * at the number given, so these are surfaces above the ground.
 */
const COUNTER = 0.781   // market stall, under its awning
const TABLE = 0.68      // trestle table
const CART_BED = 0.402  // hand cart, inside the sides
const CRATE = 0.52
const BARREL = 1.05
const BALE = 0.80
const CHEST = 0.51
const BENCH = 0.45
const TROUGH = 0.51
const LOGS = 0.58

/** A placement written relative to whatever it belongs to. */
interface Local {
  readonly id: string
  /** Offset from the anchor, in the anchor's own axes. +X is to its right. */
  readonly at: readonly [number, number]
  readonly on?: number
  readonly yaw?: number
  readonly lean?: readonly [number, number]
  readonly patch?: Record<string, number>
}

/**
 * Puts things down relative to something else.
 *
 * A stall turned to face the square has its counter somewhere that depends on
 * which way it is turned, so writing the basket's position in world
 * coordinates means recomputing four numbers by hand every time the stall
 * moves a degree. Nobody does that twice; what they do instead is stop putting
 * anything on the stall, which is exactly how the first pass came out.
 */
function around(
  anchor: readonly [number, number],
  yaw: number,
  items: readonly Local[],
): Placement[] {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return items.map((item) => ({
    id: item.id,
    at: [
      anchor[0] + item.at[0] * cos + item.at[1] * sin,
      anchor[1] - item.at[0] * sin + item.at[1] * cos,
    ] as const,
    yaw: yaw + (item.yaw ?? 0),
    on: item.on,
    lean: item.lean,
    patch: item.patch,
  }))
}

/**
 * A stall and what is on it.
 *
 * The counter is 1.51 by 0.75 and the awning posts stand at its corners, so
 * goods live between x -0.6 and +0.6 and z -0.25 and +0.25 of the middle;
 * anything wider than that intersects a post.
 */
function stall(
  at: readonly [number, number],
  yaw: number,
  goods: readonly Local[],
): Placement[] {
  return [
    ...around(at, yaw, [{ id: 'market-stall', at: [0, 0] }]),
    ...around(at, yaw, goods),
  ]
}

export const SQUARE: readonly Placement[] = [
  // --- The mill, and the yard behind it ------------------------------------
  { id: 'post-mill', at: [-0.38, -7.02], yaw: 0.25 },
  ...around([-4.6, -8.2], 0.3, [
    { id: 'log-pile', at: [0, 0] },
    { id: 'log-pile', at: [1.05, 0.12], yaw: 0.1 },
    { id: 'log-pile', at: [0.5, -0.02], on: LOGS, yaw: 0.06 },
    { id: 'linen-sack', at: [-0.9, 0.5], yaw: 0.4 },
    { id: 'wooden-crate', at: [-1.6, 0.1], yaw: 0.3 },
  ]),
  ...around([4.5, -8.0], -0.2, [
    { id: 'hay-bale', at: [0, 0] },
    { id: 'hay-bale', at: [1.12, 0.15], yaw: 0.4 },
    { id: 'hay-bale', at: [0.56, 0.06], on: BALE, yaw: 0.22 },
    { id: 'linen-sack', at: [-0.85, 0.55], yaw: -0.3 },
    { id: 'linen-sack', at: [-1.15, 0.3], yaw: 0.6 },
    { id: 'wooden-pitchfork', at: [-1.5, -0.4], yaw: 0.5, lean: [0.2, 0.1] },
  ]),

  // --- The market row, down the left side ----------------------------------
  //
  // Four stalls, turned a little further toward the square as they go back so
  // the row reads as a row and not as a wall. Everything on a counter sits at
  // COUNTER; everything at the foot of one is what did not fit on it.
  ...stall([-6.9, 3.0], -1.32, [
    { id: 'vegetables', at: [-0.42, -0.06], on: COUNTER },
    { id: 'vegetables', at: [0.16, 0.04], on: COUNTER, yaw: 0.7 },
    { id: 'wicker-basket', at: [0.54, -0.08], on: COUNTER, yaw: 0.3 },
    { id: 'wooden-crate', at: [-0.95, 0.55], yaw: 0.25 },
    { id: 'wooden-crate', at: [-0.95, 0.55], on: CRATE, yaw: 0.5 },
    { id: 'vegetables', at: [-0.95, 0.55], on: CRATE * 2, yaw: -0.3 },
    { id: 'wicker-basket', at: [0.9, 0.6], yaw: -0.2 },
    { id: 'linen-sack', at: [1.25, 0.35], yaw: 0.5 },
  ]),
  ...stall([-7.2, 0.85], -1.45, [
    { id: 'linen-sack', at: [-0.45, 0], on: COUNTER, yaw: 0.2 },
    { id: 'linen-sack', at: [-0.12, 0.06], on: COUNTER, yaw: -0.5 },
    { id: 'wicker-basket', at: [0.3, -0.05], on: COUNTER },
    { id: 'wicker-basket', at: [0.62, 0.05], on: COUNTER, yaw: 0.8 },
    { id: 'linen-sack', at: [-1.05, 0.5], yaw: 0.1 },
    { id: 'linen-sack', at: [-0.78, 0.62], yaw: 0.9 },
    { id: 'linen-sack', at: [-0.92, 0.56], on: 0.5, yaw: -0.4 },
    { id: 'wooden-crate', at: [1.0, 0.5], yaw: -0.35 },
  ]),
  ...stall([-7.5, -1.35], -1.55, [
    { id: 'oak-tankard', at: [-0.5, -0.05], on: COUNTER },
    { id: 'oak-tankard', at: [-0.32, 0.08], on: COUNTER, yaw: 0.6 },
    { id: 'oak-tankard', at: [-0.13, -0.02], on: COUNTER, yaw: -0.4 },
    { id: 'glass-phial', at: [0.22, 0.02], on: COUNTER },
    { id: 'glass-phial', at: [0.33, -0.06], on: COUNTER, yaw: 0.9 },
    { id: 'wooden-barrel', at: [1.05, 0.35], yaw: 0.2 },
    { id: 'wooden-barrel', at: [1.15, -0.55], yaw: -0.3 },
    { id: 'oak-tankard', at: [1.05, 0.35], on: BARREL, yaw: 0.3 },
  ]),
  ...stall([-7.8, -3.5], -1.62, [
    { id: 'leather-book', at: [-0.48, 0], on: COUNTER, yaw: 0.15 },
    { id: 'leather-book', at: [-0.2, 0.06], on: COUNTER, yaw: -0.6 },
    { id: 'coin-pouch', at: [0.08, -0.04], on: COUNTER, yaw: 0.4 },
    { id: 'glass-phial', at: [0.34, 0.03], on: COUNTER },
    { id: 'iron-lantern', at: [0.58, -0.02], on: COUNTER, yaw: 0.2 },
    { id: 'wooden-chest', at: [1.0, 0.45], yaw: -0.4 },
    { id: 'coin-pouch', at: [1.0, 0.45], on: CHEST, yaw: 0.7 },
    { id: 'straw-broom', at: [-1.15, -0.35], yaw: 0.3, lean: [0.18, 0.1] },
  ]),
  { id: 'wooden-ladder', at: [-9.3, 4.6], yaw: 0.35, lean: [0.22, 0] },
  { id: 'pitch-torch', at: [-6.2, 4.4] },
  { id: 'pitch-torch', at: [-6.6, -4.6] },

  // --- The forge, back left ------------------------------------------------
  ...around([-6.4, -6.0], 0.42, [
    { id: 'forge-hearth', at: [0, 0] },
    { id: 'iron-anvil', at: [1.7, 0.75], yaw: -0.9 },
    { id: 'grindstone', at: [-0.4, 1.75], yaw: -0.2 },
    { id: 'wooden-bucket', at: [1.15, 1.6] },
    { id: 'iron-cauldron', at: [-1.7, -0.1], yaw: -0.2 },
    { id: 'round-shield', at: [1.05, -0.85], yaw: 0.1, lean: [-0.3, 0] },
    { id: 'log-pile', at: [2.5, -0.3], yaw: 0.2 },
    { id: 'wooden-crate', at: [2.45, 1.5], yaw: 0.35 },
    { id: 'wooden-crate', at: [2.45, 1.5], on: CRATE, yaw: 0.05 },
    { id: 'wooden-shovel', at: [-1.2, 1.5], yaw: 0.2, lean: [0.2, 0.06] },
    { id: 'wooden-hoe', at: [-1.45, 1.7], yaw: 0.35, lean: [0.18, 0.12] },
  ]),

  // --- The middle: the well and what gathers at it -------------------------
  ...around([0.4, -2.34], 0.15, [
    { id: 'stone-well', at: [0, 0] },
    { id: 'wooden-bucket', at: [1.15, 0.35], yaw: 0.4 },
    { id: 'wooden-bucket', at: [1.42, 0.1], yaw: -0.3 },
    { id: 'stone-trough', at: [-2.4, 0.9], yaw: 0.4 },
    { id: 'wooden-bucket', at: [-1.6, 1.35], yaw: 0.7 },
  ]),
  { id: 'bronze-bell', at: [1.73, -4.4], yaw: -0.25 },
  { id: 'pitch-torch', at: [-1.4, -0.5] },

  // --- The tavern, down the right side -------------------------------------
  ...around([4.7, -1.6], 0.18, [
    { id: 'trestle-table', at: [0, 0] },
    { id: 'wooden-bench', at: [0, 0.95] },
    { id: 'wooden-bench', at: [0, -0.95] },
    { id: 'oak-tankard', at: [-0.45, -0.06], on: TABLE },
    { id: 'oak-tankard', at: [-0.2, 0.1], on: TABLE, yaw: 0.5 },
    { id: 'oak-tankard', at: [0.28, -0.09], on: TABLE, yaw: -0.7 },
    { id: 'leather-book', at: [0.5, 0.12], on: TABLE, yaw: 0.3 },
    { id: 'glass-phial', at: [0.06, 0.16], on: TABLE },
    { id: 'coin-pouch', at: [-0.6, 0.14], on: TABLE, yaw: -0.4 },
    { id: 'iron-lantern', at: [0.62, -0.1], on: TABLE, yaw: 0.2 },
    { id: 'oak-tankard', at: [0.55, 0.95], on: BENCH, yaw: 0.4 },
    { id: 'wooden-stool', at: [1.25, 0.25], yaw: -0.5 },
  ]),
  ...around([5.9, -3.9], -0.3, [
    { id: 'trestle-table', at: [0, 0], yaw: 0.25 },
    { id: 'wooden-stool', at: [-0.05, 0.85], yaw: 0.4 },
    { id: 'wooden-stool', at: [0.15, -0.8], yaw: -0.6 },
    { id: 'oak-tankard', at: [0.1, 0.05], on: TABLE, yaw: 0.2 },
    { id: 'oak-tankard', at: [-0.3, -0.05], on: TABLE, yaw: -0.5 },
    { id: 'wooden-barrel', at: [1.35, 0.6], yaw: 0.15 },
    { id: 'wooden-barrel', at: [1.45, -0.35], yaw: -0.4 },
    { id: 'wooden-crate', at: [1.4, 1.5], yaw: 0.3 },
  ]),
  { id: 'tavern-sign', at: [6.2, -0.2], yaw: -1.5 },
  { id: 'pitch-torch', at: [4.3, -3.4] },
  { id: 'wooden-chest', at: [7.3, -2.6], yaw: -0.35 },

  // --- The front, where the camera comes in --------------------------------
  ...around([3.1, 2.3], -0.4, [
    { id: 'hand-cart', at: [0, 0] },
    { id: 'wooden-crate', at: [0, -0.4], on: CART_BED, yaw: 0.15 },
    { id: 'linen-sack', at: [0.02, 0.35], on: CART_BED, yaw: 0.5 },
    { id: 'linen-sack', at: [-0.1, 0.1], on: CART_BED, yaw: -0.3 },
    { id: 'wooden-crate', at: [1.35, 0.9], yaw: 0.4 },
    { id: 'wooden-crate', at: [1.35, 0.9], on: CRATE, yaw: 0.1 },
    { id: 'wicker-basket', at: [1.35, 0.9], on: CRATE * 2, yaw: -0.4 },
  ]),
  ...around([6.4, 2.6], -0.6, [
    { id: 'wooden-barrel', at: [0, 0] },
    { id: 'wooden-barrel', at: [0.9, 0.2], yaw: 0.3 },
    { id: 'wooden-crate', at: [0.45, 1.0], yaw: -0.2 },
    { id: 'linen-sack', at: [-0.7, 0.75], yaw: 0.4 },
    { id: 'cart-wheel', at: [-0.95, -0.3], yaw: -0.3, lean: [-0.2, 0] },
  ]),
  { id: 'pitch-torch', at: [1.3, 1.6] },
  { id: 'wooden-stool', at: [1.4, 3.4], yaw: 0.5 },
  { id: 'wooden-hoe', at: [9.6, 0.4], yaw: 0.2, lean: [0.2, 0.1] },
  { id: 'wooden-shovel', at: [9.75, 0.75], yaw: 0.1, lean: [0.22, 0.06] },
  { id: 'wooden-pitchfork', at: [9.9, 1.1], yaw: -0.1, lean: [0.18, -0.08] },
  { id: 'cart-wheel', at: [-9.9, -2.2], yaw: 1.5, lean: [-0.18, 0] },
  { id: 'hay-bale', at: [-9.7, 6.2], yaw: 0.3 },

  // --- What spills into the walk ------------------------------------------
  //
  // The camera goes down this lane at 1.45 m, and at that height a scene with
  // nothing inside three metres is a third of a frame of bare floor however
  // good the rest of it is. These are the overflow: what a stall could not fit
  // on its counter, standing where it was put down.
  ...around([3.2, 6.6], -0.5, [
    { id: 'wooden-barrel', at: [0, 0] },
    { id: 'wooden-crate', at: [0.85, 0.3], yaw: 0.3 },
    { id: 'linen-sack', at: [-0.55, 0.5], yaw: 0.2 },
  ]),
  ...around([-5.6, 4.4], 0.25, [
    { id: 'wooden-crate', at: [0, 0] },
    { id: 'wooden-crate', at: [0, 0], on: CRATE, yaw: 0.4 },
    { id: 'wicker-basket', at: [0, 0], on: CRATE * 2, yaw: -0.3 },
    { id: 'linen-sack', at: [0.8, 0.35], yaw: 0.5 },
  ]),
  ...around([-5.9, 2.1], -0.3, [
    { id: 'linen-sack', at: [0, 0] },
    { id: 'linen-sack', at: [0.4, 0.25], yaw: 0.8 },
    { id: 'linen-sack', at: [0.2, 0.12], on: 0.5, yaw: -0.4 },
    { id: 'wicker-basket', at: [0.85, -0.3], yaw: 0.2 },
  ]),
  ...around([-6.0, -0.3], 0.4, [
    { id: 'wooden-barrel', at: [0, 0] },
    { id: 'wooden-barrel', at: [0.88, 0.22], yaw: 0.3 },
    { id: 'wicker-basket', at: [0, 0], on: BARREL, yaw: 0.5 },
    { id: 'wooden-crate', at: [0.4, 1.0], yaw: -0.35 },
  ]),
  ...around([-5.7, -2.7], -0.2, [
    { id: 'wooden-crate', at: [0, 0] },
    { id: 'vegetables', at: [0, 0], on: CRATE, yaw: 0.4 },
    { id: 'linen-sack', at: [0.75, 0.3], yaw: -0.5 },
  ]),
  ...around([-0.5, 3.3], 0.3, [
    { id: 'wooden-barrel', at: [0, 0] },
    { id: 'wooden-barrel', at: [0.9, -0.25], yaw: -0.4 },
    { id: 'oak-tankard', at: [0, 0], on: BARREL, yaw: 0.2 },
  ]),
  ...around([-1.9, 0.5], -0.4, [
    { id: 'wooden-crate', at: [0, 0] },
    { id: 'linen-sack', at: [0.7, 0.2], yaw: 0.6 },
    { id: 'wicker-basket', at: [0, 0], on: CRATE, yaw: -0.2 },
  ]),

  ...FENCE_RUNS,
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

/**
 * Where a fire is, and how high its flame sits above where the model stands.
 *
 * Reported by the builder rather than written down beside it, because a torch
 * that gets moved and a light that does not is worse than no light at all.
 */
export const FIRE_HEIGHT: Readonly<Record<string, number>> = {
  'pitch-torch': 0.78,
  'forge-hearth': 1.06,
  'iron-cauldron': 0.42,
  'iron-lantern': 0.16,
}

export interface Square {
  readonly root: Group
  /** Every lit thing in the scene, in world space. */
  readonly fires: readonly { at: Vector3; id: string }[]
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
  const fires: { at: Vector3; id: string }[] = []

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
    const flame = FIRE_HEIGHT[spot.id]
    if (flame !== undefined) {
      fires.push({ id: spot.id, at: new Vector3(spot.at[0], (spot.on ?? 0) + flame, spot.at[1]) })
    }
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
    fires,
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
