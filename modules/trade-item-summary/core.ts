import { respondInMain } from '../../utils/bridge';
import { CurrencyCounts, emptyCurrencyCounts, getCurrencyKindFromName } from '../../utils/currency';
import { getItemAttributes, SteamEconItem } from '../../utils/item-attributes';
import { buildPriceableName } from '../../utils/pricedb';
import { TRADE_SUMMARY_CHANNEL, TradeOtherItem, TradeSideSummary, TradeSummaryRequest, TradeSummarySnapshot } from './types';

/**
 * Форма window.g_rgCurrentTradeStatus на странице /tradeoffer/* — Steam САМ
 * держит и живьём мутирует этот объект по мере того, как пользователь
 * перетаскивает предметы в/из слотов оффера (это официальный источник
 * "что сейчас реально предложено", а не наш парсинг DOM-слотов). Подтверждено
 * на реальной (пустой) странице оффера, загруженной пользователем:
 *   var g_rgCurrentTradeStatus = {"newversion":true,"version":1,
 *     "me":{"assets":[],"currency":[],"ready":false},
 *     "them":{"assets":[],"currency":[],"ready":false}};
 * currency[] — под нативную Steam-валюту (у TF2 такой нет, ключи/металл —
 * обычные предметы), поэтому не используется, только assets[].
 */
interface TradeStatusAsset {
  appid: number | string;
  contextid: number | string;
  assetid: string;
  amount?: number | string;
}
interface TradeStatusSide {
  assets?: TradeStatusAsset[];
  currency?: TradeStatusAsset[];
  ready?: boolean;
}
interface SteamCurrentTradeStatus {
  me?: TradeStatusSide;
  them?: TradeStatusSide;
}

/** Форма window.g_rgAppContextData / g_rgPartnerAppContextData — та же, что и
 *  в modules/trade-item-attributes/core.ts (полные данные предмета по
 *  assetId, включая market_hash_name/name — по ним и определяется валюта,
 *  см. utils/currency.ts). Объявлена заново локально, а не импортирована из
 *  соседнего модуля — так же, как это уже сделано между trade-item-attributes
 *  и market-item-attributes: это просто форма чужой глобали, а не наша общая
 *  логика (требование 4 касается функционала, не деклараций типов). */
interface SteamAppContextData {
  [appid: string]: {
    rgContexts?: {
      [contextid: string]: {
        inventory?: {
          rgInventory?: Record<string, SteamEconItem>;
        };
      };
    };
  };
}

interface SteamTradeWindow {
  g_rgCurrentTradeStatus?: SteamCurrentTradeStatus;
  g_rgAppContextData?: SteamAppContextData;
  g_rgPartnerAppContextData?: SteamAppContextData;
}

/**
 * Считает валюту/прочие предметы для ОДНОЙ стороны оффера: берёт assetId'ы
 * из g_rgCurrentTradeStatus (что реально лежит в слотах прямо сейчас) и по
 * каждому смотрит имя предмета в соответствующем инвентаре (g_rgAppContextData
 * для меня / g_rgPartnerAppContextData для партнёра — обе стороны Steam
 * грузит в JS-контекст страницы оффера целиком, см. trade-item-attributes).
 * Фильтр по appid/contextid — на случай, если в тот же оффер добавлены
 * предметы других игр (Steam это разрешает); нас интересует только 440/2.
 */
function summarizeSide(assets: TradeStatusAsset[] | undefined, inventorySource: SteamAppContextData | undefined): TradeSideSummary {
  const counts: CurrencyCounts = emptyCurrencyCounts();
  let otherCount = 0;
  // group by "прайсабельное" имя — тот же предмет (два одинаковых Refined
  // Weapon skin'а, например) должен резолвиться/прайситься в PriceDB.io
  // только ОДИН раз (см. utils/pricedb.ts#priceOtherItems — оно и само
  // дедуплицирует по имени, но группировка здесь ещё и уменьшает сам объект
  // ответа, который летит через bridge.ts на ISOLATED-сторону).
  const otherByName = new Map<string, number>();
  const rgInventory = inventorySource?.['440']?.rgContexts?.['2']?.inventory?.rgInventory;

  for (const asset of assets ?? []) {
    if (String(asset.appid) !== '440' || String(asset.contextid) !== '2') continue;
    const amount = Number(asset.amount) || 1;

    const item = rgInventory?.[asset.assetid];
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
    // если item не найден (инвентарь стороны ещё не подъехал) — предмет всё
    // равно учтён в otherCount (режим 'simple' не проседает), просто не
    // попадёт в otherItems до следующего опроса, когда инвентарь подгрузится.
  }

  const otherItems: TradeOtherItem[] = [...otherByName.entries()].map(([name, amount]) => ({ name, amount }));
  return { currency: counts, otherCount, otherItems };
}

/**
 * Регистрирует обработчик в MAIN world: по запросу с ISOLATED-стороны читает
 * ЖИВОЙ (не снятый один раз при загрузке) g_rgCurrentTradeStatus — то есть
 * каждый вызов видит самое актуальное состояние оффера, включая изменения,
 * которые Steam внёс уже после того, как страница открылась.
 *
 * Как и wallet-summary/trade-item-attributes, не проверяет сам, включена ли
 * фича — ISOLATED-сторона просто не спросит, если фича выключена (см.
 * utils/bridge.ts и README §"Архитектура").
 */
export function registerTradeSummaryCoreHandler(): () => void {
  return respondInMain<TradeSummaryRequest, TradeSummarySnapshot>(TRADE_SUMMARY_CHANNEL, async () => {
    const win = window as unknown as SteamTradeWindow;
    const status = win.g_rgCurrentTradeStatus;
    return {
      me: summarizeSide(status?.me?.assets, win.g_rgAppContextData),
      partner: summarizeSide(status?.them?.assets, win.g_rgPartnerAppContextData),
    };
  });
}
