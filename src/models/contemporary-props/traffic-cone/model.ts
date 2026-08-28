/**
 * @contemporary-props/traffic-cone
 *
 * The clearest outline in the set, and the object where colour banding on a
 * revolve gets defined. Every striped revolve after this one — the bollard,
 * the channelizer drum, the barber pole if it ever comes — should copy the
 * collar technique here rather than invent its own.
 *
 * The technique: the body is ONE radius profile, a single function of height,
 * and a band is nothing but a y-range of that profile emitted into a different
 * slot's geometry. Both sides of a boundary sample the profile at the same t,
 * so the seam is watertight by construction, with no coincident faces and no
 * gap. The collars additionally stand 3 mm proud of the wall — real cone
 * sleeves are a wrap, not a print — which buys three things at once: the step
 * ring catches light at the top and bottom of the band, the silhouette shows
 * the sleeve, and the normal seam between the two geometries is hidden on an
 * edge that is supposed to be there.
 *
 * The profile itself is not a straight cone. A moulded cone sags: the wall
 * leaves the base wide and flares in quickly, then climbs to the tip nearly
 * straight. That is a power curve, (1-t)^p with p above 1, and `flare` moves p.
 * At flare 0 the profile is the straight cone of a traffic-cone pictogram,
 * which is deliberately still in range.
 *
 * The base is square with a stepped lip: two chamfered tiers, the upper one
 * smaller, which is how the moulding actually looks and what stops the cone
 * reading as a witch's hat on a board. The body is planted 8 mm into the
 * upper tier so nothing coincides with the base's top face.
 *
 * Parts: `base` and `body`. They are separate because a knocked-over cone is
 * half the reason the object exists in scenes, and tipping is a rotation of
 * the body against its base only in the cheap staged sense; more honestly,
 * the base is the part a consumer recolours (recycled black PVC bases are
 * everywhere) while the body stays hi-vis.
 */
import { type BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Level,
} from '../core/index.ts'

export interface TrafficConeConfig {
  /** Overall height (metres). 0.45 site cone up to 1.0 motorway cone. */
  readonly height: number
  /** Square base width (metres). Clamped against height so the cone stays stable and stays a cone. */
  readonly baseWidth: number
  /** Retroreflective collars: 1 (single wide sleeve) or 2 (motorway pair). */
  readonly collars: number
  /** How concave the wall is. 0 is a straight cone, 1 a heavy moulded sag. */
  readonly flare: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const trafficConeDefaults: TrafficConeConfig = {
  height: 0.75,
  baseWidth: 0.4,
  collars: 2,
  flare: 0.55,
  segments: 28,
  seed: 7,
}

export type TrafficConeParts = 'base' | 'body'

export function createModel(overrides: Partial<TrafficConeConfig> = {}) {
  return createKitModel<TrafficConeConfig, 'plastic' | 'retroreflective', TrafficConeParts>({
    id: 'traffic-cone',
    defaults: trafficConeDefaults,
    slots: ['plastic', 'retroreflective'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.2, Math.max(0.3, config.height))
      // The base is clamped RELATIVE to the height. Real cones keep the base
      // between roughly half and two thirds of the height; outside that the
      // object either topples (too narrow) or reads as a pyramid on a raft.
      const w = Math.min(0.6, Math.max(0.2,
        Math.min(H * 0.72, Math.max(H * 0.42, config.baseWidth))))
      const collars = Math.round(config.collars) >= 2 ? 2 : 1
      const p = 1 + 0.9 * Math.min(1, Math.max(0, config.flare))
      const segments = Math.max(12, Math.round(config.segments))

      // Spread kept low on the body: hi-vis orange is a controlled colour and
      // a lightness jitter that is charming on ceramic drifts it toward salmon.
      const bodyOrange = tint('retroreflective', -0.02, 0.4)
      const baseOrange = tint('retroreflective', -0.09, 0.5)
      const sleeveWhite = tint('paper', 0.03, 0.4)

      /* ------------------------------------------------------------- base */
      // Two chamfered tiers, the upper sunk 3 mm into the lower so its bottom
      // face ends inside the solid rather than level with the lower's top.
      const h1 = 0.014 + H * 0.010
      const h2 = 0.012 + H * 0.008
      const w2 = w * 0.8
      const baseTop = h1 - 0.003 + h2

      const basePieces: BufferGeometry[] = [
        chamferedBoxGeometry([w, w], [w * 0.96, w * 0.96], h1, 0.006,
          [0, h1 / 2, 0], baseOrange),
        chamferedBoxGeometry([w2, w2], [w2 * 0.94, w2 * 0.94], h2, 0.005,
          [0, h1 - 0.003 + h2 / 2, 0], tint('retroreflective', -0.07, 0.5)),
      ]

      /* ------------------------------------------------------------- body */
      const bodyH = H - baseTop
      const rFoot = w * 0.34
      const rTip = Math.min(0.02 + H * 0.008, rFoot * 0.45)
      // The whole cone in one line. Everything below samples this and only
      // this, which is what makes the banding seam-free.
      const profile = (t: number): number => rTip + (rFoot - rTip) * Math.pow(1 - t, p)
      const levelAt = (t: number, proud = 0): Level =>
        ({ y: baseTop + bodyH * t, radius: profile(t) + proud })

      // Band positions as fractions of the body. The two-collar layout is the
      // motorway one: the wider band on top, a gap, a narrower band below.
      const bands: ReadonlyArray<readonly [number, number]> =
        collars === 2 ? [[0.42, 0.56], [0.64, 0.85]] : [[0.5, 0.86]]
      const proud = 0.003

      // Interior samples on the concave curve, endpoints exact.
      const sample = (t0: number, t1: number, proudBy: number): Level[] => {
        const steps = Math.max(2, Math.ceil((t1 - t0) / 0.045))
        const levels: Level[] = []
        for (let i = 0; i <= steps; i += 1) {
          levels.push(levelAt(t0 + ((t1 - t0) * i) / steps, proudBy))
        }
        return levels
      }

      const plasticPieces: BufferGeometry[] = []
      const collarPieces: BufferGeometry[] = []

      const cuts = [0, ...bands.flat(), 1]
      for (let i = 0; i < cuts.length - 1; i += 1) {
        const t0 = cuts[i]!
        const t1 = cuts[i + 1]!
        const isBand = i % 2 === 1
        if (isBand) {
          // A collar is the same profile span pushed out by `proud`, with a
          // flat step ring at each end (two levels at one y) and OPEN ends:
          // the first and last level sit ON the cone wall, so the sleeve
          // meets the body on the body's own edge rings.
          const levels: Level[] = [
            levelAt(t0),
            ...sample(t0, t1, proud),
            levelAt(t1),
          ]
          collarPieces.push(latheGeometry(levels, segments, [0, 0, 0], sleeveWhite,
            { capBottom: false, capTop: false }))
          continue
        }
        const first = i === 0
        const last = i === cuts.length - 2
        const levels: Level[] = sample(t0, last ? 1 - 0.008 / bodyH : t1, 0)
        if (first) {
          // Plant the foot 8 mm inside the base's upper tier. The bottom cap
          // is buried in solid plastic, which is the only place a cap that
          // nothing should ever see is allowed to be.
          levels.unshift({ y: baseTop - 0.008, radius: profile(0) })
        }
        if (last) {
          // Blunt rolled tip. A cone does not come to a point; the mould
          // rounds it off at about 70% of the tip radius.
          levels.push({ y: H, radius: rTip * 0.7 })
        }
        plasticPieces.push(latheGeometry(levels, segments, [0, 0, 0], bodyOrange,
          { capBottom: first, capTop: last }))
      }

      // Smoothed at 40 degrees: the concave wall and the sleeve faces read as
      // curves, while the collar step rings, the blunt tip and every base
      // chamfer turn through more than that and stay edges.
      return {
        base: {
          slot: 'plastic' as const,
          geometry: smoothNormals(mergeColoured(basePieces), 40),
        },
        body: {
          slot: 'plastic' as const,
          geometry: smoothNormals(mergeColoured(plasticPieces), 40),
          extras: [{
            slot: 'retroreflective' as const,
            geometry: smoothNormals(mergeColoured(collarPieces), 40),
          }],
        },
      }
    },
  }, overrides)
}
