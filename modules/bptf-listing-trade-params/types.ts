/**
 * Модуль без RPC-моста — см. README §"Модуль `bptf-listing-trade-params`" и
 * core.ts за тем, почему: он работает целиком на стороне backpack.tf,
 * читая/меняя только обычный DOM (`data-*`-атрибуты, `href` ссылок), без
 * доступа к каким-либо JS-объектам ЧУЖОЙ страницы (в отличие от модулей
 * страницы оффера Steam, которым для этого нужен `world: 'MAIN'` и
 * utils/bridge.ts). Поэтому здесь только id для настроек — ни канала, ни
 * типов запрос/ответ.
 */
export const BPTF_LISTING_PARAMS_FEATURE_ID = 'bptf-listing-trade-params';
