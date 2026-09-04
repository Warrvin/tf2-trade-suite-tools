import { HISTORY_ITEM_QTY_CLASS, TRADE_ITEM_QTY_CLASS } from '../../utils/offer-list-badges';

/**
 * "Движок" модуля — схлопывает повторяющиеся одинаковые предметы на ОДНОЙ
 * стороне ОДНОЙ записи списка офферов/истории в один тайл + бейдж "×N",
 * вместо N визуально одинаковых дубликатов подряд. Портировано из
 * **tf2TradingUtils** (Franciscoborges2002/tf2TradingUtils,
 * `steamcommunity.com/groupTradeItems/content.js#groupTradeItems`).
 *
 * Третий модуль вообще без MAIN-мира (как `bptf-listing-trade-params` и
 * сосед по этой же странице `offer-currency-total`) — просто DOM, обычный
 * ISOLATED content-script, без пары entrypoint'ов и без `utils/bridge.ts`.
 *
 * ДВЕ РАЗНЫЕ разметки, как и у `offer-currency-total` (та же причина —
 * см. её core.ts): на `/tradeoffers`(`/sent`) группируем по
 * `data-economy-item` (у Steam здесь ОДИН И ТОТ ЖЕ assetid иногда
 * встречается у всех копий стопки — так утверждает портируемый оригинал,
 * НЕ подтверждено собственным живым тестом, см. README), на `/tradehistory`
 * — по тексту имени (`.history_item_name`), которое там есть у каждого
 * предмета.
 *
 * СВЯЗЬ С `offer-currency-total` (требование 4 — не дублировать бейдж-
 * логику): бейдж "×N", который этот модуль вешает, ЧИТАЕТ
 * `offer-currency-total` (см. `utils/offer-list-badges.ts` за тем, почему
 * порядок выполнения между двумя независимыми content-скриптами
 * специально сделан неважным). Собственных чисел друг у друга оба модуля
 * не трогают — только этот общий маленький файл.
 */

const PROCESSED_ATTR = 'data-tf2s-grouped';

/** Убирает элемент вместе с соседним текстовым узлом-разделителем ", ",
 *  если он есть — иначе на `/tradehistory` после схлопывания дубликатов
 *  остаётся висячая запятая ("Refined Metal, , Scrap Metal" вместо
 *  "Refined Metal ×2, Scrap Metal"). Портировано как есть
 *  (`removeWithSeparator`). */
function removeWithSeparator(el: Element): void {
  const next = el.nextSibling;
  const prev = el.previousSibling;
  el.remove();

  if (next?.nodeType === Node.TEXT_NODE && /^\s*,\s*$/.test(next.textContent ?? '')) {
    next.remove();
  } else if (prev?.nodeType === Node.TEXT_NODE && /^\s*,\s*$/.test(prev.textContent ?? '')) {
    prev.remove();
  }
}

// ───────────────────────── /tradeoffers(/sent) — по data-economy-item ─────────────────────────

function groupOfferList(listEl: Element): void {
  if (listEl.hasAttribute(PROCESSED_ATTR)) return;
  listEl.setAttribute(PROCESSED_ATTR, '1');

  const items = [...listEl.querySelectorAll(':scope > .trade_item')];
  const groups = new Map<string, Element[]>();

  for (const item of items) {
    const key = item.getAttribute('data-economy-item');
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const [keep, ...rest] = group;
    rest.forEach((el) => el.remove());

    (keep as HTMLElement).style.position = 'relative';
    const badge = document.createElement('span');
    badge.className = TRADE_ITEM_QTY_CLASS;
    badge.textContent = `×${group.length}`;
    keep.appendChild(badge);
  }
}

// ───────────────────────── /tradehistory — по имени ─────────────────────────

function groupHistoryList(groupEl: Element): void {
  if (groupEl.hasAttribute(PROCESSED_ATTR)) return;
  groupEl.setAttribute(PROCESSED_ATTR, '1');

  const items = [...groupEl.querySelectorAll(':scope > .history_item')];
  const groups = new Map<string, Element[]>();

  for (const item of items) {
    const key = item.querySelector('.history_item_name')?.textContent?.trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const [keep, ...rest] = group;
    rest.forEach(removeWithSeparator);

    const badge = document.createElement('span');
    badge.className = HISTORY_ITEM_QTY_CLASS;
    badge.textContent = `×${group.length}`;
    keep.querySelector('.history_item_name')?.appendChild(badge);
  }
}

// ───────────────────────── Запуск ─────────────────────────

function scan(): void {
  document.querySelectorAll('.tradeoffer_item_list').forEach(groupOfferList);
  document.querySelectorAll('.tradehistory_items_group').forEach(groupHistoryList);
}

/**
 * Запускает модуль: один проход сразу + `MutationObserver` — тот же
 * debounce-паттерн, что и у `offer-currency-total`/`bptf-listing-trade-
 * params` (в отличие от оригинала — там разовый проход без учёта AJAX-
 * подгрузки истории, см. их же комментарии за подробным разбором).
 */
export function startOfferItemSummary(): { stop: () => void } {
  scan();

  let debounceTimer: number | undefined;
  const observer = new MutationObserver(() => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(scan, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return {
    stop: () => {
      observer.disconnect();
      window.clearTimeout(debounceTimer);
    },
  };
}
