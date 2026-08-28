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
