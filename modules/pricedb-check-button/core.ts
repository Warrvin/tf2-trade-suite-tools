import { respondInMain } from '../../utils/bridge';
import { getItemAttributes } from '../../utils/item-attributes';
import { buildPriceableName } from '../../utils/pricedb';
import { installInventoryWatch } from '../../utils/inventory-watch';
import { PRICEDB_CHECK_CHANNEL, PricedbCheckRequest, PricedbNameSnapshot } from './types';

/**
 * MAIN-world сторона: переиспользует ОБЩИЙ перехват fetch/XHR инвентаря
 * (utils/inventory-watch.ts — тот же, что у inventory-item-attributes и
 * inventory-currency-counter, требование 4 — не дублировать функционал) и
 * по запросу строит имя для PriceDB.io (utils/pricedb.ts#buildPriceableName,
 * чистая функция, никакой сети — сеть делает ТОЛЬКО ISOLATED-сторона,
 * panel.ts, см. комментарий в шапке utils/pricedb.ts) по каждому предмету,
 * которого MAIN уже видел на этой вкладке.
 */
function collectNames(): PricedbNameSnapshot {
  const { itemByAssetId } = installInventoryWatch();
  const result: PricedbNameSnapshot = {};
  for (const [assetId, item] of itemByAssetId) {
    result[assetId] = buildPriceableName(item, getItemAttributes(item));
  }
  return result;
}

export function registerPricedbCheckCoreHandler(): () => void {
  installInventoryWatch();
  return respondInMain<PricedbCheckRequest, PricedbNameSnapshot>(PRICEDB_CHECK_CHANNEL, async () => collectNames());
}
