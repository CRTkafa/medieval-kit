/**
 * @contemporary-props/temporary-fence-panel
 *
 * Welded mesh in a tube frame, which the catalogue puts thirty-first with the
 * note that thousands of identical bars is exactly the work generation should
 * absorb. That is the whole argument for a source-first kit in one object: a
 * modeller draws this mesh once and never changes its pitch again, and here the
 * pitch is a slider and the wires are a loop.
 *
 * The mesh is NOT `perforate`. That helper punches a surface -- it emits the
 * metal left between holes, as flat web on a described surface -- and it is
 * right for a bin's drum or a colander's shell. Welded mesh is the opposite
 * construction: it is bars with nothing between them, seen from both sides and
 * usually at a grazing angle, where a flat ribbon would vanish edge on. So the
 * wires here are solid stock, and the helper's own comment says which rows want
 * it instead.
 *
 * The frame is one bent tube, which is `tubeGeometry`'s third use: up one leg,
 * round a radius, across the top, round again and down the other. A real panel
 * is bent from a single length and the two top corners are the give-away --
 * built as three straight tubes with mitres it reads as scaffold rather than as
 * a pressing.
 *
 * Measured off the reference, which is the 2.4 m panel rather than the 3.45 m
 * Heras: vertical wires at a 50 mm pitch, six horizontals, a frame tube of
 * 32 mm, and two moulded feet the legs drop into.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  mergeColoured,
  smoothNormals,
  tubeGeometry,
  type RuntimeContext,
  type Vec3,
} from '../core/index.ts'

export interface FencePanelConfig {
  /** Width of the panel, leg centre to leg centre (metres). */
  readonly width: number
  /** Height to the top of the frame (metres). */
  readonly height: number
  /** Pitch of the vertical wires (metres). */
  readonly pitch: number
  /** Horizontal wires across the mesh. */
  readonly rails: number
  /** How far the panel is swung about its coupler, 0 in line to 1 square. */
  readonly swing: number
  readonly seed: number
}

export const fencePanelDefaults: FencePanelConfig = {
  width: 2.4,
  height: 2,
  pitch: 0.05,
  rails: 6,
  swing: 0,
  seed: 51,
}

export type FencePanelParts = 'panel' | 'feet'

export interface FencePanelActions {
  /** Swings the panel about the coupler at its left leg. 1 is a right angle. */
  swing(amount?: number): void
}

/**
 * The swing, in one place because a slider and a method both drive it -- the
 * lesson the pavement sign, the extinguisher and the litter bin all paid for.
 */
function applySwing(
  runtime: RuntimeContext<FencePanelConfig, FencePanelParts>,
  amount: number,
): void {
  const turn = Math.min(1, Math.max(0, amount)) * (Math.PI / 2)
  for (const part of Object.values(runtime.parts)) part.anchor.rotation.y = turn
}

export function createModel(overrides: Partial<FencePanelConfig> = {}) {
  let heldSwing = 0
  let seenSwing = Number.NaN

  return createKitModel<
    FencePanelConfig, 'galvanised' | 'rubber', FencePanelParts, FencePanelActions
  >({
    id: 'temporary-fence-panel',
    defaults: fencePanelDefaults,
    slots: ['galvanised', 'rubber'],
    // Hot-dip zinc, and a panel is the largest single expanse of it the kit
    // has: a flat finish here would show more than anywhere else.
    mottle: { amount: 0.24, cell: 0.12 },

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const W = Math.min(3.6, Math.max(1, config.width))
      const H = Math.min(2.6, Math.max(1, config.height))
      const rails = Math.max(2, Math.round(config.rails))

      const zinc = tint('galvanised', jitter(random, 0.02), 0.6)
      const wire = tint('galvanised', 0.03, 0.5)

      const tube = H * 0.008
      const corner = H * 0.1
      const half = W / 2
      // The legs run past the bottom rail and into the feet, which is what
      // stops the panel reading as a hurdle standing on its own frame.
      const legFoot = H * 0.03
      const railY = H * 0.16

      const panelPieces: BufferGeometry[] = []

      /* -------------------------------------------------------------- frame */
      /**
       * One tube, bent twice. The corners are sampled arcs rather than mitres
       * because a mitre is a weld and a radius is a bender, and the reference
       * was plainly bent.
       */
      const path: Vec3[] = []
      path.push([-half, legFoot, 0])
      for (const t of [0.3, 0.6]) path.push([-half, legFoot + (H - corner - legFoot) * t, 0])
      path.push([-half, H - corner, 0])
      const steps = 8
      for (let i = 1; i < steps; i += 1) {
        const a = Math.PI - (i / steps) * (Math.PI / 2)
        path.push([-half + corner + Math.cos(a) * corner, H - corner + Math.sin(a) * corner, 0])
      }
      path.push([-half + corner, H, 0])
      path.push([half - corner, H, 0])
      for (let i = 1; i < steps; i += 1) {
        const a = (Math.PI / 2) - (i / steps) * (Math.PI / 2)
        path.push([half - corner + Math.cos(a) * corner, H - corner + Math.sin(a) * corner, 0])
      }
      path.push([half, H - corner, 0])
      for (const t of [0.6, 0.3]) path.push([half, legFoot + (H - corner - legFoot) * t, 0])
      path.push([half, legFoot, 0])
      panelPieces.push(tubeGeometry(path, tube, 10, zinc, { capStart: true, capEnd: true }))

      // The bottom rail, which carries the mesh's lower edge and is the only
      // straight run in the frame.
      panelPieces.push(tubeGeometry(
        [[-half, railY, 0], [0, railY, 0], [half, railY, 0]],
        tube, 10, zinc, { capStart: false, capEnd: false },
      ))

      /* --------------------------------------------------------------- mesh */
      /**
       * The wires: a derived count, never a typed one.
       *
       * The pitch is what a panel is specified by, so the COUNT falls out of
       * the width and the pitch and is then used to re-derive an exact pitch --
       * otherwise the last bay is a sliver, which on a fence is the one thing
       * everybody has seen and nobody can name.
       */
      const meshLo = railY + tube
      const meshHi = H - tube * 1.2
      const inner = W - tube * 4
      const columns = Math.max(4, Math.round(inner / Math.min(0.3, Math.max(0.02, config.pitch))))
      const wireR = H * 0.0022

      /*
       * Every wire is cut to the FRAME, not to a rectangle.
       *
       * The frame's top corners are radiused and the mesh is not, so wires cut
       * to one length stand proud of the bend at both ends -- four or five of
       * them at each corner, sticking out into the air above the tube they are
       * supposed to be welded to. It is the sort of fault that is invisible
       * head on and obvious from anywhere else.
       *
       * The cut is the arc's own equation, so it follows the corner radius
       * whatever it is set to.
       */
      const topAt = (x: number): number => {
        const over = Math.abs(x) - (half - corner)
        if (over <= 0) return meshHi
        const drop = corner - Math.sqrt(Math.max(0, corner * corner - over * over))
        return meshHi - drop
      }
      for (let i = 0; i <= columns; i += 1) {
        const x = -inner / 2 + (inner / columns) * i
        const hi = topAt(x)
        if (hi - meshLo <= wireR * 2) continue
        panelPieces.push(chamferedBoxGeometry(
          [wireR * 2, wireR * 2], [wireR * 2, wireR * 2],
          hi - meshLo, wireR * 0.5, [x, (meshLo + hi) / 2, 0], wire,
        ))
      }
      for (let i = 0; i < rails; i += 1) {
        // Spread over the mesh's own height rather than the panel's, so the top
        // wire sits under the frame instead of on it.
        const y = meshLo + ((meshHi - meshLo) / (rails - 1 || 1)) * i
        const bar = chamferedBoxGeometry(
          [wireR * 2, wireR * 2], [wireR * 2, wireR * 2],
          inner + tube, wireR * 0.5, [0, 0, 0], wire,
        )
        // Built up Y, laid across, and set a wire's thickness behind the
        // verticals: welded mesh is two layers, not one plane.
        bar.rotateZ(Math.PI / 2)
        bar.translate(0, y, -wireR * 1.6)
        panelPieces.push(bar)
      }

      // The coupler tabs, two a leg, which is what a run is bolted together
      // through and the only reason a single panel stands up in a scene.
      for (const side of [-1, 1]) {
        for (const at of [0.28, 0.72]) {
          const tab = chamferedBoxGeometry(
            [tube * 0.5, tube * 2.4], [tube * 0.5, tube * 2.4],
            tube * 2.6, tube * 0.12, [0, 0, 0], zinc,
          )
          tab.rotateZ(Math.PI / 2)
          tab.translate(side * (half + tube * 1.1), legFoot + (H - legFoot) * at, 0)
          panelPieces.push(tab)
        }
      }

      /* --------------------------------------------------------------- feet */
      /**
       * The feet, and they lie ACROSS the panel.
       *
       * A moulded block a panel's leg drops into is what makes a temporary
       * fence temporary, and its long axis is perpendicular to the fence for
       * the obvious reason: the panel falls over the other way. Drawn in line
       * with the fence the whole object stops making sense, which is worth more
       * than the two minutes the shape costs.
       */
      const footPieces: BufferGeometry[] = []
      const footL = H * 0.34
      const footH = H * 0.05
      for (const side of [-1, 1]) {
        const block = chamferedBoxGeometry(
          [H * 0.075, footL], [H * 0.062, footL * 0.9],
          footH, footH * 0.16, [0, 0, 0], tint('rubber', -0.04),
        )
        block.translate(side * half, footH / 2, 0)
        footPieces.push(block)

        // The notches at each end, which every moulded foot has: they are how
        // a forklift or a hand gets under it, and without them the foot reads
        // as a bevelled brick.
        for (const end of [-1, 1]) {
          footPieces.push(chamferedBoxGeometry(
            [H * 0.05, footL * 0.16], [H * 0.05, footL * 0.16],
            footH * 0.55, footH * 0.06,
            [side * half, footH * 0.28, end * footL * 0.34], tint('rubber', -0.3, 0.3),
          ))
        }
        // ...and the moulded recess on the top face either side of the boss.
        for (const end of [-1, 1]) {
          footPieces.push(chamferedBoxGeometry(
            [H * 0.042, footL * 0.2], [H * 0.036, footL * 0.18],
            footH * 0.12, footH * 0.04,
            [side * half, footH * 0.96, end * footL * 0.24], tint('rubber', -0.16, 0.3),
          ))
        }
        // The boss the leg goes into, so the leg lands in something rather
        // than on it.
        footPieces.push(chamferedBoxGeometry(
          [tube * 4.4, tube * 4.4], [tube * 3.6, tube * 3.6],
          footH * 0.5, tube * 0.4, [side * half, footH * 1.2, 0], tint('rubber', 0.02),
        ))
      }

      bakeOcclusion(panelPieces, { strength: 0.3 })

      // Both parts turn about the coupler at the left-hand leg, so a run of
      // these can be laid out by swinging each against the last.
      const coupler = [-half, 0, 0] as const
      const move = (pieces: BufferGeometry[]): BufferGeometry =>
        mergeColoured(pieces).translate(-coupler[0], -coupler[1], -coupler[2])

      return {
        panel: {
          slot: 'galvanised' as const,
          geometry: smoothNormals(move(panelPieces), 40),
          origin: coupler,
        },
        feet: {
          slot: 'rubber' as const,
          geometry: smoothNormals(move(footPieces), 30),
          origin: coupler,
        },
      }
    },

    actions: (runtime) => {
      heldSwing = runtime.getConfig().swing
      seenSwing = heldSwing
      applySwing(runtime, heldSwing)
      return { swing: (amount = 1) => { heldSwing = amount; applySwing(runtime, amount) } }
    },

    update: (_dt, runtime) => {
      const wanted = runtime.getConfig().swing
      if (wanted !== seenSwing) { seenSwing = wanted; heldSwing = wanted }
      applySwing(runtime, heldSwing)
    },
  }, overrides)
}
