/**
 * Checks one contemporary-props model, straight from the folder it is written
 * in.
 *
 *   bun contemporary-props/check.ts ceramic-vase
 *   bun contemporary-props/check.ts ceramic-vase --size 900 --angles 6
 *
 * The work is in `scripts/check-model.ts`, which does the same job for either
 * kit; this only supplies the registry name so the short form keeps working.
 * The two copies had already started to drift apart, and a checker that differs
 * between kits is a checker that says different things about the same fault.
 */
const args = process.argv.slice(2)
process.argv = [process.argv[0]!, process.argv[1]!, 'contemporary-props', ...args]

await import('../scripts/check-model.ts')

export {}
