import { respondInMain } from '../../utils/bridge';
import { CurrencyCounts, emptyCurrencyCounts, getCurrencyKindFromName } from '../../utils/currency';
import { getItemAttributes, SteamEconItem } from '../../utils/item-attributes';
import { buildPriceableName } from '../../utils/pricedb';
import { getInventory, TradeOfferWindow, TradeStatusAsset } from '../../utils/trade-offer';
import { TRADE_SUMMARY_CHANNEL, TradeOtherItem, TradeSideSummary, TradeSummaryRequest, TradeSummarySnapshot } from './types';

/**
 * Считает валюту/прочие предметы для ОДНОЙ стороны оффера: берёт assetId'ы
 * из g_rgCurrentTradeStatus (что реально лежит в слотах прямо сейчас) и по
 * каждому смотрит имя предмета в соответствующем инвентаре (полученном через
 * getInventory, проверяющий g_rgAppContextData, UserYou, UserThem и т.д.).
 */
function summarizeSide(assets: TradeStatusAsset[] | undefined, inventory: Record<string, SteamEconItem> | undefined): TradeSideSummary {
  const counts: CurrencyCounts = emptyCurrencyCounts();
  let otherCount = 0;
  const otherByName = new Map<string, number>();

  for (const asset of assets ?? []) {
    if (String(asset.appid) !== '440' || String(asset.contextid) !== '2') continue;
    const amount = Number(asset.amount) || 1;

    const item = inventory?.[asset.assetid];
    const kind = getCurrencyKindFromName(item?.market_hash_name ?? item?.name);
    if (kind) {
      counts[kind] += amount;
      continue;
    }

    otherCount += amount;
    if (item) {
      const name = buildPriceableName(item, getItemAttributes(item));
      otherByName.set(name, (otherByName.get(name) ?? 0) + amount);
    }
  }

  const otherItems: TradeOtherItem[] = [...otherByName.entries()].map(([name, amount]) => ({ name, amount }));
  return { currency: counts, otherCount, otherItems };
}

/**
 * Регистрирует обработчик в MAIN world: по запросу с ISOLATED-стороны читает
 * ЖИВОЙ (не снятый один раз при загрузке) g_rgCurrentTradeStatus — то есть
 * каждый вызов видит самое актуальное состояние оффера, включая изменения,
 * которые Steam внёс уже после того, как страница открылась.
 */
export function registerTradeSummaryCoreHandler(): () => void {
  return respondInMain<TradeSummaryRequest, TradeSummarySnapshot>(TRADE_SUMMARY_CHANNEL, async () => {
    const win = window as unknown as TradeOfferWindow;
    const status = win.g_rgCurrentTradeStatus;
    const myInv = getInventory(win, true);
    const partnerInv = getInventory(win, false);

    return {
      me: summarizeSide(status?.me?.assets, myInv),
      partner: summarizeSide(status?.them?.assets, partnerInv),
    };
  });
}
