/**
 * @medieval-kit/wooden-bench
 *
 * The bench that sits beside the trestle table. In the middle ages a chair was
 * a status object; what people actually sat on was a bench, so a hall scene
 * needs one even more than it needs the table.
 *
 * Two thick end boards and a seat, and NOTHING BETWEEN THEM. This bench carried
 * a lengthwise stretcher, copied across from the trestle table, and the
 * reference has none: each board runs uninterrupted from the floor to the seat,
 * and the clear open span underneath is a large part of what separates a bench
 * from a table at a glance. Removing it drops a part from the model, which is a
 * breaking change and worth one, because what it buys is the silhouette.
 *
 * The seat IS fixed to the legs, which is the other thing that separates the
 * two: a table top can be lifted off, a bench seat cannot. The legs are tenoned
 * into it and pegged through, and the peg is the joint anyone can actually see.
 * The tenon is cut off flush with the seat in the reference and reads there as
 * a faint rectangle of end grain, which is a texture rather than a shape, so it
 * stays housed inside the slab where an earlier pass put it after two separate
 * complaints about a block of oak standing proud of the surface you sit on.
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

export type WoodenBenchParts = 'seat' | 'legs'

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

        /**
         * Each foot narrows on the way UP by exactly the board's own taper.
         *
         * This is the protrusion, and it was reported twice before I found it:
         * the first time I planed the through-tenons and answered the wrong
         * question. The feet were built at `footWidth`, the board's width at
         * the GROUND -- but a foot starts at the top of the arch, a third of
         * the way up, where the board has not widened that far yet. So every
         * foot stood proud of the board it hangs from, on both sides, as a
         * hard shoulder at shin height: 14 mm by default and 32 mm at full
         * splay. Setting the splay to zero made it vanish, which is what
         * finally named the cause.
         *
         * The leg's outer edge is a straight line from `footWidth / 2` at the
         * floor to `legWidth / 2` under the seat, and the foot's outer face
         * has to lie ON that line rather than run vertically up from its foot.
         * A tapered box narrows about its own centre, so taking twice the
         * taper off the top width moves the outer face in by exactly the taper
         * -- and moves the inner face out by the same, which narrows the arch
         * as it rises, which is also what a splayed leg does.
         */
        const footTaper = spread * (footRise / legHeight)
        const footTop = Math.max(footThickness * 0.3, footThickness - footTaper * 2)
        for (const foot of [-1, 1]) {
          legPieces.push(taperedBoxGeometry(
            [footThickness, timber * 1.35],
            [footTop, timber * 1.35],
            footRise,
            [
              side * legX + foot * (footWidth - footThickness) / 2,
              -half + footRise / 2,
              0,
            ],
            tint('oak', -0.04),
          ))
        }

        /**
         * Tenon: HOUSED in the seat, stopping short of its top face.
         *
         * It was a through-tenon and it was reported twice. First at 42 mm
         * proud, a block of oak the size of a thumb standing out of the
         * surface you sit on; I planed it to 3 mm and called it done, and 3 mm
         * is still a raised patch with a lit edge on it, still visible in the
         * render, and still the thing being complained about. The brief is
         * that nothing on the seat shows, and 3 mm is not nothing — it is
         * small.
         *
         * So it ends INSIDE the slab, an eighth of the seat's thickness below
         * the top. That is a real joint and not a compromise: a stub tenon
         * into the underside of a board is how a bench is made when the top is
         * thick enough to take it, which at 0.135 of the height it is. What is
         * lost is the panel of end grain on top; what is gained is a seat.
         *
         * Ending it LEVEL with the top face was never an option, which is what
         * sent me to 3 mm proud in the first place: two upward faces in one
         * plane is the z-fight the checker exists to find. Buried has neither
         * problem — a face inside a solid cannot fight anything and cannot be
         * seen.
         */
        const buried = seatThickness * 0.12
        const housed = seatThickness * 0.16
        legPieces.push(chamferedBoxGeometry(
          [legWidth * 0.34, timber * 0.85],
          [legWidth * 0.32, timber * 0.8],
          seatThickness - buried + housed,
          timber * 0.16,
          [
            side * legX,
            seatBottom + (seatThickness - buried - housed) / 2,
            jitter(random, timber * 0.1),
          ],
          tint('oak', 0.09),
        ))

        /**
         * Wedge peg: driven through the leg board just under the seat, showing
         * on both broad faces.
         *
         * The reference has it and this model did not, and it is the one joint
         * detail a viewer can actually see. The tenon into the seat cannot be
         * seen at all -- in the reference its end grain is cut off flush with
         * the seat and reads as a faint rectangle, which is a texture and not a
         * shape, so there is nothing for geometry to do there. The peg is the
         * opposite: a small solid standing out of a flat board, which is
         * exactly what lowpoly geometry is good at.
         *
         * It goes right through and out the far side, because a peg that stops
         * inside the board is a peg that is doing nothing.
         */
        const pegOut = timber * 0.62
        const boardThickness = timber * 1.35
        legPieces.push(chamferedBoxGeometry(
          [legWidth * 0.16, boardThickness + pegOut * 2],
          [legWidth * 0.13, boardThickness + pegOut * 2],
          timber * 0.72,
          timber * 0.12,
          [side * legX, seatBottom - timber * 1.15, 0],
          tint('oak', 0.07),
        ))
      }

      return {
        seat: { slot: 'oak' as const, geometry: mergeColoured(seatPieces) },
        legs: { slot: 'oak' as const, geometry: mergeColoured(legPieces) },
      }
    },
  }, overrides)
}
