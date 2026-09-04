import { respondInMain } from '../../utils/bridge';
import { fetchCurrencyWallet } from '../../utils/inventory-fetch';
import { WALLET_CHANNEL, WalletRequest, WalletResponse } from './types';

/** Минимальная форма глобалей, которые Steam кладёт в window на /tradeoffer/*. */
interface SteamTradeWindow {
  UserYou?: { strSteamId?: string };
  UserThem?: { strSteamId?: string };
}

/**
 * Регистрирует обработчик в MAIN world: по запросу с ISOLATED-стороны
 * фетчит полный TF2-инвентарь нужной стороны (я/партнёр) и отдаёт подсчёт
 * валюты. Ничего не решает сам за себя (не проверяет настройки — это
 * осознанно, см. utils/bridge.ts и README §"Архитектура"): ISOLATED-сторона
 * не пришлёт запрос, если фича выключена, так что этот обработчик просто
 * бездействует, пока его не спросят.
 *
 * Возвращает функцию отписки — вызывается автоматически при инвалидации
 * контента (см. entrypoints/tradeoffer-wallet-core.content.ts).
 */
export function registerWalletCoreHandler(): () => void {
  return respondInMain<WalletRequest, WalletResponse>(WALLET_CHANNEL, async ({ who }) => {
    const win = window as unknown as SteamTradeWindow;
    const steamId = who === 'me' ? win.UserYou?.strSteamId : win.UserThem?.strSteamId;

    if (!steamId) {
      return { who, ok: false, reason: 'unknown' };
    }

    const result = await fetchCurrencyWallet(steamId);
    return { who, ...result };
  });
}
