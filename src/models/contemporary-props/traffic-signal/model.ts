/**
 * @contemporary-props/traffic-signal
 *
 * The hundredth row and the last of the street. Hooded visors on stacked
 * aspects with a mast arm, and the catalogue calls it the emissive slot's most
 * demanding user, which is the whole reason it is last: every other object in
 * the kit either has no light in it or has one.
 *
 * This one has three, only one may be on at a time, and they are three
 * DIFFERENT colours. The street lamp settled the first half of that rule at row
 * eighty-five -- a lit thing swaps its slot rather than dimming its colour,
 * because an unlit lens is glass and a lit one is a light source, and those are
 * two materials rather than two values of one. What it did not have to answer
 * is what happens when the emitter has a colour parameter. The catalogue said
 * it would: the emissive row names "traffic signal aspect" as the case that
 * needs it.
 *
 * The answer is that each aspect carries its own emissive lens as its own part,
 * all three are built, and the action shows one and hides the other two. A dark
 * lens sits behind each of them in the head casing, so hiding a lit lens does
 * not leave a hole -- it reveals the unlit lens that was always there, which is
 * what an unlit aspect actually is.
 *
 * Measured off the reference in lens diameters, which is how a signal is
 * dimensioned in the trade:
 *
 *   1.00  the lens
 *   1.26  the casing across the front
 *   1.16  the visor across, INSIDE the casing, which is what leaves the door
 *         panel's edge visible round it
 *   1.63  the pitch from one aspect to the next
 *   4.89  the casing top to bottom, three pitches exactly
 *   0.90  how far the visor stands off the casing face at its deepest
 *
 * Two tones, and they are not decoration. The head is a dark casting and the
 * pole and arm are bright galvanised steel. Built in one colour the object is a
 * dark stick with dark blobs on it; the contrast is what separates the thing
 * that signals from the thing that holds it up.
 */
import { BufferGeometry, Color, Float32BufferAttribute, type Object3D } from 'three'

import {
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  tubeGeometry,
  type RuntimeContext,
  type Vec3,
} from '../core/index.ts'

export interface TrafficSignalConfig {
  /** Height of the pole to the mast arm (metres). */
  readonly height: number
  /** How far the arm reaches out from the pole (metres). */
  readonly reach: number
  /** Lens diameter, which every other dimension is derived from (metres). */
  readonly lens: number
  /** Which aspect is lit: 0 red, 1 amber, 2 green, 3 all dark. */
  readonly aspect: number
  /** How far the head is swung about its drop pin, 1 is a quarter turn. */
  readonly swing: number
  readonly seed: number
}

export const trafficSignalDefaults: TrafficSignalConfig = {
  height: 3.4,
  reach: 0.9,
  lens: 0.2,
  aspect: 0,
  swing: 0,
  seed: 61,
}

export type TrafficSignalParts = 'pole' | 'head' | 'dark' | 'red' | 'amber' | 'green'

export interface TrafficSignalActions {
  /** Lights one aspect: 0 red, 1 amber, 2 green, 3 all dark. No argument steps on. */
  cycle(to?: number): void
  /** Swings the head about its drop pin. 1 is a quarter turn. */
  swing(amount?: number): void
}

/** The three lamp parts, in the order the aspect index counts them. */
const LAMPS = ['red', 'amber', 'green'] as const

function applyAspect(
  runtime: RuntimeContext<TrafficSignalConfig, TrafficSignalParts>,
  lit: number,
): void {
  // Visibility rather than a rebuild. All three lenses exist in the geometry
  // and always have; which one you can see is the only thing that changes, and
  // that is a property of an Object3D rather than of a mesh.
  for (let i = 0; i < LAMPS.length; i += 1) {
    (runtime.parts[LAMPS[i]!].anchor as Object3D).visible = i === lit
  }
}

function applySwing(
  runtime: RuntimeContext<TrafficSignalConfig, TrafficSignalParts>,
  amount: number,
): void {
  // Four anchors, one angle. The head and its three lenses share the drop pin
  // as their origin, so the same rotation applied to each of them turns the
  // whole assembly rigidly -- the fire hydrant's rule at row sixty-two, that a
  // single anchor has a single axis, read the other way round: parts that must
  // move together must each be told to.
  const yaw = Math.min(1, Math.max(-1, amount)) * (Math.PI / 2)
  runtime.parts.head.anchor.rotation.y = yaw
  runtime.parts.dark.anchor.rotation.y = yaw
  for (const lamp of LAMPS) runtime.parts[lamp].anchor.rotation.y = yaw
}

export function createModel(overrides: Partial<TrafficSignalConfig> = {}) {
  let heldAspect = 0
  let seenAspect = Number.NaN
  let heldSwing = 0
  let seenSwing = Number.NaN

  return createKitModel<
    TrafficSignalConfig,
    'aluminium' | 'steelPainted' | 'glassTinted' | 'emissive',
    TrafficSignalParts, TrafficSignalActions
  >({
    id: 'traffic-signal',
    defaults: trafficSignalDefaults,
    slots: ['aluminium', 'steelPainted', 'glassTinted', 'emissive'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(6, Math.max(2, config.height))
      const reach = Math.min(3, Math.max(0, config.reach))
      const lens = Math.min(0.4, Math.max(0.08, config.lens))
      const LR = lens / 2

      // Small lifts: painted steel measures 0.202 in linear lightness and
      // anything past -0.19 clamps to black rather than reading as dark.
      const galv = tint('aluminium', 0.03 + jitter(random, 0.015))
      const galvDark = tint('aluminium', -0.08, 0.5)
      const case_ = tint('steelPainted', -0.13, 0.4)
      const hoodC = tint('steelPainted', -0.16, 0.35)

      /**
       * The lit colours, stated as hex rather than derived from the palette.
       *
       * The emissive slot's palette entry is a warm white, which is right for a
       * lamp and useless here: a signal's whole content is which of three
       * colours is showing. They go through `Color` from a hex the same way the
       * palette's own entries do, so they land in the same working space, and
       * they take the seeded jitter in LIGHTNESS only -- a signal that varies in
       * hue from one instance to the next is a signal nobody can read.
       */
      const glow = (hex: number): Color =>
        new Color(hex).offsetHSL(0, 0, jitter(random, 0.03))
      const ASPECTS = [0xd8231c, 0xf5a800, 0x00b061]
      const LIT = ASPECTS.map(glow)
      /*
       * And the UNLIT lenses keep their own colours too, darkened.
       *
       * An unlit aspect was one dark slate disc three times over, which is not
       * what a signal off looks like: the lens is coloured glass whether or not
       * there is a lamp behind it, and you can read a dead signal's three
       * aspects from across a junction in daylight. Built grey, a signal showing
       * red has two black holes under it and reads as broken.
       *
       * The lift is small because these are LINEAR values. Green is the darkest
       * of the three at 0.21 before any lift, and past about -0.15 it stops
       * being green and becomes black, which is the same clamp the utility
       * cabinet found.
       */
      const DEAD = ASPECTS.map((hex) => new Color(hex).offsetHSL(0, -0.34, -0.09))

      const poleR = lens * 0.225
      const armY = H - lens * 0.15
      // 0.25 of the lens, off the reference. The arm is a chunky tube and at
      // 0.19 it reads as conduit rather than as the thing carrying the head.
      const armR = lens * 0.25
      const pinY = armY - lens * 0.24
      const capY = pinY - lens * 0.1

      /* --------------------------------------------------------------- pole */
      const polePieces: BufferGeometry[] = [latheGeometry([
        { y: 0, radius: poleR * 1.7 },
        { y: lens * 0.03, radius: poleR * 1.7 },
        { y: lens * 0.05, radius: poleR * 1.5 },
        // The root cover, which is the collar every planted pole has round its
        // foot to hide the holding-down bolts. Without it a pole meets the
        // pavement as a cut tube and reads as scaffold.
        { y: lens * 0.5, radius: poleR * 1.22 },
        { y: lens * 0.56, radius: poleR },
        { y: armY + armR * 1.5, radius: poleR },
        { y: armY + armR * 1.9, radius: poleR * 0.86 },
      ], 18, [0, 0, 0], galv, { capBottom: true, capTop: true })]

      /*
       * The arm, and it is STRAIGHT.
       *
       * The street lamp's neck is a swept tube because a lamp standard's bend is
       * its whole silhouette. An outreach arm is not that: it is a length of
       * tube clamped to a pole, and the reference is unambiguous about it. Bent,
       * this stops being a signal and becomes a short lamp post.
       */
      if (reach > armR) {
        // The tube runs PAST the clamp rather than ending in it, which the
        // reference shows and which is what a cut end and a fitting look like
        // when they are two different things.
        const end = reach + armR * 1.4
        const path: Vec3[] = [[0, armY, 0], [end * 0.5, armY, 0], [end, armY, 0]]
        polePieces.push(tubeGeometry(path, armR, 12, galv, { capStart: false, capEnd: true }))
      }

      /*
       * The saddle clamp: ONE collar with a bolt through each side.
       *
       * Written as two collars five millimetres apart -- meaning to read as the
       * pair of halves a saddle actually comes in -- each is fifty-five
       * millimetres tall, so they occupy the same space at the same radius and
       * put fourteen pairs of faces on fourteen shared planes. A saddle clamp is
       * one casting pulled together by bolts, and the bolts are what say so.
       */
      polePieces.push(latheGeometry([
        { y: armY - armR * 0.62, radius: poleR * 1.28 },
        { y: armY - armR * 0.5, radius: poleR * 1.36 },
        { y: armY + armR * 0.5, radius: poleR * 1.36 },
        { y: armY + armR * 0.62, radius: poleR * 1.28 },
      ], 14, [0, 0, 0], galvDark, { capBottom: true, capTop: true }))
      for (const z of [-1, 1]) {
        polePieces.push(latheGeometry([
          { y: 0, radius: armR * 0.2 },
          { y: armR * 0.5, radius: armR * 0.2 },
          { y: armR * 0.66, radius: armR * 0.3 },
        ], 6, [0, armY - armR * 0.3, z * poleR * 1.28], galvDark,
        { capBottom: false, capTop: true }))
      }
      /*
       * The saddle at the arm's end, and it is ONE broad casting with the head's
       * drop collar straight under it.
       *
       * Built as a small block with a separate thin pin below, the head reads as
       * hanging off a bolt. The reference's clamp is wider than the tube it
       * grips and the collar is nearly as fat, and that mass is the difference
       * between a signal bolted to a mast and a lantern on a hook.
       */
      /*
       * TWO plates with a gap, and the bolts run right through both.
       *
       * One block reads as a connector, which the critic called it three rounds
       * running: a clamp is two halves pulled together, and the gap and the
       * bolt shanks crossing it are the whole of what says so. The plates are
       * deliberately different sizes -- an earlier pair of identical collars
       * put fourteen faces on fourteen shared planes -- and the bolts stand
       * proud top and bottom rather than being buried inside the casting, which
       * is where they were and why nothing could see them.
       */
      polePieces.push(chamferedBoxGeometry(
        [armR * 4.6, armR * 2.7], [armR * 4.3, armR * 2.5],
        armR * 1.5, armR * 0.22, [reach, armY + armR * 0.85, 0], galvDark,
      ))
      polePieces.push(chamferedBoxGeometry(
        [armR * 4.2, armR * 2.4], [armR * 4.4, armR * 2.6],
        armR * 1.5, armR * 0.22, [reach, armY - armR * 0.85, 0], galvDark,
      ))
      for (const dx of [-armR * 1.75, armR * 1.75]) {
        for (const dz of [-1, 1]) {
          polePieces.push(latheGeometry([
            { y: armY - armR * 2.1, radius: armR * 0.26 },
            { y: armY - armR * 1.95, radius: armR * 0.16 },
            { y: armY + armR * 1.95, radius: armR * 0.16 },
            { y: armY + armR * 2.1, radius: armR * 0.26 },
          ], 6, [reach + dx, 0, dz * armR * 1.45], galvDark,
          { capBottom: true, capTop: true }))
        }
      }
      /*
       * The cable loop from the clamp into the back of the head.
       *
       * It belongs to the pole rather than to the head, so a swung head leaves
       * it behind. That is wrong and it is the right trade: the cable is
       * flexible and modelling it as flexible means rebuilding it on every
       * frame of the swing, while leaving it out costs the object the one detail
       * that says the head is wired to something.
       */
      if (reach > armR) {
        const loop: Vec3[] = [
          [reach - armR * 1.2, armY - armR * 0.9, 0],
          [reach - armR * 2.0, armY - armR * 2.2, -lens * 0.3],
          [reach - armR * 1.5, armY - armR * 3.6, -lens * 0.72],
          [reach - armR * 0.2, armY - armR * 4.4, -lens * 0.6],
        ]
        polePieces.push(tubeGeometry(loop, armR * 0.2, 8, galvDark,
          { capStart: false, capEnd: false }))
      }
      polePieces.push(latheGeometry([
        { y: pinY - lens * 0.01, radius: armR * 0.78 },
        { y: pinY + lens * 0.03, radius: armR * 0.86 },
        { y: armY - armR * 0.4, radius: armR * 0.86 },
      ], 12, [reach, 0, 0], galvDark, { capBottom: true, capTop: false }))

      /* --------------------------------------------------------------- head */
      // 1.26 of the lens across the face, off the reference, where the lens is
      // 0.81 of the housing width. At 1.28 the lens reads as a small disc on a
      // big box, which is the first thing that stops it being a signal.
      const W = lens * 1.26
      const Dp = lens * 1.1
      const P = lens * 1.63
      const Hc = P * 3
      const cx = reach
      const casingTop = capY - lens * 0.04
      const aspectY = [0, 1, 2].map((i) => casingTop - P * (i + 0.5))

      const headPieces: BufferGeometry[] = []

      /*
       * ONE casing, with three doors on the front of it.
       *
       * Built the other way -- three full-depth boxes stacked with gaps and a
       * narrower spine showing through -- it reads as three separate castings
       * hung in a row, which is what the first pass was and what the critic
       * called it. A signal head is a single body: the joints you can see are
       * the edges of three doors seated against one continuous rear housing, and
       * that is a difference of a few millimetres of depth and the whole read.
       */
      // The corner radius is generous, because the housing is a CASTING. A
      // signal head has no sharp arris anywhere on it -- it is a sand-cast box
      // with a draft angle and a radius on every edge, and chamfered at a
      // twenty-fifth of its width it reads as folded sheet.
      headPieces.push(chamferedBoxGeometry(
        [W, Dp], [W, Dp], Hc, W * 0.11, [cx, casingTop - Hc / 2, 0], case_,
      ))
      const doorT = Dp * 0.13
      for (const y of aspectY) {
        // Seated INTO the housing, not against it: a door whose back face sits
        // exactly on the housing's front face is two faces on one plane. It
        // stands a good centimetre proud of it in front, which is the shadow
        // line that makes three doors out of one flat face.
        headPieces.push(chamferedBoxGeometry(
          [W * 0.96, doorT], [W * 0.93, doorT],
          P * 0.94, W * 0.09, [cx, y, Dp / 2 + doorT * 0.5 - Dp * 0.02], case_,
        ))
      }
      // The cap, and the boss on the underside. A signal casing is a stack of
      // castings with a lid bolted on and a drain fitting under it; cut flat at
      // both ends it reads as a length of extrusion.
      headPieces.push(chamferedBoxGeometry(
        [W * 1.03, Dp * 1.03], [W * 0.82, Dp * 0.82],
        lens * 0.09, W * 0.05, [cx, casingTop + lens * 0.035, 0], case_,
      ))
      headPieces.push(latheGeometry([
        { y: casingTop - Hc - lens * 0.09, radius: lens * 0.13 },
        { y: casingTop - Hc - lens * 0.05, radius: lens * 0.18 },
        { y: casingTop - Hc + lens * 0.01, radius: lens * 0.2 },
      ], 12, [cx, 0, 0], case_, { capBottom: true, capTop: false }))
      // The spigot into the drop pin, which is the only thing holding the head
      // on and has to be visible or the head floats under the arm.
      headPieces.push(latheGeometry([
        { y: casingTop + lens * 0.08, radius: armR * 0.9 },
        { y: pinY, radius: armR * 0.78 },
      ], 12, [cx, 0, 0], case_, { capBottom: false, capTop: true }))

      // The door hinges down the back corner, three of them, which are the only
      // asymmetry on the casing and the one detail saying that it opens.
      for (const y of aspectY) {
        headPieces.push(chamferedBoxGeometry(
          [W * 0.1, Dp * 0.18], [W * 0.08, Dp * 0.14],
          P * 0.22, W * 0.02, [cx + W * 0.5, y, -Dp * 0.3], hoodC,
        ))
      }

      /**
       * The VISOR, which is the object's signature and the one piece of
       * geometry written by hand in this kit.
       *
       * It is a tube about the aspect's own axis whose length varies round the
       * ring: full at the top, cut back to a lip at the bottom, so it shades the
       * lens from a sun that is always above it and never blocks the view from
       * below. No helper in core makes that, and it does not get one: the kit's
       * rule is that a helper must name the rows in OTHER domains that will
       * reuse it, and a slant-cut revolve has no second customer -- the
       * extractor hood is a loft, the litter bin's hood is a dish and a lamp
       * shade is a plain lathe. So it lives here, where it is used.
       */
      const visor = (centreY: number, colour: Color, segments = 22): BufferGeometry => {
        const pos: number[] = []
        const col: number[] = []
        /*
         * The hood is NARROWER than the housing, and this took measuring twice.
         *
         * Its silhouette on the reference reaches well left of the housing,
         * which reads as a hood wider than the box -- but that is projection:
         * the hood stands 0.9 of a lens toward the camera and the housing face
         * is turned 25 degrees away, so the overhang in the picture is mostly
         * depth. Read instead where the hood's ring MEETS the housing, on the
         * far side, and it lands at the same x as the lens edge: about 1.15
         * lens across, inside a 1.23 lens housing.
         *
         * That margin is not spare space. It is what leaves the door panel's
         * edge showing round the hood, which is the outline that makes each
         * aspect a separate thing.
         */
        const ri = LR * 1.06
        const ro = LR * 1.16
        const back = Dp / 2 - lens * 0.09
        // Stated as a lip and a tip rather than as a fraction of one length: the
        // lip has to clear the door in front of it and the tip has to reach the
        // reference's 0.78 lens, and deriving both from one projection put the
        // lip half a millimetre off the casing.
        const lipZ = Dp / 2 + doorT * 0.5 + lens * 0.05
        const tipZ = Dp / 2 + lens * 0.9
        const push = (p: Vec3): void => {
          pos.push(p[0], p[1], p[2])
          col.push(colour.r, colour.g, colour.b)
        }
        const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): void => {
          push(a); push(b); push(c); push(a); push(c); push(d)
        }
        /**
         * How far forward the tube reaches at `t` round the ring, 0 at the top.
         *
         * The floor is 0.18 and not the 0.07 it started at, because 0.07 puts
         * the bottom lip half a millimetre in FRONT of the casing spine behind
         * it. Two surfaces that close are one surface as far as the renderer is
         * concerned, and the kit's rule is a millimetre. It is also just wrong:
         * a hood's lip stands off the casing on every signal there is, and at
         * 0.18 it clears the module face by ten millimetres.
         */
        // The exponent, not a plain cosine. A plane cut through the tube gives a
        // rim that falls away as soon as it leaves the top; the reference's hood
        // holds nearly its full length round most of the ring and then sweeps
        // back hard in the last quarter, and that late sweep is what makes it
        // read as a hood rather than as a mitre.
        const len = (t: number): number =>
          lipZ + (tipZ - lipZ) * (0.5 + 0.5 * Math.cos(t * Math.PI * 2)) ** 0.62
        const at = (t: number, radius: number, z: number): Vec3 => {
          const a = t * Math.PI * 2
          return [cx + Math.sin(a) * radius, centreY + Math.cos(a) * radius, z]
        }
        for (let i = 0; i < segments; i += 1) {
          const t0 = i / segments
          const t1 = (i + 1) / segments
          const z0 = len(t0)
          const z1 = len(t1)
          // Outer wall, then the inner wall wound the other way, then the rim
          // between them and the annulus closing the back. Each winding was
          // checked by taking the cross product at the TOP of the ring: the
          // outer must come out +Y there and the inner -Y, and getting one of
          // them backwards turns a hood into a hole.
          quad(at(t0, ro, back), at(t0, ro, z0), at(t1, ro, z1), at(t1, ro, back))
          quad(at(t0, ri, back), at(t1, ri, back), at(t1, ri, z1), at(t0, ri, z0))
          quad(at(t0, ri, z0), at(t1, ri, z1), at(t1, ro, z1), at(t0, ro, z0))
          quad(at(t0, ri, back), at(t0, ro, back), at(t1, ro, back), at(t1, ri, back))
        }
        const geo = new BufferGeometry()
        geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
        geo.setAttribute('color', new Float32BufferAttribute(col, 3))
        geo.computeVertexNormals()
        return geo
      }

      /**
       * A lens, built about Y and then turned to face +Z.
       *
       * `latheGeometry` revolves about Y and nothing in the kit revolves about
       * anything else, which is right: an axis argument would be a parameter
       * every caller passes the same value for. Turning the result afterwards is
       * one line, and it is the line that says which way the object looks.
       */
      const lensAt = (centreY: number, scale: number, forward: number, colour: Color) =>
        latheGeometry([
          { y: 0, radius: LR * 1.02 * scale },
          { y: LR * 0.1, radius: LR * 1.02 * scale },
          { y: LR * 0.15, radius: LR * 0.98 * scale },
          /*
           * Three concentric STEPS, because a signal lens is a Fresnel.
           *
           * The rings are the only pattern anywhere on this object, and without
           * them each aspect is a smooth coloured disc -- which is what a
           * plastic toy has. They are cut as a staircase and not as an
           * undercut: a profile that goes back DOWN in y reverses the winding
           * on the descending run, and the kit has paid for that once already
           * on a basin. Each riser therefore rises by a thousandth of the lens,
           * which is enough for the winding and invisible in the silhouette.
           */
          { y: LR * 0.26, radius: LR * 0.94 * scale },
          { y: LR * 0.262, radius: LR * 0.82 * scale },
          { y: LR * 0.36, radius: LR * 0.78 * scale },
          { y: LR * 0.362, radius: LR * 0.6 * scale },
          { y: LR * 0.44, radius: LR * 0.55 * scale },
          { y: LR * 0.442, radius: LR * 0.32 * scale },
          { y: LR * 0.5, radius: LR * 0.22 * scale },
        ], 22, [0, 0, 0], colour, { capBottom: false, capTop: true })
          .rotateX(Math.PI / 2)
          .translate(cx, centreY, Dp / 2 - lens * 0.06 + forward)

      const darkPieces: BufferGeometry[] = []
      const lampPieces: BufferGeometry[][] = [[], [], []]
      for (let i = 0; i < 3; i += 1) {
        const y = aspectY[i]!
        headPieces.push(visor(y, hoodC))
        /*
         * The DEAD lenses, which are their own part on the glass slot and are
         * always shown.
         *
         * They could have gone in the casing -- they never move relative to it
         * and they are dark either way. But an unlit aspect is a piece of glass,
         * and glass has its own roughness and its own transparency; put on the
         * casing's painted-steel material it is a black disc that happens to be
         * round. The slot is the difference between an aspect that is off and a
         * hole that was never a lamp.
         */
        darkPieces.push(lensAt(y, 1, 0, DEAD[i]!))
        // And the lit one, 3 mm in front of it and a hair wider, so that when it
        // is shown it covers the dead lens from every angle the hood lets you
        // look in from. Any closer and the two fight; any wider and its rim
        // touches the hood's inner wall.
        lampPieces[i]!.push(lensAt(y, 1.02, 0.003, LIT[i]!))
      }

      bakeOcclusion(polePieces, { strength: 0.3 })
      bakeOcclusion(headPieces, { strength: 0.4 })

      // The pin, which four parts share as their origin so that one angle swings
      // all of them together.
      const pin = [cx, pinY, 0] as const
      const hung = (pieces: readonly BufferGeometry[]) =>
        smoothNormals(mergeColoured(pieces).translate(-pin[0], -pin[1], -pin[2]), 34)

      return {
        pole: {
          slot: 'aluminium' as const,
          geometry: smoothNormals(mergeColoured(polePieces), 34),
        },
        head: { slot: 'steelPainted' as const, geometry: hung(headPieces), origin: pin },
        dark: { slot: 'glassTinted' as const, geometry: hung(darkPieces), origin: pin },
        // The lit lenses skip the occlusion bake, because a light shaded by the
        // hood it sits in is not a light.
        red: { slot: 'emissive' as const, geometry: hung(lampPieces[0]!), origin: pin },
        amber: { slot: 'emissive' as const, geometry: hung(lampPieces[1]!), origin: pin },
        green: { slot: 'emissive' as const, geometry: hung(lampPieces[2]!), origin: pin },
      }
    },

    actions: (runtime) => {
      heldAspect = Math.round(runtime.getConfig().aspect)
      seenAspect = heldAspect
      heldSwing = runtime.getConfig().swing
      seenSwing = heldSwing
      applyAspect(runtime, heldAspect)
      applySwing(runtime, heldSwing)
      return {
        cycle: (to?: number) => {
          heldAspect = to === undefined ? (heldAspect + 1) % 4 : Math.round(to)
          applyAspect(runtime, heldAspect)
        },
        swing: (amount = 1) => { heldSwing = amount; applySwing(runtime, amount) },
      }
    },

    update: (_dt, runtime) => {
      const c = runtime.getConfig()
      if (c.aspect !== seenAspect) { seenAspect = c.aspect; heldAspect = Math.round(c.aspect) }
      if (c.swing !== seenSwing) { seenSwing = c.swing; heldSwing = c.swing }
      applyAspect(runtime, heldAspect)
      applySwing(runtime, heldSwing)
    },
  }, overrides)
}
