/**
 * @contemporary-props/gas-cylinder
 *
 * The first time a lathe carries an array, which is the catalogue's whole
 * reason for putting it eighth: the bottle is one revolve, and the guard round
 * its valve is four posts and a ring standing on top of that revolve. Every
 * caged, railed or slatted thing later in the kit is this arrangement again.
 *
 * Measured off the reference. It is 3.72 diameters tall and the parts stack in
 * fractions of that height:
 *
 *   0.000  foot ring, a hair proud of the shell so the bottle stands on a rim
 *   0.116  the shell, straight for half the object
 *   0.608  the shoulder, a dome drawn in to the neck
 *   0.735  neck, 0.36 of the shell's radius
 *   0.761  the valve, in brass because it is the one part that is not steel
 *   0.750  the cage's collar, which sits ON the shoulder rather than the neck
 *   1.000  the cage's top ring
 *
 * The cage is the part worth reading. Its ring is hollow, turned up the
 * outside and back down the inside the way the vase's bore is, because a ring
 * you can see through the middle of is a ring you can see the far side of, and
 * a single-sided one loses that far side to back-face culling. That mistake
 * cost this kit a vase that vanished when you looked into it, and a guard is
 * looked into by definition.
 *
 * The handwheel is its own part with its origin on the valve axis, so
 * `wheel.anchor.rotation.y` is the action. Its lobes are the second array in
 * the model and they are what makes the turn visible: a smooth wheel turns
 * invisibly, which is the same lesson the pepper mill's knurled knob taught.
 */
import { type BufferGeometry } from 'three'

import {
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

export interface GasCylinderConfig {
  /** Overall height, cage included (metres). */
  readonly height: number
  /** Radius of the shell (metres). */
  readonly radius: number
  /** Posts around the valve guard. */
  readonly posts: number
  /** Lobes around the handwheel. */
  readonly lobes: number
  /** Sides around the revolve. */
  readonly segments: number
  readonly seed: number
}

export const gasCylinderDefaults: GasCylinderConfig = {
  height: 0.75,
  // 3.72 diameters tall, which is what the reference measures. A gas bottle
  // squatter than about three reads as a fire extinguisher and taller than
  // about five reads as a pipe.
  radius: 0.101,
  posts: 4,
  lobes: 8,
  segments: 32,
  seed: 17,
}

export type GasCylinderParts = 'body' | 'valve' | 'wheel' | 'cage'

export interface GasCylinderActions {
  /** Turns the handwheel. Default is a quarter turn. */
  turn(radians?: number): void
}

export function createModel(overrides: Partial<GasCylinderConfig> = {}) {
  return createKitModel<
    GasCylinderConfig, 'steelPainted' | 'aluminium' | 'brass',
    GasCylinderParts, GasCylinderActions
  >({
    id: 'gas-cylinder',
    defaults: gasCylinderDefaults,
    slots: ['steelPainted', 'aluminium', 'brass'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.3, Math.max(0.4, config.height))
      const R = Math.min(H * 0.19, Math.max(H * 0.09, Math.min(0.2, Math.max(0.05, config.radius))))
      const segments = Math.max(12, Math.round(config.segments))
      const posts = Math.max(3, Math.min(8, Math.round(config.posts)))
      const lobes = Math.max(5, Math.min(12, Math.round(config.lobes)))

      const footTop = H * 0.116
      const shellTop = H * 0.608
      const shoulderTop = H * 0.735
      const neckR = R * 0.36
      const neckTop = H * 0.761

      /* -------------------------------------------------------------- shell */
      const shell: Level[] = [
        { y: 0, radius: R * 1.03 },
        { y: H * 0.005, radius: R * 1.065 },
        { y: footTop - H * 0.01, radius: R * 1.065 },
        // The foot ring is a band the shell steps out of, so the bottle stands
        // on a rim rather than on its own wall. Every one of these has one and
        // it is the detail that stops the shape reading as a tin.
        //
        // The step is 6.5%, not 3%. At 3% it is three millimetres on a bottle
        // two hundred across and a critic looking at four renders reported the
        // ring as "effectively 0% and no foot ring at all", which is what an
        // invisible detail is worth.
        { y: footTop, radius: R },
        { y: shellTop, radius: R },
        // The shoulder: a dome, sampled so the smoothing takes it as a curve
        // and not as a chain of cones.
        { y: shellTop + (shoulderTop - shellTop) * 0.35, radius: R * 0.955 },
        { y: shellTop + (shoulderTop - shellTop) * 0.65, radius: R * 0.84 },
        { y: shellTop + (shoulderTop - shellTop) * 0.86, radius: R * 0.62 },
        { y: shoulderTop, radius: neckR * 1.25 },
        { y: shoulderTop + H * 0.006, radius: neckR },
        { y: neckTop, radius: neckR },
      ]

      const steel = tint('steelPainted', jitter(random, 0.02))
      const vent = tint('steelPainted', -0.16)
      const bodyPieces: BufferGeometry[] = [
        latheGeometry(shell, segments, [0, 0, 0], steel, {
          // A bottle is handled at the neck and stood in the wet, so it is
          // cleaner at the top than at the foot.
          colourTop: tint('steelPainted', 0.05),
          capBottom: true,
          capTop: true,
        }),
      ]

      // Two vent holes through the foot ring, which every bottle has so the
      // skirt drains. Dark plugs standing a hair proud rather than holes cut
      // through, because at this size the shadow is the whole of what is seen
      // and a boolean would cost a hundred triangles to say the same thing.
      for (const side of [0.35, -0.35]) {
        const hole = latheGeometry([
          { y: 0, radius: R * 0.075 },
          { y: R * 0.02, radius: R * 0.075 },
        ], 10, [0, 0, 0], vent, { capBottom: false, capTop: true })
        hole.rotateX(Math.PI / 2)
        hole.rotateY(side * Math.PI)
        hole.translate(
          Math.sin(side * Math.PI) * R * 1.05,
          footTop * 0.45,
          Math.cos(side * Math.PI) * R * 1.05,
        )
        bodyPieces.push(hole)
      }

      /* -------------------------------------------------------------- valve */
      // A brass block on a stem, with one outlet spigot across it. Brass
      // because it is the one part of a gas bottle that never gets painted.
      const brass = tint('brass', jitter(random, 0.02), 0.6)
      const valveY = neckTop
      const valveH = H * 0.093
      const valveR = R * 0.25
      const valvePieces: BufferGeometry[] = [
        latheGeometry([
          { y: 0, radius: neckR * 0.92 },
          { y: valveH * 0.16, radius: valveR * 0.78 },
          { y: valveH * 0.34, radius: valveR },
          { y: valveH * 0.62, radius: valveR },
          { y: valveH * 0.72, radius: valveR * 0.62 },
          { y: valveH, radius: valveR * 0.42 },
        ], Math.max(8, Math.round(segments * 0.5)), [0, valveY, 0], brass,
        { colourTop: tint('brass', 0.05, 0.6), capBottom: true, capTop: true }),
        // The outlet, across the block. Square-shouldered on purpose: it is a
        // machined fitting and the one hard edge in a model of curves.
        //
        // Built AT THE ORIGIN and carried into place afterwards. Built where it
        // belongs and then turned, `rotateZ` swings it about the world origin
        // instead of about itself, and the spigot ends up lying on the floor a
        // valve-height away from the bottle. It did exactly that, and the
        // support check caught it as a second connected component.
        chamferedBoxGeometry(
          [valveR * 0.9, valveR * 0.9], [valveR * 0.78, valveR * 0.78],
          valveR * 2.4, valveR * 0.12,
          [0, 0, 0], brass,
        ),
      ]
      valvePieces[1]!.rotateZ(Math.PI / 2)
      valvePieces[1]!.translate(valveR * 0.9, valveY + valveH * 0.46, 0)

      /**
       * The outlet's bore.
       *
       * A gas bottle's side outlet is the one hole anybody looks for, and a
       * solid stub does not read as one: the critic counted zero across four
       * views. Turned up the outside and back down the inside so there is a
       * real mouth, the same construction the vase and the guard's ring use.
       */
      const spigotR = valveR * 0.44
      const spigot = latheGeometry([
        { y: 0, radius: spigotR },
        { y: valveR * 0.5, radius: spigotR },
        { y: valveR * 0.5, radius: spigotR * 0.52 },
        { y: valveR * 0.1, radius: spigotR * 0.52 },
      ], Math.max(8, Math.round(segments * 0.5)), [0, 0, 0],
      tint('brass', -0.03, 0.6), { capBottom: false, capTop: true })
      spigot.rotateZ(-Math.PI / 2)
      spigot.translate(valveR * 1.75, valveY + valveH * 0.46, 0)
      valvePieces.push(spigot)

      /* ---------------------------------------------------------- handwheel */
      const wheelY = valveY + valveH
      const wheelR = R * 0.31
      const alloy = tint('aluminium', jitter(random, 0.02), 0.7)
      const wheelPieces: BufferGeometry[] = [
        latheGeometry([
          { y: 0, radius: wheelR * 0.3 },
          { y: H * 0.004, radius: wheelR * 0.62 },
          { y: H * 0.013, radius: wheelR * 0.66 },
          { y: H * 0.03, radius: wheelR * 0.5 },
          { y: H * 0.037, radius: wheelR * 0.26 },
        ], Math.max(8, Math.round(segments * 0.5)), [0, 0, 0], alloy,
        { colourTop: tint('aluminium', 0.05, 0.7), capBottom: true, capTop: true }),
      ]
      // The lobes. Without them the wheel is a smooth disc and turning it is
      // invisible, which is the whole reason the action exists.
      for (let i = 0; i < lobes; i += 1) {
        const angle = (i / lobes) * Math.PI * 2
        const lobe = chamferedBoxGeometry(
          [wheelR * 0.42, wheelR * 0.5], [wheelR * 0.3, wheelR * 0.42],
          H * 0.026, wheelR * 0.09,
          [0, 0, 0], alloy,
        )
        lobe.rotateY(angle)
        lobe.translate(Math.sin(angle) * wheelR * 0.72, H * 0.014, Math.cos(angle) * wheelR * 0.72)
        wheelPieces.push(lobe)
      }

      /* --------------------------------------------------------------- cage */
      // The array the catalogue is here for: posts standing on the shoulder,
      // carrying a ring over the valve.
      const cageBase = H * 0.75
      const cageTop = H
      const cageR = R * 0.83
      const ringH = H * 0.055
      const ringT = R * 0.075
      const cagePieces: BufferGeometry[] = []

      // The collar the posts stand on, a band round the base of the neck.
      cagePieces.push(latheGeometry([
        { y: cageBase - H * 0.016, radius: neckR * 1.32 },
        { y: cageBase, radius: neckR * 1.5 },
        { y: cageBase + H * 0.012, radius: neckR * 1.45 },
      ], segments, [0, 0, 0], alloy, { capBottom: true, capTop: true }))

      /**
       * The ring, hollow.
       *
       * Up the outside, across the top, down the inside and back under: a
       * guard is a thing you look through, so its far side is seen from the
       * inside every time. One-sided, that far side is back-facing and culled,
       * and the ring loses half of itself. The vase in this kit already paid
       * for that lesson.
       */
      cagePieces.push(latheGeometry([
        { y: cageTop - ringH, radius: cageR },
        { y: cageTop, radius: cageR },
        { y: cageTop, radius: cageR - ringT },
        { y: cageTop - ringH, radius: cageR - ringT },
      ], segments, [0, 0, 0], alloy, { capBottom: true, capTop: false }))

      // One bar across the opening, which every guard has and which is what
      // the bottle is actually carried by.
      cagePieces.push(chamferedBoxGeometry(
        [(cageR - ringT) * 2.02, ringH * 0.55], [(cageR - ringT) * 2.02, ringH * 0.45],
        ringT * 0.9, ringT * 0.16,
        [0, cageTop - ringH * 0.5, 0], alloy,
      ))

      // The posts. Each is a box leaning from the collar out to the ring, made
      // upright and then turned, because a box built along its own slope has
      // its section measured in the wrong plane.
      const postLo = { r: neckR * 1.42, y: cageBase + H * 0.006 }
      const postHi = { r: cageR - ringT * 0.4, y: cageTop - ringH * 0.4 }
      const runR = postHi.r - postLo.r
      const runY = postHi.y - postLo.y
      const postLen = Math.hypot(runR, runY)
      for (let i = 0; i < posts; i += 1) {
        const angle = (i / posts) * Math.PI * 2 + Math.PI / posts
        const post = chamferedBoxGeometry(
          [R * 0.085, R * 0.13], [R * 0.085, R * 0.13],
          postLen, R * 0.02, [0, 0, 0], alloy,
        )
        // Leaned outward in the x-y plane, then carried round to its angle.
        post.rotateZ(-Math.atan2(runR, runY))
        post.translate((postLo.r + postHi.r) / 2, (postLo.y + postHi.y) / 2, 0)
        post.rotateY(angle)
        cagePieces.push(post)
      }

      // The cage's own shadowing, before it is merged: a ring over a valve is
      // mostly gaps, and gaps are what occlusion is for.
      bakeOcclusion(cagePieces, { strength: 0.45 })

      return {
        body: { slot: 'steelPainted' as const, geometry: smoothNormals(mergeColoured(bodyPieces), 40) },
        valve: { slot: 'brass' as const, geometry: smoothNormals(mergeColoured(valvePieces), 35) },
        wheel: {
          slot: 'aluminium' as const,
          geometry: smoothNormals(mergeColoured(wheelPieces), 35),
          origin: [0, wheelY, 0] as const,
        },
        cage: { slot: 'aluminium' as const, geometry: smoothNormals(mergeColoured(cagePieces), 35) },
      }
    },

    actions: ({ parts }) => ({
      turn: (radians = Math.PI / 2) => {
        parts.wheel.anchor.rotation.y += radians
      },
    }),
  }, overrides)
}
