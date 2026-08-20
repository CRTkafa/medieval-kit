import { Group } from 'three'

import type { PartHandle } from '@vibe3d/model.ts'

/**
 * Semantik parça yuvası: sabit anchor + değiştirilebilir içerik.
 *
 * vibe3d'nin en kolay yanlış anlaşılan sözleşmesi bu. `PartHandle` iki ayrı
 * nesne bildirir ve ikisi AYNI OLAMAZ:
 *
 *   anchor   modelin ömrü boyunca aynı nesne. Tüketici ışığını, etiketini,
 *            çarpışma gövdesini, gameplay nesnesini buraya takar.
 *   content  configure() her çağrıldığında atılıp yeniden kurulan geometri.
 *
 * İkisini aynı Group yapıp rebuild'de `clear()` çağırmak, tüketicinin taktığı
 * her şeyi de sessizce siler — model çalışmaya devam eder, ama protokolün asıl
 * vaadi bozulmuştur. `scripts/verify-model.ts` bunu ayrıca test ediyor.
 */
export interface PartSlot extends PartHandle<Group> {
  readonly anchor: Group
  readonly content: Group
  /** İçeriği taze bir Group ile değiştirir ve onu döndürür. Anchor'a dokunmaz. */
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
