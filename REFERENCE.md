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
src/models/scifi-kit/pressure-gauge/  kurulu sci-fi modeli
src/models/medieval-kit/wooden-barrel/ kurulu KENDİ modeliniz
my-registry/                     kendi registry'nizin kaynağı + build script'i
scripts/verify-model.ts          tarayıcısız conformance doğrulaması
```

`models.json` ↔ `models.lock.json` ayrımı kasıtlı: birincisi **yapılandırma**
(sizin), ikincisi **kurulum durumu** (CLI'ın). Lock her dosyanın kurulum anındaki
sha256'sını tutar; `vibe3d diff` bununla yerel değişikliklerinizi tespit eder ve
`add`/`update` düzenlediğiniz dosyaların **üzerine yazmaz** (`--overwrite` demedikçe).

### Çalıştırma

```bash
bun run dev          # oyun alanı — iki registry, tek proje
bun run typecheck    # kurulu kaynak gerçekten derleniyor mu
bun scripts/verify-model.ts   # geometri, kimlik kararlılığı, sahiplik, dispose
```

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

Bu bir varsayım değil; `@medieval-kit` çalışıyor ve doğrulandı. Dört item var:

| Item | Tür | İçerik |
| --- | --- | --- |
| `@medieval-kit/core` | `vibe3d:lib` | deterministik rastgelelik, slot bazlı materyaller, geometri sözlüğü, parça yuvaları |
| `@medieval-kit/wooden-barrel` | `vibe3d:model` | 3 mesh, 806 üçgen, 0.82 × 1.05 × 0.81 m |
| `@medieval-kit/wooden-crate` | `vibe3d:model` | 3 mesh, 360 üçgen, 0.67 × 0.52 × 0.53 m |
| `@medieval-kit/iron-brazier` | `vibe3d:model` | 9 mesh, 423 üçgen, 0.53 × 0.90 × 0.53 m · **hareketli** |

### core'un sözlüğü

`geometry.ts` beş üreteç veriyor — hepsi indekssiz, hepsi vertex renkli:
`boxGeometry` (tahta, kiriş, kayış, ayak), `prismGeometry` (kesik koni: kâse,
alev dili; isteğe bağlı dikey renk geçişiyle), `staveGeometry` (fıçı tahtası),
`bandGeometry` (demir çember), `headGeometry` (kapak diski). Ayrıca
`flipGeometry` sarımı ters çevirir — içi görünen kaplar için gerekli: kâsenin
dış yüzeyi dışa, iç yüzeyi içe bakmalı, ikisi de aynı koniden üretiliyor.

`materials.ts` slot bazlı: `createMedievalMaterials(scope, ['iron','ember'])`
yalnızca istenenleri üretir. Mangalın meşeye, fıçının emissive materyale
ihtiyacı yok; kullanılmayan materyal üretmek hem boşuna GPU kaynağı hem de
modelin `materialSlots` bildirimiyle çelişen bir yalan olurdu.

`ember` yuvası bilinçli olarak **MeshBasicMaterial**. MeshStandardMaterial
burada yanlış araç olurdu: `emissive` tek bir Color'dır, vertex renklerinden
beslenmez — yani alevin dibinden ucuna renk geçişi yapılamazdı.

Model, core'a `registryDependencies` ile bağlı ve build script'i bunu
**kaynaktan türetiyor** — `from '../core/'` içeren her import otomatik
bağımlılık oluyor, elle tutulan liste yok. `vibe3d add @medieval-kit/wooden-barrel`
core'u kendiliğinden getiriyor.

### Fıçı nasıl kurulu

Gerçek fıçı tek parça değildir, o yüzden model de tek parça değil: 13 ayrı
tahta (stave), uçlara doğru daralan bir profil (`taper`), gövdeye gömülü
kapaklar ve tahtaların kapak üstünde bıraktığı bilezik (chime), dört demir
çember (uçtakiler daha geniş — en çok zorlanan yer orası).

İki teknik burada öğrenmeye değer:

**Vertex renkleri.** 13 tahtanın 13 ayrı tonu var ama **tek materyal**
kullanılıyor. Renk varyasyonu materyalde değil geometride taşınıyor
(`vertexColors: true`), böylece hepsi tek çizim çağrısını paylaşıyor. Bu,
scifi-kit'in aşınma boru hattındaki fikrin küçük hâli: yüzey kimliğini vertex
attribute'una yaz, sonra birleştir. Ekranda ölçüldü: **61 farklı ahşap tonu**.

**Deterministik rastgelelik.** `Math.random()` yok; `seed`'e bağlı bir
mulberry32. Aynı tohum her zaman aynı fıçıyı verir — yoksa ne önizleme, ne
test, ne sanat yönetimi tutar. `seed` yapılandırılabilir bir alan, yani aynı
modelden istediğiniz kadar farklı fıçı çıkarabilirsiniz.

**Indekssiz geometri.** `computeVertexNormals()` indekssiz geometride her
üçgene kendi normalini verir — düz gölgeleme materyal bayrağı olmadan,
geometrinin doğal sonucu olarak gelir. Lowpoly'de istenen tam olarak bu.

Neden hiçbir engel yok:

- Şema stil hakkında hiçbir şey bilmiyor. Namespace, item adı, dosya, hash. O kadar.
- `capabilities: []` bildirebilirsiniz — `@scifi-kit` `["webgpu","tsl"]` istiyor,
  sizinki istemiyor, ikisi aynı projede yan yana yaşıyor.
- `@scifi-kit/core`'a bağımlı **değilsiniz**. Fıçı sadece düz `three` ve
  `init`in kurduğu evrensel sözleşmeleri kullanıyor.
- Mimari dokümanın "non-goals" bölümü bunu açıkça yazıyor: *"Requiring all
  registries to use the sci-fi kit's material library, visual language, geometry
  helpers, or authoring pipeline."*

Bu desen `@scifi-kit`'in `axiom-cargo-kit` item'ıyla aynı: 50 model tek bir
destek item'ını paylaşıyor, böylece tek tek kurulan bir sandık bile yanındaki
konteynerle aynı katalogdan gelmiş gibi duruyor. Kite yeni model eklerken
kural basit: **ortak olan her şey `core`'a, sadece o modele ait olan model
dosyasına.**

### anchor / content ayrımı — protokolün en kolay kaçırılan yeri

`PartHandle` iki ayrı nesne bildirir ve ikisi **aynı olamaz**:

- `anchor` — modelin ömrü boyunca aynı nesne. Tüketici ışığını, etiketini,
  çarpışma gövdesini buraya takar.
- `content` — `configure()` her çağrıldığında atılıp yeniden kurulan geometri.

İkisini aynı Group yapıp rebuild'de `clear()` çağırmak tüketicinin taktığı her
şeyi de sessizce siler. Model çalışmaya devam eder, ama protokolün asıl vaadi
bozulmuştur — ve bunu fark etmek zordur.

İlk üç modeli de bu hatayla yazdım; `scripts/verify-model.ts` yakaladı. Doğru
yapı artık `core/parts.ts` içinde `createPart()` olarak duruyor, yani sonraki
modeller aynı hataya düşemez. Mangalın ateş ışığı da bu sayede `anchor`'da
yaşıyor ve `configure()` ateşi söndürmüyor.

### Statik ve hareketli modeller

Fıçı ve sandık statik. Mangal protokolün onların hiç dokunmadığı iki parçasını
kullanıyor:

- **tipli `actions`** — `setLit(boolean)` / `isLit()`
- **`update(dt)`** — alev titremesi ve ışık dalgalanması

Ayrım önemli ve mimari dokümanda yazılı: `configure()` topolojiyi yeniden kurar
ve **pahalıdır**, kullanıcı ayarı içindir. Kare başına değişen her şey
`update()` içinde olmalı.

Alev titremesi iki farklı frekansın toplamı; tek sinüs fazla düzenli okunuyor,
ateş öyle yanmaz. `update()` ayrıca adımı 0.05 s ile sınırlıyor ki sekme arka
plandan dönünce alev fırlamasın.

### Z-fighting: hizalı yüz yapma, kasıtlı içiçe geç

İki yüzey aynı düzlemde, aynı yöne bakıyor ve alanları örtüşüyorsa hangisinin
önde olduğu derinlik tamponunun kayan nokta hassasiyetine kalır. Kamera
oynadıkça kazanan değişir ve yüzey titrer.

Sandığın ilk hâli tam bu hataya düşmüştü: dikmeler, yan tahtalar ve kapak
tahtalarının hepsi dış yüzeyini `±width/2` düzlemine koyuyordu — **96 çakışan
yüz.** (Fıçı ve mangalda 0'dı, çünkü onlar dönel ve yüzeyleri doğal olarak
farklı yarıçaplarda.)

Çözüm bir "epsilon kaydırma" değil, gerçek marangozluk:

- **Dikmeler tahtalardan dışarı taşıyor** (`postProud`) — yan tahtalar
  dikmelerin arkasına çekili, dış yüzleri farklı düzlemde.
- **Kapak ve taban çerçeveden sarkıyor** (`overhang`) — yan yüzleri dikmelerin
  yüzleriyle hizalanmıyor.
- **Dikmeler kapak ve tabanın içine giriyor**, uçları katı parçanın içinde
  kaldığı için görünmüyor ve hiçbir düzlemle hizalanmıyor.
- **Tahtalar birbirine küt ekleniyor** (butt joint) — değiyorlar ama
  örtüşmüyorlar. Kenar teması z-fighting üretmez.
- **Ön/arka kayışlar köşede dışa taşıyor, yan kayışlar onlara varmadan
  bitiyor** — dört parçanın üst yüzü köşede üst üste binmiyor.

`scripts/zfight.ts` bunu ölçüyor ve `verify-model.ts` her modelde, sandıkta ise
birkaç farklı yapılandırmada birden çağırıyor. Ölçüt bounding box değil gerçek
alan örtüşmesi: bir üçgenin ağırlık merkezi diğerinin içinde mi. Böylece
bitişik tahtalar yanlış alarm vermiyor.

### Sarım denetimi

Elle yazılan geometride en sinsi hata ters sarım: yüz içten görünür hâle gelir
ve bu ancak belirli bir kamera açısında fark edilir. `scripts/verify-model.ts`
bunu iki ayrı ölçütle denetliyor, çünkü iki ayrı geometri türü var:

**Dönel gövdeler** (fıçı, mangal kâsesi) için radyal hizalama — dış kabuktaki
her **radyal** yüzün normali eksenden dışa bakmalı.

**Kapalı katılar** (sandık: tamamen kutulardan kurulu) için işaretli hacim.
Kapalı bir yüzeyin hacmi Σ a·(b×c)/6 ile bulunur; sarım dışa bakıyorsa pozitif,
içe bakıyorsa negatif çıkar. Sandıkta bu ölçüt radyal testten daha keskin,
çünkü kutunun "radyal" yönü diye bir şey yok.

Önemli incelik: tahtaların yan (boşluk) yüzeyleri teğetseldir, yani bu çarpım
onlar için tanımı gereği ~0'dır ve işareti sadece kayan nokta gürültüsüdür.
Radyal bir test onları yargılayamaz, o yüzden ayıklanıyor ve **kaç tane
ayıklandığı raporlanıyor** — sessizce elenmiyorlar.

Test mutasyonla doğrulandı: dış yüz dörtgeninin sarımı kasten ters çevrildiğinde
104 radyal yüzün 52'si yakalandı; geri alınınca sıfır.

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
bunx vibe3d registry validate ./dist/registry.json

# yazarlık skill'leri
bunx vibe-model    [--global] [doctor] [--force]
bunx vibe-terrain
```
