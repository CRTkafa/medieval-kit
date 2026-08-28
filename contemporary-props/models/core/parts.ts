import { Group } from 'three'

import type { PartHandle } from '@vibe3d/model.ts'

/**
 * Semantic part slot: fixed anchor + replaceable content.
 *
 * This is the most easily misunderstood contract in vibe3d. `PartHandle`
 * declares two separate objects and they CANNOT BE THE SAME:
 *
 *   anchor   the same object for the lifetime of the model. The consumer
 *            attaches its light, its label, its collision body, its gameplay
 *            object here.
 *   content  the geometry that is thrown away and rebuilt every time
 *            configure() is called.
 *
 * Making both the same Group and calling `clear()` on rebuild silently deletes
 * everything the consumer attached too — the model keeps working, but the
 * protocol's actual promise is broken. `scripts/verify-model.ts` tests this
 * separately.
 */
export interface PartSlot extends PartHandle<Group> {
  readonly anchor: Group
  readonly content: Group
  /** Replaces the content with a fresh Group and returns it. Leaves the anchor alone. */
  reset(): Group
}

export function createPart(name: string): PartSlot {
  const anchor = new Group()
  anchor.name = name
  let content = new Group()
  content.name = `${name}/content`
  anchor.add(content)

  return {
    anchor,
    get content(): Group {
      return content
    },
    reset(): Group {
      anchor.remove(content)
      content = new Group()
      content.name = `${name}/content`
      anchor.add(content)
      return content
    },
  }
}
