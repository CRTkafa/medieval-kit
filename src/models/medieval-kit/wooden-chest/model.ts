/**
 * @medieval-kit/wooden-chest
 *
 * Altı tahtalı sandık — ortaçağın baskın sandık biçimi. Korsan filmlerindeki
 * fıçı kapaklı kasa aslında çok daha geç bir şey; dönemin sandığı düz kapaklı,
 * iki uç tahtası yere kadar inip ayağı oluşturan, önü demir kayışlarla
 * kuşatılmış bir kutudur.
 *
 * Kitin ilk EYLEMLİ modeli. Kapağın açılması `configure()` işi değil: sandığın
 * kimliği değişmiyor, sadece sahnedeki hâli değişiyor. Protokolün `actions`
 * alanı tam olarak bunun için var.
 *
 * Kapağın arkasındaki asıl mesele parçaların kardeş olması: kapak döndüğünde
 * üstündeki demir kayışlar ve kilit kancası da dönmek zorunda. Ayrı parça
 * olsalardı havada asılı kalırlardı. Bu yüzden hepsi tek parçanın `extras`
 * gövdeleri — anlam bölünmüyor, sadece materyal bölünüyor.
 */
import { Color } from 'three'

import {
  MEDIEVAL_PALETTE,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  ironTint,
  jitter,
  mergeColoured,
  prismGeometry,
} from '../core/index.ts'

export interface WoodenChestConfig {
  /** Genişlik — uzun kenar (metre). */
  readonly width: number
  /** Kapak kapalıyken toplam yükseklik (metre). */
  readonly height: number
  /** Derinlik (metre). */
  readonly depth: number
  /** Ön ve arka yüzdeki dikey demir kayış sayısı. */
  readonly bandCount: number
  /** Kapağın tam açıkken yaptığı açı (derece). */
  readonly openAngle: number
  readonly seed: number
}

export const woodenChestDefaults: WoodenChestConfig = {
  width: 0.82,
  height: 0.5,
  depth: 0.44,
  bandCount: 3,
  openAngle: 104,
  seed: 23,
}

export type WoodenChestParts = 'body' | 'lid' | 'bands' | 'lock'

export interface WoodenChestActions {
  /** Hedef durumu belirler. Hareket `update()` çağrıldıkça ilerler. */
  setOpen(open: boolean): void
  /** Aç ↔ kapat. Yeni HEDEF durumu döner. */
  toggle(): boolean
  /** Hedef durum — hareket bitmiş olmayabilir. */
  isOpen(): boolean
  /** Hareketin anlık ilerlemesi: 0 kapalı, 1 tam açık. */
  openness(): number
  /** Hareketi atlayıp hedefe anında oturtur. */
  snap(): void
}

export function createModel(overrides: Partial<WoodenChestConfig> = {}) {
  // Kapağın durumu inşanın DIŞINDA tutuluyor. `configure()` sandığı yeniden
  // kursa bile kapak açık kalmalı — yoksa genişliği değiştirmek kapağı
  // çarpardı.
  let target = 0
  let progress = 0

  return createKitModel<WoodenChestConfig, 'oak' | 'iron', WoodenChestParts, WoodenChestActions>({
    id: 'wooden-chest',
    defaults: woodenChestDefaults,
    slots: ['oak', 'iron'],

    build: ({ config, random }) => {
      const tint = new Color()
      const oak = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.05))
        return tint
      }

      const half = config.height / 2
      // Tahta kalınlığı EN KÜÇÜK ölçüye bağlı. Yalnız derinliğe bağlamak,
      // derin bir sandığı kalın tahtalı yapıyordu — gerçek sandık tahtası
      // sandığın boyutundan bağımsız olarak ~2 cm'dir.
      const board = Math.min(config.width * 0.5, config.height, config.depth) * 0.055
      const lidThickness = config.height * 0.075
      const footHeight = config.height * 0.14
      const bodyTop = half - lidThickness
      const bodyFloor = -half + footHeight
      const wallHeight = bodyTop - bodyFloor
      const strap = board * 0.3                   // demir kayış kalınlığı

      // --- GÖVDE ---------------------------------------------------------
      const bodyPieces = []

      // Uç tahtaları: sandığın taşıyıcıları. Aşağıda ikiye ayrılıp ayak
      // oluyorlar — altı tahtalı sandığı tanınır yapan detay bu.
      for (const side of [-1, 1]) {
        const x = side * (config.width / 2 - board / 2)
        bodyPieces.push(chamferedBoxGeometry(
          [board, config.depth],
          [board, config.depth],
          wallHeight,
          board * 0.22,
          [x, bodyFloor + wallHeight / 2, 0],
          oak(0.02),
        ))

        // Ayaklar. Uç tahtasının İÇİNE doğru uzatılıyorlar: üst yüzleri katı
        // malzemenin içinde kalsın ki hiçbir yüz çifti aynı düzleme oturmasın.
        const footDepth = config.depth * 0.3
        for (const end of [-1, 1]) {
          bodyPieces.push(boxGeometry(
            [board * 1.16, footHeight + board * 0.6, footDepth],
            [x, -half + (footHeight + board * 0.6) / 2, end * (config.depth / 2 - footDepth / 2)],
            oak(-0.05),
          ))
        }
      }

      // Ön ve arka tahtalar: uç tahtalarının arasına giriyor ve uçlarından
      // biraz onların içine batıyor (z-fighting kuralı).
      for (const face of [1, -1]) {
        bodyPieces.push(chamferedBoxGeometry(
          [config.width - board * 1.3, board],
          [config.width - board * 1.3, board],
          wallHeight - board * 0.36,
          board * 0.2,
          [0, bodyFloor + wallHeight / 2, face * (config.depth / 2 - board / 2)],
          oak(face > 0 ? 0.03 : -0.02),
        ))
      }

      // Taban: dört duvara da batıyor.
      bodyPieces.push(boxGeometry(
        [config.width - board * 1.3, board, config.depth - board * 1.3],
        [0, bodyFloor + board * 0.6, 0],
        oak(-0.08),
      ))

      // --- KAPAK ---------------------------------------------------------
      // Menteşe: arka üst kenar. Kapak geometrisi BU NOKTAYA GÖRE yazılıyor,
      // anchor oraya taşınıyor, `rotation.x` artık kapağı açıyor.
      const overhang = board * 0.85
      const lidDepth = config.depth + overhang
      const lid = mergeColoured([chamferedBoxGeometry(
        [config.width + overhang * 2, lidDepth],
        [config.width + overhang * 1.7, lidDepth - overhang * 0.15],
        lidThickness,
        board * 0.18,
        [0, lidThickness / 2 - board * 0.3, lidDepth / 2],
        oak(0.06),
      )])

      // --- DEMİR ---------------------------------------------------------
      // Kayışlar gövdede biter, kapakta devam eder. Kapalıyken tek parça gibi
      // okunur, açılınca menteşe hattından ayrılır — gerçek kayış menteşenin
      // kendisi zaten budur.
      const count = Math.max(0, Math.round(config.bandCount))
      const strapWidth = config.width * 0.055
      const bandXs = Array.from({ length: count }, (_, i) =>
        count === 1 ? 0 : (i / (count - 1) - 0.5) * config.width * 0.66)

      const bandPieces = []
      const lidIron = []

      // Ön yüzün ortası KİLİDİN yeri. Gerçek sandıkta oraya kayış konmaz —
      // aynalık zaten o işi görür. Kural hem doğru hem de bir hata sınıfını
      // kökten kapatıyor: kayışla kilit köprüsü aynı yerde olduğunda üst
      // yüzleri belli ölçülerde aynı düzleme oturup titriyordu.
      const lockSpan = config.width * 0.075 + strapWidth * 0.7
      const clearsLock = (x: number): boolean => Math.abs(x) > lockSpan

      for (const x of bandXs) {
        const front = clearsLock(x)
        for (const face of [1, -1]) {
          if (face > 0 && !front) continue
          const z = face * (config.depth / 2 + strap * 0.2)
          // Gövde kayışı: tahtanın Y aralığının tamamen İÇİNDE kalıyor,
          // yoksa alt ve üst yüzleri tahtanınkiyle eş düzlem oluyor.
          bandPieces.push(boxGeometry(
            [strapWidth, wallHeight - board * 0.9, strap],
            [x, bodyFloor + wallHeight / 2, z],
            ironTint(random, -0.02),
          ))
        }

        if (front) {
          // Kapak kayışı: üstten arkaya doğru uzanıp menteşe hattında biter.
          lidIron.push(boxGeometry(
            [strapWidth, strap, lidDepth * 0.92],
            [x, lidThickness + strap * 0.3, lidDepth * 0.46],
            ironTint(random, 0.02),
          ))
          // Ön kenardan aşağı kıvrılan uç.
          lidIron.push(boxGeometry(
            [strapWidth, lidThickness * 1.5, strap],
            [x, lidThickness * 0.35, lidDepth - strap * 0.2],
            ironTint(random),
          ))
        }
      }

      // Menteşe silindirleri TAM olarak yerel orijinde durmalı: dönme ekseni
      // orası. Bir tık kaydırmak yeterdi ki kapak açılırken menteşe de bir yay
      // çizsin — gerçek menteşe kendi ekseninde döner, yer değiştirmez.
      //
      // Altıgen prizmanın düz yüzleri de eğiliyor: yatay duran bir yüz kapağın
      // alt yüzüyle aynı düzleme oturup titriyordu.
      const barrel = strap * 1.45
      for (const x of bandXs) {
        const pin = prismGeometry(barrel, barrel, strapWidth * 1.2, 6, [0, 0, 0],
          ironTint(random, 0.04))
        pin.rotateZ(Math.PI / 2)
        pin.rotateX(Math.PI / 12)
        pin.translate(x, 0, 0)
        lidIron.push(pin)
      }

      // Uç tahtalarına da birer dikey kayış — sandık her yönden demirli olsun.
      for (const side of [-1, 1]) {
        bandPieces.push(boxGeometry(
          [strap, wallHeight * 0.78, config.depth * 0.16],
          [side * (config.width / 2 + strap * 0.2), bodyFloor + wallHeight / 2, 0],
          ironTint(random, -0.04),
        ))
      }

      // --- KİLİT ---------------------------------------------------------
      // Aynalık (escutcheon) gövdede, kanca (hasp) kapakta. İkisi ayrı yerde
      // olmak zorunda: biri sabit, diğeri kapakla birlikte kalkıyor.
      const plateHeight = config.height * 0.19
      const lockZ = config.depth / 2 + strap * 0.2
      const lock = mergeColoured([
        chamferedBoxGeometry(
          [config.width * 0.15, strap * 1.6],
          [config.width * 0.115, strap * 1.6],
          plateHeight,
          strap * 0.5,
          [0, bodyTop - plateHeight * 0.62, lockZ],
          ironTint(random, 0.05),
        ),
        // Kancanın geçtiği köprü.
        boxGeometry(
          [config.width * 0.05, strap * 2.2, strap * 2.6],
          [0, bodyTop - plateHeight * 0.32, lockZ + strap * 0.9],
          ironTint(random, 0.09),
        ),
      ])

      // Kanca: kapağın ön kenarından aşağı sarkıp köprünün üstüne oturur.
      lidIron.push(boxGeometry(
        [config.width * 0.075, plateHeight * 0.62, strap * 1.2],
        [0, lidThickness * 0.5 - plateHeight * 0.31, lidDepth + strap * 0.35],
        ironTint(random, 0.07),
      ))

      return {
        body: { slot: 'oak' as const, geometry: mergeColoured(bodyPieces) },
        lid: {
          slot: 'oak' as const,
          geometry: lid,
          origin: [0, bodyTop, -config.depth / 2] as const,
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(lidIron) }],
        },
        bands: { slot: 'iron' as const, geometry: mergeColoured(bandPieces) },
        lock: { slot: 'iron' as const, geometry: lock },
      }
    },

    actions: ({ parts, getConfig }) => {
      const apply = (): void => {
        parts.lid.anchor.rotation.x = -(getConfig().openAngle * Math.PI / 180) * progress
      }
      apply()
      return {
        setOpen: (open) => { target = open ? 1 : 0 },
        toggle: () => { target = target > 0.5 ? 0 : 1; return target > 0.5 },
        isOpen: () => target > 0.5,
        openness: () => progress,
        snap: () => { progress = target; apply() },
      }
    },

    update: (dt, { parts, getConfig }) => {
      if (progress === target) return
      // Üstel yaklaşma: kare süresinden BAĞIMSIZ. `progress += diff * k` gibi
      // saf bir lerp 30 fps'te 120 fps'ten yavaş açardı.
      progress += (target - progress) * (1 - Math.exp(-9 * Math.max(0, dt)))
      // Üstel yaklaşma hedefe hiç varmaz; eşiğe gelince oturtuluyor ki
      // `openness()` gerçekten 1 dönebilsin.
      if (Math.abs(target - progress) < 0.0015) progress = target
      parts.lid.anchor.rotation.x = -(getConfig().openAngle * Math.PI / 180) * progress
    },
  }, overrides)
}
