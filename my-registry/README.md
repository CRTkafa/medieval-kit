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

| Address | Triangles | Size | Notes |
| --- | --- | --- | --- |
| `@medieval-kit/wooden-barrel` | 806 | 0.82 × 1.05 × 0.81 m | 13 separate staves, iron hoops, recessed heads |
| `@medieval-kit/wooden-crate` | 360 | 0.67 × 0.52 × 0.53 m | Plank rows on corner posts, forged straps |
| `@medieval-kit/iron-brazier` | 423 | 0.53 × 0.90 × 0.53 m | Animated flame, glowing coals, carries its own light |

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
- **`actions`** and **`update(delta)`** carry interactive state. `iron-brazier`
  uses both:

```ts
const brazier = createModel()
brazier.actions.setLit(false)
brazier.update(deltaSeconds)   // flame flicker and light modulation
```

Reach for `configure()` when a user changes a setting; it rebuilds topology and
is not cheap. Anything that changes per frame belongs in `update()`.

## Material slots

| Slot | Used by | Type |
| --- | --- | --- |
| `oak` | barrel, crate | `MeshStandardMaterial`, vertex-coloured |
| `iron` | barrel, crate, brazier | `MeshStandardMaterial`, vertex-coloured |
| `char` | brazier | `MeshStandardMaterial`, vertex-coloured |
| `ember` | brazier | `MeshBasicMaterial`, unlit and not tone-mapped |

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

Released under the MIT License.
