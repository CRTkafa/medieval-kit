import {
  Box3,
  Color,
  DataTexture,
  EquirectangularReflectionMapping,
  DirectionalLight,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Sphere,
  Vector3,
  WireframeGeometry,
  type Material,
  type Object3D,
} from 'three/webgpu'
import { WebGPURenderer } from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import './viewer.css'

import {
  CATALOG,
  REGISTRIES,
  SHOWCASE_ORDER,
  controlsFor,
  type Entry,
  type ParamGroup,
  type ParamSpec,
} from './catalog.ts'
import { createShowcase } from './showcase.ts'
import { blend, capture, compatible, type MorphFrame } from './morph.ts'
import { exportGlb } from './glb.ts'

/* ----------------------------------------------------------------- scaffold */

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <aside class="rail">
    <header class="brand">
      <span class="brand-mark">vibe3d</span>
      <span class="brand-sub">source registry inspector</span>
    </header>
    <!--
      Where the kit actually is, and at the TOP of the rail.

      The inspector shows each namespace's registry address as a LABEL: it is
      what models.json resolves, not something anyone can click. Somebody who
      has just spent a minute turning a barrel over has exactly one question
      left, and putting the answer under a list of thirty-seven models means
      scrolling past the whole kit to find it.
    -->
    <section class="block">
      <p class="block-label">Get the kit</p>
      <div class="actions">
        <a class="action" href="https://www.npmjs.com/package/@medieval-kit/registry"
           target="_blank" rel="noopener noreferrer">
          <span>npm</span><span class="state">@medieval-kit/registry</span>
        </a>
        <a class="action" href="https://github.com/CRTkafa/medieval-kit"
           target="_blank" rel="noopener noreferrer">
          <span>source</span><span class="state">github</span>
        </a>
      </div>
      <p class="install"><code>bunx vibe3d add @medieval-kit</code></p>
    </section>
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
      <p class="block-label">Readout</p>
      <dl class="readout">
        <dt>meshes</dt><dd data-readout="meshes">—</dd>
        <dt>triangles</dt><dd data-readout="triangles" class="accent">—</dd>
        <dt>materials</dt><dd data-readout="materials">—</dd>
        <dt>size</dt><dd data-readout="size">—</dd>
        <dt>backend</dt><dd data-readout="backend">—</dd>
      </dl>
    </section>
    <section class="block" data-params-block>
      <p class="block-label">Configuration</p>
      <div class="params" data-params></div>
    </section>
    <section class="block" data-parts-block>
      <p class="block-label">Parts<span class="block-note">click: show only this one</span></p>
      <div class="chips" data-parts></div>
    </section>
    <section class="block" data-slots-block>
      <p class="block-label">Material slots<span class="block-note">materials.override()</span></p>
      <div class="slots" data-slots></div>
    </section>
    <section class="block">
      <p class="block-label">View</p>
      <div class="actions">
        <button class="action action-primary" type="button" data-action hidden></button>
        <button class="action" type="button" data-toggle="wireframe" aria-pressed="false">
          <span>wireframe</span><span class="state">off</span>
        </button>
        <button class="action" type="button" data-toggle="spin" aria-pressed="true">
          <span>auto-rotate</span><span class="state">on</span>
        </button>
        <button class="action" type="button" data-toggle="grid" aria-pressed="true">
          <span>ground grid</span><span class="state">on</span>
        </button>
        <button class="action" type="button" data-toggle="sky" aria-pressed="true">
          <span>sky</span><span class="state">on</span>
        </button>
        <button class="action" type="button" data-export>
          <span>download GLB</span><span class="state">↓</span>
        </button>
      </div>
    </section>
    <section class="block">
      <p class="block-label">Showcase<span class="block-note">press Esc to stop</span></p>
      <div class="actions">
        <!--
          60 s is the default, not 30.

          The tour gives every model an equal share of the running time, so
          across 35 of them 30 s is 0.86 s each, 60 s is 1.7 and 90 s is 2.6.
          A beat spends its time sweeping the parameters and stepping the
          counts, and none of that reads in under a second: the 30 s run is a
          flyby of the kit, 60 s is the one that shows what each model can do,
          and 90 s is there because that share shrinks every time a model is
          added. The order and the emphasis say so.
        -->
        <button class="action action-primary" type="button" data-showcase="60">
          <span>Play 60 s tour</span><span class="state">&#9654;</span>
        </button>
        <button class="action" type="button" data-showcase="30">
          <span>Play 30 s flyby</span><span class="state">&#9654;</span>
        </button>
        <button class="action" type="button" data-showcase="90">
          <span>Play 90 s tour</span><span class="state">&#9654;</span>
        </button>
        <button class="action" type="button" data-record aria-pressed="false">
          <span>Record to file</span><span class="state">off</span>
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
    <span class="overlay hint">drag · wheel to zoom</span>
    <div class="veil" data-veil></div>
    <div class="showcase-caption" data-caption>
      <span class="showcase-address" data-caption-address></span>
      <span class="showcase-note" data-caption-note></span>
    </div>
    <span class="overlay scale-note" data-scale></span>
  </main>
`

const canvas = app.querySelector<HTMLCanvasElement>('canvas')!
const viewport = app.querySelector<HTMLElement>('.viewport')!
const paramsHost = app.querySelector<HTMLDivElement>('[data-params]')!
const paramsBlock = app.querySelector<HTMLElement>('[data-params-block]')!
const actionButton = app.querySelector<HTMLButtonElement>('[data-action]')!
const partsBlock = app.querySelector<HTMLElement>('[data-parts-block]')!
const partsHost = app.querySelector<HTMLElement>('[data-parts]')!
const slotsBlock = app.querySelector<HTMLElement>('[data-slots-block]')!
const slotsHost = app.querySelector<HTMLElement>('[data-slots]')!
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

// WebGPURenderer falls back to its own WebGL2 backend when navigator.gpu is
// missing. The scifi-kit model's TSL node material compiles on both paths.
const renderer = new WebGPURenderer({ canvas, antialias: true })
try {
  await renderer.init()
} catch (error) {
  fatal(`<b>Renderer could not be initialised.</b><span>${String(error)}</span>`)
  throw error
}
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap

// Asked of the renderer, not of the browser.
//
// This read `navigator.gpu ? 'WebGPU' : 'WebGL2 (fallback)'`, which is the
// browser's CAPABILITY and not the backend that ended up being used. Forcing
// the WebGL2 path to see what a visitor without WebGPU gets, the readout went
// on saying WebGPU throughout. The two agree in every ordinary case, which is
// exactly why it would have gone on lying: this line is the only signal anyone
// has about which path they are on, and a readout that can be wrong is worse
// than none.
const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
  ? 'WebGPU'
  : 'WebGL2 (fallback)'
readout('backend').textContent = backend

const scene = new Scene()

/* ---------------------------------------------------------------- sky */

/**
 * Sky dome: blue at the top, pale at the horizon, soil below.
 *
 * The same gradient does two jobs at once. Besides being the visible
 * background it is turned into an environment map through PMREM, so the models
 * REFLECT it. Iron only looks like iron when it reflects something; against a
 * flat colour background it always looks like grey paint.
 */
const SKY_TOP = new Color(0x6fa3d8)
const SKY_HORIZON = new Color(0xdae3ea)
const SKY_GROUND = new Color(0x565042)

/**
 * Sky: an equirectangular texture with a vertical gradient.
 *
 * My first attempt was a big sphere mesh and it came out black — sphere radius
 * 6, camera 2.3 away from the centre, so the back face of the dome sits at 8.3
 * and the far plane was 7.1, which clipped it. Handed over as a texture there
 * is no depth question at all: the background is never clipped.
 *
 * The same texture does two jobs. Besides being the visible background it is
 * turned into an environment map through PMREM, so the models REFLECT it. Iron
 * only looks like iron when it reflects something; against a flat colour
 * background it always looks like grey paint.
 */
function skyTexture(): DataTexture {
  const width = 8
  const height = 128
  const data = new Uint8Array(width * height * 4)
  const c = new Color()
  for (let y = 0; y < height; y += 1) {
    // In equirect mapping texture row 0 lands on the BOTTOM of the sphere, not
    // the top. Written the other way round the sky came out below and the soil
    // above; I measured it and fixed it.
    const t = (y / (height - 1)) * 2 - 1   // -1 bottom, +1 top
    if (t >= 0) c.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(t, 0.6))
    else c.copy(SKY_HORIZON).lerp(SKY_GROUND, Math.pow(-t, 0.35))
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      data[i] = Math.round(c.r * 255)
      data[i + 1] = Math.round(c.g * 255)
      data[i + 2] = Math.round(c.b * 255)
      data[i + 3] = 255
    }
  }
  const texture = new DataTexture(data, width, height)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const skyMap = skyTexture()
{
  const sky = skyMap
  scene.background = sky
  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromEquirectangular(sky).texture
  pmrem.dispose()
  // Metal takes nearly all its colour from reflection. If the environment stays
  // dim, iron comes out near black; I measured it on the anvil, [33,39,44].
  scene.environmentIntensity = 1.35
}

/* ---------------------------------------------------------------- lights */

// The environment map already provides the soft fill light; the job of the
// directional lights is to read out the form and to cast shadows.
const key = new DirectionalLight(0xfff2dd, 2.2)
key.position.set(-6, 9, 7)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.bias = -0.0006
key.shadow.normalBias = 0.02
const fill = new DirectionalLight(0xbcd2e4, 0.5)
fill.position.set(8, 3, 6)
const rim = new DirectionalLight(0x9fb6cc, 0.8)
rim.position.set(5, 6, -8)
scene.add(key, key.target, fill, rim)

/**
 * Shadow plane: shows only the shadow, is itself invisible.
 *
 * The only thing that shows where the models touch down. A part left hanging in
 * the air gives itself away by its shadow — that is exactly how the table's
 * stretcher got caught.
 */
const shadowCatcher = new Mesh(
  new PlaneGeometry(1, 1),
  new ShadowMaterial({ opacity: 0.34, transparent: true }),
)
shadowCatcher.rotation.x = -Math.PI / 2
shadowCatcher.receiveShadow = true
scene.add(shadowCatcher)

const camera = new PerspectiveCamera(34, 1, 0.02, 400)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.autoRotateSpeed = 0.9

let grid: GridHelper | undefined

/* --------------------------------------------------------------------- state */

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
  /** Centre of the bounding BOX — used for framing. */
  centre: Vector3
  /** Centre and radius of the bounding sphere — camera distance comes from it. */
  sphereCentre: Vector3
  radius: number
  /** Lowest point of the model; the ground grid sits here. */
  floor: number
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
    // Framing looks at the box centre, not the sphere centre: on asymmetric
    // models the two diverge and the sphere centre looks visually off.
    centre: box.getCenter(new Vector3()),
    sphereCentre: sphere.center.clone(),
    radius: sphere.radius,
    floor: box.min.y,
  }
}

// The wireframe is drawn with a separate line layer, NOT with `material.wireframe`.
// On the indexed geometries of these models three's WebGPU backend cannot
// produce a valid index buffer for material.wireframe and `setIndexBuffer`
// throws. WireframeGeometry works on both backends and gives a readable
// topology layer on top of the shaded surface.
const wireMaterial = new LineBasicMaterial({
  color: 0x5fc8e8,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
})

let wireOverlays: LineSegments[] = []

/**
 * Applies the scene settings to freshly built meshes.
 *
 * Every call to `configure()` REBUILDS the model meshes — the anchor stays but
 * the contents go. The shadow flags were only being set inside `select()`, so
 * moving a slider silently dropped the model's shadow. Collecting these two jobs
 * in one place keeps them from drifting apart again.
 */
function dressMeshes(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    // Cast and receive both: whether one part touches another is only visible
    // this way.
    object.castShadow = true
    object.receiveShadow = true
  })
  applyWireframe(root)
}

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

/** Fits the model into frame whatever its scale. */
function frame(info: Survey): void {
  // Distance from the sphere radius, target from the box centre. The sphere
  // guarantees it fits in every direction; the box centre is the point the eye
  // counts as "centred".
  const distance = (info.radius * 1.15) / Math.sin((camera.fov * Math.PI) / 360)
  const direction = new Vector3(0.62, 0.42, 1).normalize()
  camera.position.copy(info.centre).addScaledVector(direction, distance)
  camera.near = Math.max(0.01, distance - info.radius * 3)
  camera.far = distance + info.radius * 8
  camera.updateProjectionMatrix()
  controls.target.copy(info.centre)
  controls.update()


  // The shadow camera is narrowed to the scale of the model. Leaving it fixed
  // turned the shadow into pixel soup on small models.
  const reach = info.radius * 1.6
  const shadow = key.shadow.camera
  shadow.left = -reach
  shadow.right = reach
  shadow.top = reach
  shadow.bottom = -reach
  shadow.near = 0.05
  shadow.far = reach * 8
  shadow.updateProjectionMatrix()
  key.position.copy(info.centre).add(new Vector3(-0.6, 1.15, 0.75).multiplyScalar(reach * 2.2))
  key.target.position.copy(info.centre)
  key.target.updateMatrixWorld()
}

function rebuildGrid(info: Survey): void {
  if (grid) {
    scene.remove(grid)
    grid.geometry.dispose()
  }
  // Grid step follows the scale of the model: 1 m, 0.5 m or 0.1 m.
  const span = Math.max(info.size.x, info.size.z)
  const stepSize = span > 4 ? 1 : span > 1.2 ? 0.5 : 0.1
  const divisions = Math.max(8, Math.ceil((span * 2.4) / stepSize))
  grid = new GridHelper(divisions * stepSize, divisions, 0x2a333e, 0x1a2029)
  grid.position.y = info.floor
  // The shadow plane sits at the grid's height but a hair below it: exactly
  // coplanar, the two would z-fight with each other.
  shadowCatcher.position.set(info.centre.x, info.floor - span * 0.0015, info.centre.z)
  shadowCatcher.scale.setScalar(Math.max(span * 4, 1))
  grid.visible = showGrid
  scene.add(grid)
  scaleNote.textContent = `grid step ${stepSize} m`
}

/**
 * Parts panel.
 *
 * The protocol's semantic part idea only means something if it is VISIBLE. Here
 * every part is a button: clicking SOLOS it, clicking again brings them all
 * back. This is the fastest way to grasp that a model really is "chest body +
 * lid + strap + lock".
 *
 * Visibility is set on the ANCHOR, not on the mesh — the anchor is the only
 * thing that survives a rebuild, so a hidden part does not come back when a
 * slider is moved.
 */
let soloPart: string | undefined

function renderParts(): void {
  partsHost.replaceChildren()
  const inspect = current?.inspect
  partsBlock.hidden = !inspect || inspect.parts.length === 0
  if (!inspect) return

  const paint = (): void => {
    for (const button of partsHost.querySelectorAll<HTMLButtonElement>('[data-part]')) {
      const name = button.dataset.part!
      const visible = inspect.isPartVisible(name)
      button.setAttribute('aria-pressed', String(soloPart === name))
      button.classList.toggle('muted', !visible)
    }
  }

  for (const name of inspect.parts) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    button.dataset.part = name
    button.textContent = name
    button.addEventListener('click', () => {
      soloPart = soloPart === name ? undefined : name
      for (const other of inspect.parts) {
        inspect.setPartVisible(other, soloPart === undefined || other === soloPart)
      }
      paint()
    })
    partsHost.append(button)
  }
  paint()
}

/**
 * Material slot panel.
 *
 * The answer to "would adding a colour configuration system break the
 * protocol?" shows up here: IT WOULD NOT, because it is already there.
 * `materials.override()` hands the slot a new material and that material's
 * `color` is MULTIPLIED with the vertex colours — so tinting does not erase the
 * model's own variation, it rides on top of it. No new field is needed in the
 * protocol.
 *
 * The panel also makes an ownership claim: the material handed in belongs to the
 * CONSUMER, the model does not `dispose()` it. The reset button brings back the
 * model's own.
 */
function renderSlots(): void {
  slotsHost.replaceChildren()
  const inspect = current?.inspect
  slotsBlock.hidden = !inspect || inspect.slots.length === 0
  if (!inspect) return

  for (const slot of inspect.slots) {
    const row = document.createElement('div')
    row.className = 'slot'

    const swatch = document.createElement('input')
    swatch.type = 'color'
    swatch.className = 'slot-swatch'
    swatch.value = inspect.slotColour(slot)
    swatch.title = `tint the ${slot} slot`

    const name = document.createElement('span')
    name.className = 'slot-name'
    name.textContent = slot

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'slot-reset'
    reset.textContent = '↺'
    reset.title = 'return the slot to the model default'
    reset.hidden = !inspect.isTinted(slot)

    swatch.addEventListener('input', () => {
      inspect.tintSlot(slot, swatch.value)
      // The override triggers a rebuild: the new meshes have to get the shadow
      // flags and the wireframe back.
      dressMeshes(current!.root)
      reset.hidden = false
      row.classList.add('tinted')
    })
    reset.addEventListener('click', () => {
      inspect.resetSlot(slot)
      dressMeshes(current!.root)
      swatch.value = inspect.slotColour(slot)
      reset.hidden = true
      row.classList.remove('tinted')
    })

    row.append(swatch, name, reset)
    slotsHost.append(row)
  }
}

function renderParams(): void {
  paramsHost.replaceChildren()
  const params = current?.params

  if (!params) {
    paramsBlock.hidden = false
    const note = document.createElement('p')
    note.className = 'empty-note'
    note.textContent =
      'This model declares no configurable fields — controls is empty in the registry meta.'
    paramsHost.append(note)
    return
  }

  paramsBlock.hidden = false

  // The model is built with its defaults, so the first read gives the default
  // values. Kept around so a slider can be sent back there at any moment.
  const defaults = { ...params.current() }
  const sliders = new Map<string, HTMLInputElement>()

  const applyValue = (key: string, raw: number): void => {
    params.apply({ [key]: raw })
    dressMeshes(current!.root)
    const info = survey(current!.root)
    writeReadout(info)
    triangleCounts.set(currentEntry!.id, info.triangles)
    paintTriangleBadges()
    rebuildGrid(info)
  }

  const resetAll = document.createElement('button')
  resetAll.type = 'button'
  resetAll.className = 'action reset-all'
  resetAll.innerHTML = '<span>back to defaults</span><span class="state">↺</span>'
  resetAll.addEventListener('click', () => {
    for (const [key, input] of sliders) {
      input.value = String(defaults[key])
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  paramsHost.append(resetAll)

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

    sliders.set(spec.key, slider)

    // Clicking the label returns that field to its default.
    name.classList.add('resettable')
    name.title = `default: ${defaults[spec.key]}`
    name.addEventListener('click', () => {
      slider.value = String(defaults[spec.key])
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const show = (raw: number): void => {
      const digits = spec.step < 1 ? (spec.step < 0.05 ? 2 : 2) : 0
      value.textContent = `${raw.toFixed(digits)}${spec.unit ? ` ${spec.unit}` : ''}`
    }
    show(Number(slider.value))

    slider.addEventListener('input', () => {
      const raw = Number(slider.value)
      show(raw)
      // A field that departs from its default gets marked: which one you moved
      // should be visible at a glance.
      name.classList.toggle('changed', raw !== defaults[spec.key])
      applyValue(spec.key, raw)
    })

    row.append(top, slider)
    paramsHost.append(row)
  }
}

function writeReadout(info: Survey): void {
  readout('meshes').textContent = String(info.meshes)
  readout('triangles').textContent = info.triangles.toLocaleString('en-US')
  readout('materials').textContent = String(info.materials)
  readout('size').textContent =
    `${info.size.x.toFixed(2)} × ${info.size.y.toFixed(2)} × ${info.size.z.toFixed(2)} m`
}

function paintTriangleBadges(): void {
  for (const [id, count] of triangleCounts) {
    const badge = app.querySelector<HTMLElement>(`[data-tris-for="${id}"]`)
    if (badge) badge.textContent = `${count.toLocaleString('en-US')} △`
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
  dressMeshes(current.root)

  const info = survey(current.root)
  triangleCounts.set(id, info.triangles)
  writeReadout(info)
  paintTriangleBadges()
  frame(info)
  rebuildGrid(info)
  renderParams()
  soloPart = undefined
  renderParts()
  renderSlots()

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

/* ------------------------------------------------------------------- events */

for (const button of app.querySelectorAll<HTMLButtonElement>('[data-model]')) {
  button.addEventListener('click', () => select(button.dataset.model!))
}

/**
 * GLB download.
 *
 * The export lives in `src/glb.ts` and the same code is used for the batch
 * export too — so the button here and `bun scripts/export-glb.ts` produce a
 * bit-for-bit identical file. The two drifting apart would mean an export that
 * works in the browser but not in the CLI (or the other way round).
 *
 * The object URL is released AFTER the download has started: releasing it
 * immediately cuts the download short in some browsers.
 */
const exportButton = app.querySelector<HTMLButtonElement>('[data-export]')!
const exportState = exportButton.querySelector<HTMLElement>('.state')!

exportButton.addEventListener('click', async () => {
  if (!current || exportButton.disabled) return
  exportButton.disabled = true
  exportState.textContent = '…'
  try {
    const id = currentEntry?.id ?? current.root.name
    const buffer = await exportGlb(current.root, {
      name: id,
      extras: currentEntry ? { vibe3d: { model: currentEntry.address } } : undefined,
    })
    const url = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${id}.glb`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    exportState.textContent = '✓'
  } catch (error) {
    console.error('GLB export failed:', error)
    exportState.textContent = '✕'
  } finally {
    exportButton.disabled = false
    setTimeout(() => { exportState.textContent = '↓' }, 2200)
  }
})

actionButton.addEventListener('click', () => {
  current?.action?.run()
  // The label can depend on state (light / snuff), so refresh it on every click.
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
}, ['on', 'off'])

bindToggle('spin', (on) => { controls.autoRotate = on }, ['on', 'off'])

bindToggle('grid', (on) => {
  showGrid = on
  if (grid) grid.visible = on
}, ['on', 'off'])

// With the sky off, a flat dark ground: better for reading the silhouette. The
// environment map stays on, otherwise the metal would go dark.
bindToggle('sky', (on) => {
  scene.background = on ? skyMap : new Color(0x0b0e12)
  shadowCatcher.visible = on
}, ['on', 'off'])

// ResizeObserver is more reliable than the `resize` event: on pages opened with
// the tab hidden, or whose layout settles later, the canvas does not stay 0x0.
/**
 * Set while recording, holding what to put back afterwards.
 *
 * A recording is locked to 1920x1080 rather than taking whatever size the
 * browser window happens to be. Measured, an unlocked capture came out at
 * 1220x900 -- a 1.36:1 clip, which is not a video shape anyone expects and
 * which every platform will letterbox differently.
 */
let recordingSize: { ratio: number } | undefined

function resize(): void {
  // The observer keeps firing while recording; it must not undo the lock.
  if (recordingSize) return
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width === 0 || height === 0) return
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
new ResizeObserver(resize).observe(canvas)

/* --------------------------------------------------------------------- loop */

controls.autoRotate = true
select('cart-wheel')
// For the triangle badges of the unselected models, build once, measure, then
// drop. That way every row in the list says up front how heavy it is.
for (const id of Object.keys(CATALOG)) {
  if (triangleCounts.has(id)) continue
  const probe = CATALOG[id]!.build()
  triangleCounts.set(id, survey(probe.root).triangles)
  probe.dispose()
}
paintTriangleBadges()
resize()

/**
 * Development hook. Vite pins `import.meta.env.DEV` to `false` in a production
 * build and drops this block entirely, so it is absent from the published page.
 *
 * requestAnimationFrame stops while the tab is in the background, so automated
 * tests could not get a frame; `renderOnce` closes that gap.
 */
if (import.meta.env.DEV) {
  Object.assign(globalThis, {
    __probe: {
      renderOnce: () => renderer.render(scene, camera),
      /** One full frame, including showcase advance. */
      step: (delta: number) => frameStep(delta),
      /** What the tour is showing right now. */
      showcase: () => ({
        running: showcase.isRunning(),
        progress: +showcase.progress().toFixed(4),
        caption: app.querySelector('[data-caption-address]')?.textContent ?? '',
      }),
      /**
       * How much of the current model is actually ON SCREEN.
       *
       * The tour is the one part of this project that a still render cannot
       * check, and looking at a handful of frames is how a model half out of
       * frame gets shipped — it happened once already, with the bottom of
       * every model cut off. This projects the model's own bounding box into
       * normalised device coordinates and reports the worst overshoot, so the
       * whole 60 seconds can be swept and the bad moments found by number
       * rather than by scrubbing.
       *
       * 0 means comfortably inside. 1 means a corner is exactly on the edge of
       * the frame. Above 1 is off screen.
       */
      framing: () => {
        if (!current) return null
        const box = new Box3().setFromObject(current.root)
        if (box.isEmpty()) return null
        camera.updateMatrixWorld(true)
        const corner = new Vector3()
        let worst = 0
        for (let i = 0; i < 8; i += 1) {
          corner.set(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z,
          ).project(camera)
          worst = Math.max(worst, Math.abs(corner.x), Math.abs(corner.y))
        }
        return +worst.toFixed(3)
      },
      state: () => {
        const info = survey(current!.root)
        return {
          boxCentre: info.centre.toArray().map((v) => +v.toFixed(3)),
          target: controls.target.toArray().map((v) => +v.toFixed(3)),
          floor: +info.floor.toFixed(3),
          gridY: grid ? +grid.position.y.toFixed(3) : null,
          shadowY: +shadowCatcher.position.y.toFixed(3),
          shadowsOn: renderer.shadowMap.enabled,
          environment: scene.environment !== null,
        }
      },
      /**
       * The real state of every mesh in the scene.
       *
       * Makes two things testable from the browser, and both came out of real
       * bugs: shadow flags dropping after `configure()` (they were not being
       * set on the new meshes) and whether `materials.override()` actually
       * reaches the scene.
       */
      /** First few vertex components of the first mesh — proves a morph moves. */
      vertex: () => {
        let out: number[] = []
        current?.root.traverse((object) => {
          if (out.length || !(object instanceof Mesh)) return
          const p = object.geometry.getAttribute('position')
          out = [0, 1, 2, 3].map((i) => +p.getX(i).toFixed(5))
        })
        return out
      },
      meshes: () => {
        const rows: Array<Record<string, unknown>> = []
        current?.root.traverse((object) => {
          if (!(object instanceof Mesh)) return
          const material = object.material as { name?: string; color?: { getHexString(): string } }
          rows.push({
            name: object.name,
            slot: (object.userData.vibe3d as { materialSlot?: string } | undefined)?.materialSlot,
            colour: material.color ? `#${material.color.getHexString()}` : null,
            material: material.name ?? null,
            castShadow: object.castShadow,
            receiveShadow: object.receiveShadow,
            visible: object.parent?.parent?.visible !== false,
          })
        })
        return rows
      },
    },
  })
}

let previous = performance.now()
/* ----------------------------------------------------------------- showcase */

const veil = app.querySelector<HTMLElement>('[data-veil]')!
const captionBox = app.querySelector<HTMLElement>('[data-caption]')!
const captionAddress = app.querySelector<HTMLElement>('[data-caption-address]')!
const captionNote = app.querySelector<HTMLElement>('[data-caption-note]')!
const recordButton = app.querySelector<HTMLButtonElement>('[data-record]')!
const recordState = recordButton.querySelector<HTMLElement>('.state')!

let recorder: MediaRecorder | undefined
let morphStart: MorphFrame | undefined
let morphEnd: MorphFrame | undefined

/**
 * The showcase drives the camera directly, so OrbitControls has to step aside
 * for the duration. Leaving it enabled meant damping pulled the camera back
 * towards its own target every frame and the orbit crawled.
 */
const showcase = createShowcase({
  camera,
  target: controls.target,
  models: SHOWCASE_ORDER,
  controls: (id) => controlsFor(id),
  select: (id) => { select(id) },
  configure: (patch) => {
    current?.params?.apply(patch)
    if (current) dressMeshes(current.root)
  },
  prepareMorph: (from, to) => {
    if (!current?.params) return false
    // Build the far end first, capture it, then come back to the near end. The
    // live geometry has to be left holding the START pose, because that is the
    // buffer `blend` writes into.
    current.params.apply(to)
    dressMeshes(current.root)
    const end = capture(current.root)
    current.params.apply(from)
    dressMeshes(current.root)
    const start = capture(current.root)
    if (!compatible(start, end)) {
      morphStart = undefined
      morphEnd = undefined
      return false
    }
    morphStart = start
    morphEnd = end
    return true
  },
  applyMorph: (t) => {
    if (!current || !morphStart || !morphEnd) return
    blend(current.root, morphStart, morphEnd, t)
  },
  hasAction: () => current?.action !== undefined,
  triggerAction: () => { current?.action?.run() },
  framing: () => {
    const info = survey(current!.root)
    return { centre: info.centre, radius: info.radius }
  },
  caption: (address, note, opacity) => {
    captionAddress.textContent = address
    captionNote.textContent = note
    captionBox.style.opacity = String(opacity)
  },
  dim: (amount) => { veil.style.opacity = String(amount) },
  setChromeHidden: (hidden) => {
    app.classList.toggle('showcase-running', hidden)
    controls.enabled = !hidden
    if (hidden) controls.autoRotate = false
  },
})

/**
 * Records the canvas straight to a file.
 *
 * Asking someone to screen-record loses half the point: the window furniture,
 * the cursor and whatever the desktop scale factor happens to be all end up in
 * the clip. `captureStream` takes the canvas alone at its own resolution.
 *
 * The output is WebM because that is what browsers encode natively. Twitter
 * wants MP4, so the README documents the one-line ffmpeg remux rather than
 * pretending the file is ready to post.
 */
/** Local time, colons out: several takes in a session must not overwrite. */
function stamp(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function startRecording(label: string): void {
  // Lock to 1080p at pixel ratio 1: `captureStream` takes the drawing buffer,
  // so a ratio of 2 would record 3840x2160 and cost four times the pixels for
  // a clip nobody will view above 1080.
  recordingSize = { ratio: renderer.getPixelRatio() }
  renderer.setPixelRatio(1)
  renderer.setSize(1920, 1080, false)
  camera.aspect = 1920 / 1080
  camera.updateProjectionMatrix()
  /**
   * Letterboxed, so what is on screen is what is in the file.
   *
   * `setSize(..., false)` deliberately leaves the CSS box alone: it changes the
   * drawing buffer and nothing else. That is right for the recording and wrong
   * for the person making it, because a 1920x1080 buffer stretched into a box
   * of some other shape is a preview that lies about its own framing. Whoever
   * is driving the sliders is composing a shot they cannot see.
   */
  document.body.classList.add('recording')

  const stream = canvas.captureStream(60)
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type))
  if (!mimeType) {
    console.warn('This browser cannot record the canvas; run the tour without recording.')
    return
  }
  const chunks: Blob[] = []
  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 })
  recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }))
    const link = document.createElement('a')
    link.href = url
    link.download = `medieval-kit-${label}.webm`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    recorder = undefined
    recordButton.setAttribute('aria-pressed', 'false')
    recordState.textContent = 'off'
    document.body.classList.remove('recording')
    if (recordingSize) {
      renderer.setPixelRatio(recordingSize.ratio)
      recordingSize = undefined
      resize()
    }
  }
  recorder.start()
}

/**
 * A backgrounded tab draws nothing, so it must not keep recording.
 *
 * `setAnimationLoop` runs on requestAnimationFrame, which browsers stop
 * entirely while the tab is hidden -- measured here at zero frames per second.
 * The showcase therefore stops advancing AND the canvas stops producing frames
 * for `captureStream`, so what carries on being written is a frozen image with
 * a running clock. A 60 s tour is long enough that reaching for another window
 * is the natural thing to do, and the failure is silent: the file looks the
 * right length and is not.
 *
 * Ending the take is the honest answer. A short clip you know about beats a
 * full-length one that is fifty seconds of a still frame.
 */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !recorder) return
  console.warn(
    'medieval-kit: the tab lost focus, so the canvas stopped producing frames. '
    + 'The recording has been ended here rather than filling with a frozen image. '
    + 'Keep the window visible for the whole tour.',
  )
  showcase.stop()
  recorder.stop()
})

function runShowcase(seconds: number): void {
  if (showcase.isRunning()) return
  showcase.start(seconds)
}

for (const button of app.querySelectorAll<HTMLButtonElement>('[data-showcase]')) {
  button.addEventListener('click', () => runShowcase(Number(button.dataset.showcase)))
}

/**
 * Records what you are doing, not only what the tour does.
 *
 * This used to arm the NEXT showcase and nothing else, so the one thing it
 * could not capture was somebody driving the model themselves: pulling the
 * sliders, turning it over, finding the angle. That is most of what the
 * inspector is for. Now it starts and stops on the spot, and a tour started
 * while it is running is captured like anything else.
 */
recordButton.addEventListener('click', () => {
  if (recorder) {
    recorder.stop()
    return
  }
  startRecording(stamp())
  recordButton.setAttribute('aria-pressed', 'true')
  recordState.textContent = 'stop'
})

function endShowcase(): void {
  showcase.stop()
  recorder?.stop()
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && showcase.isRunning()) endShowcase()
})

// A tour can be started straight from the URL: viewer.html?showcase=60. That is
// what makes an unattended recording possible — open, record, close.
const requested = Number(new URLSearchParams(location.search).get('showcase'))
if (requested === 30 || requested === 60 || requested === 90) {
  // One frame of grace so the first model is built and framed before the
  // camera starts moving.
  setTimeout(() => runShowcase(requested), 400)
}

/**
 * One frame, factored out so it can be stepped by hand.
 *
 * `setAnimationLoop` runs on requestAnimationFrame, which a browser stops
 * entirely while the tab is in the background -- measured at zero frames per
 * second. That makes the tour impossible to exercise from an automated test,
 * which is the same gap `renderOnce` was added for; `renderOnce` draws a frame
 * but does not advance anything, so it cannot tell you whether the showcase
 * gets through its beats.
 */
function frameStep(delta: number): void {
  current?.update?.(delta)
  if (showcase.isRunning()) {
    if (!showcase.update(delta)) recorder?.stop()
  } else {
    controls.update()
  }
  void renderer.render(scene, camera)
}

renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - previous) / 1000, 0.05)
  previous = now
  frameStep(delta)
})
