import type { ItemAttributes } from '../../utils/item-attributes';

export const ATTRIBUTES_CHANNEL = 'tf2suite:trade-item-attributes';
export const ATTRIBUTES_FEATURE_ID = 'trade-item-attributes';

// IconDetailLevel и друзья переехали в utils/icon-detail-level.ts — общие
// для этого модуля и inventory-item-attributes (оба используют один и тот
// же рендерer, utils/item-attribute-render.ts). Реэкспорт здесь, чтобы не
// трогать существующие импорты по всему проекту.
export { ICON_DETAIL_OPTION_KEY, DEFAULT_ICON_DETAIL_LEVEL } from '../../utils/icon-detail-level';
export type { IconDetailLevel } from '../../utils/icon-detail-level';

/** Запрос без параметров — MAIN всегда отдаёт атрибуты по обеим сторонам сразу. */
export type AttributesRequest = Record<string, never>;

/**
 * Снимок атрибутов ОБЕИХ сторон трейда разом. Считается MAIN-скриптом за
 * один проход по window.g_rgAppContextData / g_rgPartnerAppContextData —
 * это дешевле, чем спрашивать per-предмет: атрибуты каждого предмета — это
 * несколько булевых полей и опциональное число, а не сетевой запрос.
 */
export interface AttributesSnapshot {
  meSteamId: string | null;
  partnerSteamId: string | null;
  /** assetId -> атрибуты, для инвентаря 440/2 текущего пользователя. */
  me: Record<string, ItemAttributes>;
  /** assetId -> атрибуты, для инвентаря 440/2 партнёра по трейду. */
  partner: Record<string, ItemAttributes>;
}
