/**
 * The blind critic: the half of the authoring loop that was missing.
 *
 * `check-model.ts` measures a model and draws it, and both of those answer "is
 * this broken". Neither can answer "is this the thing it is named after", and
 * that is the question every model in this kit has actually failed on. The
 * pepper mill passed every geometric check ever written while being a wooden
 * bottle, and the only reason anyone found out is that a person looked at it.
 *
 * So this asks somebody else to look at it, under the conditions that make the
 * answer worth having:
 *
 * - The critic NEVER sees the code. It gets the brief, the reference and the
 *   render, and nothing else. A critic told what the builder intended tends to
 *   see the intention rather than the object.
 * - It gets the CATALOGUE ROW too, because a model is not only a likeness: it
 *   has a job in the build order. The mill's row says "the flute grip is the
 *   first radial cut", and a critic that does not know that will happily
 *   approve a mill with the flutes deleted. That happened.
 * - Modelling errors are demanded SEPARATELY from resemblance gaps, each with
 *   a location. A score is blind to a part seated on the wrong plane or a face
 *   floating in front of another, and those are what the local checks catch;
 *   mixing the two loses both.
 * - A score, at most three prioritised fixes, and a stop condition. Accept at
 *   85. Stop after two plateauing scores or ten rounds, because a plateau says
 *   the reference or the representation has to change, not that the grinding
 *   should continue.
 *
 * The output is JSON on disk, one file per model, so that a revise pass can
 * read it and so that a run of twenty models leaves twenty comparable numbers
 * rather than twenty opinions.
 *
 *   bun scripts/critique-model.ts contemporary-props pepper-mill
 *   bun scripts/critique-model.ts my-registry wooden-hoe --angles 6
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The Codex binary ships inside the VS Code ChatGPT extension. */
function findCodex(): string {
  const root = join(process.env.USERPROFILE ?? '', '.vscode', 'extensions')
  const found = readdirSync(root)
    .filter((name) => name.startsWith('openai.chatgpt-'))
    .sort()
    .reverse()
    .map((name) => join(root, name, 'bin', 'windows-x86_64', 'codex.exe'))
    .find((path) => existsSync(path))
  if (!found) throw new Error('codex.exe not found. It ships with the ChatGPT extension for VS Code.')
  return found
}

/**
 * The model's brief, in the words the kit itself uses.
 *
 * Its own description and, when there is one, the catalogue's row for it. The
 * row is the part that says what the model is FOR rather than what it looks
 * like, and it is the half a critic cannot infer from a picture.
 */
function brief(registry: string, id: string): { title: string; description: string; role: string } {
  let title = id
  let description = ''
  const sidecar = join(process.cwd(), registry, 'models', id, 'meta.json')
  if (existsSync(sidecar)) {
    const meta = JSON.parse(readFileSync(sidecar, 'utf8')) as { title?: string; description?: string }
    title = meta.title ?? id
    description = meta.description ?? ''
  }

  let role = ''
  const catalogue = join(process.cwd(), registry, 'CATALOGUE.md')
  if (existsSync(catalogue)) {
    for (const line of readFileSync(catalogue, 'utf8').split('\n')) {
      const cells = line.split('|').map((c) => c.trim())
      if (cells[2] !== id) continue
      // The last cell of a catalogue row is the argument for the model's place.
      role = cells[cells.length - 2] ?? ''
      break
    }
  }
  return { title, description, role }
}

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}
const positional = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a))
const registry = positional[0]
const id = positional[1]
if (!registry || !id) {
  console.error('usage: bun scripts/critique-model.ts <registry-dir> <model-id> [--angles N]')
  process.exit(1)
}

const angles = Number(flag('angles') ?? 4)
const reference = join(process.cwd(), 'references', `${id}.png`)
if (!existsSync(reference)) {
  throw new Error(
    `no reference at references/${id}.png. Shoot one first:\n`
    + `  bun scripts/reference-shots.ts ${registry} ${id}`,
  )
}

// The render is made by the checker rather than here, so the picture the critic
// judges is the same picture the author looked at.
console.log(`rendering ${id} at ${angles} angles …`)
execFileSync(process.execPath, [
  'scripts/check-model.ts', registry, id, '--size', '520', '--angles', String(angles),
], { stdio: 'pipe' })

const render = join(process.cwd(), registry, 'renders', `${id}-turntable.png`)
if (!existsSync(render)) throw new Error(`the checker wrote no turntable at ${render}`)

const { title, description, role } = brief(registry, id)

const prompt = [
  `Judge a procedurally generated 3D model of: ${title}.`,
  '',
  'You are given two images in this directory:',
  `  reference.png  a photograph of the real object`,
  `  render.png     ${angles} views of the model, turned on the spot`,
  '',
  'The brief the model was written to:',
  description || '(none given)',
  ...(role ? ['', 'Its job in the kit, which matters as much as the likeness:', role] : []),
  '',
  'Answer ONLY with a JSON object, no prose around it, in this exact shape:',
  '{',
  '  "score": <0-100, how well the render reads as the thing named>,',
  '  "nameItBlind": <true|false, would somebody shown only the render name the object>,',
  '  "resemblance": [<at most 3 strings, the highest-impact differences from the',
  '                   reference, most important first, each naming a measurable',
  '                   quantity such as a proportion, a count or a position>],',
  '  "modelling": [<errors of construction rather than of likeness: parts seated',
  '                 on the wrong plane, geometry floating, surfaces tearing,',
  '                 pieces intersecting. Each string must name WHERE. Empty if',
  '                 none are visible.>],',
  '  "role": "<one sentence: does the model still do the job quoted above>"',
  '}',
  '',
  'Rules. Judge only what you can see; you have not been shown the source and',
  'must not guess at it. Do not reward intent. If the render and the reference',
  'differ because the model chose differently, that is still a difference and',
  'it belongs in the list: "we chose otherwise" is a defence, "it does not read',
  'as the thing" is not. Say the number plainly; 85 is the acceptance bar and',
  'most first attempts are not near it.',
].join('\n')

const work = join(process.cwd(), 'critiques', '.work')
mkdirSync(work, { recursive: true })
writeFileSync(join(work, 'reference.png'), readFileSync(reference))
writeFileSync(join(work, 'render.png'), readFileSync(render))

console.log('asking a critic that has not seen the code …')
const raw = execFileSync(findCodex(), [
  'exec', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', prompt,
], { cwd: work, encoding: 'utf8', timeout: 10 * 60_000 })

// The CLI wraps its answer in its own chatter; take the last balanced object.
const start = raw.lastIndexOf('{')
const end = raw.lastIndexOf('}')
if (start < 0 || end < start) {
  console.error(raw.slice(-800))
  throw new Error('the critic returned no JSON object')
}
const verdict = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>

const outDir = join(process.cwd(), 'critiques')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, `${id}.json`)
writeFileSync(outPath, `${JSON.stringify({ id, registry, ...verdict }, null, 2)}\n`)

const score = Number(verdict.score)
console.log(`\n${id}: ${score}/100 · names it blind: ${verdict.nameItBlind}`)
for (const line of (verdict.resemblance as string[] | undefined) ?? []) console.log(`  likeness  ${line}`)
for (const line of (verdict.modelling as string[] | undefined) ?? []) console.log(`  BUILD     ${line}`)
if (verdict.role) console.log(`  role      ${String(verdict.role)}`)
console.log(`\n${outPath}${score >= 85 ? '  — accepted' : '  — below the 85 bar'}`)
