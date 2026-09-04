import type { ItemAttributes } from '../../utils/item-attributes';

export const INVENTORY_ATTRIBUTES_CHANNEL = 'tf2suite:inventory-item-attributes';
export const INVENTORY_ATTRIBUTES_FEATURE_ID = 'inventory-item-attributes';

/** Запрос без параметров — MAIN всегда отдаёт текущий снимок целиком. */
export type InventoryAttributesRequest = Record<string, never>;

/**
 * Снимок атрибутов ОДНОГО инвентаря (страница /profiles|id/<x>/inventory
 * показывает ровно один инвентарь за раз, в отличие от окна оффера с двумя
 * сторонами — поэтому, в отличие от AttributesSnapshot трейд-модуля, тут
 * нет me/partner, только один assetId -> атрибуты). Растёт по мере того,
 * как MAIN-сторона наблюдает собственные fetch/XHR-запросы страницы к
 * /inventory/<id>/440/2 (см. core.ts) — Steam подгружает инвентарь
 * постранично при скролле, а не отдаёт всё сразу.
 */
export type InventoryAttributesSnapshot = Record<string, ItemAttributes>;
