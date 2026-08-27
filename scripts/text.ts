/**
 * Type, for the software renderer: a TrueType reader and a glyph filler.
 *
 * The social card needs a headline, and the renderer next door has no font in
 * it — it draws triangles. The first version of the card got around that by
 * being an HTML page screenshotted in a browser, which works exactly once and
 * then rots: the model count on it is a picture of a number, and nobody can
 * regenerate it without repeating the whole manual dance.
 *
 * So the card became `bun run cover:build`, and this is what let it. It reads
 * the outlines out of a `.ttf` and fills them with a scanline pass, which is
 * the same shape of code as the triangle rasteriser and the PNG encoder it
 * sits beside — this repository already draws its own pictures and writes its
 * own PNG chunks, so parsing its own glyphs is in character rather than a
 * departure.
 *
 * It is deliberately partial. Only what the card actually asks for is here:
 * the Basic Multilingual Plane through a format 4 `cmap`, simple and composite
 * outlines, horizontal advances, and no kerning, hinting, ligatures or
 * shaping. Anything it cannot draw it reports rather than silently dropping,
 * because a headline missing a letter is the sort of thing you do not see
 * until it is published.
 */
import { readFileSync } from 'node:fs'

export interface Point { readonly x: number; readonly y: number }

interface Glyph {
  /** Closed polygons, in font units, y up. Already flattened from curves. */
  readonly contours: readonly (readonly Point[])[]
  readonly advance: number
}

export interface Face {
  /** Font units per em. Every outline and advance is in these. */
  readonly unitsPerEm: number
  glyph(code: number): Glyph | undefined
}

/* ------------------------------------------------------------------ reading */

function tagAt(view: DataView, at: number): string {
  return String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3))
}

export function readFont(path: string): Face {
  const bytes = readFileSync(path)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  const tables = new Map<string, number>()
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16
    tables.set(tagAt(view, record), view.getUint32(record + 8))
  }
  const need = (tag: string): number => {
    const offset = tables.get(tag)
    if (offset === undefined) throw new Error(`${path}: no ${tag} table`)
    return offset
  }

  const head = need('head')
  const unitsPerEm = view.getUint16(head + 18)
  // 0 means the loca table holds half-offsets in uint16, 1 means whole ones in
  // uint32. Reading it the wrong way gives outlines that are pure noise.
  const longLoca = view.getInt16(head + 50) === 1
  const numGlyphs = view.getUint16(need('maxp') + 4)
  const numHMetrics = view.getUint16(need('hhea') + 34)
  const hmtx = need('hmtx')
  const loca = need('loca')
  const glyf = need('glyf')

  /* --- cmap: character → glyph id, through the (3,1) format 4 subtable ----- */

  const cmap = need('cmap')
  let format4 = -1
  for (let i = 0; i < view.getUint16(cmap + 2); i += 1) {
    const record = cmap + 4 + i * 8
    const platform = view.getUint16(record)
    const encoding = view.getUint16(record + 2)
    const subtable = cmap + view.getUint32(record + 4)
    // Windows/BMP first, Unicode/BMP as the fallback. Both are format 4 in
    // every font this ships with, and format 4 covers everything a card in
    // English can need.
    if (view.getUint16(subtable) !== 4) continue
    if (platform === 3 && encoding === 1) { format4 = subtable; break }
    if (platform === 0 && format4 < 0) format4 = subtable
  }
  if (format4 < 0) throw new Error(`${path}: no format 4 cmap`)

  const segments = view.getUint16(format4 + 6) / 2
  const endCodes = format4 + 14
  const startCodes = endCodes + segments * 2 + 2
  const deltas = startCodes + segments * 2
  const rangeOffsets = deltas + segments * 2

  function glyphId(code: number): number {
    for (let s = 0; s < segments; s += 1) {
      if (view.getUint16(endCodes + s * 2) < code) continue
      if (view.getUint16(startCodes + s * 2) > code) return 0
      const delta = view.getInt16(deltas + s * 2)
      const rangeOffset = view.getUint16(rangeOffsets + s * 2)
      if (rangeOffset === 0) return (code + delta) & 0xffff
      // The offset is measured from the slot it was read out of, which is the
      // one genuinely strange thing in the format.
      const at = rangeOffsets + s * 2 + rangeOffset + (code - view.getUint16(startCodes + s * 2)) * 2
      const id = view.getUint16(at)
      return id === 0 ? 0 : (id + delta) & 0xffff
    }
    return 0
  }

  /* --- glyf: the outlines ------------------------------------------------- */

  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  /** Quadratic Bézier, flattened. Font units, so the step is generous. */
  function quadratic(out: Point[], from: Point, control: Point, to: Point): void {
    const span = Math.hypot(control.x - from.x, control.y - from.y)
      + Math.hypot(to.x - control.x, to.y - control.y)
    const steps = Math.min(20, Math.max(3, Math.ceil(span / 25)))
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps
      const u = 1 - t
      out.push({
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
      })
    }
  }

  interface Vertex extends Point { readonly on: boolean }

  /** One TrueType contour → one closed polygon. */
  function flatten(points: readonly Vertex[]): Point[] {
    const n = points.length
    if (n === 0) return []
    const first = points.findIndex((p) => p.on)
    // A contour made entirely of off-curve points is legal: the start is then
    // the midpoint between the last control point and the first.
    const start: Point = first >= 0 ? points[first]! : mid(points[n - 1]!, points[0]!)
    const walk = first >= 0
      ? [...points.slice(first + 1), ...points.slice(0, first)]
      : [...points]

    const out: Point[] = [start]
    let control: Point | null = null
    for (const point of walk) {
      const here = out[out.length - 1]!
      if (point.on) {
        if (control) { quadratic(out, here, control, point); control = null } else out.push(point)
      } else {
        // Two control points in a row imply an on-curve point between them.
        if (control) quadratic(out, here, control, mid(control, point))
        control = point
      }
    }
    if (control) quadratic(out, out[out.length - 1]!, control, start)
    return out
  }

  function outline(id: number, depth = 0): Point[][] {
    if (id >= numGlyphs || depth > 4) return []
    const from = longLoca ? view.getUint32(loca + id * 4) : view.getUint16(loca + id * 2) * 2
    const to = longLoca ? view.getUint32(loca + id * 4 + 4) : view.getUint16(loca + id * 2 + 2) * 2
    if (to <= from) return []           // a blank glyph, such as the space

    let at = glyf + from
    const contourCount = view.getInt16(at)
    at += 10                            // past the bounding box

    if (contourCount < 0) return composite(at, depth)

    const ends: number[] = []
    for (let i = 0; i < contourCount; i += 1) { ends.push(view.getUint16(at)); at += 2 }
    const count = (ends[ends.length - 1] ?? -1) + 1
    at += 2 + view.getUint16(at)        // past the hinting instructions

    const flags = new Uint8Array(count)
    for (let i = 0; i < count;) {
      const flag = view.getUint8(at); at += 1
      flags[i] = flag; i += 1
      if (flag & 8) {                   // repeat
        let repeats = view.getUint8(at); at += 1
        while (repeats > 0 && i < count) { flags[i] = flag; i += 1; repeats -= 1 }
      }
    }

    // x then y, each stored as a delta that is one byte, two bytes, or absent
    // entirely when it repeats the previous coordinate.
    const read = (short: number, same: number): Int32Array => {
      const values = new Int32Array(count)
      let value = 0
      for (let i = 0; i < count; i += 1) {
        const flag = flags[i]!
        if (flag & short) {
          const delta = view.getUint8(at); at += 1
          value += flag & same ? delta : -delta
        } else if (!(flag & same)) {
          value += view.getInt16(at); at += 2
        }
        values[i] = value
      }
      return values
    }
    const xs = read(2, 16)
    const ys = read(4, 32)

    const contours: Point[][] = []
    let begin = 0
    for (const end of ends) {
      const points: Vertex[] = []
      for (let i = begin; i <= end; i += 1) points.push({ x: xs[i]!, y: ys[i]!, on: (flags[i]! & 1) !== 0 })
      const polygon = flatten(points)
      if (polygon.length >= 3) contours.push(polygon)
      begin = end + 1
    }
    return contours
  }

  /** A glyph built from other glyphs — the `@` in some faces, accents in all. */
  function composite(start: number, depth: number): Point[][] {
    let at = start
    const contours: Point[][] = []
    for (;;) {
      const flags = view.getUint16(at); at += 2
      const index = view.getUint16(at); at += 2
      let dx: number, dy: number
      if (flags & 1) { dx = view.getInt16(at); dy = view.getInt16(at + 2); at += 4 }
      else { dx = view.getInt8(at); dy = view.getInt8(at + 1); at += 2 }
      if (!(flags & 2)) { dx = 0; dy = 0 }   // args are point numbers, not offsets

      const f2dot14 = (offset: number): number => view.getInt16(offset) / 16384
      let a = 1, b = 0, c = 0, d = 1
      if (flags & 8) { a = d = f2dot14(at); at += 2 }
      else if (flags & 0x40) { a = f2dot14(at); d = f2dot14(at + 2); at += 4 }
      else if (flags & 0x80) {
        a = f2dot14(at); b = f2dot14(at + 2); c = f2dot14(at + 4); d = f2dot14(at + 6); at += 8
      }

      for (const contour of outline(index, depth + 1)) {
        contours.push(contour.map((p) => ({ x: a * p.x + c * p.y + dx, y: b * p.x + d * p.y + dy })))
      }
      if (!(flags & 0x20)) break             // no more components
    }
    return contours
  }

  const cache = new Map<number, Glyph | undefined>()
  return {
    unitsPerEm,
    glyph(code: number): Glyph | undefined {
      if (cache.has(code)) return cache.get(code)
      const id = glyphId(code)
      const glyph = id === 0 ? undefined : {
        contours: outline(id),
        advance: view.getUint16(hmtx + Math.min(id, numHMetrics - 1) * 4),
      }
      cache.set(code, glyph)
      return glyph
    },
  }
}

/* --------------------------------------------------------------- rendering */

export interface TextTarget {
  readonly width: number
  readonly height: number
  /** rgb, linear, three floats per pixel. A `Frame` from raster.ts fits. */
  readonly colour: Float32Array
}

export interface TextOptions {
  readonly x: number
  readonly y: number            // the BASELINE, not the top
  readonly size: number         // px per em
  readonly colour: readonly number[]   // linear rgb
  readonly align?: 'left' | 'right'
}

export function measure(face: Face, text: string, size: number): number {
  const scale = size / face.unitsPerEm
  let width = 0
  for (const character of text) width += (face.glyph(character.codePointAt(0)!)?.advance ?? 0) * scale
  return width
}

/**
 * Draws a string and returns where the pen ended up, so a run in one colour
 * can be continued in another without measuring it twice.
 *
 * Four sub-scanlines per row, with exact horizontal coverage along each of
 * them. Sampling on a 4×4 grid instead would be less code and visibly worse:
 * sixteen levels of grey is enough for a headline and not for 16px mono, which
 * is most of the type on the card.
 */
export function fillText(target: TextTarget, face: Face, text: string, options: TextOptions): number {
  const { x, y, size, colour, align = 'left' } = options
  const scale = size / face.unitsPerEm
  let pen = align === 'right' ? x - measure(face, text, size) : x

  for (const character of text) {
    const code = character.codePointAt(0)!
    const glyph = face.glyph(code)
    if (!glyph) {
      if (character !== ' ') throw new Error(`no glyph for U+${code.toString(16).toUpperCase()} (${character})`)
      continue
    }
    // Font units are y up and the frame is y down, which flips the winding of
    // every contour. Non-zero fill does not care, as long as holes keep
    // winding against their outlines — and they do, because both flip.
    const polygons = glyph.contours.map((contour) =>
      contour.map((p) => ({ x: pen + p.x * scale, y: y - p.y * scale })))
    fill(target, polygons, colour)
    pen += glyph.advance * scale
  }
  return pen
}

const SUB = 4

function fill(target: TextTarget, polygons: readonly (readonly Point[])[], colour: readonly number[]): void {
  if (polygons.length === 0) return
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const polygon of polygons) {
    for (const p of polygon) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
  }
  const left = Math.max(0, Math.floor(minX))
  const right = Math.min(target.width - 1, Math.ceil(maxX))
  const top = Math.max(0, Math.floor(minY))
  const bottom = Math.min(target.height - 1, Math.ceil(maxY))
  if (right < left || bottom < top) return

  const coverage = new Float32Array(right - left + 1)
  const crossings: { x: number; winding: number }[] = []

  for (let row = top; row <= bottom; row += 1) {
    coverage.fill(0)
    for (let sub = 0; sub < SUB; sub += 1) {
      const scanline = row + (sub + 0.5) / SUB
      crossings.length = 0
      for (const polygon of polygons) {
        for (let i = 0; i < polygon.length; i += 1) {
          const a = polygon[i]!
          const b = polygon[(i + 1) % polygon.length]!
          // Half-open in y, so a vertex shared by two edges is counted once.
          if ((a.y <= scanline) === (b.y <= scanline)) continue
          const t = (scanline - a.y) / (b.y - a.y)
          crossings.push({ x: a.x + t * (b.x - a.x), winding: b.y > a.y ? 1 : -1 })
        }
      }
      if (crossings.length < 2) continue
      crossings.sort((p, q) => p.x - q.x)

      let winding = 0
      for (let i = 0; i < crossings.length - 1; i += 1) {
        winding += crossings[i]!.winding
        if (winding !== 0) span(coverage, left, right, crossings[i]!.x, crossings[i + 1]!.x, 1 / SUB)
      }
    }

    for (let column = left; column <= right; column += 1) {
      const alpha = Math.min(1, coverage[column - left]!)
      if (alpha <= 0) continue
      const at = (row * target.width + column) * 3
      for (let k = 0; k < 3; k += 1) {
        target.colour[at + k] = target.colour[at + k]! * (1 - alpha) + colour[k]! * alpha
      }
    }
  }
}

/** Adds a horizontal span's coverage, with the partial pixels at each end. */
function span(coverage: Float32Array, left: number, right: number, from: number, to: number, weight: number): void {
  const x0 = Math.max(from, left)
  const x1 = Math.min(to, right + 1)
  if (x1 <= x0) return
  const first = Math.floor(x0)
  const last = Math.min(right, Math.floor(x1 - 1e-9))
  if (first === last) {
    coverage[first - left] = coverage[first - left]! + (x1 - x0) * weight
    return
  }
  coverage[first - left] = coverage[first - left]! + (first + 1 - x0) * weight
  for (let i = first + 1; i < last; i += 1) coverage[i - left] = coverage[i - left]! + weight
  coverage[last - left] = coverage[last - left]! + (x1 - last) * weight
}
