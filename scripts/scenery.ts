/**
 * The things the square needs that the kit does not contain: a floor, and
 * walls to be a square between.
 *
 * The kit is 37 props and no architecture, which is the right scope for it and
 * the wrong scope for a picture of a place. The first flythrough proved it: 47
 * models correctly placed on nothing at all read as a shop display, because
 * every object stood in its own patch of the same grey the sky was, and the
 * fences enclosed nothing because a 2.7 m rail on its own encloses nothing.
 *
 * So this file, and only this file, is geometry invented for the video. It is
 * kept apart from `square.ts` on purpose: everything there is the kit, and
 * everything here is scaffolding around it.
 */
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three/webgpu'

import {
  boxGeometry,
  createRandom,
  mergeColoured,
  taperedBoxGeometry,
} from '@/models/medieval-kit/core/index.ts'

/** One material for all of it: the rasteriser reads colour off the vertices. */
function surface(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 })
}

/** A palette entry moved, the way the models move theirs. */
function shift(base: Color, lightness: number, saturation = 1): Color {
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  return new Color().setHSL(hsl.h, Math.max(0, hsl.s * saturation), Math.max(0.004, hsl.l + lightness))
}

const EARTH = new Color(0x574b3c)
const PLASTER = new Color(0x9b8b70)
const TIMBER = new Color(0x4a3626)
const THATCH = new Color(0x6d4d29)
const DARK = new Color(0x1d1916)

/* ---------------------------------------------------------------- the floor */

/**
 * Packed earth, and enough of it that the camera never finds its edge.
 *
 * Two parts for one reason. The near field is a grid so the colour can vary
 * cell to cell, because a single flat quad of one colour under a lowpoly scene
 * reads as a sheet of paper the models were placed on. The far field is eight
 * big quads running out to 400 m, because a plane that stops 25 m away leaves
 * a band of sky UNDER the horizon, and at this focal length that band is forty
 * pixels of nothing.
 *
 * The wear is not decoration. A market square is worn where people walk, and
 * the darkening down the middle is what tells the eye that the lane the camera
 * travels is a lane rather than a gap in the props.
 */
export function groundGeometry(): BufferGeometry {
  const position: number[] = []
  const colour: number[] = []

  /**
   * Colour by CORNER, from a smooth function of position.
   *
   * The first attempt drew one seeded random colour per cell and produced a
   * chessboard, which is what a flat plane always produces when the only thing
   * varying across it is a per-face constant: there is no shading to break the
   * grid up, so the grid is all there is to see. Sampling a smooth function at
   * the corners lets the rasteriser interpolate between them, and the cell
   * boundaries stop existing.
   */
  const toneAt = (x: number, z: number): Color => {
    const broad = Math.sin(x * 0.107 - 0.7) * Math.sin(z * 0.131 + 0.4)
    const fine = Math.sin(x * 0.41 + 1.1) * Math.sin(z * 0.37 + 2.3)
    // Worn down the middle of the square and around the well: darker, greyer,
    // and it is what tells the eye the camera's lane is a lane.
    const lane = Math.exp(-((x - 0.2) ** 2) / 26 - ((z + 2) ** 2) / 150)
    return shift(EARTH, broad * 0.016 + fine * 0.008 - 0.032 * lane, 1 - 0.3 * lane)
  }

  const push = (x0: number, z0: number, x1: number, z1: number, flat?: Color): void => {
    // Wound so the face points up.
    const corners: [number, number][] = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]]
    const order = [0, 1, 2, 0, 2, 3]
    for (const at of order) {
      const [x, z] = corners[at]!
      const c = flat ?? toneAt(x, z)
      position.push(x, 0, z)
      colour.push(c.r, c.g, c.b)
    }
  }

  const near = { x0: -30, x1: 30, z0: -34, z1: 24 }
  const cell = 2.0
  for (let x = near.x0; x < near.x1 - 1e-6; x += cell) {
    for (let z = near.z0; z < near.z1 - 1e-6; z += cell) {
      push(x, z, x + cell, z + cell)
    }
  }

  const far = 400
  const skirt = shift(EARTH, -0.014)
  push(-far, -far, far, near.z0, skirt)
  push(-far, near.z1, far, far, skirt)
  push(-far, near.z0, near.x0, near.z1, skirt)
  push(near.x1, near.z0, far, near.z1, skirt)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colour), 3))
  return geometry
}

/** The floor, as its own group so it can be drawn before the shadows are. */
export function buildGround(): Group {
  const group = new Group()
  group.name = 'ground'
  group.add(new Mesh(groundGeometry(), surface()))
  return group
}

/* ------------------------------------------------------------- the frontage */

export interface HouseOptions {
  readonly width: number
  readonly depth: number
  /** Ground storey. The upper one is a little shorter. */
  readonly storey?: number
  /** How far the upper floor overhangs the lower, on the front only. */
  readonly jetty?: number
  readonly roof?: number
  /** Doorway in the front wall. Off for the ones seen end on. */
  readonly door?: boolean
  readonly seed?: number
}

/**
 * A timber-framed house, built the way one was: posts and rails with panels
 * between them, an upper floor jettied over the street, a thatched gable roof.
 *
 * Deliberately the plainest thing that reads: a plastered box would read as a
 * box, and the whole job of these is to be a wall the square happens against.
 * The frame is what does the reading, so the posts are proud of the panel by
 * 40 mm rather than flush with it, and the rails run the full width.
 */
export function houseGeometry(options: HouseOptions): BufferGeometry {
  const {
    width: W, depth: D, storey = 2.35, jetty = 0.28, roof = 1.7, door = true, seed = 3,
  } = options
  const random = createRandom(seed)
  const parts: BufferGeometry[] = []

  const post = 0.17
  const panel = shift(PLASTER, (random() - 0.5) * 0.05)
  const beam = shift(TIMBER, (random() - 0.5) * 0.04)
  const upper = storey * 0.86
  const upperW = W + jetty * 2
  const upperD = D + jetty

  // Ground storey: panel first, frame proud of it.
  parts.push(boxGeometry([W, storey, D], [0, storey / 2, 0], panel))
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(boxGeometry(
        [post, storey, post],
        [sx * (W / 2 - post / 2), storey / 2, sz * (D / 2 - post / 2)],
        beam,
      ))
    }
  }
  // Mid post and the sill and head rails on the front.
  parts.push(boxGeometry([post * 0.8, storey, post * 0.8], [0, storey / 2, D / 2 - post / 2], beam))
  for (const y of [post * 0.6, storey - post * 0.6]) {
    parts.push(boxGeometry([W, post * 0.9, post * 0.9], [0, y, D / 2 - post / 2], beam))
  }

  if (door) {
    const dw = Math.min(0.95, W * 0.24)
    parts.push(boxGeometry([dw, storey * 0.72, 0.1], [-W * 0.22, storey * 0.36, D / 2 + 0.01], DARK))
    parts.push(boxGeometry([dw + 0.16, post, 0.14], [-W * 0.22, storey * 0.72, D / 2 + 0.02], beam))
  }
  /**
   * An opening, framed.
   *
   * A dark rectangle on its own reads as a sticker on the wall, because
   * nothing about it is carpentry: no sill to shed water, no lintel carrying
   * the wall above, no mullion to divide a span nobody could glaze in one
   * piece. Three boards is all it takes and it is the difference between a
   * window and a black patch.
   */
  const opening = (w: number, h: number, cx: number, cy: number, z: number): void => {
    parts.push(boxGeometry([w, h, 0.09], [cx, cy, z], DARK))
    const rail = 0.1
    parts.push(boxGeometry([w + 0.14, rail, 0.13], [cx, cy - h / 2 - rail / 2, z + 0.05], beam))
    parts.push(boxGeometry([w + 0.14, rail, 0.13], [cx, cy + h / 2 + rail / 2, z + 0.05], beam))
    parts.push(boxGeometry([rail * 0.7, h, 0.11], [cx, cy, z + 0.05], shift(beam, -0.015)))
  }

  opening(W * 0.22, storey * 0.26, W * 0.24, storey * 0.62, D / 2 + 0.01)

  // Upper storey, jettied forward over the street.
  const upperY = storey + upper / 2
  const upperZ = jetty / 2
  parts.push(boxGeometry([upperW, upper, upperD], [0, upperY, upperZ], shift(panel, 0.012)))
  for (const sx of [-1, 1]) {
    parts.push(boxGeometry(
      [post, upper, post],
      [sx * (upperW / 2 - post / 2), upperY, upperD / 2 + upperZ - post / 2],
      beam,
    ))
  }
  // The bressummer: the beam the jetty sits on, and the one detail that makes
  // the overhang read as carpentry instead of as a wider box.
  parts.push(boxGeometry(
    [upperW, post * 1.3, post * 1.3],
    [0, storey + post * 0.5, upperD / 2 + upperZ - post * 0.5],
    shift(beam, -0.02),
  ))
  opening(upperW * 0.34, upper * 0.3, 0, upperY + upper * 0.12, upperD / 2 + upperZ + 0.01)

  // Thatch. Tapered to a ridge along X, with the eaves out past the walls so
  // the wall below sits in its shadow rather than ending in mid air.
  const eave = 0.42
  parts.push(taperedBoxGeometry(
    [upperW + eave * 2, upperD + eave * 2],
    [upperW + eave * 2, 0.16],
    roof,
    [0, storey + upper + roof / 2, upperZ],
    shift(THATCH, (random() - 0.5) * 0.03),
  ))

  return mergeColoured(parts)
}

export interface HousePlacement {
  readonly at: readonly [number, number]
  readonly yaw: number
  readonly options: HouseOptions
}

/**
 * Where the frontage stands.
 *
 * Three sides, and the fourth left open because that is the one the camera
 * comes in through. They are turned to face the middle rather than set square,
 * because a square whose walls are all parallel reads as a corridor.
 */
export const HOUSES: readonly HousePlacement[] = [
  { at: [-13.6, -2.4], yaw: Math.PI / 2 + 0.1, options: { width: 7.0, depth: 4.4, seed: 3 } },
  { at: [-13.0, 4.4], yaw: Math.PI / 2 - 0.2, options: { width: 5.4, depth: 4.0, seed: 11, roof: 1.5 } },
  { at: [-12.4, -9.6], yaw: Math.PI / 2 + 0.3, options: { width: 5.0, depth: 3.8, seed: 31, roof: 1.4 } },
  { at: [13.8, -1.8], yaw: -Math.PI / 2 - 0.08, options: { width: 6.6, depth: 4.2, seed: 7 } },
  { at: [13.2, 5.0], yaw: -Math.PI / 2 + 0.16, options: { width: 5.0, depth: 3.8, seed: 19, roof: 1.5 } },
  { at: [12.6, -8.8], yaw: -Math.PI / 2 - 0.26, options: { width: 5.2, depth: 3.8, seed: 37, roof: 1.4 } },
  { at: [-6.4, -13.4], yaw: 0.14, options: { width: 6.0, depth: 4.0, seed: 23, door: false } },
  { at: [6.2, -13.0], yaw: -0.18, options: { width: 5.6, depth: 3.8, seed: 29, door: false } },
]

/** The frontage, as one group. Shadows and depth like anything else. */
export function buildHouses(): Group {
  const group = new Group()
  group.name = 'frontage'
  const material = surface()
  for (const house of HOUSES) {
    const mesh = new Mesh(houseGeometry(house.options), material)
    mesh.rotation.y = house.yaw
    mesh.position.set(house.at[0], 0, house.at[1])
    group.add(mesh)
  }
  return group
}
