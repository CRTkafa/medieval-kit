/**
 * Kitin tamamını GLB dosyalarına aktarır.
 *
 * `bun scripts/export-glb.ts` → glb/ altında her model için bir dosya.
 * `bun scripts/export-glb.ts --one wooden-chest --out /tmp`
 *
 * Neden CLI: vibe3d'nin inceleyicisi tek modeli tarayıcıdan indiriyor. Kiti
 * gerçekten kullanmak isteyen biri yirmi modeli tek tek indirmek istemez —
 * Blender'a, Godot'ya ya da Unity'ye götürmek için tek komut lazım.
 *
 * Ayrıca bu betik dışa aktarımın DOĞRULAMASI: tarayıcı açmadan, her modelin
 * gerçekten geçerli bir GLB ürettiğini burada görebiliyoruz.
 */
import { mkdir, writeFile } from 'node:fs/promises'

/**
 * GLTFExporter ikili çıktıyı `FileReader` üzerinden topluyor ve bu API
 * tarayıcıya ait — bun'da tanımlı değil. Tek ihtiyaç duyulan yolu burada
 * karşılıyoruz.
 *
 * Doldurma İMPORTLARDAN ÖNCE kurulmalı: `@/glb.ts` modülü GLTFExporter'ı
 * yüklüyor ve o da yüklenirken globali görmek istiyor. Bu yüzden aşağıdaki iki
 * import statik değil dinamik.
 */
class BunFileReader {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null

  readAsArrayBuffer(blob: Blob): void {
    // `onloadend` bu çağrıdan SONRA atanıyor, dolayısıyla geri çağrı bir
    // sonraki mikro göreve ertelenmek zorunda. Senkron çağırmak onu asla
    // tetiklenmemiş gibi gösterirdi.
    void blob.arrayBuffer().then(
      (buffer) => { this.result = buffer; this.onloadend?.() },
      (error) => { this.onerror?.(error) },
    )
  }
}

const globals = globalThis as { FileReader?: unknown }
globals.FileReader ??= BunFileReader

const { CATALOG } = await import('@/catalog.ts')
const { exportGlb } = await import('@/glb.ts')

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}

const outDir = flag('out') ?? 'glb'
const one = flag('one')
await mkdir(outDir, { recursive: true })

const ids = one ? [one] : Object.keys(CATALOG)
let total = 0

for (const id of ids) {
  const entry = CATALOG[id]
  if (!entry) throw new Error(`katalogda yok: ${id}`)
  const built = entry.build()
  const buffer = await exportGlb(built.root, {
    name: id,
    extras: { vibe3d: { model: entry.address } },
  })
  built.dispose()

  // GLB başlığını burada doğruluyoruz: sessizce bozuk dosya yazmaktansa
  // patlamak iyi. Sihirli sayı 'glTF', sonra sürüm, sonra toplam uzunluk.
  const header = new DataView(buffer)
  const magic = header.getUint32(0, true)
  if (magic !== 0x46546c67) throw new Error(`${id}: GLB sihirli sayısı yanlış`)
  if (header.getUint32(4, true) !== 2) throw new Error(`${id}: glTF sürümü 2 değil`)
  if (header.getUint32(8, true) !== buffer.byteLength) {
    throw new Error(`${id}: başlıktaki uzunluk dosya boyutuyla uyuşmuyor`)
  }

  await writeFile(`${outDir}/${id}.glb`, new Uint8Array(buffer))
  total += buffer.byteLength
  console.log(`  ${id.padEnd(20)} ${(buffer.byteLength / 1024).toFixed(1)} KB`)
}

console.log(`\n${ids.length} model → ${outDir}/ · toplam ${(total / 1024).toFixed(1)} KB`)
