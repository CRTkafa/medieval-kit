/**
 * GLB export.
 *
 * This was the one feature vibe3d's own inspector had and we did not. Here it
 * sits so it can be used from two places: the "Download GLB" button in the
 * viewer and the bulk export in `scripts/export-glb.ts`. They do not have the
 * second one, and that is the one that actually earns its keep — it takes the
 * kit into Blender or a game engine with a single command.
 *
 * The kit's colour information lives entirely in VERTEX COLOR and glTF carries
 * it as COLOR_0, leaving baseColorFactor white. So there is no texture in the
 * file at all; the model's whole identity travels in a single attribute.
 * `scripts/verify-glb.ts` checks this by exporting every model and READING IT
 * BACK.
 *
 * What is NOT here is also worth noting. I had written a layer that tried to
 * convert the materials to their classic equivalents for export: we use
 * `three/webgpu` node materials and I was worried GLTFExporter would not
 * recognise them and would silently write an empty material. Once I measured,
 * it turned out to be unnecessary — `MeshStandardNodeMaterial` carries the
 * `isMeshStandardMaterial` flag too, so the exporter already recognises it. I
 * deleted the code; a safety layer that never fires provides no safety and
 * misleads whoever reads it.
 *
 * The one thing that does NOT travel is the shader: the wear on the scifi-kit
 * gauge is a TSL node graph, which is code. glTF does not carry code. That is
 * not a shortcoming, it is the real difference between vertex colour and a
 * shader-based surface.
 */
import { Mesh, type Object3D } from 'three/webgpu'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

export interface GlbOptions {
  /** The name embedded in the file. */
  readonly name?: string
  /** Info added to the meshes' userData — model address, version and so on. */
  readonly extras?: Record<string, unknown>
}

/**
 * Packs a scene branch as GLB (binary glTF).
 *
 * It does NOT touch the source tree: it works on a clone in order to add
 * userData. `Object3D.clone` SHARES geometry and materials, so the clone is
 * cheap and produces nothing that has to be disposed — but it does not pollute
 * the model's own userData, and the model may still be live in the scene.
 */
export async function exportGlb(root: Object3D, options: GlbOptions = {}): Promise<ArrayBuffer> {
  const clone = root.clone(true)
  clone.name = options.name ?? root.name

  if (options.extras) {
    clone.traverse((object) => {
      if (object instanceof Mesh) object.userData = { ...object.userData, ...options.extras }
    })
  }

  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(clone, {
    binary: true,
    // Let the `vibe3d` block in userData go into the file as `extras`: we want
    // the registry address the model came from to stay inside the file.
    includeCustomExtensions: true,
    // The kit is already in metres and Y-up, i.e. the same as glTF's own
    // convention — no conversion needed.
    trs: false,
    /*
     * Hidden parts go in the file too.
     *
     * GLTFExporter defaults to `onlyVisible: true`, which is right for a scene
     * snapshot and wrong for a model: a part a model hides is still part of the
     * model. The traffic signal builds three lit aspects and shows one, so the
     * default exported a signal that could never turn green — two of its six
     * meshes were simply missing, and the round-trip check caught it as a mesh
     * count that did not survive.
     */
    onlyVisible: false,
  })
  if (!(result instanceof ArrayBuffer)) throw new Error('GLTFExporter did not return binary output')
  return result
}
