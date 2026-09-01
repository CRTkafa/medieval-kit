# Where this stands, and what it cost to learn

Written so that a session picking this up cold does not repeat any of it. The
protocol lives in `REFERENCE.md`, the kit's public face in `README.md`. This is
the third thing: the state of the work, the loop that produces it, and the
mistakes that shaped both.

## The two kits

**`@medieval-kit`** is finished and published. 37 models, 39,518 triangles, 13
material slots, MIT. On npm as `@medieval-kit/registry`, currently `0.2.1`. The
viewer is live at <https://medieval.crt.fyi/> and rebuilds on every push. The
GitHub repository is private, which is deliberate, and which is why the npm
page's Repository and Issues links 404 until that changes.

**`@contemporary-props`** is six models into a core hundred, with a further
150 catalogued behind them. Present-day objects,
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

    edit <registry>/models/<id>/model.ts
    bun scripts/check-model.ts <registry> <id>    # measures, and draws it
    LOOK AT THE PNG
    bun scripts/check-model.ts <registry> <id> --angles 6

One script serves both kits. `contemporary-props/check.ts <id>` still works and
is now a two-line wrapper over it; the two copies had begun to drift, and a
checker that differs between kits says different things about the same fault.

`check-model.ts` deliberately does NOT rebuild the registry or install anything. The
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
`scripts/check-model.ts` and `scripts/audit.ts` exist to catch what the critic
cannot see.

### The critic, and what it is worth

`scripts/critique-model.ts` is the half of the loop that was missing. It
renders a model at four angles, hands a critic the brief, the CATALOGUE ROW and
the reference photograph, and never the code, and takes back JSON: a score, a
blind "would you name it", at most three resemblance gaps each naming a
measurable quantity, and modelling errors listed separately with locations. One
file per model under `critiques/`, so twenty models leave twenty comparable
numbers instead of twenty opinions.

It works, and the first thing it did was catch something a person had missed:
the mill's body was tan against a black reference, which no amount of geometry
was ever going to fix, and it said so as its top finding three rounds running.

It is also a NOISY INSTRUMENT and the numbers matter here. Six rounds on the
pepper mill scored 68, 68, 69, 79, 74, 78. The findings rotate: an item raised
as most important in one round vanishes from the next. And in the last round
two of its three measurements were simply wrong — it reported the model at
2.7:1 height to diameter and its collar at 0.29 diameters, where the geometry
is 3.65 and 0.44. That is the same lesson the medieval kit already wrote down,
reproduced exactly: **a critic finding is a report, not a fact.**

Two more rounds sharpened what it is good for. It is RELIABLE ON PRESENCE:
"no foot ring is visible", "no outlet hole across four views", "no knurl on the
knob" were all true, all repeated until fixed, and all things a person had
walked past. It is UNRELIABLE ON QUANTITY: in the gas cylinder's second round
every one of its three measurements failed checking, and two inverted the real
relationship — it called the foot ring 60% of the bottle's diameter against a
reference's 35% where both are in fact 43%, and called the guard ring deeper
than the reference's where it is shallower. Take the noun, check the number.

So before acting on a number, falsify it. `bun scripts/check-model.ts <registry>
<id>` prints the real extent in one line, and the source has the real
fractions. Act on findings that repeat across rounds, because those are signal;
the mill's knob was reported as having no knurl in every single round and that
one was true. Two plateaus means the reference or the representation has to
change, not that the grinding continues: the plateau at 68 was the tan-against-
black mismatch, and it broke the moment the reference was re-shot to the
material the kit actually declares.

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

## Where the scores stand

Every model has been scored by a blind critic against its reference photograph:
brief, reference and a four-angle render, never the code. 85 is acceptance.

The kit sits around 71 on average and one model, the ladder, has reached 85.
That is the honest number and it did not move as fast as the work did. Three
rounds of rebuilding produced mean gains of +3.1, +4.1 and +1.7, so the returns
are falling, and several models have now plateaued or gone backwards on a pass.

What moved things most was not the rebuilding. The largest single gain in the
kit belongs to a model nobody touched: the hand cart went from 68 to 79 on the
palette corrections alone. The colour work is measured against the references
with `woodcmp` (decode both PNGs, filter to warm pixels, compare median hue,
saturation and lightness) and it is cheap, kit-wide and verifiable, where a
rebuild is expensive and moves one model.

Two rules came out of the scoring worth keeping:

- **The score is not the object.** Deltas of one or two points are critic noise.
  Read the "would you name it blind" answer first; it is binary and it is the
  only question the kit exists to pass. One model currently fails it.
- **A critic finding is a report, not a fact.** Checked against the geometry,
  four separate findings this session were misreadings: a bell's "floating black
  disc" was its own mouth ring, a barrel's "missing head" was present and lit
  from any angle that could see it, a pitchfork's "tines pinched to a point"
  were already spaced, and a shovel's "flattened slab grip" was a round bar.
  Each cost a measurement to disprove and would have cost a wrong rebuild.
- **It reverses itself, and that is the plateau.** The extinguisher's third
  round said the two black members were "roughly twice the reference thickness";
  they were measured at 1.6x and halved. Its fourth round, on the halved model,
  said they were "2-3 times thinner" than the reference. The same round called
  the stepped valve too many tiers after the previous round had demanded the
  steps. Measured off the photograph the members are 8.5% of bottle diameter
  against the reference's 8%, so the second complaint is simply wrong, and so
  were the gauge diameter and head height it offered next.

  The useful reading is that **once a critic starts contradicting its own last
  round, the score has stopped measuring the model and started measuring the
  critic.** Three consecutive 79s with no build findings and every remaining
  claim refuted by measurement is a finished model, not a stuck one. The same
  critic was reliable throughout on presence -- no foot ring, no outlet hole,
  no knurl, no needle, no tick ring, no pivot bracket were all true and all
  worth fixing. Presence it can see; quantity it guesses.

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

**A clean result on the axes you chose says nothing about the axis you did
not.** Eleven separate critics called the kit's timber pink. The palette comment
said colour had already been measured and settled: hue was right to one degree,
saturation had been corrected and the remaining spread was 93% of the
references'. Both were true. Nobody had measured LIGHTNESS, and across nine
timber models the render sat a median 0.13 above its reference, worst on the
chest at 0.21. Light plus slightly red is pink. The measurement was sound and
its conclusion, written into the source as "what remains is geometry, not
colour", was false.

**A large offset on a dark palette rides the clip, and then the dice decide.**
The anvil block darkened `oak` by a further 0.26, tuned when `oak` was a lighter
colour. After the palette moved it landed within one jitter of black, and
`createTinter` jitters lightness by up to 0.05 either way. Two renders that
differed only in how many geometry calls ran before it came out brown and then
black, because the tint reads from the same seeded stream the geometry does.
Adding a part to a model reshuffles every colour downstream of it.

**"We chose differently" is a defence. "It does not read as the thing" is not.**
The hoe's own header argued that the reference was a strap hoe while the model
was deliberately a gooseneck, that both are period-correct, and that bending
toward the photograph would be changing the design. Every clause was true, and
it was used to dismiss a critique whose actual content was that the object read
as a scythe. It did: the neck bent 112 degrees, and a bar bent from tangent to
+Y rises before it falls, so the blade sat 69 mm above the top of the shaft.

**Rejecting one axis is not a reason to discard the others measured beside it.**
Straw was exempted from a colour correction on an argument that was half right.
The measurement had said it was both too yellow and too washed out; the
saturation half was rejected for a good reason that still holds, since a
photograph of a bale reads desaturated because it is thousands of straws each
shading its neighbour, and pushing a flat lowpoly surface to that number only
makes it garish. The hue half was thrown out along with it and nothing checked
lightness at all. Measured later, straw sat 11 degrees too yellow and a median
0.18 too light. A bale rendered the colour of butter for months.

**Moving a palette constant moves everything hanging off it, and some of it goes
through the floor.** Lightness offsets are LINEAR, so the whole palette lives
between about 0.03 and 0.36 and a lift written as -0.28 is enormous rather than
gentle. Taking `cloth` from linear lightness 0.364 to 0.252 sent nine parts
across six models straight through zero in one edit: a market stall's entire
trestle, two stretchers, three cords and a set of bindings.

The symptom is the part worth remembering. A crushed part does not look black.
A zero albedo contributes nothing, so all that survives is the white specular
highlight and the part renders NEUTRAL GREY: a market stall built entirely of
oak came out looking like a grey steel frame. Nothing caught it. The geometry
was fine, nothing floated, the slots resolved, the triangle count was unchanged.
`createTinter` now floors lightness, and `verify-model.ts` fails any part whose
mean linear luminance falls below 0.009.

**Never divide by a config value whose slider reaches zero.** The shovel fitted
two radii to its dish as halfWidth squared over twice the curve. At `dish: 0`
that is a division by zero, the arc collapses, and `arcBarGeometry` returns
non-finite vertices. The damage did not stay in the blade: the occlusion bake
reads every vertex in the model, so one NaN position turned the colour attribute
of the shaft and the socket to NaN as well. The only check that noticed was the
z-fighting one, which reported 2278 overlapping faces on planes whose normals
were NaN. Floor the input, not each value derived from it.

**A default equal to the value the test patches it to is a silent failure.** The
harness calls `configure()` with a patch and requires a rebuild. An agent read a
critique asking for three ropes, set the default rope count to three, and the
patch became a no-op. The model was correct and the protocol check failed.

**`tsc` says nothing about the tree you just edited.** `tsconfig.json` includes
`src`, `scripts` and `vite.config.ts`, and neither authoring tree is in that
list. Editing `my-registry/models/**` and running `bunx tsc --noEmit` is a check
that cannot fail, because the compiler never opens the file. It only sees the
copy under `src/models/**`, so a type error appears one rebuild and one install
later. Two models were written this session with a `Color` annotation and no
import, and both reported a clean typecheck until the install carried them over.
`bun` runs them either way: it strips types without checking them.

**A correction applied twice is a new error.** After the palette entries were
measured and moved, three models that had been carrying their own compensating
offsets went wrong in the opposite direction. The basket took a third off oak's
saturation to make willow, and oak had since been desaturated itself, so the
basket landed 0.20 grey of its reference. The market stall subtracted 0.08 of
lightness for weathering, and oak's whole linear lightness is 0.067, so its
timber clamped to the floor and every part came out the same flat value. The
rule that catches these: an offset is a statement about the DIFFERENCE between a
model and the palette, so when the palette moves to meet the references, every
offset that was standing in for the same correction has to shrink.

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

- **`contemporary-props`**: 9 of the core 100 modelled, and they are the first
  rows of the build order rather than nine picked at random. The catalogue, the
  order, the cuts and the slot argument are in
  `contemporary-props/CATALOGUE.md`; row 10 is `pedestal-basin`. The number 119
  appeared here twice and was never anything: the catalogue is 100 core plus a
  further 150.

  The two that were listed here as wrong are done, both rebuilt against a
  photograph rather than by eye. The pepper mill was a turned baluster and is
  now the straight tube a present-day one is, with a steel collar, a recessed
  band of vertical flutes and a knurled knob. The mug's foot is rounded rather
  than chamfered and its handle is a twelve-sided section instead of a square
  strap turned the wrong way round.

  Two things learned there that the next model should not have to learn again.
  A reference hint decides what the reference is and the reference decides what
  the model becomes, so a hint must not invent a material or a period: writing
  "a tall WOODEN pepper mill" produced a handsome traditional baluster, the
  model was rebuilt to match it, and its flute band was deleted for not
  appearing in a photograph the hint had asked for. Read the catalogue's row
  for a model before touching it; that band is the reason the mill is fourth in
  the build order at all. And a reference is to be READ, not copied: it carries
  about forty flutes, and forty at prop scale is four pixels each and a grey
  smear. Twenty-two is the same object at the size it is actually seen.
  `pepper-mill` reads as a wooden bottle and needs rewriting. `coffee-mug`'s
  handle is a flat strap whose wide face turns toward the camera; the section
  wants to be squarer and deeper in the plane of the loop.
- **The pipeline** needs rebuilding onto the vibe-model protocol: references,
  a blind critic, a score, three fixes, a stop condition, and a revise stage.
  There is currently no revise stage at all, so a critic's findings go nowhere.
- **A medieval pass** with that pipeline, before anything else is added to it.
- **vibe3d PR**: MERGED. `vibe-stack/vibe3d#11` landed on 2026-08-30 and seeds
  `@medieval-kit` into what `vibe3d init` writes, so the README's "add it to
  `models.json` yourself" step is gone on a current CLI. A second contribution,
  the floating check,
  is not ready: it ran on 174 of their models unmodified but flagged 28, and the
  small-piece flags are artifacts of deriving voxel size from the longest axis.
- **`reflexive_keygen`**: the branch and tag were rewritten to the noreply
  identity, but the orphaned commit is still publicly readable. Making the
  repository private closes it.
