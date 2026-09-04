import type { ItemAttributes } from '../../utils/item-attributes';

export const MARKET_ATTRIBUTES_CHANNEL = 'tf2suite:market-item-attributes';
export const MARKET_ATTRIBUTES_FEATURE_ID = 'market-item-attributes';

// IconDetailLevel и друзья — общие для всех трёх "атрибуты предмета"-модулей
// (trade-item-attributes, inventory-item-attributes и этот), все используют
// один и тот же рендерer, utils/item-attribute-render.ts (требование 4 —
// не дублировать функционал).
export { ICON_DETAIL_OPTION_KEY, DEFAULT_ICON_DETAIL_LEVEL } from '../../utils/icon-detail-level';
export type { IconDetailLevel } from '../../utils/icon-detail-level';

/** Запрос без параметров — MAIN всегда отдаёт атрибуты по всем предметам сразу. */
export type MarketAttributesRequest = Record<string, never>;

/** assetId -> атрибуты, по всем листингам этого предмета, которые сейчас видел MAIN (window.g_rgAssets на классике, перехват на бете). */
export type MarketAttributesSnapshot = Record<string, ItemAttributes>;

/**
 * Ответ MAIN-стороны. `betaOrder` заполнен ТОЛЬКО на бета-версии Market
 * (см. utils/market-beta-watch.ts) — на классике не нужен и не заполняется, там строку
 * в DOM и запись в снимке связывает настоящий assetId, разобранный из
 * Buy-ссылки (см. apply.ts, getAssetIdFromRow). На бете такого id в
 * разметке нет вообще, поэтому единственный мост — порядок: `betaOrder[i]`
 * это assetId N-й ещё не размеченной Buy-кнопки на странице (позиционное
 * сопоставление, экспериментально — см. README).
 */
export interface MarketAttributesResult {
  snapshot: MarketAttributesSnapshot;
  betaOrder?: string[];
}
