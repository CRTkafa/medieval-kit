/**
 * @medieval-kit/pitch-torch
 *
 * Ziftli meşale: budaklı bir sopa, ucuna sarılmış zift emdirilmiş bez, üstünde
 * alev. Dönemin aydınlatması tam olarak bu — mum pahalıydı, meşale bedavaydı.
 *
 * Kitin ilk ANİMASYONLU modeli. Alev `update()` ile titriyor ve titremenin
 * kaynağı rastgelelik DEĞİL, geçen sürenin sinüs toplamı. Bunun üç sebebi var:
 *
 *   - Rastgelelik determinizmi bozar. Kitin her yerinde `Math.random()` yasak;
 *     alev de istisna olamaz, yoksa aynı tohumlu iki meşale ayrışır.
 *   - Uyumsuz frekanslı iki sinüs gözle "tekrar etmeyen" bir salınım veriyor.
 *     Tek sinüs metronom gibi atardı.
 *   - Tüketici `update()` çağırmazsa model tamamen durur. Kendi kendine dönen
 *     bir zamanlayıcı kurmak protokolün "tüketici döngüye sahiptir" ilkesini
 *     çiğnerdi.
 *
 * Alev ayrıca ışık YAYMAZ. Meşalenin sahneyi aydınlatması isteniyorsa tüketici
 * `parts.flame.anchor`'a bir PointLight takar — modelin sahnenin ışık bütçesi
 * hakkında varsayım yapmaya hakkı yok.
 */
import {
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface PitchTorchConfig {
  /** Toplam sap uzunluğu (metre). */
  readonly length: number
  /** Sap yarıçapı (metre). */
  readonly radius: number
  /** Bez sargının uzunluğu, sapın oranı olarak. */
  readonly wrapLength: number
  /** Alev yüksekliği, sargı uzunluğunun oranı olarak. */
  readonly flameHeight: number
  /** Titremenin genliği. 0 = sabit alev. */
  readonly flicker: number
  readonly seed: number
}

export const pitchTorchDefaults: PitchTorchConfig = {
  length: 0.58,
  radius: 0.019,
  wrapLength: 0.3,
  flameHeight: 1.15,
  flicker: 1,
  seed: 37,
}

export type PitchTorchParts = 'shaft' | 'wrap' | 'flame'

export interface PitchTorchActions {
  /** Alevi yakar/söndürür. Sönükken `flame` parçası tamamen gizlenir. */
  setLit(lit: boolean): void
  isLit(): boolean
}

export function createModel(overrides: Partial<PitchTorchConfig> = {}) {
  // Durum inşanın DIŞINDA: `configure()` meşaleyi söndürmemeli.
  let lit = true
  let elapsed = 0

  return createKitModel<PitchTorchConfig, 'oak' | 'char' | 'ember', PitchTorchParts, PitchTorchActions>({
    id: 'pitch-torch',
    defaults: pitchTorchDefaults,
    slots: ['oak', 'char', 'ember'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.length / 2
      const wrapLength = config.length * config.wrapLength
      const wrapBase = half - wrapLength

      // --- Sap -----------------------------------------------------------
      // Budaklı bir dal: yarıçapı boyunca dalgalanıyor. Düz bir silindir
      // fabrikasyon görünürdü, oysa meşale ormandan kesilmiş bir çubuktur.
      const knots = 6
      const shaftProfile: Level[] = Array.from({ length: knots + 1 }, (_, i) => {
        const t = i / knots
        return {
          y: -half + config.length * (1 - config.wrapLength) * t,
          radius: config.radius * (1 + jitter(random, 0.16)) * (i === 0 ? 0.82 : 1),
        }
      })
      const shaft = mergeColoured([latheGeometry(
        shaftProfile, 6, [0, 0, 0], tint('oak', -0.08),
        { colourTop: tint('oak', -0.02) },
      )])

      // --- Sargı ---------------------------------------------------------
      // Zift emdirilmiş bez: sapa göre kalın, uca doğru şişkin, tepesi düz.
      // Kömür yuvası kullanılıyor çünkü zift kurumla kaplanır — meşe rengi
      // burada yalan olurdu.
      const wrapProfile: Level[] = [
        { y: wrapBase - wrapLength * 0.12, radius: config.radius * 1.15 },
        { y: wrapBase + wrapLength * 0.22, radius: config.radius * 2.35 },
        { y: wrapBase + wrapLength * 0.62, radius: config.radius * 2.5 },
        { y: half, radius: config.radius * 2.05 },
      ]
      const wrap = mergeColoured([latheGeometry(
        wrapProfile, 7, [0, 0, 0], tint('char', 0.06),
        { colourTop: tint('charHot', -0.12) },
      )])

      // --- Alev ----------------------------------------------------------
      // Alev geometrisi KENDİ orijininde üretiliyor ve anchor sargının ucuna
      // taşınıyor. Titreme anchor'ın ölçeğini oynattığı için bu şart: orijini
      // dipte olmayan bir alev, ölçeklenince sargının içine gömülürdü.
      const flameHeight = wrapLength * config.flameHeight
      // Alev profili ikinci hâli. İlki tek eğriyle dipten uca inceliyordu ve
      // render'da ROKET BURNU gibi duruyordu — pürüzsüz, simetrik, sivri.
      // Alev öyle değil: dibi geniş ve şişkin, ortasında bir boğum, ucu ise
      // sivri değil YIRTIK. Aşağıdaki profil o boğumu veriyor, `roughen` de
      // simetriyi bozuyor.
      const flameProfile: Level[] = [
        { y: 0, radius: config.radius * 2.05 },
        { y: flameHeight * 0.14, radius: config.radius * 2.75 },
        { y: flameHeight * 0.34, radius: config.radius * 2.15 },
        { y: flameHeight * 0.5, radius: config.radius * 2.4 },
        { y: flameHeight * 0.72, radius: config.radius * 1.35 },
        { y: flameHeight * 0.9, radius: config.radius * 0.8 },
        { y: flameHeight, radius: config.radius * 0.22 },
      ]
      const outer = latheGeometry(flameProfile, 6, [0, 0, 0], tint('ember', 0.04, 0.4),
        { colourTop: tint('emberTip', 0, 0.4), capBottom: true })
      roughenGeometry(outer, config.radius * 0.3, { salt: 5, scaleY: 1.6 })

      const flame = mergeColoured([
        outer,
        // İç çekirdek: dıştakinden daha küçük ve daha beyaz. İki katman
        // alevin derinliği olduğu izlenimini veriyor — tek koni yassı durur.
        //
        // Dibi KAPATILMIYOR: dış koninin tabanıyla aynı düzleme oturup
        // titriyordu. Zaten dışın içinde kaldığı için görünmez, dolayısıyla
        // kapak hem gereksiz hem zararlıydı.
        prismGeometry(
          config.radius * 1.25, config.radius * 0.1, flameHeight * 0.48, 5,
          [0, flameHeight * 0.3, 0], tint('ember', 0.22, 0.3),
          { capBottom: false },
        ),
      ])

      return {
        shaft: { slot: 'oak' as const, geometry: shaft },
        wrap: { slot: 'char' as const, geometry: wrap },
        flame: {
          slot: 'ember' as const,
          geometry: flame,
          origin: [0, half - wrapLength * 0.12, 0] as const,
        },
      }
    },

    actions: ({ parts }) => {
      parts.flame.anchor.visible = lit
      return {
        setLit: (next) => { lit = next; parts.flame.anchor.visible = next },
        isLit: () => lit,
      }
    },

    update: (dt, { parts, getConfig }) => {
      // Sönük meşale ilerlemez: yeniden yakıldığında alev kaldığı yerden
      // değil, aynı faz noktasından devam etsin diye. Aksi hâlde uzun süre
      // sönük kalan bir meşale yanınca rastgele bir boyda başlardı.
      if (!lit) return
      const config = getConfig()
      const amount = config.flicker
      if (amount === 0) return
      elapsed += Math.max(0, dt)

      // Uyumsuz frekanslar: 11.3 ve 19.7 birbirinin katı değil, dolayısıyla
      // toplamın periyodu gözle yakalanamayacak kadar uzun.
      const pulse = Math.sin(elapsed * 11.3) * 0.09 + Math.sin(elapsed * 19.7 + 1.4) * 0.055
      const sway = Math.sin(elapsed * 7.1 + 0.6) * 0.05 + Math.sin(elapsed * 13.9) * 0.028

      const anchor = parts.flame.anchor
      // Boy ve en TERS yönde oynuyor: alev uzarken incelir. Aynı yönde
      // ölçeklemek alevi nefes alan bir balon gibi gösteriyordu.
      anchor.scale.set(1 - pulse * 0.55 * amount, 1 + pulse * amount, 1 - pulse * 0.55 * amount)
      anchor.rotation.z = sway * amount
      anchor.rotation.x = Math.sin(elapsed * 9.4 + 2.1) * 0.038 * amount
    },
  }, overrides)
}
