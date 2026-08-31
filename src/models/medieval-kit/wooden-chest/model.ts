/**
 * @medieval-kit/wooden-chest
 *
 * The six-board chest — the dominant chest form of the middle ages. The
 * barrel-lidded coffer of pirate films is actually a far later thing; the chest
 * of the period is a flat-lidded box whose two end boards run down to the floor
 * to form the feet, its front girded with iron straps.
 *
 * The kit's first model with ACTIONS. Opening the lid is not a `configure()`
 * job: the chest's identity does not change, only its state in the scene does.
 * The protocol's `actions` field exists for exactly this.
 *
 * The real issue behind the lid is that the parts must be siblings: when the
 * lid turns, the iron straps on it and the lock hasp have to turn with it. Were
 * they separate parts they would hang in mid-air. That is why they are all
 * `extras` bodies of a single part — the meaning is not split, only the material.
 */
import { Color } from 'three'

import {
  MEDIEVAL_PALETTE,
  boxGeometry,
  chamferedBoxGeometry,
  createKitModel,
  ironTint,
  jitter,
  mergeColoured,
  prismGeometry,
} from '../core/index.ts'

export interface WoodenChestConfig {
  /** Width — the long side (metres). */
  readonly width: number
  /** Total height with the lid closed (metres). */
  readonly height: number
  /** Depth (metres). */
  readonly depth: number
  /** Number of vertical iron straps on the front and back faces. */
  readonly bandCount: number
  /** The angle the lid makes when fully open (degrees). */
  readonly openAngle: number
  readonly seed: number
}

export const woodenChestDefaults: WoodenChestConfig = {
  width: 0.82,
  height: 0.5,
  depth: 0.44,
  bandCount: 3,
  openAngle: 104,
  seed: 23,
}

export type WoodenChestParts = 'body' | 'lid' | 'bands' | 'lock'

export interface WoodenChestActions {
  /** Sets the target state. The motion advances as `update()` is called. */
  setOpen(open: boolean): void
  /** Open ↔ close. Returns the new TARGET state. */
  toggle(): boolean
  /** The target state — the motion may not have finished. */
  isOpen(): boolean
  /** Instantaneous progress of the motion: 0 closed, 1 fully open. */
  openness(): number
  /** Skips the motion and snaps straight to the target. */
  snap(): void
}

export function createModel(overrides: Partial<WoodenChestConfig> = {}) {
  // The lid state is kept OUTSIDE the build. Even when `configure()` rebuilds
  // the chest the lid has to stay open — otherwise changing the width would
  // slam it shut.
  let target = 0
  let progress = 0

  return createKitModel<WoodenChestConfig, 'oak' | 'iron', WoodenChestParts, WoodenChestActions>({
    id: 'wooden-chest',
    defaults: woodenChestDefaults,
    slots: ['oak', 'iron'],

    build: ({ config, random }) => {
      const tint = new Color()
      const oak = (lift = 0): Color => {
        tint.copy(MEDIEVAL_PALETTE.oak)
        tint.offsetHSL(jitter(random, 0.012), jitter(random, 0.05), lift + jitter(random, 0.05))
        return tint
      }

      const half = config.height / 2
      // Board thickness follows the SMALLEST dimension. Tying it to the depth
      // alone gave a deep chest thick boards — a real chest board is ~2 cm
      // regardless of how big the chest is.
      const board = Math.min(config.width * 0.5, config.height, config.depth) * 0.055
      const lidThickness = config.height * 0.075
      const footHeight = config.height * 0.14
      const bodyTop = half - lidThickness
      const bodyFloor = -half + footHeight
      const wallHeight = bodyTop - bodyFloor
      const strap = board * 0.3                   // iron strap thickness

      // --- BODY ----------------------------------------------------------
      const bodyPieces = []

      // End boards: the chest's load bearers. Down below they split in two and
      // become the feet — the detail that makes a six-board chest recognisable.
      for (const side of [-1, 1]) {
        const x = side * (config.width / 2 - board / 2)
        bodyPieces.push(chamferedBoxGeometry(
          [board, config.depth],
          [board, config.depth],
          wallHeight,
          board * 0.22,
          [x, bodyFloor + wallHeight / 2, 0],
          oak(0.02),
        ))

        // The feet. They are extended INTO the end board: their top faces stay
        // inside solid material so that no pair of faces ends up coplanar.
        const footDepth = config.depth * 0.3
        for (const end of [-1, 1]) {
          bodyPieces.push(boxGeometry(
            [board * 1.16, footHeight + board * 0.6, footDepth],
            [x, -half + (footHeight + board * 0.6) / 2, end * (config.depth / 2 - footDepth / 2)],
            oak(-0.05),
          ))
        }
      }

      // Front and back boards: they fit between the end boards and sink a
      // little way into them at their ends (the z-fighting rule).
      for (const face of [1, -1]) {
        bodyPieces.push(chamferedBoxGeometry(
          [config.width - board * 1.3, board],
          [config.width - board * 1.3, board],
          wallHeight - board * 0.36,
          board * 0.2,
          [0, bodyFloor + wallHeight / 2, face * (config.depth / 2 - board / 2)],
          oak(face > 0 ? 0.03 : -0.02),
        ))
      }

      // Floor: it sinks into all four walls.
      bodyPieces.push(boxGeometry(
        [config.width - board * 1.3, board, config.depth - board * 1.3],
        [0, bodyFloor + board * 0.6, 0],
        oak(-0.08),
      ))

      // --- LID -----------------------------------------------------------
      // Hinge: the top rear edge. The lid geometry is written RELATIVE TO THAT
      // POINT, the anchor is moved there, and `rotation.x` now opens the lid.
      const overhang = board * 0.85
      const lidDepth = config.depth + overhang
      const lid = mergeColoured([chamferedBoxGeometry(
        [config.width + overhang * 2, lidDepth],
        [config.width + overhang * 1.7, lidDepth - overhang * 0.15],
        lidThickness,
        board * 0.18,
        [0, lidThickness / 2 - board * 0.3, lidDepth / 2],
        oak(0.06),
      )])

      // --- IRON ----------------------------------------------------------
      // The straps end on the body and continue on the lid. Closed they read as
      // a single piece, open they part along the hinge line — that is exactly
      // what a real strap hinge is.
      const count = Math.max(0, Math.round(config.bandCount))
      const strapWidth = config.width * 0.055
      const bandXs = Array.from({ length: count }, (_, i) =>
        count === 1 ? 0 : (i / (count - 1) - 0.5) * config.width * 0.66)

      const bandPieces = []
      const lidIron = []

      // The middle of the front face is the LOCK's place. On a real chest no
      // strap goes there — the escutcheon already does that job. The rule is
      // both correct and closes off a whole class of bug at the root: with the
      // strap and the lock bridge in the same place, at certain dimensions
      // their top faces became coplanar and shimmered.
      const lockSpan = config.width * 0.075 + strapWidth * 0.7
      const clearsLock = (x: number): boolean => Math.abs(x) > lockSpan

      for (const x of bandXs) {
        const front = clearsLock(x)
        for (const face of [1, -1]) {
          if (face > 0 && !front) continue
          const z = face * (config.depth / 2 + strap * 0.2)
          // Body strap: it stays entirely WITHIN the board's Y range, otherwise
          // its bottom and top faces end up coplanar with the board's.
          bandPieces.push(boxGeometry(
            [strapWidth, wallHeight - board * 0.9, strap],
            [x, bodyFloor + wallHeight / 2, z],
            ironTint(random, -0.02),
          ))
        }

        if (front) {
          // Lid strap: it reaches from the top towards the back and ends on the hinge line.
          lidIron.push(boxGeometry(
            [strapWidth, strap, lidDepth * 0.92],
            [x, lidThickness + strap * 0.3, lidDepth * 0.46],
            ironTint(random, 0.02),
          ))
          // The end that curls down over the front edge.
          lidIron.push(boxGeometry(
            [strapWidth, lidThickness * 1.5, strap],
            [x, lidThickness * 0.35, lidDepth - strap * 0.2],
            ironTint(random),
          ))
        }
      }

      // The hinge cylinders must sit EXACTLY at the local origin: that is the
      // axis of rotation. One nudge off was enough for the hinge to sweep an arc
      // of its own as the lid opened — a real hinge turns on its own axis, it
      // does not travel.
      //
      // The hexagonal prism's flat faces are tilted too: a face lying horizontal
      // became coplanar with the lid's underside and shimmered.
      const barrel = strap * 1.45
      for (const x of bandXs) {
        const pin = prismGeometry(barrel, barrel, strapWidth * 1.2, 6, [0, 0, 0],
          ironTint(random, 0.04))
        pin.rotateZ(Math.PI / 2)
        pin.rotateX(Math.PI / 12)
        pin.translate(x, 0, 0)
        lidIron.push(pin)
      }

      /*
       * Two narrow brackets on each end board, matching the front straps.
       *
       * This was ONE strap `depth * 0.16` wide, which is about three times the
       * section of the straps on the front, and `wallHeight * 0.78` tall centred
       * on the panel, so it stopped a ninth of the wall short at the top and the
       * same at the bottom. A broad slab finishing in mid-panel above the foot
       * does not read as ironwork; it reads as an unfinished cut. Same section
       * and same run as the front now, which is what the reference has.
       */
      for (const side of [-1, 1]) {
        for (const z of [-config.depth * 0.28, config.depth * 0.28]) {
          bandPieces.push(boxGeometry(
            [strap, wallHeight - board * 0.9, strapWidth],
            [side * (config.width / 2 + strap * 0.2), bodyFloor + wallHeight / 2, z],
            ironTint(random, -0.04),
          ))
        }
      }

      // --- LOCK ----------------------------------------------------------
      // The escutcheon on the body, the hasp on the lid. The two have to be in
      // separate places: one is fixed, the other rises with the lid.
      const plateHeight = config.height * 0.19
      const lockZ = config.depth / 2 + strap * 0.2
      const lock = mergeColoured([
        chamferedBoxGeometry(
          [config.width * 0.15, strap * 1.6],
          [config.width * 0.115, strap * 1.6],
          plateHeight,
          strap * 0.5,
          [0, bodyTop - plateHeight * 0.62, lockZ],
          ironTint(random, 0.05),
        ),
        // The bridge the hasp passes through.
        boxGeometry(
          [config.width * 0.05, strap * 2.2, strap * 2.6],
          [0, bodyTop - plateHeight * 0.32, lockZ + strap * 0.9],
          ironTint(random, 0.09),
        ),
      ])

      // Hasp: it hangs down from the lid's front edge and seats over the bridge.
      lidIron.push(boxGeometry(
        [config.width * 0.075, plateHeight * 0.62, strap * 1.2],
        [0, lidThickness * 0.5 - plateHeight * 0.31, lidDepth + strap * 0.35],
        ironTint(random, 0.07),
      ))

      return {
        body: { slot: 'oak' as const, geometry: mergeColoured(bodyPieces) },
        lid: {
          slot: 'oak' as const,
          geometry: lid,
          origin: [0, bodyTop, -config.depth / 2] as const,
          extras: [{ slot: 'iron' as const, geometry: mergeColoured(lidIron) }],
        },
        bands: { slot: 'iron' as const, geometry: mergeColoured(bandPieces) },
        lock: { slot: 'iron' as const, geometry: lock },
      }
    },

    actions: ({ parts, getConfig }) => {
      const apply = (): void => {
        parts.lid.anchor.rotation.x = -(getConfig().openAngle * Math.PI / 180) * progress
      }
      apply()
      return {
        setOpen: (open) => { target = open ? 1 : 0 },
        toggle: () => { target = target > 0.5 ? 0 : 1; return target > 0.5 },
        isOpen: () => target > 0.5,
        openness: () => progress,
        snap: () => { progress = target; apply() },
      }
    },

    update: (dt, { parts, getConfig }) => {
      if (progress === target) return
      // Exponential approach: INDEPENDENT of frame time. A naive lerp such as
      // `progress += diff * k` would open slower at 30 fps than at 120 fps.
      progress += (target - progress) * (1 - Math.exp(-9 * Math.max(0, dt)))
      // An exponential approach never actually arrives; at the threshold it is
      // snapped so that `openness()` can really return 1.
      if (Math.abs(target - progress) < 0.0015) progress = target
      parts.lid.anchor.rotation.x = -(getConfig().openAngle * Math.PI / 180) * progress
    },
  }, overrides)
}
