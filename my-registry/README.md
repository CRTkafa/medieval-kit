# Medieval Kit

A lowpoly medieval model library for [Vibe3D](https://github.com/vibe-stack/vibe3d)
and Three.js. Install a prop and you own its source: readable TypeScript in your
own tree, not an opaque package boundary.

```sh
bunx vibe3d add @medieval-kit/wooden-barrel
bunx vibe3d add @medieval-kit
```

Configure `models.json` first so the namespace resolves:

```json
{
  "registries": {
    "@medieval-kit": {
      "source": "npm:@medieval-kit/registry",
      "version": "latest"
    }
  }
}
```

## Models

27 models and one shared lib. Addresses are `@medieval-kit/<id>`. This table is
generated from the models themselves with `bun scripts/catalog-table.ts` — a
hand-written list goes stale on the first model you add, and this one already
did once.

| Model | Category | Triangles | Size (m) | Material slots | Actions |
| --- | --- | ---: | --- | --- | :-: |
| `wooden-chest` | Furniture | 552 | 0.86×0.51×0.48 | oak, iron | ✔ |
| `wooden-barrel` | Props | 806 | 0.82×1.05×0.81 | oak, iron |  |
| `wooden-crate` | Props | 1320 | 0.69×0.52×0.55 | oak, iron |  |
| `wooden-bucket` | Props | 439 | 0.31×0.46×0.30 | oak, iron |  |
| `trestle-table` | Furniture | 660 | 1.91×0.74×0.79 | oak |  |
| `wooden-bench` | Furniture | 168 | 1.62×0.48×0.30 | oak |  |
| `wooden-stool` | Furniture | 180 | 0.38×0.43×0.36 | oak |  |
| `pitch-torch` | Lighting | 239 | 0.10×0.77×0.11 | oak, char, ember | ✔ |
| `iron-lantern` | Lighting | 440 | 0.15×0.29×0.17 | iron, glass, char, ember | ✔ |
| `iron-anvil` | Smithy | 220 | 0.48×0.36×0.21 | iron, steel |  |
| `cart-wheel` | Structure | 1056 | 0.99×1.04×0.19 | oak, iron |  |
| `log-pile` | Props | 504 | 1.25×0.43×0.18 | oak |  |
| `hay-bale` | Props | 674 | 1.09×0.46×0.46 | straw, cloth |  |
| `linen-sack` | Props | 300 | 0.32×0.53×0.32 | cloth |  |
| `oak-tankard` | Props | 366 | 0.09×0.17×0.10 | oak, iron |  |
| `straw-broom` | Tools | 880 | 0.20×1.22×0.19 | oak, straw, cloth |  |
| `bronze-bell` | Props | 696 | 0.48×0.53×0.36 | brass, iron, oak | ✔ |
| `tavern-sign` | Props | 516 | 0.54×0.75×0.63 | oak, iron | ✔ |
| `wicker-basket` | Props | 1906 | 0.35×0.24×0.35 | straw, produce |  |
| `leather-book` | Props | 248 | 0.20×0.07×0.28 | leather, cloth, brass |  |
| `glass-phial` | Props | 321 | 0.06×0.14×0.06 | glass, ember, oak, char |  |
| `coin-pouch` | Props | 546 | 0.18×0.11×0.19 | leather, cloth, brass |  |
| `wooden-ladder` | Structure | 440 | 0.49×2.20×0.06 | oak |  |
| `wooden-fence` | Structure | 860 | 5.18×1.31×0.31 | oak |  |
| `wooden-hoe` | Tools | 282 | 0.20×1.23×0.30 | oak, iron, steel |  |
| `wooden-shovel` | Tools | 468 | 0.27×1.20×0.08 | oak, iron, steel |  |
| `wooden-pitchfork` | Tools | 338 | 0.25×1.56×0.11 | oak, iron, steel |  |

**15 425 triangles** in total. The whole kit in one scene costs less than a
single mid-complexity character model.

Every model depends on `@medieval-kit/core`, a shared support item holding the
palette, deterministic randomness, and the geometry vocabulary. Pulling a single
prop brings it along, so an individually installed crate still looks like it
came from the same catalogue as the barrel beside it.

## Plain WebGL

This kit does **not** require WebGPU. It declares `capabilities: []` and builds
on `MeshStandardMaterial` and `MeshBasicMaterial`, so it renders on
`WebGLRenderer` as well as `WebGPURenderer`.

## Configuration

Models are procedural, not baked. Every prop exposes typed fields:

```ts
import { createModel } from '@/models/medieval-kit/wooden-barrel/model.ts'

const barrel = createModel({ staveCount: 17, taper: 0.22, seed: 42 })
scene.add(barrel.root)

barrel.configure({ hoopCount: 6 })   // rebuilds geometry inside a stable root
barrel.dispose()
```

`seed` is a real field, not a debug knob. Variation is deterministic: the same
seed always produces the same prop, so previews, tests, and art direction stay
reproducible. Change the seed to get a different barrel from the same model.

## Runtime anatomy

Each model follows the Vibe3D protocol:

- **`root`** keeps its object identity for the model's whole lifetime.
- **`parts`** expose stable semantic anchors. Attach your own lights, labels, or
  gameplay objects to `part.anchor` — they survive `configure()`, because only
  `part.content` is rebuilt.
- **`materials`** resolve per slot and can be overridden. Materials you supply
  are borrowed: the model never disposes them.
- **`actions`** and **`update(delta)`** carry interactive state. Five models use
  both — `wooden-chest`, `pitch-torch`, `iron-lantern`, `bronze-bell` and
  `tavern-sign`:

```ts
const chest = createModel()
chest.actions.setOpen(true)
chest.update(deltaSeconds)   // the lid eases open, frame-rate independent

const torch = createModel()
torch.actions.setLit(false)
torch.update(deltaSeconds)   // flame flicker and light modulation
```

A model that never receives `update()` simply stands still; nothing animates
behind your back. Reach for `configure()` when a user changes a setting; it
rebuilds topology and is not cheap. Anything that changes per frame belongs in
`update()`.

## Material slots

Eleven slots, and each one exists because a single material could not carry the
difference.

| Slot | What it covers | Why it is separate |
| --- | --- | --- |
| `oak` | timber | — |
| `iron` | forged iron, oxidised and matte | separate from `steel`: the difference is not in colour but in ROUGHNESS, and vertex colour cannot carry roughness |
| `steel` | steel polished by use | the anvil face, the shovel blade, the pitchfork tines |
| `brass` | bronze and copper | the bell, the coins |
| `straw` | straw, wicker, broom bristle | a bale declaring itself "oak" would be a lie told to the consumer |
| `cloth` | linen, sackcloth, rope | — |
| `leather` | worked leather | — |
| `glass` | blown glass | transparent, `depthWrite` OFF, `DoubleSide` |
| `produce` | fruit and vegetable skin | given straw's roughness, an apple would look like dry grass |
| `ember` | flame | `MeshBasicMaterial` — it does not receive light, it emits |
| `char` | charcoal and pitch | — |

`ember` also acts as a rule in two places: bodies in that slot are skipped
entirely while ambient occlusion and mottle are baked. The reason is simple —
in an unlit material the vertex colour *is* the final colour, so darkening it
puts the flame out. The rule is attached to the slot itself rather than to a
per-model flag, so it cannot be forgotten.

Colour variation lives in the geometry, not in the materials: each of the
barrel's 13 staves carries its own tone as vertex colours, and all of them share
one material and therefore one draw call.

## Building from source

```sh
bun build.ts                                  # emit dist/registry.json
bunx vibe3d registry validate dist/registry.json
```

The build walks `models/`. A folder containing `model.ts` becomes a
`vibe3d:model`; any other folder becomes a `vibe3d:lib`. Registry dependencies
are derived from the source — an import from `../core/` makes
`@medieval-kit/core` a dependency automatically, so there is no hand-maintained
list to go stale.

`drafts/` is deliberately outside that walk: the code is kept in the tree but
never reaches the published package. See [`drafts/README.md`](drafts/README.md).

Released under the MIT License.
