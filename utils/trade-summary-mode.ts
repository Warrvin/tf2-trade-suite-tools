/**
 * Режим модуля trade-item-summary — по предложению пользователя, у модуля 2
 * варианта работы с НЕ-валютными предметами оффера:
 *  - 'simple' (по умолчанию) — просто число прочих предметов, без цены,
 *    без сети (см. modules/trade-item-summary/core.ts — считает всё из уже
 *    загруженных Steam'ом глобалей, 0 доп. запросов).
 *  - 'priced' — то же плюс их суммарная цена по данным PriceDB.io
 *    (utils/pricedb.ts): для каждого уникального предмета один раз
 *    резолвится SKU и цена (sku.pricedb.io + pricedb.io — оба CORS-открытые
 *    публичные API, без ключа), результат кэшируется на время жизни вкладки.
 * Формат — тот же паттерн, что и utils/icon-detail-level.ts (общий тип
 * опции, хранится в moduleOptions конкретного модуля, см. utils/settings.ts).
 */
export type TradeSummaryMode = 'simple' | 'priced';
export const TRADE_SUMMARY_MODE_OPTION_KEY = 'mode';
export const DEFAULT_TRADE_SUMMARY_MODE: TradeSummaryMode = 'simple';
