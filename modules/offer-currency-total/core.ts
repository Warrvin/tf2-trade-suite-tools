import { CurrencyKind, formatKeysAndScrap, getCurrencyKindFromName, METAL_SCRAP_VALUE } from '../../utils/currency';
import { getBadgeQty, HISTORY_ITEM_QTY_CLASS, TRADE_ITEM_QTY_CLASS } from '../../utils/offer-list-badges';
import type { Locale } from '../../utils/i18n';

const UI = {
  ru: { items: 'Предметы', received: 'Получено', given: 'Отдано', itemCount: (n: number) => `${n} предм.` },
  en: { items: 'Items', received: 'Received', given: 'Given', itemCount: (n: number) => `${n} item${n === 1 ? '' : 's'}` },
} as const;

/**
 * "Движок" модуля — двухколоночная сводка валюты (что каждая сторона
 * даёт/получает) для каждой записи в списке офферов (`/tradeoffers`,
 * `/tradeoffers/sent`) и истории трейдов (`/tradehistory`). Портировано из
 * **tf2TradingUtils** (Franciscoborges2002/tf2TradingUtils,
 * `steamcommunity.com/tradeOfferCurrency/content.js#addTradeCurrencyTotals`)
 * — та же идея, что и у уже готового `trade-item-summary` (сводка валюты по
 * сторонам), но там это разбор `window.g_rgCurrentTradeStatus` НА СТРАНИЦЕ
 * ОФФЕРА; здесь того же JS-глобала просто нет (см. ниже), так что общего
 * кода с ним, по сути, нет — переиспользуется только форматирование
 * (`utils/currency.ts#formatKeysAndScrap`, требование 4).
 *
 * Второй модуль вообще без MAIN-мира (как `bptf-listing-trade-params`):
 * страница списка офферов/истории не даёт JS-объектов чужого реалма — три
 * DOM. Поэтому и здесь всё умещается в один файл, обычный (ISOLATED)
 * content-script без пары entrypoint'ов и без `utils/bridge.ts`.
 *
 * ДВЕ РАЗНЫЕ разметки, определяющие ДВА разных способа узнать валюту:
 *  - `/tradeoffers`(`/sent`): строка — `.tradeoffer`, у каждого предмета
 *    (`.trade_item`) НЕТ имени/текста вообще — только иконка и
 *    `data-economy-item="classinfo/440/<classid>/<instanceid>"`. Валюта
 *    матчится по `classid` (см. `CURRENCY_KIND_BY_CLASSID` — тот же classid,
 *    что подтверждён живыми classinfo-ответами в tf2TradingUtils, ОТДЕЛЬНЫЙ
 *    id от TF2-схемного defindex из utils/currency.ts, см. её комментарий),
 *    с резервным вариантом по хэшу иконки в src (`CURRENCY_KIND_BY_ICON_HASH`)
 *    на случай, если у какого-то аккаунта/локали `data-economy-item` вдруг
 *    не окажется — НЕ подтверждено живым тестом, чистая подстраховка.
 *  - `/tradehistory`: строка — `.tradehistoryrow`, у каждого предмета
 *    (`.history_item`) ЕСТЬ обычное имя (`.history_item_name`) — здесь
 *    достаточно уже существующего `getCurrencyKindFromName`, как и везде
 *    в проекте (никакого отдельного classid-пути не нужно).
 *
 * Подсчёт количества: каждый `.trade_item`/`.history_item` — ОДИН предмет,
 * ЕСЛИ на нём нет бейджа "×N" от `offer-item-summary` (соседний модуль той
 * же страницы, схлопывает повторяющиеся предметы в один тайл + бейдж) —
 * если бейдж есть, считаем по нему (см. `utils/offer-list-badges.ts` за
 * тем, почему порядок выполнения двух независимых модулей не важен: бейджа
 * ещё нет — считаем поэлементно, ровно то же самое число, что было бы и без
 * группировки).
 */

/**
 * Steam economy classid (см. utils/currency.ts#CURRENCY_DEFINDEX за тем, чем
 * classid отличается от TF2-схемного defindex) для каждого валютного
 * предмета — нужен ТОЛЬКО здесь, см. шапку файла.
 */
const CURRENCY_KIND_BY_CLASSID: Record<string, CurrencyKind> = {
  '101785959': 'keys',
  '2674': 'refined',
  '5564': 'reclaimed',
  '2675': 'scrap',
};

/** Резервный путь по хэшу иконки в src — см. шапку файла. */
const CURRENCY_KIND_BY_ICON_HASH: Record<string, CurrencyKind> = {
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEAaR4uURrwvz0N252yVaDVWrRTno9m4ccG2GNqxlQoZrC2aG9hcVGUWflbX_drrVu5UGki5sAij6tOtQ':
    'keys',
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsO1Mv6NGucF1Ygzt8ZQijJukFMiMrbhYDEwI1yRVKNfD6xorQ3qW3Jr6546DNPuou9IOVK4p4kWJaA':
    'refined',
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsO0Mv6NGucF1YJlscMEgDdvxVYsMLPkMmFjI1OSUvMHDPBp9lu0CnVluZQxA9Gwp-hIOVK4sMMNWF4':
    'reclaimed',
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsPZAfOeD-VOn4phtsdQ32ZtxFYoN7PkYmVmIgeaUKNaX_Rjpwy8UHMz6pcxAIfnovUWJ1t9nYFqYw':
    'scrap',
};

const METAL_KINDS: ReadonlySet<CurrencyKind> = new Set(['refined', 'reclaimed', 'scrap']);

function scrapValueOf(kind: CurrencyKind): number {
  return METAL_KINDS.has(kind) ? METAL_SCRAP_VALUE[kind as 'refined' | 'reclaimed' | 'scrap'] : 0;
}

interface SideTotal {
  label: string;
  keys: number;
  metalScrap: number;
  itemCount: number;
}

const BOX_CLASS = 'tf2s-offercur';
const PROCESSED_ATTR = 'data-tf2s-currency-total';

/**
 * Рисует двухколоночную (или больше, на всякий случай — вдруг сторон не
 * ровно две) плашку — ВСЕГДА, если стороны вообще есть, даже если валюты
 * нет ни у одной из них (тогда каждая сторона показывает число предметов
 * вместо суммы, см. цикл ниже).
 *
 * ИСПРАВЛЕНО (баг-репорт живым тестом на реальных Входящих офферах, где
 * оказалось, что валюты нет вообще ни в одном из них — только предметы
 * без ключей/металла). Оригинал (tf2TradingUtils) в этом случае молчит
 * целиком — «a trade with no currency anywhere isn't what this box is
 * for» — так было портировано и здесь изначально. Пользователь явно
 * попросил другое: плашка должна показываться ВСЕГДА, чтобы по одному
 * взгляду было видно и что валюта есть (сумма), и что её нет (число
 * предметов) — а не пропадать молча в самом частом на практике случае
 * (чисто предметные офферы). Разница с оригиналом сознательная, не баг
 * порта.
 */
function renderTotalBox(sides: SideTotal[], locale: Locale): HTMLElement | null {
  if (sides.length === 0) return null;
  const withText = sides.map((s) => ({ ...s, text: formatKeysAndScrap(s.keys, s.metalScrap) }));

  const box = document.createElement('div');
  box.className = BOX_CLASS;

  withText.forEach((side, i) => {
    if (i > 0) {
      const divider = document.createElement('div');
      divider.className = `${BOX_CLASS}__divider`;
      box.appendChild(divider);
    }

    const col = document.createElement('div');
    col.className = `${BOX_CLASS}__side`;

    const label = document.createElement('span');
    label.className = `${BOX_CLASS}__label`;
    label.textContent = side.label;
    col.appendChild(label);

    const value = document.createElement('span');
    value.className = `${BOX_CLASS}__value`;
    // "N предм." — то же сокращение и та же логика (без валюты — просто
    // число), что уже использует modules/trade-item-summary/panel.ts для
    // не-валютных предметов (`+ ${otherCount} предм.`), не изобретаем
    // новую формулировку рядом с уже существующей.
    value.textContent = side.text ?? UI[locale].itemCount(side.itemCount);
    col.appendChild(value);

    box.appendChild(col);
  });

  return box;
}

// ───────────────────────── /tradeoffers(/sent) — по classid ─────────────────────────

function matchOfferCurrency(tradeItemEl: Element): CurrencyKind | null {
  const economyItem = tradeItemEl.getAttribute('data-economy-item') ?? '';
  const classid = economyItem.match(/^classinfo\/\d+\/(\d+)\//)?.[1];
  if (classid && CURRENCY_KIND_BY_CLASSID[classid]) return CURRENCY_KIND_BY_CLASSID[classid];

  const src = tradeItemEl.querySelector('img')?.getAttribute('src') ?? '';
  for (const [hash, kind] of Object.entries(CURRENCY_KIND_BY_ICON_HASH)) {
    if (src.includes(hash)) return kind;
  }
  return null;
}

/** Текст заголовка этой стороны (например, "Hat Crafter offered") — своя у
 *  каждого блока, поэтому не подписываем сами "Вы"/"Партнёр": на `/sent`
 *  порядок сторон не обязательно тот же, что во "Входящих" (см. оригинал). */
function offerSideLabel(itemsBlockEl: Element, locale: Locale): string {
  const header = itemsBlockEl.querySelector(':scope > .tradeoffer_items_header');
  return header?.textContent?.trim().replace(/:$/, '') || UI[locale].items;
}

function sumOfferSide(itemsBlockEl: Element, locale: Locale): SideTotal {
  let keys = 0;
  let metalScrap = 0;
  let itemCount = 0;

  for (const item of itemsBlockEl.querySelectorAll(':scope > .tradeoffer_item_list > .trade_item')) {
    const qty = getBadgeQty(item, TRADE_ITEM_QTY_CLASS);
    itemCount += qty;
    const kind = matchOfferCurrency(item);
    if (!kind) continue;
    if (kind === 'keys') keys += qty;
    else metalScrap += scrapValueOf(kind) * qty;
  }

  return { label: offerSideLabel(itemsBlockEl, locale), keys, metalScrap, itemCount };
}

function processTradeoffer(tradeEl: Element, locale: Locale): void {
  if (tradeEl.hasAttribute(PROCESSED_ATTR)) return;
  tradeEl.setAttribute(PROCESSED_ATTR, '1');

  const header = tradeEl.querySelector(':scope > .tradeoffer_header');
  if (!header) return;

  const sideBlocks = [...tradeEl.querySelectorAll(':scope > .tradeoffer_items_ctn > .tradeoffer_items')];
  if (sideBlocks.length < 2) return; // неожиданная разметка — лучше промолчать, чем гадать

  const box = renderTotalBox(sideBlocks.map((b) => sumOfferSide(b, locale)), locale);
  if (box) header.insertAdjacentElement('afterend', box);
}

// ───────────────────────── /tradehistory — по имени ─────────────────────────

/** Текст элемента БЕЗ вложенного бейджа "×N" (см. вызов ниже за тем, зачем —
 *  тот же приём, что и у `bptf-listing-trade-params#parseNextListing` для
 *  вырезания иконки перед чтением цены: клонируем, чтобы не портить живой
 *  DOM, удаляем бейдж из клона, читаем текст. */
function cloneWithoutBadge(el: Element, badgeClass: string): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelector(`.${badgeClass}`)?.remove();
  return clone.textContent?.trim() ?? '';
}

function historySideLabel(itemsBlockEl: Element, locale: Locale): string {
  const symbol = itemsBlockEl.querySelector(':scope > .tradehistory_items_plusminus')?.textContent?.trim();
  if (symbol === '+') return UI[locale].received;
  if (symbol === '–' || symbol === '-') return UI[locale].given; // "–" у Steam — тире, не дефис
  return UI[locale].items;
}

function sumHistorySide(itemsBlockEl: Element, locale: Locale): SideTotal {
  let keys = 0;
  let metalScrap = 0;
  let itemCount = 0;

  for (const item of itemsBlockEl.querySelectorAll(':scope > .tradehistory_items_group > .history_item')) {
    const nameEl = item.querySelector('.history_item_name');
    // Имя читаем БЕЗ бейджа "×N" внутри него (offer-item-summary дописывает
    // его текстом прямо в .history_item_name) — иначе "Refined Metal×5" не
    // совпадёт с точным market_hash_name в getCurrencyKindFromName.
    const name = nameEl ? cloneWithoutBadge(nameEl, HISTORY_ITEM_QTY_CLASS) : null;
    if (!name) continue;

    const qty = getBadgeQty(item, HISTORY_ITEM_QTY_CLASS);
    itemCount += qty;

    const kind = getCurrencyKindFromName(name);
    if (!kind) continue;
    if (kind === 'keys') keys += qty;
    else metalScrap += scrapValueOf(kind) * qty;
  }

  return { label: historySideLabel(itemsBlockEl, locale), keys, metalScrap, itemCount };
}

function processHistoryRow(rowEl: Element, locale: Locale): void {
  if (rowEl.hasAttribute(PROCESSED_ATTR)) return;
  rowEl.setAttribute(PROCESSED_ATTR, '1');

  const description = rowEl.querySelector(':scope > .tradehistory_content > .tradehistory_event_description');
  if (!description) return;

  const sideBlocks = [...rowEl.querySelectorAll(':scope > .tradehistory_content > .tradehistory_items')];
  if (!sideBlocks.length) return;

  const box = renderTotalBox(sideBlocks.map((b) => sumHistorySide(b, locale)), locale);
  if (box) description.insertAdjacentElement('afterend', box);
}

// ───────────────────────── Запуск ─────────────────────────

function scan(locale: Locale): void {
  document.querySelectorAll('.tradeoffer').forEach((el) => processTradeoffer(el, locale));
  document.querySelectorAll('.tradehistoryrow').forEach((el) => processHistoryRow(el, locale));
}

/**
 * Запускает модуль: один проход сразу + `MutationObserver` на случай
 * динамической подгрузки — В ОТЛИЧИЕ от оригинала (там ровно один проход
 * на загрузке страницы, без учёта того, что Steam догружает историю
 * постранично AJAX-кнопкой "Load More", не полной перезагрузкой). Тот же
 * debounce-паттерн, что и у `bptf-listing-trade-params`: безвреден там, где
 * не нужен (уже обработанные строки помечены `PROCESSED_ATTR`, повторный
 * проход по ним — дешёвый no-op).
 */
export function startOfferCurrencyTotal(locale: Locale): { stop: () => void } {
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
    },
  };
}
