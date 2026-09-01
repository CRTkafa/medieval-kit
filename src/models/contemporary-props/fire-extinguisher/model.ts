/**
 * @contemporary-props/fire-extinguisher
 *
 * The first small-part cluster in the kit, and the first squeeze lever, which
 * is what the catalogue puts it ninth for. The bottle underneath is the same
 * revolve the gas cylinder already settled; everything new is in the head.
 *
 * A cluster is not a list of small pieces, it is small pieces that are only
 * legible TOGETHER. The valve block on its own is a lump of chrome. With a
 * gauge on its face, a pin through it, a ring on the pin and a lever over the
 * top it becomes a thing that is obviously operated, and every one of those
 * parts is under a centimetre. So the rule the cluster is built to is that no
 * piece may be smaller than it can be seen at: the gauge is 0.27 of the
 * bottle's radius, which is large for a gauge and is the size at which a
 * viewer reads "dial" rather than "grey dot".
 *
 * Measured off the reference. 4.0 diameters tall, and:
 *
 *   0.000  the foot, a rolled band
 *   0.054  the shell
 *   0.724  the shoulder
 *   0.796  the valve, and the cluster on it
 *   0.905  the lever
 *   0.294  the hose band, which is what stops the hose being a loose noodle
 *
 * The lever is its own part with its origin AT THE PIVOT, so squeezing it is
 * `lever.anchor.rotation.z` and nothing else. Its travel stops against the
 * carry handle rather than at an arbitrary angle, because that is what it
 * stops against on the real thing and it is the difference between an action
 * and a slider.
 */
import { type BufferGeometry, type Color } from 'three'

import {
  arcBarGeometry,
  bakeOcclusion,
  chamferedBoxGeometry,
  createKitModel,
  createTinter,
  jitter,
  latheGeometry,
  mergeColoured,
  smoothNormals,
  type Level,
} from '../core/index.ts'

export interface FireExtinguisherConfig {
  /** Overall height to the top of the lever (metres). */
  readonly height: number
  /** Radius of the shell (metres). */
  readonly radius: number
  /** How far the lever is squeezed, 0 released to 1 against the handle. */
  readonly squeeze: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const fireExtinguisherDefaults: FireExtinguisherConfig = {
  height: 0.42,
  // 4.0 diameters tall, off the reference. This is the household size; the
  // slider reaches the tall industrial one without changing the head, which is
  // correct, because the head is the same casting on both.
  radius: 0.052,
  squeeze: 0,
  segments: 30,
  seed: 29,
}

export type FireExtinguisherParts = 'body' | 'valve' | 'handle' | 'lever' | 'hose'

export interface FireExtinguisherActions {
  /** Squeezes the lever. 0 released, 1 hard against the handle. */
  squeeze(amount?: number): void
}

export function createModel(overrides: Partial<FireExtinguisherConfig> = {}) {
  return createKitModel<
    FireExtinguisherConfig,
    'retroreflective' | 'chrome' | 'steelPainted' | 'rubber' | 'brass',
    FireExtinguisherParts, FireExtinguisherActions
  >({
    id: 'fire-extinguisher',
    defaults: fireExtinguisherDefaults,
    slots: ['retroreflective', 'chrome', 'steelPainted', 'rubber', 'brass'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.1, Math.max(0.25, config.height))
      const R = Math.min(H * 0.16, Math.max(H * 0.085, Math.min(0.12, Math.max(0.03, config.radius))))
      const segments = Math.max(12, Math.round(config.segments))

      // Where the hose hangs, round from the gauge. Named because the band's
      // clamp has to be put at the same angle and the two must not drift.
      const HOSE_YAW = 0.75

      const footTop = H * 0.054
      const shellTop = H * 0.724
      const neckY = H * 0.796
      const neckR = R * 0.36
      const valveTop = H * 0.905

      /* -------------------------------------------------------------- shell */
      const red = tint('retroreflective', -0.06, 0.85)
      const shell: Level[] = [
        { y: 0, radius: R * 0.97 },
        { y: H * 0.006, radius: R * 1.04 },
        { y: footTop, radius: R * 1.04 },
        { y: footTop + H * 0.008, radius: R },
        // Two rolled ribs just above the foot. They are 4 mm of relief on a
        // 420 mm bottle and they are the only thing that says the shell was
        // pressed from sheet and seamed rather than turned from a billet; the
        // reference has both and the first cut of this had neither.
        { y: H * 0.086, radius: R },
        { y: H * 0.094, radius: R * 1.028 },
        { y: H * 0.104, radius: R * 1.028 },
        { y: H * 0.112, radius: R },
        { y: H * 0.132, radius: R },
        { y: H * 0.14, radius: R * 1.028 },
        { y: H * 0.15, radius: R * 1.028 },
        { y: H * 0.158, radius: R },
        { y: shellTop, radius: R },
        { y: shellTop + (neckY - shellTop) * 0.4, radius: R * 0.93 },
        { y: shellTop + (neckY - shellTop) * 0.72, radius: R * 0.74 },
        { y: neckY, radius: neckR * 1.15 },
        { y: neckY + H * 0.006, radius: neckR },
      ]
      const bodyPieces: BufferGeometry[] = [
        latheGeometry(shell, segments, [0, 0, 0], red, {
          colourTop: tint('retroreflective', 0.04, 0.85),
          capBottom: true,
          capTop: true,
        }),
      ]

      const black = tint('rubber', jitter(random, 0.02))
      // The band that holds the hose to the bottle. It is the only reason the
      // hose reads as belonging to the extinguisher rather than lying against
      // it, and it costs one ring.
      bodyPieces.push(latheGeometry([
        { y: H * 0.294, radius: R * 1.02 },
        { y: H * 0.328, radius: R * 1.02 },
      ], segments, [0, 0, 0], black, { capBottom: false, capTop: false }))

      // Declared up here because the carry handle is sized to it: the jaw and
      // the lever are the same casting length on the real thing.
      const leverLen = R * 1.75

      /**
       * The two members, and they are ONE SHAPE built twice.
       *
       * The first cut of this made the handle a straight chrome bar and the
       * lever a straight black one, and it read as a hammer resting on a pipe.
       * The reference has two black members that taper almost to a point, rise
       * away from the valve and hook back toward each other at the tips. That
       * silhouette is the whole reason the head reads as something you grip
       * rather than a lump with a stick on it, and it costs three segments
       * each.
       *
       * Knots are [x, y, half-width] in shell radii, so the pair can be read
       * against each other: what matters is the GAP down the middle, because
       * that is what the squeeze closes.
       */
      const member = (
        knots: readonly (readonly [number, number, number])[],
        colour: Color,
      ): BufferGeometry[] => knots.slice(0, -1).map((knot, i) => {
        const [x0, y0, w0] = knot
        const [x1, y1, w1] = knots[i + 1]!
        const dx = (x1 - x0) * R
        const dy = (y1 - y0) * R
        const bar = chamferedBoxGeometry(
          [w0 * 2 * R, w0 * 1.2 * R], [w1 * 2 * R, w1 * 1.2 * R],
          Math.hypot(dx, dy), Math.min(w0, w1) * R * 0.45, [0, 0, 0], colour,
        )
        // Built up +Y about its own centre, so it swings onto the segment's
        // direction and then moves to the segment's midpoint.
        bar.rotateZ(Math.atan2(dy, dx) - Math.PI / 2)
        bar.translate((x0 + x1) * 0.5 * R, (y0 + y1) * 0.5 * R, 0)
        return bar
      })

      /*
       * Painted steel, taken most of the way to black.
       *
       * The palette's `steelPainted` is a mid grey because that is what most
       * painted steel in the kit is. These two members are the exception: on
       * every extinguisher they are black, and at grey they merged with the
       * chrome casting behind them and the whole head read as one lump. The
       * slot stays `steelPainted`, so a consumer who repaints painted steel
       * still gets these; only the tint knows they are the black ones.
       */
      const blackSteel = tint('steelPainted', -0.3, 0.5)

      /* -------------------------------------------------------------- valve */
      const steel = tint('chrome', jitter(random, 0.02), 0.5)

      /**
       * The casting, and it is deliberately STEPPED.
       *
       * The first cut was one straight barrel with a taper at each end, and it
       * read as a single pale lump half a bottle wide. The reference divides
       * the same zone into four things you can name: the red shell collar, the
       * chrome skirt swaged onto it, the hex the spanner goes on, and the
       * bonnet the lever pivots in. None of them costs more than two levels of
       * the same lathe, and the difference is whether the head is a component
       * or a blob.
       */
      const hexY = neckY + H * 0.03
      const valvePieces: BufferGeometry[] = [
        latheGeometry([
          { y: neckY, radius: neckR * 1.18 },
          { y: neckY + H * 0.01, radius: neckR * 1.22 },
          { y: neckY + H * 0.018, radius: neckR * 1.0 },
          { y: hexY, radius: neckR * 0.98 },
          { y: hexY + H * 0.024, radius: neckR * 0.98 },
          { y: hexY + H * 0.03, radius: neckR * 0.82 },
          { y: valveTop - H * 0.014, radius: neckR * 0.82 },
          { y: valveTop - H * 0.008, radius: neckR * 0.94 },
          { y: valveTop, radius: neckR * 0.9 },
        ], Math.max(10, Math.round(segments * 0.6)), [0, 0, 0], steel,
        { colourTop: tint('chrome', 0.05, 0.5), capBottom: true, capTop: true }),
      ]

      // The hex the spanner goes on: six flats, so the eye gets one corner in
      // silhouette and knows the casting is machined rather than moulded.
      valvePieces.push(latheGeometry([
        { y: hexY + H * 0.002, radius: neckR * 1.16 },
        { y: hexY + H * 0.022, radius: neckR * 1.16 },
      ], 6, [0, 0, 0], tint('chrome', -0.03, 0.5), { capBottom: true, capTop: true }))

      // The shell's own collar under it, in the shell's red, which is what
      // separates the chrome from the bottle instead of letting them run
      // together into one pale-topped shape.
      valvePieces.push(latheGeometry([
        { y: neckY - H * 0.016, radius: neckR * 1.3 },
        { y: neckY - H * 0.004, radius: neckR * 1.34 },
        { y: neckY + H * 0.004, radius: neckR * 1.28 },
      ], Math.max(10, Math.round(segments * 0.6)), [0, 0, 0],
      tint('retroreflective', -0.1, 0.6), { capBottom: false, capTop: false }))

      /**
       * The gauge, and it is deliberately oversized.
       *
       * A pressure gauge on a 2 kg extinguisher is about 35 mm across on a
       * 105 mm bottle, and at prop scale that is a grey dot. Drawn at 0.27 of
       * the shell radius it is the size at which the eye takes it as a dial,
       * which is the only thing it is there to say. The face is a separate
       * disc a hair proud of the bezel so it catches its own light.
       */
      const gaugeR = R * 0.27
      const gaugeY = neckY + (valveTop - neckY) * 0.45
      const gauge = latheGeometry([
        { y: 0, radius: gaugeR * 0.72 },
        { y: gaugeR * 0.42, radius: gaugeR },
        { y: gaugeR * 0.72, radius: gaugeR },
        { y: gaugeR * 0.8, radius: gaugeR * 0.88 },
      ], Math.max(10, Math.round(segments * 0.5)), [0, 0, 0], steel,
      { capBottom: false, capTop: true })
      gauge.rotateX(Math.PI / 2)
      gauge.translate(0, gaugeY, neckR * 0.8)
      valvePieces.push(gauge)

      /**
       * And what is ON the face, which is the difference between a dial and a
       * disc.
       *
       * A blank disc at this size reads as a bolt head. Three marks fix it and
       * none of them is a material: a pale face, one coloured sector, one
       * needle. They are printed artwork rather than surfaces, which is why
       * this is the one place in the model where a colour is swung around the
       * wheel instead of picked out of the palette.
       */
      const dialZ = neckR * 0.8 + gaugeR * 0.78
      const dial = (geometry: BufferGeometry, lift: number): void => {
        geometry.rotateX(Math.PI / 2)
        geometry.translate(0, gaugeY, dialZ + lift)
        valvePieces.push(geometry)
      }

      dial(latheGeometry([
        { y: 0, radius: gaugeR * 0.82 },
        { y: gaugeR * 0.06, radius: gaugeR * 0.82 },
      ], Math.max(10, Math.round(segments * 0.5)), [0, 0, 0],
      tint('chrome', 0.34, 0.2), { capBottom: false, capTop: true }), 0)

      // The charged band. Green, because that is the only thing anybody reads
      // off an extinguisher gauge, and it is the shell's own red swung round
      // the wheel rather than a new entry in the palette.
      dial(arcBarGeometry(
        gaugeR * 0.55, gaugeR * 0.2, Math.PI * 0.3, Math.PI * 0.7, 10,
        [0, 0, 0], tint('retroreflective', 0.02, 0.3).offsetHSL(0.3, -0.1, 0), 4,
      ), gaugeR * 0.07)

      // The over- and under-charge sectors either side of it, in the shell's
      // own red. Three marks is what the reference's face carries and it is
      // the count, not the artwork, that makes it read as a scale.
      for (const start of [Math.PI * 0.04, Math.PI * 0.7]) {
        dial(arcBarGeometry(
          gaugeR * 0.55, gaugeR * 0.2, start, start + Math.PI * 0.26, 8,
          [0, 0, 0], tint('retroreflective', 0.06, 0.3), 4,
        ), gaugeR * 0.07)
      }

      /*
       * The tick ring.
       *
       * Twelve marks round the rim, and they are the last thing that turns a
       * coloured disc into an instrument. A viewer does not count them; what
       * they do is make the needle POINT AT something, and a needle with
       * nothing to point at is a scratch on paint. At 14 mm each tick is under
       * a millimetre, which is below the size rule the rest of this cluster is
       * built to — but the rule is about pieces read on their own, and these
       * are only ever read as a ring.
       */
      for (let i = 0; i < 12; i += 1) {
        const long = i % 3 === 0
        const mark = chamferedBoxGeometry(
          [gaugeR * (long ? 0.075 : 0.05), gaugeR * 0.05],
          [gaugeR * (long ? 0.075 : 0.05), gaugeR * 0.05],
          gaugeR * (long ? 0.2 : 0.12), gaugeR * 0.012, [0, 0, 0], black,
        )
        mark.translate(0, gaugeR * (long ? 0.66 : 0.7), 0)
        mark.rotateZ((i / 12) * Math.PI * 2)
        dial(mark, gaugeR * 0.075)
      }

      // The needle, standing in the band, and the hub it turns on.
      const needle = chamferedBoxGeometry(
        [gaugeR * 0.22, gaugeR * 0.09], [gaugeR * 0.06, gaugeR * 0.06],
        gaugeR * 0.66, gaugeR * 0.02, [0, 0, 0], black,
      )
      needle.translate(0, gaugeR * 0.28, 0)
      needle.rotateZ(0.42)
      dial(needle, gaugeR * 0.1)
      dial(latheGeometry([
        { y: 0, radius: gaugeR * 0.13 },
        { y: gaugeR * 0.08, radius: gaugeR * 0.1 },
      ], 8, [0, 0, 0], steel, { capBottom: false, capTop: true }), gaugeR * 0.09)

      // The pin and its ring: brass, small, and the one part that says the
      // thing has not been used.
      const brass = tint('brass', jitter(random, 0.02), 0.6)
      const pin = latheGeometry([
        { y: 0, radius: R * 0.022 },
        { y: R * 0.62, radius: R * 0.022 },
      ], 8, [0, 0, 0], brass, { capBottom: true, capTop: true })
      pin.rotateZ(Math.PI / 2)
      pin.translate(-R * 0.3, valveTop - H * 0.014, 0)
      valvePieces.push(pin)

      const ring = arcBarGeometry(
        R * 0.16, R * 0.03, 0, Math.PI * 2, 16, [0, 0, 0], brass, 8,
      )
      ring.rotateY(Math.PI / 2)
      ring.translate(-R * 0.42, valveTop - H * 0.014, 0)
      valvePieces.push(ring)

      /**
       * The carry handle: the fixed jaw the lever closes onto, which is the
       * whole reason the squeeze has something to stop against.
       *
       * Painted the same black as the lever and reaching as far, because on
       * the reference they are a matched pair. A chrome jaw half the lever's
       * length left the lever's outer half hanging over nothing. It is its own
       * part rather than a lump of the valve so that a consumer swapping the
       * chrome casting does not also repaint the grip.
       */
      const handlePieces = member([
        [0.02, -0.19, 0.085],
        [0.68, -0.42, 0.075],
        [1.28, -0.52, 0.055],
        [1.72, -0.30, 0.032],
      ], blackSteel)
      for (const piece of handlePieces) piece.translate(0, valveTop, 0)

      /* -------------------------------------------------------------- lever */
      // Built along +X from the pivot at the origin, so the part's own origin
      // is the hinge and `rotation.z` is the squeeze and nothing else.
      // The same table as the handle, mirrored about the gap. It rises where
      // the handle dips, so the two are furthest apart at the tips, which is
      // where a hand closes them.
      const leverPieces = member([
        [0.00, 0.00, 0.085],
        [0.62, 0.24, 0.075],
        [1.22, 0.42, 0.055],
        [1.70, 0.34, 0.028],
      ], blackSteel)

      /* --------------------------------------------------------------- hose */
      // A quarter turn out of the valve and then a straight run down the
      // bottle to a nozzle. Built from an arc rather than a chain of boxes so
      // the bend has no facets in its outline.
      const hoseR = R * 0.11
      /**
       * Where the run sits, which took three goes and one measurement.
       *
       * At 0.72 R it was inside a bottle of radius R and the render simply had
       * no hose in it. At 1.27 R it cleared the shell and read as a black cane
       * standing NEXT TO the extinguisher, so it was pulled in to lie against
       * the paint — and then the reference was measured: 1.29 R, standing a
       * fifth of a radius off the shell exactly as the first guess had it.
       *
       * The cane reading was never about the distance. It was that the hose
       * hung at the shell's mid-depth where the bottle hid it, and that
       * nothing bridged the gap. The yaw fixed the first and the bracket below
       * fixes the second, so the run can go back out where it belongs.
       */
      const runX = -R * 1.29
      const exitY = valveTop - H * 0.03
      /**
       * The hose does not come out of the casting, it comes out of a FITTING.
       *
       * With the bend rooted at the neck the joint was 0.32 shell radii from
       * the axis and the valve body is 0.43 wide, so the coupling was inside
       * the casting and invisible: the hose read as growing out of the metal.
       * A stub carries the joint clear, which is also what the reference has
       * and why its hose has a bright ring where it starts.
       */
      const stubEnd = R * 0.62
      const bendR = -runX - stubEnd
      const hosePieces: BufferGeometry[] = []

      const bend = arcBarGeometry(
        bendR, hoseR * 2, Math.PI / 2, Math.PI, 14, [0, 0, 0], black, 10,
      )
      bend.translate(-stubEnd, exitY - bendR, 0)
      hosePieces.push(bend)

      const runTop = exitY - bendR
      // Measured: the reference's nozzle stops about a ninth of the body
      // height clear of the floor, because a hose that reaches the ground is a
      // hose that drags.
      const runBot = H * 0.165
      hosePieces.push(latheGeometry([
        { y: runBot, radius: hoseR },
        { y: runTop, radius: hoseR },
      ], 10, [runX, 0, 0], black, { capBottom: false, capTop: false }))

      // The nozzle: a short sleeve at the end, slightly fatter than the hose,
      // because a hose that just stops is a hose that was cut.
      hosePieces.push(latheGeometry([
        { y: runBot - H * 0.055, radius: hoseR * 1.25 },
        { y: runBot - H * 0.012, radius: hoseR * 1.25 },
        { y: runBot, radius: hoseR * 1.05 },
      ], 10, [runX, 0, 0], black, { capBottom: true, capTop: false }))

      /**
       * The two crimped couplings, which are what say the hose was ATTACHED.
       *
       * Rubber does not join to brass on its own; every real hose has a
       * ferrule swaged over it at each end, and they are the only bright thing
       * on an otherwise black run. Without them the hose reads as one moulded
       * noodle that happens to touch a valve at the top and stop at the
       * bottom. They are two rings.
       */
      const ferrule = (y: number, x: number, half: number): void => {
        hosePieces.push(latheGeometry([
          { y: y - half, radius: hoseR * 1.02 },
          { y: y - half * 0.7, radius: hoseR * 1.3 },
          { y: y + half * 0.7, radius: hoseR * 1.3 },
          { y: y + half, radius: hoseR * 1.02 },
        ], 10, [x, 0, 0], steel, { capBottom: false, capTop: false }))
      }
      ferrule(runBot + H * 0.055, runX, H * 0.016)

      // The upper one sits on the outlet stub, so it is a ring lying on its
      // side rather than standing up.
      const collar = latheGeometry([
        { y: -H * 0.016, radius: hoseR * 1.02 },
        { y: -H * 0.011, radius: hoseR * 1.34 },
        { y: H * 0.011, radius: hoseR * 1.34 },
        { y: H * 0.016, radius: hoseR * 1.02 },
      ], 10, [0, 0, 0], steel, { capBottom: false, capTop: false })
      collar.rotateZ(Math.PI / 2)
      collar.translate(-stubEnd + H * 0.006, exitY, 0)
      hosePieces.push(collar)

      /**
       * And then the whole hose swings round to the FRONT of the bottle.
       *
       * Built in the XY plane it hangs at z = 0, which is the shell's mid
       * depth: outside the silhouette, but on any three-quarter view the line
       * of sight to it passes straight through the bottle, so it was there and
       * invisible in the render. Clearing the radius is not the same as being
       * seen. A real one is clipped to the front for the same reason a viewer
       * needs it there — it is the part you reach for.
       */
      for (const piece of hosePieces) piece.rotateY(HOSE_YAW)

      /**
       * And the clamp where the band crosses the hose.
       *
       * The band was a ring on the bottle and the hose was a tube beside it:
       * the two touched and nothing held. A strap that carries a hose pinches
       * OVER it, so this is a short cuff round the run at the band's height,
       * in the band's own black, reaching back to the shell. One piece, and it
       * is the difference between banded and adjacent.
       */
      const bandY = (H * 0.294 + H * 0.328) * 0.5
      const cuff = latheGeometry([
        { y: bandY - H * 0.019, radius: hoseR * 1.5 },
        { y: bandY + H * 0.019, radius: hoseR * 1.5 },
      ], 10, [runX, 0, 0], black, { capBottom: false, capTop: false })
      cuff.rotateY(HOSE_YAW)
      bodyPieces.push(cuff)

      // ...and the strap that reaches out to it. The hose stands a fifth of a
      // radius off the paint, so without this the cuff floats in the gap and
      // the band is just a stripe that happens to be at the same height.
      const reach = -runX - R * 0.96
      const bridge = chamferedBoxGeometry(
        [hoseR * 1.5, H * 0.03], [hoseR * 1.5, H * 0.03],
        reach, hoseR * 0.3, [0, 0, 0], black,
      )
      bridge.rotateZ(Math.PI / 2)
      bridge.translate(runX + reach * 0.5, bandY, 0)
      bridge.rotateY(HOSE_YAW)
      bodyPieces.push(bridge)

      /**
       * The fork the lever pivots in, which is the part that was missing.
       *
       * The lever's origin sat 0.16 shell radii above the bonnet with nothing
       * between them, so it hung in the air over the casting: an action with
       * no hinge. Two ears and a pin cost four small pieces and they are the
       * whole difference between a lever and a stick balanced on a valve. The
       * pin is at exactly the lever part's origin, which is the only way the
       * rotation and the visible hinge stay the same thing.
       */
      const pivotY = valveTop + R * 0.16
      for (const side of [-1, 1]) {
        const ear = chamferedBoxGeometry(
          [R * 0.09, R * 0.075], [R * 0.09, R * 0.075],
          pivotY - valveTop + R * 0.12, R * 0.02, [0, 0, 0], steel,
        )
        ear.translate(R * 0.06, (valveTop + pivotY) * 0.5 - R * 0.02, side * R * 0.13)
        valvePieces.push(ear)
      }
      const hinge = latheGeometry([
        { y: -R * 0.2, radius: R * 0.032 },
        { y: -R * 0.17, radius: R * 0.045 },
        { y: R * 0.17, radius: R * 0.045 },
        { y: R * 0.2, radius: R * 0.032 },
      ], 8, [0, 0, 0], tint('chrome', -0.06, 0.5), { capBottom: true, capTop: true })
      hinge.rotateX(Math.PI / 2)
      hinge.translate(R * 0.06, pivotY, 0)
      valvePieces.push(hinge)

      const stub = latheGeometry([
        { y: neckR * 0.34, radius: hoseR * 1.5 },
        { y: stubEnd - H * 0.014, radius: hoseR * 1.5 },
        { y: stubEnd - H * 0.01, radius: hoseR * 1.15 },
        { y: stubEnd + H * 0.008, radius: hoseR * 1.15 },
      ], 10, [0, 0, 0], steel, { capBottom: false, capTop: true })
      stub.rotateZ(Math.PI / 2)
      stub.translate(0, exitY, 0)
      stub.rotateY(HOSE_YAW)
      valvePieces.push(stub)

      bakeOcclusion(valvePieces, { strength: 0.4 })

      return {
        body: { slot: 'retroreflective' as const, geometry: smoothNormals(mergeColoured(bodyPieces), 40) },
        valve: { slot: 'chrome' as const, geometry: smoothNormals(mergeColoured(valvePieces), 35) },
        handle: { slot: 'steelPainted' as const, geometry: smoothNormals(mergeColoured(handlePieces), 35) },
        lever: {
          slot: 'steelPainted' as const,
          geometry: smoothNormals(mergeColoured(leverPieces), 35),
          origin: [R * 0.06, pivotY, 0] as const,
        },
        hose: { slot: 'rubber' as const, geometry: smoothNormals(mergeColoured(hosePieces), 30) },
      }
    },

    actions: ({ parts, getConfig }) => {
      const set = (amount: number): void => {
        /*
         * Travel stops where the lever meets the handle, and the angle is
         * MEASURED off the built geometry rather than reasoned from the knot
         * tables.
         *
         * Reasoning from the tables gave 0.34 rad and the tips never touched:
         * the lever's knots are relative to its own origin, which is already
         * 0.16 shell radii above the valve, so the real gap at the tip is 0.74
         * radii of clear air and not the 0.58 the two tables seem to say. The
         * tip is 1.64 radii out from the hinge, which puts closure at 0.45.
         * A little under that so the two rest against each other.
         *
         * At 0.46 the closest approach between the two members is 0.8 mm and
         * it is at the tip, which is the only place it should be: at rest the
         * nearest point is 11 mm and sits back at the pivot instead. That is deliberate: two
         * painted castings that arrive at exactly zero co-planar surfaces
         * z-fight, and a millimetre reads as closed at every distance the
         * model is ever seen from.
         *
         * The check that found the wrong angle measures the closest approach
         * between the two members as point clouds. A bounding box will not
         * show it -- the boxes overlap from the first degree of travel, since
         * they overlap in x the whole way -- and neither will a silhouette
         * binned by x, because a member built from four knots has no vertices
         * across most of its length to bin.
         */
        parts.lever.anchor.rotation.z = -Math.min(1, Math.max(0, amount)) * 0.46
      }
      set(getConfig().squeeze)
      return { squeeze: (amount = 1) => { set(amount) } }
    },
  }, overrides)
}
