/**
 * Viewer kataloğu.
 *
 * Buradaki her şey `my-registry/meta.ts`'ten türetiliyor — kaydırıcı
 * aralıkları, başlıklar, açıklamalar. Önceden viewer kendi listesini elle
 * tutuyordu ve aynı bilgi iki yerde yaşıyordu; on yedi modelde bu ayrışmaya
 * başlamıştı.
 *
 * Elle kalan tek şey iki eşleme: modelin FABRİKASI (`createModel`) ve varsa
 * EYLEMİ. İkisi de metadata'dan türetilemez, çünkü biri kod diğeri modele
 * özgü bir arayüz.
 */
import { Box3, Group, Vector3 } from 'three/webgpu'
import type { Color, Material, Object3D } from 'three/webgpu'

import { MODEL_META } from '../my-registry/meta.ts'

import { createModel as createGauge } from '@/models/scifi-kit/pressure-gauge/model.ts'
import { createModel as createBarrel } from '@/models/medieval-kit/wooden-barrel/model.ts'
import { createModel as createBucket } from '@/models/medieval-kit/wooden-bucket/model.ts'
import { createModel as createCrate } from '@/models/medieval-kit/wooden-crate/model.ts'
import { createModel as createAnvil } from '@/models/medieval-kit/iron-anvil/model.ts'
import { createModel as createLadder } from '@/models/medieval-kit/wooden-ladder/model.ts'
import { createModel as createFence } from '@/models/medieval-kit/wooden-fence/model.ts'
import { createModel as createStool } from '@/models/medieval-kit/wooden-stool/model.ts'
import { createModel as createHoe } from '@/models/medieval-kit/wooden-hoe/model.ts'
import { createModel as createShovel } from '@/models/medieval-kit/wooden-shovel/model.ts'
import { createModel as createPitchfork } from '@/models/medieval-kit/wooden-pitchfork/model.ts'
import { createModel as createTable } from '@/models/medieval-kit/trestle-table/model.ts'
import { createModel as createWheel } from '@/models/medieval-kit/cart-wheel/model.ts'
import { createModel as createLogPile } from '@/models/medieval-kit/log-pile/model.ts'
import { createModel as createChest } from '@/models/medieval-kit/wooden-chest/model.ts'
import { createModel as createBench } from '@/models/medieval-kit/wooden-bench/model.ts'
import { createModel as createTorch } from '@/models/medieval-kit/pitch-torch/model.ts'
import { createModel as createBale } from '@/models/medieval-kit/hay-bale/model.ts'
import { createModel as createSack } from '@/models/medieval-kit/linen-sack/model.ts'
import { createModel as createBroom } from '@/models/medieval-kit/straw-broom/model.ts'
import { createModel as createTankard } from '@/models/medieval-kit/oak-tankard/model.ts'
import { createModel as createBell } from '@/models/medieval-kit/bronze-bell/model.ts'
import { createModel as createLantern } from '@/models/medieval-kit/iron-lantern/model.ts'
import { createModel as createSign } from '@/models/medieval-kit/tavern-sign/model.ts'
import { createModel as createBook } from '@/models/medieval-kit/leather-book/model.ts'
import { createModel as createPhial } from '@/models/medieval-kit/glass-phial/model.ts'
import { createModel as createPouch } from '@/models/medieval-kit/coin-pouch/model.ts'

export interface ParamSpec {
  readonly key: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
}

export interface ParamGroup {
  readonly specs: readonly ParamSpec[]
  current(): Record<string, number>
  apply(patch: Record<string, number>): void
}

/**
 * Modelin PROTOKOL yüzeyi — inceleyicinin asıl gösterdiği şey.
 *
 * vibe3d'nin kendi inceleyicisi modeli tek bir blok olarak gösteriyor. Oysa
 * protokolün vaadi tam olarak bunun tersi: model semantik PARÇALARDAN oluşuyor
 * ve materyalleri YUVA yuva değiştirilebiliyor. Bunlar görünmezse tüketici
 * neyi satın aldığını bilmiyor demektir.
 */
export interface Inspection {
  readonly parts: readonly string[]
  readonly slots: readonly string[]
  /** Parçayı gizler/gösterir. Anchor üzerinde çalışır, yani rebuild'i atlatır. */
  setPartVisible(part: string, visible: boolean): void
  isPartVisible(part: string): boolean
  /** Yuvanın şu anki rengi (#rrggbb). */
  slotColour(slot: string): string
  /** Yuvayı geçici bir tonla boyar. Varsayılan materyale DOKUNMAZ. */
  tintSlot(slot: string, hex: string): void
  resetSlot(slot: string): void
  isTinted(slot: string): boolean
}

export interface Entry {
  readonly id: string
  readonly namespace: string
  readonly address: string
  readonly who: string
  /** Modeli kurar; kök + isteğe bağlı update/action döndürür. */
  build(): {
    root: Group
    update?: (deltaSeconds: number) => void
    action?: { label(): string; run(): void }
    params?: ParamGroup
    inspect?: Inspection
    dispose(): void
  }
}

/**
 * Viewer'ın bir modelden ihtiyaç duyduğu her şey.
 *
 * Bilerek yapısal: viewer hiçbir modelin config tipini bilmiyor, sadece
 * "sayısal alanları olan bir nesne" görüyor. Anahtarların gerçekten var
 * olduğunu `scripts/verify-model.ts` çalışma zamanında denetliyor — hem de
 * derleyicinin yapabileceğinden daha geniş kapsamda, çünkü `parts` ve
 * `materialSlots` bildirimlerini de aynı anda doğruluyor.
 */
interface KitModel {
  readonly root: Group
  readonly parts: Readonly<Record<string, { readonly anchor: Object3D }>>
  readonly materials: {
    get(slot: string): Material | undefined
    override(slot: string, material: Material): void
    reset(slot: string): void
  }
  getConfig(): Readonly<Record<string, unknown>>
  configure(patch: Record<string, number>): unknown
  update(deltaSeconds: number): void
  dispose(): void
  readonly actions: Readonly<Record<string, unknown>>
}

const as = (make: () => unknown) => make as () => KitModel

/** Registry adı → fabrika. Metadata'dan türetilemeyen ilk şey. */
const FACTORIES: Readonly<Record<string, () => KitModel>> = {
  'wooden-barrel': as(createBarrel),
  'wooden-bucket': as(createBucket),
  'wooden-crate': as(createCrate),
  'wooden-chest': as(createChest),
  'trestle-table': as(createTable),
  'wooden-bench': as(createBench),
  'wooden-stool': as(createStool),
  'iron-anvil': as(createAnvil),
  'cart-wheel': as(createWheel),
  'log-pile': as(createLogPile),
  'hay-bale': as(createBale),
  'pitch-torch': as(createTorch),
  'linen-sack': as(createSack),
  'straw-broom': as(createBroom),
  'oak-tankard': as(createTankard),
  'bronze-bell': as(createBell),
  'iron-lantern': as(createLantern),
  'tavern-sign': as(createSign),
  'leather-book': as(createBook),
  'glass-phial': as(createPhial),
  'coin-pouch': as(createPouch),
  'wooden-ladder': as(createLadder),
  'wooden-fence': as(createFence),
  'wooden-hoe': as(createHoe),
  'wooden-shovel': as(createShovel),
  'wooden-pitchfork': as(createPitchfork),
}

/**
 * Eylemi olan modeller. Metadata'dan türetilemeyen ikinci şey: her eylemin
 * arayüzü kendine özgü, ortak bir "action" şeması yok — ve olması da istenmez,
 * çünkü `setOpen(boolean)` ile `setLit(boolean)` aynı şey değil.
 */
const ACTIONS: Readonly<Record<string, (model: KitModel) => { label(): string; run(): void }>> = {
  'wooden-chest': (model) => {
    const chest = model.actions as { isOpen(): boolean; toggle(): boolean }
    return {
      label: () => (chest.isOpen() ? 'Kapağı kapat' : 'Kapağı aç'),
      run: () => { chest.toggle() },
    }
  },
  'pitch-torch': (model) => {
    const torch = model.actions as { isLit(): boolean; setLit(lit: boolean): void }
    return {
      label: () => (torch.isLit() ? 'Söndür' : 'Yak'),
      run: () => { torch.setLit(!torch.isLit()) },
    }
  },
  'iron-lantern': (model) => {
    const lantern = model.actions as { isLit(): boolean; setLit(lit: boolean): void }
    return {
      label: () => (lantern.isLit() ? 'Söndür' : 'Yak'),
      run: () => { lantern.setLit(!lantern.isLit()) },
    }
  },
  'bronze-bell': (model) => {
    const bell = model.actions as { ring(): void; strikes(): number }
    return {
      // Etiket vuruş sayacını gösteriyor: modelin sesi yok, ama tüketicinin
      // ses çalmak için okuyacağı sinyalin gerçekten çalıştığı böyle görünüyor.
      label: () => `Çal${bell.strikes() > 0 ? ` · ${bell.strikes()} vuruş` : ''}`,
      run: () => { bell.ring() },
    }
  },
  'tavern-sign': (model) => {
    const sign = model.actions as { push(strength?: number): void }
    return { label: () => 'İt', run: () => { sign.push() } }
  },
}

function entryFor(id: string): Entry {
  const meta = MODEL_META[id]
  if (!meta) throw new Error(`${id} için MODEL_META girdisi yok`)
  const factory = FACTORIES[id]
  if (!factory) throw new Error(`${id} için fabrika kaydı yok`)

  const specs: ParamSpec[] = Object.entries(meta.controls).map(([key, control]) => ({
    key,
    label: control.label,
    min: control.min,
    max: control.max,
    step: control.step,
    ...(control.unit === undefined ? {} : { unit: control.unit }),
  }))

  return {
    id,
    namespace: '@medieval-kit',
    address: `@medieval-kit/${id}`,
    who: meta.description,
    build: () => {
      const model = factory()
      const action = ACTIONS[id]?.(model)

      // Yuvaların VARSAYILAN materyalleri, herhangi bir override'dan önce.
      // Ton verirken bunların kopyası alınıyor: override edilmiş bir
      // materyalin kopyasını almak tonları üst üste biriktirirdi.
      const defaults = new Map<string, Material>()
      for (const slot of meta.materialSlots) {
        const material = model.materials.get(slot)
        if (material) defaults.set(slot, material)
      }
      // Inceleyicinin ÜRETTİĞİ materyaller. Model bunları sahiplenmiyor
      // (`dispose()` ödünç materyallere dokunmuyor), dolayısıyla bırakmak
      // bizim işimiz.
      const owned = new Map<string, Material>()

      const inspect: Inspection = {
        parts: meta.parts,
        slots: meta.materialSlots,
        setPartVisible: (part, visible) => {
          const handle = model.parts[part]
          if (handle) handle.anchor.visible = visible
        },
        isPartVisible: (part) => model.parts[part]?.anchor.visible ?? false,
        slotColour: (slot) => {
          const material = model.materials.get(slot) as { color?: Color } | undefined
          return material?.color ? `#${material.color.getHexString()}` : '#ffffff'
        },
        tintSlot: (slot, hex) => {
          const base = defaults.get(slot)
          if (!base) return
          // Materyalin `color`'ı vertex rengiyle ÇARPILIYOR. Yani ton vermek
          // modelin kendi varyasyonunu silmiyor, üstüne biniyor — kitin bütün
          // renk bilgisi geometride olduğu için renk yapılandırması protokole
          // yeni bir alan eklemeden zaten mümkün.
          const tinted = base.clone()
          tinted.name = `${base.name} · viewer tint`
          ;(tinted as unknown as { color?: Color }).color?.set(hex)
          model.materials.override(slot, tinted)
          owned.get(slot)?.dispose()
          owned.set(slot, tinted)
        },
        resetSlot: (slot) => {
          model.materials.reset(slot)
          owned.get(slot)?.dispose()
          owned.delete(slot)
        },
        isTinted: (slot) => owned.has(slot),
      }

      return {
        root: model.root,
        update: (dt) => { model.update(dt) },
        ...(action ? { action } : {}),
        params: {
          specs,
          current: () => model.getConfig() as Record<string, number>,
          apply: (patch) => { model.configure(patch) },
        },
        inspect,
        dispose: () => {
          model.dispose()
          for (const material of owned.values()) material.dispose()
          owned.clear()
        },
      }
    },
  }
}

/** Kitin sırası: sahne kurarken hangisine önce uzanılacağı düşünülerek. */
const MEDIEVAL_ORDER = [
  'wooden-chest', 'wooden-barrel', 'wooden-crate', 'wooden-bucket',
  'trestle-table', 'wooden-bench', 'wooden-stool',
  'pitch-torch', 'iron-lantern', 'iron-anvil', 'cart-wheel',
  'log-pile', 'hay-bale', 'linen-sack',
  'oak-tankard', 'straw-broom', 'bronze-bell', 'tavern-sign',
  'leather-book', 'glass-phial', 'coin-pouch',
  'wooden-ladder', 'wooden-fence',
  'wooden-hoe', 'wooden-shovel', 'wooden-pitchfork',
] as const

// Sıra listesi ile fabrika listesi ayrışmasın: biri eklenip diğeri unutulursa
// model sessizce viewer'dan kaybolurdu.
const missing = Object.keys(FACTORIES).filter((id) => !MEDIEVAL_ORDER.includes(id as never))
if (missing.length > 0) throw new Error(`sıralamada eksik model: ${missing.join(', ')}`)


/**
 * Kitin TAMAMI tek sahnede.
 *
 * vibe3d'nin inceleyicisi tek seferde tek model gösteriyor ve bu, bir MODEL
 * için doğru. Ama bir KİT için sorulan soru başka: "bunlar birbirine ait mi?"
 * Ölçek tutarsızlığı, ton kayması ve stil kopması ancak modeller yan yana
 * konduğunda görünüyor — tek tek bakarken hepsi iyi duruyor.
 *
 * Bu görünüm o soruyu cevaplıyor. Aynı zamanda kitin ne olduğunu tek bakışta
 * gösteren şey, yani hem bir doğrulama aracı hem bir vitrin.
 *
 * Yerleşim raf paketlemesi: modeller sırayla +X boyunca diziliyor, satır hedef
 * genişliği aşınca +Z'ye iniliyor. Her model KENDİ ayak izine göre yer alıyor,
 * dolayısıyla ince bir alet geniş bir masa kadar yer kaplamıyor.
 */
function kitEntry(): Entry {
  return {
    id: 'kit',
    namespace: '@medieval-kit',
    address: '@medieval-kit',
    who: `kitin tamamı · ${MEDIEVAL_ORDER.length} model tek sahnede · ölçek ve ton tutarlılığı buradan görünür`,
    build: () => {
      const root = new Group()
      root.name = 'medieval-kit'
      const models = MEDIEVAL_ORDER.map((id) => ({ id, model: FACTORIES[id]!() }))

      // Sıra: YÜKSEKTEN alçağa. İlk yerleştirilen satır en ARKADA kalıyor
      // (küçük Z), dolayısıyla uzun parçalar geriye, küçük proplar öne
      // düşüyor ve kit bir tezgâh gibi okunuyor. Ters sırada merdiven ve çit
      // öne gelip arkadaki her şeyi kapatıyordu.
      const placed = models.map(({ id, model }) => {
        const box = new Box3().setFromObject(model.root)
        return { id, model, box, size: box.getSize(new Vector3()) }
      })
      placed.sort((a, b) => b.size.y - a.size.y)

      const gap = 0.42
      const rowWidth = 5.6
      let cursorX = 0
      let cursorZ = 0
      let rowDepth = 0

      for (const item of placed) {
        if (cursorX > 0 && cursorX + item.size.x > rowWidth) {
          cursorX = 0
          cursorZ += rowDepth + gap
          rowDepth = 0
        }
        const centre = item.box.getCenter(new Vector3())
        // Modeli hücresinin ortasına ve YERE oturt: kitler ancak ortak bir
        // zemin düzlemi paylaşırsa karşılaştırılabilir.
        item.model.root.position.set(
          cursorX + item.size.x / 2 - centre.x,
          -item.box.min.y,
          cursorZ + item.size.z / 2 - centre.z,
        )
        root.add(item.model.root)
        cursorX += item.size.x + gap
        rowDepth = Math.max(rowDepth, item.size.z)
      }

      // Bütün kiti ORİJİNE ortala, yoksa kamera çerçevelemesi bir köşeye bakar.
      const whole = new Box3().setFromObject(root)
      const middle = whole.getCenter(new Vector3())
      for (const item of placed) {
        item.model.root.position.x -= middle.x
        item.model.root.position.z -= middle.z
      }

      // Yuvaların birleşimi: bir yuvayı boyamak onu KULLANAN her modeli
      // etkiliyor. Kitin tonunu tek hamlede değiştirmek tam olarak bu.
      const slots = [...new Set(MEDIEVAL_ORDER.flatMap((id) => MODEL_META[id]!.materialSlots))]
      const owned = new Map<string, Material[]>()
      const withSlot = (slot: string) =>
        placed.filter(({ id }) => MODEL_META[id]!.materialSlots.includes(slot))

      const inspect: Inspection = {
        parts: [],
        slots,
        setPartVisible: () => undefined,
        isPartVisible: () => true,
        slotColour: (slot) => {
          const first = withSlot(slot)[0]
          const material = first?.model.materials.get(slot) as { color?: Color } | undefined
          return material?.color ? `#${material.color.getHexString()}` : '#ffffff'
        },
        tintSlot: (slot, hex) => {
          for (const material of owned.get(slot) ?? []) material.dispose()
          const created: Material[] = []
          for (const { model } of withSlot(slot)) {
            const base = model.materials.get(slot)
            if (!base) continue
            const tinted = base.clone()
            tinted.name = `${base.name} · kit tint`
            ;(tinted as unknown as { color?: Color }).color?.set(hex)
            model.materials.override(slot, tinted)
            created.push(tinted)
          }
          owned.set(slot, created)
        },
        resetSlot: (slot) => {
          for (const { model } of withSlot(slot)) model.materials.reset(slot)
          for (const material of owned.get(slot) ?? []) material.dispose()
          owned.delete(slot)
        },
        isTinted: (slot) => owned.has(slot),
      }

      return {
        root,
        update: (dt) => { for (const { model } of placed) model.update(dt) },
        action: {
          label: () => 'Hepsini oynat',
          run: () => {
            // Eylemi olan her modeli birden tetikliyor: kitin hareketli
            // parçalarının hepsini aynı anda görmek, tek tek bakmaktan çok
            // daha hızlı bir denetim.
            for (const { id, model } of placed) ACTIONS[id]?.(model).run()
          },
        },
        inspect,
        dispose: () => {
          for (const { model } of placed) model.dispose()
          for (const list of owned.values()) for (const material of list) material.dispose()
          owned.clear()
        },
      }
    },
  }
}

export const REGISTRIES = [
  {
    namespace: '@scifi-kit',
    scheme: 'npm:',
    rest: '@scifi-kit/registry',
    entries: ['pressure-gauge'] as readonly string[],
  },
  {
    namespace: '@medieval-kit',
    scheme: 'file:',
    rest: 'my-registry/dist/registry.json',
    // 'kit' başta: inceleyiciyi açan kişinin ilk gördüğü şey kitin tamamı.
    entries: ['kit', ...MEDIEVAL_ORDER] as readonly string[],
  },
] as const

export const CATALOG: Record<string, Entry> = {
  'pressure-gauge': {
    id: 'pressure-gauge',
    namespace: '@scifi-kit',
    address: '@scifi-kit/pressure-gauge',
    who: 'vibe3d ekibi yazdı · <b>npm</b>\'den kuruldu · 539 satır TypeScript',
    build: () => {
      const gauge = createGauge()
      return {
        root: gauge.root,
        update: gauge.update,
        action: { label: () => 'Basınç testi', run: () => gauge.triggerPressureTest() },
        dispose: () => gauge.dispose(),
      }
    },
  },
  kit: kitEntry(),
  ...Object.fromEntries(MEDIEVAL_ORDER.map((id) => [id, entryFor(id)])),
}
