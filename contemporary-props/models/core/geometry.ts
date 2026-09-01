import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * The kit's geometry vocabulary.
 *
 * Everything is generated NON-INDEXED. The reason: on non-indexed geometry
 * computeVertexNormals() gives every triangle its own normal, so flat shading
 * becomes a natural consequence of the geometry and no material flag is needed.
 *
 * That was the whole answer in a kit with a lowpoly budget, where a barrel is
 * meant to read as staves. This kit has no such budget and is full of turned
 * and pressed objects that are genuinely smooth: a kettle, a basin, a mug, a
 * bollard, a traffic cone. Flat shading those puts visible bands across every
 * curve, so `smoothNormals` below is the way out, applied per object rather
 * than globally, because the choice belongs to the object.
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
 * A closed section for `extrudeGeometry`: points in the XY plane, in metres.
 *
 * COUNTER-CLOCKWISE seen from +Z, which is the direction the section is
 * extruded along. That is not a convention chosen here, it is the one the rest
 * of the file already turns at, and getting it backwards produces a solid whose
 * every face points inward -- which renders as a torn surface rather than as
 * anything recognisable as a winding fault.
 */
export type Section = readonly (readonly [number, number])[]

/**
 * Runs a fixed cross-section along the Z axis: the third way of making a solid
 * in this kit, after the lathe and the plan sweep.
 *
 * Each of the three is the only reasonable way to build a different family.
 * A lathe is for anything round. A plan sweep is for anything whose plan is not
 * a circle but whose profile still varies with height -- sanitary ware, seat
 * cushions. This is for anything whose SECTION IS CONSTANT and whose length is
 * arbitrary: barriers, kerbs, skirting, extruded aluminium, rails, gutters,
 * plank stock. The catalogue has a lot of those, and every one of them is the
 * same six lines with a different polyline.
 *
 * Two limits, both real and both cheap to live with:
 *
 * 1. The caps are fans from the section's CENTROID, so a section that is not
 *    star-shaped about its own centroid gets a cap with folded triangles in it.
 *    Every extruded thing in the catalogue is star-shaped; a C-channel would
 *    not be, and would want two extrusions instead of one.
 * 2. The section is constant. A tapered run is a plan sweep turned on its side,
 *    not a job for this.
 *
 * `colourTop` shades by HEIGHT rather than along the run, because that is what
 * every other generator here does and what makes a row of these look like one
 * material rather than a gradient down the road.
 */
export function extrudeGeometry(
  section: Section,
  length: number,
  centre: Vec3,
  colour: Color,
  options: {
    readonly capStart?: boolean
    readonly capEnd?: boolean
    readonly colourTop?: Color
    /**
     * Rings along the run. 1 is a single span end to end.
     *
     * It exists for the mottle. Surface variation in this kit is written into
     * VERTEX COLOURS, so it can only appear where there are vertices, and a
     * two-metre barrier extruded in one step has none between its ends: the
     * concrete slot is set to the heaviest mottle in the palette and the model
     * came out flat as paper. Stepping the run gives the noise somewhere to
     * live. It costs nothing else -- the section is constant, so every extra
     * ring is the same ring again.
     */
    readonly steps?: number
  } = {},
): BufferGeometry {
  if (section.length < 3) throw new Error('extrudeGeometry needs a section of at least three points')
  const sink: Sink = { position: [], color: [] }
  const { capStart = true, capEnd = true } = options
  const steps = Math.max(1, Math.round(options.steps ?? 1))
  const top = options.colourTop ?? colour
  const [cx, cy, cz] = centre

  let low = Infinity
  let high = -Infinity
  for (const [, y] of section) {
    if (y < low) low = y
    if (y > high) high = y
  }
  const span = high - low
  const shade = (y: number): Color =>
    span > 1e-9 ? new Color().copy(colour).lerp(top, (y - low) / span) : colour

  const at = (index: number, z: number): Vec3 => {
    const [x, y] = section[index % section.length]!
    return [cx + x, cy + y, cz + z]
  }

  for (let step = 0; step < steps; step += 1) {
    const z0 = (step / steps) * length
    const z1 = ((step + 1) / steps) * length
    for (let i = 0; i < section.length; i += 1) {
      const c0 = shade(section[i % section.length]![1])
      const c1 = shade(section[(i + 1) % section.length]![1])
      const a = at(i, z0)
      const b = at(i + 1, z0)
      const c = at(i + 1, z1)
      const d = at(i, z1)
      triShaded(sink, a, b, c, c0, c1, c1)
      triShaded(sink, a, c, d, c0, c1, c0)
    }
  }

  if (capStart || capEnd) {
    let mx = 0
    let my = 0
    for (const [x, y] of section) { mx += x; my += y }
    mx /= section.length
    my /= section.length
    const middle = shade(my)
    for (let i = 0; i < section.length; i += 1) {
      if (capStart) {
        tri(sink, [cx + mx, cy + my, cz], at(i + 1, 0), at(i, 0), middle)
      }
      if (capEnd) {
        tri(sink, [cx + mx, cy + my, cz + length], at(i, length), at(i + 1, length), middle)
      }
    }
  }
  return finish(sink)
}

/**
 * A closed plan curve in unit coordinates, for `planSweepGeometry`.
 *
 * The points run anticlockwise seen from above and the ring closes back on the
 * first one implicitly, exactly as a lathe's segments do. Values are in the
 * range -1..1 on both axes; the sweep scales them to real half-extents, so one
 * plan describes a family of objects of any width and depth.
 */
export type Plan = readonly (readonly [number, number])[]

/**
 * The plan of a wall-hung sanitary ware body: a semicircular front, straight
 * sides, and a flat back.
 *
 * This is a D, and a D is what a lathe cannot make. Every basin, cistern,
 * bath and back-to-wall pan in the catalogue has one, for the same reason: the
 * back goes against a wall, and the moment the back is flat the object has a
 * FRONT, which is most of what makes it read as plumbing rather than as a bowl
 * on a stick.
 *
 * The flat back faces +Z and the round front faces -Z, so a model built on
 * this plan is already the right way round for a wall behind it.
 *
 * Both halves are superellipses and only the exponent differs. The front runs
 * at 2, which is an ellipse. The back runs high, and the higher it goes the
 * squarer the back corners get: at 8 the back edge is within 6% of straight
 * across its middle two thirds, which is closer than the eye reads at prop
 * scale and costs nothing over the ellipse.
 *
 * @param back exponent for the wall half. 2 gives an ellipse (no D at all).
 */
export function dPlan(segments: number, back = 8): Plan {
  const points: Array<readonly [number, number]> = []
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    /*
     * The exponent BLENDS rather than switches.
     *
     * Switched hard at cos = 0 the two curves meet at exactly (+/-1, 0) -- the
     * position is continuous for any pair of exponents -- but their tangents
     * are not, and a tangent break in a swept surface is a crease running the
     * full height of the object.
     *
     * So it blends, and the WINDOW IS ENTIRELY INSIDE THE BACK HALF. Blended
     * symmetrically about cos = 0 instead, the exponent is already at 5 by the
     * time it reaches the sides, and a superellipse at 5 has flat sides: the
     * basin came out with a squared-off panel down each flank, bright and
     * hard-edged, that looked like a modelling fault and was the plan curve
     * doing exactly what it had been told. Starting at cos = 0 with a
     * smoothstep costs nothing -- the derivative is zero there, so the front
     * half stays a true ellipse and the tangent still matches across the join.
     */
    // The window is the WHOLE back half. Ending it early at 0.6 leaves a jump
    // in curvature where it stops, and a curvature jump on a swept body is a
    // diagonal crease down the flank -- fainter than the tangent break it
    // replaced, and still visible.
    const t = Math.min(1, Math.max(0, cos))
    const power = 2 / (2 + (back - 2) * (t * t * (3 - 2 * t)))
    // x from sin and z from cos, which is not a choice: it is the handedness
    // the rest of the file turns at. Written the intuitive way round, the ring
    // is traversed backwards, every triangle faces inward, and back-face
    // culling then shows you the inside of the far wall through the near one.
    // The result looks like a shading bug and is a winding bug.
    points.push([
      Math.sign(sin) * Math.abs(sin) ** power,
      Math.sign(cos) * Math.abs(cos) ** power,
    ])
  }
  return points
}

/** One ring of a plan sweep: a height, a scale, and where that ring sits. */
export interface PlanLevel {
  /** Vertical position (metres). */
  readonly y: number
  /** Multiplier on the plan. 1 is the full half-extents, 0 collapses to a point. */
  readonly scale: number
  /**
   * Multiplier along Z, when it differs from `scale`. Defaults to `scale`.
   *
   * A uniform scale cannot describe a rim: a basin's shelf is 44 mm at the
   * sides and 67 mm front-to-back, and one number gives whichever of those you
   * solve for and the wrong value for the other. Anything whose wall thickness
   * is not proportional to its plan needs the second number.
   */
  readonly scaleZ?: number
  /**
   * Displacement of this ring along Z, in metres. Default 0, which shrinks the
   * ring about its own centre.
   *
   * It exists for one shape and that shape is everywhere: anything against a
   * wall. A basin, a cistern, a back-to-wall pan all narrow as they descend on
   * three sides and stay dead flat on the fourth, because the fourth is
   * touching plaster the whole way down. Scaling alone cannot do that -- it
   * pulls the back plane forward with everything else, and the object stands
   * off the wall at the bottom like a piece of furniture. Passing
   * `shift: halfDepth * (1 - scale)` pins the back edge and lets the front and
   * sides come in around it.
   */
  readonly shift?: number
}

/**
 * Sweeps a profile along a closed plan curve. `latheGeometry` is this with a
 * circle for a plan.
 *
 * The difference matters for one reason: a lathe's cross-section is decided by
 * the generator and a sweep's is decided by the caller, so anything whose
 * SILHOUETTE FROM ABOVE is not a circle has to come from here. In this kit that
 * is the sanitary ware, the seat cushions, and later the baths.
 *
 * The profile is a list of levels exactly as a lathe's is, WALKED IN THE SAME
 * DIRECTION: from the bottom of the outer wall upward, because that is what
 * puts the outward normal on the outside. It does NOT have to be monotonic in
 * y -- but a closed profile that doubles back has to close the right way round,
 * and one written the other way round produces a body whose every face points
 * inward. That does not look like a winding fault in a render; it looks like a
 * torn surface, because culling removes the near wall and leaves the far one's
 * inside on show. A basin's profile runs down the outside, under the
 * bowl, back up the inside and over the rim to where it started; that closed
 * loop seals the solid without a single cap, which is why both caps default to
 * off here where a lathe defaults them on.
 */
export function planSweepGeometry(
  plan: Plan,
  levels: readonly PlanLevel[],
  half: readonly [number, number],
  centre: Vec3,
  colour: Color,
  options: { readonly capTop?: boolean; readonly capBottom?: boolean; readonly colourTop?: Color } = {},
): BufferGeometry {
  if (levels.length < 2) throw new Error('planSweepGeometry needs at least two levels')
  if (plan.length < 3) throw new Error('planSweepGeometry needs a plan of at least three points')
  const sink: Sink = { position: [], color: [] }
  const { capTop = false, capBottom = false } = options
  const top = options.colourTop ?? colour
  const [cx, cy, cz] = centre
  const [hx, hz] = half
  const lerp = (t: number): Color => new Color().copy(colour).lerp(top, t)
  const at = (index: number, level: PlanLevel): Vec3 => {
    const [px, pz] = plan[index % plan.length]!
    return [
      cx + px * hx * level.scale,
      cy + level.y,
      cz + pz * hz * (level.scaleZ ?? level.scale) + (level.shift ?? 0),
    ]
  }

  for (let i = 0; i < levels.length - 1; i += 1) {
    const low = levels[i]!
    const high = levels[i + 1]!
    const cLow = lerp(i / (levels.length - 1))
    const cHigh = lerp((i + 1) / (levels.length - 1))
    for (let j = 0; j < plan.length; j += 1) {
      const l0 = at(j, low)
      const l1 = at(j + 1, low)
      const h0 = at(j, high)
      const h1 = at(j + 1, high)
      // A level scaled to zero collapses its whole ring onto the axis, so the
      // quad there is closed with one triangle instead of two degenerate ones.
      if (Math.abs(low.scale) <= 1e-6) { triShaded(sink, l0, h1, h0, cLow, cHigh, cHigh); continue }
      if (Math.abs(high.scale) <= 1e-6) { triShaded(sink, l0, l1, h0, cLow, cLow, cHigh); continue }
      triShaded(sink, l0, l1, h1, cLow, cLow, cHigh)
      triShaded(sink, l0, h1, h0, cLow, cHigh, cHigh)
    }
  }

  const first = levels[0]!
  const last = levels.at(-1)!
  for (let j = 0; j < plan.length; j += 1) {
    if (capBottom && Math.abs(first.scale) > 1e-6) {
      const c: Vec3 = [cx, cy + first.y, cz + (first.shift ?? 0)]
      tri(sink, c, at(j + 1, first), at(j, first), colour)
    }
    if (capTop && Math.abs(last.scale) > 1e-6) {
      const c: Vec3 = [cx, cy + last.y, cz + (last.shift ?? 0)]
      tri(sink, c, at(j, last), at(j + 1, last), top)
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
  /**
   * Sides of the CROSS SECTION. Four, the default, is the square this always
   * was and reproduces it corner for corner.
   *
   * More than four rounds it, and `thickness` goes on meaning the same thing:
   * the width across the section. A square handle strap has four hard edges
   * running the length of the loop and they catch the light as ridges, which
   * is what made a mug handle read as a folded ribbon however well its
   * proportions were set. A real one is an oval, and an oval is what a
   * twelve-sided section scaled unevenly gives.
   */
  sides = 4,
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
    // tangent, this ordering is counter-clockwise relative to the sweep
    // direction, and the half-step offset is what puts a four-sided section's
    // corners exactly where the hand-written [1,1] [-1,1] [-1,-1] [1,-1] put
    // them. `reach` keeps `thickness` meaning the width across: the corner
    // circle circumscribes the square at four sides and IS the section at
    // more.
    const reach = sides === 4 ? Math.SQRT2 : 1
    const ring: Vec3[] = []
    for (let j = 0; j < sides; j += 1) {
      const t = ((j + 0.5) / sides) * Math.PI * 2
      ring.push(at(Math.cos(t) * reach, Math.sin(t) * reach))
    }
    rings.push(ring)
  }

  for (let i = 0; i < segments; i += 1) {
    const a = rings[i]!, b = rings[i + 1]!
    for (let j = 0; j < sides; j += 1) {
      const k = (j + 1) % sides
      quad(sink, a[j]!, a[k]!, b[k]!, b[j]!, colour)
    }
  }

  // Fans rather than quads, because the section is no longer always four
  // sided. At four they are the same two triangles the quad was.
  const first = rings[0]!, last = rings[segments]!
  for (let j = 1; j < sides - 1; j += 1) {
    tri(sink, first[0]!, first[j + 1]!, first[j]!, colour)
    tri(sink, last[0]!, last[j]!, last[j + 1]!, colour)
  }
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

/**
 * Averages normals across edges that are not creases, in place.
 *
 * Non-indexed geometry has no idea which triangles are neighbours, so this
 * finds out the only way available: vertices at the same POSITION belong
 * together. Positions are quantised before comparison because two triangles
 * that share an edge were generated from the same numbers and land on the same
 * point to the last bit, while anything merely close is a different corner.
 *
 * The crease angle is what makes it usable. Averaging every shared vertex
 * would round the rim of the vase into the wall and the foot into the table,
 * which is how a smoothed lowpoly object turns to soap. Only faces that agree
 * to within the crease angle are averaged with each other, so a curve comes
 * out smooth and an edge stays an edge, with no hand-marked smoothing groups.
 *
 * @param crease Degrees. 30 keeps chamfers crisp; 60 smooths all but hard
 *               corners; above about 80 everything melts together.
 */
export function smoothNormals(geometry: BufferGeometry, crease = 40): BufferGeometry {
  const position = geometry.getAttribute('position')
  if (!position || geometry.getIndex()) return geometry
  const count = position.count
  const limit = Math.cos((crease * Math.PI) / 180)

  // Face normal per triangle, computed once.
  const faceNormal = new Float32Array((count / 3) * 3)
  const ax = new Vector3(), bx = new Vector3(), cx = new Vector3()
  const e1 = new Vector3(), e2 = new Vector3(), n = new Vector3()
  for (let f = 0; f < count / 3; f += 1) {
    ax.fromBufferAttribute(position, f * 3)
    bx.fromBufferAttribute(position, f * 3 + 1)
    cx.fromBufferAttribute(position, f * 3 + 2)
    n.copy(e1.subVectors(bx, ax)).cross(e2.subVectors(cx, ax))
    if (n.lengthSq() > 0) n.normalize()
    faceNormal[f * 3] = n.x; faceNormal[f * 3 + 1] = n.y; faceNormal[f * 3 + 2] = n.z
  }

  // Which faces meet at each position.
  const at = new Map<string, number[]>()
  const key = (i: number): string => {
    const x = Math.round(position.getX(i) * 1e5)
    const y = Math.round(position.getY(i) * 1e5)
    const z = Math.round(position.getZ(i) * 1e5)
    return `${x},${y},${z}`
  }
  for (let i = 0; i < count; i += 1) {
    const k = key(i)
    const list = at.get(k)
    if (list) list.push(Math.floor(i / 3))
    else at.set(k, [Math.floor(i / 3)])
  }

  const out = new Float32Array(count * 3)
  const sum = new Vector3()
  for (let i = 0; i < count; i += 1) {
    const face = Math.floor(i / 3)
    n.set(faceNormal[face * 3]!, faceNormal[face * 3 + 1]!, faceNormal[face * 3 + 2]!)
    sum.set(0, 0, 0)
    for (const other of at.get(key(i)) ?? [face]) {
      const m = new Vector3(faceNormal[other * 3]!, faceNormal[other * 3 + 1]!, faceNormal[other * 3 + 2]!)
      // Only neighbours on the same side of the crease contribute. A face
      // beyond it keeps its own normal and the edge survives.
      if (m.dot(n) >= limit) sum.add(m)
    }
    if (sum.lengthSq() === 0) sum.copy(n)
    sum.normalize()
    out[i * 3] = sum.x; out[i * 3 + 1] = sum.y; out[i * 3 + 2] = sum.z
  }
  geometry.setAttribute('normal', new BufferAttribute(out, 3))
  return geometry
}
