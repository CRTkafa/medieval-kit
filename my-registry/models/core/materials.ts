import { Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three'

import type { ResourceScope } from '@vibe3d/ownership.ts'

/**
 * The kit's shared material set.
 *
 * The critical choice: every material is `vertexColors: true`. Colour
 * variation is carried in the GEOMETRY, not in the material. That way 13
 * boards can have 13 separate tones while all of them share a single
 * material, and therefore a single draw call.
 *
 * This is the small version of the idea behind scifi-kit's wear pipeline:
 * write the surface identity into a vertex attribute, then merge.
 */
export type MedievalSlot =
  | 'oak'      // timber
  | 'iron'     // wrought iron
  | 'steel'    // steel burnished by use
  | 'brass'    // bronze and copper: bells, coins
  | 'straw'    // straw, wicker, besom bristles
  | 'cloth'    // linen, sackcloth, parchment
  | 'leather'  // leather: book covers, pouches
  | 'glass'    // blown glass
  | 'produce'  // fruit and vegetable skin
  | 'ember'    // flame — does not take light, it emits it
  | 'char'     // charcoal, pitch
  | 'stone'    // dressed and rubble masonry

/**
 * The material TYPE can differ per slot. `ember` is an unlit MeshBasicMaterial;
 * the rest are PBR. Thanks to this mapping the model code knows at compile
 * time which type it is getting.
 */
export interface SlotMaterial {
  readonly oak: MeshStandardMaterial
  readonly iron: MeshStandardMaterial
  readonly steel: MeshStandardMaterial
  readonly brass: MeshStandardMaterial
  readonly straw: MeshStandardMaterial
  readonly cloth: MeshStandardMaterial
  readonly leather: MeshStandardMaterial
  readonly glass: MeshStandardMaterial
  readonly produce: MeshStandardMaterial
  readonly ember: MeshBasicMaterial
  readonly char: MeshStandardMaterial
  readonly stone: MeshStandardMaterial
}

export interface MedievalPalette {
  /** Oak body tone. */
  readonly oak: Color
  /** Lid board — a little cooler and lighter than the body (end grain). */
  readonly oakEnd: Color
  /** Wrought iron: fresh off the anvil, the oxide layer still on it. */
  readonly iron: Color
  /** Steel burnished by use: the anvil's face, the shovel's blade, the fork's tines. */
  readonly steel: Color
  /** Bronze — bells, mortars, coins. */
  readonly brass: Color
  /**
   * Bell bronze that has stood outside.
   *
   * Separate from `brass` because they are not the same colour and the models
   * that use each are not the same models. Fresh bronze on a coin or a book's
   * corner boss is the yellow `brass` is; a bell that has hung in weather for a
   * century is dark and grey. Measured against a reference photograph the bell
   * sits at hue 33, saturation 0.34, value 0.33, against 39 / 0.56 / 0.56 for
   * the brass we were painting it with.
   *
   * This is a PALETTE entry, not a slot: the mesh still resolves through the
   * `brass` material. The palette carries colour, the slot carries material,
   * and keeping them separate is what lets one model recolour without dragging
   * the coin pouch and the book's fittings along with it.
   */
  readonly bronze: Color
  /** Dry straw. */
  readonly straw: Color
  /** Straw tips bleached by the sun. */
  readonly strawPale: Color
  /** Raw linen / sackcloth. */
  readonly cloth: Color
  /** Tanned leather. */
  readonly leather: Color
  /** Blown glass — slightly greenish, glass of the period was not clear. */
  readonly glass: Color
  /** Base tone of fruit skin. The actual colour comes from the model's `hue` field. */
  readonly produce: Color
  /** Base of the flame — hot and bright. */
  readonly ember: Color
  /** Tip of the flame — more saturated, more red. */
  readonly emberTip: Color
  /** Burnt-out charcoal. */
  readonly char: Color
  /** Charcoal that is still glowing. */
  readonly charHot: Color
  /**
   * Masonry.
   *
   * The kit had no stone at all, which for a medieval catalogue is a hole
   * rather than an omission: a well, a trough, a millstone, a boundary wall
   * and a hearth are all stone before they are anything else. Its colour is
   * close to weathered oak on purpose -- what separates the two at a glance is
   * not hue but that stone scatters light completely flat, which is carried by
   * the material's roughness rather than by the palette.
   */
  readonly stone: Color
}

/**
 * The colours are written as sRGB; with ColorManagement enabled three stores
 * them internally in linear space. Since the vertex colour attribute expects
 * linear values, `color.r/g/b` can be written straight through — no extra
 * conversion needed.
 */
/**
 * Base colours, measured against reference photographs rather than chosen.
 *
 * The hue was already right -- our oak sits at 26 degrees and real oak in a
 * photograph sits at 27 -- but the saturation was consistently too high, by a
 * median of 0.08 across ten wooden models, and worst on the ones made almost
 * entirely of bare timber: the ladder and the fence were each 0.16 over. That
 * is the difference between weathered oak and new pine, and it was making the
 * whole kit read as plastic.
 *
 * Straw and linen are deliberately NOT adjusted, although the same measurement
 * said they were too yellow and too washed out. Following it made them visibly
 * worse. A photograph of a bale reads as desaturated because it is thousands of
 * individual straws each casting a shadow on its neighbour; pushing a flat
 * lowpoly surface up to that number does not reproduce the texture, it just
 * makes the surface garish. The statistic was real and the inference from it
 * was wrong -- which is worth leaving written down, because the same trap is
 * there for any material whose reference gets its character from fine detail.
 *
 * Two follow-up measurements ruled out the other colour explanations: our
 * saturation spread is 93% of the references', so it is not a lack of
 * variation, and the hue was never off. What remains between these models and
 * their references is geometry, not colour.
 */
export const MEDIEVAL_PALETTE: MedievalPalette = {
  oak: new Color(0x8a6141),
  oakEnd: new Color(0x9a7a5e),
  iron: new Color(0x40464d),
  steel: new Color(0x8d979f),
  brass: new Color(0xa9843f),
  bronze: new Color(0x63523e),
  straw: new Color(0xc2a049),
  strawPale: new Color(0xdcc182),
  cloth: new Color(0xb9a888),
  leather: new Color(0x6b452c),
  glass: new Color(0xbcd4cb),
  produce: new Color(0xa8452f),
  ember: new Color(0xffd27a),
  emberTip: new Color(0xd8571b),
  char: new Color(0x241f1c),
  stone: new Color(0x6e6b63),
  charHot: new Color(0xc4441a),
}

/**
 * Creates materials for the requested slots.
 *
 * The slot list is required on purpose: the brazier does not need oak, the
 * barrel does not need an emissive material. Creating unused materials is both
 * a wasted GPU resource and a lie that contradicts the model's `materialSlots`
 * declaration.
 *
 * The return type is narrowed to the requested slots, so `materials.ember`
 * only compiles in a model that asked for it.
 */
export function createMedievalMaterials<S extends MedievalSlot>(
  scope: ResourceScope,
  slots: readonly S[],
): Pick<SlotMaterial, S> {
  const build: { [K in MedievalSlot]: () => SlotMaterial[K] } = {
    oak: () => new MeshStandardMaterial({
      name: 'medieval-kit / oak',
      // White base: all colour information comes from the vertex colour, so
      // the material must not multiply it away.
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
    }),
    // Iron occurs in two states and they cannot be told with ONE material.
    // The anvil's body is forged, oxidised, matte; its face is like a mirror
    // because it has been worked on for years. The difference between them is
    // not one of colour but of ROUGHNESS — vertex colour cannot carry that,
    // because roughness is not an attribute.
    //
    // Hence two slots: `iron` is the forged surface, `steel` is the surface
    // the work has touched. It is normal for a model to want both; it is worth
    // a separate draw call, because a bright cutting edge sells the model on
    // its own.
    iron: () => new MeshStandardMaterial({
      name: 'medieval-kit / wrought iron',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.78,
    }),
    steel: () => new MeshStandardMaterial({
      name: 'medieval-kit / burnished steel',
      color: 0xffffff,
      vertexColors: true,
      // Low roughness + high metalness, i.e. almost fully reflective. This
      // only works if there is an environment map; in a scene without an
      // environment it looks pitch black. The viewer supplies a PMREM sky.
      roughness: 0.19,
      metalness: 0.95,
    }),
    brass: () => new MeshStandardMaterial({
      name: 'medieval-kit / bronze',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.85,
    }),
    // Straw and cloth are fully matte: metalness 0, roughness almost 1. The
    // difference between them is not in the numbers but in the vertex colours
    // — both follow the same lighting model, but keeping them in separate
    // slots matters, because a model's `materialSlots` declaration is a
    // CONTRACT: a straw bale declaring an "oak" slot would be a lie told to
    // the consumer.
    straw: () => new MeshStandardMaterial({
      name: 'medieval-kit / straw',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
    }),
    cloth: () => new MeshStandardMaterial({
      name: 'medieval-kit / linen',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.97,
      metalness: 0,
    }),
    leather: () => new MeshStandardMaterial({
      name: 'medieval-kit / leather',
      color: 0xffffff,
      vertexColors: true,
      // Leather is not fully matte; being oiled, it has a slight sheen.
      roughness: 0.66,
      metalness: 0,
    }),
    // Glass is a thin SHELL, not a solid block. That has two consequences:
    // `side` has to be DoubleSide (otherwise it disappears when seen from
    // inside) and `depthWrite` has to be off (otherwise it hides the wick
    // behind it).
    glass: () => new MeshStandardMaterial({
      name: 'medieval-kit / blown glass',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: DoubleSide,
    }),
    // Fruit skin is waxy: not fully matte, but not metallic either. The reason
    // it is a separate slot is not the name but the BEHAVIOUR — had I given it
    // the same roughness as straw, an apple would look like dry hay.
    produce: () => new MeshStandardMaterial({
      name: 'medieval-kit / produce',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.52,
      metalness: 0,
    }),
    // A flame does not TAKE light, it emits it. MeshStandardMaterial would be
    // the wrong tool here: `emissive` is a single Color, it is not fed from
    // vertex colours — so no colour gradient from the flame's base to its tip
    // is possible. MeshBasicMaterial skips lighting entirely and shows the
    // vertex colour as it is; toneMapped is off so the scene exposure cannot
    // put the flame out.
    ember: () => new MeshBasicMaterial({
      name: 'medieval-kit / ember',
      color: 0xffffff,
      vertexColors: true,
      toneMapped: false,
    }),
    stone: () => new MeshStandardMaterial({
      name: 'medieval-kit / stone',
      color: 0xffffff,
      vertexColors: true,
      // Rougher than anything else here. Dressed stone is not polished and
      // rubble certainly is not; any sheen at all reads as ceramic.
      roughness: 0.97,
      metalness: 0,
    }),
    char: () => new MeshStandardMaterial({
      name: 'medieval-kit / charcoal',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    }),
  }

  const materials = {} as { [K in S]: SlotMaterial[K] }
  for (const slot of slots) {
    // TypeScript cannot follow correlated unions: `build[slot]` widens to a
    // union of functions, so it cannot know that the return is exactly
    // SlotMaterial[slot]. The cast is safe because the mapping is built by
    // hand above.
    materials[slot] = scope.ownMaterial(build[slot]()) as SlotMaterial[S]
  }
  return materials
}
