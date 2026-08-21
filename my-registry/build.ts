/**
 * Kendi registry'nizi derleyen script.
 *
 * `models/` altındaki her klasörü tarar:
 *   - `model.ts` içeriyorsa  -> vibe3d:model
 *   - içermiyorsa            -> vibe3d:lib (paylaşılan destek item'ı)
 *
 * Bağımlılıklar kaynaktan türetilir: bir model `../core/` altından import
 * ediyorsa `@medieval-kit/core` otomatik bağımlılık olur. Elle tutulan bir
 * liste yok, dolayısıyla listenin bayatlaması da mümkün değil.
 *
 * Çalıştır:  bun my-registry/build.ts
 * Doğrula:   bunx vibe3d registry validate my-registry/dist/registry.json
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const registryRoot = dirname(fileURLToPath(import.meta.url))
const sourceRoot = join(registryRoot, 'models')
const outputRoot = join(registryRoot, 'dist')

const NAMESPACE = '@medieval-kit'
const THREE_RANGE = 'three@>=0.185.0'

/** Model başına katalog verisi. Kaynak dosyalar diskten okunur. */
import { MODEL_META } from './meta.ts'

const LIB_DESCRIPTION: Record<string, { title: string; description: string }> = {
  core: {
    title: 'Medieval Kit Core',
    description:
      'Kitin paylaşılan temeli: deterministik rastgelelik, vertex-renkli materyaller ' +
      've stave/band/head geometri üreticileri.',
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
      // {models} ve {vibe3d}, tüketicinin models.json'ındaki paths ile
      // değiştirilir — registry onun klasör düzenini varsaymak zorunda değil.
      target: `{models}/medieval-kit/${itemId}/${posix(relative(directory, path))}`,
      content,
      hash: sha256(content),
    }
  }))
}

/** `from '../<klasör>/'` biçimindeki her import bir registry bağımlılığıdır. */
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
    // Nokta ile başlayan klasörler item değildir. Araçlar (editör, VCS, ajan
    // durumu) buraya klasör bırakabilir; registry adları ise `[a-z0-9-]+`
    // olmak zorunda, yani böyle bir klasör derlemeyi kırardı.
    if (entry.name.startsWith('.')) continue
    // Model olmanın ölçütü: klasörün KÖKÜNDE model.ts. Alt ağaçta aramak
    // yanlış: `core/model.ts` paylaşılan bir yardımcı, model değil.
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
    const meta = LIB_DESCRIPTION[id] ?? { title: id, description: 'Paylaşılan kit kaynağı.' }
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
    if (!meta) throw new Error(`${id} için MODEL_META girdisi yok`)
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

  // defaultItem şart: `vibe3d add @medieval-kit` (item adı vermeden) bunu kurar.
  items.push({
    name: 'kit',
    type: 'vibe3d:kit',
    title: 'Medieval Kit',
    description: 'Lowpoly medieval kitin tamamı.',
    dependencies: [],
    registryDependencies: models.map((id) => `${NAMESPACE}/${id}`),
    files: [],
  })

  const registry = {
    $schema: 'https://vibe3d.dev/schema/registry.json',
    schemaVersion: 1,
    namespace: NAMESPACE,
    name: 'Medieval Kit',
    description: 'Three.js için lowpoly medieval prosedürel model kütüphanesi.',
    license: 'MIT',
    defaultItem: 'kit',
    compatibility: {
      vibe3d: '^0.0.1',
      engine: 'three',
      three: '>=0.185.0',
      // scifi-kit ['webgpu','tsl'] ister; bu kit klasik WebGL ile çalışır.
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
  console.log(`${items.length} item derlendi · ${models.length} model · ${libs.length} lib · ${fileCount} dosya`)
  for (const id of [...libs, ...models]) {
    const item = items.find((candidate) => (candidate as { name: string }).name === id) as {
      registryDependencies: string[]
    }
    const deps = item.registryDependencies.length > 0 ? ` -> ${item.registryDependencies.join(', ')}` : ''
    console.log(`  ${NAMESPACE}/${id}${deps}`)
  }
}

await main()
