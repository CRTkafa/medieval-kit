/**
 * The software renderer: triangles in, PNG out. No browser, no GPU.
 *
 * Why it exists: every check the kit had until now was GEOMETRIC. Triangle
 * count, winding order, coplanar faces, bounding box... all of them caught real
 * bugs, but none of them could say "this shovel does not look like a shovel".
 * To say that sentence you have to LOOK at the model.
 *
 * So there is a tiny software rasteriser here: it collects the triangles,
 * projects them through a camera, fills them with a z-buffer and writes a PNG.
 * The goal is not a pretty image but a READABLE SILHOUETTE — there is just
 * enough shading to work out what the silhouette is, not a millimetre more.
 *
 * This is the library. `render.ts` is the command line over it and
 * `build-cover.ts` is the social card; both draw the same models the same way,
 * which is the point of the split — the card must not be able to disagree with
 * the contact sheet about what a model looks like.
 */
import { deflateSync } from 'node:zlib'

import {
  Box3,
  Matrix3,
  Mesh,
  PerspectiveCamera,
  Sphere,
  Vector3,
  type Object3D,
} from 'three/webgpu'

import { CATALOG } from '@/catalog.ts'

/* ---------------------------------------------------------------- triangles */

interface Triangle {
  readonly a: Vector3
  readonly b: Vector3
  readonly c: Vector3
  /** Vertex colours, in LINEAR space. */
  readonly ca: [number, number, number]
  readonly cb: [number, number, number]
  readonly cc: [number, number, number]
  readonly metalness: number
  readonly roughness: number
  /** Unlit surface (flame). The vertex colour is the result directly. */
  readonly unlit: boolean
  readonly opacity: number
  /**
   * Vertex normals, when the geometry carries ones that differ from the face.
   *
   * Null on flat-shaded geometry, which is most of it: these models are
   * non-indexed and `computeVertexNormals` then hands every triangle its own
   * normal, so interpolating three copies of the same vector would be work
   * for nothing.
   */
  readonly na: Vector3 | null
  readonly nb: Vector3 | null
  readonly nc: Vector3 | null
}

function collect(root: Object3D): Triangle[] {
  root.updateMatrixWorld(true)
  const out: Triangle[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const geometry = object.geometry
    const position = geometry.getAttribute('position')
    if (!position) return
    const colour = geometry.getAttribute('color')
    const index = geometry.getIndex()
    const count = index ? index.count : position.count

    const material = object.material as {
      metalness?: number
      roughness?: number
      opacity?: number
      transparent?: boolean
      isMeshBasicMaterial?: boolean
    }
    const unlit = material.isMeshBasicMaterial === true
    const opacity = material.transparent ? (material.opacity ?? 1) : 1

    const normals = geometry.getAttribute('normal')
    // Rotation only: a normal is a direction, so the translation in the world
    // matrix must not move it.
    const rotation = new Matrix3().getNormalMatrix(object.matrixWorld)

    const vertex = (i: number): { p: Vector3; c: [number, number, number]; n: Vector3 | null } => {
      const v = index ? index.getX(i) : i
      const p = new Vector3().fromBufferAttribute(position, v).applyMatrix4(object.matrixWorld)
      const c: [number, number, number] = colour
        ? [colour.getX(v), colour.getY(v), colour.getZ(v)]
        : [0.8, 0.8, 0.8]
      const n = normals
        ? new Vector3().fromBufferAttribute(normals, v).applyMatrix3(rotation).normalize()
        : null
      return { p, c, n }
    }

    for (let i = 0; i < count; i += 3) {
      const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2)
      // Only worth interpolating when the three actually disagree. On flat
      // geometry they are identical and the face normal is both cheaper and
      // exactly as correct.
      const smooth = a.n !== null && b.n !== null && c.n !== null
        && (a.n.dot(b.n) < 0.9995 || a.n.dot(c.n) < 0.9995)
      out.push({
        a: a.p, b: b.p, c: c.p,
        ca: a.c, cb: b.c, cc: c.c,
        na: smooth ? a.n : null, nb: smooth ? b.n : null, nc: smooth ? c.n : null,
        metalness: material.metalness ?? 0,
        roughness: material.roughness ?? 0.8,
        unlit,
        opacity,
      })
    }
  })
  return out
}

/* --------------------------------------------------------------------- colour */

/** Linear → sRGB. The palette colours are stored linear inside three. */
export function encode(value: number): number {
  const v = Math.min(1, Math.max(0, value))
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  return Math.round(s * 255)
}

/** sRGB hex → linear, so `encode` puts the exact bytes back out again. */
export function toLinear(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [16, 8, 0].map((shift) => {
    const v = ((n >> shift) & 0xff) / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
}

/* -------------------------------------------------------------- rasterising */

const LIGHT = new Vector3(0.48, 0.82, 0.31).normalize()
const SKY: [number, number, number] = [0.42, 0.52, 0.68]
const GROUND: [number, number, number] = [0.24, 0.2, 0.16]

export interface Frame {
  readonly width: number
  readonly height: number
  readonly colour: Float32Array   // rgb, linear
  readonly depth: Float32Array
}

/**
 * @param ground A flat background, in linear space, instead of the gradient.
 *
 * The default gradient is right for a contact sheet, where every cell wants to
 * be its own little photograph. It is wrong for the social card: forty cells
 * each with their own top-to-bottom gradient come out as visible banding, and
 * the sheet sits on the page as a grey slab rather than as part of it. Given
 * the page's own background instead, the models float on the card as one field
 * and the three cells the kit does not fill stop being a hole in the corner.
 */
export function newFrame(width: number, height: number, ground?: readonly number[]): Frame {
  const colour = new Float32Array(width * height * 3)
  if (ground) {
    for (let i = 0; i < width * height; i += 1) {
      colour[i * 3] = ground[0]!
      colour[i * 3 + 1] = ground[1]!
      colour[i * 3 + 2] = ground[2]!
    }
    return { width, height, colour, depth: new Float32Array(width * height).fill(Infinity) }
  }
  // Background: a calm grey-blue that darkens from top to bottom. A flat
  // colour was the one thing that made the model's silhouette hard to read.
  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1)
    const r = 0.052 + 0.028 * (1 - t)
    const g = 0.058 + 0.034 * (1 - t)
    const b = 0.068 + 0.046 * (1 - t)
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      colour[i] = r; colour[i + 1] = g; colour[i + 2] = b
    }
  }
  return { width, height, colour, depth: new Float32Array(width * height).fill(Infinity) }
}

interface Projected {
  x: number
  y: number
  z: number
  behind: boolean
}

function project(point: Vector3, camera: PerspectiveCamera, frame: Frame): Projected {
  const v = point.clone().project(camera)
  return {
    x: (v.x * 0.5 + 0.5) * frame.width,
    y: (1 - (v.y * 0.5 + 0.5)) * frame.height,
    z: v.z,
    // Vertices behind the camera flip sign when projected and fling the
    // triangle to the opposite side of the screen. Instead of clipping we drop
    // such triangles entirely — the viewer camera always frames the model, so
    // this can only happen when something is wrong.
    behind: v.z < -1 || v.z > 1,
  }
}

function shade(tri: Triangle, normal: Vector3, albedo: [number, number, number]): [number, number, number] {
  if (tri.unlit) return albedo

  const ndl = Math.max(0, normal.dot(LIGHT))
  // Hemisphere ambient: surfaces facing up see the sky, ones facing down see
  // the ground. Metals are fed almost entirely from here — a metal with no
  // environment map would otherwise come out pitch black.
  const up = normal.y * 0.5 + 0.5
  const ambient: [number, number, number] = [
    GROUND[0] + (SKY[0] - GROUND[0]) * up,
    GROUND[1] + (SKY[1] - GROUND[1]) * up,
    GROUND[2] + (SKY[2] - GROUND[2]) * up,
  ]

  const metal = tri.metalness
  const diffuseStrength = (1 - metal * 0.85) * (0.28 + ndl * 1.05)
  const envStrength = 0.35 + metal * 0.9

  // Blinn-Phong highlight: the exponent is derived from the roughness.
  const exponent = Math.pow(2, (1 - tri.roughness) * 10) + 1
  const half = LIGHT.clone().add(new Vector3(0, 0, 1)).normalize()
  const spec = Math.pow(Math.max(0, normal.dot(half)), exponent) * (1 - tri.roughness) * 1.6

  return [0, 1, 2].map((i) => {
    const base = albedo[i]!
    const lit = base * diffuseStrength + base * ambient[i]! * envStrength
    // On metal the reflection colour comes from albedo, on a dielectric white.
    const tint = metal > 0.5 ? base : 1
    return lit + spec * tint * (0.35 + metal * 0.9)
  }) as [number, number, number]
}

function raster(frame: Frame, camera: PerspectiveCamera, triangles: readonly Triangle[]): void {
  // Transparent triangles go last: they test depth but do NOT write depth,
  // otherwise the wick behind the glass disappears.
  const ordered = [...triangles].sort((a, b) => (a.opacity === b.opacity ? 0 : a.opacity < 1 ? 1 : -1))

  for (const tri of ordered) {
    const pa = project(tri.a, camera, frame)
    const pb = project(tri.b, camera, frame)
    const pc = project(tri.c, camera, frame)
    if (pa.behind || pb.behind || pc.behind) continue

    // Signed area in screen space: if negative the triangle has its back to
    // us. Back-face culling MATTERS here — a model with a winding-order bug
    // should look inside-out in the image, not be hidden.
    const area = (pb.x - pa.x) * (pc.y - pa.y) - (pc.x - pa.x) * (pb.y - pa.y)
    if (area >= 0) continue

    const normal = new Vector3()
      .subVectors(tri.b, tri.a)
      .cross(new Vector3().subVectors(tri.c, tri.a))
      .normalize()

    const minX = Math.max(0, Math.floor(Math.min(pa.x, pb.x, pc.x)))
    const maxX = Math.min(frame.width - 1, Math.ceil(Math.max(pa.x, pb.x, pc.x)))
    const minY = Math.max(0, Math.floor(Math.min(pa.y, pb.y, pc.y)))
    const maxY = Math.min(frame.height - 1, Math.ceil(Math.max(pa.y, pb.y, pc.y)))

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5, py = y + 0.5
        const w0 = ((pb.x - pa.x) * (py - pa.y) - (px - pa.x) * (pb.y - pa.y)) / area
        const w1 = ((pc.x - pb.x) * (py - pb.y) - (px - pb.x) * (pc.y - pb.y)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue

        // w1 → a, w2 → b, w0 → c (opposite vertices of the edge functions)
        const z = pa.z * w1 + pb.z * w2 + pc.z * w0
        const at = y * frame.width + x
        if (z >= frame.depth[at]!) continue

        const albedo: [number, number, number] = [
          tri.ca[0] * w1 + tri.cb[0] * w2 + tri.cc[0] * w0,
          tri.ca[1] * w1 + tri.cb[1] * w2 + tri.cc[1] * w0,
          tri.ca[2] * w1 + tri.cb[2] * w2 + tri.cc[2] * w0,
        ]
        // Interpolate the normal across the face when the geometry asked for
        // smooth shading. Without this the renderer is flat by construction
        // and cannot show the difference between a faceted vase and a turned
        // one, which makes it useless for judging exactly the objects this
        // kit is full of.
        let shadingNormal = normal
        if (tri.na && tri.nb && tri.nc) {
          shadingNormal = new Vector3(
            tri.na.x * w1 + tri.nb.x * w2 + tri.nc.x * w0,
            tri.na.y * w1 + tri.nb.y * w2 + tri.nc.y * w0,
            tri.na.z * w1 + tri.nb.z * w2 + tri.nc.z * w0,
          ).normalize()
        }
        const rgb = shade(tri, shadingNormal, albedo)
        const i = at * 3
        const alpha = tri.opacity
        frame.colour[i] = frame.colour[i]! * (1 - alpha) + rgb[0] * alpha
        frame.colour[i + 1] = frame.colour[i + 1]! * (1 - alpha) + rgb[1] * alpha
        frame.colour[i + 2] = frame.colour[i + 2]! * (1 - alpha) + rgb[2] * alpha
        if (alpha >= 1) frame.depth[at] = z
      }
    }
  }
}

/**
 * Contact shadow: flatten the model onto the floor and darken what lands there.
 *
 * With a falloff, and that is the whole difference between a shadow and a
 * stain. Flattening everything at full strength is right for a barrel, whose
 * mass sits on the ground anyway, and badly wrong for anything with a raised
 * part standing in a vertical plane: a mug's handle flattens to its own reach
 * by its own width and lands on the floor as a hard black bar beside the mug,
 * reading as a separate object lying there. It was the first thing anyone
 * noticed in the first picture this kit produced.
 *
 * So a triangle contributes by how close it is to the floor. The scale is the
 * model's own height rather than a constant, because a 7 m mill and a 0.1 m mug
 * should both cast something that looks like contact rather than like paint.
 */
function contactShadow(
  frame: Frame,
  camera: PerspectiveCamera,
  triangles: readonly Triangle[],
  floor: number,
  height: number,
): void {
  // A quarter of the model's height. Above that a piece is not touching
  // anything and has no business darkening the floor.
  const reach = Math.max(1e-4, height * 0.25)
  for (const tri of triangles) {
    if (tri.unlit) continue
    // Skip only when the WHOLE triangle is out of reach. The strength itself
    // is worked out per pixel below: taking one value for the triangle looks
    // fine on a wall and tears a fan apart, because neighbouring triangles in
    // a base cap have different centre heights and alternate light and dark.
    // On the first vase that came out as a black starburst around the foot,
    // which is a worse artifact than the bar it replaced.
    const lowest = Math.min(tri.a.y, tri.b.y, tri.c.y) - floor
    if (lowest >= reach) continue
    const flat = (v: Vector3): Vector3 => new Vector3(v.x, floor + 0.0005, v.z)
    const pa = project(flat(tri.a), camera, frame)
    const pb = project(flat(tri.b), camera, frame)
    const pc = project(flat(tri.c), camera, frame)
    if (pa.behind || pb.behind || pc.behind) continue
    const area = (pb.x - pa.x) * (pc.y - pa.y) - (pc.x - pa.x) * (pb.y - pa.y)
    if (area === 0) continue

    const minX = Math.max(0, Math.floor(Math.min(pa.x, pb.x, pc.x)))
    const maxX = Math.min(frame.width - 1, Math.ceil(Math.max(pa.x, pb.x, pc.x)))
    const minY = Math.max(0, Math.floor(Math.min(pa.y, pb.y, pc.y)))
    const maxY = Math.min(frame.height - 1, Math.ceil(Math.max(pa.y, pb.y, pc.y)))
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5, py = y + 0.5
        const w0 = ((pb.x - pa.x) * (py - pa.y) - (px - pa.x) * (pb.y - pa.y)) / area
        const w1 = ((pc.x - pb.x) * (py - pb.y) - (px - pb.x) * (pc.y - pb.y)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue
        // w1 -> a, w2 -> b, w0 -> c, matching the colour interpolation.
        const above = (tri.a.y * w1 + tri.b.y * w2 + tri.c.y * w0) - floor
        if (above >= reach) continue
        const strength = Math.pow(1 - above / reach, 1.6)
        const i = (y * frame.width + x) * 3
        const darken = 1 - 0.45 * strength
        for (let k = 0; k < 3; k += 1) frame.colour[i + k] = frame.colour[i + k]! * darken
      }
    }
  }
}

/* ---------------------------------------------------------------------- PNG */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i += 1) body[i] = type.charCodeAt(i)
  body.set(data, 4)
  const out = new Uint8Array(8 + data.length + 4)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(body, 4)
  view.setUint32(out.length - 4, crc32(body))
  return out
}

export function encodePng(frame: Frame): Uint8Array {
  const { width, height, colour } = frame
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x += 1) {
      const from = (y * width + x) * 3
      const to = row + 1 + x * 3
      raw[to] = encode(colour[from]!)
      raw[to + 1] = encode(colour[from + 1]!)
      raw[to + 2] = encode(colour[from + 2]!)
    }
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8      // bit depth
  ihdr[9] = 2      // colour type: truecolour
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const png = new Uint8Array(total)
  let at = 0
  for (const part of parts) { png.set(part, at); at += part.length }
  return png
}

/* ------------------------------------------------------------------ framing */

/** Camera that fits the model into frame. Same framing as in the viewer. */
function frameCamera(
  root: Object3D,
  width: number,
  height: number,
  towards: readonly [number, number, number],
): { camera: PerspectiveCamera; floor: number } {
  const box = new Box3().setFromObject(root)
  const sphere = box.getBoundingSphere(new Sphere())
  const camera = new PerspectiveCamera(32, width / height, 0.01, 100)
  const direction = new Vector3(towards[0], towards[1], towards[2]).normalize()

  /**
   * Fit the BOX to the frame, not the sphere to the frame's short side.
   *
   * A sphere fit is one number and it is wrong for anything that is not
   * roughly round. The whole-kit scene is wide and flat: its bounding sphere
   * is set by the horizontal extent and is far taller than the scene is, so
   * fitting that sphere into the vertical field left the models occupying a
   * band across the middle with empty air above and below. On a 1.91:1 social
   * card it was most of the picture.
   *
   * The box fit is iterative because perspective is not linear in distance:
   * put the camera somewhere, project the eight corners, see how far past the
   * frame edge the worst one lands, and move by that ratio. Two passes is
   * inside a pixel at these sizes, and it settles on whichever axis is
   * actually tight rather than assuming it is the vertical one.
   */
  /**
   * Fitted to the GEOMETRY, not to the eight corners of its bounding box.
   *
   * A box fit is exact only for something that fills its box. The whole-kit
   * scene is the opposite: a flat plan of small props with one 7 m mill in it,
   * so four of the eight corners are pure air, and the frame was sized to hold
   * air. That is what reads as being zoomed out.
   *
   * Sampling the real vertices costs one traversal and removes the slack
   * exactly where there is slack, without ever cropping — a vertex outside the
   * frame is what the loop is correcting for.
   */
  const points: Vector3[] = []
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute('position')
    if (!position) return
    // Every vertex on a small model, a sample on a large one: 20k points is
    // plenty to find the extremes and keeps this off the critical path.
    const step = Math.max(1, Math.floor(position.count / 4096))
    for (let i = 0; i < position.count; i += step) {
      points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld))
    }
  })
  /**
   * The contact shadow is part of the picture, so it is part of the fit.
   *
   * It is the geometry flattened onto the floor, which projects somewhere else
   * entirely: a tall model throws its shadow well to one side, past everything
   * the fit was measuring. Fourteen of the thirty-seven had a shadow running
   * off the edge of its own cell, which reads as a crop even though no part of
   * the model was touched.
   */
  for (const p of points.slice()) points.push(new Vector3(p.x, box.min.y, p.z))

  if (points.length === 0) for (let i = 0; i < 8; i += 1) {
    points.push(new Vector3(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    ))
  }

  /**
   * Aimed at where the subject LANDS IN THE PICTURE, not at the middle of its
   * bounding sphere.
   *
   * Those are the same point only for something symmetric about its centre.
   * The whole-kit scene is a low wide plan with one tall mill standing off to
   * one side, so its sphere centre sits well away from the middle of what you
   * actually see, and the fit then padded one side to reach it. That is the
   * margin down the right of the frame: not a fitting error, an aiming one.
   *
   * Centring and fitting run in the same loop because each one moves the other:
   * re-aiming changes what the extremes project to, and pulling in changes
   * where the centre falls. Four passes settles both inside a pixel here.
   */
  const target = sphere.center.clone()
  const right = new Vector3()
  const up = new Vector3()
  const at = new Vector3()
  let distance = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.12

  for (let pass = 0; pass < 4; pass += 1) {
    camera.position.copy(target).addScaledVector(direction, distance)
    camera.lookAt(target)
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of points) {
      at.copy(p).project(camera)
      minX = Math.min(minX, at.x); maxX = Math.max(maxX, at.x)
      minY = Math.min(minY, at.y); maxY = Math.max(maxY, at.y)
    }
    if (!Number.isFinite(minX)) break

    // Slide the aim point across the image plane by however far off centre the
    // content sits, in world units at this distance.
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * distance
    const halfWidth = halfHeight * camera.aspect
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    up.setFromMatrixColumn(camera.matrixWorld, 1)
    target
      .addScaledVector(right, ((minX + maxX) / 2) * halfWidth)
      .addScaledVector(up, ((minY + maxY) / 2) * halfHeight)

    // Then fit the half-extent, measured from that centre.
    const worst = Math.max((maxX - minX) / 2, (maxY - minY) / 2)
    if (worst <= 0) break
    // 0.94 of the frame, so nothing sits on the edge and a shadow has room.
    distance *= worst / 0.94
  }

  camera.position.copy(target).addScaledVector(direction, distance)
  camera.lookAt(target)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return { camera, floor: box.min.y }
}

export interface RenderOptions {
  readonly size: number
  /**
   * Frame height, when it is not the width.
   *
   * Everything here is square because a contact sheet is a grid, but a social
   * card is 1.91:1 and cropping a square down to it either loses the model or
   * leaves it small.
   */
  readonly tall?: number
  readonly patch?: Record<string, number>
  /** Pre-rotation of the model around the Y axis (radians). For turntables. */
  readonly spin?: number
  readonly ground?: readonly number[]
  /**
   * Where the camera sits, as a direction from the subject.
   *
   * The default three-quarter view shows two faces of a single object at once,
   * which is what a catalogue of single objects wants. A SCENE laid out in rows
   * is a different subject: seen from the corner its rows run diagonally and
   * two corners of the frame are left empty, so the whole-kit picture is taken
   * from nearer the front, where the rows read as rows.
   */
  readonly towards?: readonly [number, number, number]
}

/**
 * Renders anything with a transform tree, catalogued or not.
 *
 * Split out of `renderOne` so a model can be drawn straight from the folder it
 * is being written in, before it has a catalogue entry, a registry build or an
 * install. That is the whole difference between looking at your work now and
 * looking at it after a four step round trip.
 */
export function renderObject(root: Object3D, options: RenderOptions): Frame {
  const { size, tall = options.size, spin = 0, ground, towards = [0.78, 0.5, 1] } = options
  // We rotate the MODEL, not the camera: framing and the shadow computation
  // stay in a fixed direction, so turntable frames compare one to one.
  root.rotation.y = spin
  const triangles = collect(root)
  const frame = newFrame(size, tall, ground)
  const { camera, floor } = frameCamera(root, size, tall, towards)
  contactShadow(frame, camera, triangles, floor, new Box3().setFromObject(root).getSize(new Vector3()).y)
  raster(frame, camera, triangles)
  return frame
}

/** A scene's triangles, gathered once so a moving camera does not re-walk it. */
export type Gathered = readonly Triangle[]

/** Walks a transform tree into the flat triangle list the rasteriser draws. */
export function gather(root: Object3D): Gathered {
  return collect(root)
}

/**
 * Draws from a camera somebody else placed.
 *
 * `renderObject` fits its own camera to the subject, which is what a catalogue
 * picture wants and the one thing a moving camera cannot have: the framing has
 * to be continuous between frames, and a fit recomputed every frame is not. It
 * also takes the triangles rather than the tree, because gathering 45,000 of
 * them for each of 1,800 frames is the whole cost of a flythrough.
 */
export function renderFrom(
  triangles: Gathered,
  camera: PerspectiveCamera,
  options: {
    readonly size: number
    readonly tall?: number
    readonly ground?: readonly number[]
    /** Y the contact shadow is cast onto. A scene's is its ground plane. */
    readonly floor?: number
    /** Tallest thing in the scene, which is what the shadow falls off over. */
    readonly height: number
    /**
     * Drawn first, and not counted as something that casts.
     *
     * The contact shadow is painted onto the frame BEFORE the triangles are,
     * so it only ever showed because the background was all that was under it.
     * Give the scene a ground and the ground rasterises straight over every
     * shadow in the picture. Worse, a ground plane sitting on the floor is
     * itself within reach of the falloff, so it darkens itself from edge to
     * edge. Both go away if the ground is laid down first and then shadowed:
     * underlay, shadow, everything else.
     */
    readonly underlay?: Gathered
  },
): Frame {
  const { size, tall = size, ground, floor = 0, height, underlay } = options
  const frame = newFrame(size, tall, ground)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  if (underlay) raster(frame, camera, underlay)
  contactShadow(frame, camera, triangles, floor, height)
  raster(frame, camera, triangles)
  return frame
}

export function renderOne(id: string, options: RenderOptions): Frame {
  const entry = CATALOG[id]
  if (!entry) throw new Error(`not in catalog: ${id}`)
  const built = entry.build()
  if (options.patch && built.params) built.params.apply(options.patch)
  // Catch animated models mid-motion: a frozen flame does not show that the
  // flame flickers.
  built.update?.(0.42)
  const frame = renderObject(built.root, options)
  built.dispose()
  return frame
}

/** Lays the frames out on a grid. */
export function tile(list: readonly Frame[], size: number, columns: number, ground?: readonly number[]): Frame {
  const rows = Math.ceil(list.length / columns)
  const sheet = newFrame(columns * size, rows * size, ground)
  list.forEach((frame, index) => {
    const ox = (index % columns) * size
    const oy = Math.floor(index / columns) * size
    blit(sheet, frame, ox, oy)
  })
  return sheet
}

/** Copies one frame into another. Colour only — the card has no depth to keep. */
export function blit(
  target: Frame,
  source: Frame,
  atX: number,
  atY: number,
  crop?: { x: number; y: number; width: number; height: number },
): void {
  const { x = 0, y = 0, width = source.width, height = source.height } = crop ?? {}
  for (let row = 0; row < height; row += 1) {
    const ty = atY + row
    if (ty < 0 || ty >= target.height) continue
    for (let column = 0; column < width; column += 1) {
      const tx = atX + column
      if (tx < 0 || tx >= target.width) continue
      const from = ((y + row) * source.width + x + column) * 3
      const to = (ty * target.width + tx) * 3
      target.colour[to] = source.colour[from]!
      target.colour[to + 1] = source.colour[from + 1]!
      target.colour[to + 2] = source.colour[from + 2]!
    }
  }
}
