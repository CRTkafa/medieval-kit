# vibe3d — çalışma notları

Bu klasördeki her şeyin ne işe yaradığı, vibe3d'nin nasıl çalıştığı ve kendi
asset pack'inizi nasıl üreteceğiniz.

Üst kaynak: <https://github.com/vibe-stack/vibe3d> · Dokümanlar:
<https://vibe-stack.github.io/vibe3d/#/docs> · Lisans: MIT

---

## 1. vibe3d ne DEĞİL, ne

**Değil:** bir 3D model kütüphanesi, bir AI model üreteci, bir motor.

**Ne:** shadcn/ui'ın 3D karşılığı — bir *kaynak dağıtım protokolü*. Model
indirmiyorsunuz; **modeli üreten TypeScript kodunu** kendi projenize kopyalıyor
ve sahipleniyorsunuz. `node_modules` sınırı yok, patch'lemek yok; dosya sizin,
açıp değiştirirsiniz.

Sistem dört katmandan oluşuyor:

| Katman | Paket | Sorumluluk |
| --- | --- | --- |
| Protokol | `@vibe3djs/schema` | `models.json`, `registry.json`, lock şemaları (Zod) |
| Çözümleme | `@vibe3djs/registry` | kaynak sağlayıcılar, bağımlılık grafiği, güvenli kurulum |
| Doğrulama | `@vibe3djs/conformance` | şema + yol güvenliği + hash denetimi |
| Arayüz | `vibe3d` (CLI) | `init`, `add`, `view`, `list`, `diff`, `remove`, `doctor` |

`@scifi-kit` bunların hiçbiri değil — **protokolün ilk referans registry'si**.
Yani sci-fi olması bir tesadüf; platform stil hakkında hiçbir varsayım yapmıyor.

### Adresleme

```
@scifi-kit/pressure-gauge
|          └── registry item (model)
└───────────── registry namespace
```

Namespace **npm paket adı değildir**. Fiziksel kaynağa `models.json` üzerinden
bağlanır:

```json
"registries": {
  "@scifi-kit":   { "source": "npm:@scifi-kit/registry", "version": "latest" },
  "@medieval-kit":{ "source": "file:my-registry/dist/registry.json", "version": "workspace" }
}
```

Bu ayrım sayesinde yayıncı depolamayı değiştirebilir (npm → başka scope → shard'lı
paketler) ve tüketicinin kullandığı adres aynı kalır. Desteklenen kaynaklar:
`npm:`, `file:`, `https://`. (`github:` şemada var ama henüz "planned but not
available yet" hatası veriyor.)

### Güvenlik modeli

CLI, registry npm paketini `node_modules`'a **kurmaz** ve lifecycle script'lerini
**çalıştırmaz**. `pacote` ile tarball'ı geçici bir dizine açar, manifest'i Zod ile
doğrular, mutlak yol / `..` sızmasını reddeder, sadece çözümlenmiş item'ların
bildirdiği dosyaları yazar, sonra geçici dizini siler.

---

## 2. Bu klasörde ne var

```
models.json                      sizin yapılandırmanız (elle düzenlenir)
models.lock.json                 CLI'ın makbuzu (elle düzenlenmez)
index.html · vite.config.ts      oyun alanı uygulaması
src/main.ts                      sahne + renderer + render döngüsü (SİZE ait)
src/lib/vibe3d/                  `init`in kurduğu evrensel sözleşmeler
  model.ts                         ModelInstance, PartHandle, MaterialBindings
  ownership.ts                     ResourceScope (kaynak sahipliği)
  materials.ts                     MaterialSource arayüzü
src/lib/vibe3d/scifi-kit/generator/   @scifi-kit/core — 2.100 satır prosedürel araç
src/viewer.ts · src/viewer.css   model inceleyici (WebGPU, gökyüzü, gölge)
src/catalog.ts                   inceleyicinin kataloğu — meta.ts'ten TÜRETİLİR
src/glb.ts                       GLB dışa aktarımı (viewer ve CLI ortak kullanır)
src/models/scifi-kit/pressure-gauge/  kurulu sci-fi modeli
src/models/medieval-kit/…             kurulu KENDİ modelleriniz (26 model)
my-registry/
  meta.ts                          katalog metadata'sının TEK kaynağı
  build.ts                         registry.json üreticisi
  models/core/                     kitin paylaşılan sözlüğü
  models/<id>/model.ts             modellerin kaynağı
  drafts/                          registry'ye girmeyen taslaklar
scripts/
  verify-model.ts                  tarayıcısız conformance doğrulaması
  verify-glb.ts                    GLB gidiş-dönüş doğrulaması
  zfight.ts                        eş düzlem yüz tespiti
  render.ts                        çevrimdışı yazılım rasterleyici → PNG
  export-glb.ts                    kitin tamamını GLB'ye aktarır
  catalog-table.ts                 REFERENCE.md'deki model tablosunu üretir
  build-artifact.ts                inceleyiciyi tek dosyaya paketler
```

`models.json` ↔ `models.lock.json` ayrımı kasıtlı: birincisi **yapılandırma**
(sizin), ikincisi **kurulum durumu** (CLI'ın). Lock her dosyanın kurulum anındaki
sha256'sını tutar; `vibe3d diff` bununla yerel değişikliklerinizi tespit eder ve
`add`/`update` düzenlediğiniz dosyaların **üzerine yazmaz** (`--overwrite` demedikçe).

### Çalıştırma

```bash
bun run dev                    # oyun alanı — iki registry, tek proje
bun run typecheck              # kurulu kaynak gerçekten derleniyor mu

bun my-registry/build.ts       # registry.json üret
bunx vibe3d add @medieval-kit --overwrite   # kendi kitini kendine kur

bun scripts/verify-model.ts    # geometri, protokol, metadata, eylemler
bun scripts/verify-glb.ts      # dışa aktar → geri oku → karşılaştır
bun scripts/render.ts          # renders/_sheet.png — modellere BAK
bun scripts/export-glb.ts      # glb/ altına kitin tamamı
```

Model üzerinde çalışırken sıra hep aynı: **kaynağı düzenle → derle → kendine
kur → doğrula → render et.** Ortadaki iki adımı atlamak, `src/models/` altındaki
kurulu kopyanın eski kalmasına yol açıyor ve doğrulama eski kodu sınıyor.

> **WebGPU gerekir.** `@scifi-kit` modelleri TSL düğüm materyalleri (`colorNode`,
> `attribute(...)`) kullanıyor, bu yüzden `WebGPURenderer` şart. Kendi
> `@medieval-kit` modeliniz düz `MeshStandardMaterial` kullanıyor — WebGL yeter.

> **`three` vs `three/webgpu` tuzağı.** Bunlar ayrı bundle'lar ve her ikisi de
> çekirdek sınıfların kendi kopyasını içerir. Karıştırırsanız "Multiple instances
> of Three.js" uyarısı alır, `instanceof` kontrolleri iki kopya arasında bozulur.
> `vite.config.ts` içinde `three` → `three/webgpu` takma adıyla çözdük. Regex
> (`/^three$/`) şart; düz string önek eşleşmesi yapıp `three/addons/...` yolunu da
> bozardı.

---

## 3. Modeller nasıl üretiliyor

Kısa cevap: **prosedürel TypeScript**. GLB/FBX indirilmiyor, mesh runtime'da
koddan doğuyor. GLB sadece *çıktı* (dışa aktarım), *girdi* değil.

### 3.1 Boru hattı

`@scifi-kit/core` (`src/lib/vibe3d/scifi-kit/generator/`) beş aşamalı bir hat:

1. **`primitives.ts`** (867 satır) — `prism`, `extrudeProfile`, `filletRing`,
   `flatPlate`, `groove`, `cylinder`. Bunlar Three.js'in kutu/silindirinden farklı:
   köşe pahları (chamfer), teğetsel fileto halkaları ve pah bantları boyunca
   paylaşılan normaller üretiyorlar. "AI ürünü gibi durmayan" hard-surface
   görünümü buradan geliyor.
2. **`profile.ts`** — 2B profil üretimi: `rect`, `octagon`, `stepEdge`,
   `offsetProfile`, `mirrorProfile`. Önce kesit çizilir, sonra extrude edilir.
3. **`materials.ts`** — `MaterialLibrary` + `mountMaterialSource`. Materyaller
   `MAT-03/GRAPHITE-800` gibi semantik kimliklerle alınır, projede override edilebilir.
4. **`wear.ts`** (524 satır) — işin sırrı burada. `bakeOcclusion` ve
   `bakeSurfaceAttributes`, parçalar hâlâ ayrıyken komşuluk ve yüzey kimliğini
   **vertex attribute'larına** (`aMask`, `aColor`, `aSurface`, `aWearDir`, `aPlane`)
   yazar. Sonra `createWearMaterial` tek bir TSL düğüm grafiğiyle boya
   dökülmesi, çizik ve kir üretir. Koddaki yorum niyeti net anlatıyor: fraktal
   gürültü kasıtlı olarak kullanılmamış, çünkü izotropik gürültü yumuşak bulut
   verir ve bulut hasar değil sis gibi okunur.
5. **`batching.ts` + `glb.ts`** — `mergeStaticByMaterial` statik parçaları
   materyal başına tek çizime indirir; `exportStaticGlb` prosedürel aşınmayı
   standart PBR verisine *bake* ederek taşınabilir GLB üretir.

Sıra kritik ve `modeling-rules.md`'de kural 9 olarak yazılı: **kur, bake et,
sonra birleştir.** Komşuluk verisi ancak nesneler ayrıyken türetilebilir.

### 3.2 Bir modelin anatomisi

`src/models/scifi-kit/pressure-gauge/model.ts` (539 satır) tipik bir örnek:

```ts
export function createModel() {
  const { materials, handles, profiles } = acquireMaterials()
  const root = new Group(); root.name = 'pressure-gauge'

  addMount(root, materials); addHousing(root, materials)
  const needlePivot = addFace(root, materials)      // hareketli parça
  addSideIndicator(root, materials); addConnector(root, materials)

  bakeOcclusion(root)                    // 1) komşuluk → attribute
  bakeSurfaceAttributes(root, profiles)
  const wearMaterial = createWearMaterial(...)      // 2) tek TSL materyali

  root.remove(needlePivot)               // 3) hareketli parçayı batch dışına al
  mergeStaticByMaterial(root, ...)       //    statik olanı düzleştir
  root.add(needlePivot)

  return { root, update, triggerPressureTest, dispose }
}
```

Ölçüm sonucu (`bun scripts/verify-model.ts`): **10 mesh, 10.830 üçgen**, 8 materyal,
5.7 × 7.4 × 2.71 m. `update()` tam **bir** düğümü döndürüyor (ibre pivotu).

### 3.3 Runtime sözleşmesi

`src/lib/vibe3d/model.ts` küçük ve kasıtlı olarak öyle:

- **`root` kimliği ömür boyu sabit.** `configure()` topolojiyi yeniden kurabilir
  ama kökü değiştiremez — sahne ebeveynliği, editör seçimi, dış referanslar
  hayatta kalsın diye.
- **Semantik `parts`** — anonim mesh sırasına bağımlılık yok. `anchor` sabit,
  `content` yeniden kurulabilir. Tüketicinin `anchor`'a eklediği ışık/etiket
  rebuild'i atlatır.
- **`materials.get/override/reset`** — çözümleme sırası: örnek override → proje
  override → kit varsayılanı.
- **Sahiplik**: model kendi kaynağını tam bir kez dispose eder, **tüketicinin
  verdiği materyale asla dokunmaz**, `dispose()` idempotenttir.
- **Sahne, renderer, kamera ve render döngüsü SİZE ait.** `src/main.ts`'e bakın.

`configure()` pahalıdır — kullanıcı ayarı içindir, kare başına animasyon için
değil. Sürekli hareket `actions` + `update(dt)` ile yapılır.

### 3.4 Modeller nasıl *yazılıyor* (asıl "generate" kısmı)

Elle. Ama yapılandırılmış bir AI döngüsüyle: **`vibe-model` skill'i**.

```bash
bunx vibe-model          # .agents/skills/vibe-model kurar
```

Döngü:

```
model kaynağı → deterministik preview → bağımsız görsel kritik
      ▲                                        │
      └──────────── en yüksek etkili düzeltme ─┘
```

Kurallar (`.agents/skills/vibe-model/SKILL.md`): kritik eden ajana **sadece**
brief, referans görseli ve mevcut render verilir (kodu görmez). Ajan bir benzerlik
skoru ve **en fazla üç** öncelikli düzeltme döndürür. Sırasıyla siluet ve oranlar,
ana kütleler ve negatif alan, ayırt edici işaretler, materyal/değer okunuşu
puanlanır. **85'te dur**; iki kez plato yaparsa ya da 10 iterasyonu geçerse dur —
plato, temsili ya da referansı değiştirmek gerektiğinin kanıtıdır.

`references/modeling-rules.md` 17 sert kural içeriyor. En pahalı olanlar:

- Pahları algısal role göre bütçele — varsayılan **tek** faset; ikinciyi sadece
  silueti taşıyan kütlelere ver.
- Halka içe doğru inset edildiğinde **sarım yönünün değiştiğini varsay**;
  ilk üçgenin kenar çapraz çarpımını beklenen normalle karşılaştır.
- Pahları etkilenen yarı-boyutun ~%60'ının altında tut.
- Fiziksel özellikleri **dünya biriminde** boyutlandır — pah, dikiş, cıvata,
  boşluk. Bunları host parçanın yüzdesi olarak ölçekleme.
- Uygulanan her katman için boşluk hesapla; bu metre ölçekli kitte en az
  **0.015 birim** ve gerçek kameradan doğrula (z-fighting).

---

## 4. Kendi asset pack'inizi üretmek

**Bu klasörde bunu zaten yaptık.** `my-registry/` çalışan, doğrulanmış bir örnek.

Bir registry, sonuçta **tek bir JSON dosyası**. Bağımlılık gerekmez.

### Adımlar

**1) Kaynağı yaz** — `my-registry/models/<model-id>/model.ts`

Kanonik import'ları kullanın; kurulum sırasında yeniden yazılırlar:

| Yazdığınız | Kurulunca olur |
| --- | --- |
| `@vibe3d/model.ts` | `@/lib/vibe3d/model.ts` |
| `@models/...` | `@/models/...` |

Bu yüzden registry, tüketicinin klasör düzenini varsaymak zorunda kalmaz.

**2) Manifest'i derle** — `my-registry/build.ts`

Her dosya için `{ path, target, content, hash }`. `target` içinde `{models}` ve
`{vibe3d}` yer tutucuları tüketicinin `models.json`'ındaki `paths` ile değişir.
`defaultItem` zorunlu ve var olmalı.

```bash
bun my-registry/build.ts
```

**3) Doğrula** — resmi conformance denetimi

```bash
bunx vibe3d registry validate my-registry/dist/registry.json
# Conformant @medieval-kit · 2 items · 1 files · MIT
```

Şema, bağımlılık kapanışı, güvenli hedef yolları, çift yazım ve hash tazeliği
kontrol edilir.

**4) Bağla ve kur**

```jsonc
// models.json
"@medieval-kit": { "source": "file:my-registry/dist/registry.json", "version": "workspace" }
```

```bash
bunx vibe3d add @medieval-kit/wooden-barrel --dry-run   # önce göster
bunx vibe3d add @medieval-kit/wooden-barrel
```

**5) Yayınla** — `package.json`'a `vibe3d.registry` alanını koyup npm'e gönderin:

```json
{
  "name": "@medieval-kit/registry",
  "keywords": ["vibe3d", "vibe3d-registry", "threejs"],
  "vibe3d": { "registry": "./dist/registry.json" },
  "files": ["dist", "README.md", "LICENSE"]
}
```

Kullanıcılar `models.json`'a `"source": "npm:@medieval-kit/registry"` yazıp aynı
CLI ile kurar. **Kimseden izin almanıza gerek yok** — vibe3d deposuna dokunmadan
kendi registry'nizi yayınlayabilirsiniz. Mimari doküman bunu açık bir hedef olarak
yazıyor.

### Boyut uyarısı

`registry.json` tüm kaynağı gömülü tutar. `@scifi-kit/registry@0.0.1` → **1.8 MB
JSON**, 404 KB tarball. npm tek item için bile tarball'ın tamamını indirir. Mimari
doküman ilerisi için koleksiyon bazlı shard'lamayı öngörüyor
(`@scifi-kit/industrial`, `@scifi-kit/medical`…) — adres aynı kalır, fiziksel
paket değişir.

---

## 5. Lowpoly medieval — evet, sorunsuz

Bu bir varsayım değil: `@medieval-kit` çalışıyor, doğrulandı ve şu anda **26
model + 1 lib** içeriyor. Tablo `bun scripts/catalog-table.ts` ile modellerin
kendisinden üretiliyor — elle yazılmış bir liste ilk eklenen modelde bayatlıyor,
nitekim bir kez bayatlamıştı da.

| Model | Kategori | Üçgen | Parça | Ölçü (m) | Materyal yuvaları | Eylemli |
| --- | --- | ---: | ---: | --- | --- | :-: |
| `wooden-chest` | Furniture | 552 | 4 | 0.86×0.51×0.48 | oak, iron | ✔ |
| `wooden-barrel` | Props | 806 | 3 | 0.82×1.05×0.81 | oak, iron |  |
| `wooden-crate` | Props | 1320 | 3 | 0.69×0.52×0.55 | oak, iron |  |
| `wooden-bucket` | Props | 439 | 4 | 0.31×0.46×0.30 | oak, iron |  |
| `trestle-table` | Furniture | 660 | 3 | 1.91×0.74×0.79 | oak |  |
| `wooden-bench` | Furniture | 168 | 3 | 1.62×0.48×0.30 | oak |  |
| `wooden-stool` | Furniture | 180 | 2 | 0.38×0.43×0.36 | oak |  |
| `pitch-torch` | Lighting | 239 | 3 | 0.10×0.77×0.11 | oak, char, ember | ✔ |
| `iron-lantern` | Lighting | 440 | 4 | 0.15×0.29×0.17 | iron, glass, char, ember | ✔ |
| `iron-anvil` | Smithy | 220 | 5 | 0.48×0.36×0.21 | iron, steel |  |
| `cart-wheel` | Structure | 1056 | 4 | 0.99×1.04×0.19 | oak, iron |  |
| `log-pile` | Props | 504 | 2 | 1.25×0.43×0.18 | oak |  |
| `hay-bale` | Props | 674 | 3 | 1.09×0.46×0.46 | straw, cloth |  |
| `linen-sack` | Props | 300 | 3 | 0.32×0.53×0.32 | cloth |  |
| `oak-tankard` | Props | 366 | 4 | 0.09×0.17×0.10 | oak, iron |  |
| `straw-broom` | Tools | 768 | 3 | 0.38×1.28×0.35 | oak, straw, cloth |  |
| `bronze-bell` | Props | 696 | 3 | 0.48×0.53×0.36 | brass, iron, oak | ✔ |
| `tavern-sign` | Props | 516 | 2 | 0.54×0.75×0.63 | oak, iron | ✔ |
| `leather-book` | Props | 248 | 3 | 0.20×0.07×0.28 | leather, cloth, brass |  |
| `glass-phial` | Props | 321 | 3 | 0.06×0.14×0.06 | glass, ember, oak, char |  |
| `coin-pouch` | Props | 546 | 3 | 0.18×0.11×0.19 | leather, cloth, brass |  |
| `wooden-ladder` | Structure | 440 | 2 | 0.49×2.20×0.06 | oak |  |
| `wooden-fence` | Structure | 440 | 2 | 4.89×1.10×0.09 | oak |  |
| `wooden-hoe` | Tools | 220 | 3 | 0.21×1.17×0.25 | oak, iron, steel |  |
| `wooden-shovel` | Tools | 468 | 3 | 0.27×1.20×0.08 | oak, iron, steel |  |
| `wooden-pitchfork` | Tools | 338 | 3 | 0.25×1.56×0.11 | oak, iron, steel |  |

Toplam **12 925 üçgen**. Kitin tamamı bir sahnede, bütçesi tek bir orta
karmaşıklıktaki karakter modelinden az.

### 5.1 Tek kaynak: `my-registry/meta.ts`

Başlık, açıklama, kategori, etiketler, kaydırıcı aralıkları, parça adları ve
materyal yuvaları TEK yerde duruyor. Oradan iki tüketici besleniyor:
`build.ts` (registry.json üretirken) ve `src/catalog.ts` (viewer'ın kaydırıcı
ve açıklamaları).

Önceden ikisi ayrı ayrı elle yazılıyordu ve on yedinci modelde ayrışmışlardı.
Şimdi ayrışması imkânsız değil ama SESSİZ olması imkânsız:
`verify-model.ts` her modelde metadata ile gerçeği karşılaştırıyor —

- `meta.controls` anahtarlarının hepsi modelin config alanı mı,
- `meta.parts` modelin gerçek parça adlarıyla aynı mı,
- bildirilen her yuva çözümleniyor mu,
- ve daha önemlisi: **hiçbir mesh bildirilmemiş bir yuva kullanmıyor mu.**

Son madde asıl olan. Fazladan bildirim sadece gürültü; EKSİK bildirim ise
tüketicinin `materials.override()` ile ulaşamayacağı gizli bir materyal demek,
yani registry sözleşmesinin ihlali. Bu kontrol eklendiği gün dört modelde
gerçek bir sapma yakaladı (`steel` yuvası eklenmiş ama bildirilmemişti).

### 5.2 Materyal sözlüğü — on yuva

| Yuva | Ne | Neden ayrı |
| --- | --- | --- |
| `oak` | kereste | — |
| `iron` | dövme demir, oksitli ve mat | `steel`den ayrı: fark renkte değil PÜRÜZLÜLÜKTE ve vertex color pürüzlülük taşıyamaz |
| `steel` | kullanımdan parlamış çelik | örsün yüzü, küreğin ağzı, çatalın ucu |
| `brass` | tunç ve bakır | çan, sikke |
| `straw` | saman, hasır, süpürge teli | balyanın "meşe" bildirmesi tüketiciye söylenmiş bir yalan olurdu |
| `cloth` | keten, çuval bezi, ip | — |
| `leather` | işlenmiş deri | — |
| `glass` | üflemeli cam | saydam, `depthWrite` KAPALI, `DoubleSide` |
| `ember` | alev | `MeshBasicMaterial` — ışık almaz, yayar |
| `char` | kömür, zift | — |

`ember` iki yerde kural olarak da işliyor: kapanma ve alaca pişirilirken bu
yuvadaki gövdeler tamamen atlanıyor. Sebebi basit — aydınlatılmayan bir
materyalde vertex rengi son renktir, karartmak alevi söndürür. Kural
`kit.ts`'te yuvanın kendisine bağlı, model başına bir bayrağa değil, ki
unutulması mümkün olmasın.

### 5.3 `core`'un sözlüğü

**Geometri üreteçleri** (`geometry.ts`) — hepsi indekssiz, hepsi vertex renkli,
dolayısıyla düz gölgeleme bedava geliyor:

`boxGeometry`, `taperedBoxGeometry`, `chamferedBoxGeometry` (44 üçgen, kendi
kendini düzelten kenar/köşe sarımıyla), `prismGeometry`, `latheGeometry`,
`staveGeometry`, `bandGeometry` (isteğe bağlı iç yüzle), `headGeometry`,
`arcBarGeometry`, `dishedSheetGeometry`, `flipGeometry`, `mergeColoured`.

**Deformasyon** — sonradan eklendi ve modelleri "üretilmiş" olmaktan çıkaran
şey oldu:

- `bendGeometry(geometry, curvature)` düz bir gövdeyi yay hâline sarar. Gerçek
  bir yay eşlemesi, "her noktayı yüksekliğiyle orantılı döndür" değil — o
  yaklaşım gövdeyi uzatıp inceltiyordu. Yaba dişleri, maşrapa kulpu, çapa ağzı
  ve tabelanın kıvrımı bunu kullanıyor.
- `roughenGeometry(geometry, amount)` yüzeyi düzensizleştirir. Kritik nokta:
  kayma miktarı KONUMDAN türetiliyor. Geometriler indekssiz, yani bir noktada
  üç-dört köşe kopyası var; bağımsız oynatmak yüzeyi yırtıyordu. Konum karması
  aynı noktadaki bütün kopyalara aynı kaymayı veriyor.

**Yüzey pişirme** — kit çapında, `createKitModel` içinde otomatik:

- `bakeOcclusion` (`occlusion.ts`) vertex renklerine ortam kapanması işler.
  Yüzeyin KENDİ biçiminden karartma üretiyor: bir nokta ne kadar çok komşu
  yüzeyle çevriliyse o kadar az gökyüzü görür. Tahtaların arası, çemberin altı,
  kütüklerin değdiği yer koyulaşıyor.
- `mottleGeometry` yüzey alacası işler ve bu, **"doku ne olacak?" sorusunun bu
  kitteki cevabı.** Bitmap doku üç şey isterdi: UV koordinatları (geometrimizde
  yok), registry'nin taşıması gereken görüntü dosyaları, ve kitin kimliğinin
  değişmesi. Yerine yüzeyin konumundan türeyen bir leke deseni var; leke
  büyüklüğü modelin ölçeğinden, ŞİDDETİ ise yuvadan geliyor —

  ```
  straw 1.35 · cloth 1.15 · oak 1.00 · char 0.85 · leather 0.70
  iron  0.50 · brass 0.35 · steel 0.22 · glass 0.15 · ember 0
  ```

  Kural malzemenin fiziğinden: bir yüzey ne kadar cilalıysa o kadar tek renk
  olur, çünkü göze giden ışık pigmentten değil yansımadan gelir.

  Dürüst sınırı: benekler köşelerde örnekleniyor, yani çözünürlüğü üçgen
  yoğunluğu belirliyor. Sandığın büyük ön paneli iki üçgen, dolayısıyla orada
  alaca neredeyse görünmüyor. Çare üçgeni bölmek, o da lowpoly bütçesini yer.

**İskele** (`kit.ts`) — `createKitModel` her modelin aynı sözleşmeyi kurmasını
sağlıyor: kaynak sahipliği, materyal çözümleme ve override, sabit anchor +
değiştirilebilir content, kimliği bozmayan `configure()`, idempotent
`dispose()`. Model yazmak artık sadece geometri üretmek.

### 5.4 Parça = bir ANLAM, bir mesh değil

`BuiltPart` üç alan taşıyor ve ikisi sonradan geldi:

- `geometry` + `slot` — parçanın ana gövdesi.
- **`extras`** — aynı parçaya ait, BAŞKA yuva kullanan gövdeler. Parçalar
  root'un kardeş çocukları, yani biri hareket ettiğinde diğerleri onu takip
  edemez. Sandığın kapağı hem meşe tahta hem demir kayış hem kilit kancasıdır
  ve üçü birlikte dönmek zorunda; ayrı parça olsalardı kapak açılırken kayışlar
  havada kalırdı. Bölünen şey anlam değil, sadece materyal.
- **`origin`** — parçanın kendi dönme merkezi. Verildiğinde anchor oraya
  konumlanıyor ve geometrinin o noktaya göre yazıldığı varsayılıyor. Sandık
  kapağının menteşe etrafında dönmesi için gereken tek şey bu.

`origin` bir incelik getiriyor: kapanma MONTAJ uzayında hesaplanmalı. Kendi
orijininde yazılmış bir kapak, gövdenin yanında değil içinde duruyormuş gibi
görünür ve yanlış yerleri karartır. `kit.ts` bu yüzden pişirmeden önce hepsini
yerine taşıyıp sonra geri alıyor.

### 5.5 Eylemler ve animasyon

Beş model hareketli ve dördü farklı bir mekanik gösteriyor:

| Model | Eylem | Mekanik |
| --- | --- | --- |
| `wooden-chest` | `setOpen` / `toggle` / `openness` / `snap` | üstel yaklaşma — kare hızından bağımsız |
| `pitch-torch` | `setLit` / `isLit` | uyumsuz frekanslı sinüs toplamı |
| `iron-lantern` | `setLit` / `isLit` | aynı, ama daha yavaş: cam alevi rüzgârdan korur |
| `bronze-bell` | `ring` / `still` / `strikes` | iki bağımsız sarkaç |
| `tavern-sign` | `push` / `still` / `lean` | yumuşak sarkaç, uzun salınım |

Ayrım mimari dokümanda yazılı ve önemli: `configure()` topolojiyi yeniden kurar
ve **pahalıdır**, kullanıcı ayarı içindir. Kare başına değişen her şey
`update()` içinde olmalı. Kapağı açmak sandığın KİMLİĞİNİ değiştirmiyor,
dolayısıyla `configure()` işi değil.

Üç kural bütün hareketli modellerde geçerli:

1. **Durum inşanın DIŞINDA tutulur.** `configure()` çağrılınca kapak
   çarpmamalı, çan susmamalı. Açı ve faz kapanışta yaşıyor, `build()` içinde
   değil.
2. **`Math.random()` yok.** Alev titremesi bile deterministik: iki uyumsuz
   frekanslı sinüsün toplamı. Aynı tohumlu iki meşale ayrışmıyor.
3. **Kare hızından bağımsızlık.** Sandık `p += (hedef − p)·(1 − e^(−k·dt))`
   kullanıyor; saf bir lerp 30 fps'te 120 fps'ten yavaş açardı. Test bunu iki
   farklı adım sayısıyla aynı süreyi geçirip karşılaştırarak doğruluyor.

Çan kitin en karmaşık parçası ve öğrettiği şey şu: **çanı çalan şey çanın
sallanması değil, tokmağın GERİDE KALMASI.** İlk denemede tokmağı çanın
`extras` gövdesi yapmıştım — çan sallanıyor, hiçbir şey olmuyordu. Şimdi ikisi
ayrı parça, aynı eksende ama farklı sönümlemeyle salınıyor; aradaki fark vuruşu
üretiyor ve `actions.strikes()` sayacını artırıyor. Model SES ÇALMIYOR: sahnenin
ses sistemi hakkında varsayım yapmaya hakkı yok, ihtiyacı olan sayacı okur.

### 5.6 Z-fighting: hizalı yüz yapma, kasıtlı içiçe geç

İki yüzey aynı düzlemde, aynı yöne bakıyor ve alanları örtüşüyorsa hangisinin
önde olduğu derinlik tamponunun kayan nokta hassasiyetine kalır. Kamera
oynadıkça kazanan değişir ve yüzey titrer.

Sandığın (crate) ilk hâli tam bu hataya düşmüştü: dikmeler, yan tahtalar ve
kapak tahtalarının hepsi dış yüzeyini `±width/2` düzlemine koyuyordu — **96
çakışan yüz.** Çözüm bir "epsilon kaydırma" değil, gerçek marangozluk:

- **Dikmeler tahtalardan dışarı taşıyor** — yan tahtalar dikmelerin arkasına
  çekili, dış yüzleri farklı düzlemde.
- **Kapak ve taban çerçeveden sarkıyor.**
- **Dikmeler kapak ve tabanın İÇİNE giriyor**, uçları katı parçanın içinde
  kaldığı için hiçbir düzlemle hizalanmıyor.
- **Tahtalar birbirine küt ekleniyor** (butt joint) — değiyorlar ama
  örtüşmüyorlar. Kenar teması z-fighting üretmez.
- **Kayışlar köşede birbirine varmadan bitiyor.**

Aynı disiplin yeni modellerde de bir sürü karar dayattı ve bazıları modeli
daha DOĞRU yaptı:

- Ortaçağ sandığında ön yüzün ortasına kayış konmuyor, çünkü **orası kilidin
  yeri.** Kural hem tarihsel olarak doğru hem de kayışla kilit köprüsünün
  belirli ölçülerde aynı düzleme oturmasını kökten engelliyor.
- Süpürgenin levhaları birbirine tam paralel duramaz — elle bağlanmış bir
  demette hiçbir tel diğerine paralel değildir zaten.
- Çanın yatakları kirişin ÜSTÜNE taşıyor; gerçek yatak da öyledir.

`scripts/zfight.ts` bunu ölçüyor ve `verify-model.ts` her modelde, üstelik
birkaç farklı yapılandırmada birden çağırıyor. Ölçüt bounding box değil gerçek
alan örtüşmesi: bir üçgenin ağırlık merkezi diğerinin içinde mi.

### 5.7 Sarım denetimi

Elle yazılan geometride en sinsi hata ters sarım: yüz içten görünür hâle gelir
ve bu ancak belirli bir kamera açısında fark edilir. Üç ayrı ölçüt var, çünkü
hiçbiri tek başına yeterli değil:

**Radyal hizalama** — dönel gövdeler için. Dış kabuktaki her radyal yüzün
normali eksenden dışa bakmalı. Yükseklik BANTLARI hâlinde ölçülüyor: konik
gövdelerde tek bir yarıçap eşiği anlamsız.

**İşaretli hacim** — kapalı katılar için. Σ a·(b×c)/6 sarım dışa bakıyorsa
pozitif çıkar. Ama bu ölçüt yalnızca GENEL tersliği yakalıyor.

**Kenar dengesi** — tek bir ters çevrilmiş yüzü yakalayan tek ölçüt. İşaretli
hacim testi bunu kaçırdığı için eklendi: bir yüzü ters çevirdiğimde hacim
0.058'den 0.039'a düşmüş ama pozitif kalmıştı.

Üç incelik daha:

- Tahtaların yan yüzeyleri TEĞETSEL, yani radyal çarpım onlar için tanımı
  gereği ~0 ve işareti sadece gürültü. Ayıklanıyorlar ve **kaç tane
  ayıklandığı raporlanıyor** — sessizce elenmiyorlar.
- İçi boş gövdeler (çan) bilerek içe bakan bir kabuk taşıyor. Onlarda eşik
  yükseltiliyor ki iç kabuk "dış kabuk" sanılmasın.
- `bandGeometry` varsayılan olarak iç yüz üretmiyor (çember hep bir gövdeyi
  sarar, iç yüz görünmez). Serbest duran bir halka — çuvalın ipi, balyanın bağı
  — bu yüzden kapalı katı olmuyordu; `{ inner: true }` bunun için var.

### 5.8 Doğrulama: üç betik

```bash
bun scripts/verify-model.ts   # ~500 kontrol · geometri, protokol, metadata, eylemler
bun scripts/verify-glb.ts     # her modeli dışa aktarıp GERİ OKUR
bun scripts/render.ts         # PNG kontak sayfası — modele BAKMAK için
```

Yöntem baştan beri aynı: **her kontrol mutasyonla sınandı.** Sabote et,
FAIL geldiğini gör, geri al, PASS geldiğini gör. Geçen bir test, çalıştığını
kanıtlamaz.

Bu disiplin iki kez kendini fena hâlde haklı çıkardı ve ikisinde de hata
BENDEYDİ, testte değil:

- Radyal test 17 yanlış pozitif veriyordu. Teşhis çıktım "0 negatif" diyordu
  çünkü `toFixed(3)` `-0` üretiyor ve JavaScript'te `-0 < 0` yanlış.
- Kütükler hâlâ birbirine giriyordu. "0 içiçe geçme" diye ölçtüğüm şey
  YERLEŞİM matematiğiydi; oysa uçların yarıçapı `log.r · (1 ± 0.05)` idi ve
  yerleşim `log.r` ile hesaplanıyordu. Yanlış şeyi doğrulamıştım.

`render.ts` en son eklendi ve eksik olan şeyi kapattı. Bütün doğrulama
GEOMETRİKTİ: üçgen sayısı, sarım, eş düzlem, sınır kutusu. Hepsi gerçek hatalar
yakaladı ama hiçbiri "bu kürek küreğe benzemiyor" diyemedi. O cümleyi kurabilmek
için modele bakmak gerekiyor — betik tarayıcısız, GPU'suz bir yazılım
rasterleyici: üçgenleri topluyor, kamerayla yansıtıyor, z-tamponuyla dolduruyor,
PNG yazıyor. Kürek dördüncü kez, çapa üçüncü kez, saman balyası ikinci kez o
görüntülere bakıldığı için yeniden yazıldı.

`--sweep` kipi bir parametrenin farklı değerlerini yan yana koyuyor:

```bash
bun scripts/render.ts --one wooden-hoe --sweep "bladeAngle=62|80|98|116|134"
```

Çapanın ağız açısı böyle seçildi. 98° civarında ağız neredeyse yatay kalıyor ve
3/4 açıdan bakan bir kameraya TAM KENARINDAN görünüyor — modelin en karakteristik
yüzeyi siluetten siliniyor. 66° seçildi.

### 5.9 GLB dışa aktarımı

vibe3d'nin kendi inceleyicisinde olup bizde olmayan tek özellik buydu. Artık
iki yerden çalışıyor ve **ikisi de aynı kodu** kullanıyor (`src/glb.ts`):

```bash
bun scripts/export-glb.ts                      # kitin tamamı → glb/
bun scripts/export-glb.ts --one wooden-chest
```

Viewer'daki "GLB indir" düğmesi bit bit aynı dosyayı üretiyor. Toplu dışa
aktarım onlarda yok ve asıl işe yarayan o: kiti Blender'a, Godot'ya ya da
Unity'ye tek komutla götürüyor.

Renk bilgisi tamamen vertex color'da olduğu için glTF'e `COLOR_0` olarak
gidiyor ve `baseColorFactor` beyaz kalıyor — dosyada hiç doku yok. Kitin bütün
kimliği tek bir attribute'la seyahat ediyor.

TaşınMAYAN tek şey şader: `@scifi-kit`'in göstergesindeki aşınma bir TSL düğüm
grafiği, yani kod, ve glTF kod taşımaz. Bu bir eksiklik değil — vertex color
ile şader tabanlı yüzey arasındaki gerçek farkın kendisi.

---

## 6. Katkı

Depo MIT ve Bun workspace'i. `apps/*`, `packages/*`, `registries/*`.

```bash
git clone https://github.com/vibe-stack/vibe3d
cd vibe3d && bun install
bun run dev            # docs kataloğu — her modelin canlı önizlemesi
```

Sürümleme **Changesets** ile:

```bash
bun run changeset                              # değişiklik niyetini yaz
bun run build && bun run typecheck && bun test # release:check ile aynı
```

Release workflow bir version PR'ı tutuyor ve merge sonrası paketleri bağımlılık
sırasına göre yayınlıyor.

### Katkı yolları, en kolaydan zora

1. **Kendi registry'nizi yayınlayın.** Depoya dokunmaz, izin gerekmez, ekosistemi
   büyütür. `@scifi-kit` sadece *referans* registry.
2. **`@scifi-kit`'e model ekleyin.** `assets/prototypes/<model-id>/model.ts`
   ekleyin — `registries/scifi-kit/src/build.ts` `model.ts` içeren her klasörü
   **otomatik keşfeder**, kayıt listesi yok. `vibe-model` döngüsünü izleyin,
   `docs/templates/asset-spec-template.md` sözleşmesini doldurun.
3. **Protokol boşluklarını kapatın.** Mimari dokümanda yazılı ama henüz
   olmayanlar, doğrudan katkıya açık:
   - `github:` sağlayıcısı (`source.ts` bugün açıkça "planned but not available
     yet" fırlatıyor);
   - `vibe3d registry init` / `build` / `test` komutları (mimaride var, CLI'da
     sadece `validate` mevcut);
   - üç yollu birleştirmesiz güvenli `update` çakışma akışı;
   - runtime conformance (mevcut `checkRegistry` statik; "temiz fixture'a kur,
     TypeScript derle, geçerli model örneği doğrula" adımları henüz yok).

Not: mimari dokümanın başlığı hâlâ *"Status: proposed architecture; not yet
implemented"* diyor ama çekirdek büyük ölçüde gerçek. Bu boşluk da bir katkı
fırsatı.

### Şu anki durum

npm'de yayınlanan `@scifi-kit/registry@0.0.1`: **110 model** (Industrial 76,
Architecture 12, Streets 9, Military 7, Medical 6) + 2 lib + 1 kit. GitHub `main`
daha ileride — `assets/prototypes/` altında ~180 klasör var (kargo/lojistik
dalgası henüz yayınlanmamış). Tüm paketler `0.0.1`, 2026-08-11'de yayınlanmış;
proje çok erken aşamada, yani katkı için zamanlama iyi.

---

## 7. Komut özeti

```bash
# tüketici
bunx vibe3d init
bunx vibe3d list [sorgu]                 # katalog, alias: search
bunx vibe3d view @scifi-kit/modular-wall # kurmadan incele
bunx vibe3d add  @scifi-kit/modular-wall [--dry-run] [--overwrite]
bunx vibe3d add  @scifi-kit              # defaultItem = tüm kit
bunx vibe3d diff                         # yerel değişikliklerim ne
bunx vibe3d update @scifi-kit/modular-wall
bunx vibe3d remove @scifi-kit/modular-wall [--force]
bunx vibe3d doctor

# registry yazarı
bunx vibe3d registry validate ./my-registry/dist/registry.json

# bu depo
bun my-registry/build.ts                    # registry.json üret
bun scripts/verify-model.ts                 # tam doğrulama
bun scripts/verify-glb.ts                   # GLB gidiş-dönüş
bun scripts/render.ts [--one <id>] [--ids a,b] [--sweep "k=v1|v2"] [--size N]
bun scripts/export-glb.ts [--one <id>] [--out dir]
bun scripts/catalog-table.ts                # doküman tablosu

# yazarlık skill'leri
bunx vibe-model    [--global] [doctor] [--force]
bunx vibe-terrain
```
