import { Color } from 'three'

import { MEDIEVAL_PALETTE, type MedievalPalette } from './materials.ts'
import { jitter } from './random.ts'

/**
 * Paletten sapmalı renk üreten fabrika.
 *
 * Her model bunu kendi içinde yeniden yazıyordu — aynı beş satır on üç kez.
 * Tekrarın maliyeti sadece satır sayısı değildi: sapma miktarları modelden
 * modele kaymıştı, dolayısıyla iki model yan yana konduğunda birinin varyasyonu
 * gözle görülür şekilde daha yüksekti.
 *
 * Dönen Color HER ÇAĞRIDA AYNI NESNEDİR. Geometri fonksiyonları rengi anında
 * okuyup vertex'lere yazdığı için bu sorun değil ve çağrı başına bir Color
 * ayırmaktan çok daha ucuz. Ama saklamak isteyen `new Color(tint(...))`
 * yapmalı — aksi hâlde sonraki çağrı elindekini değiştirir.
 */
export function createTinter(random: () => number) {
  const scratch = new Color()
  return (
    key: keyof MedievalPalette,
    /** Parlaklık kayması. Negatif koyultur. */
    lift = 0,
    /** Sapma çarpanı. 0 tamamen düz renk verir. */
    spread = 1,
  ): Color => {
    scratch.copy(MEDIEVAL_PALETTE[key])
    scratch.offsetHSL(
      jitter(random, 0.012 * spread),
      jitter(random, 0.05 * spread),
      lift + jitter(random, 0.05 * spread),
    )
    return scratch
  }
}

export type Tinter = ReturnType<typeof createTinter>
