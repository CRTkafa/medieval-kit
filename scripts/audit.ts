/** Floating check: default, action state, config extremes and MID-MORPH. */
import { CATALOG, SHOWCASE_ORDER, controlsFor } from '@/catalog.ts'
import { findFloating } from './support.ts'
import { blend, capture, compatible } from '@/morph.ts'

const HANGING = new Set(['tavern-sign', 'bronze-bell'])

function atFraction(id: string, f: number): Record<string, number> {
  const patch: Record<string, number> = {}
  for (const c of controlsFor(id)) {
    if (c.key === 'seed') continue
    const raw = c.min + (c.max - c.min) * f
    patch[c.key] = c.step >= 1 ? Math.round(raw) : raw
  }
  return patch
}

/** The showcase sweeps continuous sliders between 18% and 82% of their range. */
function sweepEnds(id: string): [Record<string, number>, Record<string, number>] {
  const from: Record<string, number> = {}
  const to: Record<string, number> = {}
  for (const c of controlsFor(id)) {
    const lo = c.min + (c.max - c.min) * 0.18
    const hi = c.max - (c.max - c.min) * 0.18
    if (c.step >= 1 || c.key === 'seed') {
      const v = Math.round((lo + hi) / 2)
      from[c.key] = v; to[c.key] = v
    } else { from[c.key] = lo; to[c.key] = hi }
  }
  return [from, to]
}

let bad = 0
for (const id of SHOWCASE_ORDER) {
  const lines: string[] = []
  const check = (label: string, root: Parameters<typeof findFloating>[0]) => {
    const r = findFloating(root, { support: HANGING.has(id) ? 'hanging' : 'ground', resolution: 72 })
    if (r.floating.length === 0) return
    bad += 1
    lines.push(`    ${label.padEnd(10)} ${r.floating
      .map((f) => `${f.parts.join('+').replaceAll(id + '/', '')} ${f.voxels}vx @${f.clearance}m`).join(' | ')}`)
  }

  for (const [label, f] of [['default', undefined], ['min', 0.02], ['max', 0.98], ['sweep-lo', 0.18], ['sweep-hi', 0.82]] as const) {
    const b = CATALOG[id]!.build()
    if (f !== undefined) b.params?.apply(atFraction(id, f))
    check(label, b.root); b.dispose()
  }

  const act = CATALOG[id]!.build()
  if (act.action) { act.action.run(); for (let i = 0; i < 240; i++) act.update?.(1 / 60) ; check('action', act.root) }
  act.dispose()

  // Mid-morph: exactly what the showcase renders between two sweep ends.
  const m = CATALOG[id]!.build()
  const [a, z] = sweepEnds(id)
  m.params?.apply(z); const end = capture(m.root)
  m.params?.apply(a); const start = capture(m.root)
  if (compatible(start, end)) {
    blend(m.root, start, end, 0.5)
    check('morph-mid', m.root)
  } else {
    lines.push('    morph-mid  INCOMPATIBLE (falls back to rebuilds)')
  }
  m.dispose()

  if (lines.length) console.log(`${id}\n${lines.join('\n')}`)
}
console.log(`\n${bad} failing case(s)`)
