import { Color } from 'three/webgpu'
import { bendGeometry, chamferedBoxGeometry } from '@/models/medieval-kit/core/index.ts'

const L = 0.235
const span = (g: never, axis: 'x' | 'y' | 'z') => {
  const p = (g as { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } }).getAttribute('position')
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < p.count; i += 1) {
    const v = axis === 'x' ? p.getX(i) : axis === 'y' ? p.getY(i) : p.getZ(i)
    lo = Math.min(lo, v); hi = Math.max(hi, v)
  }
  return [lo, hi] as const
}
const make = (centreY: number) => chamferedBoxGeometry(
  [0.19 * 0.88, 0.034], [0.19, 0.010], L, 0.006, [0, centreY, 0], new Color(0xffffff),
) as never

for (const [label, centreY] of [['ORİJİNDE ortalı (mevcut çapa)', 0], ['tabanı orijinde (yaba dişi gibi)', L / 2]] as const) {
  const flat = make(centreY)
  const bent = make(centreY)
  bendGeometry(bent as never, -0.5 / L)
  const [z0, z1] = span(flat, 'z')
  const [b0, b1] = span(bent, 'z')
  console.log(label)
  console.log(`  düz   z: ${z0.toFixed(4)} … ${z1.toFixed(4)}  (aralık ${(z1 - z0).toFixed(4)})`)
  console.log(`  bükük z: ${b0.toFixed(4)} … ${b1.toFixed(4)}  (aralık ${(b1 - b0).toFixed(4)})`)
  console.log(`  uç kaçışı: ${(Math.max(Math.abs(b0 - z0), Math.abs(b1 - z1)) * 1000).toFixed(1)} mm\n`)
}
