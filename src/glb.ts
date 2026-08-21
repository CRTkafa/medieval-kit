/**
 * GLB dışa aktarımı.
 *
 * vibe3d'nin kendi inceleyicisinde olup bizde olmayan tek özellik buydu.
 * Burada iki yerden kullanılabilecek şekilde duruyor: viewer'daki "GLB indir"
 * düğmesi ve `scripts/export-glb.ts` toplu dışa aktarımı. İkincisi onlarda yok
 * ve asıl işe yarayan o — kiti Blender'a ya da bir oyun motoruna tek komutla
 * götürüyor.
 *
 * Kitin renk bilgisi tamamen VERTEX COLOR'da ve glTF bunu COLOR_0 olarak
 * taşıyor, baseColorFactor beyaz kalıyor. Yani dosyada hiç doku yok; modelin
 * bütün kimliği tek bir attribute'la seyahat ediyor. `scripts/verify-glb.ts`
 * bunu her modelde dışa aktarıp GERİ OKUYARAK doğruluyor.
 *
 * Bir şeyin BURADA OLMAMASI da kayda değer. Materyalleri dışa aktarım için
 * klasik eşdeğerlerine çevirmeye çalışan bir katman yazmıştım: `three/webgpu`
 * düğüm materyalleri kullanıyoruz ve GLTFExporter'ın onları tanımayıp sessizce
 * boş materyal yazmasından çekiniyordum. Ölçünce gördüm ki gereksiz —
 * `MeshStandardNodeMaterial` da `isMeshStandardMaterial` bayrağını taşıyor,
 * yani dışa aktarıcı onu zaten tanıyor. Kodu sildim; hiç tetiklenmeyen bir
 * güvenlik katmanı, güvenlik sağlamadığı gibi okuyanı da yanıltıyor.
 *
 * TaşınMAYAN tek şey şader: scifi-kit'in göstergesindeki aşınma bir TSL düğüm
 * grafiği, yani kod. glTF kod taşımaz. Bu bir eksiklik değil, vertex color ile
 * şader tabanlı yüzey arasındaki gerçek farkın kendisi.
 */
import { Mesh, type Object3D } from 'three/webgpu'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

export interface GlbOptions {
  /** Dosyaya gömülecek ad. */
  readonly name?: string
  /** Mesh'lerin userData'sına eklenecek bilgi — model adresi, sürüm vb. */
  readonly extras?: Record<string, unknown>
}

/**
 * Sahne dalını GLB (ikili glTF) olarak paketler.
 *
 * Kaynak ağaca DOKUNMUYOR: userData eklemek için bir kopya üzerinde çalışıyor.
 * `Object3D.clone` geometri ve materyalleri PAYLAŞIYOR, yani kopya ucuz ve
 * bırakılması gereken bir şey üretmiyor — ama modelin kendi userData'sını
 * kirletmiyor, ki model hâlâ sahnede canlı olabilir.
 */
export async function exportGlb(root: Object3D, options: GlbOptions = {}): Promise<ArrayBuffer> {
  const clone = root.clone(true)
  clone.name = options.name ?? root.name

  if (options.extras) {
    clone.traverse((object) => {
      if (object instanceof Mesh) object.userData = { ...object.userData, ...options.extras }
    })
  }

  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(clone, {
    binary: true,
    // userData'daki `vibe3d` bloğu dosyaya `extras` olarak gitsin: modelin
    // hangi registry adresinden geldiği dosyanın içinde kalsın istiyoruz.
    includeCustomExtensions: true,
    // Kit zaten metre biriminde ve Y-up, yani glTF'in kendi sözleşmesiyle
    // aynı — dönüştürme gerekmiyor.
    trs: false,
  })
  if (!(result instanceof ArrayBuffer)) throw new Error('GLTFExporter ikili çıktı vermedi')
  return result
}
