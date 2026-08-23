import { BufferAttribute, BufferGeometry, Color } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * The kit's geometry vocabulary.
 *
 * Everything is generated NON-INDEXED. The reason: on non-indexed geometry
 * computeVertexNormals() gives every triangle its own normal, so flat shading
 * becomes a natural consequence of the geometry — no material flag is needed.
 * In lowpoly that is exactly what we want.
 *
 * Position frame: point(a, r, y) = (sin a · r, y, cos a · r)
 * So a = 0 → the +Z direction; as a grows it turns toward +X.
 *
 * The windings were worked out by hand and the audit inside
 * `scripts/verify-model.ts` tests them by mutation: radial faces on the outer
 * shell must point away from the axis.
 */

export type Vec3 = readonly [number, number, number]

export interface Level {
  /** Vertical position (metres). */
  readonly y: number
  /** OUTER radius at that height (metres). */
  readonly radius: number
}

function point(angle: number, radius: number, y: number): Vec3 {
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius]
}

interface Sink {
  readonly position: number[]
  readonly color: number[]
}

function tri(sink: Sink, a: Vec3, b: Vec3, c: Vec3, colour: Color): void {
  sink.position.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  for (let i = 0; i < 3; i += 1) sink.color.push(colour.r, colour.g, colour.b)
}

/** Triangle with a separate colour per corner — for vertical colour ramps. */
function triShaded(sink: Sink, a: Vec3, b: Vec3, c: Vec3, ca: Color, cb: Color, cc: Color): void {
  sink.position.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  sink.color.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b)
}

/** Splits the quad (a,b,c,d) in order into two triangles. The normal follows from the a→b→c winding. */
function quad(sink: Sink, a: Vec3, b: Vec3, c: Vec3, d: Vec3, colour: Color): void {
  tri(sink, a, b, c, colour)
  tri(sink, a, c, d, colour)
}

function finish(sink: Sink): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(sink.position), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(sink.color), 3))
  return geometry
}

/**
 * Axis-aligned box. The kit's most used part: boards, rails, iron straps,
 * feet — all of them are this.
 */
export function boxGeometry(
  size: Vec3,
  centre: Vec3,
  colour: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2]
  const [cx, cy, cz] = centre
  const v = (sx: number, sy: number, sz: number): Vec3 => [cx + sx * hx, cy + sy * hy, cz + sz * hz]

  quad(sink, v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), colour)     // +Z
  quad(sink, v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), colour) // -Z
  quad(sink, v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), colour)     // +X
  quad(sink, v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), colour) // -X
  quad(sink, v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), colour)     // +Y
  quad(sink, v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), colour) // -Y

  return finish(sink)
}

/**
 * Chamfered box — the kit's most important primitive. It can taper.
 *
 * A sharp 90° corner does not exist in nature. The edge of a hand-planed board
 * chips, the corner of forged iron rounds over. The chamfer band catches light
 * at a different angle than its neighbouring faces, and the object stops being
 * a "box" and turns into a physical part. The first version of the kit was
 * chamferless boxes from end to end and all of it looked like toys.
 *
 * Because the bottom and top cross sections can be given separately, it stands
 * in for both the straight box and the tapering box — keeping the two as
 * separate primitives would have permanently left open the risk of chamfering
 * one and leaving the other sharp.
 *
 * Single-facet chamfer (vibe3d modelling rule 2: one facet by default, a second
 * only on masses that carry the silhouette). The cost is 44 triangles instead of 12.
 *
 * Winding: the 6 faces were worked out by hand; the 12 edges and 8 corners
 * CORRECT THEMSELVES against the expected outward direction. Deriving the
 * winding of twenty pieces by hand invites mistakes, while the expected normal
 * is already known — flipping whatever comes out reversed is both shorter and certain.
 */
export function chamferedBoxGeometry(
  bottom: readonly [number, number],
  top: readonly [number, number],
  height: number,
  chamfer: number,
  centre: Vec3,
  colour: Color,
  colourTop?: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const [cx, cy, cz] = centre
  const hy = height / 2
  const minHalf = Math.min(bottom[0], bottom[1], top[0], top[1]) / 2
  const c = Math.max(1e-6, Math.min(chamfer, minHalf * 0.5, hy * 0.5))
  const upper = colourTop ?? colour

  /**
   * `full` sits exactly at the end on its axis, the others a chamfer inside.
   * The horizontal half-measures are interpolated between the bottom and top
   * cross section according to height.
   */
  const p = (sx: number, sy: number, sz: number, full: 0 | 1 | 2): Vec3 => {
    const y = cy + sy * (full === 1 ? hy : hy - c)
    const t = height <= 1e-9 ? 0 : (y - (cy - hy)) / height
    const hx = (bottom[0] + (top[0] - bottom[0]) * t) / 2
    const hz = (bottom[1] + (top[1] - bottom[1]) * t) / 2
    return [
      cx + sx * (full === 0 ? hx : hx - c),
      y,
      cz + sz * (full === 2 ? hz : hz - c),
    ]
  }
  const shade = (v: Vec3): Color =>
    colourTop ? new Color().copy(colour).lerp(upper, (v[1] - (cy - hy)) / Math.max(1e-9, height)) : colour

  const face = (a: Vec3, b: Vec3, d: Vec3, e: Vec3): void => {
    tri(sink, a, b, d, shade(a)); tri(sink, a, d, e, shade(a))
  }
  face(p(-1, -1, 1, 2), p(1, -1, 1, 2), p(1, 1, 1, 2), p(-1, 1, 1, 2))     // +Z
  face(p(1, -1, -1, 2), p(-1, -1, -1, 2), p(-1, 1, -1, 2), p(1, 1, -1, 2)) // -Z
  face(p(1, -1, 1, 0), p(1, -1, -1, 0), p(1, 1, -1, 0), p(1, 1, 1, 0))     // +X
  face(p(-1, -1, -1, 0), p(-1, -1, 1, 0), p(-1, 1, 1, 0), p(-1, 1, -1, 0)) // -X
  face(p(-1, 1, 1, 1), p(1, 1, 1, 1), p(1, 1, -1, 1), p(-1, 1, -1, 1))     // +Y
  face(p(-1, -1, -1, 1), p(1, -1, -1, 1), p(1, -1, 1, 1), p(-1, -1, 1, 1)) // -Y

  /** Writes the triangle against the expected outward direction, flipping it if needed. */
  const oriented = (a: Vec3, b: Vec3, d: Vec3, outward: readonly number[]): void => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
    const n = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ]
    const dot = n[0]! * outward[0]! + n[1]! * outward[1]! + n[2]! * outward[2]!
    if (dot >= 0) tri(sink, a, b, d, shade(a))
    else tri(sink, a, d, b, shade(a))
  }

  const signs = [-1, 1] as const
  for (const axis of [0, 1, 2] as const) {
    const [u, v] = [0, 1, 2].filter((i) => i !== axis) as [0 | 1 | 2, 0 | 1 | 2]
    for (const su of signs) for (const sv of signs) {
      const at = (along: number, full: 0 | 1 | 2): Vec3 => {
        const sign: [number, number, number] = [0, 0, 0]
        sign[axis] = along; sign[u] = su; sign[v] = sv
        return p(sign[0], sign[1], sign[2], full)
      }
      const outward = [0, 1, 2].map((i) => (i === u ? su : i === v ? sv : 0))
      oriented(at(-1, u), at(-1, v), at(1, v), outward)
      oriented(at(-1, u), at(1, v), at(1, u), outward)
    }
  }
  for (const sx of signs) for (const sy of signs) for (const sz of signs) {
    oriented(p(sx, sy, sz, 0), p(sx, sy, sz, 1), p(sx, sy, sz, 2), [sx, sy, sz])
  }

  return finish(sink)
}

/**
 * Truncated cone / prism: feet, shafts, bowls, flame tongues.
 *
 * If `colourTop` is given the colour ramps with height — needed for the flame,
 * because the base of a flame is not the same colour as its tip.
 */
export function prismGeometry(
  radiusBottom: number,
  radiusTop: number,
  height: number,
  segments: number,
  centre: Vec3,
  colour: Color,
  options: { readonly capTop?: boolean; readonly capBottom?: boolean; readonly colourTop?: Color } = {},
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const { capTop = true, capBottom = true } = options
  const top = options.colourTop ?? colour
  const [cx, cy, cz] = centre
  const low = cy - height / 2
  const high = cy + height / 2
  const stepAngle = (Math.PI * 2) / segments
  const shift = (p: Vec3): Vec3 => [p[0] + cx, p[1], p[2] + cz]

  for (let i = 0; i < segments; i += 1) {
    const a0 = i * stepAngle
    const a1 = (i + 1) * stepAngle
    const l0 = shift(point(a0, radiusBottom, low))
    const l1 = shift(point(a1, radiusBottom, low))
    const h0 = shift(point(a0, radiusTop, high))
    const h1 = shift(point(a1, radiusTop, high))

    // Side face: points outward.
    triShaded(sink, l0, l1, h1, colour, colour, top)
    triShaded(sink, l0, h1, h0, colour, top, top)

    if (capTop && radiusTop > 0) tri(sink, [cx, high, cz], h0, h1, top)
    if (capBottom && radiusBottom > 0) tri(sink, [cx, low, cz], l1, l0, colour)
  }

  return finish(sink)
}

/**
 * Turned surface: revolves a profile around the Y axis.
 *
 * `prismGeometry` is the two-level version of this. When more levels are needed
 * this one is used and NO INTERIOR SURFACE FORMS in between — that is the real
 * reason to use this instead of stacking prisms on top of each other: stacked
 * prisms leave a pair of coincident faces where they touch, a single lathe
 * does not.
 *
 * Everything round in the kit comes out of this: tool shafts and grip bulges,
 * conical sockets, pitchfork tines, and later jugs/candlesticks/wheel hubs.
 */
export function latheGeometry(
  levels: readonly Level[],
  segments: number,
  centre: Vec3,
  colour: Color,
  options: { readonly capTop?: boolean; readonly capBottom?: boolean; readonly colourTop?: Color } = {},
): BufferGeometry {
  if (levels.length < 2) throw new Error('latheGeometry needs at least two levels')
  const sink: Sink = { position: [], color: [] }
  const { capTop = true, capBottom = true } = options
  const top = options.colourTop ?? colour
  const [cx, cy, cz] = centre
  const stepAngle = (Math.PI * 2) / segments
  const shift = (p: Vec3): Vec3 => [p[0] + cx, p[1] + cy, p[2] + cz]
  const lerp = (t: number): Color => new Color().copy(colour).lerp(top, t)

  for (let i = 0; i < levels.length - 1; i += 1) {
    const low = levels[i]!
    const high = levels[i + 1]!
    const tLow = i / (levels.length - 1)
    const tHigh = (i + 1) / (levels.length - 1)
    const cLow = lerp(tLow)
    const cHigh = lerp(tHigh)

    for (let j = 0; j < segments; j += 1) {
      const a0 = j * stepAngle
      const a1 = (j + 1) * stepAngle
      const l0 = shift(point(a0, low.radius, low.y))
      const l1 = shift(point(a1, low.radius, low.y))
      const h0 = shift(point(a0, high.radius, high.y))
      const h1 = shift(point(a1, high.radius, high.y))
      // At a level whose radius is zero that edge collapses to a point; it is
      // closed with a single triangle so no degenerate triangle is produced.
      if (low.radius <= 1e-6) { triShaded(sink, l0, h1, h0, cLow, cHigh, cHigh); continue }
      if (high.radius <= 1e-6) { triShaded(sink, l0, l1, h0, cLow, cLow, cHigh); continue }
      triShaded(sink, l0, l1, h1, cLow, cLow, cHigh)
      triShaded(sink, l0, h1, h0, cLow, cHigh, cHigh)
    }
  }

  const first = levels[0]!
  const last = levels.at(-1)!
  for (let j = 0; j < segments; j += 1) {
    const a0 = j * stepAngle
    const a1 = (j + 1) * stepAngle
    if (capBottom && first.radius > 1e-6) {
      tri(sink, shift([0, first.y, 0]),
        shift(point(a1, first.radius, first.y)), shift(point(a0, first.radius, first.y)), colour)
    }
    if (capTop && last.radius > 1e-6) {
      tri(sink, shift([0, last.y, 0]),
        shift(point(a0, last.radius, last.y)), shift(point(a1, last.radius, last.y)), top)
    }
  }
  return finish(sink)
}

/**
 * A single barrel stave: one slice of the ring, a closed solid with thickness.
 *
 * Every level has four corners:
 *   A = outer/start angle   B = outer/end angle
 *   C = inner/end angle     D = inner/start angle
 */
export function staveGeometry(
  levels: readonly Level[],
  angleStart: number,
  angleEnd: number,
  thickness: number,
  colour: Color,
): BufferGeometry {
  if (levels.length < 2) throw new Error('staveGeometry needs at least two levels')

  const sink: Sink = { position: [], color: [] }

  const corners = levels.map((level) => {
    // Thickness cannot exceed half the thinnest radius; otherwise the inner surface breaks out.
    const inner = Math.max(level.radius * 0.5, level.radius - thickness)
    return {
      a: point(angleStart, level.radius, level.y),
      b: point(angleEnd, level.radius, level.y),
      c: point(angleEnd, inner, level.y),
      d: point(angleStart, inner, level.y),
    }
  })

  for (let i = 0; i < corners.length - 1; i += 1) {
    const low = corners[i]!
    const high = corners[i + 1]!
    quad(sink, low.a, low.b, high.b, high.a, colour)  // outer face → points outward
    quad(sink, low.c, low.d, high.d, high.c, colour)  // inner face → points at the axis
    quad(sink, low.d, low.a, high.a, high.d, colour)  // start edge
    quad(sink, low.b, low.c, high.c, high.b, colour)  // end edge
  }

  const top = corners.at(-1)!
  const bottom = corners[0]!
  quad(sink, top.a, top.b, top.c, top.d, colour)             // top cap → +Y
  quad(sink, bottom.d, bottom.c, bottom.b, bottom.a, colour) // bottom cap → -Y

  return finish(sink)
}

/**
 * Iron hoop: a ring with a rectangular cross section.
 *
 * The inner surface is deliberately not generated — the body it leans against
 * hides it from every camera. A quarter of the triangle budget is won here.
 */
export function bandGeometry(
  radius: number,
  y: number,
  height: number,
  thickness: number,
  segments: number,
  colour: Color,
  options: {
    /**
     * Generate the inner face as well.
     *
     * Not generated by default, because a hoop always wraps a body and the
     * inner face is not visible — not generating it is a free triangle saving.
     * But a free-standing ring (the cord of a sack, the tie of a bale) becomes
     * a solid that is NOT CLOSED this way, and the "no reversed faces" check in
     * the validation rightly fails. This flag is for that case.
     */
    readonly inner?: boolean
  } = {},
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const half = height / 2
  const inner = radius - thickness
  const stepAngle = (Math.PI * 2) / segments

  for (let i = 0; i < segments; i += 1) {
    const a0 = i * stepAngle
    const a1 = (i + 1) * stepAngle

    const outerLow0 = point(a0, radius, y - half)
    const outerLow1 = point(a1, radius, y - half)
    const outerHigh0 = point(a0, radius, y + half)
    const outerHigh1 = point(a1, radius, y + half)
    const innerHigh0 = point(a0, inner, y + half)
    const innerHigh1 = point(a1, inner, y + half)
    const innerLow0 = point(a0, inner, y - half)
    const innerLow1 = point(a1, inner, y - half)

    quad(sink, outerLow0, outerLow1, outerHigh1, outerHigh0, colour)   // outer → outward
    quad(sink, outerHigh0, outerHigh1, innerHigh1, innerHigh0, colour) // top → +Y
    quad(sink, innerLow0, innerLow1, outerLow1, outerLow0, colour)     // bottom → -Y
    // Inner face: the corner order is the reverse of the outer one so the normal points AT THE AXIS.
    if (options.inner) {
      quad(sink, innerHigh0, innerHigh1, innerLow1, innerLow0, colour)
    }
  }

  return finish(sink)
}

/**
 * Fan disc: barrel head, bowl bottom.
 *
 * So that it reads as built from several boards rather than one piece of wood,
 * every triangle falls into a "board band" according to the X position of its
 * centre, and the tone of that band is written into the vertex colour. The
 * geometry cost is zero.
 */
export function headGeometry(
  radius: number,
  y: number,
  segments: number,
  facing: 'up' | 'down',
  colour: Color,
  plankCount: number,
  plankShade: number,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const centre: Vec3 = [0, y, 0]
  const stepAngle = (Math.PI * 2) / segments
  const plankWidth = (radius * 2) / Math.max(1, plankCount)
  const tint = new Color()

  for (let i = 0; i < segments; i += 1) {
    const p0 = point(i * stepAngle, radius, y)
    const p1 = point((i + 1) * stepAngle, radius, y)

    // The boards are strips sliced along the X axis; whichever strip the X of
    // the triangle's centroid falls into gives it its tone.
    const centroidX = (p0[0] + p1[0]) / 3
    const band = Math.floor((centroidX + radius) / plankWidth)
    tint.copy(colour).multiplyScalar(1 + (band % 2 === 0 ? plankShade : -plankShade))

    if (facing === 'up') tri(sink, centre, p0, p1, tint)
    else tri(sink, centre, p1, p0, tint)
  }

  return finish(sink)
}

/**
 * Tapering box: a body whose bottom and top rectangles may differ.
 *
 * Anvil horn, stool leg, fence post tip, tool handle — every "box but carved"
 * part of the kit is this. The winding follows the same logic as boxGeometry.
 */
export function taperedBoxGeometry(
  bottom: readonly [number, number],
  top: readonly [number, number],
  height: number,
  centre: Vec3,
  colour: Color,
  colourTop?: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const [cx, cy, cz] = centre
  const low = cy - height / 2
  const high = cy + height / 2
  const upper = colourTop ?? colour

  // b = bottom corners, t = top corners; both in the same order:
  // (-x,+z) (+x,+z) (+x,-z) (-x,-z)
  const corner = (size: readonly [number, number], y: number, sx: number, sz: number): Vec3 =>
    [cx + (sx * size[0]) / 2, y, cz + (sz * size[1]) / 2]

  const b0 = corner(bottom, low, -1, 1), b1 = corner(bottom, low, 1, 1)
  const b2 = corner(bottom, low, 1, -1), b3 = corner(bottom, low, -1, -1)
  const t0 = corner(top, high, -1, 1), t1 = corner(top, high, 1, 1)
  const t2 = corner(top, high, 1, -1), t3 = corner(top, high, -1, -1)

  const side = (bl: Vec3, br: Vec3, tr: Vec3, tl: Vec3): void => {
    triShaded(sink, bl, br, tr, colour, colour, upper)
    triShaded(sink, bl, tr, tl, colour, upper, upper)
  }
  side(b0, b1, t1, t0)  // +Z
  side(b2, b3, t3, t2)  // -Z
  side(b1, b2, t2, t1)  // +X
  side(b3, b0, t0, t3)  // -X

  quad(sink, t0, t1, t2, t3, upper)  // top → +Y
  quad(sink, b3, b2, b1, b0, colour) // bottom → -Y
  return finish(sink)
}

/**
 * Square-section bar swept along an arc — bucket handle, ring, hook.
 *
 * The cross section is laid out counter-clockwise relative to the sweep
 * direction (the tangent); that is what makes the outer faces point outward.
 * The arc is generated in the XY plane, the model rotates it as it likes.
 */
export function arcBarGeometry(
  radius: number,
  thickness: number,
  fromAngle: number,
  toAngle: number,
  segments: number,
  centre: Vec3,
  colour: Color,
): BufferGeometry {
  const sink: Sink = { position: [], color: [] }
  const h = thickness / 2
  const [cx, cy, cz] = centre
  const rings: Vec3[][] = []

  for (let i = 0; i <= segments; i += 1) {
    const a = fromAngle + ((toAngle - fromAngle) * i) / segments
    // p: the point on the arc. r: the radial direction. z: the plane normal.
    const px = cx + Math.cos(a) * radius
    const py = cy + Math.sin(a) * radius
    const rx = Math.cos(a), ry = Math.sin(a)
    const at = (su: number, sv: number): Vec3 =>
      [px + sv * h * rx, py + sv * h * ry, cz + su * h]
    // u = the plane normal, v = the radial direction. Since u×v equals the
    // tangent, this ordering is counter-clockwise relative to the sweep direction.
    rings.push([at(1, 1), at(-1, 1), at(-1, -1), at(1, -1)])
  }

  for (let i = 0; i < segments; i += 1) {
    const a = rings[i]!, b = rings[i + 1]!
    for (let j = 0; j < 4; j += 1) {
      const k = (j + 1) % 4
      quad(sink, a[j]!, a[k]!, b[k]!, b[j]!, colour)
    }
  }

  const first = rings[0]!, last = rings[segments]!
  quad(sink, first[0]!, first[3]!, first[2]!, first[1]!, colour) // start cap
  quad(sink, last[0]!, last[1]!, last[2]!, last[3]!, colour)     // end cap
  return finish(sink)
}

export interface SheetLevel {
  /** Vertical position. */
  readonly y: number
  /** Half width at that height. */
  readonly halfWidth: number
  /** Sheet thickness. */
  readonly thickness: number
  /** Curve height: how far the edges rise relative to the middle. 0 = flat. */
  readonly curve: number
}

/**
 * Dished sheet — a single piece, a seamless concave surface.
 *
 * I tried twice to build the shovel blade from three separate flat panels and
 * both times the result was "three boards side by side": because each panel
 * rotates around its own centre, a step is left between them and the eye did
 * not read it as one surface.
 *
 * The right way is to produce ONE sheet whose cross section is curved. The
 * cross section is an arc bent by `curve` at every level; width and thickness
 * can change from level to level. The hollow faces the +Z direction.
 *
 * Besides the shovel, the shield, the trough, the roof covering and the mill
 * sail all want this.
 */
export function dishedSheetGeometry(
  levels: readonly SheetLevel[],
  segments: number,
  colour: Color,
  colourTop?: Color,
): BufferGeometry {
  if (levels.length < 2) throw new Error('dishedSheetGeometry needs at least two levels')
  const sink: Sink = { position: [], color: [] }
  const top = colourTop ?? colour
  const shade = (i: number): Color =>
    colourTop ? new Color().copy(colour).lerp(top, i / (levels.length - 1)) : colour

  // front[i][j] / back[i][j]: level i, position j along the cross section
  const front: Vec3[][] = []
  const back: Vec3[][] = []
  for (const level of levels) {
    const f: Vec3[] = []
    const b: Vec3[] = []
    for (let j = 0; j <= segments; j += 1) {
      const u = (j / segments) * 2 - 1          // -1 .. +1
      const x = u * level.halfWidth
      // Parabolic cross section: 0 in the middle, `curve` at the edges. The
      // rise of the edges is what forms the hollow.
      const z = level.curve * u * u
      f.push([x, level.y, z + level.thickness / 2])
      b.push([x, level.y, z - level.thickness / 2])
    }
    front.push(f)
    back.push(b)
  }

  const last = levels.length - 1
  for (let i = 0; i < last; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      // Front face: points at +Z. (a→b = +X, a→c = +X+Y, cross product +Z.)
      triShaded(sink, front[i]![j]!, front[i]![j + 1]!, front[i + 1]![j + 1]!,
        shade(i), shade(i), shade(i + 1))
      triShaded(sink, front[i]![j]!, front[i + 1]![j + 1]!, front[i + 1]![j]!,
        shade(i), shade(i + 1), shade(i + 1))
      // Back face: reversed winding.
      triShaded(sink, back[i]![j]!, back[i + 1]![j + 1]!, back[i]![j + 1]!,
        shade(i), shade(i + 1), shade(i))
      triShaded(sink, back[i]![j]!, back[i + 1]![j]!, back[i + 1]![j + 1]!,
        shade(i), shade(i + 1), shade(i + 1))
    }

    // Side edges: the right one points at +X, the left one at -X.
    quad(sink, front[i]![segments]!, back[i]![segments]!,
      back[i + 1]![segments]!, front[i + 1]![segments]!, shade(i))
    quad(sink, back[i]![0]!, front[i]![0]!,
      front[i + 1]![0]!, back[i + 1]![0]!, shade(i))
  }

  // Top and bottom edge strips.
  for (let j = 0; j < segments; j += 1) {
    quad(sink, front[last]![j]!, front[last]![j + 1]!,
      back[last]![j + 1]!, back[last]![j]!, shade(last))
    quad(sink, back[0]![j]!, back[0]![j + 1]!,
      front[0]![j + 1]!, front[0]![j]!, shade(0))
  }

  return finish(sink)
}

/**
 * Reverses the winding of every triangle, i.e. turns all the normals around.
 *
 * Needed for vessels whose inside is visible: the outer surface of a bowl must
 * point outward, the inner surface inward. Instead of writing the two
 * separately, we generate the same cone and flip one of them.
 */
export function flipGeometry(geometry: BufferGeometry): BufferGeometry {
  for (const name of ['position', 'color'] as const) {
    const attribute = geometry.getAttribute(name)
    if (!attribute) continue
    const array = attribute.array as Float32Array
    const stride = attribute.itemSize
    // Swapping the 2nd and 3rd corner of a triangle reverses the winding.
    for (let i = 0; i < attribute.count; i += 3) {
      for (let k = 0; k < stride; k += 1) {
        const b = (i + 1) * stride + k
        const c = (i + 2) * stride + k
        const swap = array[b]!
        array[b] = array[c]!
        array[c] = swap
      }
    }
    attribute.needsUpdate = true
  }
  return geometry
}

/**
 * Reduces parts that share the same material into a single geometry — one draw
 * call per material. The normals are computed AFTER merging: on non-indexed
 * geometry that gives every triangle its own normal, i.e. flat shading.
 */
export function mergeColoured(geometries: readonly BufferGeometry[]): BufferGeometry {
  // The normals of the inputs are dropped. The reason is a trap: because this
  // function computes normals AFTER merging, its output has a `normal`
  // attribute while the raw geometries do not. Trying to merge the two
  // together made mergeGeometries fail with "attribute counts do not match".
  // Since they are recomputed below anyway, the input normal data is worthless.
  for (const geometry of geometries) geometry.deleteAttribute('normal')

  const merged = mergeGeometries(geometries as BufferGeometry[], false)
  if (!merged) throw new Error('Could not merge geometries: attribute sets do not match')
  for (const geometry of geometries) geometry.dispose()
  merged.computeVertexNormals()
  return merged
}

/**
 * Bends a straight body into an arc (along the Y axis, in the YZ plane).
 *
 * Written for pitchfork tines. A straight tine, however thick it is, looks
 * like a technical drawing; a slight curve turns it into a forged tool. Hooks,
 * horns and scythes have the same need.
 *
 * The simple "rotate every point in proportion to its own height" approach
 * stretched the body and thinned it. The transform here is a real arc mapping:
 * the body is WRAPPED onto a circle of radius 1/curvature, so the length of the
 * centre line is preserved.
 *
 * TWO TRAPS, both found by measuring:
 *
 * 1. The arc is wrapped around y=0, so THE RESULT DEPENDS ON WHERE THE GEOMETRY
 *    SITS IN Y. A bar whose base is at the origin really does curve; a body
 *    CENTRED on y=0 bends symmetrically — its two ends go the same way, its
 *    middle stays put, and the silhouette barely changes at all. That is exactly
 *    what happened with the hoe blade: on a 0.235 m blade the bend produced
 *    14 mm of displacement but DROPPED the Z range from 0.0337 to 0.0327. Build
 *    the same blade with its base at the origin and bend it, and the offset is
 *    44 mm and the range 0.078. START whatever you want to bend at the origin.
 *
 * 2. The arc is only as smooth as the number of CROSS SECTIONS the geometry has
 *    along the Y axis. A two-level box (chamferedBoxGeometry) bent gives not an
 *    arc but a skewed box. A real arc needs a body with intermediate levels,
 *    like `latheGeometry`.
 *
 * @param curvature 1/radius. A positive value bends toward +Z. 0 does nothing.
 */
export function bendGeometry(geometry: BufferGeometry, curvature: number): BufferGeometry {
  if (Math.abs(curvature) < 1e-9) return geometry
  const position = geometry.getAttribute('position')

  // A bend needs something to bend.
  //
  // Every vertex is mapped by its own Y, so the curve only exists where there
  // are Y levels to sample it at. Hand this a `boxGeometry` -- two levels, top
  // and bottom -- and there is no midpoint to displace: the top face swings to
  // one angle, the bottom to another, and the result is a sheared wedge that
  // looks nothing like an arc. It fails silently, which is the expensive part.
  //
  // This session found the same mistake in three separate models: the
  // tankard's handle, and both the brace and the curl of the tavern sign. In
  // each the author had written a curve, the geometry had never curved, and
  // the renders had been shipping the wedge. Three is a pattern, so the
  // helper refuses rather than waiting for a fourth.
  //
  // The fix is never to nudge the curvature -- it is to give the piece levels
  // (a lathe or a stack of them), or to use `arcBarGeometry`, which sweeps a
  // real arc and takes the two things that actually matter: where the ends go.
  const seen = new Set<number>()
  for (let i = 0; i < position.count && seen.size < 3; i += 1) {
    seen.add(Math.round(position.getY(i) * 1e5))
  }
  if (seen.size < 3) {
    throw new Error(
      `bendGeometry: geometry has ${seen.size} distinct Y level(s); a bend needs at least 3. ` +
      'Two levels shear into a wedge instead of curving. Build the piece with ' +
      'levels (latheGeometry / staveGeometry) or use arcBarGeometry.',
    )
  }

  const radius = 1 / curvature
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i)
    const z = position.getZ(i)
    const angle = y * curvature
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    // Centre line + the cross section's offset perpendicular to the tangent.
    position.setY(i, radius * sin - z * sin)
    position.setZ(i, radius * (1 - cos) + z * cos)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/** Deterministic hash derived from position. The same point always gives the same value. */
function positionHash(x: number, y: number, z: number, salt: number): number {
  // The point is rounded to a 0.1 mm grid: "identical" corners getting
  // different hashes because of floating point noise was the one bug that tore
  // the surface open.
  let h = Math.imul(Math.round(x * 1e4) | 0, 0x27d4eb2d)
  h ^= Math.imul(Math.round(y * 1e4) | 0, 0x165667b1)
  h ^= Math.imul(Math.round(z * 1e4) | 0, 0x9e3779b1)
  h = Math.imul(h ^ salt, 0x85ebca6b)
  h ^= h >>> 13
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

export interface RoughenOptions {
  /** For distorting the same geometry in a different way. */
  readonly salt?: number
  /** Deviation multiplier on the Y axis. Kept low on the straw bale. */
  readonly scaleY?: number
}

/**
 * Makes the surface irregular: every corner shifts by a fixed amount derived
 * from its own position.
 *
 * Why it is derived from position: these geometries are NON-INDEXED, i.e. every
 * triangle carries its own corners and three or four copies sit at one point.
 * Moving the corners independently tears the surface — on the first attempt the
 * straw bale ended up riddled with holes. Because the position hash gives all
 * the copies at the same point the SAME shift, the surface stays closed.
 *
 * This is the only thing that makes straw look like straw: a tidy box looks
 * like a sponge whatever colour you give it.
 */
export function roughenGeometry(
  geometry: BufferGeometry,
  amount: number,
  options: RoughenOptions = {},
): BufferGeometry {
  if (amount <= 0) return geometry
  const salt = options.salt ?? 0
  const scaleY = options.scaleY ?? 1
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    position.setXYZ(
      i,
      x + positionHash(x, y, z, salt + 1) * amount,
      y + positionHash(x, y, z, salt + 2) * amount * scaleY,
      z + positionHash(x, y, z, salt + 3) * amount,
    )
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

export interface MottleOptions {
  /** For giving the same geometry a different pattern. */
  readonly salt?: number
  /**
   * The size of the specks (metres). Because positions are rounded to this
   * grid and then hashed, corners in the same cell take the same tone — so what
   * forms is not noise but MOTTLE. A small value gives sand, a large one a
   * mottled surface.
   */
  readonly cell?: number
  /** The ratio of the hue shift to the brightness shift. A high value colours the mottle. */
  readonly hue?: number
}

/**
 * Works surface mottle into the vertex colours.
 *
 * This is this kit's answer to the question "what are we going to do about
 * texture?". A bitmap texture would have wanted three things: UV coordinates
 * (our geometry has none), image files the registry would have to carry, and a
 * change to the kit's identity. All three cost more than they give back.
 *
 * Instead, a mottle pattern derived from the surface's OWN position is used.
 * `bakeOcclusion` produced shadow from the SHAPE of the surface; this gives the
 * surface a material texture. Together, with no texture file at all, the two
 * make a flat-coloured lowpoly surface look like material.
 *
 * The limit should be stated honestly: the specks are sampled at the corners of
 * the geometry, so triangle density sets their resolution. On a wide, sparsely
 * subdivided surface shrinking `cell` does not help — there the cure is to
 * subdivide the triangle, which eats into the lowpoly budget.
 */
export function mottleGeometry(
  geometry: BufferGeometry,
  amount: number,
  options: MottleOptions = {},
): BufferGeometry {
  const colour = geometry.getAttribute('color')
  if (!colour || amount <= 0) return geometry
  const position = geometry.getAttribute('position')
  const salt = options.salt ?? 0
  const cell = options.cell ?? 0.05
  const hue = options.hue ?? 0.35

  for (let i = 0; i < colour.count; i += 1) {
    const x = Math.round(position.getX(i) / cell) * cell
    const y = Math.round(position.getY(i) / cell) * cell
    const z = Math.round(position.getZ(i) / cell) * cell
    const shade = 1 + positionHash(x, y, z, salt + 7) * amount
    // A small difference between the channels: on a real material a lightened
    // spot does not just get brighter, it also loses a little saturation.
    const warm = positionHash(x, y, z, salt + 8) * amount * hue
    colour.setXYZ(
      i,
      Math.max(0, colour.getX(i) * (shade + warm)),
      Math.max(0, colour.getY(i) * shade),
      Math.max(0, colour.getZ(i) * (shade - warm)),
    )
  }
  colour.needsUpdate = true
  return geometry
}
