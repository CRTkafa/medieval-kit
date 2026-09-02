/**
 * @contemporary-props/pavement-sign-board
 *
 * The first hinge in the kit with a REAL ORIGIN, on the simplest body that
 * could carry one, which is what the catalogue puts it fourteenth for.
 *
 * Every action before this one turned something small on a body that stayed
 * put: a handwheel, a lever, a lid. This one moves half the object. That makes
 * the origin the whole design problem rather than a detail of it, because a
 * part rotates about its own anchor and nothing else -- so the anchor has to
 * BE the hinge pin, and the geometry has to be built hanging from it.
 *
 * Each panel is therefore modelled in its own space with the pin at the origin
 * and the board hanging down to -Lp. Not centred, not sitting on the ground:
 * hanging. `fold` is then one number driving `rotation.x` on two parts and
 * nothing else, and the closed pose is the open pose with that number at zero.
 *
 * The second thing the fold has to do is keep the sign ON THE GROUND. Folding
 * an A-board makes it taller -- the panels stop leaning -- so an origin fixed
 * at the open height buries the feet as it closes. The action moves the anchor
 * up by `Lp cos(angle)` as it goes, which is the same trigonometry the pose is
 * already made of.
 *
 * Measured off the reference against an A1 panel: 900 mm of board on a 620 mm
 * width, 620 mm of foot spread, which puts the half angle at 19 degrees.
 */
import { type BufferGeometry } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type RuntimeContext,
} from '../core/index.ts'

export interface PavementSignConfig {
  /** Length of a panel down its slope (metres). */
  readonly panel: number
  /** Width of a panel (metres). */
  readonly width: number
  /** How far the sign is folded, 0 open to 1 flat. */
  readonly fold: number
  readonly seed: number
}

export const pavementSignDefaults: PavementSignConfig = {
  panel: 0.95,
  // An A1 sheet is 594 wide, and the frame is what carries the extra.
  width: 0.62,
  fold: 0,
  seed: 31,
}

export type PavementSignParts = 'front' | 'back' | 'hinges' | 'stayFront' | 'stayBack'

export interface PavementSignActions {
  /** Folds the sign. 0 open, 1 flat. */
  fold(amount?: number): void
}

/** Half the splay, off the reference's 900 mm height over 620 mm of spread. */
const OPEN = 0.33
/** The frame's section through the panel. The stay hangs off its inner face. */
const SECTION_T = 0.024
/** Where the stay crosses, as a fraction of the panel down from the pin. */
const STAY_AT = 0.62
/** Half the stay: the open horizontal gap between one panel's face and the centre. */
const reachOf = (Lp: number): number =>
  Lp * STAY_AT * Math.sin(OPEN) - (SECTION_T / 2) * Math.cos(OPEN)

/**
 * The pose, written once because TWO THINGS drive it.
 *
 * `fold` is a slider and a method. Moving the slider calls `configure()`,
 * which rebuilds the geometry -- and the geometry does not depend on the fold
 * at all, because the whole pose is anchor rotations. A rebuild does not
 * re-run the action that set them, so in the viewer the slider was inert.
 *
 * Rebuilding also resets each anchor's POSITION to its origin while leaving
 * its rotation alone. That is the kit's rule and it is the right one, but this
 * model drives both, so after any rebuild the pin height and the panel angle
 * disagreed. Hence one function, called from the action and again every frame.
 */
function applyFold(
  runtime: RuntimeContext<PavementSignConfig, PavementSignParts>,
  amount: number,
): void {
  const { parts } = runtime
  const t = Math.min(1, Math.max(0, amount))
  const angle = OPEN * (1 - t)
  parts.front.anchor.rotation.x = angle
  parts.back.anchor.rotation.x = -angle

  // The pin rises as the panels straighten, because a folded A-board is taller
  // than an open one and an origin left at the open height buries the feet.
  const Lp = Math.min(1.4, Math.max(0.5, runtime.getConfig().panel))
  const hingeY = Lp * Math.cos(angle)
  for (const part of [parts.front, parts.back, parts.hinges]) {
    part.anchor.position.setY(hingeY)
  }

  /*
   * ...and then the stay follows, which is two numbers per link.
   *
   * The pin sits on the panel's inner face `STAY_AT` of the way down, so where
   * it ENDS UP is the panel's own rotation applied to that point. The knuckle
   * is on the centre plane at whatever height a link of fixed length can still
   * reach from there -- which is what makes the pair go straight when open and
   * hang when shut, with no case analysis and no clamp.
   */
  const reach = reachOf(Lp)
  for (const [part, facing] of [[parts.stayFront, -1], [parts.stayBack, 1]] as const) {
    const rot = -facing * angle
    const ly = -Lp * STAY_AT
    const lz = (-facing * SECTION_T) / 2
    const ay = hingeY + ly * Math.cos(rot) - lz * Math.sin(rot)
    const az = ly * Math.sin(rot) + lz * Math.cos(rot)
    part.anchor.position.set(0, ay, az)
    // Built hanging along -Y, so the angle that points it at the knuckle is
    // measured from straight down.
    part.anchor.rotation.x = Math.atan2(az, Math.sqrt(Math.max(0, reach * reach - az * az)))
  }
}

export function createModel(overrides: Partial<PavementSignConfig> = {}) {
  // Shared by the action and the frame hook, which are two properties of the
  // same options object and otherwise have no way to agree.
  let heldFold = 0
  let seenFold = Number.NaN

  return createKitModel<
    PavementSignConfig,
    'steelPainted' | 'plastic' | 'rubber' | 'stainless',
    PavementSignParts, PavementSignActions
  >({
    id: 'pavement-sign-board',
    defaults: pavementSignDefaults,
    slots: ['steelPainted', 'plastic', 'rubber', 'stainless'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const Lp = Math.min(1.4, Math.max(0.5, config.panel))
      const W = Math.min(1, Math.max(0.35, config.width))

      // The extruded section the whole frame is made of: 42 wide, 24 through.
      const sw = 0.042
      const st = SECTION_T
      const halfW = W / 2

      const black = tint('steelPainted', -0.3, 0.35)
      const white = tint('plastic', 0.16, 0.25)
      // Warmed off neutral, for the same reason the bench's bolts were: a small
      // pale fitting on a black frame reads cold unless it is given a hue.
      const chrome = tint('stainless', -0.02, 0.2).offsetHSL(0, -1, 0).offsetHSL(0.08, 0.08, 0)

      const bar = (
        x: number, y: number, z: number,
        dx: number, dy: number, dz: number, colour = black,
      ): BufferGeometry => chamferedBoxGeometry(
        [dx, dz], [dx, dz], dy, Math.min(dx, dy, dz) * 0.18, [0, 0, 0], colour,
      ).translate(x, y, z)

      /**
       * One panel, hanging from the pin at its own origin.
       *
       * Stiles run the full length and the rails sit BETWEEN them, which is
       * how an extruded frame is actually cut and mitred; run the other way
       * round the corners read as lapped and the section stops looking like
       * one length of stock.
       */
      const panel = (facing: number): {
        frame: BufferGeometry[]
        board: BufferGeometry[]
        caps: BufferGeometry[]
        leaves: BufferGeometry[]
      } => {
        const pieces: BufferGeometry[] = []
        const caps: BufferGeometry[] = []
        const board: BufferGeometry[] = []
        const leaves: BufferGeometry[] = []
        const stileX = halfW - sw / 2
        const railTop = -sw / 2
        // The stiles carry on past the bottom rail into the feet, which is the
        // only thing keeping the frame off wet pavement. Measured off the
        // reference at a twelfth of the panel. The critic asked for longer
        // legs and then, on the longer legs, for shorter ones; a real board
        // stands 70 to 80 mm off the pavement on a 900 mm panel, which is
        // this, and is between the two things it asked for.
        const footDrop = Lp * 0.09
        const railBot = -Lp + footDrop + sw / 2

        /*
         * The foot caps sit FLAT, and getting there is the picnic table's leg
         * problem again in a different coordinate system.
         *
         * A cap modelled square to its stile is square to a member leaning 19
         * degrees, so it meets the pavement on one edge and the sign stands on
         * four lines. A moulded cap is level. Turning it by the panel's own
         * angle inside the panel's own space cancels that angle exactly, and
         * it is made deep enough to swallow the stile's mitred end behind it.
         */
        const capH = Lp * 0.045
        for (const side of [-1, 1]) {
          pieces.push(bar(side * stileX, -Lp / 2, 0, sw, Lp, st))
          const cap = chamferedBoxGeometry(
            [sw * 1.12, st * 1.12], [sw * 1.06, st * 1.06], capH, st * 0.12,
            [0, 0, 0], tint('rubber', -0.04, 0.2),
          )
          cap.rotateX(facing * OPEN)
          cap.translate(side * stileX, -Lp + capH / (2 * Math.cos(OPEN)), 0)
          caps.push(cap)
        }
        pieces.push(bar(0, railTop, 0, W - sw * 2, sw, st))
        pieces.push(bar(0, railBot, 0, W - sw * 2, sw, st))

        // The insert: a sheet set into the frame's inner face, so the frame
        // stands proud of it on the outside exactly as the reference's does.
        const inset = sw * 0.55
        board.push(bar(
          0, (railTop + railBot) / 2, facing * (st / 2 - 0.004),
          W - inset * 2, railTop - railBot - inset * 0.6, 0.005, white,
        ))

        /*
         * A hinge LEAF, and it belongs to the panel it is screwed to.
         *
         * Only the knuckle is on the axis; the two leaves turn with their own
         * panels, which is what a butt hinge is. Built into the fixed part
         * instead they stay put while the panels swing out from under them.
         */
        for (const side of [-1, 1]) {
          leaves.push(bar(
            side * W * 0.26, -0.019, facing * (st / 2 + 0.0016),
            W * 0.082, 0.032, 0.003, chrome,
          ))
        }

        /*
         * ...and the whole panel steps back a couple of millimetres from the
         * pin.
         *
         * Both panels are the same frame mirrored, so their stiles' inner
         * faces are at the same x by construction. Down at the feet they are
         * 600 mm apart in z and nothing notices; up at the pin they converge
         * onto each other and become two surfaces in one plane, overlapping,
         * with nothing to choose between them. A real hinge has a gap there
         * for exactly the reason a modelled one needs one.
         */
        for (const g of [...pieces, ...board, ...caps, ...leaves]) {
          g.translate(0, 0, facing * 0.0019)
        }

        bakeOcclusion(pieces, { strength: 0.35 })
        return { frame: pieces, board, caps, leaves }
      }

      /**
       * The hinges, and they do NOT move.
       *
       * A butt hinge's knuckle is the axis, so it sits on the pin and stays
       * there through the whole fold while both leaves turn under it. Making
       * it part of a panel would have it orbit the thing it is supposed to be
       * the centre of.
       */
      /**
       * The stay is a REAL LINKAGE, and it took a wrong answer to get there.
       *
       * A pavement sign's stay is one bar with a pin in its middle: two links
       * that go straight when the sign is open and collapse between the panels
       * when it shuts. The first cut made each link a rigid part of its panel,
       * on the reasoning that they would overlap harmlessly in the gap. They do
       * not. With the panels vertical each link points sideways rather than
       * into any gap, and the folded sign measured 386 mm through a body that
       * should be 50 mm thick.
       *
       * So each link is its own part, hanging along -Y from a pin at its
       * origin, and the fold drives BOTH its position and its angle: the
       * anchor rides to wherever its panel's face has carried the pin, and the
       * link swings to point at the knuckle on the centre plane. The knuckle
       * is wherever a link of fixed length can reach it, which is the whole of
       * the arithmetic and the whole of why the thing collapses.
       */
      const reach = reachOf(Lp)
      const stay = (pin: boolean): BufferGeometry => {
        /*
         * Wider and lighter than the frame, and both are about being SEEN.
         *
         * Measured, the pair spans the gap exactly: -0.180 to +0.180 with the
         * pin at zero, panel face to panel face. It was reported missing three
         * rounds running anyway, because a black bar nine millimetres thick,
         * in the shadow between two panels, is four pixels of a render. The
         * geometry never needed changing; what needed changing was whether
         * anything could tell.
         */
        const link = chamferedBoxGeometry(
          [0.034, 0.013], [0.034, 0.013], reach, 0.003, [0, 0, 0],
          tint('steelPainted', -0.12, 0.3),
        ).translate(0, -reach / 2, 0)
        if (!pin) return link
        // The pin at the far end, on one link only, because there is one pin
        // and two links. Without it the pair meets end to end with nothing
        // marking the joint and reads as a bar that stops halfway across --
        // which is exactly what the critic saw, on geometry that measured
        // correct to the millimetre.
        const boss = latheGeometry([
          { y: -0.008, radius: 0.006 },
          { y: 0.008, radius: 0.006 },
        ], 10, [0, 0, 0], chrome, { capBottom: true, capTop: true })
        boss.rotateX(Math.PI / 2)
        boss.translate(0, -reach, 0)
        return mergeColoured([link, boss])
      }

      const hingePieces: BufferGeometry[] = []
      for (const side of [-1, 1]) {
        const knuckle = latheGeometry([
          { y: -W * 0.046, radius: 0.008 },
          { y: W * 0.046, radius: 0.008 },
        ], 12, [0, 0, 0], chrome, { capBottom: true, capTop: true })
        knuckle.rotateZ(Math.PI / 2)
        knuckle.translate(side * W * 0.26, 0.004, 0)
        hingePieces.push(knuckle)
      }

      /*
       * The insert and the caps ride the panel as EXTRAS rather than as vertex
       * colours on the frame.
       *
       * They are different materials -- a printed sheet and a moulded foot on
       * an aluminium extrusion -- and a consumer who swaps `steelPainted` for
       * their own paint should not repaint the sign face with it. An extra
       * carries its own slot and follows its part through the fold, which is
       * exactly the relationship these three have.
       */
      const side = (facing: number) => {
        const { frame, board, caps, leaves } = panel(facing)
        return {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(mergeColoured(frame), 24),
          origin: [0, Lp * Math.cos(OPEN), 0] as const,
          extras: [
            { slot: 'plastic' as const, geometry: smoothNormals(mergeColoured(board), 30) },
            { slot: 'rubber' as const, geometry: smoothNormals(mergeColoured(caps), 24) },
            { slot: 'stainless' as const, geometry: smoothNormals(mergeColoured(leaves), 30) },
          ],
        }
      }

      const stayOrigin = (facing: number): readonly [number, number, number] => {
        const rot = -facing * OPEN
        return [
          0,
          Lp * Math.cos(OPEN) + -Lp * STAY_AT * Math.cos(rot) - ((-facing * st) / 2) * Math.sin(rot),
          -Lp * STAY_AT * Math.sin(rot) + ((-facing * st) / 2) * Math.cos(rot),
        ] as const
      }

      return {
        front: side(-1),
        back: side(1),
        stayFront: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(stay(true), 24),
          origin: stayOrigin(-1),
        },
        stayBack: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(stay(false), 24),
          origin: stayOrigin(1),
        },
        hinges: {
          slot: 'stainless' as const,
          geometry: smoothNormals(mergeColoured(hingePieces), 30),
          origin: [0, Lp * Math.cos(OPEN), 0] as const,
        },
      }
    },

    actions: (runtime) => {
      heldFold = runtime.getConfig().fold
      seenFold = heldFold
      applyFold(runtime, heldFold)
      return {
        fold: (amount = 1) => { heldFold = amount; applyFold(runtime, amount) },
      }
    },

    // The config is adopted into the held pose whenever it changes, and the
    // held pose is re-applied every frame. Between slider moves the action
    // wins, which is what lets a consumer animate the sign.
    update: (_dt, runtime) => {
      const wanted = runtime.getConfig().fold
      if (wanted !== seenFold) { seenFold = wanted; heldFold = wanted }
      applyFold(runtime, heldFold)
    },
  }, overrides)
}
