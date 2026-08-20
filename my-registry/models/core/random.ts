/**
 * Deterministik rastgelelik.
 *
 * Prosedürel bir kitte varyasyon şart — mükemmel simetri "üretilmiş" gibi
 * okunur. Ama varyasyon tekrarlanabilir olmalı: aynı seed her zaman aynı
 * modeli vermeli, yoksa ne önizleme, ne test, ne de sanat yönetimi tutar.
 * Math.random() bu yüzden kullanılmıyor.
 *
 * mulberry32: 32-bit durum, hızlı, kriptografik değil ama görsel varyasyon
 * için fazlasıyla yeterli.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** -amount .. +amount aralığında simetrik sapma. */
export function jitter(random: () => number, amount: number): number {
  return (random() * 2 - 1) * amount
}
