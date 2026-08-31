/**
 * @medieval-kit/cart-wheel
 *
 * The most iconic medieval object after the barrel. It works alone too — a
 * wheel leaning against a wall turns a scene into a village instantly.
 *
 * The real thing is four layers from the outside in: iron tyre, wooden felloe,
 * spokes, hub. The felloe is not one piece, it is built from straight pieces —
 * so a lowpoly polygonal rim is not a simplification here, it is the correct
 * construction.
 *
 * The wheel stands in the XY plane; its axis is Z. Whoever wants it lying down
 * turns it with `root.rotation.x`.
 */
import { Color, type BufferGeometry } from 'three'

import {
  bandGeometry,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  type Level,
} from '../core/index.ts'

export interface CartWheelConfig {
  /** Outer radius, iron tyre included (metres). */
  readonly radius: number
  /** Number of spokes. The felloe piece count follows from it. */
  readonly spokeCount: number
  /** Wheel thickness (metres). */
  readonly width: number
  /** Hub length, as a multiple of the thickness. */
  readonly hubLength: number
  /** Iron tyre thickness, as a fraction of the radius. */
  readonly tyre: number
  readonly seed: number
}

export const cartWheelDefaults: CartWheelConfig = {
  radius: 0.52,
  spokeCount: 10,
  width: 0.09,
  hubLength: 2.1,
  // An iron tyre is a HOOP: 8 to 12 mm of bar shrunk onto the felloe. At
  // 0.045 of a 0.52 m radius it was 23 mm of iron, and with an axial width
  // greater than the wheel's own it read as a pneumatic tyre rather than as
  // the band that holds a wooden rim together.
  tyre: 0.022,
  seed: 27,
}

export type CartWheelParts = 'hub' | 'spokes' | 'felloe' | 'tyre'

export function createModel(overrides: Partial<CartWheelConfig> = {}) {
  return createKitModel<CartWheelConfig, 'oak' | 'iron', CartWheelParts>({
    id: 'cart-wheel',
    defaults: cartWheelDefaults,
    slots: ['oak', 'iron'],
    build: ({ config, random }) => {
      // Through the shared tinter. The two helpers this replaces copied a
      // palette entry into ONE shared Color and handed it back, so two tints in
      // the same call resolved to the same value -- and the hub was doing
      // exactly that, asking for a body colour and a lighter end colour in one
      // expression and getting the second one twice. The tinter returns a new
      // Color every time, and it floors lightness so a lift cannot take a part
      // through black.
      const tinter = createTinter(random)
      const oak = (lift = 0): Color => tinter('oak', lift)
      const iron = (lift = 0): Color => tinter('iron', lift, 0.6)

      const spokes = Math.max(4, config.spokeCount)
      const tyreThickness = config.radius * config.tyre
      const felloeOuter = config.radius - tyreThickness
      const felloeInner = felloeOuter * 0.82
      // 0.20 of the wheel RADIUS, so the nave is 0.20 of the wheel diameter
      // across. It is the landmark that names the object and at 0.17 it was a
      // flat disc lost in the spoke plane.
      const hubRadius = config.radius * 0.2
      // A nave is bored for the axle, and the bore is the reason it reads as a
      // nave rather than as a knob.
      const boreRadius = hubRadius * 0.3
      const hubLength = config.width * config.hubLength

      // --- nave: a stepped, bored hub standing proud of the spoke plane ---
      //
      // It used to be a turned log: one lathe, symmetric, sitting flush in the
      // plane of the spokes with no hole through it. That is a bobbin, not a
      // nave. A nave projects well forward of the wheel so the linchpin clears
      // the spokes, carries a shorter step behind, and is bored end to end.
      //
      // Built from bands rather than lathes because a band with `inner` set is
      // already a closed tube: outer wall, two end annuli and a bore. Three of
      // them stacked give the steps for nothing.
      const bodyLen = hubLength * 0.45
      const frontLen = hubLength * 0.33
      const rearLen = hubLength * 0.22
      const frontRadius = hubRadius * 0.72
      const rearRadius = hubRadius * 0.78
      // Each step sinks a quarter of its length into the body. Butted end to
      // end their annuli would be coplanar, and two faces in one plane are a
      // flicker whichever way they point.
      const frontY = bodyLen / 2 + frontLen / 2 - frontLen * 0.25
      const rearY = -bodyLen / 2 - rearLen / 2 + rearLen * 0.25
      // The steps are bored slightly wider than the body, which is true of a
      // real nave and, here, keeps their bore walls off the body's own.
      const hubPieces: BufferGeometry[] = [
        bandGeometry(hubRadius, 0, bodyLen, hubRadius - boreRadius, 10, oak(-0.05), { inner: true }),
        bandGeometry(frontRadius, frontY, frontLen, frontRadius - boreRadius * 1.1, 10, oak(-0.01), { inner: true }),
        bandGeometry(rearRadius, rearY, rearLen, rearRadius - boreRadius * 1.06, 10, oak(-0.03), { inner: true }),
        // Two narrow iron rings girdling the steps, the way a nave is hooped to
        // stop the timber splitting along the grain from the bore outward.
        bandGeometry(frontRadius * 1.05, frontY + frontLen * 0.18, frontLen * 0.26, frontRadius * 0.16, 10, iron()),
        bandGeometry(rearRadius * 1.05, rearY - rearLen * 0.16, rearLen * 0.3, rearRadius * 0.16, 10, iron(-0.03)),
      ]
      const hub = mergeColoured(hubPieces)
      // The hub's axis has to be Z: the wheel stands upright.
      hub.rotateX(Math.PI / 2)

      // --- spokes: from hub to felloe, tapering outward ---
      const spokePieces: BufferGeometry[] = []
      // The spoke reaches PAST both ends it joins: it starts inside the hub and
      // finishes inside the felloe. Sizing it to the exact gap left it merely
      // touching, and at the extreme ends of the sliders — small radius, thick
      // tyre — not even that, so the hub and spokes came away from the rim as a
      // separate floating island.
      const spokeInner = hubRadius * 0.45
      const spokeLength = (felloeInner - spokeInner) + config.width * 0.35
      for (let i = 0; i < spokes; i += 1) {
        const angle = (i / spokes) * Math.PI * 2
        const spoke = chamferedBoxGeometry(
          [config.width * 0.42, config.width * 0.5],
          [config.width * 0.3, config.width * 0.38],
          spokeLength,
          config.width * 0.07,
          [0, spokeLength / 2 + spokeInner, 0],
          oak(),
        )
        // A hand-carved spoke is never exactly centred; we add a small offset.
        spoke.rotateZ(angle + jitter(random, 0.012))
        spokePieces.push(spoke)
      }

      // --- felloe: polygonal rim built from straight wooden pieces ---
      const felloePieces: BufferGeometry[] = []
      const segments = spokes
      const step = (Math.PI * 2) / segments
      // Chord length: the distance between two neighbouring corners. A little
      // too long so the pieces BITE into one another, not just meet end to end.
      const chord = 2 * felloeOuter * Math.sin(step / 2) * 1.03
      // The flat outer face sits at the INSCRIBED radius, not at `felloeOuter`.
      //
      // A felloe piece is a straight box, so its outer face is a chord. Put
      // that chord at `felloeOuter` and its two corners are further out than
      // its middle: at ten segments they reached 0.5338 on a wheel whose iron
      // tyre finishes at 0.52, so the corners came through the tyre and the rim
      // rendered as alternating bands of tan wood and dark iron. Pulling the
      // face in by cos(step/2) lands the CORNERS on `felloeOuter`, which is
      // where the tyre's inner face is, so every piece bites into the iron and
      // none of it breaks the outside.
      const felloeFace = felloeOuter * Math.cos(step / 2)
      const midRadius = (felloeFace + felloeInner) / 2
      for (let i = 0; i < segments; i += 1) {
        const angle = (i + 0.5) * step
        // Every piece has its own thickness. That is both correct (hand-cut
        // felloe pieces are never equal) and required: if they were all exactly
        // the same thickness their side faces would be coplanar and would
        // z-fight wherever they overlap.
        const thickness = config.width * (1 + jitter(random, 0.07))
        const piece = chamferedBoxGeometry(
          [chord, thickness],
          [chord, thickness],
          felloeFace - felloeInner,
          config.width * 0.09,
          [0, 0, 0],
          oak(0.03),
        )
        // The piece is built at the origin: X = tangent (chord length), Y =
        // radial thickness, Z = wheel thickness. So for angle=0 it already
        // faces the right way. Moving it out to the radius and taking it into
        // place with a single rotation is enough — an extra rotation in between
        // made some of the pieces parallel and their end faces overlapped.
        piece.translate(0, midRadius, 0)
        piece.rotateZ(angle)
        felloePieces.push(piece)
      }

      // --- iron tyre: single-piece hoop wrapping the felloe ---
      //
      // A real BAND, not a surface. It used to be a lathe sitting at
      // `config.radius` with no inner wall, while the felloe stopped a whole
      // `tyreThickness` further in — so the two never touched. At the default
      // thickness the gap was small enough that nothing noticed; at the top of
      // the slider it was 6 cm and an arc of the tyre came away from the wheel
      // entirely and sat on the ground as its own object.
      //
      // `bandGeometry` spans the radius properly: outer face at `config.radius`,
      // inner face at `config.radius - tyreThickness`, which is exactly where
      // the felloe's outer face is. It also gets `inner: true`, because unlike
      // a barrel hoop this band is not wrapped tight around a body — the felloe
      // is a POLYGON inside a circle, so the gap at the middle of each facet is
      // visible and needs a surface.
      const tyre = bandGeometry(
        config.radius,
        0,
        // NARROWER than the narrowest felloe piece can jitter to.
        //
        // The felloe's axial thickness jitters by ±7%, so anything between
        // 0.93 and 1.07 of the width lands inside that range and will sooner
        // or later share a plane with some piece; a tyre at exactly the
        // felloe's width flickered against whichever piece came out near
        // zero jitter. The first answer was to go wider than the whole range,
        // at 1.1 -- which stopped the flicker and made the wheel look shod in
        // a pneumatic tyre, a black band standing proud of its own rim.
        //
        // Going under the range instead solves it the same way and is the
        // truer shape: the hoop is set into the tread, and on a worn wheel a
        // sliver of felloe shows at each edge where the iron has bedded in.
        config.width * 0.9,
        tyreThickness * 1.06,
        segments * 2,
        iron(),
        { inner: true },
      )
      // A single closed band now, so the separate inner shell that used to
      // sit against the felloe is gone: the band's own inner face is already
      // inside `felloeOuter`.
      const tyreRings = mergeColoured([tyre])
      tyreRings.rotateX(Math.PI / 2)

      return {
        hub: { slot: 'oak', geometry: hub },
        spokes: { slot: 'oak', geometry: mergeColoured(spokePieces) },
        felloe: { slot: 'oak', geometry: mergeColoured(felloePieces) },
        tyre: { slot: 'iron', geometry: tyreRings },
      }
    },
  }, overrides)
}
