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
  // One entry per model, added as each model is built. The registry build
  // fails on a model with no entry here, which is deliberate: an item nobody
  // described is an item nobody can find.
  'ceramic-vase': {
    title: 'Ceramic Vase',
    description:
      'Glazed ceramic vase turned as a single revolve. The belly height decides '
      + 'whether it reads as a bud vase or an urn, and the lip stands proud of the '
      + 'neck so the mouth has an edge rather than being a hole in the top.',
    category: 'Decor',
    tags: ['contemporary', 'decor', 'vessel', 'procedural'],
    controls: {
      height: { type: 'number', label: 'Height', min: 0.12, max: 0.9, step: 0.01, unit: 'm' },
      bellyRadius: { type: 'number', label: 'Belly radius', min: 0.03, max: 0.3, step: 0.005, unit: 'm' },
      bellyAt: { type: 'number', label: 'Belly height', min: 0.18, max: 0.72, step: 0.01 },
      mouth: { type: 'number', label: 'Mouth', min: 0.2, max: 0.9, step: 0.01 },
      segments: { type: 'number', label: 'Sides', min: 8, max: 64, step: 1 },
      seed: { type: 'number', label: 'Variation seed', min: 1, max: 64, step: 1 },
    },
    materialSlots: ['ceramic'],
    parts: ['body'],
  },
}
