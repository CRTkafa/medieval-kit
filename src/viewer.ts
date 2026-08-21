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

import { CATALOG, REGISTRIES, type Entry, type ParamGroup, type ParamSpec } from './catalog.ts'
import { exportGlb } from './glb.ts'

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
    <section class="block" data-parts-block>
      <p class="block-label">Parçalar<span class="block-note">tıkla: yalnız onu göster</span></p>
      <div class="chips" data-parts></div>
    </section>
    <section class="block" data-slots-block>
      <p class="block-label">Materyal yuvaları<span class="block-note">materials.override()</span></p>
      <div class="slots" data-slots></div>
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
        <button class="action" type="button" data-toggle="sky" aria-pressed="true">
          <span>gökyüzü</span><span class="state">açık</span>
        </button>
        <button class="action" type="button" data-export>
          <span>GLB indir</span><span class="state">↓</span>
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
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap

const backend = navigator.gpu ? 'WebGPU' : 'WebGL2 (yedek)'
readout('backend').textContent = backend

const scene = new Scene()

/* ------------------------------------------------------------- gökyüzü */

/**
 * Gökyüzü kubbesi: tepede mavi, ufukta soluk, altta toprak.
 *
 * Aynı gradyan iki iş birden yapıyor. Görünen arka plan olmasının yanında
 * PMREM ile ortam haritasına çevriliyor, yani modeller onu YANSITIYOR. Demir
 * ancak bir şey yansıttığında demir gibi görünür; düz renk arka planda hep
 * gri boya gibi durur.
 */
const SKY_TOP = new Color(0x6fa3d8)
const SKY_HORIZON = new Color(0xdae3ea)
const SKY_GROUND = new Color(0x565042)

/**
 * Gökyüzü: dikey gradyanlı bir equirectangular doku.
 *
 * İlk denemem büyük bir küre meshiydi ve siyah çıkıyordu — küre yarıçapı 6,
 * kamera merkezden 2.3 uzakta, yani kubbenin arka yüzü 8.3'te kalıyor ve uzak
 * düzlem 7.1 olduğu için kırpılıyordu. Doku olarak verilince derinlik diye bir
 * mesele kalmıyor: arka plan hiçbir zaman kırpılmaz.
 *
 * Aynı doku iki iş yapıyor. Görünen arka plan olmasının yanında PMREM ile
 * ortam haritasına çevriliyor, yani modeller onu YANSITIYOR. Demir ancak bir
 * şey yansıttığında demir gibi görünür; düz renk arka planda hep gri boya
 * gibi durur.
 */
function skyTexture(): DataTexture {
  const width = 8
  const height = 128
  const data = new Uint8Array(width * height * 4)
  const c = new Color()
  for (let y = 0; y < height; y += 1) {
    // Equirect eşlemesinde doku satır 0 kürenin DİBİNE denk geliyor, tepesine
    // değil. Ters yazınca gökyüzü aşağıda toprak yukarıda çıkıyordu; ölçüp
    // düzelttim.
    const t = (y / (height - 1)) * 2 - 1   // -1 dip, +1 tepe
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
  // Metal rengini neredeyse tamamen yansımadan alır. Ortam sönük kalırsa demir
  // siyaha yakın çıkıyor; örste ölçtüm, [33,39,44] geliyordu.
  scene.environmentIntensity = 1.35
}

/* --------------------------------------------------------------- ışıklar */

// Ortam haritası yumuşak dolgu ışığını zaten veriyor; yönlü ışıkların işi
// biçimi okutmak ve gölge düşürmek.
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
 * Gölge düzlemi: sadece gölgeyi gösterir, kendisi görünmez.
 *
 * Modellerin nereye değdiğini gösteren tek şey bu. Havada duran bir parça
 * gölgesiyle ele veriyor — nitekim masanın gergisi tam böyle yakalanmıştı.
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
  /** Sınır KUTUSUNUN merkezi — kadrajlamada kullanılır. */
  centre: Vector3
  /** Sınır küresinin merkezi ve yarıçapı — kamera mesafesi buradan çıkar. */
  sphereCentre: Vector3
  radius: number
  /** Modelin en alt noktası; zemin ızgarası buraya oturur. */
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
    // Kadraj kutu merkezine bakar, küre merkezine değil: asimetrik modellerde
    // ikisi ayrışır ve küre merkezi görsel olarak kaymış görünür.
    centre: box.getCenter(new Vector3()),
    sphereCentre: sphere.center.clone(),
    radius: sphere.radius,
    floor: box.min.y,
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

/**
 * Yeni üretilen mesh'lere sahne ayarlarını uygular.
 *
 * `configure()` her çağrıldığında model mesh'lerini YENİDEN kuruyor — anchor
 * kalıyor ama içerik gidiyor. Gölge bayrakları yalnızca `select()` içinde
 * atanıyordu, dolayısıyla bir kaydırıcıyı oynatmak modelin gölgesini sessizce
 * düşürüyordu. Bu iki işi tek yere toplamak, bir daha ayrışmalarını engelliyor.
 */
function dressMeshes(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    // Hem düşürsün hem alsın: bir parçanın diğerine değip değmediği ancak
    // böyle görünüyor.
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

/** Modeli, ölçeği ne olursa olsun kadraja oturtur. */
function frame(info: Survey): void {
  // Mesafe küre yarıçapından, hedef kutu merkezinden. Küre her yönde sığmayı
  // garantiler; kutu merkezi ise gözün "ortalanmış" saydığı noktadır.
  const distance = (info.radius * 1.15) / Math.sin((camera.fov * Math.PI) / 360)
  const direction = new Vector3(0.62, 0.42, 1).normalize()
  camera.position.copy(info.centre).addScaledVector(direction, distance)
  camera.near = Math.max(0.01, distance - info.radius * 3)
  camera.far = distance + info.radius * 8
  camera.updateProjectionMatrix()
  controls.target.copy(info.centre)
  controls.update()


  // Gölge kamerası modelin ölçeğine göre daraltılıyor. Sabit bırakmak küçük
  // modellerde gölgeyi piksel çorbasına çeviriyordu.
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
  // Izgara adımı modelin ölçeğine göre: 1 m, 0.5 m ya da 0.1 m.
  const span = Math.max(info.size.x, info.size.z)
  const stepSize = span > 4 ? 1 : span > 1.2 ? 0.5 : 0.1
  const divisions = Math.max(8, Math.ceil((span * 2.4) / stepSize))
  grid = new GridHelper(divisions * stepSize, divisions, 0x2a333e, 0x1a2029)
  grid.position.y = info.floor
  // Gölge düzlemi ızgarayla aynı yükseklikte ama bir kıl altında: ikisi tam
  // aynı düzlemde olsa birbiriyle z-fight yaparlardı.
  shadowCatcher.position.set(info.centre.x, info.floor - span * 0.0015, info.centre.z)
  shadowCatcher.scale.setScalar(Math.max(span * 4, 1))
  grid.visible = showGrid
  scene.add(grid)
  scaleNote.textContent = `ızgara adımı ${stepSize} m`
}

/**
 * Parça paneli.
 *
 * Protokolün semantik parça fikri ancak GÖRÜNÜRSE bir şey ifade ediyor. Burada
 * her parça bir düğme: tıklamak onu YALNIZ BIRAKIYOR (solo), tekrar tıklamak
 * hepsini geri getiriyor. Bir modelin gerçekten "sandık gövdesi + kapak + kayış
 * + kilit" olduğunu anlamanın en hızlı yolu bu.
 *
 * Görünürlük ANCHOR üzerinde ayarlanıyor, mesh üzerinde değil — anchor
 * rebuild'i atlatan tek şey, dolayısıyla bir kaydırıcı oynatınca gizlenen
 * parça geri gelmiyor.
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
 * Materyal yuvası paneli.
 *
 * "Renk yapılandırma sistemi eklesek protokolü bozar mı?" sorusunun cevabı
 * burada görünüyor: BOZMAZ, çünkü zaten var. `materials.override()` yuvaya
 * yeni bir materyal veriyor ve materyalin `color`'ı vertex renkleriyle
 * ÇARPILIYOR — yani ton vermek modelin kendi varyasyonunu silmiyor, üstüne
 * biniyor. Protokole yeni bir alan eklemeye gerek yok.
 *
 * Panelin ayrıca bir sahiplik iddiası var: verilen materyal TÜKETİCİNİN, model
 * onu `dispose()` etmiyor. Sıfırla düğmesi modelinkini geri getiriyor.
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
    swatch.title = `${slot} yuvasını boya`

    const name = document.createElement('span')
    name.className = 'slot-name'
    name.textContent = slot

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'slot-reset'
    reset.textContent = '↺'
    reset.title = 'yuvayı modelin varsayılanına döndür'
    reset.hidden = !inspect.isTinted(slot)

    swatch.addEventListener('input', () => {
      inspect.tintSlot(slot, swatch.value)
      // Override yeniden inşa tetikliyor: yeni mesh'ler gölge bayraklarını ve
      // tel kafesi geri almalı.
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
      'Bu model yapılandırılabilir alan bildirmiyor — registry meta\'sında controls boş.'
    paramsHost.append(note)
    return
  }

  paramsBlock.hidden = false

  // Model varsayılanlarıyla kuruluyor, dolayısıyla ilk okuma varsayılan
  // değerlerdir. Kaydırıcıyı istediğin an oraya döndürebilmek için saklanıyor.
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
  resetAll.innerHTML = '<span>varsayılanlara dön</span><span class="state">↺</span>'
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

    // Etikete tıklayınca o alan varsayılanına döner.
    name.classList.add('resettable')
    name.title = `varsayılan: ${defaults[spec.key]}`
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
      // Varsayılandan sapan alan işaretleniyor: hangisini değiştirdiğin
      // bir bakışta görünsün.
      name.classList.toggle('changed', raw !== defaults[spec.key])
      applyValue(spec.key, raw)
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

/* ------------------------------------------------------------------- olaylar */

for (const button of app.querySelectorAll<HTMLButtonElement>('[data-model]')) {
  button.addEventListener('click', () => select(button.dataset.model!))
}

/**
 * GLB indirme.
 *
 * Dışa aktarım `src/glb.ts`'te ve aynı kod toplu dışa aktarımda da kullanılıyor
 * — yani buradaki düğmeyle `bun scripts/export-glb.ts` bit bit aynı dosyayı
 * üretiyor. İkisinin ayrışması, tarayıcıda çalışıp CLI'da çalışmayan (ya da
 * tersi) bir dışa aktarım demek olurdu.
 *
 * Nesne URL'i indirme başladıktan SONRA bırakılıyor: hemen bırakmak bazı
 * tarayıcılarda indirmeyi yarıda kesiyor.
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
    console.error('GLB dışa aktarımı başarısız:', error)
    exportState.textContent = '✕'
  } finally {
    exportButton.disabled = false
    setTimeout(() => { exportState.textContent = '↓' }, 2200)
  }
})

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

// Gökyüzü kapalıyken düz koyu zemin: siluet okumak için daha iyi. Ortam
// haritası açık kalıyor, yoksa metal kararırdı.
bindToggle('sky', (on) => {
  scene.background = on ? skyMap : new Color(0x0b0e12)
  shadowCatcher.visible = on
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
select('cart-wheel')
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

/**
 * Geliştirme kancası. Vite `import.meta.env.DEV` değerini üretim derlemesinde
 * `false`'a sabitleyip bu bloğu tamamen atıyor, yani yayınlanan sayfada yok.
 *
 * Sekme arka plandayken requestAnimationFrame durduğu için otomatik testlerde
 * kare alınamıyordu; `renderOnce` o boşluğu kapatıyor.
 */
if (import.meta.env.DEV) {
  Object.assign(globalThis, {
    __probe: {
      renderOnce: () => renderer.render(scene, camera),
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
       * Sahnedeki her mesh'in gerçek durumu.
       *
       * İki şeyi tarayıcıdan sınanabilir yapıyor ve ikisi de gerçek hatalardan
       * doğdu: `configure()` sonrası gölge bayraklarının düşmesi (yeni
       * mesh'lere atanmıyordu) ve `materials.override()`'ın gerçekten sahneye
       * ulaşıp ulaşmadığı.
       */
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
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = Math.min((now - previous) / 1000, 0.05)
  previous = now
  current?.update?.(delta)
  controls.update()
  void renderer.render(scene, camera)
})
