/**
 * @medieval-kit/leather-book
 *
 * Leather-bound manuscript with a clasp. Table, shelf, inside a chest, lectern.
 *
 * The whole point of the model is the PAGE BLOCK. What makes a book a book is
 * not its cover but the uneven mass of paper spilling past that cover. Give it
 * as a flat box and it reads like a brick no matter how good the cover is.
 *
 * Two period details drove the geometry:
 *
 *   - The pages are NOT PAPER but vellum (parchment), i.e. animal skin. That
 *     makes them thick, yellowed and wavy. `roughenGeometry` puts that
 *     waviness on the edge of the block.
 *   - The book DOES NOT stay shut: vellum draws in moisture and swells. That
 *     is why real manuscripts have a clasp — function, not ornament. Without
 *     the clasp the model loses its period.
 */
import type { BufferGeometry } from 'three'

import {
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  flipGeometry,
  prismGeometry,
  roughenGeometry,
} from '../core/index.ts'

export interface LeatherBookConfig {
  /** Cover width (metres). */
  readonly width: number
  /** Cover length (metres). */
  readonly length: number
  /** Total thickness of the closed book (metres). */
  readonly thickness: number
  /** Number of raised bands on the spine. */
  readonly bands: number
  /** Number of clasps. */
  readonly clasps: number
  readonly seed: number
}

export const leatherBookDefaults: LeatherBookConfig = {
  width: 0.19,
  length: 0.27,
  thickness: 0.062,
  bands: 3,
  clasps: 1,
  seed: 79,
}

export type LeatherBookParts = 'cover' | 'pages' | 'clasps'

export function createModel(overrides: Partial<LeatherBookConfig> = {}) {
  return createKitModel<LeatherBookConfig, 'leather' | 'cloth' | 'brass', LeatherBookParts>({
    id: 'leather-book',
    defaults: leatherBookDefaults,
    slots: ['leather', 'cloth', 'brass'],
    build: ({ config, random }) => {
      const tint = createTinter(random)
      const half = config.thickness / 2
      // 0.16, not 0.11. At a ninth of the book each way the two boards came
      // to 14 mm against 48 mm of paper, and the thing read as a ream with
      // leather stuck to it. A medieval binding is oak boards first, covered
      // in leather second, and they are substantial.
      const boardThickness = config.thickness * 0.16
      const halfWidth = config.width / 2
      const spineX = -halfWidth

      // --- Covers ------------------------------------------------------------
      // Not just two boards: the spine is the single piece of leather wrapping
      // them. So the spine is NOT coplanar with the side faces of the boards,
      // it overshoots them slightly — both real bookbinding and coplanar-face
      // avoidance.
      const cover: BufferGeometry[] = []
      for (const side of [-1, 1]) {
        cover.push(chamferedBoxGeometry(
          [config.width, config.length],
          [config.width * 0.995, config.length * 0.997],
          boardThickness,
          config.thickness * 0.035,
          [0, side * (half - boardThickness / 2), 0],
          tint('leather', side > 0 ? 0.03 : -0.03, 0.9),
        ))
      }

      // Spine: the leather wrapping the boards, curved outwards.
      const spine = chamferedBoxGeometry(
        [config.thickness * 1.06, config.length * 1.01],
        [config.thickness * 1.06, config.length * 1.01],
        config.width * 0.1,
        config.thickness * 0.05,
        [0, 0, 0],
        tint('leather', -0.06, 0.9),
      )
      // Built as an upright box and laid down: ORDER matters, rotate at the
      // origin, then translate.
      spine.rotateZ(Math.PI / 2)
      spine.translate(spineX + config.width * 0.03, 0, 0)
      cover.push(spine)

      // Spine bands: the ridges raised by the cords sitting under the binding
      // stitch. The most readable sign separating manuscript from printed book.
      const bandCount = Math.max(0, Math.round(config.bands))
      for (let i = 0; i < bandCount; i += 1) {
        const t = (i + 1) / (bandCount + 1)
        const band = boxGeometry(
          [config.width * 0.09, config.thickness * 1.12, config.length * 0.055],
          [spineX + config.width * 0.03, 0, (t - 0.5) * config.length * 0.86],
          tint('leather', 0.06, 0.9),
        )
        cover.push(band)
      }

      // --- Page block ---------------------------------------------------------
      // The BOARDS overhang the pages, not the other way round.
      //
      // This was written the wrong way round -- pages at 1.035 of the cover,
      // spilling past it on three sides -- and it is why the model read as a
      // ream of paper with a leather lid rather than as a book. The overhang
      // is called the square and it is the whole point of a board binding:
      // the boards take the knocks so the leaves do not, which is also what
      // the corner bosses are protecting. Flush at the spine, inset on the
      // three free edges.
      const square = config.width * 0.055
      const pages = chamferedBoxGeometry(
        [config.width - square, config.length - square * 1.1],
        [config.width - square * 1.15, config.length - square * 1.25],
        config.thickness - boardThickness * 2.4,
        config.thickness * 0.02,
        [-square / 2, 0, 0],
        tint('cloth', 0.09, 0.7),
      )
      // Vellum is not flat: the waviness at the edge is what makes the block
      // read as a stack of leaves.
      roughenGeometry(pages, config.thickness * 0.035, { salt: 31, scaleY: 0.35 })

      // --- Clasps ---------------------------------------------------------------
      const claspCount = Math.max(0, Math.round(config.clasps))
      const claspPieces: BufferGeometry[] = []
      for (let i = 0; i < claspCount; i += 1) {
        const t = claspCount === 1 ? 0.5 : 0.25 + (i / (claspCount - 1)) * 0.5
        const z = (t - 0.5) * config.length * 0.62
        // A strap that curls from the front face round to the back: built from
        // three pieces, because a single box cannot wrap the book's edge.
        claspPieces.push(boxGeometry(
          [config.width * 0.2, config.thickness * 0.035, config.length * 0.075],
          [halfWidth * 0.86, half - boardThickness * 0.35, z + jitter(random, 0.002)],
          tint('brass', 0.04, 0.5),
        ))
        claspPieces.push(boxGeometry(
          [config.width * 0.045, config.thickness * 0.9, config.length * 0.07],
          [halfWidth * 1.012, 0, z],
          tint('brass', -0.02, 0.5),
        ))
        claspPieces.push(boxGeometry(
          [config.width * 0.12, config.thickness * 0.035, config.length * 0.07],
          [halfWidth * 0.92, -half + boardThickness * 0.35, z],
          tint('brass', 0.07, 0.5),
        ))
      }

      // --- Corner bosses ------------------------------------------------------
      // Brass studs at the four corners of both boards.
      //
      // These are the single most recognisable thing about a medieval book and
      // the model had none. They are not ornament: a book of this weight was
      // stored FLAT, often on its side, and the bosses hold the leather clear
      // of the shelf so it does not abrade. Without them the silhouette is a
      // modern hardback.
      const bossRadius = config.width * 0.055
      for (const side of [-1, 1]) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const boss = prismGeometry(
              bossRadius,
              bossRadius * 0.55,
              config.thickness * 0.2,
              6,
              [
                sx * halfWidth * 0.78,
                side * (half + config.thickness * 0.04),
                sz * (config.length / 2) * 0.84,
              ],
              tint('brass', side > 0 ? 0.04 : -0.02, 0.6),
            )
            // Domes point away from the book on each face.
            if (side < 0) flipGeometry(boss)
            claspPieces.push(boss)
          }
        }
      }

      return {
        cover: { slot: 'leather' as const, geometry: mergeColoured(cover) },
        pages: { slot: 'cloth' as const, geometry: mergeColoured([pages]) },
        clasps: claspPieces.length > 0
          ? { slot: 'brass' as const, geometry: mergeColoured(claspPieces) }
          : undefined,
      }
    },
  }, overrides)
}
