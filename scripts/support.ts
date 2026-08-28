/**
 * "Nothing may float." — the kit's hardest structural rule, made measurable.
 *
 * Every other check in this repo asks about surfaces: is the winding right, do
 * two faces share a plane, is the triangle count sane. None of them can see the
 * failure that actually ruins a prop, which is a piece of it hanging in the air
 * with nothing holding it up. A chest lid separated from its chest is not a
 * subtle shading artefact; it is the model being wrong, and it survived every
 * check we had.
 *
 * The test: voxelise the model, find the connected components of occupied
 * space, and require each one to be supported. A component is supported when it
 * reaches the ground plane, or — for props that hang from a wall or a beam —
 * when the model is a single connected mass, because then whatever holds the
 * mass holds all of it.
 *
 * Two things this deliberately does NOT do:
 *
 *   - It does not care about physics beyond contact. A plank balanced on one
 *     corner passes. Modelling centre of mass would reject a lot of correct
 *     medieval carpentry, which leans and props things at angles.
 *   - It does not treat "touching" as "sharing a vertex". These models are
 *     built from separately generated solids that interpenetrate on purpose
 *     (that is the z-fighting rule), so contact is spatial, not topological.
 */
import { Box3, Mesh, Vector3, type Object3D } from 'three/webgpu'

export interface FloatingPiece {
  /** Mesh names contributing to this component. */
  readonly parts: readonly string[]
  /** How many voxels the component occupies — a rough size. */
  readonly voxels: number
  /** Height of its lowest point above the model's floor, in metres. */
  readonly clearance: number
  /** Where it is, for putting into a message. */
  readonly at: readonly [number, number, number]
}

export interface SupportReport {
  /** Every component, floating or not — for diagnosis. */
  readonly all: readonly FloatingPiece[]
  readonly components: number
  readonly floating: readonly FloatingPiece[]
  readonly voxel: number
}

export interface SupportOptions {
  /**
   * `ground`  — every component must reach the floor.
   * `hanging` — the model hangs from something outside itself (a wall bracket,
   *             a yoke), so it only has to be ONE connected mass.
   */
  readonly support?: 'ground' | 'hanging'
  /** Voxels across the model's longest axis. Higher is stricter and slower. */
  readonly resolution?: number
}

interface Cell {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly parts: Set<string>
}

/**
 * Samples a triangle densely enough that no voxel it crosses is missed.
 *
 * Sampling by area rather than a fixed count matters: these models mix a
 * 0.9 m² table top with 2 mm chamfer slivers, and a fixed count would either
 * miss the big faces or spend all its time on the small ones.
 */
function* sampleTriangle(
  a: Vector3, b: Vector3, c: Vector3, step: number,
): Generator<Vector3> {
  const ab = new Vector3().subVectors(b, a)
  const ac = new Vector3().subVectors(c, a)
  const rows = Math.max(1, Math.ceil(Math.max(ab.length(), ac.length()) / step))
  for (let i = 0; i <= rows; i += 1) {
    for (let j = 0; j <= rows - i; j += 1) {
      const u = i / rows
      const v = j / rows
      yield new Vector3(
        a.x + ab.x * u + ac.x * v,
        a.y + ab.y * u + ac.y * v,
        a.z + ab.z * u + ac.z * v,
      )
    }
  }
}

export function findFloating(root: Object3D, options: SupportOptions = {}): SupportReport {
  const resolution = options.resolution ?? 88
  const mode = options.support ?? 'ground'

  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = box.getSize(new Vector3())
  const extent = Math.max(size.x, size.y, size.z, 1e-4)
  const voxel = extent / resolution

  // --- 1. Occupancy ---------------------------------------------------------
  const cells = new Map<string, Cell>()
  const vertex = new Vector3()
  root.traverse((object) => {
    // `.isMesh`, not `instanceof Mesh`. Two copies of three can be loaded at
    // once (plain `three` and `three/webgpu` are separate builds, and a second
    // project brings its own install), and across copies instanceof matches
    // nothing at all. The failure is silent and total: the traversal samples
    // no geometry, finds no components, and reports every model clean. That is
    // exactly what it did the first time this ran against another repository.
    if (!(object as { isMesh?: boolean }).isMesh) return
    const mesh = object as unknown as Mesh
    const position = mesh.geometry.getAttribute('position')
    if (!position) return
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : position.count
    const name = mesh.name || 'unnamed'

    const at = (i: number): Vector3 => {
      const v = index ? index.getX(i) : i
      return vertex.fromBufferAttribute(position, v).applyMatrix4(mesh.matrixWorld).clone()
    }

    for (let i = 0; i < count; i += 3) {
      for (const point of sampleTriangle(at(i), at(i + 1), at(i + 2), voxel * 0.7)) {
        const x = Math.floor((point.x - box.min.x) / voxel)
        const y = Math.floor((point.y - box.min.y) / voxel)
        const z = Math.floor((point.z - box.min.z) / voxel)
        const key = `${x},${y},${z}`
        const existing = cells.get(key)
        if (existing) existing.parts.add(name)
        else cells.set(key, { key, x, y, z, parts: new Set([name]) })
      }
    }
  })

  // --- 2. Connected components, 26-neighbourhood ----------------------------
  const parent = new Map<string, string>()
  const find = (key: string): string => {
    let root_ = key
    while (parent.get(root_) !== root_) root_ = parent.get(root_)!
    let walk = key
    while (parent.get(walk) !== root_) {
      const next = parent.get(walk)!
      parent.set(walk, root_)
      walk = next
    }
    return root_
  }
  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const key of cells.keys()) parent.set(key, key)
  for (const cell of cells.values()) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dy === 0 && dz === 0) continue
          const other = `${cell.x + dx},${cell.y + dy},${cell.z + dz}`
          if (cells.has(other)) union(cell.key, other)
        }
      }
    }
  }

  // --- 3. Support -----------------------------------------------------------
  const groups = new Map<string, { voxels: number; lowest: number; parts: Set<string>; at: Cell }>()
  for (const cell of cells.values()) {
    const key = find(cell.key)
    const group = groups.get(key)
    if (!group) {
      groups.set(key, { voxels: 1, lowest: cell.y, parts: new Set(cell.parts), at: cell })
      continue
    }
    group.voxels += 1
    for (const part of cell.parts) group.parts.add(part)
    if (cell.y < group.lowest) {
      group.lowest = cell.y
      // Report the lowest cell: for a floating piece that is the point a reader
      // wants to look at, the gap under it.
    }
  }

  const list = [...groups.values()].sort((a, b) => b.voxels - a.voxels)
  const floating: FloatingPiece[] = []

  if (mode === 'hanging') {
    // A hanging prop only has to hold together. Everything after the largest
    // mass is detached from it.
    for (const group of list.slice(1)) {
      floating.push({
        parts: [...group.parts].sort(),
        voxels: group.voxels,
        clearance: +(group.lowest * voxel).toFixed(4),
        at: [
          +(box.min.x + group.at.x * voxel).toFixed(3),
          +(box.min.y + group.at.y * voxel).toFixed(3),
          +(box.min.z + group.at.z * voxel).toFixed(3),
        ],
      })
    }
  } else {
    // Grounded: a component is supported when it reaches the bottom of the
    // model. One voxel of tolerance, because the floor row is where contact
    // rounds to.
    for (const group of list) {
      if (group.lowest <= 1) continue
      floating.push({
        parts: [...group.parts].sort(),
        voxels: group.voxels,
        clearance: +(group.lowest * voxel).toFixed(4),
        at: [
          +(box.min.x + group.at.x * voxel).toFixed(3),
          +(box.min.y + group.at.y * voxel).toFixed(3),
          +(box.min.z + group.at.z * voxel).toFixed(3),
        ],
      })
    }
  }

  const all: FloatingPiece[] = list.map((group) => ({
    parts: [...group.parts].sort(),
    voxels: group.voxels,
    clearance: +(group.lowest * voxel).toFixed(4),
    at: [
      +(box.min.x + group.at.x * voxel).toFixed(3),
      +(box.min.y + group.at.y * voxel).toFixed(3),
      +(box.min.z + group.at.z * voxel).toFixed(3),
    ],
  }))
  return { all, components: groups.size, floating, voxel: +voxel.toFixed(5) }
}
