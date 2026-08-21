import { Group, Mesh, type BufferGeometry, type Material } from 'three'

import type { ConfigureResult, MaterialBindings, ModelInstance, PartHandle } from '@vibe3d/model.ts'
import { ResourceScope } from '@vibe3d/ownership.ts'

import type { Vec3 } from './geometry.ts'
import { mottleGeometry } from './geometry.ts'
import { bakeOcclusion, type OcclusionOptions } from './occlusion.ts'
import { createPart, type PartSlot } from './parts.ts'
import { createRandom } from './random.ts'
import { createMedievalMaterials, type MedievalSlot, type SlotMaterial } from './materials.ts'

/**
 * Kit modeli iskelesi.
 *
 * Her model aynı sözleşmeyi kurmak zorunda: kaynak sahipliği, materyal
 * çözümleme ve override, sabit anchor + değiştirilebilir content, kimliği
 * bozmayan configure(), idempotent dispose(). Bunu her modelde elle yazmak hem
 * ~80 satır tekrar hem de her tekrarda hata yapma şansı demek — nitekim
 * anchor/content ayrımını ilk üç modelde birden yanlış yapmıştım.
 *
 * Buradan sonra model yazmak sadece geometri üretmek: `build` bir parça adı →
 * geometri eşlemesi döndürür, gerisini bu fonksiyon halleder.
 */

/** Bir parçanın tek materyal yuvası kullanan gövdesi. */
export interface PartBody<S extends string> {
  readonly slot: S
  readonly geometry: BufferGeometry
}

export interface BuiltPart<S extends string> extends PartBody<S> {
  /**
   * Aynı parçaya ait, BAŞKA yuva kullanan ek gövdeler.
   *
   * Parçalar root'un kardeş çocukları, yani biri hareket ettiğinde diğerleri
   * onu takip edemez. Sandığın kapağı hem meşe tahta hem demir kayış hem de
   * kilidin kancasıdır ve üçü birlikte dönmek ZORUNDA — ayrı parça olsalardı
   * kapak açılırken kayışlar havada asılı kalırdı.
   *
   * Yani bu alan "bir parça = bir mesh" varsayımını değil, "bir parça = bir
   * anlam" ilkesini koruyor. Anlam bölünmüyor, sadece materyal bölünüyor.
   */
  readonly extras?: readonly PartBody<S>[]
  /**
   * Parçanın kendi dönme merkezi (model uzayında).
   *
   * Verildiğinde anchor buraya konumlanır ve geometrinin BU NOKTAYA GÖRE
   * yazılmış olduğu varsayılır. Sandık kapağının menteşe etrafında dönebilmesi
   * için gereken tek şey bu: kapak geometrisi menteşe orijininde üretilir,
   * anchor menteşeye taşınır, `anchor.rotation.x` artık kapağı açar.
   *
   * Tüketicinin anchor'a taktığı nesneler de bu dönüşe katılır — kapağın
   * üstüne konan bir mum kapakla birlikte kalkar. Doğru davranış bu.
   */
  readonly origin?: Vec3
}

export interface BuildContext<C, S extends MedievalSlot> {
  readonly config: Readonly<C>
  /** Tohuma bağlı deterministik rastgelelik. Her rebuild'de baştan başlar. */
  readonly random: () => number
  /** Yuvanın geçerli materyali (override varsa o). */
  resolve(slot: S): Material
  /** Yuvanın varsayılan materyali — override edilmiş olsa bile. */
  readonly defaults: Pick<SlotMaterial, S>
}

/**
 * Eylemlere ve `update`'e verilen çalışma zamanı bağlamı.
 *
 * Geometriye değil PARÇALARA erişim veriyor: bir eylem yeniden inşa
 * tetiklememeli, sadece sahne grafiğinde bir şey oynatmalı. Kapağı açmak
 * modelin kimliğini değiştirmez, dolayısıyla `configure()` işi değildir.
 */
export interface RuntimeContext<C, P extends string> {
  readonly parts: Record<P, PartHandle<Group>>
  getConfig(): Readonly<C>
}

export interface KitModelOptions<
  C extends { seed: number },
  S extends MedievalSlot,
  P extends string,
  A extends object = Record<string, never>,
> {
  /** Registry item adı; mesh isimlerinde ve userData'da kullanılır. */
  readonly id: string
  readonly defaults: C
  readonly slots: readonly S[]
  /** Parça adı → geometri. `undefined` dönen parça o yapılandırmada yok demektir. */
  build(context: BuildContext<C, S>): Record<P, BuiltPart<S> | undefined>
  /**
   * Vertex renklerine pişirilecek ortam kapanması. `false` kapatır.
   *
   * Bütün parçalar BİRLİKTE değerlendirilir: bir tahtanın koyulaştığı yer
   * komşu direğin yüzeyidir, kendi yüzeyi değil.
   */
  readonly occlusion?: OcclusionOptions | false
  /**
   * Vertex renklerine işlenen yüzey alacası. `false` kapatır.
   *
   * Miktar YUVAYA göre ölçekleniyor (aşağıdaki tabloya bakın): cilalanmış
   * çelik alacalı değildir, saman fena hâlde alacalıdır. Modelin ayrıca bir
   * şey yapması gerekmiyor.
   */
  readonly mottle?: { readonly amount?: number; readonly cell?: number } | false
  /**
   * Modelin tipli eylemleri. Bir kez, ilk inşadan sonra kurulur — dolayısıyla
   * kapanışta tutulan durum (kapak açık mı, alev fazı ne) rebuild'i atlatır.
   */
  actions?(context: RuntimeContext<C, P>): A
  /** Kare başına çağrılır. Tüketici çağırmazsa model tamamen statik kalır. */
  update?(deltaSeconds: number, context: RuntimeContext<C, P>): void
}

/**
 * Yuva başına alaca çarpanı.
 *
 * Kural malzemenin fiziğinden geliyor: bir yüzey ne kadar cilalıysa o kadar
 * TEK RENK olur, çünkü göze giden ışık yüzeyin kendi pigmentinden değil
 * yansımadan gelir. Saman ve bezde tam tersi geçerli.
 *
 * Bunu yuvaya bağlamak, her modelde ayrı ayrı ayarlamaktan iyi: kit içinde
 * aynı malzeme her yerde aynı görünüyor.
 */
const MOTTLE_BY_SLOT: Readonly<Record<MedievalSlot, number>> = {
  straw: 1.35,
  cloth: 1.15,
  oak: 1,
  char: 0.85,
  leather: 0.7,
  iron: 0.5,
  brass: 0.35,
  steel: 0.22,
  glass: 0.15,
  ember: 0,   // alev alacalanmaz: rengi zaten son renk
}

export function createKitModel<
  C extends { seed: number },
  S extends MedievalSlot,
  P extends string,
  A extends object = Record<string, never>,
>(
  options: KitModelOptions<C, S, P, A>,
  overrides: Partial<C> = {},
): ModelInstance<C, Record<P, PartHandle<Group>>, A> {
  let config: C = { ...options.defaults, ...overrides }

  // Modelin sahip olduğu kaynaklar. Tüketicinin verdiği materyaller buraya
  // girmez, dolayısıyla dispose() onlara dokunmaz.
  const scope = new ResourceScope()
  const defaults = createMedievalMaterials(scope, options.slots)
  const overridesBySlot = new Map<S, Material>()
  const resolve = (slot: S): Material => overridesBySlot.get(slot) ?? defaults[slot]

  const root = new Group()
  root.name = options.id

  const parts = {} as Record<P, PartSlot>
  let owned: BufferGeometry[] = []

  function build(): void {
    for (const geometry of owned) geometry.dispose()
    owned = []

    const produced = options.build({
      config,
      random: createRandom(config.seed),
      resolve,
      defaults,
    })

    const built = Object.values(produced)
      .filter((part): part is BuiltPart<S> => part !== undefined)
    const geometriesOf = (part: BuiltPart<S>): BufferGeometry[] =>
      [part, ...(part.extras ?? [])]
        // Alev ne gölge ALIR ne gölge YAPAR. `ember` aydınlatılmayan bir
        // materyal, yani vertex rengi doğrudan ekrana giden son renk —
        // kapanma onu karartsa alev sönerdi. Kural yuvanın kendisine bağlı,
        // model başına bir bayrağa değil: unutulması mümkün olmasın.
        .filter((body) => body.slot !== 'ember')
        .map((body) => body.geometry)

    if (options.occlusion !== false) {
      // Kapanma MONTAJ uzayında hesaplanmalı: kendi orijininde yazılmış bir
      // kapak, gövdenin yanında değil içinde duruyormuş gibi görünür ve yanlış
      // yerleri karartır. Bu yüzden önce hepsi yerine taşınıyor, pişiriliyor,
      // sonra geri alınıyor — sonuç geometriler yine menteşe-yerel kalıyor.
      const moved = built.filter((part) => part.origin !== undefined)
      for (const part of moved) {
        const [x, y, z] = part.origin!
        for (const geometry of geometriesOf(part)) geometry.translate(x, y, z)
      }
      bakeOcclusion(built.flatMap(geometriesOf), options.occlusion ?? {})
      for (const part of moved) {
        const [x, y, z] = part.origin!
        for (const geometry of geometriesOf(part)) geometry.translate(-x, -y, -z)
      }
    }

    if (options.mottle !== false) {
      const amount = options.mottle?.amount ?? 0.125
      // Leke büyüklüğü modelin ÖLÇEĞİNDEN türetiliyor: sabit bir hücre boyu
      // bira bardağında kocaman leke, çitte görünmez benek verirdi.
      const extent = built.reduce((largest, part) => {
        part.geometry.computeBoundingBox()
        const box = part.geometry.boundingBox
        if (!box) return largest
        return Math.max(largest, box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z)
      }, 0)
      const cell = options.mottle?.cell ?? Math.max(0.012, extent * 0.055)
      for (const part of built) {
        for (const body of [part, ...(part.extras ?? [])]) {
          mottleGeometry(body.geometry, amount * MOTTLE_BY_SLOT[body.slot], { cell, salt: 3 })
        }
      }
    }

    for (const [name, part] of Object.entries(produced) as Array<[P, BuiltPart<S> | undefined]>) {
      // Anchor ilk kurulumda yaratılır ve bir daha ASLA değişmez; sadece
      // içeriği yenilenir. Tüketicinin anchor'a taktığı nesneler bu yüzden
      // rebuild'i atlatır.
      let slot = parts[name]
      if (!slot) {
        slot = createPart(`${options.id}/${name}`)
        parts[name] = slot
        root.add(slot.anchor)
      }
      const target = slot.reset()
      if (!part) continue

      // Konum güncelleniyor ama DÖNÜŞ değil: eylemlerin oynattığı açı
      // yeniden inşadan sağ çıkmalı, yoksa `configure()` her çağrıldığında
      // sandığın kapağı çarpar.
      if (part.origin) slot.anchor.position.set(...part.origin)

      for (const body of [part, ...(part.extras ?? [])]) {
        owned.push(body.geometry)
        const mesh = new Mesh(body.geometry, resolve(body.slot))
        mesh.name = `${options.id}/${name}`
        mesh.userData.vibe3d = {
          model: `@medieval-kit/${options.id}`,
          part: name,
          materialSlot: body.slot,
        }
        target.add(mesh)
      }
    }
  }

  build()

  const runtime: RuntimeContext<C, P> = {
    parts: parts as unknown as Record<P, PartHandle<Group>>,
    getConfig: () => config,
  }
  const actions = (options.actions?.(runtime) ?? {}) as A

  const materials: MaterialBindings = {
    get: (slot) => (options.slots.includes(slot as S) ? resolve(slot as S) : undefined),
    override: (slot, material) => {
      if (!options.slots.includes(slot as S)) return
      overridesBySlot.set(slot as S, material)
      build()
    },
    reset: (slot) => {
      if (!overridesBySlot.delete(slot as S)) return
      build()
    },
  }

  return {
    root,
    parts: parts as unknown as Record<P, PartHandle<Group>>,
    actions,
    materials,
    getConfig: () => config,
    configure: (patch): ConfigureResult => {
      const next = { ...config, ...patch }
      const changed = (Object.keys(next) as Array<keyof C>).some((key) => next[key] !== config[key])
      if (!changed) return { rebuilt: false }
      config = next
      build()
      return { rebuilt: true }
    },
    update: (deltaSeconds) => options.update?.(deltaSeconds, runtime),
    dispose: () => {
      for (const geometry of owned) geometry.dispose()
      owned = []
      for (const part of Object.values(parts) as PartSlot[]) part.reset()
      scope.dispose()
    },
  }
}
