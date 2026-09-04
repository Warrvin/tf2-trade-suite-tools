export const MARKET_PRICEDB_CHANNEL = 'tf2suite:market-pricedb-check-button';
export const MARKET_PRICEDB_FEATURE_ID = 'market-pricedb-check-button';

export type MarketPricedbRequest = Record<string, never>;

/** assetId -> "приайсабельное" имя предмета (см. utils/pricedb.ts#buildPriceableName), по всем листингам, которые сейчас видел MAIN. */
export type MarketPricedbSnapshot = Record<string, string>;

/**
 * betaOrder заполнен ТОЛЬКО на бета-версии Market — см.
 * modules/market-item-attributes/types.ts (тот же смысл, тот же источник —
 * utils/market-item-source.ts, требование 4).
 */
export interface MarketPricedbResult {
  snapshot: MarketPricedbSnapshot;
  betaOrder?: string[];
}
