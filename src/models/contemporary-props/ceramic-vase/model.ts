/**
 * @contemporary-props/ceramic-vase
 *
 * First object in the kit, and it is here to settle the revolve.
 *
 * Almost everything with a round section that follows depends on the same
 * profile machinery: the mug, the pepper mill, the stockpot, the basin, the
 * bollard, the traffic cone, every knob, foot and column. So the vase is built
 * as a curve rather than as a shape. Four control heights carry it, and each
 * one is named after what it does to the silhouette:
 *
 *   foot      where it meets the table, narrower than the belly so the vase
 *             looks placed rather than poured
 *   belly     the widest point, and the parameter that decides whether this is
 *             a bud vase or an urn
 *   shoulder  where the wall turns back in, and the one place a generated
 *             vessel usually goes wrong: put it too high and the profile reads
 *             as a bottle, too low and it reads as a bowl
 *   lip       the mouth, rolled slightly proud of the neck so the rim catches
 *             light and the opening does not look like a hole cut in a solid
 *
 * The wall has no thickness. A vase is looked at from outside and the inside of
 * the neck is dark at every angle a prop is seen from, so modelling the bore
 * would spend triangles on something nothing ever sees. The rim reads because
 * the lip steps out, not because there is a wall behind it.
 *
 * Parts: `body` alone. There is nothing here that moves or that a consumer
 * would want to reach separately, and inventing parts to look thorough makes
 * the protocol noisier without making the model more useful.
 */
import { type BufferGeometry } from 'three'

import {
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Level,
} from '../core/index.ts'

export interface CeramicVaseConfig {
  /** Overall height (metres). */
  readonly height: number
  /** Widest radius, at the belly (metres). */
  readonly bellyRadius: number
  /** Where the belly sits, as a fraction of the height. */
  readonly bellyAt: number
  /** Mouth radius as a fraction of the belly radius. */
  readonly mouth: number
  /** Sides around the revolve. Low values are a deliberate faceted look. */
  readonly segments: number
  readonly seed: number
}

export const ceramicVaseDefaults: CeramicVaseConfig = {
  height: 0.32,
  bellyRadius: 0.105,
  // Just below the middle. A belly at or above half height reads as a bottle,
  // and this is the single number that decides whether the silhouette is right.
  bellyAt: 0.42,
  mouth: 0.52,
  segments: 32,
  seed: 11,
}

export type CeramicVaseParts = 'body'

export function createModel(overrides: Partial<CeramicVaseConfig> = {}) {
  return createKitModel<CeramicVaseConfig, 'ceramic', CeramicVaseParts>({
    id: 'ceramic-vase',
    defaults: ceramicVaseDefaults,
    slots: ['ceramic'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = config.height
      const belly = config.bellyRadius
      const bellyY = H * Math.min(0.72, Math.max(0.18, config.bellyAt))
      const mouth = belly * Math.min(0.9, Math.max(0.2, config.mouth))

      // The foot is a fraction of the belly rather than a free parameter: a
      // vase whose base can be set independently can be given a base wider
      // than its body, and there is no value of that which looks like a vase.
      const foot = belly * 0.62
      const shoulderY = bellyY + (H - bellyY) * 0.58
      const neck = mouth * 1.04

      const levels: Level[] = [
        { y: 0, radius: foot * 0.94 },
        // A short straight rise off the table before the curve starts. Without
        // it the profile leaves the ground at an angle and the vase looks like
        // it is sinking into the surface.
        { y: H * 0.035, radius: foot },
        { y: bellyY * 0.55, radius: belly * 0.93 },
        { y: bellyY, radius: belly },
        { y: shoulderY, radius: belly * 0.74 },
        { y: H * 0.93, radius: neck },
        // The lip: proud of the neck by a hair, so the mouth has an edge to
        // catch light rather than being a hole in the top.
        { y: H * 0.97, radius: neck * 1.09 },
        { y: H, radius: neck * 1.06 },
      ]

      const pieces: BufferGeometry[] = [
        latheGeometry(
          levels,
          Math.max(8, Math.round(config.segments)),
          [0, 0, 0],
          tint('ceramic', jitter(random, 0.02)),
          // Glaze pools slightly toward the foot and thins over the shoulder,
          // so the top is a touch lighter. It is a small difference and it is
          // what stops a single-slot object reading as flat plastic.
          { colourTop: tint('ceramic', 0.05), capBottom: true, capTop: false },
        ),
      ]

      // Smoothed at 40 degrees. The wall is a curve and reads as one; the
      // lip, the foot and the base cap all turn through more than that and
      // stay as edges. Flat shading put a visible band at every level of the
      // profile, which on a glazed white surface is the first thing you see.
      return {
        body: { slot: 'ceramic' as const, geometry: smoothNormals(mergeColoured(pieces), 40) },
      }
    },
  }, overrides)
}
