/**
 * The SINGLE source of the kit catalogue.
 *
 * This table is read from two places: `build.ts` when it produces registry.json,
 * and the viewer when it builds its sliders and descriptions. The two used to be
 * written out by hand separately; at seventeen models that is no longer
 * sustainable, and they had already started to drift apart.
 *
 * The `controls` here are a CONTRACT: every key has to be a config field of the
 * model. The viewer checks this through `keyof Config`, so a renamed field is a
 * compile error.
 */

export interface ControlSpec {
  readonly type: 'number'
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
}

export interface ModelMeta {
  readonly title: string
  readonly description: string
  readonly category: string
  readonly tags: readonly string[]
  readonly controls: Readonly<Record<string, ControlSpec>>
  readonly materialSlots: readonly string[]
  readonly parts: readonly string[]
}

export const MODEL_META: Readonly<Record<string, ModelMeta>> = {
  'wooden-chest': {
    title: 'Wooden Chest',
    description:
      'Six-board medieval chest with iron bands. The lid is hinged and opens on an action.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'interactive', 'procedural'],
    controls: {
      width: { type: 'number', label: 'Width', min: 0.4, max: 1.6, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Height', min: 0.28, max: 0.9, step: 0.02, unit: 'm' },
      depth: { type: 'number', label: 'Depth', min: 0.24, max: 0.8, step: 0.02, unit: 'm' },
      bandCount: { type: 'number', label: 'Band count', min: 0, max: 6, step: 1 },
      openAngle: { type: 'number', label: 'Open angle', min: 40, max: 130, step: 2, unit: '°' },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['body', 'lid', 'bands', 'lock'],
  },
  'wooden-barrel': {
    title: 'Wooden Barrel',
    description:
      'Lowpoly barrel built from separate oak staves, with iron hoops and a recessed head.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.4, max: 2, step: 0.02, unit: 'm' },
      radius: { type: 'number', label: 'Radius', min: 0.15, max: 0.9, step: 0.01, unit: 'm' },
      taper: { type: 'number', label: 'End taper', min: 0, max: 0.34, step: 0.01 },
      staveCount: { type: 'number', label: 'Stave count', min: 6, max: 28, step: 1 },
      hoopCount: { type: 'number', label: 'Hoop count', min: 0, max: 8, step: 1 },
      rivets: { type: 'number', label: 'Rivets per hoop', min: 0, max: 8, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['staves', 'heads', 'hoops'],
  },
  'wooden-crate': {
    title: 'Wooden Crate',
    description:
      'Rows of horizontal boards nailed to corner posts, with forged iron straps.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      width: { type: 'number', label: 'Width', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Height', min: 0.25, max: 1.2, step: 0.02, unit: 'm' },
      depth: { type: 'number', label: 'Depth', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      plankRows: { type: 'number', label: 'Board rows', min: 1, max: 6, step: 1 },
      strapCount: { type: 'number', label: 'Iron straps', min: 0, max: 4, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['posts', 'planks', 'straps'],
  },
  'wooden-bucket': {
    title: 'Wooden Bucket',
    description:
      'Tapering oak staves, an iron hoop and a forged handle — a small barrel.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'farm', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.15, max: 0.6, step: 0.01, unit: 'm' },
      radius: {
        type: 'number', label: 'Rim radius',
        min: 0.07, max: 0.3, step: 0.005, unit: 'm',
      },
      taper: { type: 'number', label: 'Base taper', min: 0, max: 0.45, step: 0.01 },
      staveCount: { type: 'number', label: 'Stave count', min: 6, max: 20, step: 1 },
      hoopCount: { type: 'number', label: 'Hoop count', min: 0, max: 4, step: 1 },
      handle: { type: 'number', label: 'Handle', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['staves', 'base', 'hoops', 'handle'],
  },
  'trestle-table': {
    title: 'Trestle Table',
    description:
      'Trestle table: the top is not nailed to the legs, it rests on them — so the hall can be cleared.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Length', min: 1, max: 3.2, step: 0.05, unit: 'm' },
      width: { type: 'number', label: 'Width', min: 0.5, max: 1.2, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Height', min: 0.5, max: 1, step: 0.01, unit: 'm' },
      plankCount: { type: 'number', label: 'Top boards', min: 2, max: 7, step: 1 },
      splay: { type: 'number', label: 'Leg splay', min: 0, max: 0.45, step: 0.01 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['top', 'trestles', 'stretcher'],
  },
  'wooden-bench': {
    title: 'Wooden Bench',
    description:
      'Medieval bench with splayed legs, its tenons showing through the top of the seat.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Length', min: 0.6, max: 3, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Height', min: 0.28, max: 0.7, step: 0.01, unit: 'm' },
      width: { type: 'number', label: 'Width', min: 0.18, max: 0.5, step: 0.01, unit: 'm' },
      splay: { type: 'number', label: 'Leg splay', min: 0, max: 0.6, step: 0.02 },
      inset: { type: 'number', label: 'Leg inset', min: 0.02, max: 0.3, step: 0.01 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['seat', 'legs', 'stretcher'],
  },
  'wooden-stool': {
    title: 'Wooden Stool',
    description:
      'Three-legged village stool — three is the count that does not rock on uneven ground.',
    category: 'Furniture',
    tags: ['medieval', 'lowpoly', 'furniture', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.25, max: 0.9, step: 0.01, unit: 'm' },
      seatRadius: {
        type: 'number', label: 'Seat radius',
        min: 0.1, max: 0.3, step: 0.005, unit: 'm',
      },
      legCount: { type: 'number', label: 'Legs', min: 3, max: 5, step: 1 },
      splay: { type: 'number', label: 'Leg splay', min: 0, max: 0.45, step: 0.01 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['seat', 'legs'],
  },
  'pitch-torch': {
    title: 'Pitch Torch',
    description:
      'Torch wrapped in pitch-soaked cloth. The flame flickers in update(), goes out via actions.setLit.',
    category: 'Lighting',
    tags: ['medieval', 'lowpoly', 'lighting', 'animated', 'interactive'],
    controls: {
      length: { type: 'number', label: 'Shaft length', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      radius: {
        type: 'number', label: 'Shaft radius',
        min: 0.008, max: 0.05, step: 0.001, unit: 'm',
      },
      wrapLength: { type: 'number', label: 'Wrap ratio', min: 0.12, max: 0.5, step: 0.01 },
      flameHeight: { type: 'number', label: 'Flame height', min: 0.4, max: 3, step: 0.05 },
      flicker: { type: 'number', label: 'Flicker', min: 0, max: 2.5, step: 0.05 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'char', 'ember'],
    parts: ['shaft', 'wrap', 'flame'],
  },
  'iron-anvil': {
    title: 'Iron Anvil',
    description:
      'Wide base, narrow waist, tapering horn; on top a steel face plate polished by use.',
    category: 'Smithy',
    tags: ['medieval', 'lowpoly', 'smithy', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.2, max: 0.6, step: 0.01, unit: 'm' },
      faceLength: {
        type: 'number', label: 'Face length',
        min: 0.25, max: 0.8, step: 0.01, unit: 'm',
      },
      faceWidth: {
        type: 'number', label: 'Face width',
        min: 0.07, max: 0.25, step: 0.005, unit: 'm',
      },
      hornReach: { type: 'number', label: 'Horn reach', min: 0.2, max: 0.8, step: 0.02 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['iron', 'steel'],
    parts: ['base', 'waist', 'body', 'face', 'horn'],
  },
  'cart-wheel': {
    title: 'Cart Wheel',
    description:
      'Four layers from the outside in: iron tyre, wooden felloe, spokes, hub.',
    category: 'Structure',
    tags: ['medieval', 'lowpoly', 'cart', 'structure', 'procedural'],
    controls: {
      radius: { type: 'number', label: 'Radius', min: 0.25, max: 0.9, step: 0.01, unit: 'm' },
      spokeCount: { type: 'number', label: 'Spokes', min: 6, max: 16, step: 1 },
      width: { type: 'number', label: 'Thickness', min: 0.04, max: 0.18, step: 0.005, unit: 'm' },
      hubLength: { type: 'number', label: 'Hub length', min: 1.2, max: 3.2, step: 0.1 },
      tyre: { type: 'number', label: 'Tyre thickness', min: 0.02, max: 0.09, step: 0.005 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['hub', 'spokes', 'felloe', 'tyre'],
  },
  'log-pile': {
    title: 'Log Pile',
    description:
      'Pile of cut firewood. The end grain is far lighter than the bark; it is what you see first.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'procedural'],
    controls: {
      rows: { type: 'number', label: 'Rows', min: 1, max: 6, step: 1 },
      perRow: { type: 'number', label: 'Logs per row', min: 1, max: 9, step: 1 },
      logLength: { type: 'number', label: 'Log length', min: 0.3, max: 1.4, step: 0.02, unit: 'm' },
      logRadius: {
        type: 'number', label: 'Log radius',
        min: 0.03, max: 0.14, step: 0.002, unit: 'm',
      },
      variation: { type: 'number', label: 'Thickness variation', min: 0, max: 0.5, step: 0.02 },
      taperRows: { type: 'number', label: 'Pyramid stack', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['bark', 'ends'],
  },
  'hay-bale': {
    title: 'Hay Bale',
    description:
      'Hand-tied straw bale — pinched where the ropes bite, with wisps sticking out on every side.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'farm', 'props', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Length', min: 0.4, max: 1.6, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Height', min: 0.2, max: 0.9, step: 0.02, unit: 'm' },
      depth: { type: 'number', label: 'Depth', min: 0.2, max: 0.9, step: 0.02, unit: 'm' },
      ropeCount: { type: 'number', label: 'Rope count', min: 0, max: 4, step: 1 },
      wisps: { type: 'number', label: 'Stray wisps', min: 0, max: 60, step: 2 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['straw', 'cloth'],
    parts: ['bale', 'wisps', 'ropes'],
  },
  'linen-sack': {
    title: 'Linen Sack',
    description:
      'Grain sack tied shut at the mouth with cord. The fill ratio changes the whole silhouette.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'farm', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.2, max: 1, step: 0.01, unit: 'm' },
      radius: { type: 'number', label: 'Radius', min: 0.07, max: 0.35, step: 0.005, unit: 'm' },
      fill: { type: 'number', label: 'Fill', min: 0.15, max: 1, step: 0.02 },
      collar: { type: 'number', label: 'Collar allowance', min: 0.05, max: 0.3, step: 0.01 },
      ears: { type: 'number', label: 'Bottom ears', min: 0, max: 6, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['cloth'],
    parts: ['body', 'collar', 'cord'],
  },
  'straw-broom': {
    title: 'Straw Broom',
    description:
      'Besom: hazel shaft, a brush bundle built from three concentric rings, willow bindings.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'household', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Length', min: 0.7, max: 1.8, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Shaft thickness',
        min: 0.01, max: 0.03, step: 0.001, unit: 'm',
      },
      headLength: { type: 'number', label: 'Bundle length', min: 0.2, max: 0.55, step: 0.01 },
      tieRadius: { type: 'number', label: 'Binding radius', min: 0.03, max: 0.09, step: 0.002, unit: 'm' },
      tipRadius: { type: 'number', label: 'Tip radius', min: 0.04, max: 0.2, step: 0.005, unit: 'm' },
      bristles: { type: 'number', label: 'Bristle count', min: 8, max: 60, step: 2 },
      bindings: { type: 'number', label: 'Binding count', min: 0, max: 5, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'straw', 'cloth'],
    parts: ['shaft', 'bristles', 'bindings'],
  },
  'oak-tankard': {
    title: 'Oak Tankard',
    description:
      'Oak tankard: the barrel at palm scale, in the same stave-and-hoop language.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'tavern', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.08, max: 0.28, step: 0.005, unit: 'm' },
      radius: { type: 'number', label: 'Rim radius', min: 0.03, max: 0.1, step: 0.002, unit: 'm' },
      taper: { type: 'number', label: 'Base taper', min: 0, max: 0.3, step: 0.01 },
      staveCount: { type: 'number', label: 'Stave count', min: 6, max: 18, step: 1 },
      hoopCount: { type: 'number', label: 'Hoop count', min: 0, max: 4, step: 1 },
      handle: { type: 'number', label: 'Handle', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['staves', 'base', 'hoops', 'handle'],
  },
  'bronze-bell': {
    title: 'Bronze Bell',
    description:
      'Bronze bell hung from a yoke. The clapper swings with a lag and strikes the rim; strikes are counted.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'animated', 'interactive'],
    controls: {
      diameter: { type: 'number', label: 'Mouth diameter', min: 0.15, max: 1, step: 0.01, unit: 'm' },
      height: { type: 'number', label: 'Height', min: 0.15, max: 1.1, step: 0.01, unit: 'm' },
      yoke: { type: 'number', label: 'Yoke length', min: 1, max: 2.2, step: 0.05 },
      swing: { type: 'number', label: 'Swing', min: 5, max: 60, step: 1, unit: '°' },
      damping: { type: 'number', label: 'Damping', min: 0.1, max: 3, step: 0.05 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['brass', 'iron', 'oak'],
    parts: ['bell', 'clapper', 'yoke', 'frame'],
  },
  'iron-lantern': {
    title: 'Iron Lantern',
    description:
      'Hexagonal iron cage, glass panels, an oil lamp inside. An enclosed flame flickers more calmly.',
    category: 'Lighting',
    tags: ['medieval', 'lowpoly', 'lighting', 'animated', 'interactive'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.14, max: 0.5, step: 0.01, unit: 'm' },
      radius: { type: 'number', label: 'Radius', min: 0.04, max: 0.15, step: 0.005, unit: 'm' },
      sides: { type: 'number', label: 'Side count', min: 3, max: 8, step: 1 },
      flameHeight: { type: 'number', label: 'Flame height', min: 0.08, max: 0.45, step: 0.01 },
      flicker: { type: 'number', label: 'Flicker', min: 0, max: 2.5, step: 0.05 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['iron', 'glass', 'char', 'ember'],
    parts: ['frame', 'font', 'flame', 'handle'],
  },
  'tavern-sign': {
    title: 'Tavern Sign',
    description:
      'Wooden board hung by chain from a forged iron bracket. Pushed, it swings long and lazily.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'animated', 'interactive'],
    controls: {
      width: { type: 'number', label: 'Board width', min: 0.25, max: 1.1, step: 0.02, unit: 'm' },
      height: { type: 'number', label: 'Board height', min: 0.2, max: 0.8, step: 0.02, unit: 'm' },
      reach: { type: 'number', label: 'Bracket reach', min: 0.3, max: 1.2, step: 0.02, unit: 'm' },
      drop: { type: 'number', label: 'Chain drop', min: 0.04, max: 0.35, step: 0.01, unit: 'm' },
      plankCount: { type: 'number', label: 'Board count', min: 1, max: 6, step: 1 },
      damping: { type: 'number', label: 'Damping', min: 0.05, max: 2, step: 0.05 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron'],
    parts: ['post', 'bracket', 'board'],
  },
  'leather-book': {
    title: 'Leather Book',
    description:
      'Leather-bound manuscript with spine bands and clasps. The page block overhangs the cover, wavy.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'tabletop', 'procedural'],
    controls: {
      width: { type: 'number', label: 'Width', min: 0.08, max: 0.4, step: 0.005, unit: 'm' },
      length: { type: 'number', label: 'Length', min: 0.1, max: 0.55, step: 0.005, unit: 'm' },
      thickness: { type: 'number', label: 'Thickness', min: 0.02, max: 0.16, step: 0.002, unit: 'm' },
      bands: { type: 'number', label: 'Spine bands', min: 0, max: 6, step: 1 },
      clasps: { type: 'number', label: 'Clasps', min: 0, max: 3, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['leather', 'cloth', 'brass'],
    parts: ['cover', 'pages', 'clasps'],
  },
  'glass-phial': {
    title: 'Glass Phial',
    description:
      'Blown glass phial with a cork stopper, sealed with wax. Liquid level is computed from the fill.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'alchemy', 'tabletop'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.06, max: 0.32, step: 0.005, unit: 'm' },
      radius: { type: 'number', label: 'Body radius', min: 0.015, max: 0.08, step: 0.002, unit: 'm' },
      neck: { type: 'number', label: 'Neck ratio', min: 0.15, max: 0.55, step: 0.01 },
      fill: { type: 'number', label: 'Fill', min: 0, max: 1, step: 0.02 },
      hue: { type: 'number', label: 'Liquid hue', min: 0, max: 1, step: 0.01 },
      seal: { type: 'number', label: 'Wax seal', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['glass', 'ember', 'oak', 'char'],
    parts: ['bottle', 'liquid', 'stopper'],
  },
  'coin-pouch': {
    title: 'Coin Pouch',
    description:
      'Drawstring leather pouch with silver pennies spilled to one side out of its mouth.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'tabletop', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.05, max: 0.24, step: 0.005, unit: 'm' },
      radius: { type: 'number', label: 'Radius', min: 0.02, max: 0.1, step: 0.002, unit: 'm' },
      fill: { type: 'number', label: 'Fill', min: 0.15, max: 1, step: 0.02 },
      coins: { type: 'number', label: 'Spilled coins', min: 0, max: 30, step: 1 },
      coinRadius: { type: 'number', label: 'Coin radius', min: 0.005, max: 0.025, step: 0.001, unit: 'm' },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['leather', 'cloth', 'brass'],
    parts: ['pouch', 'cord', 'coins'],
  },
  'wicker-basket': {
    title: 'Wicker Basket',
    description:
      'Basket woven from willow rods. Horizontal rods pass in front of one upright, behind the next.',
    category: 'Props',
    tags: ['medieval', 'lowpoly', 'props', 'farm', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.1, max: 0.5, step: 0.01, unit: 'm' },
      radius: { type: 'number', label: 'Rim radius', min: 0.08, max: 0.35, step: 0.005, unit: 'm' },
      taper: { type: 'number', label: 'Base taper', min: 0, max: 0.45, step: 0.01 },
      stakes: { type: 'number', label: 'Upright rods', min: 6, max: 18, step: 1 },
      rows: { type: 'number', label: 'Weave rows', min: 2, max: 14, step: 1 },
      produce: { type: 'number', label: 'Produce count', min: 0, max: 24, step: 1 },
      hue: { type: 'number', label: 'Produce hue', min: 0, max: 1, step: 0.01 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'produce'],
    parts: ['weave', 'rim', 'contents'],
  },
  'wooden-ladder': {
    title: 'Wooden Ladder',
    description:
      'Two rails converging toward the top, with rungs let into them.',
    category: 'Structure',
    tags: ['medieval', 'lowpoly', 'structure', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 1, max: 5, step: 0.1, unit: 'm' },
      width: { type: 'number', label: 'Width', min: 0.25, max: 0.8, step: 0.01, unit: 'm' },
      rungCount: { type: 'number', label: 'Rungs', min: 3, max: 18, step: 1 },
      taper: { type: 'number', label: 'Taper', min: 0, max: 0.4, step: 0.01 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['rails', 'rungs'],
  },
  'wooden-fence': {
    title: 'Wooden Fence',
    description:
      'Mortised riven fence: the rail runs through the post and projects from the far face at the ends.',
    category: 'Structure',
    tags: ['medieval', 'lowpoly', 'structure', 'farm', 'procedural'],
    controls: {
      sections: { type: 'number', label: 'Sections', min: 1, max: 5, step: 1 },
      sectionLength: { type: 'number', label: 'Section length', min: 1.6, max: 3.4, step: 0.05, unit: 'm' },
      height: { type: 'number', label: 'Height', min: 0.8, max: 1.7, step: 0.02, unit: 'm' },
      railCount: { type: 'number', label: 'Rails', min: 1, max: 4, step: 1 },
      rough: { type: 'number', label: 'Irregularity', min: 0, max: 2, step: 0.05 },
      brace: { type: 'number', label: 'Brace', min: 0, max: 1, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak'],
    parts: ['posts', 'rails'],
  },
  'wooden-hoe': {
    title: 'Wooden Hoe',
    description:
      'Gooseneck field hoe: a curved forged neck carrying the blade ahead of the shaft axis, dished blade.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'farm', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Shaft length', min: 0.8, max: 1.7, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Shaft thickness',
        min: 0.012, max: 0.035, step: 0.001, unit: 'm',
      },
      bladeWidth: {
        type: 'number', label: 'Blade width',
        min: 0.1, max: 0.3, step: 0.005, unit: 'm',
      },
      neckSweep: { type: 'number', label: 'Neck sweep', min: 40, max: 150, step: 2, unit: '°' },
      dish: { type: 'number', label: 'Dish', min: 0, max: 2, step: 0.05 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron', 'steel'],
    parts: ['shaft', 'socket', 'blade'],
  },
  'wooden-shovel': {
    title: 'Wooden Shovel',
    description:
      'A single-piece dished steel plate that both widens and thins toward the tip.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'farm', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Length', min: 0.8, max: 1.8, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Shaft thickness',
        min: 0.014, max: 0.035, step: 0.001, unit: 'm',
      },
      bladeWidth: {
        type: 'number', label: 'Blade width',
        min: 0.12, max: 0.34, step: 0.005, unit: 'm',
      },
      bladeLength: { type: 'number', label: 'Blade length', min: 0.18, max: 0.4, step: 0.01 },
      dish: { type: 'number', label: 'Scoop depth', min: 0, max: 0.28, step: 0.01 },
      bladeAngle: { type: 'number', label: 'Blade angle', min: 0, max: 25, step: 1, unit: 'degrees' },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron', 'steel'],
    parts: ['shaft', 'socket', 'blade'],
  },
  'wooden-pitchfork': {
    title: 'Wooden Pitchfork',
    description:
      'Steel tines splaying outward; the gap in the silhouette makes it readable from a distance.',
    category: 'Tools',
    tags: ['medieval', 'lowpoly', 'tools', 'farm', 'procedural'],
    controls: {
      length: { type: 'number', label: 'Length', min: 1, max: 2.4, step: 0.02, unit: 'm' },
      shaftRadius: {
        type: 'number', label: 'Shaft thickness',
        min: 0.012, max: 0.035, step: 0.001, unit: 'm',
      },
      tineCount: { type: 'number', label: 'Tine count', min: 2, max: 6, step: 1 },
      spread: { type: 'number', label: 'Tine spread', min: 0, max: 0.4, step: 0.01 },
      tineLength: { type: 'number', label: 'Tine length', min: 0.1, max: 0.32, step: 0.01 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['oak', 'iron', 'steel'],
    parts: ['shaft', 'socket', 'tines'],
  },
}
