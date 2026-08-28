/**
 * The kit's material slots, and the palette behind them.
 *
 * A slot exists when a single material cannot carry a difference that a viewer
 * can see. That test is stricter than it sounds, and it is what keeps this list
 * at nineteen rather than fifty: two objects that differ only in COLOUR share a
 * slot, because colour travels in the vertex attribute. A slot is earned by
 * roughness, by metalness, by transparency, or by not receiving light at all.
 *
 * Every slot below is argued from at least three objects in the catalogue. If a
 * slot ever ends up with one consumer, it was a colour and it should be folded
 * back into whatever it was split from.
 *
 * Inherited from the medieval kit: `wood`, `steelPainted` (was `iron`),
 * `fabric` (was `cloth`), `ceramic` (was `clay`), `brass`, and `cord`, which
 * narrows from rope to nylon and PVC. Dropped: leather, thatch, bone, gold and
 * wax, none of which has a consumer across 250 present-day objects.
 */
import {
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  DoubleSide,
} from 'three'

import type { ResourceScope } from '@vibe3d/ownership.ts'

export type PropSlot =
  | 'wood'
  | 'steelPainted'
  | 'galvanised'
  | 'stainless'
  | 'chrome'
  | 'aluminium'
  | 'brass'
  | 'plastic'
  | 'plasticGloss'
  | 'rubber'
  | 'concrete'
  | 'ceramic'
  | 'glass'
  | 'glassTinted'
  | 'fabric'
  | 'cord'
  | 'paper'
  | 'emissive'
  | 'retroreflective'

export interface SlotMaterial {
  readonly wood: MeshStandardMaterial
  readonly steelPainted: MeshStandardMaterial
  readonly galvanised: MeshStandardMaterial
  readonly stainless: MeshStandardMaterial
  readonly chrome: MeshStandardMaterial
  readonly aluminium: MeshStandardMaterial
  readonly brass: MeshStandardMaterial
  readonly plastic: MeshStandardMaterial
  readonly plasticGloss: MeshStandardMaterial
  readonly rubber: MeshStandardMaterial
  readonly concrete: MeshStandardMaterial
  readonly ceramic: MeshStandardMaterial
  readonly glass: MeshStandardMaterial
  readonly glassTinted: MeshStandardMaterial
  readonly fabric: MeshStandardMaterial
  readonly cord: MeshStandardMaterial
  readonly paper: MeshStandardMaterial
  readonly emissive: MeshBasicMaterial
  readonly retroreflective: MeshStandardMaterial
}

export interface PropPalette {
  /** Pale contemporary timber: beech, birch ply, light oak veneer. */
  readonly wood: Color
  /** Cut ends and edge banding, lighter and cooler than the face. */
  readonly woodEnd: Color
  /** Powder-coated steel: lockers, shelving, barriers, tool bodies. */
  readonly steelPainted: Color
  /** Hot-dip zinc, cooler and lighter than paint, with a spangle. */
  readonly galvanised: Color
  /** Brushed stainless: sinks, pans, appliance fronts. */
  readonly stainless: Color
  /** Polished chrome, near white because it is mostly reflecting the room. */
  readonly chrome: Color
  /** Brushed aluminium extrusion, cooler and darker than chrome. */
  readonly aluminium: Color
  /** Brass and copper trim: valves, instrument bells, fittings. */
  readonly brass: Color
  /** Matte injection-moulded plastic, the most common surface in the kit. */
  readonly plastic: Color
  /** Gloss plastic: kettles, toasters, appliance fascias. */
  readonly plasticGloss: Color
  /** Rubber and soft PVC: tyres, grips, seals, cable jacket. */
  readonly rubber: Color
  /** Cast concrete with an aggregate speckle. */
  readonly concrete: Color
  /** Glazed ceramic: basins, mugs, vases. */
  readonly ceramic: Color
  /** Clear glass. Thin, so it reads by its edges rather than its face. */
  readonly glass: Color
  /** Tinted glass: side panels, screens, cooler doors. */
  readonly glassTinted: Color
  /** Upholstery and woven panel infill. */
  readonly fabric: Color
  /** Nylon and PVC cord: blind ladders, pull cords, hose. */
  readonly cord: Color
  /** Paper stock: near white, no specular at all. */
  readonly paper: Color
  /** Default emitter colour. Models override it per object. */
  readonly emissive: Color
  /** High-visibility retroreflective sheeting. */
  readonly retroreflective: Color
}

export const PROP_PALETTE: PropPalette = {
  wood: new Color(0xbfa079),
  woodEnd: new Color(0xd0b795),
  steelPainted: new Color(0x767c82),
  galvanised: new Color(0xa9b0b5),
  stainless: new Color(0xb4b8bb),
  chrome: new Color(0xd6dade),
  aluminium: new Color(0xa4a9ae),
  brass: new Color(0xb08d57),
  plastic: new Color(0xc6c8c6),
  plasticGloss: new Color(0xe6e8e9),
  rubber: new Color(0x2e3134),
  concrete: new Color(0x9a9691),
  ceramic: new Color(0xf0efea),
  glass: new Color(0xb9cbd2),
  glassTinted: new Color(0x3a4750),
  fabric: new Color(0x6c6f73),
  cord: new Color(0xd6d3cc),
  paper: new Color(0xf2f0ea),
  emissive: new Color(0xffd9a0),
  retroreflective: new Color(0xf4562a),
}

export function createPropMaterials<S extends PropSlot>(
  scope: ResourceScope,
  slots: readonly S[],
): Pick<SlotMaterial, S> {
  const build: { [K in PropSlot]: () => SlotMaterial[K] } = {
    // White base on every lit material: all colour comes from the vertex
    // attribute, so the material must not multiply it away.
    wood: () => new MeshStandardMaterial({
      name: 'contemporary-props / wood',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.74,
      metalness: 0,
    }),

    /*
     * The four metals, and why one slot will not do.
     *
     * They differ in ROUGHNESS and in how much of the room they return, and
     * neither of those is something a vertex colour can carry. Put a sink and
     * a locker on one slot and the kitchen goes flat: the sink stops looking
     * wet and the locker starts looking wet.
     */
    steelPainted: () => new MeshStandardMaterial({
      name: 'contemporary-props / painted steel',
      color: 0xffffff,
      vertexColors: true,
      // Powder coat is a thick even film. It is matte, but not as matte as
      // plastic, and that small gap is what separates a locker from a bin.
      roughness: 0.62,
      metalness: 0.15,
    }),
    galvanised: () => new MeshStandardMaterial({
      name: 'contemporary-props / galvanised steel',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.65,
    }),
    stainless: () => new MeshStandardMaterial({
      name: 'contemporary-props / stainless steel',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.28,
      metalness: 0.92,
    }),
    chrome: () => new MeshStandardMaterial({
      name: 'contemporary-props / polished chrome',
      color: 0xffffff,
      vertexColors: true,
      // Distinct from stainless by reflection, not by colour. A tap next to a
      // sink is the test: if they share a slot, the tap disappears into it.
      roughness: 0.06,
      metalness: 1,
    }),
    aluminium: () => new MeshStandardMaterial({
      name: 'contemporary-props / brushed aluminium',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.85,
    }),
    brass: () => new MeshStandardMaterial({
      name: 'contemporary-props / brass',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.88,
    }),

    /*
     * Matte and gloss plastic are two slots for one substance, and it is the
     * only split here justified by a highlight alone. A kettle and a waste bin
     * can be the same colour and the same shape family; what says which is
     * which is whether the light comes back off it in a hard spot.
     */
    plastic: () => new MeshStandardMaterial({
      name: 'contemporary-props / matte plastic',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.78,
      metalness: 0,
    }),
    plasticGloss: () => new MeshStandardMaterial({
      name: 'contemporary-props / gloss plastic',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.18,
      metalness: 0,
    }),
    rubber: () => new MeshStandardMaterial({
      name: 'contemporary-props / rubber',
      color: 0xffffff,
      vertexColors: true,
      // Almost no specular at all. This is what makes a castor read as a
      // castor rather than as a small dark wheel.
      roughness: 0.92,
      metalness: 0,
    }),
    concrete: () => new MeshStandardMaterial({
      name: 'contemporary-props / concrete',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    }),
    ceramic: () => new MeshStandardMaterial({
      name: 'contemporary-props / glazed ceramic',
      color: 0xffffff,
      vertexColors: true,
      // Glaze is a glass layer over a matte body, so it is smooth without
      // being metal. Sharing gloss plastic here makes a basin look moulded.
      roughness: 0.14,
      metalness: 0.04,
    }),

    /*
     * Two glasses, because the parameter that separates them is transmission
     * and not colour. Reusing clear glass with a darker vertex colour loses
     * the surface: a tinted panel still has a bright edge and a visible sheen,
     * and a darkened clear panel has neither.
     */
    glass: () => new MeshStandardMaterial({
      name: 'contemporary-props / clear glass',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.24,
      // A pane is seen from both faces at once and it must not cull one away,
      // and it must not hide what is behind it in the depth buffer.
      side: DoubleSide,
      depthWrite: false,
    }),
    glassTinted: () => new MeshStandardMaterial({
      name: 'contemporary-props / tinted glass',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.62,
      side: DoubleSide,
      depthWrite: false,
    }),

    fabric: () => new MeshStandardMaterial({
      name: 'contemporary-props / fabric',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    }),
    cord: () => new MeshStandardMaterial({
      name: 'contemporary-props / cord',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.68,
      metalness: 0,
    }),
    paper: () => new MeshStandardMaterial({
      name: 'contemporary-props / paper',
      color: 0xffffff,
      vertexColors: true,
      // Zero specular. Paper rendered with any highlight at all reads as
      // plastic sheet, which is the single most common way a stack of forms
      // or a till roll goes wrong.
      roughness: 1,
      metalness: 0,
    }),

    /**
     * Unlit. The vertex colour IS the result, so nothing may darken it.
     *
     * The medieval kit had firelight; this kit has switchable emitters with a
     * colour parameter, which is a different thing: a traffic aspect, a status
     * lamp, a screen in its on state, a bulb. Anything in this slot is skipped
     * by the occlusion and mottle passes, because shading an emitter is the
     * same as switching it off.
     */
    emissive: () => new MeshBasicMaterial({
      name: 'contemporary-props / emissive',
      color: 0xffffff,
      vertexColors: true,
    }),

    /**
     * Retroreflective sheeting: cone collars, barricade stripes, sign plates.
     *
     * Arguably a treatment rather than a material. It gets its own slot because
     * it must not tone-map like paint: the whole point of the surface is that
     * it returns light toward wherever the light came from, so it stays bright
     * when everything around it has gone dark. Modelled here as a very smooth,
     * very bright dielectric, which is the closest a standard material gets
     * without a custom shader.
     */
    retroreflective: () => new MeshStandardMaterial({
      name: 'contemporary-props / retroreflective',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.32,
      metalness: 0,
    }),
  }

  const materials = {} as { [K in S]: SlotMaterial[K] }
  for (const slot of slots) {
    // TypeScript cannot follow correlated unions: `build[slot]` widens to a
    // union of functions, so it cannot know the return is exactly
    // SlotMaterial[slot]. The cast is safe because the map is built by hand.
    materials[slot] = scope.ownMaterial(build[slot]()) as SlotMaterial[S]
  }
  return materials
}
