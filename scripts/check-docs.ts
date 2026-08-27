/**
 * Checks that the documentation still describes the kit that actually exists.
 *
 * This is here because the same thing went wrong three times. `REFERENCE.md`
 * said "four items" when there were twenty-three, which is what `catalog-table`
 * was written to fix — but that only regenerates the TABLE, and the prose
 * around it kept its own copies of the numbers. On the day the oak was added
 * the reference still claimed 27 models, 15,425 triangles and eleven material
 * slots, all three of them wrong, in a document 751 lines long whose whole
 * value is that a reader can trust it.
 *
 * A document with confident wrong numbers in it is worse than no document, so
 * the numbers are checked the way the geometry is: against the models
 * themselves, in CI, where being wrong fails rather than waits to be noticed.
 *
 *   bun scripts/check-docs.ts
 */
import { readFileSync } from 'node:fs'

import { Mesh } from 'three/webgpu'

import { MODEL_META } from '../my-registry/meta.ts'
import { CATALOG } from '@/catalog.ts'

const failures: string[] = []

function expect(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  PASS  ${label}`)
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failures.push(label)
  }
}

// --- what the kit actually is ------------------------------------------------
const ids = Object.keys(CATALOG).filter((id) => MODEL_META[id] !== undefined && id !== 'pressure-gauge')
const slots = new Set<string>()
let triangles = 0
for (const id of ids) {
  const built = CATALOG[id]!.build()
  built.root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const index = object.geometry.getIndex()
    triangles += (index ? index.count : object.geometry.getAttribute('position').count) / 3
  })
  built.dispose()
  for (const slot of MODEL_META[id]!.materialSlots) slots.add(slot)
}

const models = ids.length
console.log(`kit: ${models} models · ${triangles} triangles · ${slots.size} material slots\n`)

/** Digits, however the document happens to group them: 31404, 31,404, 31 404. */
function hasNumber(text: string, value: number): boolean {
  const digits = String(value)
  const spaced = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '[ , ]?')
  return new RegExp(spaced).test(text)
}

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
]

/**
 * `viewer.html` is in this list because it is the published page.
 *
 * Its meta description is what a search result and a shared link show, and it
 * quotes the model count and the triangle total — which is the same sentence
 * that went stale three times in the READMEs before this check existed. A
 * number in a card is worse than a number in a README: nobody reading the card
 * can see the kit to know it is wrong.
 *
 * It carries no table, so the every-model-listed rule does not apply to it,
 * any more than it does to the root README.
 */
const CARRIES_A_TABLE = new Set(['REFERENCE.md', 'my-registry/README.md'])

for (const file of ['README.md', 'REFERENCE.md', 'my-registry/README.md', 'viewer.html']) {
  const text = readFileSync(file, 'utf8')
  console.log(file)

  expect(`${file}: model count`, hasNumber(text, models), `expected ${models}`)
  expect(`${file}: triangle total`, hasNumber(text, triangles), `expected ${triangles}`)

  // Every model has to appear by id, or the document is describing a smaller
  // kit than the one it ships with. The registry README and the reference each
  // carry a generated table; the root README does not, so it is exempt.
  if (CARRIES_A_TABLE.has(file)) {
    const missing = ids.filter((id) => !text.includes(`\`${id}\``))
    expect(`${file}: every model listed`, missing.length === 0, missing.join(', '))
  }

  // A slot count written as a word ("thirteen slots") is the one number in
  // these documents that cannot be grepped as a digit, and it was wrong.
  //
  // Looked up as a NUMBER WORD rather than as any word. The first version took
  // whatever word preceded "slots", matched the ordinary phrase "material
  // slots" several paragraphs earlier, found that "material" is not a number,
  // and quietly checked nothing at all — a check that passes by not running is
  // worse than no check, because it reads as evidence.
  const written = text.match(new RegExp(`\\b(${WORDS.join('|')}) (?:material )?slots\\b`, 'i'))
  expect(
    `${file}: slot count in words`,
    written === null || WORDS.indexOf(written[1]!.toLowerCase()) === slots.size,
    written ? `says "${written[1]}", kit has ${slots.size}` : '',
  )

  // Any model named in prose but not in the kit at all: a rename that got
  // half-applied leaves exactly this trace.
  const named = [...text.matchAll(/`([a-z]+-[a-z-]+)`/g)].map((m) => m[1]!)
  const ghosts = [...new Set(named)].filter(
    (name) => /^(wooden|iron|oak|straw|hay|linen|log|pitch|leather|glass|coin|cart|bronze|tavern|trestle|wicker|round|forge|stone|post|hand)-/.test(name)
      && !ids.includes(name),
  )
  expect(`${file}: no models that do not exist`, ghosts.length === 0, ghosts.join(', '))
  console.log('')
}

if (failures.length > 0) {
  console.log(`${failures.length} documentation check(s) FAILED.`)
  process.exit(1)
}
console.log('Documentation matches the kit.')
