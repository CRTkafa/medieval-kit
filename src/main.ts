import { WebGPURenderer } from 'three/webgpu'
import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// İki farklı registry'den iki model. Aynı CLI, aynı proje, aynı render döngüsü.
import { createPreview as createGaugePreview } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const stageButtons = document.querySelectorAll<HTMLButtonElement>('[data-stage]')
const actionButton = document.querySelector<HTMLButtonElement>('#action')!

if (!navigator.gpu) {
  status.classList.add('error')
  status.textContent =
    'Bu tarayıcıda WebGPU yok. scifi-kit modelleri TSL düğüm materyalleri kullanıyor ve ' +
    'WebGPURenderer gerektiriyor. Chrome/Edge 113+ deneyin.'
  throw new Error('WebGPU unavailable')
}

const renderer = new WebGPURenderer({ canvas, antialias: true })
await renderer.init()
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2))

interface Stage {
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly target: Vector3
  readonly actionLabel: string
  readonly note: string
  action(): void
  update(deltaSeconds: number): void
  dispose(): void
}

/**
 * Sci-fi ölçer: sahneyi, ışıkları ve referans kamerasını modelin kendi
 * `createPreview` fonksiyonu kuruyor. Model yazarının niyet ettiği kadraj bu.
 */
function gaugeStage(aspect: number): Stage {
  const preview = createGaugePreview({ aspect })
  return {
    scene: preview.scene,
    camera: preview.camera,
    target: new Vector3(0.25, 2.55, 0),
    actionLabel: 'Basınç testi',
    note: '@scifi-kit/pressure-gauge · WebGPU + TSL aşınma materyali · sahne modelin createPreview\'ından geliyor',
    action: () => preview.triggerPressureTest(),
    update: (delta) => preview.update(delta),
    dispose: () => preview.dispose(),
  }
}

/**
 * Medieval fıçı: registry sadece modeli dağıtıyor, önizleme yok. Sahneyi,
 * ışıkları ve kamerayı uygulama kuruyor — vibe3d'nin asıl sözleşmesi bu.
 */
function barrelStage(aspect: number): Stage {
  const barrel = createBarrel()

  const scene = new Scene()
  scene.background = new Color(0x0b0d10)
  scene.add(barrel.root)
  scene.add(new HemisphereLight(0xb9c7d4, 0x141008, 0.7))
  const key = new DirectionalLight(0xffe9c4, 2.4)
  key.position.set(-3, 5, 4)
  scene.add(key)
  const rim = new DirectionalLight(0x8fb4d6, 0.9)
  rim.position.set(4, 3, -4)
  scene.add(rim)

  const camera = new PerspectiveCamera(35, aspect, 0.05, 50)
  camera.position.set(1.5, 1.25, 2.1)
  camera.lookAt(0, 0.1, 0)
  scene.add(camera)

  // configure() topolojiyi yeniden kurar ama kök ve anchor'lar aynı kalır.
  const staveOptions = [12, 7, 20]
  let staveIndex = 0

  return {
    scene,
    camera,
    target: new Vector3(0, 0.1, 0),
    actionLabel: 'Tahta sayısını değiştir',
    note: '@medieval-kit/wooden-barrel · sizin registry\'niz · düz WebGL materyali, TSL yok',
    action: () => {
      staveIndex = (staveIndex + 1) % staveOptions.length
      const result = barrel.configure({ staveCount: staveOptions[staveIndex] })
      status.textContent = `staveCount = ${staveOptions[staveIndex]} · rebuilt = ${result.rebuilt} · kök nesne aynı kaldı`
    },
    update: () => undefined,
    dispose: () => {
      scene.remove(barrel.root)
      barrel.dispose()
    },
  }
}

const stages = { gauge: gaugeStage, barrel: barrelStage } as const
type StageName = keyof typeof stages

let stage: Stage
let controls: OrbitControls

function aspect(): number {
  const width = canvas.clientWidth || 1
  const height = canvas.clientHeight || 1
  return width / height
}

function selectStage(name: StageName): void {
  stage?.dispose()
  controls?.dispose()
  stage = stages[name](aspect())
  controls = new OrbitControls(stage.camera, canvas)
  controls.enableDamping = true
  controls.target.copy(stage.target)
  actionButton.textContent = stage.actionLabel
  status.textContent = stage.note
  for (const button of stageButtons) {
    button.classList.toggle('active', button.dataset.stage === name)
  }
  resize()
}

// ResizeObserver, `resize` olayından daha güvenilir: sekme gizliyken açılan ya da
// düzeni sonradan oturan sayfalarda canvas 0x0 kalmıyor.
function resize(): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width === 0 || height === 0) return
  renderer.setSize(width, height, false)
  stage.camera.aspect = width / height
  stage.camera.updateProjectionMatrix()
}

selectStage('gauge')
new ResizeObserver(resize).observe(canvas)

for (const button of stageButtons) {
  button.addEventListener('click', () => selectStage(button.dataset.stage as StageName))
}
actionButton.addEventListener('click', () => stage.action())

// Geliştirme kolaylığı: konsoldan `__vibe3d.stage.scene` ile sahneyi gezebilir,
// `__vibe3d.renderOnce()` ile sekme arka plandayken bile tek kare aldırabilirsiniz.
if (import.meta.env.DEV) {
  Object.defineProperty(globalThis, '__vibe3d', {
    value: {
      renderer,
      get stage() { return stage },
      renderOnce: () => renderer.render(stage.scene, stage.camera),
    },
    configurable: true,
  })
}

let previous = performance.now()
renderer.setAnimationLoop(() => {
  const now = performance.now()
  const delta = (now - previous) / 1000
  previous = now
  stage.update(delta)
  controls.update()
  void renderer.render(stage.scene, stage.camera)
})
