/**
 * @medieval-kit/wooden-hoe
 *
 * Field hoe after the reference photograph: a long ash shaft ending in a
 * squared, chamfered block, a flat iron band wrapped tight around that block,
 * a short flat strap running forward and down from the band, and a dark
 * forged trapezoid blade hung off the strap at roughly 75 degrees to the
 * shaft.
 *
 * FIFTH pass. The fourth swept the old gooseneck past 180 degrees so the
 * blade genuinely hung below the socket, which fixed "scythe" (45 -> 62) but
 * not "hoe": the blade descended almost parallel to the shaft, so from the
 * side the tool read as a paddle on a pole, and the free arc of the neck
 * vaulted over the shaft end with air under it and read as a padlock
 * shackle. The blind critique of that pass said to stop interpreting and
 * model the reference literally. So the gooseneck, the bent lathe neck, the
 * forged collar and the toolSocket ferrule (which covered the top tenth of
 * the shaft and read as a long grey sleeve) are all gone.
 *
 * Point by point against that critique:
 *  - The blade sweeps FORWARD off the shaft axis. Its plane sits at about
 *    75 degrees to the shaft and its root edge is about 2.3 shaft diameters
 *    clear of the wood, so no side profile has the shaft overlapping the
 *    blade, and no solid shares volume with the blade except the strap that
 *    deliberately laps onto its back at the root.
 *  - The blade holds full thickness over its upper two thirds and thins only
 *    in the last third down to a lip, so its side faces actually exist and
 *    the cutting edge catches light.
 *  - The blade moved from the steel slot to the iron slot with a dark tint.
 *    It was the palest element in the render and in the reference it is the
 *    darkest; the value order was inverted. Only the cutting edge lightens.
 *  - The arch is replaced by band + block + strap, and every iron piece
 *    starts inside another solid: the strap begins inside the band slab, the
 *    band wraps the block, the block swallows the shaft's top cap (which
 *    used to poke out of the socket as a wood sliver).
 *
 * `neckSweep` stays in the config because other files reference the
 * interface, but it is REINTERPRETED: it is now the forward pitch of the
 * whole head in degrees from the shaft axis, clamped to 92..140. Larger
 * folds the blade down toward the shaft, smaller lifts it toward square.
 * There is no arc left for it to sweep.
 *
 * Earlier lessons, still load-bearing. The blade sheet is built with its
 * base AT THE ORIGIN and rotated, then translated, in that order. `curve` in
 * a sheet profile is an absolute rise in metres and must be scaled to the
 * blade. Tints come from createTinter, which returns a new Color each call
 * and floors lightness so a dark lift cannot fall through the palette.
 *
 * Still open: the shaft comes from the shared toolShaft helper, whose taper
 * toward the head is real but slight; the reference tapers more. Core is
 * shared, so that stays as it is.
 */
import {
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  dishedSheetGeometry,
  jitter,
  mergeColoured,
  taperedBoxGeometry,
  toolShaft,
  type SheetLevel,
} from '../core/index.ts'

export interface WoodenHoeConfig {
  /** Shaft length (metres). */
  readonly length: number
  readonly shaftRadius: number
  /** Width of the cutting edge (metres). */
  readonly bladeWidth: number
  /**
   * Forward pitch of the head (degrees from the shaft axis), clamped to
   * 92..140. At 92 the blade sticks out almost square to the shaft; at 140
   * it folds well down toward it. The blade plane runs at 180 minus this to
   * the shaft, so the default leaves it near 75 degrees, as the reference.
   */
  readonly neckSweep: number
  /** Dish of the blade. 0 = dead flat, which is close to the reference. */
  readonly dish: number
  readonly seed: number
}

export const woodenHoeDefaults: WoodenHoeConfig = {
  length: 1.14,
  shaftRadius: 0.021,
  bladeWidth: 0.23,
  neckSweep: 104,
  dish: 0.8,
  seed: 23,
}

export type WoodenHoeParts = 'shaft' | 'socket' | 'blade'

export function createModel(overrides: Partial<WoodenHoeConfig> = {}) {
  return createKitModel<WoodenHoeConfig, 'oak' | 'iron' | 'steel', WoodenHoeParts>({
    id: 'wooden-hoe',
    defaults: woodenHoeDefaults,
    slots: ['oak', 'iron', 'steel'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      // Floored: radius and width divide nothing, but they scale everything,
      // and a zero would collapse the head into degenerate triangles.
      const radius = Math.max(0.008, config.shaftRadius)
      const dia = radius * 2
      const bladeW = Math.max(0.05, config.bladeWidth)

      const shaft = toolShaft({ length: config.length, radius, random })
      const top = shaft.top

      // --- Squared end block --------------------------------------------------
      // The wood continues past the band as a squared, chamfered block, as in
      // the reference. It starts a diameter INSIDE the round shaft, so the
      // shaft's top cap and its tapered tip are both swallowed whole: the
      // block's half width just exceeds the shaft's top radius.
      const blockHalf = radius * 1.02
      const blockBottom = top - dia * 1.1
      const blockTop = top + dia * 1.2
      const block = chamferedBoxGeometry(
        [blockHalf * 2, blockHalf * 2],
        [blockHalf * 1.84, blockHalf * 1.84],
        blockTop - blockBottom,
        dia * 0.14,
        [0, (blockBottom + blockTop) / 2, 0],
        tint('oakEnd', 0),
        tint('oakEnd', 0.04),
      )

      // --- Iron band ----------------------------------------------------------
      // A flat band about one shaft diameter tall, wrapped tight on the block.
      // Modelled as a solid slab; the wood passing through it hides the
      // interior, and from outside it reads as the wrapped hoop it stands for.
      const bandHalf = blockHalf + 0.006
      const bandY = top + dia * 0.25
      const band = chamferedBoxGeometry(
        [bandHalf * 2, bandHalf * 2],
        [bandHalf * 2, bandHalf * 2],
        dia * 0.95,
        0.0025,
        [0, bandY, 0],
        tint('iron', 0.03),
        tint('iron', 0.07),
      )

      // --- Strap (the neck) ---------------------------------------------------
      // A short tapered bar running forward and down from the band; the blade
      // hangs off its end. Direction comes from the head pitch so the whole
      // head follows `neckSweep` as one piece.
      const pitch = (Math.min(140, Math.max(92, config.neckSweep)) * Math.PI) / 180
      const dirY = Math.cos(pitch)
      const dirZ = Math.sin(pitch) // 92..140 degrees keeps this well above 0.6

      const startY = bandY - dia * 0.1
      const startZ = radius * 0.6            // buried inside the band slab
      const rootZ = dia * 2.3                // blade root, clear of the wood
      const lenToRoot = (rootZ - startZ) / dirZ
      const lap = dia * 0.5                  // how far the strap laps onto the blade
      const strapLen = lenToRoot + lap
      const strap = taperedBoxGeometry(
        [dia * 0.52, dia * 0.3],
        [dia * 0.62, dia * 0.32],
        strapLen,
        [0, strapLen / 2, 0],
        tint('iron', -0.04),
        tint('iron', -0.06),
      )
      strap.rotateX(pitch)
      strap.translate(0, startY, startZ)

      const rootY = startY + dirY * lenToRoot

      // --- Blade --------------------------------------------------------------
      // A trapezoid widening from a narrow root to the cutting edge, the two
      // edge corners taken off. Thickness is a twenty-fifth of the width, held
      // over the top two thirds and thinned only in the last third to a lip,
      // so the plate shows a side face instead of reading as a sheet. Root
      // dark forged iron, edge worn lighter.
      const bladeLength = bladeW * 0.9
      const halfEdge = bladeW / 2
      const thick = bladeW * 0.04
      const curve = bladeW * 0.045 * config.dish
      const profile: SheetLevel[] = [
        { y: 0, halfWidth: halfEdge * 0.55, thickness: thick, curve: curve * 0.2 },
        { y: bladeLength * 0.3, halfWidth: halfEdge * 0.72, thickness: thick, curve: curve * 0.5 },
        { y: bladeLength * 0.66, halfWidth: halfEdge * 0.88, thickness: thick * 0.94, curve: curve * 0.85 },
        { y: bladeLength * 0.92, halfWidth: halfEdge, thickness: thick * 0.38, curve },
        { y: bladeLength, halfWidth: halfEdge * 0.93, thickness: thick * 0.2, curve: curve * 0.97 },
      ]
      // The lift looks heavy written down, but the blade's face points at the
      // sky in every standing view and direct sky light lifts it a band or
      // two: at -0.05 it still rendered as the palest part of the tool.
      const blade = dishedSheetGeometry(
        profile, 7, tint('iron', -0.16, 0.4), tint('iron', -0.02, 0.4),
      )
      // A forged blade is not perfectly symmetric.
      blade.rotateY(jitter(random, 0.03))
      // Align to the strap direction, then move to its end. Order matters:
      // rotating after the move would swing the blade around the model origin.
      blade.rotateX(pitch)
      blade.translate(0, rootY, rootZ)

      return {
        shaft: { slot: 'oak', geometry: mergeColoured([shaft.geometry, block]) },
        socket: { slot: 'iron', geometry: mergeColoured([band, strap]) },
        blade: { slot: 'iron', geometry: mergeColoured([blade]) },
      }
    },
  }, overrides)
}
