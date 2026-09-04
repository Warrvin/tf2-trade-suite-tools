/**
 * Кнопки "Только spells" / "Только strange parts" над списками объявлений
 * (`ul.media-list` — Sell Orders / Buy Orders) на classic backpack.tf
 * `/classifieds*` и `/stats/*`.
 *
 * Портировано из tf2TradingUtils (backpack.tf/oldUI/filterSpecialListings/
 * content.js, зачитан целиком через jsdelivr), но логика ИНВЕРТИРОВАНА по
 * прямой просьбе пользователя: оригинал СКРЫВАЕТ по умолчанию все листинги
 * со спеллом/strange part и даёт одну кнопку "показать скрытые". Пользователь
 * попросил ровно наоборот — не прятать, а по требованию ПОКАЗЫВАТЬ ТОЛЬКО
 * листинги с нужным атрибутом: отдельная кнопка под Sheen [здесь: spells] и
 * отдельная под strange parts, обе independent-toggle, при включении ОБЕИХ
 * сразу — виден листинг, у которого есть ХОТЯ БЫ ОДИН из двух атрибутов
 * (ИЛИ, не И — прямое решение пользователя на уточняющий вопрос).
 *
 * Детектор "у этого листинга есть спелл/strange part" — портирован из
 * оригинала БЕЗ ИЗМЕНЕНИЙ (сам механизм не зависел от направления
 * hide/show): `.item` внутри `<li class="listing">` несёt один
 * `data-spell_N`/`data-part_name_N` атрибут на каждый спелл/strange part
 * предмета — наличие ЛЮБОГО атрибута с префиксом `data-spell_` или
 * `data-part_name_` и есть признак. Живой HTML подтвердил, что это всё ещё
 * ровно так работает СЕГОДНЯ (проверено на реальных лотах `/classifieds`
 * пользователя):
 *   - лот со strange part: `.item[data-part_name_1="Dominations"]
 *     [data-part_score_1="0"][data-part_price_1="6.55–6.85 keys"]
 *     [data-part_name_2="..."]...` — несколько частей нумеруются подряд;
 *     в `<h5>` заголовка листинга рядом с названием предмета ещё и текстом
 *     видно `<small>Parts Attached</small>` (не используем как признак —
 *     атрибут надёжнее и не завязан на текст конкретной локали страницы).
 *   - лот со спеллом: `.item[data-spell_1="Weapon Spell: Exorcism"]` —
 *     аналогично, `data-spell_1`, `data-spell_2`... при нескольких.
 *
 * `ul.media-list`/`li.listing` — общая для ОБЕИХ страниц разметка (то же
 * подтверждено уже реализованным `bptf-listing-trade-params`, который
 * разбирает `.listing` единым кодом что на /classifieds, что на /stats, без
 * ветвления по странице — см. его doc-блок), поэтому здесь тоже не
 * разделяем логику по типу страницы.
 *
 * MutationObserver — как у bptf-listing-trade-params (и по той же причине,
 * см. его doc-блок): на /stats объявления подгружаются AJAX'ом без
 * перезагрузки страницы, на /classifieds пагинация — обычные переходы по
 * ссылке (полная перезагрузка), но держать два разных пути ради этого не
 * стали — один наблюдатель безопасно отрабатывает на обеих страницах.
 *
 * Кнопки добавляются НЕ для каждого списка подряд, а только когда в нём
 * реально есть хотя бы один подходящий лот — и только та кнопка, категория
 * которой в этом списке присутствует (если в колонке только спелл-лоты,
 * кнопки "Только strange parts" там не будет вовсе, а не мёртвая пустая
 * кнопка).
 */

import type { Locale } from '../../utils/i18n';

const PROCESSED_ATTR = 'data-tf2s-filter-special';
const TOOLBAR_CLASS = 'tf2s-filter-special-toolbar';

const UI = {
  ru: { spellsOnly: 'Только spells', partsOnly: 'Только strange parts' },
  en: { spellsOnly: 'Spells only', partsOnly: 'Strange parts only' },
} as const;

function listingHasSpell(li: HTMLElement): boolean {
  const item = li.querySelector<HTMLElement>('.item');
  if (!item) return false;
  return [...item.attributes].some(({ name }) => name.startsWith('data-spell_'));
}

function listingHasStrangeParts(li: HTMLElement): boolean {
  const item = li.querySelector<HTMLElement>('.item');
  if (!item) return false;
  return [...item.attributes].some(({ name }) => name.startsWith('data-part_name_'));
}

/** И spellActive, и partsActive выключены -> показать всё. Иначе — ИЛИ по включённым категориям. */
function applyVisibility(listings: readonly HTMLElement[], spellActive: boolean, partsActive: boolean): void {
  if (!spellActive && !partsActive) {
    listings.forEach((li) => {
      li.style.display = '';
    });
    return;
  }
  listings.forEach((li) => {
    const show = (spellActive && listingHasSpell(li)) || (partsActive && listingHasStrangeParts(li));
    li.style.display = show ? '' : 'none';
  });
}

function buildToggleButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  // btn/btn-default/btn-sm — их же классы (те же, что у кнопок-крошек
  // #search-crumbs, см. bptf-ks-tier-buttons) — не своя палитра.
  btn.className = 'btn btn-default btn-sm';
  btn.textContent = label;
  return btn;
}

function processList(ul: HTMLElement, locale: Locale): void {
  if (ul.hasAttribute(PROCESSED_ATTR)) return;

  const listings = [...ul.querySelectorAll<HTMLElement>(':scope > li.listing')];
  if (!listings.length) return; // пусто ("No items found") или ещё не подгрузилось — не помечаем, попробуем на следующем скане

  const hasAnySpell = listings.some(listingHasSpell);
  const hasAnyParts = listings.some(listingHasStrangeParts);
  // Не помечаем PROCESSED_ATTR: на /stats листинги могут довгрузиться позже
  // AJAX'ом (см. doc-блок файла) — следующий скан должен получить шанс
  // найти в них спеллы/parts, которых сейчас ещё не было в DOM.
  if (!hasAnySpell && !hasAnyParts) return;

  ul.setAttribute(PROCESSED_ATTR, '1');

  let spellActive = false;
  let partsActive = false;

  const toolbar = document.createElement('div');
  toolbar.classList.add(TOOLBAR_CLASS, 'btn-group', 'btn-group-sm');

  if (hasAnySpell) {
    const spellBtn = buildToggleButton(UI[locale].spellsOnly);
    spellBtn.addEventListener('click', () => {
      spellActive = !spellActive;
      spellBtn.classList.toggle('active', spellActive);
      applyVisibility(listings, spellActive, partsActive);
    });
    toolbar.appendChild(spellBtn);
  }

  if (hasAnyParts) {
    const partsBtn = buildToggleButton(UI[locale].partsOnly);
    partsBtn.addEventListener('click', () => {
      partsActive = !partsActive;
      partsBtn.classList.toggle('active', partsActive);
      applyVisibility(listings, spellActive, partsActive);
    });
    toolbar.appendChild(partsBtn);
  }

  ul.insertAdjacentElement('beforebegin', toolbar);
}

function scan(locale: Locale): void {
  document.querySelectorAll<HTMLElement>('ul.media-list').forEach((ul) => processList(ul, locale));
}

export function startBptfFilterSpecial(locale: Locale): { stop: () => void } {
  scan(locale);

  let debounceTimer: number | undefined;
  const observer = new MutationObserver(() => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => scan(locale), 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return {
    stop: () => {
      observer.disconnect();
      window.clearTimeout(debounceTimer);
      document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((el) => el.remove());
      // Сбрасываем display на случай, если какой-то фильтр был активен —
      // иначе выключение модуля молча оставило бы часть лотов скрытыми
      // без способа их вернуть.
      document.querySelectorAll<HTMLElement>('ul.media-list > li.listing').forEach((li) => {
        li.style.display = '';
      });
      document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => el.removeAttribute(PROCESSED_ATTR));
    },
  };
}
