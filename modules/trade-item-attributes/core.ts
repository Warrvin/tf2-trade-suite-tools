import { respondInMain } from '../../utils/bridge';
import { getItemAttributes, ItemAttributes, SteamEconItem } from '../../utils/item-attributes';
import { getInventory, TradeOfferWindow } from '../../utils/trade-offer';
import { ATTRIBUTES_CHANNEL, AttributesRequest, AttributesSnapshot } from './types';

function collectAttributes(inventory: Record<string, SteamEconItem> | undefined): Record<string, ItemAttributes> {
  const result: Record<string, ItemAttributes> = {};
  if (!inventory) return result;

  for (const [assetId, item] of Object.entries(inventory)) {
    result[assetId] = getItemAttributes(item);
  }
  return result;
}

/**
 * Регистрирует обработчик в MAIN world: по запросу с ISOLATED-стороны
 * читает полные данные инвентарей обеих сторон (через getInventory, проверяющий
 * g_rgAppContextData, UserYou, UserThem и т.д.) и отдаёт готовые
 * атрибуты для каждого предмета сразу.
 */
export function registerAttributesCoreHandler(): () => void {
  return respondInMain<AttributesRequest, AttributesSnapshot>(ATTRIBUTES_CHANNEL, async () => {
    const win = window as unknown as TradeOfferWindow;
    const myInv = getInventory(win, true);
    const partnerInv = getInventory(win, false);

    return {
      meSteamId: win.UserYou?.strSteamId ?? null,
      partnerSteamId: win.UserThem?.strSteamId ?? (win.g_ulTradePartnerSteamID ? String(win.g_ulTradePartnerSteamID) : null),
      me: collectAttributes(myInv),
      partner: collectAttributes(partnerInv),
    };
  });
}
