/**
 * Builds `media/cover.png`: the 1200×630 card that every shared link, search
 * result and chat unfurl of https://medieval.crt.fyi/ shows.
 *
 *   bun run cover:build
 *
 * It is a script and not a design file for one reason: the numbers on it are
 * COUNTED, not typed. A card that says "37 models" is a picture of a number,
 * and a picture cannot be checked the way `check-docs.ts` checks the READMEs —
 * so it is built from the catalogue on every site build, and the day a model
 * is added the card says so without anyone remembering to make it.
 *
 * Everything it draws comes from the pieces beside it: the models from
 * `raster.ts`, which is the same renderer the contact sheet uses, so the card
 * cannot disagree with it about what a barrel looks like; and the type from
 * `text.ts`, reading the site's own two faces out of their `.ttf` files, so
 * the card is set in the same Archivo and IBM Plex Mono as the page it
 * advertises.
 */
import { writeFile } from 'node:fs/promises'

import { Mesh } from 'three/webgpu'

import { blit, encodePng, newFrame, renderOne, toLinear } from './raster.ts'
import { fillText, measure, readFont } from './text.ts'
import { MODEL_META } from '../my-registry/meta.ts'
import { CATALOG } from '@/catalog.ts'

/* ------------------------------------------------------------- the palette */

// src/viewer.css, so the card and the page it links to are the same object.
const INK = toLinear('0b0e12')
const RULE = toLinear('2a333e')
const TEXT = toLinear('c7d1db')
const DIM = toLinear('7a8899')
const AMBER = toLinear('f0a93c')

/* -------------------------------------------------------------- the layout */

const WIDTH = 1200          // 1.91:1, which is what every unfurl crops to
const HEIGHT = 630
const MARGIN = 20
const COLUMNS = 10
const CELL = 116

/* --------------------------------------------------------------- the models */

const ids = Object.keys(CATALOG).filter((id) =>
  MODEL_META[id] !== undefined && id !== 'pressure-gauge' && id !== 'kit')

let triangles = 0
for (const id of ids) {
  const built = CATALOG[id]!.build()
  built.root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const index = object.geometry.getIndex()
    triangles += (index ? index.count : object.geometry.getAttribute('position').count) / 3
  })
  built.dispose()
}

const card = newFrame(WIDTH, HEIGHT, INK)

/**
 * Ten columns and four rows, because a card is 1.91:1 and 37 models want 40
 * cells: at that shape the cells come out square, which is what lets a barrel
 * look like a barrel at 116 pixels.
 *
 * The models are rendered on the card's own background rather than the contact
 * sheet's per-cell gradient, so they float on it as one field instead of
 * sitting on it as a grey slab — and the three cells the kit does not fill
 * stop being a hole. The last row is centred for the same reason: a short row
 * left flush with the others is a notch in the bottom right corner, and a
 * short row centred is how a contact sheet is supposed to end.
 */
const rows = Math.ceil(ids.length / COLUMNS)
const gridTop = HEIGHT - MARGIN - rows * CELL

ids.forEach((id, index) => {
  const row = Math.floor(index / COLUMNS)
  const column = index % COLUMNS
  const inRow = Math.min(COLUMNS, ids.length - row * COLUMNS)
  const rowLeft = (WIDTH - inRow * CELL) / 2
  blit(card, renderOne(id, { size: CELL, ground: INK }), rowLeft + column * CELL, gridTop + row * CELL)
  console.log(`  ${id}`)
})

/* ----------------------------------------------------------------- the type */

const archivo = readFont('media/fonts/Archivo-Bold.ttf')
const mono = readFont('media/fonts/IBMPlexMono-Regular.ttf')

const left = MARGIN + 20
const right = WIDTH - MARGIN - 20

fillText(card, archivo, '@medieval-kit', { x: left - 2, y: 60, size: 52, colour: TEXT })
fillText(card, mono, 'Procedural lowpoly props for three.js. Install the source, not the asset.', {
  x: left, y: 92, size: 16, colour: DIM,
})

// The install line is the whole point of a source registry, so it is set as
// something you could type rather than as one more sentence about it.
//
// The bare namespace and not `@medieval-kit/<some-model>`. Both are valid
// addresses, but this one resolves through the registry's `defaultItem` and
// installs the whole kit, which is what someone reading a card of the whole
// kit is being offered. It is also the shorter promise: a card has room for a
// command but not for the `models.json` entry the command needs first, and
// naming one arbitrary model implies a precision the card cannot deliver.
const prompt = fillText(card, mono, '$ ', { x: left, y: 118, size: 16, colour: AMBER })
fillText(card, mono, 'bunx vibe3d add @medieval-kit', { x: prompt, y: 118, size: 16, colour: TEXT })

// Counted, never typed.
const count = `${ids.length} models`
fillText(card, mono, count, { x: right, y: 58, size: 22, colour: AMBER, align: 'right' })
fillText(card, mono, `${triangles.toLocaleString('en-US')} triangles`, {
  x: right, y: 86, size: 16, colour: DIM, align: 'right',
})
fillText(card, mono, 'MIT licensed', { x: right, y: 110, size: 16, colour: DIM, align: 'right' })

// A hairline between the type and the models, held inside the margins so it
// reads as a rule rather than as the edge of a box.
for (let x = left; x < right; x += 1) {
  const at = ((gridTop - 18) * WIDTH + x) * 3
  card.colour[at] = RULE[0]; card.colour[at + 1] = RULE[1]; card.colour[at + 2] = RULE[2]
}

/* ---------------------------------------------------------------------- out */

const png = encodePng(card)
await writeFile('media/cover.png', png)
console.log(
  `\nmedia/cover.png — ${WIDTH}×${HEIGHT}, ${Math.round(png.length / 1024)} KB`
  + `\n${count} · ${triangles.toLocaleString('en-US')} triangles`
  + `\nheadline ${Math.round(measure(archivo, '@medieval-kit', 52))} px wide`,
)
