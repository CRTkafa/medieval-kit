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
import { copyFile, readdir, stat, writeFile } from 'node:fs/promises'

const dist = 'dist-viewer'
await copyFile(`${dist}/viewer.html`, `${dist}/index.html`)

/**
 * Cache rules for the host, written into the output where it looks for them.
 *
 * The two bundles carry a content hash, so their names change whenever their
 * bytes do and a year of immutable caching is exactly right. The HTML must
 * NOT be cached that way: it is what points at the current hash, and a stale
 * copy of it pins a visitor to a build that no longer exists.
 */
await writeFile(`${dist}/_headers`, `/viewer-*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/
  Cache-Control: public, max-age=0, must-revalidate
`, 'utf8')

// Listed rather than named. The bundles are hashed, so writing `viewer.js`
// here would be a lie the moment the bytes change — which is the same mistake
// this script's own first version made, in this very line.
const names = (await readdir(dist)).filter((name) => !name.startsWith('_'))
const sizes = await Promise.all(names.sort().map(async (name) => {
  const info = await stat(`${dist}/${name}`)
  return `${name} ${Math.round(info.size / 1024)} KB`
}))

console.log(`${dist}/ ready — ${sizes.join(' · ')}`)
