/**
 * @contemporary-props/fire-hydrant
 *
 * Bonnet, bolted flanges and radial outlets: a stepped lathe stack that names
 * itself at fifty metres, which is what the catalogue puts it sixty-second for
 * and is the honest description of the whole model. There is no clever
 * geometry here. There is a profile with eleven steps in it, and every one of
 * them is a step somebody cast for a reason.
 *
 * Measured off the reference against a 900 mm hydrant, as fractions of that:
 *
 *   0.000  the foot flange, and the break flange bolted above it
 *   0.157  the lower barrel
 *   0.282  the raised band where the barrel changes section
 *   0.580  the outlets, three of them on one radial array
 *   0.737  the bonnet flange
 *   0.965  the fluted dome
 *   1.000  the operating nut, which is a pentagon so nothing but a hydrant
 *          wrench will turn it
 *
 * The caps swing on their chains, which is the catalogue's action, and it is
 * the one place this model is not a lathe. Each cap is its own part with the
 * hinge as its origin, and the anchor carries TWO rotations in YXZ order: a
 * fixed Y that places the cap round the barrel, and an X that is the swing.
 * Written with one part for all three, the swing would carry them round the
 * hydrant rather than down its side, because a single anchor has a single axis.
 */
import { type BufferGeometry, type Object3D } from 'three'

import {
  bakeOcclusion,
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

export interface FireHydrantConfig {
  /** Height to the top of the operating nut (metres). */
  readonly height: number
  /** Outlets round the barrel. */
  readonly outlets: number
  /** How far the caps are swung off, 0 shut to 1 hanging. */
  readonly unscrewed: number
  /** Sides on the barrel's revolve. */
  readonly segments: number
  readonly seed: number
}

export const fireHydrantDefaults: FireHydrantConfig = {
  height: 0.9,
  outlets: 3,
  unscrewed: 0,
  segments: 26,
  seed: 97,
}

export type FireHydrantParts = 'body' | 'chains' | 'capA' | 'capB' | 'capC'

export interface FireHydrantActions {
  /** Swings the caps off their outlets. 1 is hanging on the chain. */
  unscrew(amount?: number): void
}

const CAPS = ['capA', 'capB', 'capC'] as const

function applyUnscrew(
  runtime: RuntimeContext<FireHydrantConfig, FireHydrantParts>,
  amount: number,
): void {
  const outlets = Math.max(1, Math.min(3, Math.round(runtime.getConfig().outlets)))
  const swing = Math.min(1, Math.max(0, amount)) * 2.1
  for (let i = 0; i < CAPS.length; i += 1) {
    const anchor = runtime.parts[CAPS[i]!].anchor as Object3D
    // YXZ, so the Y that places the cap round the barrel is applied FIRST and
    // the X swing then happens in that placed frame -- which is the tangential
    // axis a cap actually hinges about.
    anchor.rotation.order = 'YXZ'
    anchor.rotation.y = (i / outlets) * Math.PI * 2
    anchor.rotation.x = i < outlets ? swing : 0
  }
}

export function createModel(overrides: Partial<FireHydrantConfig> = {}) {
  let heldUnscrew = 0
  let seenUnscrew = Number.NaN

  return createKitModel<
    FireHydrantConfig, 'retroreflective' | 'stainless', FireHydrantParts, FireHydrantActions
  >({
    id: 'fire-hydrant',
    defaults: fireHydrantDefaults,
    slots: ['retroreflective', 'stainless'],

    build: ({ config, random }) => {
      const tint = createTinter(random)
      const H = Math.min(1.4, Math.max(0.5, config.height))
      const outlets = Math.max(1, Math.min(3, Math.round(config.outlets)))
      const segments = Math.max(12, Math.round(config.segments))

      const red = tint('retroreflective', -0.03 + jitter(random, 0.02), 0.8)
      const deep = tint('retroreflective', -0.1, 0.6)
      const steel = tint('stainless', -0.04, 0.3).offsetHSL(0, -1, 0)

      const R = H * 0.122
      const outletY = H * 0.58

      /**
       * The barrel, as ONE lathe.
       *
       * Every step in it is a casting feature: the foot the hydrant is bolted
       * down through, the break flange it is designed to shear at when a car
       * hits it, the band where the barrel changes section, the shoulder the
       * outlets grow out of, the bonnet flange. Stacked as separate cylinders
       * this is a dozen pieces with a dozen pairs of coincident faces; as one
       * profile it is a solid with no interior at all.
       */
      const bodyPieces: BufferGeometry[] = [latheGeometry([
        { y: 0, radius: R * 1.42 },
        { y: H * 0.022, radius: R * 1.42 },
        { y: H * 0.03, radius: R * 1.28 },
        { y: H * 0.058, radius: R * 1.28 },
        { y: H * 0.07, radius: R * 1.4 },
        { y: H * 0.1, radius: R * 1.4 },
        { y: H * 0.112, radius: R * 1.02 },
        { y: H * 0.157, radius: R * 0.99 },
        { y: H * 0.268, radius: R * 0.96 },
        // The band, which is where a dry-barrel hydrant's two castings meet.
        { y: H * 0.282, radius: R * 1.06 },
        { y: H * 0.31, radius: R * 1.06 },
        { y: H * 0.322, radius: R * 0.9 },
        { y: H * 0.47, radius: R * 0.87 },
        // The shoulder the outlets come out of: the barrel swells to take them
        // and this bulge is most of what reads as a hydrant in silhouette.
        { y: outletY, radius: R * 0.98 },
        { y: H * 0.66, radius: R * 0.86 },
        { y: H * 0.72, radius: R * 0.84 },
        { y: H * 0.737, radius: R * 1.36 },
        { y: H * 0.79, radius: R * 1.36 },
        { y: H * 0.806, radius: R * 1.24 },
        { y: H * 0.831, radius: R * 1.24 },
        // The dome.
        { y: H * 0.87, radius: R * 1.02 },
        { y: H * 0.915, radius: R * 0.74 },
        { y: H * 0.95, radius: R * 0.34 },
        { y: H * 0.965, radius: R * 0.22 },
      ], segments, [0, 0, 0], red, { colourTop: deep, capBottom: true, capTop: true })]

      /*
       * The dome's RIBS.
       *
       * A hydrant's bonnet is a casting with vertical ribs running over it, and
       * without them the dome is a plain hemisphere that could belong to a
       * bollard. They are a radial array of thin blades following the same
       * profile the dome does, standing a couple of millimetres proud.
       */
      const domeLevels = [
        [0.831, 1.24], [0.87, 1.02], [0.915, 0.74], [0.95, 0.34],
      ] as const
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2
        const rib = latheGeometry(
          domeLevels.map(([y, r]) => ({ y: H * y, radius: R * r * 1.022 })),
          3, [0, 0, 0], deep, { capBottom: false, capTop: false },
        )
        rib.rotateY(a)
        bodyPieces.push(rib)
      }

      // The operating nut: a PENTAGON, which is the whole point of it. A hex
      // nut can be turned by anything in a toolbox; five sides is what makes a
      // hydrant need a hydrant wrench.
      bodyPieces.push(latheGeometry([
        { y: H * 0.96, radius: R * 0.3 },
        { y: H * 0.972, radius: R * 0.27 },
        { y: H * 1, radius: R * 0.25 },
      ], 5, [0, 0, 0], red, { capBottom: false, capTop: true }))

      /** Bolt heads round a flange, which is what says a casting was bolted. */
      const bolts = (y: number, radius: number, count: number): void => {
        for (let i = 0; i < count; i += 1) {
          const a = ((i + 0.5) / count) * Math.PI * 2
          bodyPieces.push(latheGeometry([
            { y: 0, radius: R * 0.1 },
            { y: H * 0.012, radius: R * 0.092 },
            { y: H * 0.016, radius: R * 0.05 },
          ], 6, [Math.sin(a) * radius, y, Math.cos(a) * radius], steel,
          { capBottom: false, capTop: true }))
        }
      }
      bolts(H * 0.102, R * 1.26, 8)
      bolts(H * 0.792, R * 1.24, 8)

      /* ------------------------------------------------------ the outlets */
      /**
       * The spigots stay on the body; only the caps come off.
       *
       * Built at angle zero and turned into place, so one description makes all
       * three -- and the caps, which are separate parts, are built in exactly
       * the same unrotated frame so their anchors can place them the same way.
       */
      // Three quarters of the barrel across, off the reference: at half it read
      // as a bolt boss rather than as something a hose couples to, and the
      // outlets are most of what names a hydrant in silhouette.
      const spigotR = R * 0.72
      const reach = R * 1.5
      const capPieces: BufferGeometry[][] = [[], [], []]
      const chainPieces: BufferGeometry[] = []

      for (let i = 0; i < outlets; i += 1) {
        const a = (i / outlets) * Math.PI * 2

        const spigot = latheGeometry([
          { y: R * 0.5, radius: spigotR * 1.14 },
          { y: reach - R * 0.2, radius: spigotR * 1.08 },
          { y: reach - R * 0.1, radius: spigotR * 1.22 },
          { y: reach, radius: spigotR * 1.22 },
        ], 18, [0, 0, 0], red, { capBottom: false, capTop: false })
        spigot.rotateX(Math.PI / 2)
        spigot.rotateY(a)
        spigot.translate(0, outletY, 0)
        bodyPieces.push(spigot)

        // The cap, in the UNROTATED frame with the hinge at the origin: the
        // anchor's Y puts it round the barrel and its X swings it down.
        const cap = mergeColoured([
          latheGeometry([
            { y: 0, radius: spigotR * 1.26 },
            { y: R * 0.18, radius: spigotR * 1.26 },
            { y: R * 0.26, radius: spigotR * 1.1 },
          ], 18, [0, 0, 0], red, { capBottom: false, capTop: true }),
          // The hex the cap is turned by.
          latheGeometry([
            { y: R * 0.24, radius: spigotR * 0.52 },
            { y: R * 0.44, radius: spigotR * 0.46 },
          ], 6, [0, 0, 0], red, { capBottom: false, capTop: true }),
        ])
        cap.rotateX(Math.PI / 2)
        cap.translate(0, 0, reach)
        capPieces[i] = [cap]

        /*
         * The chain, which is what makes a cap a cap rather than a lid.
         *
         * It hangs in a real catenary rather than a straight line: a chain
         * drawn taut between two points reads as a rod, and the sag is the only
         * thing that says the thing is flexible. Three sample points and a
         * sine are enough at this size.
         */
        const from: Vec3 = [0, outletY - R * 0.18, reach * 0.78]
        const to: Vec3 = [0, outletY - R * 1.15, R * 0.82]
        const path: Vec3[] = []
        for (let k = 0; k <= 8; k += 1) {
          const t = k / 8
          path.push([
            0,
            from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * R * 0.5,
            from[2] + (to[2] - from[2]) * t,
          ])
        }
        // No caps: both ends are buried, one in the cap's boss and one in the
        // barrel, and the discs there were three pairs of coincident faces.
        const chain = tubeGeometry(path, R * 0.05, 6, steel, { capStart: false, capEnd: false })
        chain.rotateY(a)
        chainPieces.push(chain)
      }

      bakeOcclusion(bodyPieces, { strength: 0.35 })

      const hinge = [0, outletY, 0] as const
      const capPart = (i: number): {
        slot: 'retroreflective'
        geometry: BufferGeometry
        origin: readonly [number, number, number]
      } | undefined => (capPieces[i]!.length === 0 ? undefined : {
        slot: 'retroreflective' as const,
        geometry: smoothNormals(mergeColoured(capPieces[i]!), 34),
        origin: hinge,
      })

      return {
        body: { slot: 'retroreflective' as const, geometry: smoothNormals(mergeColoured(bodyPieces), 34) },
        chains: chainPieces.length === 0
          ? undefined
          : { slot: 'stainless' as const, geometry: smoothNormals(mergeColoured(chainPieces), 40) },
        capA: capPart(0),
        capB: capPart(1),
        capC: capPart(2),
      }
    },

    actions: (runtime) => {
      heldUnscrew = runtime.getConfig().unscrewed
      seenUnscrew = heldUnscrew
      applyUnscrew(runtime, heldUnscrew)
      return { unscrew: (amount = 1) => { heldUnscrew = amount; applyUnscrew(runtime, amount) } }
    },

    update: (_dt, runtime) => {
      const wanted = runtime.getConfig().unscrewed
      if (wanted !== seenUnscrew) { seenUnscrew = wanted; heldUnscrew = wanted }
      applyUnscrew(runtime, heldUnscrew)
    },
  }, overrides)
}
