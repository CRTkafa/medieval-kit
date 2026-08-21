# medieval-kit

A lowpoly medieval model library for [Vibe3D](https://github.com/vibe-stack/vibe3d),
plus the viewer used to build it.

Vibe3D is a source-first model registry for Three.js: you install the
TypeScript that *generates* a model into your own project rather than depending
on an opaque package. This repository holds one such registry.

- **[`my-registry/`](my-registry/)** — the `@medieval-kit` registry, published
  to npm as [`@medieval-kit/registry`](my-registry/README.md).
- **`src/`** — a demo app that installs from both `@medieval-kit` and the
  first-party `@scifi-kit`, so the two can be inspected side by side.

## Run the viewer

Requires [Bun](https://bun.sh) and a browser with WebGPU (the `@scifi-kit` model
in the demo uses TSL node materials; the medieval kit itself does not).

```sh
bun install
bun run registry:build
bun run dev
```

Open `/viewer.html` for the model inspector: registry-grouped catalogue, live
triangle counts, configuration sliders wired to `configure()`, a wireframe
overlay, and per-model GLB download.

## Use the kit in your own project

```sh
bunx vibe3d init
bunx vibe3d add @medieval-kit/wooden-barrel
```

See [`my-registry/README.md`](my-registry/README.md) for the model list,
configuration fields, and runtime contract.

## Export to GLB

```sh
bun run export:glb                       # every model into glb/
bun scripts/export-glb.ts --one wooden-chest
```

The viewer's download button and this command share one implementation
(`src/glb.ts`), so they produce byte-identical files. Colour travels as
`COLOR_0` vertex data and `baseColorFactor` stays white — the files carry no
textures at all.

## Verify

```sh
bun run typecheck
bun run verify        # geometry, protocol, metadata, actions
bun run verify:glb    # export every model, read it back, compare
bun run render        # renders/_sheet.png — actually look at the models
```

`verify` runs ~500 browser-free checks against the installed sources: geometry
validity, winding, coplanar-face (z-fighting) detection, bounding-box limits,
stable root and anchor identity across `configure()`, deterministic seeding,
material ownership, idempotent disposal, action semantics, and agreement
between each model and its published metadata.

Four of those deserve a note, because each was written after a real bug:

- **Winding** is checked three ways, because no single measure is sufficient.
  Bodies of revolution use radial alignment — every radial face on the outer
  shell must point away from the axis, measured in height bands. Closed solids
  use signed volume: `Σ a·(b×c)/6` is positive only when the winding faces
  outward. And edge balance catches a *single* flipped face, which signed volume
  misses — flipping one face took the volume from 0.058 to 0.039, still
  positive.
- **Z-fighting** is checked by looking for triangles that share a plane, share a
  normal direction, and overlap in area. Edge contact between neighbouring boards
  is fine and is not flagged; genuine coplanar overlap is.
- **Metadata agreement** verifies that every declared control key is a real
  config field, that declared part names match the model's actual parts, and —
  most importantly — that no mesh uses an *undeclared* material slot. A missing
  declaration is a material the consumer cannot reach through
  `materials.override()`. This check found real drift in four models the day it
  was added: a `steel` slot had been used but never declared.
- **Frame-rate independence** for animated models: the same elapsed time is
  stepped at two different frame rates and the results must agree. A naive lerp
  fails this.

Every check was mutation-tested: sabotage the code, confirm the check fails,
restore, confirm it passes. A passing test is not evidence that it works.

`render` closed the one gap all of the above left open. Every check was
*geometric* — triangle counts, winding, coplanarity, bounds. All of them caught
real bugs, and none of them could say "this shovel does not look like a shovel."
The renderer is a small software rasteriser: no browser, no GPU. The shovel was
rewritten a fourth time, the hoe a third and the hay bale a second because of
what those PNGs showed.

## Layout

```text
my-registry/
  models/core/          shared palette, RNG, geometry vocabulary, part slots
  models/<model-id>/    one procedural model per folder
  meta.ts               single source for catalogue metadata
  build.ts              compiles models/ into dist/registry.json
  drafts/               kept in the tree, kept out of the build
src/
  lib/vibe3d/           Vibe3D contracts installed by `vibe3d init`
  models/               installed model source (owned, editable)
  viewer.ts             the model inspector
  glb.ts                GLB export, shared by the viewer and the CLI
  catalog.ts            viewer catalogue, derived from meta.ts
scripts/
  verify-model.ts       browser-free conformance checks
  verify-glb.ts         export/re-import round trip
  zfight.ts             coplanar overlap detection
  render.ts             offline software rasteriser → PNG contact sheet
  export-glb.ts         batch GLB export
models.json             which registries this project resolves
models.lock.json        install receipt; `vibe3d diff` compares against it
```

`src/models/` is generated by `vibe3d add` but committed on purpose: it is the
demo's own source, and keeping it in the tree is what makes `vibe3d diff`
meaningful.

Released under the MIT License.
