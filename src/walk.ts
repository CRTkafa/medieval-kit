/**
 * Walk around the market square.
 *
 * The flythrough answers "what does the kit look like in a place", on one
 * camera move somebody else chose. This answers the other question, which is
 * the one anyone actually asks after watching it: what is behind me.
 *
 * Same scene, same layout, same rig. The difference is that this one runs on
 * the GPU in real time rather than through the software rasteriser, so the
 * lighting has to be built out of three.js lights instead of handed to
 * `raster.ts`, and the sky has to be a dome instead of a per-pixel ray. The
 * numbers behind both come from `scenery.ts`, so the two views cannot drift.
 */
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  LinearSRGBColorSpace,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGPURenderer,
  type Object3D,
} from 'three/webgpu'

import { buildSquare } from '../scripts/square.ts'
import { SKY, SUN, buildSky, heightAt } from '../scripts/scenery.ts'

import './walk.css'

const linear = (rgb: readonly [number, number, number]): Color =>
  new Color().setRGB(rgb[0], rgb[1], rgb[2], LinearSRGBColorSpace)

/* -------------------------------------------------------------------- scene */

const status = document.getElementById('status') as HTMLParagraphElement
status.textContent = 'building the square…'

// Houses off by default, the same as the released video: this page is linked
// from the kit's own front door, so what it shows has to be what the kit is.
// `?houses` puts the frontage back for anything that is not selling it.
const houses = new URLSearchParams(globalThis.location.search).has('houses')
const square = buildSquare(undefined, { houses })
const scene = new Scene()
scene.fog = new Fog(linear(SKY.horizon), 55, 320)
scene.add(buildSky())
scene.add(square.ground)
scene.add(square.root)

// Everything the kit put down casts and receives; the ground only receives,
// because a floor casting onto itself is the shadow-acne generator.
square.root.traverse((object: Object3D) => {
  const mesh = object as Mesh
  if (!mesh.isMesh) return
  mesh.castShadow = true
  mesh.receiveShadow = true
})
square.ground.traverse((object: Object3D) => {
  const mesh = object as Mesh
  if (mesh.isMesh) mesh.receiveShadow = true
})

/* ------------------------------------------------------------------- lights */

const sun = new Vector3(SUN.direction[0], SUN.direction[1], SUN.direction[2]).normalize()
const key = new DirectionalLight(linear(SUN.colour), 2.6)
key.position.copy(sun).multiplyScalar(45)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.bias = -0.0007
key.shadow.normalBias = 0.03
// The shadow camera covers the square and nothing else. Stretched to the
// horizon it would spend its 2048 pixels on empty pasture and the market would
// get four of them.
const shadow = key.shadow.camera
shadow.left = -24; shadow.right = 24; shadow.top = 24; shadow.bottom = -24
shadow.near = 5; shadow.far = 95
shadow.updateProjectionMatrix()
key.target.position.set(0, 0, -3)
scene.add(key, key.target)

scene.add(new HemisphereLight(linear(SUN.sky), linear(SUN.ground), 1.1))

/**
 * The fires, as lights that flicker.
 *
 * A flame that does not move is a painted flame, and the giveaway is not the
 * geometry, which does move, but the pool of light around it, which did not.
 */
const fires = square.fires.map((fire) => {
  const forge = fire.id === 'forge-hearth'
  const lantern = fire.id === 'iron-lantern'
  const light = new PointLight(
    new Color(forge ? 0xff6a22 : 0xff9036),
    forge ? 9 : lantern ? 1.6 : 3.4,
    forge ? 9 : lantern ? 3.2 : 6.2,
    1.8,
  )
  light.position.copy(fire.at)
  scene.add(light)
  return { light, base: light.intensity, phase: fire.at.x * 3.1 + fire.at.z * 1.7 }
})

/* ------------------------------------------------------------------- camera */

/**
 * Where you start, facing the market.
 *
 * The yaw is not a guess: three's camera looks down its own -Z, so a heading
 * of `yaw` points at `(-sin yaw, 0, -cos yaw)`, and the one that aims from the
 * entrance at the middle of the square is atan2 of that. Getting the sign
 * wrong puts you at the gate with your back to everything, looking at pasture.
 */
const START = { at: new Vector3(5.5, 0, 8.6), yaw: 0.44, pitch: -0.05 }
const EYE = 1.68

const camera = new PerspectiveCamera(62, 1, 0.05, 900)
let yaw = START.yaw
let pitch = START.pitch
let flying = false
const at = START.at.clone()
const velocity = new Vector3()

function reset(): void {
  at.copy(START.at)
  yaw = START.yaw
  pitch = START.pitch
  flying = false
}

/* ------------------------------------------------------------------ control */

const canvas = document.getElementById('viewport') as HTMLCanvasElement
const held = new Set<string>()

/**
 * Pointer lock where it is allowed, dragging where it is not.
 *
 * Lock is the right feel and it is not always available: inside a frame whose
 * root document is not the page's own, the browser refuses it outright with a
 * WrongDocumentError, and an uncaught one of those is the only thing the page
 * ever printed to the console. So catch it, say so, and fall back to holding
 * the mouse down, which works everywhere and costs one flag.
 */
let dragging = false
let lockable = true

canvas.addEventListener('click', () => {
  canvas.focus()
  if (!lockable) return
  const request = canvas.requestPointerLock() as unknown as Promise<void> | undefined
  request?.catch(() => {
    lockable = false
    status.textContent = 'hold the mouse down to look around'
  })
})
canvas.addEventListener('mousedown', () => { if (!lockable) dragging = true })
globalThis.addEventListener('mouseup', () => { dragging = false })
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('locked', document.pointerLockElement === canvas)
})
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas && !dragging) return
  yaw -= event.movementX * 0.0022
  pitch = Math.max(-1.45, Math.min(1.45, pitch - event.movementY * 0.0022))
})
/**
 * Keys on the DOCUMENT, not on the window.
 *
 * A window listener only hears a key once the window itself has focus, which
 * it does not always have: inside a frame, inside a preview pane, or straight
 * after a click that focused something else, the keys arrive at the document
 * and stop there. The document is where they can always be heard, and the
 * canvas carries a tabindex so clicking it puts focus somewhere sensible
 * rather than leaving it on whatever had it before.
 */
document.addEventListener('keydown', (event) => {
  const code = event.code
  held.add(code)
  if (code === 'KeyF') flying = !flying
  if (code === 'KeyR') reset()
  // Space scrolls the page otherwise, and the page is the thing being flown.
  if (code === 'Space') event.preventDefault()
})
document.addEventListener('keyup', (event) => { held.delete(event.code) })
// Held keys are not released while the window is away, so they would stay held.
globalThis.addEventListener('blur', () => { held.clear() })

const down = (...codes: string[]): boolean => codes.some((code) => held.has(code))

/* --------------------------------------------------------------------- loop */

const renderer = new WebGPURenderer({ canvas, antialias: true })
await renderer.init()
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFSoftShadowMap

/**
 * Sized from the canvas, and never to zero.
 *
 * A pane that reports 0 x 0 for one frame while it lays out is enough to make
 * WebGPU build a swapchain of size zero, and it does not recover: every frame
 * after it fails on an invalid texture. Both guards are one line each.
 */
function resize(): void {
  const width = Math.max(1, canvas.clientWidth || globalThis.innerWidth)
  const height = Math.max(1, canvas.clientHeight || globalThis.innerHeight)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}
globalThis.addEventListener('resize', resize)
// The window's resize event does not fire when only the pane around the canvas
// changes, which is most of the ways this canvas changes size.
new ResizeObserver(resize).observe(canvas)
resize()

const forward = new Vector3()
const right = new Vector3()
const readout = document.getElementById('readout') as HTMLParagraphElement
let last = performance.now()
let smoothed = 60
let sinceReadout = 0

status.textContent = `${square.root.children.length} models · click to look around`

renderer.setAnimationLoop(() => {
  const now = performance.now()
  // Clamped: a tab that was in the background hands back a delta of several
  // seconds, and an unclamped one teleports you across the square and spins
  // the mill's sails through a hundred turns in a frame.
  const delta = Math.min(0.05, (now - last) / 1000)
  last = now

  square.update(delta)
  for (const fire of fires) {
    const t = now / 1000
    const flicker = Math.sin(t * 11 + fire.phase) * 0.5 + Math.sin(t * 27 + fire.phase * 2) * 0.3
    fire.light.intensity = fire.base * (1 + flicker * 0.09)
  }

  forward.set(Math.sin(yaw) * -1, 0, Math.cos(yaw) * -1)
  right.set(-forward.z, 0, forward.x)

  const wish = new Vector3()
  if (down('KeyW', 'ArrowUp')) wish.add(forward)
  if (down('KeyS', 'ArrowDown')) wish.sub(forward)
  if (down('KeyD', 'ArrowRight')) wish.add(right)
  if (down('KeyA', 'ArrowLeft')) wish.sub(right)
  if (flying) {
    if (down('Space')) wish.y += 1
    if (down('ShiftLeft', 'ShiftRight') && down('Space')) wish.y += 0
    if (down('KeyC', 'ControlLeft')) wish.y -= 1
  }
  if (wish.lengthSq() > 0) wish.normalize()

  const speed = down('ShiftLeft', 'ShiftRight') ? 9.5 : 3.4
  // Eased rather than instant, because instant acceleration in a first person
  // view reads as the world snapping rather than as you starting to walk.
  velocity.lerp(wish.multiplyScalar(speed), Math.min(1, delta * 12))
  at.addScaledVector(velocity, delta)

  const floor = heightAt(at.x, at.z)
  if (!flying) at.y = floor + EYE
  else at.y = Math.max(floor + 0.4, at.y)

  camera.position.copy(at)
  camera.rotation.set(pitch, yaw, 0, 'YXZ')
  key.target.position.set(at.x, 0, at.z)
  key.position.copy(sun).multiplyScalar(45).add(new Vector3(at.x, 0, at.z))

  smoothed += ((1 / Math.max(delta, 1e-4)) - smoothed) * 0.08
  sinceReadout += delta
  if (sinceReadout > 0.25) {
    sinceReadout = 0
    readout.textContent =
      `${flying ? 'fly' : 'walk'} · ${smoothed.toFixed(0)} fps · `
      + `${at.x.toFixed(1)}, ${at.y.toFixed(1)}, ${at.z.toFixed(1)}`
  }

  void renderer.render(scene, camera)
})
