/**
* @medieval-kit/wooden-barrel
*
* A real barrel is not a single piece: it is built from separate boards
* (staves) that narrow towards the ends, squeezed together by iron hoops, its
* head sunk into the body, and the staves leave a collar (the chime) above the
* head. This model builds it that way — not as an inflated cylinder.
*
* Dependencies: plain `three` and `@medieval-kit/core`. It never touches
* scifi-kit's primitive/wear pipeline; WebGL is enough.
*/
import { Color, type BufferGeometry } from 'three'

import {
  MEDIEVAL_PALETTE,
  bandGeometry,
  createKitModel,
  createRandom,
  headGeometry,
  jitter,
  mergeColoured,
  prismGeometry,
  staveGeometry,
  type Level,
} from '../core/index.ts'

export interface WoodenBarrelConfig {
  /** Total height (metres). */
  readonly height: number
  /** Outer radius at the belly (bilge), in metres. */
  readonly radius: number
  /** How far the ends narrow against the belly. 0.16 = ends at 84% width. */
  readonly taper: number
  /** Stave count. Odd by default, because it breaks perfect symmetry. */
  readonly staveCount: number
  /** Iron hoop count. */
  readonly hoopCount: number
  /**
   * Rivets per hoop.
   *
   * A hoop is a strip of iron bent into a circle and riveted where its ends
   * overlap; a cooper then adds more along its length to stop it springing.
   * They are small, but they are the detail that makes a dark band read as
   * FORGED IRON rather than as a painted stripe, so they earn their triangles.
   */
  readonly rivets: number
  /** Variation seed. The same seed always gives the same barrel. */
  readonly seed: number
}

export const woodenBarrelDefaults: WoodenBarrelConfig = {
  height: 1.04,
  radius: 0.41,
  taper: 0.17,
  // Stave and hoop counts come from a reference photograph of a real cask,
  // not from taste. Thirteen staves left a visibly polygonal silhouette and
  // four hoops read as too few for the height.
  staveCount: 17,
  hoopCount: 6,
  rivets: 6,
  seed: 7,
}

export type WoodenBarrelParts = 'staves' | 'heads' | 'hoops'

const SLOTS = ['oak', 'iron'] as const
type Slot = (typeof SLOTS)[number]

/** Barrel profile: t ∈ [-1,1], narrow at the ends, wide at the belly. */
function profileAt(t: number, taper: number): number {
  return 1 - taper * t * t
}

/**
* The hoops sit symmetrically from the ends inwards: the outermost ones are the
* "chime" (end) hoops, the inner ones the "bilge" (belly) hoops.
*/
function hoopPositions(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  const outer = 0.87
  const inner = count <= 2 ? 0.87 : 0.33
  const pairs = Math.floor(count / 2)
  const positions: number[] = []
  for (let i = 0; i < pairs; i += 1) {
    const t = pairs === 1 ? outer : outer - (outer - inner) * (i / (pairs - 1))
    positions.push(t, -t)
  }
  if (count % 2 === 1) positions.push(0)
  return positions
}

export function createModel(overrides: Partial<WoodenBarrelConfig> = {}) {
  return createKitModel<WoodenBarrelConfig, 'oak' | 'iron', WoodenBarrelParts>({
      id: 'wooden-barrel',
      defaults: woodenBarrelDefaults,
      slots: SLOTS,
      build: ({ config, random }) => {
        const half = config.height / 2
        // Five levels: ends, quarters and belly. Enough for a lowpoly barrel
        // curve; a sixth level adds nothing measurable to the silhouette.
        const levels = [-1, -0.58, 0, 0.58, 1]

        function buildStaves(random: () => number, half: number, levels: number[]): BufferGeometry {
          const wallThickness = config.radius * 0.13
          const step = (Math.PI * 2) / config.staveCount
          // A thin gap between the staves — the one detail that makes this read
          // as "assembled" instead of "a single piece".
          const gap = step * 0.055
          const tint = new Color()
          const pieces: BufferGeometry[] = []

          for (let index = 0; index < config.staveCount; index += 1) {
            // Every stave carries its own small deviations: radius, end height,
            // tone. Perfect repetition reads "manufactured"; rule: break mirrors.
            const radiusBias = 1 + jitter(random, 0.014)
            const topBias = jitter(random, 0.006)
            const bottomBias = jitter(random, 0.006)

            const shaped: Level[] = levels.map((t, level) => {
                const edge = level === 0 ? bottomBias : level === levels.length - 1 ? topBias : 0
                return {
                  y: t * half + edge,
                  radius: config.radius * profileAt(t, config.taper) * radiusBias,
                }
            })

            tint.copy(MEDIEVAL_PALETTE.oak)
            tint.offsetHSL(jitter(random, 0.014), jitter(random, 0.05), jitter(random, 0.055))

            pieces.push(staveGeometry(
                shaped,
                index * step + gap / 2,
                (index + 1) * step - gap / 2,
                wallThickness,
                tint,
            ))
          }

          return mergeColoured(pieces)
        }

        function buildHeads(random: () => number, half: number): BufferGeometry {
          const wallThickness = config.radius * 0.13
          const endRadius = config.radius * profileAt(1, config.taper)
          // The head seats INSIDE the body, a little back from the end; the
          // collar (chime) the staves leave above it makes a barrel a barrel.
          const seatRadius = endRadius - wallThickness * 0.9
          // Deep enough to SEE. At 0.055 the collar existed in the geometry
          // but was too shallow to read at any normal viewing distance, so the
          // head looked flush with the stave ends — the one silhouette detail
          // that distinguishes a cask from a bucket.
          const inset = config.height * 0.07
          const tint = new Color(MEDIEVAL_PALETTE.oakEnd)
          tint.offsetHSL(0, jitter(random, 0.03), jitter(random, 0.03))

          return mergeColoured([
              headGeometry(seatRadius, half - inset, config.staveCount, 'up', tint, 3, 0.06),
              headGeometry(seatRadius, -half + inset, config.staveCount, 'down', tint, 3, 0.06),
          ])
        }

        function buildHoops(random: () => number, half: number): BufferGeometry | undefined {
          const positions = hoopPositions(config.hoopCount)
          if (positions.length === 0) return undefined

          const tint = new Color()
          const pieces: BufferGeometry[] = []

          for (const t of positions) {
            const seat = config.radius * profileAt(t, config.taper)
            // The end hoops are wider: that is where the strain is greatest.
            const bandHeight = config.height * (0.045 + 0.03 * Math.abs(t))
            tint.copy(MEDIEVAL_PALETTE.iron)
            tint.offsetHSL(0, jitter(random, 0.02), jitter(random, 0.05))

            const bandRadius = seat + config.radius * 0.022
            pieces.push(bandGeometry(
                bandRadius,
                t * half,
                bandHeight,
                config.radius * 0.05,
                config.staveCount,
                tint,
            ))

            // Rivets. Centred ON the band's outer face, so the inner half is
            // buried in the iron rather than resting against it — the same
            // deliberate interpenetration the rest of the kit uses instead of
            // coplanar faces.
            // Wide and shallow. The first attempt was long and thin and read
            // as a row of nails driven through the hoop; a rivet is a domed
            // button that barely stands off the iron. Only a quarter of the
            // length shows — the rest is buried in the band.
            const studLength = config.radius * 0.05
            const studRadius = config.radius * 0.042
            // Each hoop's rivets start at their own angle. Aligning them into
            // vertical columns is the giveaway that a thing was generated.
            const phase = random() * Math.PI * 2
            // Rivets are struck iron: their domes are polished by the hammer
            // and by every hand that has ever moved the cask, so they catch
            // light the flat band does not. Without this they were the right
            // shape in the right place and still invisible against the hoop.
            const studTint = tint.clone()
            studTint.offsetHSL(0, 0, 0.09)
            for (let i = 0; i < config.rivets; i += 1) {
              const angle = phase + (i / config.rivets) * Math.PI * 2
              // The head FLARES outward, it does not taper. That is what a
              // hammered rivet actually looks like — the smith spreads the end
              // over the iron — and it is also the only version that keeps the
              // radial winding check honest: a stud narrowing outwards tilts
              // its side normals ~9.5 degrees back towards the barrel axis,
              // which the check correctly reports as faces pointing inward.
              const stud = prismGeometry(
                studRadius * 0.72,
                studRadius,
                studLength,
                4,
                [0, 0, 0],
                studTint,
                // No back face. The rivet's inner end is buried in the band, so
                // that cap is never visible — the same saving `bandGeometry`
                // makes on the inside of a hoop. It is not only free: once the
                // stud is seated deep enough to look right, the buried cap
                // falls inside the 94% shell the radial check inspects, and a
                // cap pointing at the axis is exactly what that check hunts.
                { capBottom: false },
              )
              stud.rotateX(Math.PI / 2)
              stud.rotateY(angle)
              const seatDepth = bandRadius - studLength * 0.25
              stud.translate(
                Math.sin(angle) * seatDepth,
                t * half,
                Math.cos(angle) * seatDepth,
              )
              pieces.push(stud)
            }
          }

          return mergeColoured(pieces)
        }

        // The call ORDER must be kept: the seeded randomness advances as a
        // stream, and if the order changes so does the geometry.
        const stavesPart = buildStaves(random, half, levels)
        const headsPart = buildHeads(random, half)
        const hoopsPart = buildHoops(random, half)

        return {
          staves: { slot: 'oak' as const, geometry: stavesPart },
          heads: { slot: 'oak' as const, geometry: headsPart },
          hoops: hoopsPart ? { slot: 'iron' as const, geometry: hoopsPart } : undefined,
        }
      },
    }, overrides)
}
