/**
 * @medieval-kit/wooden-shovel
 *
 * Üçüncü deneme. İlk ikisi başarısızdı ve ikisi de aynı sebepten: ağzı düz
 * parçalardan kurmaya çalıştım.
 *
 *   1. deneme — iki kutuyu uç uca koydum. "Kürek şekli" çıktı, kürek çıkmadı.
 *   2. deneme — üç düz paneli hafifçe döndürüp yan yana dizdim. Paneller kendi
 *      merkezleri etrafında döndüğü için aralarında kademe kaldı; göz onu tek
 *      yüzey değil "üç tahta" olarak okudu.
 *
 * Küreği kürek yapan şey ağzın TEK SÜREKLİ İÇBÜKEY YÜZEY olması: toprağı tutan
 * çukur. `dishedSheetGeometry` tam bunun için yazıldı — enine kesiti kavisli,
 * genişliği ve kalınlığı boyunca değişen dikişsiz bir levha.
 *
 * Siluet: sokette dar boyun, %45'te en geniş, uca doğru yumuşak daralma.
 * Arkada ayak basamağı — gerçek kürekte ağzın üst kenarı kıvrılır, ayakla
 * bastırmak için.
 */
import { type BufferGeometry } from 'three'

import {
  chamferedBoxGeometry,
  createKitModel,
  dishedSheetGeometry,
  ironTint,
  steelTint,
  mergeColoured,
  toolShaft,
  toolSocket,
  type SheetLevel,
} from '../core/index.ts'

export interface WoodenShovelConfig {
  readonly length: number
  readonly shaftRadius: number
  /** Ağzın en geniş yeri (metre). */
  readonly bladeWidth: number
  /** Ağız uzunluğu, toplam boyun oranı olarak. */
  readonly bladeLength: number
  /** Kepçenin derinliği: kenarların ortaya göre kalkması. 0 = düz levha. */
  readonly dish: number
  /** Ağzın sapa göre eğimi (derece). */
  readonly bladeAngle: number
  readonly seed: number
}

export const woodenShovelDefaults: WoodenShovelConfig = {
  length: 1.16,
  shaftRadius: 0.022,
  bladeWidth: 0.27,
  bladeLength: 0.27,
  dish: 0.17,
  bladeAngle: 9,
  seed: 31,
}

export type WoodenShovelParts = 'shaft' | 'socket' | 'blade'

export function createModel(overrides: Partial<WoodenShovelConfig> = {}) {
  return createKitModel<WoodenShovelConfig, 'oak' | 'iron' | 'steel', WoodenShovelParts>({
    id: 'wooden-shovel',
    defaults: woodenShovelDefaults,
    slots: ['oak', 'iron', 'steel'],
    build: ({ config, random }) => {
      const span = config.length * config.bladeLength
      const shaftLength = config.length - span * 0.82
      const shaft = toolShaft({ length: shaftLength, radius: config.shaftRadius, random })

      const socketLength = config.length * 0.05
      const socket = toolSocket({
        y: shaft.top - socketLength * 0.3,
        shaftRadius: shaft.topRadius,
        length: socketLength,
        random,
      })

      const half = config.bladeWidth / 2
      const t = config.length * 0.011
      const curve = config.bladeWidth * config.dish

      // Enine kesit profili — DÖRDÜNCÜ deneme, bu kez siluet yüzünden.
      //
      // Üçüncü deneme geometrik olarak doğruydu (tek sürekli çukur yüzey) ama
      // hâlâ kürek gibi durmuyordu: kenarlar ortada şişip uca doğru yumuşakça
      // kapanıyordu, yani KAŞIK profili. Kürek kaşık değildir: yanları boyunca
      // neredeyse PARALEL gider, sonra uçta kısa bir pahla biter. Toprağı tutan
      // şey o paralel kısım; onsuz elde ettiğin şey bir spatula oluyor.
      const profile: SheetLevel[] = [
        { y: 0, halfWidth: half * 0.24, thickness: t * 1.5, curve: curve * 0.08 },
        { y: span * 0.11, halfWidth: half * 0.82, thickness: t * 1.15, curve: curve * 0.4 },
        { y: span * 0.28, halfWidth: half * 0.99, thickness: t * 0.95, curve: curve * 0.85 },
        { y: span * 0.62, halfWidth: half, thickness: t * 0.82, curve },
        { y: span * 0.85, halfWidth: half * 0.95, thickness: t * 0.6, curve: curve * 0.94 },
        { y: span * 0.96, halfWidth: half * 0.74, thickness: t * 0.32, curve: curve * 0.72 },
        { y: span, halfWidth: half * 0.44, thickness: t * 0.14, curve: curve * 0.48 },
      ]

      const sheet = dishedSheetGeometry(profile, 8, steelTint(random, -0.04), steelTint(random, 0.04))

      // Ayak basamağı: ağzın üst kenarındaki kıvrım, çukurun ARKASINDA. Omuz
      // hizasında ve GENİŞ olmalı — üstüne basılan yer burası, dar bir çıkıntı
      // hem işlevsiz hem de siluette hiç görünmüyor.
      const tread = chamferedBoxGeometry(
        [config.bladeWidth * 0.78, t * 2.4],
        [config.bladeWidth * 0.7, t * 1.9],
        t * 1.8,
        t * 0.34,
        [0, 0, 0],
        steelTint(random, -0.07),
      )
      tread.rotateX(0.42)
      tread.translate(0, span * 0.12, -t * 1.7)

      // Sırt kayışı: soketten çıkıp ağzın ARKASINDA yukarı uzanan dövme demir.
      // Küreği kürek yapan ikinci şey bu. Onsuz ağız, sapın ucuna yapıştırılmış
      // bir levha gibi duruyor; gerçek kürekte ağzı taşıyan şey o kayıştır ve
      // gözün "bu nasıl duruyor" sorusunu cevaplayan da odur.
      const strap = chamferedBoxGeometry(
        [config.shaftRadius * 2.3, t * 2.2],
        [config.shaftRadius * 1.1, t * 1.4],
        span * 0.5,
        t * 0.3,
        [0, span * 0.22, -t * 1.4],
        ironTint(random, -0.02),
      )

      const blade: BufferGeometry = mergeColoured([sheet, tread])
      // İkisi de AYNI dönüşümden geçmeli, yoksa kayış ağzın arkasında kalmaz.
      for (const piece of [blade, strap]) {
        // Ağız sapla tam hizada değil, hafifçe öne eğik: toprağa dalması için.
        piece.rotateX(-(config.bladeAngle * Math.PI) / 180)
        piece.translate(0, shaft.top - span * 0.06, 0)
      }

      return {
        shaft: { slot: 'oak', geometry: shaft.geometry },
        socket: { slot: 'iron', geometry: socket },
        blade: {
          slot: 'steel',
          geometry: blade,
          extras: [{ slot: 'iron', geometry: strap }],
        },
      }
    },
  }, overrides)
}
