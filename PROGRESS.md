# Where this stands, and what it cost to learn

Written so that a session picking this up cold does not repeat any of it. The
protocol lives in `REFERENCE.md`, the kit's public face in `README.md`. This is
the third thing: the state of the work, the loop that produces it, and the
mistakes that shaped both.

## The two kits

**`@medieval-kit`** is finished and published. 37 models, 30,390 triangles, 13
material slots, MIT. On npm as `@medieval-kit/registry`, currently `0.1.2`. The
viewer is live at <https://medieval.crt.fyi/> and rebuilds on every push. The
GitHub repository is private, which is deliberate, and which is why the npm
page's Repository and Issues links 404 until that changes.

**`@contemporary-props`** is six models into a planned 119. Present-day objects,
no lowpoly budget, no historical constraint. 19 material slots. Nothing is
published and the version is `0.0.0`.

The two share a repository and a demo app but nothing else. The geometry
vocabulary was forked rather than shared: `geometry.ts`, `occlusion.ts`,
`parts.ts` and `random.ts` carried over without a single edit, which is the
strongest evidence that the split between vocabulary and palette was drawn in
the right place.

## The loop that makes a model

The kit was built one model at a time, by hand, and the numbers say what that
cost: 37 models, but model files were touched 117 times. **Every model was
written about three times.** Almost every rewrite came from looking at a render
and seeing that the thing was wrong.

That is the whole reason the loop looks like this rather than like "write it and
run the checks".

### For a single model

    edit contemporary-props/models/<id>/model.ts
    bun contemporary-props/check.ts <id>          # measures, and draws it
    LOOK AT THE PNG
    bun contemporary-props/check.ts <id> --angles 6

`check.ts` deliberately does NOT rebuild the registry or install anything. The
kit-wide gate does both, and both write files the whole repository shares, so
several workers running it at once overwrite each other and every one of them
then verifies somebody else's code. That has already happened here once: a cart
was fixed, the reinstall was skipped, and the old geometry passed while the new
geometry was never looked at.

### For the whole kit, once, in one place

    bun run registry:build
    bunx vibe3d add @medieval-kit --overwrite     # or @contemporary-props
    bunx tsc --noEmit
    bun run verify                                # ~1,000 checks
    bun scripts/audit.ts                          # nothing floats, every config
    bun run verify:glb
    bun run check:docs
    bunx vibe3d registry validate <registry>/dist/registry.json

There are TWO model trees and this is the trap that catches everyone.
`<registry>/models/**` is what you edit. `src/models/**` is the installed copy
that `verify` and the viewer actually read. Skip the rebuild-and-reinstall and
you verify code you did not write.

## The authoring protocol

`bunx vibe-model` is installed at `.agents/skills/vibe-model`. Its loop is the
one to follow, and it is better than the one built here from scratch in three
specific ways that were only noticed by comparing them:

- **The critic must not see the code.** Give a fresh critic the brief, the
  reference and the render, nothing else. A critic told what the builder
  intended tends to see the intention.
- **There must be a reference image.** Rendering our own output and looking at
  it answers "is this broken". It cannot answer "is this right", because there
  is nothing to be right about.
- **A score, at most three prioritised fixes, and a stop condition.** Accept at
  85. Stop after two plateauing scores or ten iterations. A plateau is evidence
  that the representation or the reference has to change, not a reason to keep
  grinding.

Its own warning is worth repeating, because it is exactly the gap the local
checks fill: a resemblance score is blind to parts seated on the wrong plane,
geometry floating in front of a face, and coincident faces tearing. Ask for
modelling errors listed separately from resemblance gaps, each with a location.
`check.ts` and `scripts/audit.ts` exist to catch what the critic cannot see.

`references/modeling-rules.md` carries 17 hard rules. The ones that cost real
time here: bevels budgeted by perceptual role, physical features sized in world
units, clearance calculated for every applied layer, and critic feedback treated
as evidence rather than as a number to optimise.

### References

`scripts/reference-shots.ts` generates one reference per model through the Codex
CLI's image tool. `references/` is gitignored: 37 images, tens of megabytes,
belonging to the studio and not to the registry consumers clone. The prompt asks
for the same shot every time, three-quarter view from slightly above, whole
object, plain dark ground, even light, because the images are measuring
instruments rather than art. A reference lit dramatically hides the silhouette
detail that is the entire point of having one.

The script currently reads `MODEL_META` from `my-registry` and needs
generalising before it can serve `contemporary-props`, whose metadata lives in
`models/<id>/meta.json` sidecars instead.

## Traps, each one paid for

**Two trees.** Covered above. It is the single most common way to verify
nothing.

**A part with `origin` has its geometry written RELATIVE to that point.** The
anchor supplies the rest. Writing the offset into the geometry as well applies
it twice. This put a handcart's wheels 304 mm in the air and every check passed,
because the cart was still resting on its shaft tips and the support check asks
about connectivity, not about whether a wheel is doing anything.

**Moving a piece out and then rotating is not the same as rotating and then
moving.** `rotateZ(a)` sends local +X to `(cos a, sin a)` and local +Y to
`(-sin a, cos a)`. Getting it backwards built a cart wheel from twelve stubby
blocks sticking 89 mm past their own felloe, straight through the iron tyre.

**Measure by slicing triangles, not by sampling vertices.** A tapered box has
corners only at its ends, so vertex sampling reported 0.0 mm for a 17 mm
shoulder. This produced confident wrong numbers three separate times in one
session.

**Use `object.isMesh`, never `instanceof Mesh`.** Two copies of three can be
loaded at once, and across copies `instanceof` matches nothing. The failure is
silent and total: the traversal samples no geometry, finds no components, and
reports every model clean. It did exactly that against another repository, and
the only reason it was caught was a `components: 0` line in a debug print.

**A check that passes by not running is worse than no check.** The docs check
once looked up the word before "slots", matched the ordinary phrase "material
slots" several paragraphs earlier, found that "material" is not a number, and
quietly checked nothing at all.

**Generated is not the same as correct.** The model table is generated so it
cannot go stale, says so in its own prose, and was wrong for months: it decided
"animated" from the viewer's hand-registered button rather than from the model,
so six of the eleven models that carry actions were published as static. The
obvious replacement was worse. `update` is wrapped for every model whether or
not it does anything, so switching to it marked all thirty-seven animated.

**Judge on a turntable, never on one three-quarter view.** The fence only looks
thin edge on. An oak was judged on a single angle for four rounds.

**Mutation-test after committing, not before.** Reverting a file to test a check
destroyed an uncommitted fix.

**A camera fitted to a bounding box is fitted to air.** Fitting the eight
corners of the box, then aiming at the centre of the bounding sphere, spent most
of the whole-kit picture on empty ground. Fitting sampled geometry and aiming at
the centre of the PROJECTION took the frame from 7.4% full to 23.6%.

**Include the contact shadow in the camera fit.** It is drawn from geometry
flattened onto the floor, which projects somewhere else entirely, and fourteen
of thirty-seven models had a shadow running off the edge of its own cell.

**Shadow strength has to be per pixel.** Per triangle looks fine on a wall and
tears a fan apart, because neighbouring triangles in a base cap have different
centre heights. The first attempt at a falloff produced a black starburst around
a vase's foot, which was worse than the bar it replaced.

## Identity, and why it matters here

Everything public is `CRTkafa`. Commits use the noreply address; the global git
config on this machine points at a different identity, so per-repository config
is not optional.

**Commit messages are one sentence.** A long narrative message once carried the
owner's real name into a pushed commit. Scan every message for names before
pushing.

npm stamps the publishing account's email into the public packument per version,
and nothing in `package.json` suppresses it. Later account changes do not rewrite
it. Verify the account's email before `npm login`, not after.

Force-pushing does not remove a commit from a public repository. The orphan
stays reachable by its SHA. Only making the repository private, deleting it, or
asking GitHub Support to purge actually closes it.

## Open

- **`contemporary-props`**: 6 of 119 modelled. The catalogue, the build order,
  the cuts and the slot argument are in `contemporary-props/CATALOGUE.md`.
  `pepper-mill` reads as a wooden bottle and needs rewriting. `coffee-mug`'s
  handle is a flat strap whose wide face turns toward the camera; the section
  wants to be squarer and deeper in the plane of the loop.
- **The pipeline** needs rebuilding onto the vibe-model protocol: references,
  a blind critic, a score, three fixes, a stop condition, and a revise stage.
  There is currently no revise stage at all, so a critic's findings go nowhere.
- **A medieval pass** with that pipeline, before anything else is added to it.
- **vibe3d PR**: a branch adding `@medieval-kit` to the init template is pushed
  to `CRTkafa/vibe3d` and unopened. A second contribution, the floating check,
  is not ready: it ran on 174 of their models unmodified but flagged 28, and the
  small-piece flags are artifacts of deriving voxel size from the longest axis.
- **`reflexive_keygen`**: the branch and tag were rewritten to the noreply
  identity, but the orphaned commit is still publicly readable. Making the
  repository private closes it.
