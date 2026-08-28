/**
 * The script that builds your own registry.
 *
 * It scans every folder under `models/`:
 *   - contains `model.ts`  -> vibe3d:model
 *   - does not             -> vibe3d:lib (shared support item)
 *
 * Dependencies are derived from the source: if a model imports from under
 * `../core/`, `@contemporary-props/core` automatically becomes a dependency. There is
 * no hand-maintained list, so the list cannot go stale either.
 *
 * Run:       bun contemporary-props/build.ts
 * Validate:  bunx vibe3d registry validate contemporary-props/dist/registry.json
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const registryRoot = dirname(fileURLToPath(import.meta.url))
const sourceRoot = join(registryRoot, 'models')
const outputRoot = join(registryRoot, 'dist')

const NAMESPACE = '@contemporary-props'
const THREE_RANGE = 'three@>=0.185.0'

/** Catalogue data per model. The source files themselves are read from disk. */
import { MODEL_META } from './meta.ts'

const LIB_DESCRIPTION: Record<string, { title: string; description: string }> = {
  core: {
    title: 'Contemporary Props Core',
    description:
      'The shared foundation of the kit: deterministic randomness, vertex-colored materials ' +
      'and stave/band/head geometry generators.',
  },
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function posix(path: string): string {
  return path.split(sep).join('/')
}

async function collectTypeScript(root: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path)
    }
  }
  await visit(root)
  return files.sort()
}

async function registryFiles(itemId: string, paths: readonly string[]) {
  const directory = join(sourceRoot, itemId)
  return Promise.all(paths.map(async (path) => {
    const content = await readFile(path, 'utf8')
    return {
      path: posix(relative(registryRoot, path)),
      // {models} and {vibe3d} are replaced with the paths from the consumer's
      // models.json — the registry does not have to assume its folder layout.
      target: `{models}/contemporary-props/${itemId}/${posix(relative(directory, path))}`,
      content,
      hash: sha256(content),
    }
  }))
}

/** Every import of the form `from '../<folder>/'` is a registry dependency. */
function dependenciesFrom(contents: readonly string[], selfId: string): string[] {
  const found = new Set<string>()
  const pattern = /from\s+['"]\.\.\/([a-z0-9][a-z0-9-]*)\//g
  for (const content of contents) {
    for (const match of content.matchAll(pattern)) {
      const id = match[1]
      if (id && id !== selfId) found.add(`${NAMESPACE}/${id}`)
    }
  }
  return [...found].sort()
}

async function main(): Promise<void> {
  const entries = await readdir(sourceRoot, { withFileTypes: true })
  const models: string[] = []
  const libs: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    // Folders starting with a dot are not items. Tools (editor, VCS, agent
    // state) may leave folders here; registry names, on the other hand, have to
    // be `[a-z0-9-]+`, so such a folder would break the build.
    if (entry.name.startsWith('.')) continue
    // The criterion for being a model: model.ts at the folder ROOT. Searching
    // the subtree is wrong: `core/model.ts` is a shared helper, not a model.
    const paths = await collectTypeScript(join(sourceRoot, entry.name))
    const root = join(sourceRoot, entry.name, 'model.ts')
    if (paths.includes(root)) models.push(entry.name)
    else libs.push(entry.name)
  }
  models.sort()
  libs.sort()

  const items: unknown[] = []

  for (const id of libs) {
    const paths = await collectTypeScript(join(sourceRoot, id))
    const contents = await Promise.all(paths.map((path) => readFile(path, 'utf8')))
    const meta = LIB_DESCRIPTION[id] ?? { title: id, description: 'Shared kit source.' }
    items.push({
      name: id,
      type: 'vibe3d:lib',
      title: meta.title,
      description: meta.description,
      dependencies: [THREE_RANGE],
      registryDependencies: dependenciesFrom(contents, id),
      files: await registryFiles(id, paths),
    })
  }

  for (const id of models) {
    const paths = await collectTypeScript(join(sourceRoot, id))
    const contents = await Promise.all(paths.map((path) => readFile(path, 'utf8')))
    const meta = MODEL_META[id]
    if (!meta) throw new Error(`no MODEL_META entry for ${id}`)
    items.push({
      name: id,
      type: 'vibe3d:model',
      title: meta.title,
      description: meta.description,
      dependencies: [THREE_RANGE],
      registryDependencies: dependenciesFrom(contents, id),
      files: await registryFiles(id, paths),
      meta: {
        title: meta.title,
        description: meta.description,
        category: meta.category,
        tags: meta.tags,
        controls: meta.controls,
        materialSlots: meta.materialSlots,
        parts: meta.parts,
        sockets: [],
      },
    })
  }

  // defaultItem is required: `vibe3d add @contemporary-props` (with no item name) installs this.
  items.push({
    name: 'kit',
    type: 'vibe3d:kit',
    title: 'Contemporary Props',
    description: 'The complete contemporary props kit.',
    dependencies: [],
    registryDependencies: models.map((id) => `${NAMESPACE}/${id}`),
    files: [],
  })

  const registry = {
    $schema: 'https://vibe3d.dev/schema/registry.json',
    schemaVersion: 1,
    namespace: NAMESPACE,
    name: 'Contemporary Props',
    description: 'Present-day procedural prop library for Three.js.',
    license: 'MIT',
    defaultItem: 'kit',
    compatibility: {
      vibe3d: '^0.0.1',
      engine: 'three',
      three: '>=0.185.0',
      // scifi-kit requires ['webgpu','tsl']; this kit runs on classic WebGL.
      capabilities: [],
    },
    items,
  }

  await mkdir(outputRoot, { recursive: true })
  await writeFile(
    resolve(outputRoot, 'registry.json'),
    `${JSON.stringify(registry, null, 2)}\n`,
    'utf8',
  )

  const fileCount = items.reduce<number>(
    (total, item) => total + (item as { files: unknown[] }).files.length,
    0,
  )
  console.log(`${items.length} items built · ${models.length} models · ${libs.length} libs · ${fileCount} files`)
  for (const id of [...libs, ...models]) {
    const item = items.find((candidate) => (candidate as { name: string }).name === id) as {
      registryDependencies: string[]
    }
    const deps = item.registryDependencies.length > 0 ? ` -> ${item.registryDependencies.join(', ')}` : ''
    console.log(`  ${NAMESPACE}/${id}${deps}`)
  }
}

await main()
