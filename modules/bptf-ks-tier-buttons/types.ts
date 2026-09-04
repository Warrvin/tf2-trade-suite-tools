/**
 * Модуль без RPC-моста — как и bptf-listing-trade-params (см. его types.ts
 * за тем же обоснованием): работает целиком на стороне classic backpack.tf,
 * читая/меняя только обычный DOM и URL текущей вкладки, без доступа к
 * каким-либо JS-объектам ЧУЖОЙ страницы. Поэтому здесь только id для
 * настроек — ни канала, ни типов запрос/ответ.
 */
export const BPTF_KS_TIER_BUTTONS_FEATURE_ID = 'bptf-ks-tier-buttons';
