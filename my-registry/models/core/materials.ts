import { Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three'

import type { ResourceScope } from '@vibe3d/ownership.ts'

/**
 * Kitin paylaşılan materyal seti.
 *
 * Kritik tercih: her materyal `vertexColors: true`. Renk varyasyonu materyalde
 * değil GEOMETRİDE taşınıyor. Böylece 13 tahtanın 13 ayrı tonu olabiliyor ama
 * hepsi tek materyali, dolayısıyla tek çizim çağrısını paylaşıyor.
 *
 * Bu, scifi-kit'in aşınma boru hattındaki fikrin küçük hâli: yüzey kimliğini
 * vertex attribute'una yaz, sonra birleştir.
 */
export type MedievalSlot =
  | 'oak'      // kereste
  | 'iron'     // dövme demir
  | 'steel'    // kullanımdan parlamış çelik
  | 'brass'    // tunç ve bakır: çan, sikke
  | 'straw'    // saman, hasır, süpürge teli
  | 'cloth'    // keten, çuval bezi, tirşe
  | 'leather'  // deri: kitap kabı, kese
  | 'glass'    // üflemeli cam
  | 'ember'    // alev — ışık almaz, yayar
  | 'char'     // kömür, zift

/**
 * Her yuvanın materyal TİPİ farklı olabilir. `ember` aydınlatılmayan bir
 * MeshBasicMaterial; diğerleri PBR. Bu eşleme sayesinde model kodu hangi tipi
 * aldığını derleme zamanında biliyor.
 */
export interface SlotMaterial {
  readonly oak: MeshStandardMaterial
  readonly iron: MeshStandardMaterial
  readonly steel: MeshStandardMaterial
  readonly brass: MeshStandardMaterial
  readonly straw: MeshStandardMaterial
  readonly cloth: MeshStandardMaterial
  readonly leather: MeshStandardMaterial
  readonly glass: MeshStandardMaterial
  readonly ember: MeshBasicMaterial
  readonly char: MeshStandardMaterial
}

export interface MedievalPalette {
  /** Meşe gövde tonu. */
  readonly oak: Color
  /** Kapak tahtası — gövdeden biraz daha soğuk ve açık (damar ucu). */
  readonly oakEnd: Color
  /** Dövme demir: örsten yeni çıkmış, oksit tabakası hâlâ üstünde. */
  readonly iron: Color
  /** Kullanımdan parlamış çelik: örsün yüzü, küreğin ağzı, çatalın ucu. */
  readonly steel: Color
  /** Tunç — çan, havan, sikke. */
  readonly brass: Color
  /** Kuru saman. */
  readonly straw: Color
  /** Güneşte ağarmış saman ucu. */
  readonly strawPale: Color
  /** Ham keten / çuval bezi. */
  readonly cloth: Color
  /** İşlenmiş deri. */
  readonly leather: Color
  /** Üflemeli cam — hafif yeşilimsi, dönemin camı berrak değildi. */
  readonly glass: Color
  /** Alev dibi — sıcak ve parlak. */
  readonly ember: Color
  /** Alev ucu — daha doygun, daha kırmızı. */
  readonly emberTip: Color
  /** Sönmüş kömür. */
  readonly char: Color
  /** Kor hâlindeki kömür. */
  readonly charHot: Color
}

/**
 * Renkler sRGB olarak yazılır; three, ColorManagement açıkken bunları içeride
 * lineer uzayda saklar. Vertex color attribute'u lineer beklediği için
 * `color.r/g/b` doğrudan yazılabilir — ekstra dönüşüm gerekmez.
 */
export const MEDIEVAL_PALETTE: MedievalPalette = {
  oak: new Color(0x8a5a34),
  oakEnd: new Color(0x9a7350),
  iron: new Color(0x40464d),
  steel: new Color(0x8d979f),
  brass: new Color(0xa9843f),
  straw: new Color(0xc2a049),
  strawPale: new Color(0xdcc182),
  cloth: new Color(0xb9a888),
  leather: new Color(0x6b452c),
  glass: new Color(0xbcd4cb),
  ember: new Color(0xffd27a),
  emberTip: new Color(0xd8571b),
  char: new Color(0x241f1c),
  charHot: new Color(0xc4441a),
}

/**
 * İstenen yuvalar için materyal üretir.
 *
 * Slot listesi bilerek zorunlu: mangalın meşeye, fıçının emissive materyale
 * ihtiyacı yok. Kullanılmayan materyal üretmek hem boşuna GPU kaynağı hem de
 * modelin `materialSlots` bildirimiyle çelişen bir yalan olur.
 *
 * Dönüş tipi istenen yuvalara daraltılır, yani `materials.ember` sadece onu
 * isteyen modelde derlenir.
 */
export function createMedievalMaterials<S extends MedievalSlot>(
  scope: ResourceScope,
  slots: readonly S[],
): Pick<SlotMaterial, S> {
  const build: { [K in MedievalSlot]: () => SlotMaterial[K] } = {
    oak: () => new MeshStandardMaterial({
      name: 'medieval-kit / oak',
      // Beyaz taban: tüm renk bilgisi vertex color'dan geliyor, materyal onu
      // çarpmasın diye.
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
    }),
    // Demir iki hâlde bulunur ve bunlar TEK materyalle anlatılamaz. Örsün
    // gövdesi dövülmüş, oksitli, mat; yüzü ise üstünde yıllarca çalışıldığı
    // için ayna gibi. Aradaki fark rengin değil PÜRÜZLÜLÜĞÜN farkı — vertex
    // color bunu taşıyamaz, çünkü roughness bir attribute değil.
    //
    // Bu yüzden iki yuva: `iron` dövme yüzey, `steel` işin değdiği yüzey.
    // Bir modelin ikisini birden istemesi normaldir; ayrı çizim çağrısına
    // değer, çünkü parlak bir kesici ağız modeli tek başına satar.
    iron: () => new MeshStandardMaterial({
      name: 'medieval-kit / wrought iron',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.78,
    }),
    steel: () => new MeshStandardMaterial({
      name: 'medieval-kit / burnished steel',
      color: 0xffffff,
      vertexColors: true,
      // Düşük roughness + yüksek metalness, yani neredeyse tamamen yansıtıcı.
      // Bu ancak ortam haritası varsa işe yarar; environment'ı olmayan bir
      // sahnede kapkara görünür. Viewer PMREM'li bir gökyüzü sağlıyor.
      roughness: 0.19,
      metalness: 0.95,
    }),
    brass: () => new MeshStandardMaterial({
      name: 'medieval-kit / bronze',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.85,
    }),
    // Saman ve bez tamamen mat: metalness 0, roughness neredeyse 1. Aradaki
    // fark rakamlarda değil vertex renklerinde — ikisi de aynı ışık modeline
    // uyuyor ama ayrı yuvada durmaları önemli, çünkü modelin `materialSlots`
    // bildirimi bir SÖZLEŞMEDİR: samandan bir balyanın "meşe" yuvası
    // bildirmesi tüketiciye söylenmiş bir yalan olurdu.
    straw: () => new MeshStandardMaterial({
      name: 'medieval-kit / straw',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
    }),
    cloth: () => new MeshStandardMaterial({
      name: 'medieval-kit / linen',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.97,
      metalness: 0,
    }),
    leather: () => new MeshStandardMaterial({
      name: 'medieval-kit / leather',
      color: 0xffffff,
      vertexColors: true,
      // Deri tamamen mat değildir; yağlandığı için hafif bir parlaklığı vardır.
      roughness: 0.66,
      metalness: 0,
    }),
    // Cam ince bir KABUK, katı bir blok değil. İki sonucu var: `side`
    // DoubleSide olmak zorunda (yoksa içeriden bakınca kayboluyor) ve
    // `depthWrite` kapalı olmalı (yoksa arkasındaki fitili gizliyor).
    glass: () => new MeshStandardMaterial({
      name: 'medieval-kit / blown glass',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: DoubleSide,
    }),
    // Alev ışık ALMAZ, yayar. MeshStandardMaterial burada yanlış araç olurdu:
    // `emissive` tek bir Color'dır, vertex renklerinden beslenmez — yani
    // alevin dibinden ucuna renk geçişi yapılamaz. MeshBasicMaterial
    // aydınlatmayı tamamen atlar ve vertex rengini olduğu gibi gösterir;
    // toneMapped kapalı ki sahne pozlaması alevi söndürmesin.
    ember: () => new MeshBasicMaterial({
      name: 'medieval-kit / ember',
      color: 0xffffff,
      vertexColors: true,
      toneMapped: false,
    }),
    char: () => new MeshStandardMaterial({
      name: 'medieval-kit / charcoal',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    }),
  }

  const materials = {} as { [K in S]: SlotMaterial[K] }
  for (const slot of slots) {
    // TypeScript ilişkili birleşimleri (correlated unions) takip edemiyor:
    // `build[slot]` bir fonksiyon birleşimine genişliyor, dolayısıyla dönüşün
    // tam olarak SlotMaterial[slot] olduğunu bilemiyor. Eşleme yukarıda elle
    // kurulduğu için dönüşüm güvenli.
    materials[slot] = scope.ownMaterial(build[slot]()) as SlotMaterial[S]
  }
  return materials
}
