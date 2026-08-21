/**
 * @medieval-kit/coin-pouch
 *
 * A drawstring leather pouch with coins spilled beside it.
 *
 * On its own the pouch has a problem: a closed leather bag cannot be told apart
 * from a stone at any distance. What shows what is inside are the SPILLED
 * coins; without them the model is a "lump", not a "pouch". So the coins are
 * not an optional garnish, they are how the model gets read at all.
 *
 * The coin layout is thought through too: money spilled on the ground does not
 * form a neat circle, it scatters one way out of the pouch's mouth and part of
 * it lands on top of itself. An evenly spaced ring always looked "placed".
 *
 * Period note: a silver penny is thin and SMALL — a little over a centimetre.
 * The thick, golden, oversized coin is a fantasy image; here the proportion is
 * kept close to the real one, and that makes the pouch's scale read right too.
 */
import type { BufferGeometry } from 'three'

import {
  bandGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  prismGeometry,
  roughenGeometry,
  type Level,
} from '../core/index.ts'

export interface CoinPouchConfig {
  /** Height of the pouch (metres). */
  readonly height: number
  /** Widest radius of the pouch (metres). */
  readonly radius: number
  /** How full it is. 0.3 is half empty and slumped, 1 is stuffed. */
  readonly fill: number
  /** Number of coins spilled outside. */
  readonly coins: number
  /** Coin radius (metres). */
  readonly coinRadius: number
  readonly seed: number
}

export const coinPouchDefaults: CoinPouchConfig = {
  height: 0.1,
  radius: 0.042,
  fill: 0.85,
  coins: 9,
  coinRadius: 0.011,
  seed: 89,
}

export type CoinPouchParts = 'pouch' | 'cord' | 'coins'

export function createModel(overrides: Partial<CoinPouchConfig> = {}) {
  return createKitModel<CoinPouchConfig, 'leather' | 'cloth' | 'brass', CoinPouchParts>({
    id: 'coin-pouch',
    defaults: coinPouchDefaults,
    slots: ['leather', 'cloth', 'brass'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const fill = Math.max(0.15, Math.min(1, config.fill))
      const floor = 0                       // the pouch sits on the ground
      const wide = config.radius * (0.68 + fill * 0.4)
      const neckY = config.height * (0.62 + fill * 0.14)

      // --- Pouch --------------------------------------------------------------
      // A smaller sack, but a different profile: the pouch gathers ABOVE the
      // cord and pulls upward, it does not flop outward the way the sack does.
      // That gap is the gap between a pouch and a plain bag.
      const profile: Level[] = [
        { y: floor, radius: wide * 0.62 },
        { y: config.height * 0.1, radius: wide * 0.94 },
        { y: config.height * 0.3 * fill + config.height * 0.12, radius: wide },
        { y: neckY - config.height * 0.14, radius: wide * 0.78 },
        { y: neckY, radius: config.radius * 0.3 },
        { y: neckY + config.height * 0.16, radius: config.radius * 0.26 },
        { y: neckY + config.height * 0.28, radius: config.radius * 0.34 },
      ]
      const pouch = latheGeometry(profile, 9, [0, 0, 0], tint('leather', -0.05, 0.9), {
        colourTop: tint('leather', 0.06, 0.9),
        capTop: true,
      })
      roughenGeometry(pouch, config.radius * 0.055, { salt: 51, scaleY: 0.6 })

      // --- Drawstring ------------------------------------------------------------
      const cordPieces: BufferGeometry[] = [bandGeometry(
        config.radius * 0.31, neckY, config.height * 0.05, config.radius * 0.055, 8,
        tint('cloth', -0.18, 0.8), { inner: true },
      )]
      // The two hanging ends. Orient first, then translate.
      for (const side of [-1, 1]) {
        const tail = prismGeometry(
          config.radius * 0.04, config.radius * 0.028, config.height * 0.3, 4,
          [0, -config.height * 0.15, 0], tint('cloth', -0.12, 0.8),
        )
        tail.rotateZ(side * 0.7 + jitter(random, 0.15))
        tail.rotateY(random() * Math.PI * 2)
        tail.translate(side * config.radius * 0.28, neckY, 0)
        cordPieces.push(tail)
      }

      // --- Spilled coins -----------------------------------------------------------
      const count = Math.max(0, Math.round(config.coins))
      const coinPieces: BufferGeometry[] = []
      // Scatter DIRECTION: all one way, because spilled money flows to one side.
      const spillAngle = random() * Math.PI * 2
      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.6) / count
        // Distance grows with a square root: piled at the pouch, thin further out.
        const distance = wide * (1.15 + Math.sqrt(t) * 2.4)
        const spread = jitter(random, 0.75) * (0.35 + t * 0.65)
        const angle = spillAngle + spread
        const thickness = config.coinRadius * (0.13 + random() * 0.06)
        // The overlapping ones: every third coin lands on top of the previous.
        const stack = i % 3 === 2 ? thickness * 1.6 : 0

        const coin = prismGeometry(
          config.coinRadius * (0.92 + random() * 0.16),
          config.coinRadius * (0.9 + random() * 0.16),
          thickness, 9, [0, 0, 0], tint('brass', jitter(random, 0.06), 0.5),
        )
        // Some do not land flat: the ones leaning on edge give the pile depth.
        const tilt = random() < 0.22 ? 0.5 + random() * 0.7 : jitter(random, 0.12)
        coin.rotateX(tilt)
        coin.rotateY(random() * Math.PI * 2)
        coin.translate(
          Math.sin(angle) * distance,
          floor + thickness / 2 + stack + Math.sin(tilt) * config.coinRadius * 0.5,
          Math.cos(angle) * distance,
        )
        coinPieces.push(coin)
      }

      return {
        pouch: { slot: 'leather' as const, geometry: mergeColoured([pouch]) },
        cord: { slot: 'cloth' as const, geometry: mergeColoured(cordPieces) },
        coins: coinPieces.length > 0
          ? { slot: 'brass' as const, geometry: mergeColoured(coinPieces) }
          : undefined,
      }
    },
  }, overrides)
}
