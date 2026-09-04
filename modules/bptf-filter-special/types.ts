/**
 * Модуль без RPC-моста — как и bptf-listing-trade-params/bptf-ks-tier-buttons
 * (см. их types.ts за тем же обоснованием): работает целиком на стороне
 * classic backpack.tf, читая/меняя только обычный DOM текущей вкладки, без
 * доступа к каким-либо JS-объектам ЧУЖОЙ страницы.
 */
export const BPTF_FILTER_SPECIAL_FEATURE_ID = 'bptf-filter-special';
