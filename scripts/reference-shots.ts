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
 * It serves either kit. The two keep their metadata in different places, which
 * is the only thing that made this medieval-only before: `my-registry` has one
 * `meta.ts` holding every entry, `contemporary-props` has a `meta.json` beside
 * each model. Both carry a `title`, so the difference is where to read it from
 * and nothing else. What DOES differ per kit is the last clause of the prompt:
 * asking for "historically plausible medieval construction" while photographing
 * a fire extinguisher produces a fire extinguisher with rivets and a leather
 * strap.
 *
 * Output goes to `references/`, one corpus for both kits, which is safe because
 * the ids are unique across them. It is NOT tracked: tens of megabytes that
 * belong to the studio, not to the registry consumers clone.
 *
 *   bun scripts/reference-shots.ts my-registry                → only the missing
 *   bun scripts/reference-shots.ts contemporary-props --force → all of them
 *   bun scripts/reference-shots.ts contemporary-props pepper-mill coffee-mug
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
 * What the objects are, per registry.
 *
 * Not decoration: it is the clause that keeps the generator in the right
 * century. Without it the medieval kit gets modern reproductions and the
 * contemporary one gets everything upholstered in leather.
 */
const STYLE: Record<string, string> = {
  'my-registry':
    'historically plausible medieval construction',
  'contemporary-props':
    'an ordinary present-day object of the kind in everyday use now, '
    + 'plain and unstyled, no retro or vintage treatment',
}

/**
 * Extra wording for models whose name alone would send the generator somewhere
 * useless. "Phial" produces perfume bottles; "sack" produces modern hessian;
 * "pepper mill" without the crown and the collar produces a wooden bottle.
 *
 * A hint is not a free description: it decides what the reference is, and the
 * reference decides what the model becomes. This one said "a tall WOODEN table
 * pepper mill, a TURNED WOODEN body" and got back a handsome traditional
 * baluster, and the model was then rebuilt to match it and had its flute band
 * deleted for not appearing in the photograph. The flute band is the reason
 * that model is fourth in the build order at all: the catalogue's own row for
 * it reads "the flute grip is the first radial cut". Read the catalogue row
 * before writing a hint, and do not put a material in one unless the model's
 * declared slots demand it. When they DO, name it: the mill declares `wood`
 * and `stainless`, the hint left the body open, the generator returned a black
 * anodised one, and the critic then spent every round of the loop reporting a
 * finish the kit had never claimed. A score cannot move under a mismatch of
 * that size, which is what a plateau is for saying.
 */
const HINT: Record<string, string> = {
  // --- medieval ---
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

  // --- contemporary, built ---
  'ceramic-vase': 'a plain glazed ceramic vase, empty, with no flowers in it',
  'coffee-mug': 'a plain glazed stoneware coffee mug with a loop handle, empty, seen so the handle is to one side',
  'wine-glass': 'an empty stemmed wine glass in clear glass',
  'pepper-mill': 'a contemporary table pepper mill of current design: a straight cylindrical body in pale natural wood, a flat wooden top with a small knurled steel knob, a polished steel grinder collar at the base, and a band of VERTICAL machined flutes cut around the middle of the body for grip. The flutes run up and down, not around',
  'stockpot': 'a stainless steel lidded stockpot with two riveted side handles',
  'traffic-cone': 'an orange PVC traffic cone with a white reflective band, on its square base',

  // --- contemporary, next in the build order ---
  'street-bollard': 'a black cast iron street bollard set into a pavement',
  'gas-cylinder': 'an industrial gas cylinder with a valve handwheel and a caged guard',
  'fire-extinguisher': 'a red fire extinguisher with a squeeze lever, hose and pressure gauge',
  'pedestal-basin': 'a white ceramic pedestal wash basin',
  'jersey-barrier': 'a single concrete jersey traffic barrier section',
  'picnic-table': 'a wooden picnic table with bench seats attached to an A-frame',
  // "cast side frames" is the catalogue's own word for this row, so the metal
  // is the catalogue's call rather than the hint's.
  'park-bench': 'a municipal park bench: horizontal timber slats on two cast iron end frames, seen from the front and side',
}

/**
 * Title per model id, from wherever the kit keeps it.
 *
 * `my-registry` is a TypeScript record and has to be imported; the others keep
 * a `meta.json` beside each model, which is the shape the newer kit uses and
 * the one anything after it will.
 */
async function titles(registry: string): Promise<Record<string, string>> {
  if (registry === 'my-registry') {
    const { MODEL_META } = await import('../my-registry/meta.ts')
    return Object.fromEntries(
      Object.entries(MODEL_META as Record<string, { title: string }>)
        .map(([id, meta]) => [id, meta.title]),
    )
  }
  const dir = join(process.cwd(), registry, 'models')
  if (!existsSync(dir)) throw new Error(`no such registry: ${registry}/models`)
  const out: Record<string, string> = {}
  for (const id of readdirSync(dir)) {
    // `core` is the shared vocabulary, not a model.
    if (id === 'core') continue
    const meta = join(dir, id, 'meta.json')
    if (!existsSync(meta)) continue
    out[id] = (JSON.parse(readFileSync(meta, 'utf8')) as { title?: string }).title ?? id
  }
  return out
}

function prompt(id: string, title: string, style: string): string {
  const subject = HINT[id] ?? title.toLowerCase()
  return [
    'Use your image generation tool to create ONE photographic reference image',
    `of ${subject}, to be used as a 3D modelling reference.`,
    '',
    'Requirements: a single object, three-quarter view from slightly above,',
    'the WHOLE object visible with clear space around it, resting on the',
    'ground, plain dark neutral background, even studio lighting with soft',
    `shadows, sharp focus throughout, ${style}, no people, no hands, no text,`,
    'no watermark, no props other than the object itself.',
    '',
    `Save the image to the current working directory as exactly ${id}.png.`,
    'Do not create any other file. When done, print only the saved path.',
  ].join('\n')
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const positional = args.filter((a) => !a.startsWith('--'))
const registry = positional[0]
const only = positional.slice(1)

if (!registry || !(registry in STYLE)) {
  console.error(
    `Usage: bun scripts/reference-shots.ts <${Object.keys(STYLE).join('|')}> [id ...] [--force]`,
  )
  process.exit(1)
}

const codex = findCodex()
const outDir = join(process.cwd(), 'references')
mkdirSync(outDir, { recursive: true })

const known = await titles(registry)

/**
 * An id that is not a model YET is the most important case, not an error.
 *
 * The whole argument for this script is that a reference answers "is this
 * right" and a render cannot, which means the reference has to exist BEFORE
 * the model does. Requiring the id to be in the registry made it impossible to
 * do the one thing it is for: shoot row seven and then build row seven. So an
 * unknown id is allowed as long as somebody has written a HINT for it, because
 * a hint is the evidence that a person decided what the object is rather than
 * the generator guessing from a slug.
 */
const ahead = only.filter((id) => !(id in known))
const missingHint = ahead.filter((id) => !(id in HINT))
if (missingHint.length > 0) {
  throw new Error(
    `${missingHint.join(', ')}: not in ${registry} and no HINT. `
    + 'Add one to reference-shots.ts, after reading the catalogue row for it.',
  )
}
const ids = only.length === 0
  ? Object.keys(known)
  : only.map((id) => id)
const titleOf = (id: string): string =>
  known[id] ?? id.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')
if (ahead.length > 0) console.log(`ahead of the registry: ${ahead.join(', ')}`)

const todo = ids.filter((id) => force || !existsSync(join(outDir, `${id}.png`)))
console.log(
  `${registry}: ${todo.length} reference(s) to generate `
  + `(${ids.length - todo.length} already present of ${ids.length})`,
)

let done = 0
let failed = 0
for (const id of todo) {
  process.stdout.write(`  ${id} … `)
  try {
    execFileSync(codex, [
      'exec',
      '--skip-git-repo-check',
      '--dangerously-bypass-approvals-and-sandbox',
      prompt(id, titleOf(id), STYLE[registry]!),
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
