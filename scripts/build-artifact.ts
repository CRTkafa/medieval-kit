/**
 * Reduces the dist-viewer/ output to a single self-contained HTML file.
 *
 * Artifact pages run under a strict CSP: no requests to external hosts. The
 * one exception is Google Fonts. So the JS and CSS have to be inlined.
 *
 * Run:
 *   bunx vite build --config vite.viewer.config.ts
 *   bun scripts/build-artifact.ts
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = join(projectRoot, 'dist-viewer')

// Only the weights actually used. Google Fonts loads every weight lazily;
// asking for weights you do not want just inflates the CSS for nothing.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;700' +
  '&family=IBM+Plex+Mono:wght@400;500;600&display=swap'

/**
 * By pattern, because the built names carry a content hash.
 *
 * They are hashed so the published site can serve them with a year of
 * immutable caching, which is only correct if the name changes when the bytes
 * do. The cost is exactly this: nothing downstream may name them literally.
 */
const built = await readdir(distRoot)
const find = (extension: string): string => {
  const hit = built.find((name) => name.startsWith('viewer-') && name.endsWith(extension))
  if (!hit) throw new Error(`no viewer-*${extension} in dist-viewer — did the vite build run?`)
  return join(distRoot, hit)
}

const css = await readFile(find('.css'), 'utf8')
const js = await readFile(find('.js'), 'utf8')

// A `</script` sequence inside the inlined script would close the HTML parser
// early. This escape does not change the JavaScript meaning.
const safeJs = js.replaceAll('</script', String.raw`<\/script`)

const html = `<title>vibe3d Model Workbench</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${FONTS}" />
<style>
${css}
</style>
<div id="app"></div>
<script type="module">
${safeJs}
</script>
`

const output = join(distRoot, 'artifact.html')
await writeFile(output, html, 'utf8')

const kb = (value: number) => `${(value / 1024).toFixed(0)} KB`
console.log(`dist-viewer/artifact.html written`)
console.log(`  CSS ${kb(css.length)} · JS ${kb(js.length)} · total ${kb(html.length)}`)
