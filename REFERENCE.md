# vibe3d working notes

What everything in this folder is for, how vibe3d works, and how to build your
own asset pack.

Upstream: <https://github.com/vibe-stack/vibe3d> · Docs:
<https://vibe-stack.github.io/vibe3d/#/docs> · License: MIT

---

## 1. What vibe3d is NOT, and what it is

**Not:** a 3D model library, an AI model generator, an engine.

**What it is:** the 3D counterpart of shadcn/ui, a *source distribution
protocol*. You don't download models; you copy **the TypeScript code that
generates the model** into your own project and own it. No `node_modules`
boundary, no patching; the file is yours, open it and change it.

The system has four layers:

| Layer | Package | Responsibility |
| --- | --- | --- |
| Protocol | `@vibe3djs/schema` | `models.json`, `registry.json`, lock schemas (Zod) |
| Resolution | `@vibe3djs/registry` | source providers, dependency graph, safe install |
| Validation | `@vibe3djs/conformance` | schema + path safety + hash check |
| Interface | `vibe3d` (CLI) | `init`, `add`, `view`, `list`, `diff`, `remove`, `doctor` |

`@scifi-kit` is none of these. It is **the protocol's first reference
registry**. Its being sci-fi is an accident; the platform makes no assumption
about style.

### Addressing

```
@scifi-kit/pressure-gauge
|          └── registry item (model)
└───────────── registry namespace
```

A namespace is **not an npm package name**. It binds to a physical source
through `models.json`:

```json
"registries": {
  "@scifi-kit":   { "source": "npm:@scifi-kit/registry", "version": "latest" },
  "@medieval-kit":{ "source": "file:my-registry/dist/registry.json", "version": "workspace" }
}
```

Thanks to this separation the publisher can change storage (npm → another scope
→ sharded packages) while the address the consumer uses stays the same.
Supported sources: `npm:`, `file:`, `https://`. (`github:` exists in the schema
but currently throws a "planned but not available yet" error.)

### Security model

The CLI does **not install** the registry npm package into `node_modules` and
does **not run** its lifecycle scripts. It unpacks the tarball into a temporary
directory with `pacote`, validates the manifest with Zod, rejects absolute paths
and `..` escapes, writes only the files declared by the resolved items, then
deletes the temporary directory.

---

## 2. What is in this folder

```
models.json                      your configuration (edited by hand)
models.lock.json                 the CLI's receipt (never edited by hand)
index.html · vite.config.ts      the playground application
src/main.ts                      scene + renderer + render loop (YOURS)
src/lib/vibe3d/                  the universal contracts `init` installs
  model.ts                         ModelInstance, PartHandle, MaterialBindings
  ownership.ts                     ResourceScope (resource ownership)
  materials.ts                     the MaterialSource interface
src/lib/vibe3d/scifi-kit/generator/   @scifi-kit/core, 2,100 lines of procedural tools
src/viewer.ts · src/viewer.css   the model viewer (WebGPU, sky, shadow)
src/catalog.ts                   the viewer's catalog, DERIVED from meta.ts
src/glb.ts                       GLB export (shared by viewer and CLI)
src/models/scifi-kit/pressure-gauge/  the installed sci-fi model
src/models/medieval-kit/…             your OWN installed models (37 models)
my-registry/
  meta.ts                          the SINGLE source of catalog metadata
  build.ts                         the registry.json generator
  models/core/                     the kit's shared vocabulary
  models/<id>/model.ts             the models' source
  drafts/                          drafts that stay out of the registry
scripts/
  verify-model.ts                  browserless conformance validation
  verify-glb.ts                    GLB round-trip validation
  zfight.ts                        coplanar face detection
  raster.ts                        the software renderer, no browser, no GPU
  render.ts                        its command line: sheets, sweeps, turntables
  text.ts                          TrueType outlines, filled by scanline
  build-cover.ts                   media/cover.png, the card a link unfurls to
  export-glb.ts                    exports the whole kit to GLB
  catalog-table.ts                 generates the model table in REFERENCE.md
  build-artifact.ts                bundles the viewer into a single file
```

The `models.json` ↔ `models.lock.json` split is deliberate: the first is
**configuration** (yours), the second is **install state** (the CLI's). The lock
holds the sha256 of every file at install time; `vibe3d diff` uses it to detect
your local changes, and `add`/`update` **do not overwrite** files you have
edited (unless you say `--overwrite`).

### Running

```bash
bun run dev                    # playground: two registries, one project
bun run typecheck              # does the installed source really compile

bun my-registry/build.ts       # generate registry.json
bunx vibe3d add @medieval-kit --overwrite   # install your own kit into yourself

bun scripts/verify-model.ts    # geometry, protocol, metadata, actions
bun scripts/verify-glb.ts      # export → read back → compare
bun scripts/render.ts          # renders/_sheet.png, to LOOK at the models
bun scripts/export-glb.ts      # the whole kit under glb/
```

When working on a model the order is always the same: **edit the source →
build → install into yourself → validate → render.** Skipping the two middle
steps leaves the installed copy under `src/models/` stale, and validation then
tests the old code.

> **WebGPU required.** The `@scifi-kit` models use TSL node materials
> (`colorNode`, `attribute(...)`), so `WebGPURenderer` is mandatory. Your own
> `@medieval-kit` model uses plain `MeshStandardMaterial`, so WebGL is enough.

> **The `three` vs `three/webgpu` trap.** These are separate bundles and both
> contain their own copy of the core classes. Mix them and you get the "Multiple
> instances of Three.js" warning, and `instanceof` checks break between the two
> copies. We solved it with a `three` → `three/webgpu` alias in
> `vite.config.ts`. The regex (`/^three$/`) is mandatory; a plain string prefix
> match would also break the `three/addons/...` path.

---

## 3. How the models are generated

Short answer: **procedural TypeScript**. No GLB/FBX is downloaded, the mesh is
born from code at runtime. GLB is only *output* (export), never *input*.

### 3.1 The pipeline

`@scifi-kit/core` (`src/lib/vibe3d/scifi-kit/generator/`) is a five-stage
pipeline:

1. **`primitives.ts`** (867 lines): `prism`, `extrudeProfile`, `filletRing`,
   `flatPlate`, `groove`, `cylinder`. These differ from Three.js's box/cylinder:
   they produce corner chamfers, tangential fillet rings and shared normals
   along the chamfer bands. The hard-surface look that "doesn't look
   AI-generated" comes from here.
2. **`profile.ts`**: 2D profile generation: `rect`, `octagon`, `stepEdge`,
   `offsetProfile`, `mirrorProfile`. The cross-section is drawn first, then
   extruded.
3. **`materials.ts`**: `MaterialLibrary` + `mountMaterialSource`. Materials are
   fetched by semantic ids like `MAT-03/GRAPHITE-800` and can be overridden in the project.
4. **`wear.ts`** (524 lines): the trick lives here. `bakeOcclusion` and
   `bakeSurfaceAttributes` write adjacency and surface identity into **vertex
   attributes** (`aMask`, `aColor`, `aSurface`, `aWearDir`, `aPlane`) while the
   parts are still separate. Then `createWearMaterial` produces paint chipping,
   scratches and grime with a single TSL node graph. The comment in the code
   states the intent plainly: fractal noise is deliberately avoided, because
   isotropic noise gives a soft cloud and a cloud reads as fog, not damage.
5. **`batching.ts` + `glb.ts`**: `mergeStaticByMaterial` reduces the static
   parts to one draw call per material; `exportStaticGlb` *bakes* the procedural
   wear into standard PBR data to produce a portable GLB.

The order is critical and is written down as rule 9 in `modeling-rules.md`:
**assemble, bake, then merge.** Adjacency data can only be derived while the
objects are still separate.

### 3.2 The anatomy of a model

`src/models/scifi-kit/pressure-gauge/model.ts` (539 lines) is a typical example:

```ts
export function createModel() {
  const { materials, handles, profiles } = acquireMaterials()
  const root = new Group(); root.name = 'pressure-gauge'

  addMount(root, materials); addHousing(root, materials)
  const needlePivot = addFace(root, materials)      // the moving part
  addSideIndicator(root, materials); addConnector(root, materials)

  bakeOcclusion(root)                    // 1) adjacency → attribute
  bakeSurfaceAttributes(root, profiles)
  const wearMaterial = createWearMaterial(...)      // 2) a single TSL material

  root.remove(needlePivot)               // 3) take the moving part out of the batch
  mergeStaticByMaterial(root, ...)       //    flatten the static ones
  root.add(needlePivot)

  return { root, update, triggerPressureTest, dispose }
}
```

Measured result (`bun scripts/verify-model.ts`): **10 meshes, 10,830
triangles**, 8 materials, 5.7 × 7.4 × 2.71 m. `update()` rotates exactly **one**
node (the needle pivot).

### 3.3 The runtime contract

`src/lib/vibe3d/model.ts` is small and deliberately so:

- **`root` identity is fixed for life.** `configure()` may rebuild the topology
  but cannot swap the root, so that scene parenting, editor selection and
  external references survive.
- **Semantic `parts`**, with no dependence on anonymous mesh order. `anchor` is
  fixed, `content` is rebuildable. A light or label the consumer attached to
  `anchor` survives a rebuild.
- **`materials.get/override/reset`**, resolution order: instance override →
  project override → kit default.
- **Ownership**: the model disposes its own resources exactly once, **never
  touches a material the consumer supplied**, and `dispose()` is idempotent.
- **The scene, renderer, camera and render loop are YOURS.** See `src/main.ts`.

`configure()` is expensive. It is for user settings, not for per-frame
animation. Continuous motion is done with `actions` + `update(dt)`.

### 3.4 How the models are *written* (the actual "generate" part)

By hand. But with a structured AI loop: **the `vibe-model` skill**.

```bash
bunx vibe-model          # installs .agents/skills/vibe-model
```

The loop:

```
model source → deterministic preview → independent visual critique
      ▲                                        │
      └──────────── highest-impact fix ────────┘
```

The rules (`.agents/skills/vibe-model/SKILL.md`): the critiquing agent is given
**only** the brief, the reference image and the current render (it never sees
the code). The agent returns a similarity score and **at most three** prioritized
fixes. Silhouette and proportions, main masses and negative space,
distinguishing marks, and material/value reading are scored in that order.
**Stop at 85**; stop as well if it plateaus twice or exceeds 10 iterations. A
plateau is proof that the representation or the reference has to change.

`references/modeling-rules.md` contains 17 hard rules. The most expensive ones:

- Budget chamfers by perceptual role. The default is a **single** facet; give a
  second one only to masses that carry the silhouette.
- **Assume the winding direction flips** when a ring is inset inward; compare
  the edge cross product of the first triangle against the expected normal.
- Keep chamfers below ~60% of the affected half-dimension.
- Size physical features **in world units**: chamfer, seam, bolt, gap. Do not
  scale these as a percentage of the host part.
- Compute the clearance for every layer you apply; in this meter-scale kit that
  is at least **0.015 units**, and verify it from a real camera (z-fighting).

---

## 4. Building your own asset pack

**We already did this in this folder.** `my-registry/` is a working, validated
example.

A registry is, in the end, **a single JSON file**. No dependencies required.

### Steps

**1) Write the source**, in `my-registry/models/<model-id>/model.ts`

Use the canonical imports; they are rewritten during install:

| What you write | What it becomes once installed |
| --- | --- |
| `@vibe3d/model.ts` | `@/lib/vibe3d/model.ts` |
| `@models/...` | `@/models/...` |

This is why the registry never has to assume the consumer's folder layout.

**2) Build the manifest**, with `my-registry/build.ts`

For every file `{ path, target, content, hash }`. The `{models}` and `{vibe3d}`
placeholders inside `target` are replaced with the `paths` from the consumer's
`models.json`. `defaultItem` is mandatory and must exist.

```bash
bun my-registry/build.ts
```

**3) Validate** with the official conformance check

```bash
bunx vibe3d registry validate my-registry/dist/registry.json
# Conformant @medieval-kit · 2 items · 1 files · MIT
```

Schema, dependency closure, safe target paths, double writes and hash freshness
are all checked.

**4) Link and install**

```jsonc
// models.json
"@medieval-kit": { "source": "file:my-registry/dist/registry.json", "version": "workspace" }
```

```bash
bunx vibe3d add @medieval-kit/wooden-barrel --dry-run   # show it first
bunx vibe3d add @medieval-kit/wooden-barrel
```

**5) Publish**: put the `vibe3d.registry` field in `package.json` and push to
npm:

```json
{
  "name": "@medieval-kit/registry",
  "keywords": ["vibe3d", "vibe3d-registry", "threejs"],
  "vibe3d": { "registry": "./dist/registry.json" },
  "files": ["dist", "README.md", "LICENSE"]
}
```

Users write `"source": "npm:@medieval-kit/registry"` in their `models.json` and
install with the same CLI. **You do not need anyone's permission.** You can
publish your own registry without touching the vibe3d repository. The
architecture document states this as an explicit goal.

This one is live, which is how the claim stopped being theory:
[`@medieval-kit/registry`](https://www.npmjs.com/package/@medieval-kit/registry).
Publishing needed 2FA on the npm account and an org owning the `@medieval-kit`
scope; nothing was needed from vibe3d itself. Worth knowing before you publish
your own: npm stamps the publishing account's email into the packument per
version, and later account changes do not rewrite it, so whatever address is
on the account at that moment is public for good.

### Size warning

`registry.json` keeps all the source embedded. `@scifi-kit/registry@0.0.1` →
**1.8 MB of JSON**, a 404 KB tarball. npm downloads the entire tarball even for
a single item. The architecture document foresees collection-based sharding for
the future (`@scifi-kit/industrial`, `@scifi-kit/medical`…). The address stays
the same, the physical package changes.

---

## 5. Lowpoly medieval: yes, no problem

This is not an assumption: `@medieval-kit` works, is validated and currently
contains **37 models + 1 lib**. The table is generated from the models
themselves with `bun scripts/catalog-table.ts`. A hand-written list goes stale
on the first model you add, and in fact it had gone stale once.

| Model | Category | Triangles | Parts | Size (m) | Material slots | Animated |
| --- | --- | ---: | ---: | --- | --- | :-: |
| `wooden-chest` | Furniture | 552 | 4 | 0.86×0.51×0.48 | oak, iron | ✔ |
| `wooden-barrel` | Props | 1690 | 3 | 0.83×1.05×0.83 | oak, iron |  |
| `wooden-crate` | Props | 1320 | 3 | 0.69×0.52×0.55 | oak, iron |  |
| `wooden-bucket` | Props | 439 | 4 | 0.31×0.46×0.30 | oak, iron |  |
| `trestle-table` | Furniture | 660 | 3 | 1.91×0.74×0.78 | oak |  |
| `wooden-bench` | Furniture | 216 | 3 | 1.62×0.45×0.30 | oak |  |
| `wooden-stool` | Furniture | 180 | 2 | 0.38×0.43×0.36 | oak |  |
| `pitch-torch` | Lighting | 239 | 3 | 0.13×0.70×0.13 | oak, char, ember | ✔ |
| `iron-lantern` | Lighting | 480 | 4 | 0.15×0.30×0.17 | iron, glass, char, ember | ✔ |
| `iron-anvil` | Smithy | 256 | 6 | 0.54×0.75×0.41 | iron, steel, oak |  |
| `cart-wheel` | Structure | 1136 | 4 | 1.04×1.06×0.19 | oak, iron |  |
| `log-pile` | Props | 924 | 2 | 0.99×0.58×0.70 | oak |  |
| `hay-bale` | Props | 910 | 3 | 1.04×0.42×0.43 | straw, cloth |  |
| `linen-sack` | Props | 342 | 3 | 0.34×0.53×0.33 | cloth |  |
| `oak-tankard` | Props | 390 | 4 | 0.11×0.16×0.14 | oak, iron |  |
| `straw-broom` | Tools | 1048 | 3 | 0.30×1.22×0.30 | oak, straw, cloth |  |
| `bronze-bell` | Props | 1048 | 4 | 0.51×0.68×0.36 | brass, iron, oak | ✔ |
| `tavern-sign` | Props | 876 | 3 | 0.38×2.29×0.93 | oak, iron | ✔ |
| `wicker-basket` | Props | 2326 | 3 | 0.34×0.16×0.35 | oak, produce |  |
| `leather-book` | Props | 440 | 3 | 0.20×0.08×0.27 | leather, cloth, brass |  |
| `glass-phial` | Props | 339 | 3 | 0.06×0.14×0.06 | glass, ember, oak, char |  |
| `coin-pouch` | Props | 602 | 3 | 0.18×0.11×0.16 | leather, cloth, brass |  |
| `wooden-ladder` | Structure | 440 | 2 | 0.49×2.20×0.06 | oak |  |
| `wooden-fence` | Structure | 860 | 2 | 5.18×1.31×0.31 | oak |  |
| `wooden-hoe` | Tools | 394 | 3 | 0.23×1.23×0.33 | oak, iron, steel |  |
| `wooden-shovel` | Tools | 496 | 3 | 0.27×1.20×0.08 | oak, iron |  |
| `wooden-pitchfork` | Tools | 392 | 3 | 0.27×1.58×0.15 | oak, iron |  |
| `iron-cauldron` | Lighting | 1134 | 3 | 1.09×1.37×1.10 | stone, iron, char, ember | ✔ |
| `hand-cart` | Structure | 2044 | 4 | 0.87×0.68×2.49 | oak, iron | ✔ |
| `vegetables` | Props | 1718 | 2 | 0.60×0.12×0.59 | produce |  |
| `round-shield` | Arms | 729 | 3 | 0.73×0.73×0.17 | oak, leather, iron |  |
| `forge-hearth` | Smithy | 1426 | 4 | 2.06×1.78×0.87 | stone, char, ember, oak, leather, iron | ✔ |
| `stone-well` | Structure | 1376 | 4 | 1.88×2.00×1.28 | stone, oak, iron, cloth | ✔ |
| `stone-trough` | Structure | 344 | 2 | 1.52×0.45×0.60 | stone, water |  |
| `grindstone` | Smithy | 568 | 4 | 1.24×0.95×0.70 | stone, oak, iron, water | ✔ |
| `market-stall` | Structure | 384 | 4 | 1.83×2.03×0.97 | oak, cloth |  |
| `post-mill` | Structure | 1672 | 4 | 6.60×7.23×6.98 | oak, iron | ✔ |

**30,390 triangles** in total. The whole kit in one scene has a budget smaller
than a single medium-complexity character model.

### 5.1 One source: `my-registry/meta.ts`

Title, description, category, tags, slider ranges, part names and material slots
all live in ONE place. Two consumers feed from it: `build.ts` (when generating
registry.json) and `src/catalog.ts` (the viewer's sliders and descriptions).

Previously the two were written out by hand separately, and by the seventeenth
model they had diverged. Divergence is not impossible now, but being SILENT
about it is: `verify-model.ts` compares metadata against reality on every model,

- are all the `meta.controls` keys really fields of the model's config,
- is `meta.parts` the same as the model's real part names,
- does every declared slot resolve,
- and, more important: **does no mesh use an undeclared slot.**

The last item is the real one. An extra declaration is only noise; a MISSING
declaration means a hidden material the consumer cannot reach with
`materials.override()`, which is a violation of the registry contract. The day
this check was added it caught a real drift in four models (a `steel` slot had
been added but not declared).

### 5.2 The material vocabulary: thirteen slots

| Slot | What | Why separate |
| --- | --- | --- |
| `oak` | timber | the baseline everything else is measured against |
| `iron` | forged iron, oxidized and matte | separate from `steel`: the difference is not in color but in ROUGHNESS, and vertex color cannot carry roughness |
| `steel` | steel polished by use | the anvil face, the shovel blade, the pitchfork tip |
| `brass` | bronze and copper | the bell, coins |
| `straw` | straw, wicker, broom bristle | a bale declaring "oak" would be a lie told to the consumer |
| `cloth` | linen, sackcloth, rope | woven, so it takes light softly and never glints |
| `leather` | worked leather | darker and glossier than cloth at the same colour |
| `glass` | blown glass | transparent, `depthWrite` OFF, `DoubleSide` |
| `produce` | fruit and vegetable skin | if I had given it the same roughness as straw an apple would look like dry hay |
| `ember` | flame | `MeshBasicMaterial`: it does not receive light, it emits |
| `char` | charcoal, pitch | the darkest thing in the kit, and it has to stay readable against shadow |
| `stone` | dressed and rubble masonry | its color is close to weathered oak; what tells them apart at a glance is that stone scatters light completely flat, and roughness is not something vertex color can carry |
| `water` | standing water | a thin transparent film over whatever holds it: it works through opacity rather than through a colour of its own |

`ember` also works as a rule in two places: bodies in this slot are skipped
entirely while occlusion and mottle are baked. The reason is simple: on an
unlit material the vertex color is the final color, and darkening it puts the
flame out. The rule lives in `kit.ts` bound to the slot itself, not to a
per-model flag, so that it cannot be forgotten.

### 5.3 `core`'s vocabulary

**Geometry generators** (`geometry.ts`), all non-indexed, all vertex-colored,
so flat shading comes for free:

`boxGeometry`, `taperedBoxGeometry`, `chamferedBoxGeometry` (44 triangles, with
self-correcting edge/corner winding), `prismGeometry`, `latheGeometry`,
`staveGeometry`, `bandGeometry` (with an optional inner face), `headGeometry`,
`arcBarGeometry`, `dishedSheetGeometry`, `flipGeometry`, `mergeColoured`.

**Deformation**, added later, and it is what stopped the models looking
"generated":

- `bendGeometry(geometry, curvature)` wraps a straight body into an arc. A real
  arc mapping, not "rotate every point in proportion to its height". That
  approach stretched and thinned the body. The pitchfork tines, the tankard
  handle, the hoe blade and the curve of the sign use it.
- `roughenGeometry(geometry, amount)` makes the surface irregular. The critical
  point: the displacement amount is derived FROM POSITION. The geometries are
  non-indexed, so a single point has three or four vertex copies; moving them
  independently tore the surface. A position hash gives every copy at the same
  point the same displacement.

**Surface baking**, kit-wide and automatic inside `createKitModel`:

- `bakeOcclusion` (`occlusion.ts`) bakes ambient occlusion into the vertex
  colors. It derives the darkening from the surface's OWN shape: the more
  neighboring faces surround a point, the less sky it sees. The gaps between
  staves, the underside of a hoop, the place where logs touch all go darker.
- `mottleGeometry` bakes surface mottle, and this is **this kit's answer to the
  question "what about textures?".** A bitmap texture would want three things:
  UV coordinates (our geometry has none), image files the registry would have to
  carry, and a change to the kit's identity. Instead there is a blotch pattern
  derived from the surface position; the blotch size comes from the model's
  scale, the INTENSITY from the slot:

  ```
  straw 1.35 · cloth 1.15 · oak 1.00 · char 0.85 · leather 0.70
  iron  0.50 · brass 0.35 · steel 0.22 · glass 0.15 · ember 0
  ```

  The rule comes from the physics of the material: the more polished a surface
  is, the more single-colored it becomes, because the light that reaches the eye
  comes from the reflection, not the pigment.

  The honest limit: the speckles are sampled at the vertices, so triangle
  density determines their resolution. The chest's large front panel is two
  triangles, so the mottle is almost invisible there. The remedy is to subdivide
  the triangle, and that eats the lowpoly budget.

**Scaffolding** (`kit.ts`): `createKitModel` makes every model set up the same
contract: resource ownership, material resolution and override, a fixed anchor +
replaceable content, a `configure()` that does not break identity, an idempotent
`dispose()`. Writing a model is now just generating geometry.

### 5.4 A part is a MEANING, not a mesh

`BuiltPart` carries three fields and two of them came later:

- `geometry` + `slot`: the part's main body.
- **`extras`**: bodies belonging to the same part that use a DIFFERENT slot.
  Parts are sibling children of the root, so when one of them moves the others
  cannot follow it. The chest's lid is oak board and iron strap and lock hasp at
  once, and the three have to rotate together; as separate parts the straps
  would hang in mid-air while the lid opened. What is split is not the meaning,
  only the material.
- **`origin`**: the part's own center of rotation. When given, the anchor is
  placed there and the geometry is assumed to be written relative to that point.
  This is the only thing needed to make the chest lid rotate around its hinge.

`origin` brings a subtlety: occlusion has to be computed in ASSEMBLY space. A
lid written in its own origin looks as if it stood inside the body rather than
beside it, and darkens the wrong places. That is why `kit.ts` moves everything
into place before baking and moves it back afterwards.

### 5.5 Actions and animation

Eleven models carry actions:

| Model | Action | Mechanic |
| --- | --- | --- |
| `wooden-chest` | `setOpen` / `toggle` / `isOpen` / `openness` / `snap` | exponential approach, independent of frame rate |
| `pitch-torch` | `setLit` / `isLit` | sum of sines at incommensurate frequencies |
| `iron-lantern` | `setLit` / `isLit` | the same, but slower: the glass shields the flame from wind |
| `iron-cauldron` | `setLit` / `isLit` | the fire under it, on the torch's flicker |
| `forge-hearth` | `setLit` / `isLit` | the same, banked lower: a forge fire is coals, not flame |
| `bronze-bell` | `ring` / `still` / `isRinging` / `strikes` | two independent pendulums |
| `tavern-sign` | `push` / `still` / `lean` | soft pendulum, long swing |
| `grindstone` | `crank` / `still` / `isTurning` / `turns` | spun up by hand, then exponential decay plus a constant drag, so it stops rather than approaching zero forever |
| `post-mill` | `setTurning` / `isTurning` / `setAngle` | constant rate about the windshaft |
| `stone-well` | `setDepth` / `depth` / `setWinding` | the bucket travels the shaft and the rope pays out with it |
| `hand-cart` | `setRoll` / `roll` | the wheels turn about their own axle origin |

Five of these are wired to a button in the viewer; the rest are driven through
the model's own interface. That distinction cost a documentation bug: the
generated table's Animated column was reading the VIEWER's button registration,
so six of the eleven, including the mill, the well and the grindstone, were
published as static. It now asks the models.

The distinction is written in the architecture document and it matters:
`configure()` rebuilds the topology and is **expensive**, it is for user
settings. Everything that changes per frame must happen inside `update()`.
Opening the lid does not change the chest's IDENTITY, so it is not
`configure()`'s job.

Three rules hold for every moving model:

1. **State is kept OUTSIDE the build.** When `configure()` is called the lid
   must not slam and the bell must not go quiet. The angle and the phase live in
   the closure, not inside `build()`.
2. **No `Math.random()`.** Even the flame flicker is deterministic: the sum of
   two sines at incommensurate frequencies. Two torches with the same seed do
   not drift apart.
3. **Frame-rate independence.** The chest uses
   `p += (target − p)·(1 − e^(−k·dt))`; a naive lerp would open more slowly at
   30 fps than at 120. The test verifies this by running the same duration with
   two different step counts and comparing.

The bell is the most complex piece in the kit and what it teaches is this:
**what rings a bell is not the bell swinging, it is the clapper LAGGING
BEHIND.** On the first attempt I made the clapper an `extras` body of the bell,
the bell swung and nothing happened. Now the two are separate parts, swinging on
the same axis but with different damping; the difference between them produces
the strike and increments the `actions.strikes()` counter. The model PLAYS NO
SOUND: it has no right to make assumptions about the scene's audio system,
whoever needs it reads the counter.

### 5.6 Z-fighting: do not make aligned faces, interpenetrate on purpose

If two surfaces are in the same plane, face the same direction and their areas
overlap, which one is in front is left to the floating-point precision of the
depth buffer. As the camera moves the winner changes and the surface flickers.

The first version of the crate fell into exactly this trap: the posts, the side
boards and the lid boards all put their outer surface on the `±width/2` plane,
**96 coincident faces.** The fix was not an "epsilon nudge" but real carpentry:

- **The posts stand proud of the boards.** The side boards are pulled behind
  the posts, so their outer faces are on a different plane.
- **The lid and the base overhang the frame.**
- **The posts go INTO the lid and the base**, so their ends stay inside a solid
  part and align with no plane at all.
- **The boards are butt-joined.** They touch but they do not overlap. Edge
  contact does not produce z-fighting.
- **The straps stop before they meet each other at the corner.**

The same discipline forced a pile of decisions in the newer models too, and some
of them made the model more CORRECT:

- On a medieval chest no strap goes in the middle of the front face, because
  **that is where the lock is.** The rule is both historically correct and rules
  out at the root any chance of the strap and the lock bridge landing on the
  same plane at certain dimensions.
- The broom's sheaves cannot sit perfectly parallel to each other. In a
  hand-tied bundle no bristle is parallel to another anyway.
- The bell's bearings stand proud of the rail; a real bearing does the same.

`scripts/zfight.ts` measures this, and `verify-model.ts` calls it on every
model, in several different configurations at that. The criterion is not the
bounding box but real area overlap: is one triangle's centroid inside the other.

### 5.7 Winding checks

In hand-written geometry the sneakiest bug is inverted winding: the face becomes
visible from the inside and it is only noticed at one particular camera angle.
There are three separate criteria, because none of them is sufficient alone:

**Radial alignment**, for bodies of revolution. Every radial face's normal on
the outer shell must point away from the axis. It is measured in height BANDS:
on conical bodies a single radius threshold is meaningless.

**Signed volume**, for closed solids. Σ a·(b×c)/6 comes out positive if the
winding faces outward. But this criterion only catches a GLOBAL inversion.

**Edge balance**, the only criterion that catches a single flipped face. It was
added because the signed volume test missed it: when I flipped one face the
volume fell from 0.058 to 0.039 but stayed positive.

Three more subtleties:

- The side surfaces of staves are TANGENTIAL, so the radial cross product is ~0
  for them by definition and its sign is only noise. They are filtered out and
  **how many were filtered is reported.** They are not silently dropped.
- Hollow bodies (the bell) deliberately carry an inward-facing shell. For those
  the threshold is raised so the inner shell is not taken for the "outer shell".
- `bandGeometry` produces no inner face by default (a hoop always wraps a body,
  the inner face is invisible). A free-standing ring such as the sack's rope or
  the bale's tie was therefore not a closed solid; `{ inner: true }` exists for
  that.

### 5.8 Validation: three scripts

```bash
bun scripts/verify-model.ts   # ~500 checks · geometry, protocol, metadata, actions
bun scripts/verify-glb.ts     # exports every model and READS IT BACK
bun scripts/render.ts         # PNG contact sheet, for LOOKING at the model
```

The method has been the same from the start: **every check was tested by
mutation.** Sabotage it, see the FAIL, undo it, see the PASS. A test that passes
does not prove it works.

That discipline proved itself badly right twice, and both times the bug was
MINE, not the test's:

- The radial test was giving 17 false positives. My diagnostic output said "0
  negatives" because `toFixed(3)` produces `-0` and in JavaScript `-0 < 0` is
  false.
- The logs were still interpenetrating. What I was measuring as "0
  interpenetrations" was the LAYOUT math; but the radius of the ends was
  `log.r · (1 ± 0.05)` while the layout was computed with `log.r`. I had
  validated the wrong thing.

`render.ts` was added last and it closed the thing that was missing. All the
validation was GEOMETRIC: triangle count, winding, coplanarity, bounding box. It
all caught real bugs but none of it could say "this shovel does not look like a
shovel". To say that sentence you have to look at the model, and the script is a
software rasterizer with no browser and no GPU: it collects the triangles,
projects them with a camera, fills them with a z-buffer, writes a PNG. The
shovel was rewritten a fourth time, the hoe a third and the hay bale a second
because of looking at those images.

`--sweep` mode puts different values of one parameter side by side:

```bash
bun scripts/render.ts --one wooden-hoe --sweep "bladeAngle=62|80|98|116|134"
```

That is how the hoe's blade angle was chosen. Around 98° the blade stays almost
horizontal and is seen EDGE-ON by a camera looking from a 3/4 angle, so the
model's most characteristic surface disappears from the silhouette. 66° was
chosen.

### 5.9 GLB export

This was the only feature vibe3d's own viewer had and we did not. It now works
from two places and **both use the same code** (`src/glb.ts`):

```bash
bun scripts/export-glb.ts                      # the whole kit → glb/
bun scripts/export-glb.ts --one wooden-chest
```

The "Download GLB" button in the viewer produces a bit-for-bit identical file.
Batch export is what they do not have and it is the one that actually earns its
keep: it takes the kit to Blender, Godot or Unity with a single command.

Because all the color information is in vertex colors it travels to glTF as
`COLOR_0` and `baseColorFactor` stays white. There is no texture in the file at
all. The kit's entire identity travels in a single attribute.

The one thing that does NOT travel is the shader: the wear on `@scifi-kit`'s
gauge is a TSL node graph, i.e. code, and glTF does not carry code. This is not
a shortcoming. It is the real difference between a vertex-color surface and a
shader-based one.

---

## 6. Contributing

The repository is MIT and a Bun workspace. `apps/*`, `packages/*`,
`registries/*`.

```bash
git clone https://github.com/vibe-stack/vibe3d
cd vibe3d && bun install
bun run dev            # the docs catalog, a live preview of every model
```

Versioning is done with **Changesets**:

```bash
bun run changeset                              # write down the intent of the change
bun run build && bun run typecheck && bun test # the same as release:check
```

The release workflow keeps a version PR open and, after the merge, publishes the
packages in dependency order.

### Contribution paths, easiest to hardest

1. **Publish your own registry.** It does not touch the repository, needs no
   permission, and grows the ecosystem. `@scifi-kit` is only the *reference*
   registry.
2. **Add a model to `@scifi-kit`.** Add `assets/prototypes/<model-id>/model.ts`
   `registries/scifi-kit/src/build.ts` **auto-discovers** every folder that
   contains a `model.ts`, there is no registration list. Follow the `vibe-model`
   loop and fill in the `docs/templates/asset-spec-template.md` contract.
3. **Close the protocol gaps.** Things written in the architecture document but
   not there yet, open to direct contribution:
   - the `github:` provider (`source.ts` today explicitly throws "planned but
     not available yet");
   - the `vibe3d registry init` / `build` / `test` commands (present in the
     architecture, only `validate` exists in the CLI);
   - a safe `update` conflict flow without three-way merge;
   - runtime conformance (the existing `checkRegistry` is static; the "install
     into a clean fixture, compile TypeScript, validate a live model instance"
     steps do not exist yet).

Note: the architecture document's header still says *"Status: proposed
architecture; not yet implemented"* but the core is largely real. That gap is a
contribution opportunity too.

### Current status

`@scifi-kit/registry@0.0.1` as published on npm: **110 models** (Industrial 76,
Architecture 12, Streets 9, Military 7, Medical 6) + 2 libs + 1 kit. GitHub
`main` is further ahead: there are ~180 folders under `assets/prototypes/` (the
cargo/logistics wave is not published yet). All packages are at `0.0.1`,
published on 2026-08-11; the project is at a very early stage, so the timing for
contributing is good.

---

## 7. Command summary

```bash
# consumer
bunx vibe3d init
bunx vibe3d list [query]                 # catalog, alias: search
bunx vibe3d view @scifi-kit/modular-wall # inspect without installing
bunx vibe3d add  @scifi-kit/modular-wall [--dry-run] [--overwrite]
bunx vibe3d add  @scifi-kit              # defaultItem = the whole kit
bunx vibe3d diff                         # what are my local changes
bunx vibe3d update @scifi-kit/modular-wall
bunx vibe3d remove @scifi-kit/modular-wall [--force]
bunx vibe3d doctor

# registry author
bunx vibe3d registry validate ./my-registry/dist/registry.json

# this repository
bun my-registry/build.ts                    # generate registry.json
bun scripts/verify-model.ts                 # full validation
bun scripts/verify-glb.ts                   # GLB round-trip
bun scripts/render.ts [--one <id>] [--ids a,b] [--sweep "k=v1|v2"] [--size N]
                      [--angles N] [--columns N] [--height N] [--ground <hex>]
bun scripts/build-cover.ts                  # media/cover.png
bun scripts/export-glb.ts [--one <id>] [--out dir]
bun scripts/catalog-table.ts                # the document's table

# authoring skills
bunx vibe-model    [--global] [doctor] [--force]
bunx vibe-terrain
```
