/**
 * URL-построители для иконок атрибутов предметов.
 *
 * Требование 6 — иконки должны быть "точь-в-точь" как в Steam Trade Offer
 * Enhancer 2.2.8. Изначально планировался гибрид (spell/parts/killstreak —
 * забандлить внутрь расширения, unusual-эффекты — хотлинк на itempedia.tf,
 * см. README). На практике самый надёжный способ дать пиксель-в-пиксель
 * идентичную картинку — сослаться на тот же файл, что открывает оригинал,
 * а не на свою копию (которая к тому же может разойтись при следующем
 * обновлении оригинала). Поэтому пока все четыре типа иконок хотлинкаются
 * на исходные хосты — ровно те же URL, что использует сам Steam Trade Offer
 * Enhancer. Если понадобится офлайн-режим — это единственное место, которое
 * нужно поменять на локальные файлы в public/icons/.
 */
export const ICON_URLS = {
  spell: 'https://scrap.tf/img/spell.png',
  parts: 'https://itempedia.tf/assets/wrench.png',
  killstreak: 'https://itempedia.tf/assets/icon-ks.png',
} as const;

export type IconKind = keyof typeof ICON_URLS;

/** URL картинки Unusual-эффекта по его числовому id (см. utils/unusual-effects.ts). */
export function getEffectURL(effectId: number): string {
  return `https://itempedia.tf/assets/particles/${effectId}_94x94.png`;
}
