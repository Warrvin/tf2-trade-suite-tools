export const PRICEDB_CHECK_CHANNEL = 'tf2suite:pricedb-check-button';
export const PRICEDB_CHECK_FEATURE_ID = 'pricedb-check-button';

/** Запрос без параметров — MAIN всегда отдаёт имена по всем предметам, которые уже видел (см. utils/inventory-watch.ts). */
export type PricedbCheckRequest = Record<string, never>;

/** assetId -> "приайсабельное" имя предмета (см. utils/pricedb.ts#buildPriceableName). */
export type PricedbNameSnapshot = Record<string, string>;
