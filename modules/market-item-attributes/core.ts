import { respondInMain } from '../../utils/bridge';
import { getItemAttributes, ItemAttributes } from '../../utils/item-attributes';
import { readMarketItemSource } from '../../utils/market-item-source';
import { MARKET_ATTRIBUTES_CHANNEL, MarketAttributesRequest, MarketAttributesResult, MarketAttributesSnapshot } from './types';

/**
 * Регистрирует обработчик в MAIN world. Чтение "сырых" предметов страницы
 * (классика/бета, betaOrder) вынесено в utils/market-item-source.ts — общее
 * с modules/market-pricedb-check-button (требование 4, см. комментарий там);
 * здесь остаётся только специфика ЭТОГО модуля — превращение SteamEconItem в
 * ItemAttributes.
 */
export function registerMarketAttributesCoreHandler(): () => void {
  return respondInMain<MarketAttributesRequest, MarketAttributesResult>(MARKET_ATTRIBUTES_CHANNEL, async () => {
    const { itemByAssetId, betaOrder } = readMarketItemSource();
    const snapshot: MarketAttributesSnapshot = {};
    for (const assetId of Object.keys(itemByAssetId)) {
      snapshot[assetId] = getItemAttributes(itemByAssetId[assetId]);
    }
    return { snapshot, betaOrder };
  });
}
