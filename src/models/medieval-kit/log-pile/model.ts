/**
 * @medieval-kit/log-pile
 *
 * A pile of cut firewood. One of the cheapest models in the kit and one of the
 * highest in scene value: put it at the foot of a wall and that spot instantly
 * becomes "somewhere people live".
 *
 * Three things make a pile a pile:
 *   - The log end (the grain cross-section) is far lighter than the bark. Those
 *     pale circles are the first thing you see when you look at the pile.
 *   - No log matches its neighbour in diameter, length, angle or roll.
 *   - And most importantly: every log RESTS ON THE ONES BELOW IT.
 *
 * That last one was wrong in two separate attempts. First I used a fixed row
 * height, then I computed it "from the thickest log" — in both cases the thick
 * logs sank into the ones underneath and the thin ones hung in mid-air. The
 * right answer is to solve the real contact height for each log: the point
 * where two circles are tangent. `restingHeight` below does exactly that, and
 * the pile now settles by itself — whatever radii come along.
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
  /** How many rows. */
  readonly rows: number
  /** Number of logs in the bottom row. */
  readonly perRow: number
  /** Log length (metres). */
  readonly logLength: number
  /** Average log radius (metres). */
  readonly logRadius: number
  /** Thickness variety. 0 = all the same diameter. */
  readonly variation: number
  /** Pyramid-shaped (1) or a straight stack (0). */
  readonly taperRows: number
  readonly seed: number
}

export const logPileDefaults: LogPileConfig = {
  // Denser than it was. Twelve logs read as "some firewood"; a stack is the
  // thing that makes a wall look lived-against, and that needs enough logs
  // for the ends to form a pattern rather than a row.
  rows: 4,
  perRow: 7,
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
 * The height at which a log of radius `r` at position `x` will come to rest.
 *
 * Computes the height at which it is tangent to each log below it and takes the
 * highest; if it touches none of them it rests on the ground. Two circles being
 * tangent means the distance between their centres equals the sum of the radii,
 * so the vertical distance is √((r₁+r₂)² − Δx²).
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
        // +0.07 did not deliver what the file header promises. A sawn end is
        // dramatically paler than bark -- in a reference photograph the pale
        // discs are the first thing the eye lands on -- and at this offset the
        // ends were merely a slightly different brown.
        tint.offsetHSL(jitter(random, 0.012), -0.06 + jitter(random, 0.04), 0.19 + jitter(random, 0.05))
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

        // Horizontally, neighbouring logs are tangent: the gap is the sum of
        // the two radii. A fixed gap drove the thick ones into each other.
        const gaps = radii.slice(0, -1).map((r, i) => r + radii[i + 1]!)
        const rowWidth = gaps.reduce((sum, w) => sum + w, 0)
        // Upper rows are offset so they drop into the GROOVE of the row below;
        // the offset direction alternates, otherwise the pile leans one way.
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

          // Body: the ends are left uncapped, the grain cross-section is a
          // separate pair of discs. That lets bark and end take very different
          // colours.
          //
          // CRITICAL: it must NEVER EXCEED `log.r` anywhere. Previously the
          // ends were `log.r * (1 ± 0.05)`, i.e. they fattened by up to 5%;
          // since the layout is computed from `log.r`, neighbours intersected
          // by up to 10% at their ends. A log now only ever TAPERS IN — which
          // closes the bug and matches a real log, which narrows towards the
          // end anyway.
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

          // Each log is rolled randomly about its own axis: with every facet at
          // the same angle the pile looks mechanical, and on top of that
          // adjacent logs kept parallel faces that could z-fight.
          const roll = random() * Math.PI * 2
          const tilt = jitter(random, 0.04)
          for (const [target, geometry] of [[bark, body], [ends, capA], [ends, capB]] as const) {
            geometry.rotateY(roll)
            // About X, NOT about Z.
            //
            // `latheGeometry` builds along Y. Rotating +90 degrees about Z
            // sends +Y to -X, so every log lay along the X axis -- which is
            // the very axis the layout spaces them along. Each log was 0.62 m
            // long and its neighbour's centre was 0.13 m away, so every log
            // ran straight through about five of its neighbours. The tangent
            // solve above was correct the whole time; it was solving for an
            // orientation the geometry did not have. Rotating about X sends
            // +Y to +Z, which is the axis `restingHeight` assumes.
            geometry.rotateX(Math.PI / 2)
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
