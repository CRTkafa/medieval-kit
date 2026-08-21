/**
 * Vertex morphing between two configurations of the same model.
 *
 * The showcase needs a parameter sweep that looks continuous. Driving
 * `configure()` at frame rate does not achieve that: a full rebuild re-runs the
 * geometry, the ambient occlusion bake and the mottle pass, so it has to be
 * throttled, and a throttled rebuild reads exactly as what it is — the model
 * freezing and jumping several times a second.
 *
 * So the sweep does not rebuild at all. The two ends of the beat are built
 * once, their vertex buffers are captured, and every frame blends between them.
 * The per-frame cost drops to a lerp over a few thousand floats and the motion
 * becomes genuinely smooth.
 *
 * This only works while the two builds are TOPOLOGICALLY IDENTICAL — same mesh
 * count, same vertex count per mesh. That is a real constraint, not a detail:
 * `staveCount`, `railCount`, `bristles` and the seed all change how many
 * triangles exist. The showcase therefore holds every integer parameter fixed
 * for the length of a beat and only sweeps the continuous ones. Integer
 * parameters still change — they change BETWEEN beats, where the cut hides the
 * pop.
 *
 * `capture` is deliberately strict about that: it returns the shape it saw, and
 * `blend` refuses to run if the shapes disagree. A silent mismatch would blend
 * one mesh's vertices into another's and produce garbage.
 */
import { Mesh, Object3D } from 'three/webgpu'

export interface MorphFrame {
  readonly positions: readonly Float32Array[]
  readonly colours: readonly (Float32Array | undefined)[]
  /**
   * Part anchor positions.
   *
   * These are NOT in the vertex buffers and forgetting them was a real bug with
   * a very visible symptom. A part that declares an `origin` — a chest lid, a
   * torch flame, a tavern sign's board — has its geometry written around that
   * origin and the anchor moved there at build time. The origin is derived from
   * the config, so it MOVES when a slider does. Blending only the vertices left
   * the lid's hinge where the old configuration had put it while the body
   * morphed to a new depth underneath, and the lid drifted off the chest and
   * hung in the air.
   */
  readonly anchors: readonly [number, number, number][]
}

/** Copies the current vertex buffers and part transforms out of the scene graph. */
export function capture(root: Object3D): MorphFrame {
  const positions: Float32Array[] = []
  const colours: (Float32Array | undefined)[] = []
  const anchors: [number, number, number][] = []
  for (const child of root.children) {
    anchors.push([child.position.x, child.position.y, child.position.z])
  }
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute('position')
    positions.push(new Float32Array(position.array as ArrayLike<number>))
    const colour = object.geometry.getAttribute('color')
    colours.push(colour ? new Float32Array(colour.array as ArrayLike<number>) : undefined)
  })
  return { positions, colours, anchors }
}

/** True when two captures can be blended — same meshes, same vertex counts. */
export function compatible(a: MorphFrame, b: MorphFrame): boolean {
  if (a.positions.length !== b.positions.length) return false
  if (a.anchors.length !== b.anchors.length) return false
  return a.positions.every((array, i) => array.length === b.positions[i]!.length)
}

/**
 * Writes `a + (b - a) * t` into the live geometry.
 *
 * Normals are recomputed rather than blended. Blending them would be cheaper
 * but wrong: these geometries are non-indexed and rely on per-face normals for
 * flat shading, and a lerp between two normal sets does not give the true
 * normal of the intermediate surface — facets would drift out of alignment with
 * the shape they belong to.
 */
export function blend(root: Object3D, a: MorphFrame, b: MorphFrame, t: number): boolean {
  if (!compatible(a, b)) return false
  const amount = Math.min(1, Math.max(0, t))

  // Anchors first: a part's hinge has to travel with the body it is hinged to.
  root.children.forEach((child, i) => {
    const from = a.anchors[i]
    const to = b.anchors[i]
    if (!from || !to) return
    child.position.set(
      from[0] + (to[0] - from[0]) * amount,
      from[1] + (to[1] - from[1]) * amount,
      from[2] + (to[2] - from[2]) * amount,
    )
  })

  let index = 0
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const from = a.positions[index]
    const to = b.positions[index]
    if (!from || !to) { index += 1; return }

    const position = object.geometry.getAttribute('position')
    const target = position.array as Float32Array
    for (let i = 0; i < target.length; i += 1) {
      target[i] = from[i]! + (to[i]! - from[i]!) * amount
    }
    position.needsUpdate = true

    const fromColour = a.colours[index]
    const toColour = b.colours[index]
    const colour = object.geometry.getAttribute('color')
    if (colour && fromColour && toColour && fromColour.length === toColour.length) {
      // Colours have to travel too: ambient occlusion and mottle are baked from
      // the geometry, so the shading of the start pose is wrong for the end
      // pose. Holding them fixed made the surface look like it was sliding
      // underneath its own shadows.
      const targetColour = colour.array as Float32Array
      for (let i = 0; i < targetColour.length; i += 1) {
        targetColour[i] = fromColour[i]! + (toColour[i]! - fromColour[i]!) * amount
      }
      colour.needsUpdate = true
    }

    object.geometry.computeVertexNormals()
    // The cached bounds MUST be dropped. `Box3.setFromObject` reuses
    // `geometry.boundingBox` once it exists, so without this the scene keeps
    // reporting the shape the model had before the morph started — and the
    // showcase camera, which re-fits from exactly that box, never notices the
    // model growing under it. That was visible as the model overflowing the
    // frame during a sweep.
    object.geometry.boundingBox = null
    object.geometry.boundingSphere = null
    index += 1
  })
  return true
}
