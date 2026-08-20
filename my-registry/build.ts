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
const MODEL_META: Record<string, {
  title: string
  description: string
  category: string
  tags: string[]
  controls: Record<string, unknown>
  materialSlots: string[]
  parts: string[]
}> = {
  'wooden-barrel': {
    title: 'Wooden Barrel',
    description:
      'Ayrı meşe tahtalardan kurulmuş, demir çemberli, kapağı gömülü lowpoly fıçı.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.4, max: 2, step: 0.02, unit: 'm' },
      radius: { type: 'number', label: 'Yarıçap', min: 0.15, max: 0.9, step: 0.01, unit: 'm' },
      taper: { type: 'number', label: 'Uç daralması', min: 0, max: 0.34, step: 0.01 },
      staveCount: { type: 'number', label: 'Tahta sayısı', min: 6, max: 28, step: 1 },
      hoopCount: { type: 'number', label: 'Çember sayısı', min: 0, max: 6, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['staves', 'heads', 'hoops'],
  },
  'wooden-crate': {
    title: 'Wooden Crate',
    description:
      'Köşe dikmelerine çakılmış yatay tahta sıraları ve dövme demir kayışlar.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      width: { type: 'number', label: 'Genişlik', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Yükseklik', min: 0.25, max: 1.2, step: 0.02, unit: 'm' },
      depth: { type: 'number', label: 'Derinlik', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      plankRows: { type: 'number', label: 'Tahta sırası', min: 1, max: 6, step: 1 },
      strapCount: { type: 'number', label: 'Demir kayış', min: 0, max: 4, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['posts', 'planks', 'straps'],
  },
  'iron-brazier': {
    title: 'Iron Brazier',
    description:
      'Üç ayaklı dövme demir mangal; titreyen alev, kor kömürler ve taşıdığı ateş ışığı.',
    category: 'Lighting',
    tags: ['medieval', 'lowpoly', 'lighting', 'animated', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.4, max: 1.6, step: 0.02, unit: 'm' },
      bowlRadius: { type: 'number', label: 'Kâse yarıçapı', min: 0.12, max: 0.5, step: 0.01, unit: 'm' },
      bowlSegments: { type: 'number', label: 'Kâse köşesi', min: 5, max: 20, step: 1 },
      legCount: { type: 'number', label: 'Ayak sayısı', min: 3, max: 6, step: 1 },
      flameCount: { type: 'number', label: 'Alev dili', min: 0, max: 9, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['iron', 'char', 'ember'],
    parts: ['bowl', 'legs', 'coals', 'flame'],
  },
}

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
    const paths = await collectTypeScript(join(sourceRoot, entry.name))
    if (paths.some((path) => path.endsWith(`${sep}model.ts`))) models.push(entry.name)
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
