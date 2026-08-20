/**
 * Eş düzlemli çakışma (z-fighting) denetimi.
 *
 * İki yüzey tam olarak aynı düzlemde, aynı yöne bakıyor ve alanları
 * örtüşüyorsa, hangisinin önde olduğu derinlik tamponunun kayan nokta
 * hassasiyetine kalır. Kamera oynadıkça kazanan değişir ve yüzey titrer.
 *
 * Kenardan değen yüzeyler (bitişik tahtalar) sorun DEĞİLDİR — örtüşme yoktur.
 * O yüzden test bounding box'a değil, gerçek alan örtüşmesine bakıyor:
 * bir üçgenin ağırlık merkezi diğerinin İÇİNDE mi?
 *
 * Çalıştır: bun scripts/zfight.ts
 */
import { Mesh, Vector3, type Object3D } from 'three/webgpu'

interface Face {
  readonly a: Vector3
  readonly b: Vector3
  readonly c: Vector3
  readonly centroid: Vector3
  readonly mesh: string
}

export interface ZFightReport {
  faces: number
  coplanarGroups: number
  overlaps: number
  samples: string[]
}

/** Düzlem kimliği: yuvarlanmış normal + orijine uzaklık. */
function planeKey(normal: Vector3, offset: number): string {
  const r = (value: number): string => (Math.round(value * 1000) / 1000).toFixed(3)
  return `${r(normal.x)},${r(normal.y)},${r(normal.z)}|${r(offset)}`
}

/** Düzlemin baskın eksenini atarak 2B'ye indir. */
function project(point: Vector3, axis: 'x' | 'y' | 'z'): [number, number] {
  if (axis === 'x') return [point.y, point.z]
  if (axis === 'y') return [point.x, point.z]
  return [point.x, point.y]
}

function insideTriangle(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  c: [number, number],
): boolean {
  const sign = (p1: [number, number], p2: [number, number], p3: [number, number]): number =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
  const d1 = sign(p, a, b)
  const d2 = sign(p, b, c)
  const d3 = sign(p, c, a)
  const negative = d1 < 0 || d2 < 0 || d3 < 0
  const positive = d1 > 0 || d2 > 0 || d3 > 0
  // Kenarda olmak yeterli değil; kesin olarak içeride olmalı.
  return !(negative && positive)
}

export function findZFighting(root: Object3D): ZFightReport {
  const faces: Face[] = []
  root.updateWorldMatrix(true, true)
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    const count = index ? index.count : position.count
    for (let i = 0; i < count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => {
        const vertex = index ? index.getX(i + k) : i + k
        return object.localToWorld(new Vector3().fromBufferAttribute(position, vertex))
      }) as [Vector3, Vector3, Vector3]
      faces.push({
        a, b, c,
        centroid: a.clone().add(b).add(c).divideScalar(3),
        mesh: object.name,
      })
    }
  })

  // Aynı düzlem + aynı bakış yönü olanları grupla.
  const groups = new Map<string, Face[]>()
  for (const face of faces) {
    const normal = new Vector3()
      .crossVectors(face.b.clone().sub(face.a), face.c.clone().sub(face.a))
    if (normal.lengthSq() === 0) continue
    normal.normalize()
    const key = planeKey(normal, normal.dot(face.a))
    const bucket = groups.get(key)
    if (bucket) bucket.push(face)
    else groups.set(key, [face])
  }

  let overlaps = 0
  let coplanarGroups = 0
  const samples: string[] = []

  for (const [key, group] of groups) {
    if (group.length < 2) continue
    coplanarGroups += 1
    const normal = key.split('|')[0]!.split(',').map(Number)
    const dominant = Math.abs(normal[0]!) > Math.abs(normal[1]!)
      ? (Math.abs(normal[0]!) > Math.abs(normal[2]!) ? 'x' : 'z')
      : (Math.abs(normal[1]!) > Math.abs(normal[2]!) ? 'y' : 'z')

    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const first = group[i]!
        const second = group[j]!
        // Aynı mesh içindeki komşu üçgenler zaten aynı yüzeyi döşüyor.
        const pa = project(first.a, dominant)
        const pb = project(first.b, dominant)
        const pc = project(first.c, dominant)
        const qa = project(second.a, dominant)
        const qb = project(second.b, dominant)
        const qc = project(second.c, dominant)

        if (
          insideTriangle(project(second.centroid, dominant), pa, pb, pc) ||
          insideTriangle(project(first.centroid, dominant), qa, qb, qc)
        ) {
          overlaps += 1
          if (samples.length < 6) {
            const p = first.centroid
            samples.push(
              `${first.mesh} ↔ ${second.mesh} @ ` +
              `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}) düzlem ${key}`,
            )
          }
        }
      }
    }
  }

  return { faces: faces.length, coplanarGroups, overlaps, samples }
}
