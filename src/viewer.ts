import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WireframeGeometry,
  type Material,
  type Object3D,
} from 'three/webgpu'
import { WebGPURenderer } from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import './viewer.css'

import { createModel as createGauge } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'
import { createModel as createCrate } from '@/models/medieval-kit/wooden-crate/model.ts'
import { createModel as createBrazier } from '@/models/medieval-kit/iron-brazier/model.ts'

/* ------------------------------------------------------------------ katalog */

interface ParamSpec {
  readonly key: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
}

interface ParamGroup {
  readonly specs: readonly ParamSpec[]
  current(): Record<string, number>
  apply(patch: Record<string, number>): void
}

/**
 * Kaydırıcıları modele bağlar.
 *
 * Viewer her modelin yapılandırma tipini bilmek zorunda değil — sadece sayısal
 * alanlar görüyor. Ama `keyof C` sayesinde ÇAĞRI YERİNDE anahtarlar hâlâ
 * denetleniyor: modelde olmayan bir alan yazmak derleme hatası verir. (Bu
 * denetim daha önce yeniden adlandırılmış bir alanı yakalamıştı.)
 */
function numericParams<C extends object>(
  model: { getConfig(): Readonly<C>; configure(patch: Partial<C>): unknown },
  specs: ReadonlyArray<ParamSpec & { readonly key: keyof C & string }>,
): ParamGroup {
  return {
    specs,
    current: () => model.getConfig() as Record<string, number>,
    apply: (patch) => { model.configure(patch as Partial<C>) },
  }
}

interface Entry {
  readonly id: string
  readonly namespace: string
  readonly address: string
  readonly who: string
  /** Modeli kurar; kök + istege bagli update/action döndürür. */
  build(): {
    root: Group
    update?: (deltaSeconds: number) => void
    action?: { label(): string; run(): void }
    params?: ParamGroup
    dispose(): void
  }
}

const REGISTRIES = [
  {
    namespace: '@scifi-kit',
    scheme: 'npm:',
    rest: '@scifi-kit/registry',
    entries: ['pressure-gauge'],
  },
  {
    namespace: '@medieval-kit',
    scheme: 'file:',
    rest: 'my-registry/dist/registry.json',
    entries: ['wooden-barrel', 'wooden-crate', 'iron-brazier'],
  },
] as const

const CATALOG: Record<string, Entry> = {
  'pressure-gauge': {
    id: 'pressure-gauge',
    namespace: '@scifi-kit',
    address: '@scifi-kit/pressure-gauge',
    who: 'vibe3d ekibi yazdı · <b>npm</b>\'den kuruldu · 539 satır TypeScript',
    build: () => {
      const gauge = createGauge()
      return {
        root: gauge.root,
        update: gauge.update,
        action: { label: () => 'Basınç testi', run: () => gauge.triggerPressureTest() },
        dispose: () => gauge.dispose(),
      }
    },
  },
  'wooden-barrel': {
    id: 'wooden-barrel',
    namespace: '@medieval-kit',
    address: '@medieval-kit/wooden-barrel',
    who: 'bu oturumda yazıldı · <b>sizin registry\'niz</b> · 13 ayrı tahta, vertex renkli meşe',
    build: () => {
      const barrel = createBarrel()
      return {
        root: barrel.root,
        params: numericParams(barrel, [
            { key: 'height', label: 'height', min: 0.4, max: 2, step: 0.02, unit: 'm' },
            { key: 'radius', label: 'radius', min: 0.15, max: 0.9, step: 0.01, unit: 'm' },
            { key: 'taper', label: 'taper', min: 0, max: 0.34, step: 0.01 },
            { key: 'staveCount', label: 'staveCount', min: 6, max: 28, step: 1 },
            { key: 'hoopCount', label: 'hoopCount', min: 0, max: 6, step: 1 },
            { key: 'seed', label: 'seed', min: 1, max: 64, step: 1 },
        ]),
        dispose: () => barrel.dispose(),
      }
    },
  },
  'wooden-crate': {
    id: 'wooden-crate',
    namespace: '@medieval-kit',
    address: '@medieval-kit/wooden-crate',
    who: "köşe dikmelerine çakılı tahta sıraları · <b>core</b>'un kutu primitive'i",
    build: () => {
      const crate = createCrate()
      return {
        root: crate.root,
        params: numericParams(crate, [
            { key: 'width', label: 'width', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
            { key: 'height', label: 'height', min: 0.25, max: 1.2, step: 0.02, unit: 'm' },
            { key: 'depth', label: 'depth', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
            { key: 'plankRows', label: 'plankRows', min: 1, max: 6, step: 1 },
            { key: 'strapCount', label: 'strapCount', min: 0, max: 4, step: 1 },
            { key: 'seed', label: 'seed', min: 1, max: 64, step: 1 },
        ]),
        dispose: () => crate.dispose(),
      }
    },
  },
  'iron-brazier': {
    id: 'iron-brazier',
    namespace: '@medieval-kit',
    address: '@medieval-kit/iron-brazier',
    who: 'kitin ilk hareketli modeli · tipli <b>actions</b> + <b>update()</b> · kendi ateş ışığını taşıyor',
    build: () => {
      const brazier = createBrazier()
      return {
        root: brazier.root,
        update: brazier.update,
        action: {
          label: () => (brazier.actions.isLit() ? 'Ateşi söndür' : 'Ateşi yak'),
          run: () => brazier.actions.setLit(!brazier.actions.isLit()),
        },
        params: numericParams(brazier, [
            { key: 'height', label: 'height', min: 0.4, max: 1.6, step: 0.02, unit: 'm' },
            { key: 'bowlRadius', label: 'bowlRadius', min: 0.12, max: 0.5, step: 0.01, unit: 'm' },
            { key: 'bowlSegments', label: 'bowlSegments', min: 5, max: 20, step: 1 },
            { key: 'legCount', label: 'legCount', min: 3, max: 6, step: 1 },
            { key: 'flameCount', label: 'flameCount', min: 0, max: 9, step: 1 },
            { key: 'seed', label: 'seed', min: 1, max: 64, step: 1 },
        ]),
        dispose: () => brazier.dispose(),
      }
    },
  },
}

/* -------------------------------------------------------------------- iskele */

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <aside class="rail">
    <header class="brand">
      <span class="brand-mark">vibe3d</span>
      <span class="brand-sub">kaynak registry inceleyici</span>
    </header>
    ${REGISTRIES.map((registry) => `
      <section class="block">
        <div class="ns-head">
          <span class="ns-name">${registry.namespace}</span>
          <span class="ns-source"><span class="scheme">${registry.scheme}</span>${registry.rest}</span>
        </div>
        <ul class="models">
          ${registry.entries.map((id) => `
            <li>
              <button class="model" type="button" data-model="${id}" aria-pressed="false">
                <span class="model-name">${id}</span>
                <span class="model-tris" data-tris-for="${id}">—</span>
              </button>
            </li>
          `).join('')}
        </ul>
      </section>
    `).join('')}
    <section class="block">
      <p class="block-label">Okuma</p>
      <dl class="readout">
        <dt>mesh</dt><dd data-readout="meshes">—</dd>
        <dt>üçgen</dt><dd data-readout="triangles" class="accent">—</dd>
        <dt>materyal</dt><dd data-readout="materials">—</dd>
        <dt>boyut</dt><dd data-readout="size">—</dd>
        <dt>backend</dt><dd data-readout="backend">—</dd>
      </dl>
    </section>
    <section class="block" data-params-block>
      <p class="block-label">Yapılandırma</p>
      <div class="params" data-params></div>
    </section>
    <section class="block">
      <p class="block-label">Görünüm</p>
      <div class="actions">
        <button class="action action-primary" type="button" data-action hidden></button>
        <button class="action" type="button" data-toggle="wireframe" aria-pressed="false">
          <span>tel kafes</span><span class="state">kapalı</span>
        </button>
        <button class="action" type="button" data-toggle="spin" aria-pressed="true">
          <span>otomatik döndür</span><span class="state">açık</span>
        </button>
        <button class="action" type="button" data-toggle="grid" aria-pressed="true">
          <span>zemin ızgarası</span><span class="state">açık</span>
        </button>
      </div>
    </section>
  </aside>
  <main class="viewport">
    <canvas></canvas>
    <div class="overlay provenance">
      <span class="address" data-provenance-address></span>
      <span class="who" data-provenance-who></span>
    </div>
    <span class="overlay hint">sürükle · tekerlek ile yakınlaş</span>
    <span class="overlay scale-note" data-scale></span>
  </main>
`

const canvas = app.querySelector<HTMLCanvasElement>('canvas')!
const viewport = app.querySelector<HTMLElement>('.viewport')!
const paramsHost = app.querySelector<HTMLDivElement>('[data-params]')!
const paramsBlock = app.querySelector<HTMLElement>('[data-params-block]')!
const actionButton = app.querySelector<HTMLButtonElement>('[data-action]')!
const readout = (name: string) => app.querySelector<HTMLElement>(`[data-readout="${name}"]`)!
const provenanceAddress = app.querySelector<HTMLElement>('[data-provenance-address]')!
const provenanceWho = app.querySelector<HTMLElement>('[data-provenance-who]')!
const scaleNote = app.querySelector<HTMLElement>('[data-scale]')!

function fatal(html: string): void {
  const box = document.createElement('div')
  box.className = 'fatal'
  box.innerHTML = html
  viewport.append(box)
}

/* ------------------------------------------------------------------ renderer */

// WebGPURenderer, navigator.gpu yoksa kendi WebGL2 backend'ine düşer. scifi-kit
// modelinin TSL düğüm materyali her iki yolda da derlenir.
const renderer = new WebGPURenderer({ canvas, antialias: true })
try {
  await renderer.init()
} catch (error) {
  fatal(`<b>Renderer başlatılamadı.</b><span>${String(error)}</span>`)
  throw error
}
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2))

const backend = navigator.gpu ? 'WebGPU' : 'WebGL2 (yedek)'
readout('backend').textContent = backend

const scene = new Scene()
scene.background = new Color(0x0b0e12)
scene.add(new HemisphereLight(0x94a9b5, 0x0a0c10, 0.7))

const key = new DirectionalLight(0xfff0dc, 2.1)
key.position.set(-7, 10, 11)
const fill = new DirectionalLight(0x9ec4db, 0.8)
fill.position.set(9, 4, 8)
const rim = new DirectionalLight(0x8ba9c0, 0.95)
rim.position.set(6, 8, -9)
scene.add(key, fill, rim)

const camera = new PerspectiveCamera(34, 1, 0.02, 400)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.autoRotateSpeed = 0.9

let grid: GridHelper | undefined

/* ------------------------------------------------------------------- durumlar */

let current: ReturnType<Entry['build']> | undefined
let currentEntry: Entry | undefined
let wireframe = false
let showGrid = true

const triangleCounts = new Map<string, number>()

interface Survey {
  meshes: number
  triangles: number
  materials: number
  size: Vector3
  centre: Vector3
  radius: number
}

function survey(root: Object3D): Survey {
  let meshes = 0
  let triangles = 0
  const materials = new Set<Material>()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    meshes += 1
    const index = object.geometry.getIndex()
    const position = object.geometry.getAttribute('position')
    triangles += Math.round((index ? index.count : position.count) / 3)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
    }
  })

  const box = new Box3().setFromObject(root)
  const sphere = box.getBoundingSphere(new Sphere())
  return {
    meshes,
    triangles,
    materials: materials.size,
    size: box.getSize(new Vector3()),
    centre: sphere.center.clone(),
    radius: sphere.radius,
  }
}

// Tel kafes, `material.wireframe` ile DEĞİL, ayrı bir çizgi katmanıyla çiziliyor.
// three'nin WebGPU backend'i bu modellerin indeksli geometrilerinde
// material.wireframe için geçerli bir index buffer üretemiyor ve
// `setIndexBuffer` hata veriyor. WireframeGeometry her iki backend'de de
// çalışıyor ve gölgeli yüzeyin üstünde okunur bir topoloji katmanı veriyor.
const wireMaterial = new LineBasicMaterial({
  color: 0x5fc8e8,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
})

let wireOverlays: LineSegments[] = []

function applyWireframe(root: Object3D): void {
  for (const overlay of wireOverlays) {
    overlay.removeFromParent()
    overlay.geometry.dispose()
  }
  wireOverlays = []
  if (!wireframe) return

  const meshes: Mesh[] = []
  root.traverse((object) => { if (object instanceof Mesh) meshes.push(object) })
  for (const mesh of meshes) {
    const overlay = new LineSegments(new WireframeGeometry(mesh.geometry), wireMaterial)
    overlay.renderOrder = 1
    mesh.add(overlay)
    wireOverlays.push(overlay)
  }
}

/** Modeli, ölçeği ne olursa olsun kadraja oturtur. */
function frame(info: Survey): void {
  const distance = (info.radius * 1.15) / Math.sin((camera.fov * Math.PI) / 360)
  const direction = new Vector3(0.62, 0.42, 1).normalize()
  camera.position.copy(info.centre).addScaledVector(direction, distance)
  camera.near = Math.max(0.01, distance - info.radius * 3)
  camera.far = distance + info.radius * 8
  camera.updateProjectionMatrix()
  controls.target.copy(info.centre)
  controls.update()
}

function rebuildGrid(info: Survey): void {
  if (grid) {
    scene.remove(grid)
    grid.geometry.dispose()
  }
  // Izgara adımı modelin ölçeğine göre: 1 m, 0.5 m ya da 0.1 m.
  const span = Math.max(info.size.x, info.size.z)
  const stepSize = span > 4 ? 1 : span > 1.2 ? 0.5 : 0.1
  const divisions = Math.max(8, Math.ceil((span * 2.4) / stepSize))
  grid = new GridHelper(divisions * stepSize, divisions, 0x2a333e, 0x1a2029)
  grid.position.y = new Box3().setFromObject(current!.root).min.y
  grid.visible = showGrid
  scene.add(grid)
  scaleNote.textContent = `ızgara adımı ${stepSize} m`
}

function renderParams(): void {
  paramsHost.replaceChildren()
  const params = current?.params

  if (!params) {
    paramsBlock.hidden = false
    const note = document.createElement('p')
    note.className = 'empty-note'
    note.textContent =
      'Bu model yapılandırılabilir alan bildirmiyor — registry meta\'sında controls boş.'
    paramsHost.append(note)
    return
  }

  paramsBlock.hidden = false
  for (const spec of params.specs) {
    const row = document.createElement('div')
    row.className = 'param'

    const top = document.createElement('div')
    top.className = 'param-top'
    const name = document.createElement('span')
    name.className = 'param-name'
    name.textContent = spec.label
    const value = document.createElement('span')
    value.className = 'param-value'
    top.append(name, value)

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(spec.min)
    slider.max = String(spec.max)
    slider.step = String(spec.step)
    slider.value = String(params.current()[spec.key])
    slider.setAttribute('aria-label', spec.label)

    const show = (raw: number): void => {
      const digits = spec.step < 1 ? (spec.step < 0.05 ? 2 : 2) : 0
      value.textContent = `${raw.toFixed(digits)}${spec.unit ? ` ${spec.unit}` : ''}`
    }
    show(Number(slider.value))

    slider.addEventListener('input', () => {
      const raw = Number(slider.value)
      show(raw)
      params.apply({ [spec.key]: raw })
      applyWireframe(current!.root)
      const info = survey(current!.root)
      writeReadout(info)
      triangleCounts.set(currentEntry!.id, info.triangles)
      paintTriangleBadges()
    })

    row.append(top, slider)
    paramsHost.append(row)
  }
}

function writeReadout(info: Survey): void {
  readout('meshes').textContent = String(info.meshes)
  readout('triangles').textContent = info.triangles.toLocaleString('tr-TR')
  readout('materials').textContent = String(info.materials)
  readout('size').textContent =
    `${info.size.x.toFixed(2)} × ${info.size.y.toFixed(2)} × ${info.size.z.toFixed(2)} m`
}

function paintTriangleBadges(): void {
  for (const [id, count] of triangleCounts) {
    const badge = app.querySelector<HTMLElement>(`[data-tris-for="${id}"]`)
    if (badge) badge.textContent = `${count.toLocaleString('tr-TR')} △`
  }
}

function select(id: string): void {
  const entry = CATALOG[id]
  if (!entry) return

  if (current) {
    scene.remove(current.root)
    current.dispose()
  }

  currentEntry = entry
  current = entry.build()
  scene.add(current.root)
  applyWireframe(current.root)

  const info = survey(current.root)
  triangleCounts.set(id, info.triangles)
  writeReadout(info)
  paintTriangleBadges()
  frame(info)
  rebuildGrid(info)
  renderParams()

  provenanceAddress.textContent = entry.address
  provenanceWho.innerHTML = entry.who

  if (current.action) {
    actionButton.hidden = false
    actionButton.textContent = current.action.label()
  } else {
    actionButton.hidden = true
  }

  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-model]')) {
    button.setAttribute('aria-pressed', String(button.dataset.model === id))
  }
}

/* ------------------------------------------------------------------- olaylar */

for (const button of app.querySelectorAll<HTMLButtonElement>('[data-model]')) {
  button.addEventListener('click', () => select(button.dataset.model!))
}

actionButton.addEventListener('click', () => {
  current?.action?.run()
  // Etiket duruma bağlı olabilir (yak / söndür), o yüzden her tıklamada tazele.
  if (current?.action) actionButton.textContent = current.action.label()
})

function bindToggle(name: string, onChange: (on: boolean) => void, labels: [string, string]): void {
  const button = app.querySelector<HTMLButtonElement>(`[data-toggle="${name}"]`)!
  const state = button.querySelector<HTMLElement>('.state')!
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-pressed') !== 'true'
    button.setAttribute('aria-pressed', String(next))
    state.textContent = next ? labels[0] : labels[1]
    onChange(next)
  })
}

bindToggle('wireframe', (on) => {
  wireframe = on
  if (current) applyWireframe(current.root)
}, ['açık', 'kapalı'])

bindToggle('spin', (on) => { controls.autoRotate = on }, ['açık', 'kapalı'])

bindToggle('grid', (on) => {
  showGrid = on
  if (grid) grid.visible = on
}, ['açık', 'kapalı'])

// ResizeObserver, `resize` olayından güvenilir: sekme gizliyken açılan ya da
// düzeni sonradan oturan sayfalarda canvas 0x0 kalmıyor.
function resize(): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width === 0 || height === 0) return
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
new ResizeObserver(resize).observe(canvas)

/* --------------------------------------------------------------------- döngü */

controls.autoRotate = true
select('iron-brazier')
// Seçili olmayan modellerin üçgen rozetleri için birer kez kurup ölç, sonra
// bırak. Böylece listedeki her satır ne kadar ağır olduğunu baştan söylüyor.
for (const id of Object.keys(CATALOG)) {
  if (triangleCounts.has(id)) continue
  const probe = CATALOG[id]!.build()
  triangleCounts.set(id, survey(probe.root).triangles)
  probe.dispose()
}
paintTriangleBadges()
resize()

let previous = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - previous) / 1000, 0.05)
  previous = now
  current?.update?.(delta)
  controls.update()
  void renderer.render(scene, camera)
})
