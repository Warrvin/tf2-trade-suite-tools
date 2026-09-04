/**
 * Общие имена классов и хелпер для бейджа "×N", которым `offer-item-summary`
 * помечает схлопнутые повторяющиеся предметы в списке офферов/истории —
 * вынесено сюда (требование 4), потому что `offer-currency-total` тоже
 * должен уметь ЧИТАТЬ этот бейдж (см. её README-раздел и `TODO` в её
 * core.ts): если `offer-item-summary` уже схлопнул 5 одинаковых Refined
 * Metal в один тайл + бейдж "×5", подсчёт валюты, считающий каждый DOM-
 * элемент за один предмет, задвоил бы это в меньшую сторону (посчитал бы
 * как 1, а не 5) — если не прочитать её бейдж.
 *
 * ПОРЯДОК ВЫПОЛНЕНИЯ МЕЖДУ ДВУМЯ МОДУЛЯМИ НЕ ГАРАНТИРОВАН (независимые
 * content-скрипты, оба реагируют на один и тот же MutationObserver-триггер
 * загрузки страницы) — `getBadgeQty` возвращает `1`, если бейджа ещё нет
 * (значит `offer-item-summary` либо выключен, либо ещё не успел
 * отработать на этой строке), поэтому подсчёт `offer-currency-total`
 * корректен в ОБОИХ случаях: бейдж уже есть — считаем по нему; бейджа нет
 * — считаем поэлементно, как если бы группировки не было вовсе (тот же
 * принцип, что и в исходном tf2TradingUtils — там оба скрипта договариваются
 * тем же способом).
 */

/** Класс бейджа на `/tradeoffers`(`/sent`) — накладывается на сам `.trade_item` (`position: absolute`). */
export const TRADE_ITEM_QTY_CLASS = 'tf2s-item-qty';
/** Класс бейджа на `/tradehistory` — вставляется текстом внутрь `.history_item_name`. */
export const HISTORY_ITEM_QTY_CLASS = 'tf2s-history-qty';

/** Читает число из бейджа "×N" внутри/на элементе — `1`, если бейджа нет. */
export function getBadgeQty(el: Element, badgeClass: string): number {
  const badge = el.querySelector(`.${badgeClass}`);
  if (!badge) return 1;
  const n = parseInt(badge.textContent?.replace(/[^\d]/g, '') ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
