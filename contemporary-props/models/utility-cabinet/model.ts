/**
 * @contemporary-props/utility-cabinet
 *
 * Louvre banks on a plinth under a rain-shed roof: the catalogue's forty-ninth
 * row, and the object it also names as absorbing the street telecom cabinet,
 * which is the same box with a different badge.
 *
 * It spends `louvreGeometry`, written in core because two rows in two domains
 * want it -- the locker bank in the office and this in the street. The
 * catalogue planned that helper "built on perforate" and it is not: perforate
 * emits web on a surface, for holes you see through, and a louvre is solid
 * blades standing proud of a face throwing shadows onto each other. The shadow
 * is the read, and sharing the code would have cost both.
 *
 * Measured off the reference against a 1.35 m cabinet:
 *
 *   plinth   220 mm tall, standing 100 mm proud of the cabinet all round
 *   body     1200 wide, 500 deep, doors filling the whole front
 *   roof     overhangs 90 mm, pitched shallowly to a ridge across the width
 *   louvres  four banks a door, two up and two down, five blades each
 *
 * The roof is the detail that names it. A flat lid makes a cabinet; the shallow
 * pitch with an overhang on every side is what says the thing lives outdoors
 * and has to shed water away from its own doors.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  louvreGeometry,
  mergeColoured,
  smoothNormals,
  type RuntimeContext,
} from '../core/index.ts'

export interface UtilityCabinetConfig {
  /** Width across the doors (metres). */
  readonly width: number
  /** Height to the roof ridge, plinth included (metres). */
  readonly height: number
  /** Depth front to back (metres). */
  readonly depth: number
  /** Blades in each louvre bank. */
  readonly blades: number
  /** How far the doors swing, 0 shut to 1 wide. */
  readonly open: number
  readonly seed: number
}

export const utilityCabinetDefaults: UtilityCabinetConfig = {
  width: 1.2,
  height: 1.35,
  depth: 0.5,
  blades: 5,
  open: 0,
  seed: 71,
}

export type UtilityCabinetParts = 'plinth' | 'body' | 'left' | 'right'

export interface UtilityCabinetActions {
  /** Swings both doors. 1 is wide open. */
  open(amount?: number): void
}

function applyOpen(
  runtime: RuntimeContext<UtilityCabinetConfig, UtilityCabinetParts>,
  amount: number,
): void {
  const turn = Math.min(1, Math.max(0, amount)) * 2
  // Hinged on opposite edges, so they open away from each other: a pair of
  // doors that swing the same way is a cupboard nobody can reach into.
  runtime.parts.left.anchor.rotation.y = turn
  runtime.parts.right.anchor.rotation.y = -turn
}

export function createModel(overrides: Partial<UtilityCabinetConfig> = {}) {
  let heldOpen = 0
  let seenOpen = Number.NaN

  return createKitModel<
    UtilityCabinetConfig, 'steelPainted' | 'concrete', UtilityCabinetParts, UtilityCabinetActions
  >({
    id: 'utility-cabinet',
    defaults: utilityCabinetDefaults,
    slots: ['steelPainted', 'concrete'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const W = Math.min(2.4, Math.max(0.5, config.width))
      const H = Math.min(2.2, Math.max(0.8, config.height))
      const D = Math.min(1, Math.max(0.25, config.depth))
      const blades = Math.max(2, Math.round(config.blades))

      /*
       * Grey-green, which is what every one of these is painted and the reason
       * you stop seeing them.
       *
       * Two things about these two lines were wrong and both were invisible in
       * the numbers. The hue: the palette's painted steel is a BLUE-grey at
       * about 0.58, so green is a shift DOWN the wheel -- taken the other way
       * it lands on lavender, which the roof was for a round.
       *
       * The lightness: `createTinter`'s lift lands on the LINEAR value, and
       * `steelPainted` measures 0.202 there, not the 0.48 it looks. Anything
       * past -0.19 clamps to zero. The carcass was written at -0.22 and came
       * out pure black -- not dark, black -- and so, it turns out, are the park
       * bench's frames. Small lifts here; the darkness comes from hue and
       * saturation instead.
       */
      const paint = tint('steelPainted', -0.04 + jitter(random, 0.02)).offsetHSL(-0.25, 0.05, 0)
      const shade = tint('steelPainted', -0.09, 0.4).offsetHSL(-0.25, 0.08, 0)

      const plinthH = H * 0.163
      const roofH = H * 0.082
      const bodyH = H - plinthH - roofH
      const bodyY = plinthH

      /* ------------------------------------------------------------- plinth */
      // Concrete, and PROUD of the cabinet all round: a plinth flush with the
      // box it carries reads as the bottom of the box.
      const plinthPieces: BufferGeometry[] = [chamferedBoxGeometry(
        [W * 1.02 + D * 0.24, D + W * 0.16], [W + D * 0.2, D + W * 0.13],
        plinthH, plinthH * 0.1, [0, plinthH / 2, 0], tint('concrete', 0.05),
      )]

      /* --------------------------------------------------------------- body */
      const bodyPieces: BufferGeometry[] = []
      // The carcass, set back behind the doors so the doors are the front.
      bodyPieces.push(chamferedBoxGeometry(
        [W, D], [W, D],
        bodyH, W * 0.012, [0, bodyY + bodyH / 2, -D * 0.03], shade,
      ))

      /**
       * The roof: a shallow pitch with an overhang, and the detail that names
       * the object.
       *
       * Two slabs meeting at a ridge across the width, each tilted, plus a
       * fascia round the edge. A flat lid makes it a cupboard; the pitch and
       * the overhang are what say it stands in the rain and has to throw water
       * clear of its own door seals.
       */
      const roofPieces: BufferGeometry[] = []
      const eave = W * 0.075
      const ridge = bodyY + bodyH + roofH
      for (const side of [-1, 1]) {
        const slab = chamferedBoxGeometry(
          [W + eave * 2, D / 2 + eave], [W + eave * 2, D / 2 + eave],
          roofH * 0.38, W * 0.008, [0, 0, 0], paint,
        )
        slab.rotateX(side * 0.16)
        slab.translate(0, ridge - roofH * 0.42, side * (D / 4 + eave / 2))
        roofPieces.push(slab)
      }
      // The fascia the slabs sit on, which is what gives the roof a thickness
      // at the eaves rather than a knife edge.
      roofPieces.push(chamferedBoxGeometry(
        [W + eave * 2, D + eave * 2], [W + eave * 1.9, D + eave * 1.9],
        roofH * 0.3, W * 0.008, [0, bodyY + bodyH + roofH * 0.15, 0], paint,
      ))
      bodyPieces.push(...roofPieces)

      /* -------------------------------------------------------------- doors */
      /**
       * Two doors, each built at its own hinge.
       *
       * A door is the one part where writing it in place and giving it an
       * origin is most tempting and most wrong: the geometry has to be in the
       * hinge's space or it is placed twice. Both are built about x = 0 and
       * moved, so the same code makes the left and the right.
       */
      const doorW = W / 2
      const doorH = bodyH * 0.955
      const doorT = W * 0.015
      const doorY = bodyY + bodyH * 0.5
      // In FRONT of the carcass, which is set back by three percent of the
      // depth. Placed at the carcass's own front plane the doors sat inside it
      // and the render was a black box: the thing you were looking at was the
      // shell, through where the doors should have been.
      const doorZ = -(D / 2 + D * 0.03) - doorT / 2

      const door = (side: number): BufferGeometry[] => {
        const pieces: BufferGeometry[] = []
        // The skin, written about the hinge at its outer edge.
        pieces.push(chamferedBoxGeometry(
          [doorW * 0.985, doorT], [doorW * 0.985, doorT],
          doorH, doorT * 0.4, [side * doorW * 0.5, 0, 0], paint,
        ))

        /*
         * Four banks: two up, two down, side by side in pairs.
         *
         * The reference groups them that way rather than spreading one tall
         * bank down the door, and the grouping is functional -- the top pair
         * vents warm air out and the bottom pair draws cool air in, so the
         * middle of the door is left plain for the label nobody reads.
         */
        const bankW = doorW * 0.2
        const bankH = doorH * 0.13
        for (const row of [0.29, -0.26]) {
          for (const col of [-0.5, 0.5]) {
            pieces.push(louvreGeometry({
              width: bankW,
              height: bankH,
              blades,
              depth: doorT * 1.5,
              angle: 0.42,
              centre: [side * doorW * 0.5 + col * bankW * 1.35, row * doorH, -doorT / 2],
              colour: paint,
              shadow: shade,
            }))
          }
        }

        // The handle, on the closing edge.
        pieces.push(chamferedBoxGeometry(
          [doorT * 1.4, doorT * 2.2], [doorT * 1.1, doorT * 1.8],
          doorH * 0.11, doorT * 0.3,
          [side * doorW * 0.94, 0, -doorT * 1.2], shade,
        ))
        // The hinge knuckles on the outer edge, which is what tells you which
        // way it opens before you touch it.
        for (const at of [-0.38, 0, 0.38]) {
          pieces.push(chamferedBoxGeometry(
            [doorT * 1.2, doorT * 1.6], [doorT * 1.2, doorT * 1.6],
            doorH * 0.08, doorT * 0.3,
            [side * doorW * 0.02, at * doorH, -doorT * 0.2], shade,
          ))
        }
        return pieces
      }

      /*
       * The doors are baked TOO, and that is not housekeeping.
       *
       * A louvre's whole read is the shadow one blade throws on the next. Left
       * unbaked, four banks of five blades standing 8 mm off a flat door in the
       * same paint are four rectangles of exactly the door's colour: they are
       * in the geometry, they are in the silhouette from a raking angle, and
       * head on the door is blank. Baking them is what makes the pressing
       * visible at all.
       */
      const doorPieces = [door(1), door(-1)] as const
      bakeOcclusion([...bodyPieces, ...doorPieces[0], ...doorPieces[1]], { strength: 0.45 })

      /*
       * ...and then the whole cabinet is TURNED to face the camera.
       *
       * It is written with its doors on -Z, which is the natural way round to
       * think about a front, and `renderObject` stands at +Z: every render was
       * of the back of a featureless box, which is why the louvres could not be
       * found in three passes. The park bench needed the same quarter turn and
       * the note about it is already in PROGRESS; this is the second model to
       * pay for it, so the rule is now a line in the model rather than a
       * paragraph somewhere else.
       *
       * A part with an origin turns about its own origin, so the geometry takes
       * the rotation and the origin takes the reflection.
       */
      const face = (pieces: readonly BufferGeometry[]): BufferGeometry =>
        mergeColoured([...pieces]).rotateY(Math.PI)
      const hinge = (side: number): readonly [number, number, number] =>
        [-side * (W / 2 - doorT), doorY, -doorZ] as const

      return {
        plinth: { slot: 'concrete' as const, geometry: smoothNormals(face(plinthPieces), 30) },
        body: { slot: 'steelPainted' as const, geometry: smoothNormals(face(bodyPieces), 34) },
        left: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(face(doorPieces[0]), 34),
          origin: hinge(-1),
        },
        right: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(face(doorPieces[1]), 34),
          origin: hinge(1),
        },
      }
    },

    actions: (runtime) => {
      heldOpen = runtime.getConfig().open
      seenOpen = heldOpen
      applyOpen(runtime, heldOpen)
      return { open: (amount = 1) => { heldOpen = amount; applyOpen(runtime, amount) } }
    },

    update: (_dt, runtime) => {
      const wanted = runtime.getConfig().open
      if (wanted !== seenOpen) { seenOpen = wanted; heldOpen = wanted }
      applyOpen(runtime, heldOpen)
    },
  }, overrides)
}
