import type { BufferGeometry } from 'three'

/**
 * Vertex renklerine pişmiş ortam kapanması (ambient occlusion).
 *
 * Neden doku değil bu: bitmap doku üç şey getirirdi — UV koordinatları
 * (geometrimizde yok), registry'nin taşıması gereken görüntü dosyaları, ve
 * kitin kimliğinin değişmesi. Lowpoly + düz gölgeleme + vertex renk tutarlı
 * bir stil; yarım yamalak doku onu bozar.
 *
 * Bunun yerine yüzeyin KENDİ biçiminden karartma üretiyoruz: bir nokta ne
 * kadar çok komşu yüzeyle çevriliyse o kadar az gökyüzü görür. Sonuç, oyuk ve
 * temas noktalarında koyulaşma — tahtaların arası, çemberin altı, kütüklerin
 * değdiği yer. Modeller birden "kullanılmış" görünüyor ve maliyeti sıfır
 * bellek, sıfır doku.
 *
 * Yöntem: üçgen ağırlık merkezlerinden bir ızgara kuruluyor, sonra her vertex
 * için kendi normal yarıküresindeki komşu yoğunluğu ölçülüyor. Işın izleme
 * yok — bu ölçekte (yüzlerce üçgen) gereksiz pahalı olurdu ve fark ihmal
 * edilebilir.
 */

export interface OcclusionOptions {
  /** Komşu aranan yarıçap. Verilmezse modelin boyutundan türetilir. */
  readonly radius?: number
  /** En koyu noktanın ne kadar karartılacağı. 0 = kapalı. */
  readonly strength?: number
  /** Doygunluğa ulaşılan komşu ağırlığı. Büyütmek karartmayı yumuşatır. */
  readonly saturation?: number
}

interface Sample {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly area: number
}

/** Basit uzamsal ızgara: yarıçap içindeki örnekleri hızlı bulmak için. */
class Grid {
  readonly #cells = new Map<string, Sample[]>()
  readonly #size: number

  constructor(samples: readonly Sample[], cellSize: number) {
    this.#size = cellSize
    for (const sample of samples) {
      const key = this.#key(sample.x, sample.y, sample.z)
      const bucket = this.#cells.get(key)
      if (bucket) bucket.push(sample)
      else this.#cells.set(key, [sample])
    }
  }

  #key(x: number, y: number, z: number): string {
    return `${Math.floor(x / this.#size)},${Math.floor(y / this.#size)},${Math.floor(z / this.#size)}`
  }

  /** Verilen noktanın çevresindeki 27 hücrenin örnekleri. */
  near(x: number, y: number, z: number): Sample[] {
    const cx = Math.floor(x / this.#size)
    const cy = Math.floor(y / this.#size)
    const cz = Math.floor(z / this.#size)
    const found: Sample[] = []
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        for (let k = -1; k <= 1; k += 1) {
          const bucket = this.#cells.get(`${cx + i},${cy + j},${cz + k}`)
          if (bucket) found.push(...bucket)
        }
      }
    }
    return found
  }
}

/**
 * Verilen geometrilerin BİRLİKTE kapanmasını hesaplar ve renklerine işler.
 *
 * Hepsi bir arada değerlendirilmek zorunda: bir tahtanın koyulaştığı yer
 * komşu direğin yüzeyidir, kendi yüzeyi değil. Tek tek işlemek temas
 * noktalarını tamamen kaçırırdı.
 */
export function bakeOcclusion(
  geometries: readonly BufferGeometry[],
  options: OcclusionOptions = {},
): void {
  const strength = options.strength ?? 0.42
  if (strength <= 0 || geometries.length === 0) return

  // --- 1. Örnekler: her üçgenin ağırlık merkezi, alanıyla ağırlıklı ---
  const samples: Sample[] = []
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position')
    if (!position) continue
    const index = geometry.getIndex()
    const count = index ? index.count : position.count
    for (let i = 0; i < count; i += 3) {
      const at = (k: number): [number, number, number] => {
        const v = index ? index.getX(i + k) : i + k
        return [position.getX(v), position.getY(v), position.getZ(v)]
      }
      const [ax, ay, az] = at(0)
      const [bx, by, bz] = at(1)
      const [cx, cy, cz] = at(2)
      const ux = bx - ax, uy = by - ay, uz = bz - az
      const vx = cx - ax, vy = cy - ay, vz = cz - az
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      const area = Math.hypot(nx, ny, nz) / 2
      if (area <= 0) continue
      const x = (ax + bx + cx) / 3
      const y = (ay + by + cy) / 3
      const z = (az + bz + cz) / 3
      samples.push({ x, y, z, area })
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }
  }
  if (samples.length === 0) return

  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-6)
  const radius = options.radius ?? extent * 0.14
  const grid = new Grid(samples, radius)
  // Doygunluk modelin ölçeğiyle orantılı olmalı: yarıçap büyüdükçe kapsanan
  // alan da büyür, sabit bir eşik küçük modelleri kapkara yapardı.
  const saturation = options.saturation ?? radius * radius * 1.9

  // --- 2. Her vertex için komşu yoğunluğu ---
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position')
    const colour = geometry.getAttribute('color')
    if (!position || !colour) continue
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    const normal = geometry.getAttribute('normal')!

    for (let i = 0; i < position.count; i += 1) {
      const px = position.getX(i), py = position.getY(i), pz = position.getZ(i)
      const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i)

      let weight = 0
      for (const sample of grid.near(px, py, pz)) {
        const dx = sample.x - px, dy = sample.y - py, dz = sample.z - pz
        const distance = Math.hypot(dx, dy, dz)
        if (distance < 1e-6 || distance > radius) continue
        // Yalnızca vertex'in BAKTIĞI yarıküredeki komşular onu kapatır.
        const facing = (dx * nx + dy * ny + dz * nz) / distance
        if (facing <= 0) continue
        // Uzaklaştıkça etkisi azalır; kare yasası yerine yumuşak düşüş, çünkü
        // amaç fiziksel doğruluk değil okunur bir oyuk gölgesi.
        weight += sample.area * facing * (1 - distance / radius)
      }

      const occlusion = Math.min(1, weight / saturation)
      const factor = 1 - strength * occlusion
      colour.setXYZ(i, colour.getX(i) * factor, colour.getY(i) * factor, colour.getZ(i) * factor)
    }
    colour.needsUpdate = true
  }
}
