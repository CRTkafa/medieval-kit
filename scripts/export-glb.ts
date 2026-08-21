/**
 * Exports the whole kit to GLB files.
 *
 * `bun scripts/export-glb.ts` → one file per model under glb/.
 * `bun scripts/export-glb.ts --one wooden-chest --out /tmp`
 *
 * Why a CLI: the vibe3d viewer downloads a single model from the browser.
 * Someone who actually wants to use the kit does not want to download twenty
 * models one by one — taking them to Blender, Godot or Unity needs one command.
 *
 * This script is also the VERIFICATION of the export: without opening a
 * browser, we can see here that every model really produces a valid GLB.
 */
import { mkdir, writeFile } from 'node:fs/promises'

/**
 * GLTFExporter collects the binary output through `FileReader`, and that API
 * belongs to the browser — it is not defined in bun. Here we cover the one
 * path that is actually needed.
 *
 * The polyfill has to be installed BEFORE THE IMPORTS: the `@/glb.ts` module
 * loads GLTFExporter, and that wants to see the global while it loads. That is
 * why the two imports below are dynamic rather than static.
 */
class BunFileReader {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null

  readAsArrayBuffer(blob: Blob): void {
    // `onloadend` is assigned AFTER this call, so the callback has to be
    // deferred to the next microtask. Calling it synchronously would make it
    // look as if it never fired.
    void blob.arrayBuffer().then(
      (buffer) => { this.result = buffer; this.onloadend?.() },
      (error) => { this.onerror?.(error) },
    )
  }
}

const globals = globalThis as { FileReader?: unknown }
globals.FileReader ??= BunFileReader

const { CATALOG } = await import('@/catalog.ts')
const { exportGlb } = await import('@/glb.ts')

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}

const outDir = flag('out') ?? 'glb'
const one = flag('one')
await mkdir(outDir, { recursive: true })

const ids = one ? [one] : Object.keys(CATALOG)
let total = 0

for (const id of ids) {
  const entry = CATALOG[id]
  if (!entry) throw new Error(`not in catalog: ${id}`)
  const built = entry.build()
  const buffer = await exportGlb(built.root, {
    name: id,
    extras: { vibe3d: { model: entry.address } },
  })
  built.dispose()

  // We verify the GLB header here: blowing up beats silently writing a broken
  // file. Magic number 'glTF', then the version, then the total length.
  const header = new DataView(buffer)
  const magic = header.getUint32(0, true)
  if (magic !== 0x46546c67) throw new Error(`${id}: wrong GLB magic number`)
  if (header.getUint32(4, true) !== 2) throw new Error(`${id}: glTF version is not 2`)
  if (header.getUint32(8, true) !== buffer.byteLength) {
    throw new Error(`${id}: length in the header does not match the file size`)
  }

  await writeFile(`${outDir}/${id}.glb`, new Uint8Array(buffer))
  total += buffer.byteLength
  console.log(`  ${id.padEnd(20)} ${(buffer.byteLength / 1024).toFixed(1)} KB`)
}

console.log(`\n${ids.length} models → ${outDir}/ · total ${(total / 1024).toFixed(1)} KB`)
