/**
 * @medieval-kit/wooden-bench
 *
 * The bench that sits beside the trestle table. In the middle ages a chair was
 * a status object; what people actually sat on was a bench, so a hall scene
 * needs one even more than it needs the table.
 *
 * Its structure is a simplified version of the table's: two thick end boards, a
 * stretcher between them, the seat on top. But one thing differs from the
 * table — the seat IS fixed to the legs. The table's top could be lifted away,
 * a bench's seat cannot; so the legs are joined by tenons that run into the
 * seat, and those tenons show through the top of it. That is the signature of
 * medieval joinery.
 */
import {
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  taperedBoxGeometry,
} from '../core/index.ts'

export interface WoodenBenchConfig {
  /** Bench length (metres). */
  readonly length: number
  /** Seat height (metres). */
  readonly height: number
  /** Seat width (metres). */
  readonly width: number
  /** Outward splay of the legs. 0 = upright. */
  readonly splay: number
  /** How far the legs stand in from the ends, as a fraction of the length. */
  readonly inset: number
  readonly seed: number
}

export const woodenBenchDefaults: WoodenBenchConfig = {
  length: 1.62,
  height: 0.45,
  width: 0.3,
  splay: 0.24,
  inset: 0.13,
  seed: 31,
}

export type WoodenBenchParts = 'seat' | 'legs' | 'stretcher'

export function createModel(overrides: Partial<WoodenBenchConfig> = {}) {
  return createKitModel<WoodenBenchConfig, 'oak', WoodenBenchParts>({
    id: 'wooden-bench',
    defaults: woodenBenchDefaults,
    slots: ['oak'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.height / 2
      // 0.135 of the height, not 0.09.
      //
      // At 0.09 the seat came out 40 mm on a bench 1.62 m long -- one
      // fortieth of its own span, where the reference reads about one
      // twentieth. Medieval furniture is riven, not machined: the board is
      // whatever the log gave, and that is thick. A thin slab over a long
      // span also looks like it would flex, which is the specific way these
      // pieces were reading as flimsy.
      const seatThickness = config.height * 0.135
      const seatTop = half
      const seatBottom = seatTop - seatThickness
      const timber = config.width * 0.09

      // --- Seat ----------------------------------------------------------
      // A single thick board. Using two boards is not as natural on a bench
      // as it is on the table: the seat must not have a gap down the middle.
      const seatPieces = [chamferedBoxGeometry(
        [config.length, config.width * 0.95],
        [config.length * 0.995, config.width],
        seatThickness,
        timber * 0.4,
        [0, seatBottom + seatThickness / 2, 0],
        tint('oak', 0.05),
      )]

      // --- Legs ----------------------------------------------------------
      const legX = config.length * (0.5 - config.inset)
      const legHeight = seatBottom - (-half)
      const legWidth = config.width * 0.66
      const spread = legWidth * config.splay

      const legPieces = []
      for (const side of [-1, 1]) {
        // Leg board with an arch cut out of its foot.
        //
        // The board widens on the way down. The splay is in the measure, not
        // in the angle — widening the bottom face instead of rotating is both
        // cheaper and lets the foot sit FLAT on the ground, whereas a rotated
        // leg stands on its edge.
        //
        // The arch is not decoration. A plank leg standing on its whole edge
        // rocks on any floor that is not flat, and no medieval floor was; the
        // cut leaves two feet, and two feet on each board give the bench four
        // points to find the ground with. It is also the single most
        // recognisable thing about the silhouette, and the reference has it.
        //
        // It is cut by building the board in three pieces rather than
        // subtracting: the geometry here is all non-indexed triangle soup with
        // no boolean operations, so a notch is made by not filling it.
        const archHeight = legHeight * 0.3
        const archFrac = archHeight / legHeight
        const footWidth = legWidth + spread * 2
        const widthAtArch = legWidth + spread * 2 * (1 - archFrac)

        // Upper board: from the top of the arch to the underside of the seat.
        legPieces.push(taperedBoxGeometry(
          [widthAtArch, timber * 1.35],
          [legWidth, timber * 1.35],
          legHeight - archHeight,
          [side * legX, -half + archHeight + (legHeight - archHeight) / 2, 0],
          tint('oak', -0.02),
        ))

        // The two feet. They run PAST the top of the arch into the board above,
        // so the joint is an overlap rather than two faces meeting.
        const footThickness = footWidth * 0.3
        const footRise = archHeight + legHeight * 0.07
        for (const foot of [-1, 1]) {
          legPieces.push(taperedBoxGeometry(
            [footThickness, timber * 1.35],
            [footThickness * 0.92, timber * 1.35],
            footRise,
            [
              side * legX + foot * (footWidth - footThickness) / 2,
              -half + footRise / 2,
              0,
            ],
            tint('oak', -0.04),
          ))
        }

        // Tenon: the end of the leg running THROUGH the seat and showing on
        // top of it as a panel of end grain. It is the most recognisable
        // detail of a medieval bench -- and it is nearly FLUSH.
        //
        // At 1.9 seat thicknesses it stood 42 mm proud of the seat: a block of
        // oak the size of a thumb sticking straight up out of the surface you
        // are meant to sit on. A real through-tenon is wedged and then planed
        // back, so what shows is the grain and a hairline of shoulder, not a
        // peg. Three millimetres proud, ten millimetres housed below.
        const proud = seatThickness * 0.05
        const housed = seatThickness * 0.16
        legPieces.push(chamferedBoxGeometry(
          [legWidth * 0.34, timber * 0.85],
          [legWidth * 0.32, timber * 0.8],
          seatThickness + proud + housed,
          timber * 0.16,
          [
            side * legX,
            seatBottom + (seatThickness + proud - housed) / 2,
            jitter(random, timber * 0.1),
          ],
          tint('oak', 0.09),
        ))
      }

      // --- Stretcher -----------------------------------------------------
      // The batten tying the two legs together. It runs INTO the legs: its
      // ends stay inside solid material so that no face ends up coplanar.
      const stretcherY = -half + legHeight * 0.34
      const stretcher = mergeColoured([boxGeometry(
        [legX * 2 + legWidth * 0.4, timber * 1.5, timber * 0.95],
        [0, stretcherY, 0],
        tint('oak', -0.06),
      )])

      return {
        seat: { slot: 'oak' as const, geometry: mergeColoured(seatPieces) },
        legs: { slot: 'oak' as const, geometry: mergeColoured(legPieces) },
        stretcher: { slot: 'oak' as const, geometry: stretcher },
      }
    },
  }, overrides)
}
