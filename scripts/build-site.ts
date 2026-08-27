/**
 * Builds the published site: the viewer, at a domain root.
 *
 * The viewer build already emits everything a host needs — `viewer.html` plus
 * a `viewer.js` and a `viewer.css` it loads by absolute path, which is correct
 * at the root of a domain and wrong nowhere. What it does not emit is an
 * `index.html`, so a static host serving the directory answers `/` with a 404
 * and the site looks broken while every file on it is fine.
 *
 * So this is a copy, and it is a script rather than a line in `package.json`
 * because there is a decision in it: the site's landing page is the VIEWER,
 * not the demo app. Someone arriving at the address should be able to turn a
 * model over and press play, not read a page about a model they cannot see.
 *
 * `artifact.html` is left beside it. It is the same viewer collapsed into one
 * self-contained file, which is what to hand anyone who wants the thing
 * without a server — a VDS, an email, a USB stick.
 *
 *   bun run site:build     → dist-viewer/, ready for any static host
 */
import { copyFile, stat } from 'node:fs/promises'

const from = 'dist-viewer/viewer.html'
const to = 'dist-viewer/index.html'

await copyFile(from, to)

const sizes = await Promise.all(
  ['index.html', 'viewer.js', 'viewer.css', 'artifact.html'].map(async (name) => {
    const info = await stat(`dist-viewer/${name}`)
    return `${name} ${Math.round(info.size / 1024)} KB`
  }),
)

console.log(`dist-viewer/ ready — ${sizes.join(' · ')}`)
