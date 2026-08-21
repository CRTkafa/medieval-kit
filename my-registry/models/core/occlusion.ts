import type { BufferGeometry } from 'three'

/**
 * Ambient occlusion baked into vertex colours.
 *
 * Why this and not a texture: a bitmap texture would bring three things — UV
 * coordinates (our geometry has none), image files the registry would have to
 * carry, and a change to the kit's identity. Lowpoly + flat shading + vertex
 * colour is a coherent style; a half-hearted texture breaks it.
 *
 * Instead we derive the darkening from the surface's OWN shape: the more
 * neighbouring surfaces surround a point, the less sky it sees. The result is
 * darkening in cavities and at contact points — between the boards, under the
 * hoop, where the logs touch. The models suddenly look "used" and it costs
 * zero memory, zero textures.
 *
 * Method: a grid is built from the triangle centroids, then for each vertex
 * the neighbour density within its own normal hemisphere is measured. No ray
 * tracing — at this scale (hundreds of triangles) it would be needlessly
 * expensive and the difference is negligible.
 */

export interface OcclusionOptions {
  /** Radius searched for neighbours. Derived from the model's size if omitted. */
  readonly radius?: number
  /** How much the darkest point is darkened. 0 = off. */
  readonly strength?: number
  /** Neighbour weight where saturation is reached. Raising it softens the darkening. */
  readonly saturation?: number
}

interface Sample {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly area: number
}

/** Simple spatial grid: for quickly finding the samples within a radius. */
class Grid {
  readonly #cells = new Map<string, Sample[]>()
  readonly #size: number

  constructor(samples: readonly Sample[], cellSize: number) {
    this.#size = cellSize
    for (const sample of samples) {
      const key = this.#key(sample.x, sample.y, sample.z)
      const bucket = this.#cells.get(key)
      if (bucket) bucket.push(sample)
      else this.#cells.set(key, [sample])
    }
  }

  #key(x: number, y: number, z: number): string {
    return `${Math.floor(x / this.#size)},${Math.floor(y / this.#size)},${Math.floor(z / this.#size)}`
  }

  /** The samples of the 27 cells surrounding the given point. */
  near(x: number, y: number, z: number): Sample[] {
    const cx = Math.floor(x / this.#size)
    const cy = Math.floor(y / this.#size)
    const cz = Math.floor(z / this.#size)
    const found: Sample[] = []
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        for (let k = -1; k <= 1; k += 1) {
          const bucket = this.#cells.get(`${cx + i},${cy + j},${cz + k}`)
          if (bucket) found.push(...bucket)
        }
      }
    }
    return found
  }
}

/**
 * Computes the occlusion of the given geometries TOGETHER and writes it into
 * their colours.
 *
 * They all have to be evaluated as one: the place where a board darkens is the
 * surface of the neighbouring post, not its own surface. Processing them one
 * by one would miss the contact points entirely.
 */
export function bakeOcclusion(
  geometries: readonly BufferGeometry[],
  options: OcclusionOptions = {},
): void {
  const strength = options.strength ?? 0.42
  if (strength <= 0 || geometries.length === 0) return

  // --- 1. Samples: each triangle's centroid, weighted by its area ---
  const samples: Sample[] = []
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position')
    if (!position) continue
    const index = geometry.getIndex()
    const count = index ? index.count : position.count
    for (let i = 0; i < count; i += 3) {
      const at = (k: number): [number, number, number] => {
        const v = index ? index.getX(i + k) : i + k
        return [position.getX(v), position.getY(v), position.getZ(v)]
      }
      const [ax, ay, az] = at(0)
      const [bx, by, bz] = at(1)
      const [cx, cy, cz] = at(2)
      const ux = bx - ax, uy = by - ay, uz = bz - az
      const vx = cx - ax, vy = cy - ay, vz = cz - az
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      const area = Math.hypot(nx, ny, nz) / 2
      if (area <= 0) continue
      const x = (ax + bx + cx) / 3
      const y = (ay + by + cy) / 3
      const z = (az + bz + cz) / 3
      samples.push({ x, y, z, area })
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }
  }
  if (samples.length === 0) return

  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-6)
  // The radius is derived from the scale but has an ABSOLUTE ceiling. Without
  // the ceiling a 4.89 m fence gets a 0.69 m radius and the definition of
  // "neighbour" loses its meaning: everything is everything's neighbour, and
  // instead of showing the contact points the occlusion smears a flat
  // darkening over the whole model.
  //
  // The physical meaning says the same thing: what shades a surface is what is
  // NEAR it. A post half a metre away is not making the shadow between the
  // boards.
  const radius = options.radius ?? Math.min(0.16, Math.max(0.015, extent * 0.14))
  const grid = new Grid(samples, radius)
  // Saturation has to be proportional to the model's scale: as the radius
  // grows so does the area it covers, and a fixed threshold would turn small
  // models pitch black.
  const saturation = options.saturation ?? radius * radius * 1.9

  // --- 2. Neighbour density for each vertex ---
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position')
    const colour = geometry.getAttribute('color')
    if (!position || !colour) continue
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    const normal = geometry.getAttribute('normal')!

    for (let i = 0; i < position.count; i += 1) {
      const px = position.getX(i), py = position.getY(i), pz = position.getZ(i)
      const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i)

      let weight = 0
      for (const sample of grid.near(px, py, pz)) {
        const dx = sample.x - px, dy = sample.y - py, dz = sample.z - pz
        const distance = Math.hypot(dx, dy, dz)
        if (distance < 1e-6 || distance > radius) continue
        // Only neighbours in the hemisphere the vertex FACES occlude it.
        const facing = (dx * nx + dy * ny + dz * nz) / distance
        if (facing <= 0) continue
        // The effect fades with distance; a soft falloff instead of the
        // inverse-square law, because the goal is not physical accuracy but a
        // readable cavity shadow.
        weight += sample.area * facing * (1 - distance / radius)
      }

      const occlusion = Math.min(1, weight / saturation)
      const factor = 1 - strength * occlusion
      colour.setXYZ(i, colour.getX(i) * factor, colour.getY(i) * factor, colour.getZ(i) * factor)
    }
    colour.needsUpdate = true
  }
}
