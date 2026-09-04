import { requestFromMain } from '../../utils/bridge';
import { formatMetalScrap, metalValueInScrap, truncateDecimal2 } from '../../utils/currency';
import { PricedItem, PricedOtherItemsResult, priceOtherItems, pricedbItemUrl, pricedbSearchUrl } from '../../utils/pricedb';
import type { Locale } from '../../utils/i18n';
import { DEFAULT_TRADE_SUMMARY_MODE, TRADE_SUMMARY_CHANNEL, TradeSideSummary, TradeSummaryMode, TradeSummaryRequest, TradeSummarySnapshot } from './types';

const UI = {
  ru: {
    loading: 'загрузка…',
    readError: 'не удалось прочитать оффер',
    empty: 'пусто',
    itemCount: (n: number) => `+ ${n} предм.`,
    pricingItems: 'оценка предметов…',
    noPriceTitle: 'Не нашлось цены на PriceDB.io',
    noPriceStatus: 'нет цены',
    searchTitle: 'Поискать этот предмет на PriceDB.io',
    checkTitle: 'Проверить цену этого предмета на PriceDB.io',
    perUnit: ' / шт.',
    total: 'Итого:',
    totalTitle: 'Сумма по всем оценённым предметам',
  },
  en: {
    loading: 'loading…',
    readError: "couldn't read the offer",
    empty: 'empty',
    itemCount: (n: number) => `+ ${n} item${n === 1 ? '' : 's'}`,
    pricingItems: 'pricing items…',
    noPriceTitle: "Couldn't find a price on PriceDB.io",
    noPriceStatus: 'no price',
    searchTitle: 'Search for this item on PriceDB.io',
    checkTitle: "Check this item's price on PriceDB.io",
    perUnit: ' / ea.',
    total: 'Total:',
    totalTitle: 'Sum across all priced items',
  },
} as const;

export type TradeSummarySide = 'me' | 'partner';

/** MAIN просто читает уже готовый window.g_rgCurrentTradeStatus — 0 сетевых
 *  запросов, поэтому можно позволить себе лёгкий фоновый опрос (подстраховка
 *  на случай, если MutationObserver ниже что-то пропустит), как и в
 *  inventory-currency-counter. */
const POLL_MS = 2000;

/** Экранирование для интерполяции в innerHTML — единственное место в этом
 *  модуле, где в разметку попадает СТРОКА извне (имя предмета, см.
 *  renderOtherPart), а не число/константа, как в остальных чипах. Само имя —
 *  это market_hash_name из схемы Стима (не пользовательский Name Tag, см.
 *  utils/pricedb.ts#buildPriceableName), поэтому реальный риск минимален, но
 *  проверять не помешает — раньше в модуле такой интерполяции не было. */
const HTML_ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Монтирует ВСТРОЕННЫЙ (не плавающий) блок сводки валюты для ОДНОЙ стороны
 * оффера — внутрь контейнера, который даёт createShadowRootUi, сразу после
 * `.offerheader` этой стороны (см. entrypoints/tradeoffer-summary.content.ts).
 * Вызывается дважды (side: 'me' и 'partner') с двумя независимыми
 * createShadowRootUi/контейнерами — общих данных/состояния между вызовами
 * нет, каждый экземпляр сам спрашивает MAIN и берёт свою половину снимка
 * (кэш цен в utils/pricedb.ts — общий модульный, см. её комментарий).
 *
 * Валюта (keys/ref/rec/scrap) считается ВСЕГДА, независимо от режима — это
 * бесплатно (0 сети, MAIN уже всё посчитал). `mode` касается только НЕ-
 * валютных предметов: 'simple' — просто число штук, 'priced' — плюс их
 * суммарная цена по PriceDB.io (см. utils/pricedb.ts), с построчной
 * раскладкой по каждому уникальному предмету (не только общим числом) —
 * пользователь явно попросил способ перепроверить, что цена подобрана к
 * ПРАВИЛЬНОМУ предмету/эффекту: у каждой строки своя ссылка "↗" на страницу
 * этого SKU на pricedb.io (или на поиск по имени, если SKU не нашёлся).
 * Режим можно сменить на лету через `setMode` (тот же паттерн, что и
 * `setDetailLevel` у trade-item-attributes) — без перемонтирования панели.
 *
 * `slotsSelector` — CSS-селектор контейнера слотов ИМЕННО этой стороны
 * (#your_slots / #their_slots): его DOM-мутации (добавили/убрали предмет в
 * оффер) — самый быстрый и надёжный триггер "пересчитать", т.к. Steam
 * обновляет и DOM слотов, и g_rgCurrentTradeStatus синхронно в одном и том
 * же обработчике drag&drop.
 */
export function mountTradeSummaryPanel(
  container: HTMLElement,
  side: TradeSummarySide,
  slotsSelector: string,
  locale: Locale,
  initialMode: TradeSummaryMode = DEFAULT_TRADE_SUMMARY_MODE,
): { destroy: () => void; setMode: (mode: TradeSummaryMode) => void } {
  // Та же защита от повторного монтирования в тот же контейнер, что и в
  // inventory-currency-counter/panel.ts — на случай если onMount когда-нибудь
  // вызовется больше одного раза без предшествующего onRemove.
  container.replaceChildren();

  const root = document.createElement('div');
  root.className = 'tf2s-root';
  container.appendChild(root);

  let destroyed = false;
  let mode = initialMode;
  let data: TradeSideSummary | null = null;
  let loading = true;
  let priced: PricedOtherItemsResult | null = null;
  let pricing = false;
  let pricingInFlight = false;
  let pollTimer: number | null = null;
  let debounceTimer: number | null = null;

  render();
  void refresh();
  schedulePoll();

  const slotsContainer = document.querySelector(slotsSelector) ?? document.body;
  const observer = new MutationObserver(() => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => void refresh(), 150);
  });
  observer.observe(slotsContainer, { childList: true, subtree: true });

  function schedulePoll() {
    pollTimer = window.setInterval(() => void refresh(), POLL_MS);
  }

  function render() {
    if (destroyed) return;
    root.innerHTML = `<div class="tf2s-panel tf2s-tradesum">${renderCurrencyRow()}${renderOtherPart()}</div>`;
  }

  function renderCurrencyRow(): string {
    if (loading && !data) {
      return `<span class="tf2s-tradesum__status">${UI[locale].loading}</span>`;
    }
    if (!data) {
      return `<span class="tf2s-tradesum__status tf2s-tradesum__status--error">${UI[locale].readError}</span>`;
    }

    const { currency, otherCount } = data;
    const metalScrap = metalValueInScrap(currency);

    if (currency.keys === 0 && metalScrap === 0 && otherCount === 0) {
      return `<span class="tf2s-tradesum__status">${UI[locale].empty}</span>`;
    }

    const chips: string[] = [];
    if (currency.keys > 0) {
      chips.push(`
        <span class="tf2s-tradesum__chip">
          <span class="tf2s-tradesum__dot tf2s-tradesum__dot--keys"></span>
          <span class="tf2s-tradesum__value">${currency.keys}</span>
          <span class="tf2s-tradesum__label">Keys</span>
        </span>`);
    }
    if (metalScrap > 0) {
      chips.push(`
        <span class="tf2s-tradesum__chip" title="${currency.refined} Ref + ${currency.reclaimed} Rec + ${currency.scrap} Scrap">
          <span class="tf2s-tradesum__dot tf2s-tradesum__dot--metal"></span>
          <span class="tf2s-tradesum__value">${formatMetalScrap(metalScrap)}</span>
        </span>`);
    }
    return chips.join('');
  }

  /** Часть про НЕ-валютные предметы — единственное, что зависит от режима. */
  function renderOtherPart(): string {
    if (!data || data.otherCount === 0) return '';

    if (mode === 'simple') {
      return `<span class="tf2s-tradesum__other">${UI[locale].itemCount(data.otherCount)}</span>`;
    }

    // mode === 'priced'
    if (!priced) {
      return `<span class="tf2s-tradesum__other">${pricing ? UI[locale].pricingItems : UI[locale].itemCount(data.otherCount)}</span>`;
    }

    return `<span class="tf2s-tradesum__pricedlist">${priced.items.map(renderPricedItemRow).join('')}</span>${renderPricedTotal()}`;
  }

  /** Одна строка на уникальный предмет: название + цена (или "нет цены") +
   *  ссылка "↗" для ручной проверки на самом pricedb.io — см. комментарий
   *  над mountTradeSummaryPanel. */
  function renderPricedItemRow(item: PricedItem): string {
    const prefix = item.amount > 1 ? `×${item.amount} ` : '';
    const safeName = escapeHtml(prefix + item.name);

    if (!item.sell) {
      const url = pricedbSearchUrl(item.name);
      return `
        <span class="tf2s-tradesum__item tf2s-tradesum__item--unpriced" title="${UI[locale].noPriceTitle}">
          <span class="tf2s-tradesum__item-name">${safeName}</span>
          <span class="tf2s-tradesum__item-status">${UI[locale].noPriceStatus}</span>
          <a class="tf2s-tradesum__verify" href="${url}" target="_blank" rel="noopener noreferrer" title="${UI[locale].searchTitle}">↗</a>
        </span>`;
    }

    const unitParts: string[] = [];
    if (item.sell.keys > 0) unitParts.push(`${truncateDecimal2(item.sell.keys)} keys`);
    if (item.sell.metal > 0) unitParts.push(`${truncateDecimal2(item.sell.metal)} ref`);
    const priceText = unitParts.length > 0 ? unitParts.join(' + ') : '0 ref';
    const url = item.sku ? pricedbItemUrl(item.sku) : pricedbSearchUrl(item.name);

    return `
      <span class="tf2s-tradesum__item" title="SKU: ${item.sku ?? '?'}">
        <span class="tf2s-tradesum__dot tf2s-tradesum__dot--priced"></span>
        <span class="tf2s-tradesum__item-name">${safeName}</span>
        <span class="tf2s-tradesum__item-price">≈ ${priceText}${item.amount > 1 ? UI[locale].perUnit : ''}</span>
        <a class="tf2s-tradesum__verify" href="${url}" target="_blank" rel="noopener noreferrer" title="${UI[locale].checkTitle}">↗</a>
      </span>`;
  }

  /** Краткий общий итог под списком — не дублирует построчные ссылки,
   *  просто удобный "на глаз" суммарный ориентир, как раньше. Показываем
   *  только когда есть что складывать (иначе для единственного предмета это
   *  было бы дословным повтором его собственной строки). */
  function renderPricedTotal(): string {
    if (!priced) return '';
    const pricedCount = priced.items.filter((i) => i.sell).length;
    if (pricedCount < 2) return '';

    const parts: string[] = [];
    if (priced.total.keys > 0) parts.push(`${truncateDecimal2(priced.total.keys)} keys`);
    if (priced.total.metal > 0) parts.push(`${truncateDecimal2(priced.total.metal)} ref`);
    if (parts.length === 0) return '';

    return `
      <span class="tf2s-tradesum__chip" title="${UI[locale].totalTitle}">
        <span class="tf2s-tradesum__label">${UI[locale].total}</span>
        <span class="tf2s-tradesum__value">≈ ${parts.join(' + ')}</span>
      </span>`;
  }

  async function refresh() {
    try {
      const snapshot = await requestFromMain<TradeSummaryRequest, TradeSummarySnapshot>(TRADE_SUMMARY_CHANNEL, {});
      if (destroyed) return;
      data = side === 'me' ? snapshot.me : snapshot.partner;
    } catch {
      // MAIN-скрипт ещё не готов (страница только открылась) — подождём
      // следующего опроса/DOM-мутации, ничего не затираем.
    }
    loading = false;
    render();
    void refreshPricing();
  }

  /**
   * Досчитывает цену НЕ-валютных предметов через PriceDB.io, только если
   * включён режим 'priced' и есть что оценивать. Отдельная (не встроенная в
   * refresh) корутина: сеть тут может быть заметно медленнее, чем чтение
   * MAIN-снимка, и не должна блокировать обновление уже готовой части
   * (валюты) — та отрисовывается сразу, цена "дорисовывается" following.
   * `pricingInFlight` — простая защита от параллельных повторных запросов
   * тех же ещё не закэшированных (см. utils/pricedb.ts) имён, если опрос
   * (раз в 2 с) сработает раньше, чем ответит первый запрос.
   */
  async function refreshPricing() {
    if (destroyed || mode !== 'priced' || pricingInFlight) return;
    const otherItems = data?.otherItems ?? [];
    if (otherItems.length === 0) {
      if (priced !== null) {
        priced = null;
        render();
      }
      return;
    }

    pricingInFlight = true;
    pricing = true;
    render();
    try {
      priced = await priceOtherItems(otherItems);
    } catch {
      // Сетевая ошибка PriceDB.io — оставляем как есть (пусто, покажем "+N
      // предм." без цены, см. renderOtherPart), не ломаем остальную панель.
    }
    pricing = false;
    pricingInFlight = false;
    render();
  }

  return {
    destroy: () => {
      destroyed = true;
      observer.disconnect();
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      root.remove();
    },
    setMode: (nextMode: TradeSummaryMode) => {
      if (nextMode === mode) return;
      mode = nextMode;
      priced = null;
      render();
      void refreshPricing();
    },
  };
}
