/**
 * Generates one photographic reference per model, using the Codex CLI's image
 * tool.
 *
 * This exists because of a question from outside the project: "are you using
 * reference images?" The answer was no, and that was the reason several models
 * took three or four attempts each. Rendering our own output and looking at it
 * can only answer "is this broken". It can never answer "is this right",
 * because there is nothing to be right ABOUT.
 *
 * The prompt asks for the same shot every time -- three-quarter view, whole
 * object, plain dark ground, even light -- because the images are measuring
 * instruments, not art. A reference lit from a dramatic angle hides exactly the
 * silhouette detail we need to compare against.
 *
 * Output goes to `references/`, which is NOT tracked: the corpus is tens of
 * megabytes and belongs to the private studio repo, not to the registry that
 * consumers clone.
 *
 *   bun scripts/reference-shots.ts              → only the missing ones
 *   bun scripts/reference-shots.ts --force      → regenerate everything
 *   bun scripts/reference-shots.ts log-pile ... → only these
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { MODEL_META } from '../my-registry/meta.ts'

/** The Codex binary ships inside the VS Code ChatGPT extension. */
function findCodex(): string {
  const root = join(process.env.USERPROFILE ?? '', '.vscode', 'extensions')
  const candidates = readdirSync(root)
    .filter((name) => name.startsWith('openai.chatgpt-'))
    .sort()
    .reverse()
    .map((name) => join(root, name, 'bin', 'windows-x86_64', 'codex.exe'))
  const found = candidates.find((path) => existsSync(path))
  if (!found) {
    throw new Error(
      'codex.exe not found. It ships with the ChatGPT extension for VS Code; ' +
      'install that, or put codex on PATH.',
    )
  }
  return found
}

/**
 * Extra wording for models whose name alone would send the generator somewhere
 * useless. "Phial" produces perfume bottles; "sack" produces modern hessian.
 */
const HINT: Record<string, string> = {
  'bronze-bell': 'a bronze bell hanging in a simple wooden swinging frame',
  'cart-wheel': 'a wooden spoked cart wheel with an iron tyre, standing upright',
  'coin-pouch': 'a small drawstring leather coin purse, closed, resting on its base',
  'glass-phial': 'a small medieval apothecary glass vial with a cork stopper',
  'hay-bale': 'a round bale of dry hay bound with rope',
  'iron-anvil': 'a blacksmith anvil with a horn, on a wooden block',
  'iron-lantern': 'a medieval iron candle lantern with glass panes and a carrying handle',
  'leather-book': 'a closed medieval leather-bound book with metal corner bosses',
  'linen-sack': 'a filled linen grain sack tied at the neck with cord, standing upright',
  'log-pile': 'a stack of split firewood logs, cut ends facing the viewer',
  'oak-tankard': 'a wooden stave tankard with iron bands and a handle',
  'pitch-torch': 'a wooden torch with a pitch-soaked cloth head, unlit',
  'straw-broom': 'a besom broom: a birch twig bundle bound to a wooden handle',
  'tavern-sign': 'a hanging wooden inn sign on a standing post with an iron bracket',
  'trestle-table': 'a medieval trestle table: plank top on two A-frame trestles',
  'wicker-basket': 'a woven wicker basket filled with fruit',
  'wooden-barrel': 'a coopered oak barrel with iron hoops and rivets',
  'wooden-bucket': 'a wooden stave bucket with iron bands and a rope handle',
  'wooden-chest': 'a medieval wooden chest with iron straps, lid closed',
  'wooden-crate': 'a rough wooden shipping crate made of planks',
  'wooden-fence': 'a short section of rustic wooden post-and-rail fence',
  'wooden-hoe': 'a medieval garden hoe: wooden shaft, flat iron blade',
  'wooden-ladder': 'a wooden ladder with round rungs, leaning slightly',
  'wooden-pitchfork': 'a wooden hay pitchfork with long tines',
  'wooden-shovel': 'a medieval wooden shovel with an iron-shod blade',
  'wooden-stool': 'a three-legged wooden milking stool',
  'wooden-bench': 'a plain wooden bench with plank legs',
}

function prompt(id: string, title: string): string {
  const subject = HINT[id] ?? title.toLowerCase()
  return [
    'Use your image generation tool to create ONE photographic reference image',
    `of ${subject}, to be used as a 3D modelling reference.`,
    '',
    'Requirements: a single object, three-quarter view from slightly above,',
    'the WHOLE object visible with clear space around it, resting on the',
    'ground, plain dark neutral background, even studio lighting with soft',
    'shadows, sharp focus throughout, historically plausible medieval',
    'construction, no people, no hands, no text, no watermark, no props',
    'other than the object itself.',
    '',
    `Save the image to the current working directory as exactly ${id}.png.`,
    'Do not create any other file. When done, print only the saved path.',
  ].join('\n')
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((a) => !a.startsWith('--'))

const codex = findCodex()
const outDir = join(process.cwd(), 'references')
mkdirSync(outDir, { recursive: true })

const ids = Object.keys(MODEL_META).filter((id) => (only.length === 0 ? true : only.includes(id)))
const todo = ids.filter((id) => force || !existsSync(join(outDir, `${id}.png`)))

console.log(`${todo.length} reference(s) to generate (${ids.length - todo.length} already present)`)

let done = 0
let failed = 0
for (const id of todo) {
  const title = (MODEL_META as Record<string, { title: string }>)[id]!.title
  process.stdout.write(`  ${id} … `)
  try {
    execFileSync(codex, [
      'exec',
      '--skip-git-repo-check',
      '--dangerously-bypass-approvals-and-sandbox',
      prompt(id, title),
    ], { cwd: outDir, stdio: 'pipe', timeout: 10 * 60_000 })
    const ok = existsSync(join(outDir, `${id}.png`))
    console.log(ok ? 'ok' : 'NO FILE')
    if (ok) done += 1
    else failed += 1
  } catch (error) {
    console.log(`FAILED — ${(error as Error).message.split('\n')[0]}`)
    failed += 1
  }
}

console.log(`\n${done} generated · ${failed} failed · references/`)
