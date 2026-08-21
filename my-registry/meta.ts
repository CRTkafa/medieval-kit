/**
 * Kit kataloğunun TEK kaynağı.
 *
 * Bu tablo iki yerden okunuyor: `build.ts` registry.json üretirken, viewer da
 * kaydırıcılarını ve açıklamalarını kurarken. Önceden ikisi ayrı ayrı elle
 * yazılıyordu; on yedi modelde bu artık sürdürülebilir değil ve zaten
 * ayrışmaya başlamıştı.
 *
 * Buradaki `controls` bir SÖZLEŞME: her anahtar modelin config alanı olmak
 * zorunda. Viewer bunu `keyof Config` üzerinden denetliyor, yani yeniden
 * adlandırılmış bir alan derleme hatası veriyor.
 */

export interface ControlSpec {
  readonly type: 'number'
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
}

export interface ModelMeta {
  readonly title: string
  readonly description: string
  readonly category: string
  readonly tags: readonly string[]
  readonly controls: Readonly<Record<string, ControlSpec>>
  readonly materialSlots: readonly string[]
  readonly parts: readonly string[]
}

export const MODEL_META: Readonly<Record<string, ModelMeta>> = {
  'wooden-chest': {
    title: 'Wooden Chest',
    description:
      'Altı tahtalı, demir kayışlı ortaçağ sandığı. Kapağı menteşeli ve eylemle açılıyor.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'interactive', 'procedural'],
    controls: {
      width: { type: 'number', label: 'Genişlik', min: 0.4, max: 1.6, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Yükseklik', min: 0.28, max: 0.9, step: 0.02, unit: 'm' },
      depth: { type: 'number', label: 'Derinlik', min: 0.24, max: 0.8, step: 0.02, unit: 'm' },
      bandCount: { type: 'number', label: 'Kayış sayısı', min: 0, max: 6, step: 1 },
      openAngle: { type: 'number', label: 'Açılma açısı', min: 40, max: 130, step: 2, unit: '°' },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['body', 'lid', 'bands', 'lock'],
  },
  'wooden-barrel': {
    title: 'Wooden Barrel',
    description:
      'Ayrı meşe tahtalardan kurulmuş, demir çemberli, kapağı gömülü lowpoly fıçı.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.4, max: 2, step: 0.02, unit: 'm' },
      radius: { type: 'number', label: 'Yarıçap', min: 0.15, max: 0.9, step: 0.01, unit: 'm' },
      taper: { type: 'number', label: 'Uç daralması', min: 0, max: 0.34, step: 0.01 },
      staveCount: { type: 'number', label: 'Tahta sayısı', min: 6, max: 28, step: 1 },
      hoopCount: { type: 'number', label: 'Çember sayısı', min: 0, max: 6, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['staves', 'heads', 'hoops'],
  },
  'wooden-crate': {
    title: 'Wooden Crate',
    description:
      'Köşe dikmelerine çakılmış yatay tahta sıraları ve dövme demir kayışlar.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      width: { type: 'number', label: 'Genişlik', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Yükseklik', min: 0.25, max: 1.2, step: 0.02, unit: 'm' },
      depth: { type: 'number', label: 'Derinlik', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      plankRows: { type: 'number', label: 'Tahta sırası', min: 1, max: 6, step: 1 },
      strapCount: { type: 'number', label: 'Demir kayış', min: 0, max: 4, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['posts', 'planks', 'straps'],
  },
  'wooden-bucket': {
    title: 'Wooden Bucket',
    description:
      'Daralan meşe tahtalar, demir çember ve dövme kulp — küçük bir fıçı.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'farm', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.15, max: 0.6, step: 0.01, unit: 'm' },
      radius: {
        type: 'number', label: 'Ağız yarıçapı',
        min: 0.07, max: 0.3, step: 0.005, unit: 'm',
      },
      taper: { type: 'number', label: 'Taban daralması', min: 0, max: 0.45, step: 0.01 },
      staveCount: { type: 'number', label: 'Tahta sayısı', min: 6, max: 20, step: 1 },
      hoopCount: { type: 'number', label: 'Çember sayısı', min: 0, max: 4, step: 1 },
      handle: { type: 'number', label: 'Kulp', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['staves', 'base', 'hoops', 'handle'],
  },
  'trestle-table': {
    title: 'Trestle Table',
    description:
      'Sehpa masa: tabla ayaklara çakılı değil, üstüne konur — salon boşaltılabilsin diye.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Uzunluk', min: 1, max: 3.2, step: 0.05, unit: 'm' },
      width: { type: 'number', label: 'Genişlik', min: 0.5, max: 1.2, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Yükseklik', min: 0.5, max: 1, step: 0.01, unit: 'm' },
      plankCount: { type: 'number', label: 'Tabla tahtası', min: 2, max: 7, step: 1 },
      splay: { type: 'number', label: 'Ayak açıklığı', min: 0, max: 0.45, step: 0.01 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['top', 'trestles', 'stretcher'],
  },
  'wooden-bench': {
    title: 'Wooden Bench',
    description:
      'Zıvanaları oturağın üstünden görünen, yayvan ayaklı ortaçağ bankı.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Uzunluk', min: 0.6, max: 3, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Yükseklik', min: 0.28, max: 0.7, step: 0.01, unit: 'm' },
      width: { type: 'number', label: 'Genişlik', min: 0.18, max: 0.5, step: 0.01, unit: 'm' },
      splay: { type: 'number', label: 'Ayak açıklığı', min: 0, max: 0.6, step: 0.02 },
      inset: { type: 'number', label: 'Ayak içeriliği', min: 0.02, max: 0.3, step: 0.01 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['seat', 'legs', 'stretcher'],
  },
  'wooden-stool': {
    title: 'Wooden Stool',
    description:
      'Üç ayaklı köy taburesi — düzgün olmayan zeminde sallanmayan sayı üçtür.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.25, max: 0.9, step: 0.01, unit: 'm' },
      seatRadius: {
        type: 'number', label: 'Oturak yarıçapı',
        min: 0.1, max: 0.3, step: 0.005, unit: 'm',
      },
      legCount: { type: 'number', label: 'Ayak', min: 3, max: 5, step: 1 },
      splay: { type: 'number', label: 'Ayak açıklığı', min: 0, max: 0.45, step: 0.01 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['seat', 'legs'],
  },
  'pitch-torch': {
    title: 'Pitch Torch',
    description:
      'Ziftli bez sarılmış meşale. Alevi update() ile titriyor, actions.setLit ile sönüyor.',
    category: 'Lighting',
    tags: ['medieval', 'lowpoly', 'lighting', 'animated', 'interactive'],
    controls: {
      length: { type: 'number', label: 'Sap uzunluğu', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      radius: {
        type: 'number', label: 'Sap yarıçapı',
        min: 0.008, max: 0.05, step: 0.001, unit: 'm',
      },
      wrapLength: { type: 'number', label: 'Sargı oranı', min: 0.12, max: 0.5, step: 0.01 },
      flameHeight: { type: 'number', label: 'Alev boyu', min: 0.4, max: 3, step: 0.05 },
      flicker: { type: 'number', label: 'Titreme', min: 0, max: 2.5, step: 0.05 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'char', 'ember'],
    parts: ['shaft', 'wrap', 'flame'],
  },
  'iron-anvil': {
    title: 'Iron Anvil',
    description:
      'Geniş kaide, dar bel, sivrilen boynuz; üstünde kullanımdan parlamış çelik yüz plakası.',
    category: 'Smithy',
    tags: ['medieval', 'lowpoly', 'smithy', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.2, max: 0.6, step: 0.01, unit: 'm' },
      faceLength: {
        type: 'number', label: 'Yüz uzunluğu',
        min: 0.25, max: 0.8, step: 0.01, unit: 'm',
      },
      faceWidth: {
        type: 'number', label: 'Yüz genişliği',
        min: 0.07, max: 0.25, step: 0.005, unit: 'm',
      },
      hornReach: { type: 'number', label: 'Boynuz uzunluğu', min: 0.2, max: 0.8, step: 0.02 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['iron', 'steel'],
    parts: ['base', 'waist', 'body', 'face', 'horn'],
  },
  'cart-wheel': {
    title: 'Cart Wheel',
    description:
      'Dıştan içe dört katman: demir bandaj, ahşap ispit, parmaklar, göbek.',
    category: 'Structure',
    tags: ['medieval', 'lowpoly', 'cart', 'structure', 'procedural'],
    controls: {
      radius: { type: 'number', label: 'Yarıçap', min: 0.25, max: 0.9, step: 0.01, unit: 'm' },
      spokeCount: { type: 'number', label: 'Parmak', min: 6, max: 16, step: 1 },
      width: { type: 'number', label: 'Kalınlık', min: 0.04, max: 0.18, step: 0.005, unit: 'm' },
      hubLength: { type: 'number', label: 'Göbek boyu', min: 1.2, max: 3.2, step: 0.1 },
      tyre: { type: 'number', label: 'Bandaj kalınlığı', min: 0.02, max: 0.09, step: 0.005 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['hub', 'spokes', 'felloe', 'tyre'],
  },
  'log-pile': {
    title: 'Log Pile',
    description:
      'Kesilmiş odun yığını. Damar kesiti kabuktan çok daha açık; yığına bakınca ilk görülen o.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      rows: { type: 'number', label: 'Sıra', min: 1, max: 6, step: 1 },
      perRow: { type: 'number', label: 'Sıra başı kütük', min: 1, max: 9, step: 1 },
      logLength: { type: 'number', label: 'Kütük boyu', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      logRadius: {
        type: 'number', label: 'Kütük yarıçapı',
        min: 0.03, max: 0.14, step: 0.002, unit: 'm',
      },
      variation: { type: 'number', label: 'Kalınlık çeşitliliği', min: 0, max: 0.5, step: 0.02 },
      taperRows: { type: 'number', label: 'Piramit istif', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['bark', 'ends'],
  },
  'hay-bale': {
    title: 'Hay Bale',
    description:
      'Elle bağlanmış saman demeti — iplerin sıktığı yerde daralan, her yanından sap fırlayan.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'farm', 'props', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Uzunluk', min: 0.4, max: 1.6, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Yükseklik', min: 0.2, max: 0.9, step: 0.02, unit: 'm' },
      depth: { type: 'number', label: 'Derinlik', min: 0.2, max: 0.9, step: 0.02, unit: 'm' },
      ropeCount: { type: 'number', label: 'İp sayısı', min: 0, max: 4, step: 1 },
      wisps: { type: 'number', label: 'Fırlayan sap', min: 0, max: 60, step: 2 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['straw', 'cloth'],
    parts: ['bale', 'wisps', 'ropes'],
  },
  'linen-sack': {
    title: 'Linen Sack',
    description:
      'Ağzı iple bağlanmış tahıl çuvalı. Doluluk oranı siluetin tamamını değiştiriyor.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'farm', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.2, max: 1, step: 0.01, unit: 'm' },
      radius: { type: 'number', label: 'Yarıçap', min: 0.07, max: 0.35, step: 0.005, unit: 'm' },
      fill: { type: 'number', label: 'Doluluk', min: 0.15, max: 1, step: 0.02 },
      collar: { type: 'number', label: 'Ağız payı', min: 0.05, max: 0.3, step: 0.01 },
      ears: { type: 'number', label: 'Dip kulağı', min: 0, max: 6, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['cloth'],
    parts: ['body', 'collar', 'cord'],
  },
  'straw-broom': {
    title: 'Straw Broom',
    description:
      'Bir sopa, bir demet süpürge otu, iki tur ip — dönemin süpürgesi tam olarak buydu.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'household', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Boy', min: 0.7, max: 1.8, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Sap kalınlığı',
        min: 0.01, max: 0.03, step: 0.001, unit: 'm',
      },
      headLength: { type: 'number', label: 'Demet boyu', min: 0.18, max: 0.5, step: 0.01 },
      flare: { type: 'number', label: 'Açılma', min: 0, max: 0.8, step: 0.02 },
      bristles: { type: 'number', label: 'Tel sayısı', min: 10, max: 90, step: 2 },
      bindings: { type: 'number', label: 'Bağ sayısı', min: 0, max: 4, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'straw', 'cloth'],
    parts: ['shaft', 'bristles', 'bindings'],
  },
  'oak-tankard': {
    title: 'Oak Tankard',
    description:
      'Meşe maşrapa: fıçının avuç içi ölçeğindeki hâli, aynı tahta ve çember diliyle.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'tavern', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.08, max: 0.28, step: 0.005, unit: 'm' },
      radius: { type: 'number', label: 'Ağız yarıçapı', min: 0.03, max: 0.1, step: 0.002, unit: 'm' },
      taper: { type: 'number', label: 'Taban daralması', min: 0, max: 0.3, step: 0.01 },
      staveCount: { type: 'number', label: 'Tahta sayısı', min: 6, max: 18, step: 1 },
      hoopCount: { type: 'number', label: 'Çember sayısı', min: 0, max: 4, step: 1 },
      handle: { type: 'number', label: 'Kulp', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['staves', 'base', 'hoops', 'handle'],
  },
  'bronze-bell': {
    title: 'Bronze Bell',
    description:
      'Boyunduruğa asılı tunç çan. Tokmak gecikmeli sallanıp kenara vuruyor, vuruşlar sayılıyor.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'animated', 'interactive'],
    controls: {
      diameter: { type: 'number', label: 'Ağız çapı', min: 0.15, max: 1, step: 0.01, unit: 'm' },
      height: { type: 'number', label: 'Yükseklik', min: 0.15, max: 1.1, step: 0.01, unit: 'm' },
      yoke: { type: 'number', label: 'Boyunduruk boyu', min: 1, max: 2.2, step: 0.05 },
      swing: { type: 'number', label: 'Savrulma', min: 5, max: 60, step: 1, unit: '°' },
      damping: { type: 'number', label: 'Sönümlenme', min: 0.1, max: 3, step: 0.05 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['brass', 'iron', 'oak'],
    parts: ['bell', 'clapper', 'yoke'],
  },
  'iron-lantern': {
    title: 'Iron Lantern',
    description:
      'Altıgen demir kafes, cam paneller, içinde yağ kandili. Kapalı alev daha sakin titriyor.',
    category: 'Lighting',
    tags: ['medieval', 'lowpoly', 'lighting', 'animated', 'interactive'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.14, max: 0.5, step: 0.01, unit: 'm' },
      radius: { type: 'number', label: 'Yarıçap', min: 0.04, max: 0.15, step: 0.005, unit: 'm' },
      sides: { type: 'number', label: 'Köşe sayısı', min: 3, max: 8, step: 1 },
      flameHeight: { type: 'number', label: 'Alev boyu', min: 0.08, max: 0.45, step: 0.01 },
      flicker: { type: 'number', label: 'Titreme', min: 0, max: 2.5, step: 0.05 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['iron', 'glass', 'char', 'ember'],
    parts: ['frame', 'font', 'flame', 'handle'],
  },
  'tavern-sign': {
    title: 'Tavern Sign',
    description:
      'Dövme demir kola zincirle asılı tahta pano. İtildiğinde uzun ve tembel salınıyor.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'animated', 'interactive'],
    controls: {
      width: { type: 'number', label: 'Pano genişliği', min: 0.25, max: 1.1, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Pano yüksekliği', min: 0.2, max: 0.8, step: 0.02, unit: 'm' },
      reach: { type: 'number', label: 'Kol çıkıntısı', min: 0.3, max: 1.2, step: 0.02, unit: 'm' },
      drop: { type: 'number', label: 'Zincir boyu', min: 0.04, max: 0.35, step: 0.01, unit: 'm' },
      plankCount: { type: 'number', label: 'Tahta sayısı', min: 1, max: 6, step: 1 },
      damping: { type: 'number', label: 'Sönümlenme', min: 0.05, max: 2, step: 0.05 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['bracket', 'board'],
  },
  'leather-book': {
    title: 'Leather Book',
    description:
      'Deri kaplı, sırt bantlı, tokalı el yazması. Sayfa yığını kapaktan taşıyor ve dalgalı.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'tabletop', 'procedural'],
    controls: {
      width: { type: 'number', label: 'Genişlik', min: 0.08, max: 0.4, step: 0.005, unit: 'm' },
      length: { type: 'number', label: 'Boy', min: 0.1, max: 0.55, step: 0.005, unit: 'm' },
      thickness: { type: 'number', label: 'Kalınlık', min: 0.02, max: 0.16, step: 0.002, unit: 'm' },
      bands: { type: 'number', label: 'Sırt bandı', min: 0, max: 6, step: 1 },
      clasps: { type: 'number', label: 'Toka', min: 0, max: 3, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['leather', 'cloth', 'brass'],
    parts: ['cover', 'pages', 'clasps'],
  },
  'glass-phial': {
    title: 'Glass Phial',
    description:
      'Mantar tıpalı, mumla mühürlenmiş üflemeli cam şişe. Sıvı seviyesi doluluktan hesaplanıyor.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'alchemy', 'tabletop'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.06, max: 0.32, step: 0.005, unit: 'm' },
      radius: { type: 'number', label: 'Gövde yarıçapı', min: 0.015, max: 0.08, step: 0.002, unit: 'm' },
      neck: { type: 'number', label: 'Boyun oranı', min: 0.15, max: 0.55, step: 0.01 },
      fill: { type: 'number', label: 'Doluluk', min: 0, max: 1, step: 0.02 },
      hue: { type: 'number', label: 'Sıvı rengi', min: 0, max: 1, step: 0.01 },
      seal: { type: 'number', label: 'Mum mühür', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['glass', 'ember', 'oak', 'char'],
    parts: ['bottle', 'liquid', 'stopper'],
  },
  'coin-pouch': {
    title: 'Coin Pouch',
    description:
      'Büzgülü deri kese ve ağzından bir yana dökülmüş gümüş peniler.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'tabletop', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.05, max: 0.24, step: 0.005, unit: 'm' },
      radius: { type: 'number', label: 'Yarıçap', min: 0.02, max: 0.1, step: 0.002, unit: 'm' },
      fill: { type: 'number', label: 'Doluluk', min: 0.15, max: 1, step: 0.02 },
      coins: { type: 'number', label: 'Dökülen sikke', min: 0, max: 30, step: 1 },
      coinRadius: { type: 'number', label: 'Sikke yarıçapı', min: 0.005, max: 0.025, step: 0.001, unit: 'm' },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['leather', 'cloth', 'brass'],
    parts: ['pouch', 'cord', 'coins'],
  },
  'wicker-basket': {
    title: 'Wicker Basket',
    description:
      'Söğüt çubuğundan örülmüş sepet. Yatay çubuklar dikeylerin bir önünden bir arkasından geçiyor.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'farm', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 0.1, max: 0.5, step: 0.01, unit: 'm' },
      radius: { type: 'number', label: 'Ağız yarıçapı', min: 0.08, max: 0.35, step: 0.005, unit: 'm' },
      taper: { type: 'number', label: 'Taban daralması', min: 0, max: 0.45, step: 0.01 },
      stakes: { type: 'number', label: 'Dikey çubuk', min: 6, max: 18, step: 1 },
      rows: { type: 'number', label: 'Örgü sırası', min: 2, max: 14, step: 1 },
      produce: { type: 'number', label: 'Meyve sayısı', min: 0, max: 24, step: 1 },
      hue: { type: 'number', label: 'Meyve rengi', min: 0, max: 1, step: 0.01 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['straw', 'produce'],
    parts: ['weave', 'rim', 'contents'],
  },
  'wooden-ladder': {
    title: 'Wooden Ladder',
    description:
      'Üste doğru yaklaşan iki dikme ve geçme basamaklar.',
    category: 'Structure',
    tags: ['medieval', 'lowpoly', 'structure', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Yükseklik', min: 1, max: 5, step: 0.1, unit: 'm' },
      width: { type: 'number', label: 'Genişlik', min: 0.25, max: 0.8, step: 0.01, unit: 'm' },
      rungCount: { type: 'number', label: 'Basamak', min: 3, max: 18, step: 1 },
      taper: { type: 'number', label: 'Daralma', min: 0, max: 0.4, step: 0.01 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['rails', 'rungs'],
  },
  'wooden-fence': {
    title: 'Wooden Fence',
    description:
      'Modüler çit bölümü; direkler kirişlerden dışa taşar, boyları eşit değildir.',
    category: 'Structure',
    tags: ['medieval', 'lowpoly', 'structure', 'modular', 'procedural'],
    controls: {
      sections: { type: 'number', label: 'Bölüm', min: 1, max: 8, step: 1 },
      sectionLength: {
        type: 'number', label: 'Bölüm boyu',
        min: 0.8, max: 3, step: 0.1, unit: 'm',
      },
      height: { type: 'number', label: 'Yükseklik', min: 0.5, max: 2, step: 0.05, unit: 'm' },
      railCount: { type: 'number', label: 'Kiriş', min: 1, max: 4, step: 1 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['posts', 'rails'],
  },
  'wooden-hoe': {
    title: 'Wooden Hoe',
    description:
      'Sapa dik duran geniş ağız; toprakla temas eden yüzü parlamış çelik.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'farm', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Boy', min: 0.8, max: 2, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Sap kalınlığı',
        min: 0.012, max: 0.035, step: 0.001, unit: 'm',
      },
      bladeWidth: {
        type: 'number', label: 'Ağız genişliği',
        min: 0.08, max: 0.3, step: 0.005, unit: 'm',
      },
      bladeAngle: { type: 'number', label: 'Ağız açısı', min: 70, max: 125, step: 1, unit: '°' },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron', 'steel'],
    parts: ['shaft', 'socket', 'blade'],
  },
  'wooden-shovel': {
    title: 'Wooden Shovel',
    description:
      'Uca doğru hem genişleyen hem incelen, tek parça çukur çelik levha.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'farm', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Boy', min: 0.8, max: 1.8, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Sap kalınlığı',
        min: 0.014, max: 0.035, step: 0.001, unit: 'm',
      },
      bladeWidth: {
        type: 'number', label: 'Ağız genişliği',
        min: 0.12, max: 0.34, step: 0.005, unit: 'm',
      },
      bladeLength: { type: 'number', label: 'Ağız uzunluğu', min: 0.18, max: 0.4, step: 0.01 },
      dish: { type: 'number', label: 'Kepçe derinliği', min: 0, max: 0.28, step: 0.01 },
      bladeAngle: { type: 'number', label: 'Ağız eğimi', min: 0, max: 25, step: 1, unit: 'derece' },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron', 'steel'],
    parts: ['shaft', 'socket', 'blade'],
  },
  'wooden-pitchfork': {
    title: 'Wooden Pitchfork',
    description:
      'Dışa açılan çelik dişler; siluetteki boşluk sayesinde uzaktan ayırt edilir.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'farm', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Boy', min: 1, max: 2.4, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Sap kalınlığı',
        min: 0.012, max: 0.035, step: 0.001, unit: 'm',
      },
      tineCount: { type: 'number', label: 'Diş sayısı', min: 2, max: 6, step: 1 },
      spread: { type: 'number', label: 'Diş açıklığı', min: 0, max: 0.4, step: 0.01 },
      tineLength: { type: 'number', label: 'Diş uzunluğu', min: 0.1, max: 0.32, step: 0.01 },
      seed: { type: 'number', label: 'Varyasyon tohumu', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron', 'steel'],
    parts: ['shaft', 'socket', 'tines'],
  },
}
