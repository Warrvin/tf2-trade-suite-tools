import { respondInMain } from '../../utils/bridge';
import { getItemAttributes } from '../../utils/item-attributes';
import { buildPriceableName } from '../../utils/pricedb';
import { readMarketItemSource } from '../../utils/market-item-source';
import { MARKET_PRICEDB_CHANNEL, MarketPricedbRequest, MarketPricedbResult, MarketPricedbSnapshot } from './types';

/**
 * Регистрирует обработчик в MAIN world. Чтение "сырых" предметов страницы —
 * utils/market-item-source.ts, общее с modules/market-item-attributes
 * (требование 4, см. комментарий там); здесь остаётся только специфика
 * ЭТОГО модуля — построение priceable-имени (utils/pricedb.ts#buildPriceableName,
 * чистая функция, без сети — сеть делает ТОЛЬКО ISOLATED-сторона, apply.ts).
 */
export function registerMarketPricedbCoreHandler(): () => void {
  return respondInMain<MarketPricedbRequest, MarketPricedbResult>(MARKET_PRICEDB_CHANNEL, async () => {
    const { itemByAssetId, betaOrder } = readMarketItemSource();
    const snapshot: MarketPricedbSnapshot = {};
    for (const assetId of Object.keys(itemByAssetId)) {
      const item = itemByAssetId[assetId];
      snapshot[assetId] = buildPriceableName(item, getItemAttributes(item));
    }
    return { snapshot, betaOrder };
  });
}
