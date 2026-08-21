# Drafts

Models in this folder are **not compiled** into the registry — `build.ts` only
walks `models/`. The code is kept, but it never enters the published package.

## iron-brazier

An iron brazier with a flickering flame, glowing coals, and a light of its own.
It works, technically (typed `actions`, `update()`, four material slots), but it
does not belong to the kit's language: the backbone of a medieval kit is not one
showpiece model, it is the many plain pieces that build a scene once they stand
next to each other.

To pull it back into the kit, move it under `models/` and add its entry to
`MODEL_META` in `meta.ts`.
