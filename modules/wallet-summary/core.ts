import { respondInMain } from '../../utils/bridge';
import { fetchCurrencyWallet } from '../../utils/inventory-fetch';
import { CurrencyCounts, emptyCurrencyCounts, getCurrencyKindFromName } from '../../utils/currency';
import { getInventory, TradeOfferWindow } from '../../utils/trade-offer';
import { WALLET_CHANNEL, WalletRequest, WalletResponse } from './types';

// Кэш для сетевых запросов — защищает от лишнего трафика и Steam 429 Too Many Requests
const walletCache = new Map<string, { counts: CurrencyCounts; totalItems: number; timestamp: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Регистрирует обработчик в MAIN world: по запросу с ISOLATED-стороны
 * мгновенно отдаёт подсчёт валюты нужной стороны (я/партнёр).
 *
 * ОПТИМИЗАЦИЯ:
 * 1. Fast-path: читает уже загруженный инвентарь из памяти страницы Steam (getInventory)
 *    за 0ms без сетевых запросов и без риска получить 429 Too Many Requests.
 * 2. Fallback: если инвентарь ещё не в памяти, делает fetchCurrencyWallet и кэширует на 60 сек.
 */
export function registerWalletCoreHandler(): () => void {
  return respondInMain<WalletRequest, WalletResponse>(WALLET_CHANNEL, async ({ who }) => {
    const win = window as unknown as TradeOfferWindow;
    const isYou = who === 'me';
    const steamId = isYou ? win.UserYou?.strSteamId : win.UserThem?.strSteamId;

    // 1. FAST PATH: Читаем инвентарь из памяти страницы (0ms)
    const inventory = getInventory(win, isYou);
    const itemEntries = Object.values(inventory);
    if (itemEntries.length > 0) {
      const counts = emptyCurrencyCounts();
      let totalItems = 0;
      for (const item of itemEntries) {
        totalItems++;
        const kind = getCurrencyKindFromName(item.market_hash_name ?? item.name);
        if (kind) counts[kind] += Number(item.amount ?? 1);
      }
      return { who, ok: true, counts, totalItems };
    }

    if (!steamId) {
      return { who, ok: false, reason: 'unknown' };
    }

    // 2. Проверяем свежий кэш
    const cached = walletCache.get(steamId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { who, ok: true, counts: cached.counts, totalItems: cached.totalItems };
    }

    // 3. Fallback: сетевой запрос с кэшированием
    const result = await fetchCurrencyWallet(steamId);
    if (result.ok) {
      walletCache.set(steamId, { counts: result.counts, totalItems: result.totalItems, timestamp: Date.now() });
    }
    return { who, ...result };
  });
}
