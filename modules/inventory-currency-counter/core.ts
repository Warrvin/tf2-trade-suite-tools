import { respondInMain } from '../../utils/bridge';
import { installInventoryWatch } from '../../utils/inventory-watch';
import { fetchCurrencyWallet } from '../../utils/inventory-fetch';
import { CurrencyCounts, emptyCurrencyCounts, getCurrencyKindFromName } from '../../utils/currency';
import { INVENTORY_CURRENCY_CHANNEL, InventoryCurrencyRequest, InventoryCurrencySnapshot } from './types';

/**
 * MAIN-world половина модуля "Живой счётчик валюты в инвентаре" —
 * НЕ путать с wallet-summary (окно трейд-оффера, обе стороны сразу): этот
 * модуль живёт на странице steamcommunity.com/id|profiles/<x>/inventory и
 * считает валюту ТОЛЬКО текущего владельца, встроенно в саму страницу
 * (см. panel.ts/panel.css — без плавающего окна, как того явно попросил
 * пользователь).
 *
 * Источник данных для быстрой оценки — общий с inventory-item-attributes
 * перехватчик fetch/XHR (utils/inventory-watch.ts, установлен один раз на
 * весь window вне зависимости от того, какой из двух модулей запустился
 * первым — требование 4, не дублировать функционал).
 */

const CONTAINER_ID_RE = /^inventory_(\d+)_440_2$/;

/**
 * Извлекает steamId64 владельца инвентаря напрямую из id DOM-контейнера
 * сетки предметов TF2 (inventory_<steamid64>_440_2), а НЕ из
 * link[rel="canonical"] — живой проверкой на реальной странице
 * (steamcommunity.com/id/<vanity>/inventory/) подтверждено, что этого тега
 * там нет, хотя именно на него ссылается справочный проект. Контейнер
 * создаёт сам Steam, как только показывает вкладку TF2 — то есть ровно
 * тогда же, когда вообще имеет смысл показывать этот модуль.
 */
function findOwnerSteamId64(): string | null {
  const containers = document.querySelectorAll('[id^="inventory_"][id$="_440_2"]');
  for (const el of Array.from(containers)) {
    const match = CONTAINER_ID_RE.exec(el.id);
    if (match) return match[1];
  }
  return null;
}

/** Быстрая бесплатная оценка — 0 доп. запросов, по уже увиденным предметам. */
function quickEstimate(): InventoryCurrencySnapshot {
  const { itemByAssetId, amountByAssetId, totalInventoryCount } = installInventoryWatch();
  const counts: CurrencyCounts = emptyCurrencyCounts();

  for (const [assetId, item] of itemByAssetId) {
    const kind = getCurrencyKindFromName(item.market_hash_name ?? item.name);
    if (!kind) continue;
    counts[kind] += amountByAssetId.get(assetId) ?? 1;
  }

  return {
    ok: true,
    counts,
    partial: true,
    loadedCount: itemByAssetId.size,
    totalCount: totalInventoryCount,
  };
}

/** Авторитетный полный постраничный фетч всего инвентаря владельца. */
async function fullFetch(): Promise<InventoryCurrencySnapshot> {
  const steamId64 = findOwnerSteamId64();
  if (!steamId64) return { ok: false, reason: 'unknown' };

  const result = await fetchCurrencyWallet(steamId64);
  if (!result.ok) return result;
  return { ok: true, counts: result.counts, partial: false, loadedCount: result.totalItems, totalCount: result.totalItems };
}

export function registerInventoryCurrencyCoreHandler(): () => void {
  // Идемпотентно и общее с inventory-item-attributes — см. utils/inventory-watch.ts.
  installInventoryWatch();
  return respondInMain<InventoryCurrencyRequest, InventoryCurrencySnapshot>(INVENTORY_CURRENCY_CHANNEL, async (req) =>
    req.forceFullFetch ? fullFetch() : quickEstimate(),
  );
}
