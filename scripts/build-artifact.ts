/**
 * dist-viewer/ çıktısını tek dosyalık, kendi kendine yeten bir HTML'e indirger.
 *
 * Artifact sayfaları katı bir CSP altında çalışır: harici host'a istek yok.
 * Tek istisna Google Fonts. Bu yüzden JS ve CSS gömülü olmak zorunda.
 *
 * Çalıştır:
 *   bunx vite build --config vite.viewer.config.ts
 *   bun scripts/build-artifact.ts
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = join(projectRoot, 'dist-viewer')

// Sadece gerçekten kullanılan ağırlıklar. Google Fonts her ağırlığı tembel
// yükler; istemediğiniz ağırlıkları istemek boşuna CSS büyütür.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;700' +
  '&family=IBM+Plex+Mono:wght@400;500;600&display=swap'

const css = await readFile(join(distRoot, 'viewer.css'), 'utf8')
const js = await readFile(join(distRoot, 'viewer.js'), 'utf8')

// Gömülü script içindeki bir `</script` dizisi HTML ayrıştırıcısını erken
// kapatırdı. Bu kaçış JavaScript anlamını değiştirmez.
const safeJs = js.replaceAll('</script', String.raw`<\/script`)

const html = `<title>vibe3d Model Tezgahı</title>
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
console.log(`dist-viewer/artifact.html yazıldı`)
console.log(`  CSS ${kb(css.length)} · JS ${kb(js.length)} · toplam ${kb(html.length)}`)
