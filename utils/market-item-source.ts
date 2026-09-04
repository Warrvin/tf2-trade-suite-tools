import type { SteamEconItem } from './item-attributes';
import { installMarketBetaWatch } from './market-beta-watch';

/**
 * Общий источник "сырых" предметов текущей страницы Market
 * (steamcommunity.com/market/listings/440/*) — вынесен из
 * modules/market-item-attributes/core.ts сюда, потому что ровно то же самое
 * нужно и modules/market-pricedb-check-button (требование 4 — не дублировать
 * функционал): оба модуля хотят знать, какие предметы сейчас отрисованы на
 * странице (и в каком порядке — для позиционного сопоставления на бете),
 * просто используют это по-разному (значки атрибутов vs имя для PriceDB.io).
 *
 * Классика — window.g_rgAssets синхронно даёт всё сразу. Бета (React SPA,
 * см. utils/market-beta-watch.ts) — растущий перехваченный снимок plus
 * betaOrder (порядок assetId, нужный ISOLATED-стороне, чтобы позиционно
 * сопоставить карточки в DOM, где никакого id нет вообще, см. README
 * §"Известное ограничение").
 */
export interface MarketItemSource {
  itemByAssetId: Record<string, SteamEconItem>;
  /** Заполнен ТОЛЬКО на бете — см. modules/market-item-attributes/apply.ts и
   *  modules/market-pricedb-check-button/apply.ts, оба сопоставляют DOM по
   *  этому же порядку, каждый со своим независимым курсором (сопоставление —
   *  чистая функция от текущего DOM + этого массива, независимые курсоры не
   *  дублируют логику, только состояние прогресса каждого модуля). */
  betaOrder?: string[];
}

interface SteamMarketWindow {
  g_rgAssets?: Record<string, Record<string, Record<string, SteamEconItem>>>;
}

export function readMarketItemSource(): MarketItemSource {
  const win = window as unknown as SteamMarketWindow;
  const classicAssets = win.g_rgAssets?.['440']?.['2'];
  if (classicAssets && Object.keys(classicAssets).length > 0) {
    return { itemByAssetId: classicAssets };
  }

  const betaState = installMarketBetaWatch();
  const itemByAssetId: Record<string, SteamEconItem> = {};
  for (const [assetId, item] of betaState.itemByAssetId) itemByAssetId[assetId] = item;
  return { itemByAssetId, betaOrder: [...betaState.orderedAssetIds] };
}
