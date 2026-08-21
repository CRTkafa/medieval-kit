/**
 * @medieval-kit/log-pile
 *
 * Kesilmiş odun yığını. Kitin en ucuz modellerinden ve sahne değeri en
 * yükseklerinden: bir duvar dibine koyduğun anda orası "yaşanan bir yer" olur.
 *
 * Yığını yığın yapan üç şey:
 *   - Kütük ucu (damar kesiti) kabuktan çok daha açıktır. Yığına bakınca ilk
 *     gördüğün şey o açık daireler.
 *   - Hiçbir kütük komşusuyla aynı çapta, boyda, açıda ya da dönüşte değildir.
 *   - Ve en önemlisi: her kütük ALTINDAKİLERE OTURUR.
 *
 * O sonuncusu iki denemede birden yanlıştı. Önce sabit satır yüksekliği
 * kullandım, sonra "en kalın kütüğe göre" hesapladım — ikisinde de kalın
 * kütükler alttakinin içine giriyor, ince olanlar havada kalıyordu. Doğrusu
 * her kütük için gerçek temas yüksekliğini çözmek: iki dairenin teğet olduğu
 * nokta. Aşağıdaki `restingHeight` tam olarak bunu yapıyor ve yığın artık
 * kendiliğinden oturuyor — hangi yarıçap gelirse gelsin.
 */
import { Color, type BufferGeometry } from 'three'

import {
  MEDIEVAL_PALETTE,
  createKitModel,
  headGeometry,
  jitter,
  latheGeometry,
  mergeColoured,
  type Level,
} from '../core/index.ts'

export interface LogPileConfig {
  /** Kaç sıra. */
  readonly rows: number
  /** Alt sıradaki kütük sayısı. */
  readonly perRow: number
  /** Kütük uzunluğu (metre). */
  readonly logLength: number
  /** Ortalama kütük yarıçapı (metre). */
  readonly logRadius: number
  /** Kalınlık çeşitliliği. 0 = hepsi aynı çapta. */
  readonly variation: number
  /** Piramit gibi mi (1) yoksa düz istif mi (0). */
  readonly taperRows: number
  readonly seed: number
}

export const logPileDefaults: LogPileConfig = {
  rows: 3,
  perRow: 5,
  logLength: 0.62,
  logRadius: 0.065,
  variation: 0.22,
  taperRows: 1,
  seed: 41,
}

export type LogPileParts = 'bark' | 'ends'

interface Placed {
  readonly x: number
  readonly y: number
  readonly r: number
}

/**
 * Yarıçapı `r` olan, `x` konumundaki bir kütüğün oturacağı yükseklik.
 *
 * Altındaki her kütükle teğet olduğu yüksekliği hesaplayıp en yükseğini alır;
 * hiçbirine değmiyorsa yere oturur. İki dairenin teğet olması demek merkezleri
 * arası mesafenin yarıçaplar toplamına eşit olması demek, yani dikey mesafe
 * √((r₁+r₂)² − Δx²).
 */
function restingHeight(x: number, r: number, below: readonly Placed[], ground: number): number {
  let y = ground + r
  for (const other of below) {
    const dx = Math.abs(x - other.x)
    const reach = r + other.r
    if (dx >= reach) continue
    y = Math.max(y, other.y + Math.sqrt(reach * reach - dx * dx))
  }
  return y
}

export function createModel(overrides: Partial<LogPileConfig> = {}) {
  return createKitModel<LogPileConfig, 'oak', LogPileParts>({
    id: 'log-pile',
    defaults: logPileDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = new Color()
      const barkTint = (): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.016), jitter(random, 0.07), -0.06 + jitter(random, 0.07))
        return tint
      }
      const endTint = (): Color => {
        tint.copy(MEDIEVAL_PALETTE.oakEnd)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), 0.07 + jitter(random, 0.05))
        return tint
      }

      const bark: BufferGeometry[] = []
      const ends: BufferGeometry[] = []
      const rows = Math.max(1, config.rows)
      const spread = Math.max(0, Math.min(0.6, config.variation))
      let below: Placed[] = []

      for (let row = 0; row < rows; row += 1) {
        const inRow = Math.max(1, config.perRow - (config.taperRows >= 0.5 ? row : 0))
        const radii = Array.from({ length: inRow },
          () => config.logRadius * (1 - spread + random() * spread * 2))

        // Yatayda komşu kütükler teğet: aralık iki yarıçapın toplamı. Sabit
        // aralık kullanmak kalın olanları birbirine sokuyordu.
        const gaps = radii.slice(0, -1).map((r, i) => r + radii[i + 1]!)
        const rowWidth = gaps.reduce((sum, w) => sum + w, 0)
        // Üst sıralar alttakilerin OLUĞUNA otursun diye kaydırılıyor; kayma
        // yönü dönüşümlü, yoksa yığın tek yana yatıyor.
        const shift = (row % 2 === 1 ? 1 : -1) * config.logRadius * 0.5
          + jitter(random, config.logRadius * 0.1)

        const placed: Placed[] = []
        let cursor = -rowWidth / 2 + shift
        for (let i = 0; i < inRow; i += 1) {
          const radius = radii[i]!
          const x = cursor
          if (i < gaps.length) cursor += gaps[i]!
          placed.push({ x, y: restingHeight(x, radius, below, 0), r: radius })
        }

        for (const log of placed) {
          const length = config.logLength * (0.86 + random() * 0.28)

          // Gövde: uçları kapatılmıyor, damar kesiti ayrı diskler. Böylece
          // kabuk ve kesit birbirinden çok farklı renk alabiliyor.
          //
          // KRİTİK: hiçbir yerde `log.r`'yi AŞMAMALI. Önceki hâlde uçlar
          // `log.r * (1 ± 0.05)` idi, yani %5'e kadar şişmanlıyordu; yerleşim
          // ise `log.r` ile hesaplandığı için komşular uçlarında %10'a kadar
          // iç içe giriyordu. Kütük artık yalnızca İNCELİYOR — hem hata
          // kapanıyor hem gerçek kütük zaten uca doğru incelir.
          const taperA = 1 - random() * 0.1
          const taperB = 1 - random() * 0.1
          const profile: Level[] = [
            { y: -length / 2, radius: log.r * taperA },
            { y: 0, radius: log.r },
            { y: length / 2, radius: log.r * taperB },
          ]
          const body = latheGeometry(profile, 7, [0, 0, 0], barkTint(), {
            capTop: false,
            capBottom: false,
          })
          const grain = endTint()
          const capA = headGeometry(profile.at(-1)!.radius, length / 2, 7, 'up', grain, 3, 0.07)
          const capB = headGeometry(profile[0]!.radius, -length / 2, 7, 'down', grain, 3, 0.07)

          // Her kütük kendi ekseninde rastgele dönük: hepsinin fasetleri aynı
          // açıda olunca yığın mekanik görünüyor, üstelik yan yana gelenlerin
          // yüzeyleri paralel kalıp çakışabiliyordu.
          const roll = random() * Math.PI * 2
          const tilt = jitter(random, 0.04)
          for (const [target, geometry] of [[bark, body], [ends, capA], [ends, capB]] as const) {
            geometry.rotateY(roll)
            geometry.rotateZ(Math.PI / 2)
            geometry.rotateY(tilt)
            geometry.translate(log.x, log.y, jitter(random, config.logLength * 0.015))
            target.push(geometry)
          }
        }

        below = placed
      }

      return {
        bark: { slot: 'oak', geometry: mergeColoured(bark) },
        ends: { slot: 'oak', geometry: mergeColoured(ends) },
      }
    },
  }, overrides)
}
