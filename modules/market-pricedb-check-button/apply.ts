import { requestFromMain } from '../../utils/bridge';
import { pricedbItemUrl, pricedbSearchUrl, resolveSku } from '../../utils/pricedb';
import { getMarketBetaBuyButtons, getMarketClassicRows, getMarketRowAssetId, getMarketRowBuyLink } from '../../utils/market-dom';
import type { Locale } from '../../utils/i18n';
import { MARKET_PRICEDB_CHANNEL, MarketPricedbRequest, MarketPricedbResult, MarketPricedbSnapshot } from './types';

const CHECK_CLASS = 'tf2s-market-pricedb-check';
const ASSET_ATTR = 'data-tf2s-pricedb-assetid';

const UI = {
  ru: { checkTitle: 'Проверить цену этого предмета на PriceDB.io' },
  en: { checkTitle: "Check this item's price on PriceDB.io" },
} as const;

/**
 * Steam Market НЕ различает конкретный Unusual-эффект (или killstreak
 * sheen/killstreaker, spell и т.д.) в СВОЁМ собственном отображаемой цене —
 * все листинги одного и того же базового предмета на одной странице
 * показывают одну и ту же цену независимо от реального содержимого
 * листинга (общеизвестный факт торговли TF2). Поэтому, в отличие от
 * pricedb-check-button (инвентарь, где выбранный предмет всегда один),
 * кнопка тут ставится У КАЖДОЙ строки листинга отдельно — только так можно
 * действительно сверить цену ИМЕННО этого конкретного варианта предмета.
 */
function buildCheckLink(assetId: string, name: string, locale: Locale): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = CHECK_CLASS;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.href = pricedbSearchUrl(name); // оптимистично, апгрейдим ниже
  a.title = UI[locale].checkTitle;
  a.textContent = '↗';
  a.setAttribute(ASSET_ATTR, assetId);

  void resolveSku(name).then((sku) => {
    // Строка могла успеть переиспользоваться под другой листинг, пока
    // резолвился SKU — проверяем, что кнопка всё ещё "наша" для этого же
    // assetId, прежде чем менять href (иначе ссылка уедет не туда).
    if (a.getAttribute(ASSET_ATTR) !== assetId) return;
    if (sku) a.href = pricedbItemUrl(sku);
  });

  return a;
}

function insertOrReplace(anchorEl: HTMLElement, assetId: string, name: string, locale: Locale) {
  const existing = anchorEl.nextElementSibling;
  if (existing?.classList.contains(CHECK_CLASS)) {
    if (existing.getAttribute(ASSET_ATTR) === assetId) return; // уже стоит на этом же листинге
    existing.remove();
  }
  anchorEl.insertAdjacentElement('afterend', buildCheckLink(assetId, name, locale));
}

/**
 * Запускает кнопки "Проверить цену на PriceDB.io" на странице листингов
 * Steam Market. Структурно 1:1 повторяет
 * modules/market-item-attributes/apply.ts (требование 2 — тот же паттерн
 * "опрос MAIN + скан классики и беты + MutationObserver", требование 4 —
 * общие DOM-хелперы utils/market-dom.ts и utils/market-item-source.ts, ни
 * один из них не продублирован здесь заново) — единственное отличие: тут
 * ВСТАВЛЯЕТСЯ новый элемент (кнопка-ссылка), а не декорируется фон
 * существующего.
 */
export function startMarketPricedbCheckButton(locale: Locale): { stop: () => void } {
  let stopped = false;
  let snapshot: MarketPricedbSnapshot | null = null;
  let betaOrder: string[] | undefined;
  // Независимый от market-item-attributes курсор — своё состояние прогресса
  // этого модуля поверх ОБЩЕГО betaOrder (см. utils/market-item-source.ts).
  let betaMatchedCount = 0;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function scan() {
    if (stopped || !snapshot) return;

    getMarketClassicRows().forEach((row) => {
      const assetId = getMarketRowAssetId(row);
      if (!assetId) return;
      const name = snapshot![assetId];
      if (!name) return; // g_rgAssets/бета-снимок ещё не подъехал для этого листинга — подхватим на следующем опросе

      const buyLink = getMarketRowBuyLink(row);
      if (!buyLink) return;
      insertOrReplace(buyLink, assetId, name, locale);
    });
  }

  function scanBeta() {
    if (stopped || !snapshot || !betaOrder || betaOrder.length === 0) return;

    const buyButtons = getMarketBetaBuyButtons();
    const upTo = Math.min(buyButtons.length, betaOrder.length);

    while (betaMatchedCount < upTo) {
      const assetId = betaOrder[betaMatchedCount];
      const name = snapshot![assetId];
      if (!name) break; // ещё не пришло имя для этого (и по порядку — любого следующего) листинга

      insertOrReplace(buyButtons[betaMatchedCount], assetId, name, locale);
      betaMatchedCount++;
    }
  }

  async function refresh() {
    if (stopped) return;
    try {
      const result = await requestFromMain<MarketPricedbRequest, MarketPricedbResult>(MARKET_PRICEDB_CHANNEL, {});
      snapshot = result.snapshot;
      betaOrder = result.betaOrder;
    } catch {
      // MAIN-скрипт ещё не готов (страница только открылась) — подождём следующего планового опроса.
    }
    scan();
    scanBeta();
  }

  void refresh();
  // Постраничное переключение (классика) / бесконечная подгрузка при
  // скролле (бета) подгружают новые листинги через AJAX без перезагрузки —
  // опрашиваем на протяжении всей жизни модуля.
  pollTimer = setInterval(() => void refresh(), 1500);

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scan();
      scanBeta();
    }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return {
    stop: () => {
      stopped = true;
      observer.disconnect();
      clearTimeout(scanTimer);
      clearInterval(pollTimer);
      document.querySelectorAll(`.${CHECK_CLASS}`).forEach((el) => el.remove());
    },
  };
}
