/**
 * A camera moving through the market square, as a PNG sequence.
 *
 * Rendered offline through the same software rasteriser the contact sheets use,
 * rather than captured off the viewer, and the reasons are all the same reason:
 * a capture is at the mercy of whatever the compositor and the display are
 * doing. Here every frame is drawn at full size whatever the machine is busy
 * with, no frame is dropped, no frame is half a frame, the output is exactly
 * the resolution asked for, and the same command a month from now produces the
 * same file. It also runs with no browser and no GPU, so it runs in CI.
 *
 * Usage:
 *   bun scripts/flythrough.ts --plan                  → the layout from above
 *   bun scripts/flythrough.ts --still 0.35            → one frame, to look at
 *   bun scripts/flythrough.ts --seconds 24 --fps 30   → the sequence
 *   bun scripts/flythrough.ts --from 300 --to 599     → one worker's share
 *
 * Then, with BOTH inputs before any output option or ffmpeg reads -profile:v
 * as an input flag on the silent track and stops:
 *   ffmpeg -framerate 30 -i frames/%05d.png -f lavfi -i anullsrc=r=48000:cl=stereo \
 *     -c:v libx264 -profile:v high -pix_fmt yuv420p \
 *     -b:v 18M -maxrate 20M -bufsize 36M \
 *     -c:a aac -b:a 96k -shortest -movflags +faststart square.mp4
 */
import { mkdir, writeFile } from 'node:fs/promises'

import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three/webgpu'

import {
  encodePng, gather, renderFrom, setFog, setLighting, setPointLights, toLinear,
} from './raster.ts'
import { buildSquare } from './square.ts'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}
const has = (name: string): boolean => args.includes(`--${name}`)

const width = Number(flag('width') ?? 1920)
const height = Number(flag('height') ?? 1080)
const fps = Number(flag('fps') ?? 30)
const seconds = Number(flag('seconds') ?? 24)
const fov = Number(flag('fov') ?? 46)
const outDir = flag('out') ?? 'frames'
const groundHex = flag('ground')
const ground = groundHex ? toLinear(groundHex) : undefined

/**
 * Where the camera goes, and what it is looking at while it gets there.
 *
 * Two curves rather than one: a camera that always looks along its own path is
 * a dolly, and it can only ever show what is in front of it. Aiming separately
 * is what lets the move cross the square while the frame stays on the well,
 * which is the only way the things standing to the SIDE of the path get seen.
 *
 * The eye keeps to the lane the layout leaves open, comes in at standing height
 * and climbs at the end, because the mill is 7 m tall and the shot that ends on
 * it has to be able to hold it.
 */
const EYE = new CatmullRomCurve3([
  new Vector3(5.5, 1.8, 8.6),
  new Vector3(1.6, 1.6, 6.2),
  new Vector3(-2.0, 1.45, 4.3),
  new Vector3(-3.8, 1.45, 1.9),
  new Vector3(-4.6, 1.6, -0.7),
  new Vector3(-3.4, 2.7, -1.4),
  new Vector3(-0.8, 4.8, 3.0),
], false, 'catmullrom', 0.5)

const AIM = new CatmullRomCurve3([
  new Vector3(-1.8, 1.35, 3.2),
  new Vector3(-4.6, 1.25, 2.0),
  new Vector3(-6.4, 1.2, 0.5),
  new Vector3(-6.8, 1.2, -1.7),
  new Vector3(-5.6, 1.35, -4.2),
  new Vector3(-2.2, 2.0, -5.4),
  new Vector3(-0.4, 2.6, -5.4),
], false, 'catmullrom', 0.5)

/**
 * Eased, because a move that starts at speed and stops dead reads as a cut.
 *
 * Smoothstep on its own leaves the middle of the run faster than the ends by
 * half again, which on a 24 s tour is the difference between passing the stall
 * and going past it.
 */
const ease = (t: number): number => t * t * (3 - 2 * t)

function place(camera: PerspectiveCamera, t: number): void {
  const at = ease(Math.min(1, Math.max(0, t)))
  camera.position.copy(EYE.getPoint(at))
  camera.lookAt(AIM.getPoint(at))
}

/**
 * The rig, and it is not the kit's.
 *
 * Every catalogue picture is taken under a high white sun, which is right for
 * judging a model and wrong for being anywhere: at noon with a white key the
 * square is a product shot of a square. This is late afternoon, low and warm,
 * with the ambient pulled cool so the shadow side goes blue rather than grey.
 * The kit's own defaults are untouched; nothing that skips this call moves.
 */
setLighting({
  light: [0.66, 0.44, 0.38],
  sun: [1.12, 0.98, 0.82],
  sky: [0.36, 0.44, 0.62],
  ground: [0.2, 0.18, 0.15],
})

const SKY = {
  zenith: [0.045, 0.072, 0.135] as const,
  horizon: [0.185, 0.178, 0.185] as const,
  glow: [0.46, 0.26, 0.11] as const,
}

// Haze, which is the only thing that puts a hill 200 m away. Its colour is the
// sky's at the horizon, because anything else reads as smoke.
setFog({ colour: SKY.horizon, near: 55, far: 320 })

const square = buildSquare(undefined, { houses: !has('no-houses') })

/**
 * The fires, as light. Reach is what the flame can plausibly carry: a torch
 * lights the yard around it and a forge lights the wall behind it.
 */
setPointLights(square.fires.map((fire) => {
  const forge = fire.id === 'forge-hearth'
  return {
    at: fire.at,
    colour: forge ? [1.0, 0.42, 0.13] as const : [1.0, 0.55, 0.2] as const,
    reach: forge ? 6.5 : fire.id === 'iron-lantern' ? 2.4 : 4.6,
    strength: forge ? 1.5 : fire.id === 'iron-lantern' ? 0.5 : 0.85,
  }
}))
console.log(`square: ${square.root.children.length} models, ${square.height.toFixed(2)} m tall`)
await mkdir(outDir, { recursive: true })

const underlay = gather(square.ground)
const shot = {
  size: width, tall: height, ground, floor: 0, height: square.height, underlay, sky: SKY,
}

if (has('plan')) {
  // Straight down, to check the layout rather than to look at it. The up
  // vector has to move: lookAt cannot resolve a camera aimed along its own up.
  const camera = new PerspectiveCamera(50, width / height, 0.05, 200)
  camera.up.set(0, 0, -1)
  camera.position.set(0, 26, -3)
  camera.lookAt(new Vector3(0.0, 0.0, -2.34))
  square.update(0.6)
  await writeFile(`${outDir}/_plan.png`, encodePng(renderFrom(gather(square.root), camera, shot)))
  console.log(`${outDir}/_plan.png`)
  square.dispose()
} else if (flag('still') !== undefined) {
  const t = Number(flag('still'))
  const camera = new PerspectiveCamera(fov, width / height, 0.05, 200)
  place(camera, t)
  // Wound on, so the flame is a flame and the sails are not at their start.
  square.update(1.4 + t * seconds)
  const name = `${outDir}/_still-${t.toFixed(2)}.png`
  await writeFile(name, encodePng(renderFrom(gather(square.root), camera, shot)))
  console.log(name)
  square.dispose()
} else {
  const total = Math.round(seconds * fps)
  const from = Number(flag('from') ?? 0)
  const to = Math.min(total - 1, Number(flag('to') ?? total - 1))
  const camera = new PerspectiveCamera(fov, width / height, 0.05, 200)
  const step = 1 / fps

  // Wound forward to the worker's first frame rather than started there: the
  // sails and the flames are integrated per step, so a worker that begins at
  // frame 900 has to have taken the 900 steps before it or its sails are at an
  // angle no other worker's are, and the seam shows.
  square.update(1.4)
  for (let i = 0; i < from; i += 1) square.update(step)

  const began = Date.now()
  for (let i = from; i <= to; i += 1) {
    place(camera, total > 1 ? i / (total - 1) : 0)
    const frame = renderFrom(gather(square.root), camera, shot)
    await writeFile(`${outDir}/${String(i).padStart(5, '0')}.png`, encodePng(frame))
    square.update(step)
    if ((i - from) % 30 === 0) {
      const done = i - from + 1
      const rate = done / ((Date.now() - began) / 1000)
      console.log(`${i}/${to}  ${rate.toFixed(2)} fps  ${((to - i) / rate / 60).toFixed(1)} min left`)
    }
  }
  console.log(`${to - from + 1} frames → ${outDir}/`)
  square.dispose()
}
