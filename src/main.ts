import { WebGPURenderer } from 'three/webgpu'
import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Two models from two different registries. Same CLI, same project, same render loop.
import { createPreview as createGaugePreview } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const stageButtons = document.querySelectorAll<HTMLButtonElement>('[data-stage]')
const actionButton = document.querySelector<HTMLButtonElement>('#action')!

if (!navigator.gpu) {
  status.classList.add('error')
  status.textContent =
    'This browser has no WebGPU. The scifi-kit models use TSL node materials and ' +
    'require WebGPURenderer. Try Chrome/Edge 113+.'
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
 * Sci-fi gauge: the scene, the lights and the reference camera are all set up
 * by the model's own `createPreview` function. This is the framing the model's
 * author intended.
 */
function gaugeStage(aspect: number): Stage {
  const preview = createGaugePreview({ aspect })
  return {
    scene: preview.scene,
    camera: preview.camera,
    target: new Vector3(0.25, 2.55, 0),
    actionLabel: 'Pressure test',
    note: '@scifi-kit/pressure-gauge · WebGPU + TSL wear material · the scene comes from the model\'s createPreview',
    action: () => preview.triggerPressureTest(),
    update: (delta) => preview.update(delta),
    dispose: () => preview.dispose(),
  }
}

/**
 * Medieval barrel: the registry only ships the model, there is no preview. The
 * application sets up the scene, the lights and the camera — this is vibe3d's
 * actual contract.
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

  // configure() rebuilds the topology, but the root and the anchors stay the same.
  const staveOptions = [12, 7, 20]
  let staveIndex = 0

  return {
    scene,
    camera,
    target: new Vector3(0, 0.1, 0),
    actionLabel: 'Change the stave count',
    note: '@medieval-kit/wooden-barrel · your own registry · plain WebGL material, no TSL',
    action: () => {
      staveIndex = (staveIndex + 1) % staveOptions.length
      const result = barrel.configure({ staveCount: staveOptions[staveIndex] })
      status.textContent = `staveCount = ${staveOptions[staveIndex]} · rebuilt = ${result.rebuilt} · the root object stayed the same`
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

// ResizeObserver is more reliable than the `resize` event: on pages opened while
// the tab is hidden, or whose layout settles later, the canvas does not stay 0x0.
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

// Development convenience: from the console you can walk the scene with
// `__vibe3d.stage.scene`, and force a single frame with `__vibe3d.renderOnce()`
// even while the tab is in the background.
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
