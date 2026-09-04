import type { ListingIntent } from '../../utils/listing-intent';

/**
 * "Движок" модуля — портирован из **tf2trader** (offish/tf2-trader на
 * GitHub, `utils/backpack.ts#processListings`), а не из Steam Trade Offer
 * Enhancer: у juliarose-форка (см. `auto-fill-from-listing`) есть только
 * старая вёрстка классических classifieds, а tf2trader уже умеет и её, и
 * актуальный React-интерфейс next.backpack.tf ("next"-режим ниже) — тот же
 * повод, что и у market-item-attributes с его бета-режимом Steam Market.
 *
 * ЕДИНСТВЕННЫЙ модуль страницы НЕ Steam, и первый модуль вообще без
 * MAIN-мира и utils/bridge.ts: он читает/меняет только обычный DOM
 * backpack.tf (текст, `data-*`-атрибуты, `href` кнопок) — никаких JS-
 * объектов чужой страницы, которые видны только из того же JS-реалма (как
 * `elItem.rgItem` на странице оффера Steam), тут просто нет. Поэтому весь
 * модуль — один файл, исполняющийся как обычный (ISOLATED) content-script.
 *
 * Смысл модуля: дописать в ссылку "предложить сделку" на каждом объявлении
 * то, что дальше читает `auto-fill-from-listing` на странице оффера Steam —
 * `listing_intent`/`listing_currencies_keys`/`listing_currencies_metal`
 * backpack.tf САМ в эту ссылку не кладёт (см. README §"Модуль
 * `auto-fill-from-listing`" — разобрано на живых ссылках пользователя:
 * у объявления на продажу нашёлся только `for_item`, у объявления на
 * покупку — вообще ничего). Без этого модуля кнопка "Добавить цену
 * объявления" там никогда не появляется, а объявления на покупку не
 * распознаются в принципе.
 */

interface Currencies {
  keys?: number;
  metal?: number;
}

/** Разбирает строку вида "5 keys, 2.33 ref" / "1.66 ref" в валюту — портировано
 *  из `stringToCurrencies`. */
function parseCurrencies(text: string | null | undefined): Currencies | null {
  if (!text) return null;

  const currencies: Currencies = {};
  for (const part of text.trim().replace(/\s+/g, ' ').split(',')) {
    const match = part.trim().match(/^([\d.]+)\s+(\w+)$/i);
    if (!match) continue;

    const value = parseFloat(match[1]);
    if (Number.isNaN(value)) continue;

    const unit = match[2].toLowerCase();
    if (unit === 'key' || unit === 'keys') currencies.keys = value;
    if (unit === 'metal' || unit === 'ref') currencies.metal = value;
  }

  return Object.keys(currencies).length === 0 ? null : currencies;
}

interface ParsedListing {
  offerLinkEl: HTMLAnchorElement | null;
  intent: 'buy' | 'sell' | null;
  currencies: Currencies | null;
  /** Название предмета — для объявлений на ПОКУПКУ это единственный способ
   *  вообще сказать auto-fill-from-listing, какой предмет имелся в виду:
   *  `for_item` для покупки backpack.tf не выдаёт (нет одного конкретного
   *  ассета — продавец выбирает сам, см. utils/listing-intent.ts). Пока
   *  `auto-fill-from-listing` эту строку не читает (только записываем на
   *  будущее — см. README, отдельная задача: "искать по названию в своём
   *  инвентаре" — не то же самое, что точный assetId, заслуживает
   *  отдельной проверки, прежде чем полагаться на неё автоматически). */
  itemName: string | null;
  /** `appid_contextid_assetid` для объявлений на продажу — на практике сам
   *  backpack.tf уже кладёт `for_item` в native-ссылку (см. README), это —
   *  подстраховка на случай разметки/страницы, где он это не делает. */
  forItem: string | null;
}

/** Классическая (не-React) вёрстка `backpack.tf/classifieds`,
 *  `backpack.tf/stats/*` — портировано из `itemEl.dataset`/`.listing-buttons`. */
function parseLegacyListing(listingEl: HTMLElement): ParsedListing {
  const itemEl = listingEl.querySelector<HTMLElement>('.item');
  const offerLinkEl = listingEl.querySelector<HTMLAnchorElement>('.listing-buttons')?.lastElementChild as HTMLAnchorElement | null;

  if (!itemEl) return { offerLinkEl, intent: null, currencies: null, itemName: null, forItem: null };

  const intent = itemEl.dataset.listing_intent === 'buy' ? 'buy' : itemEl.dataset.listing_intent === 'sell' ? 'sell' : null;
  const currencies = parseCurrencies(itemEl.dataset.listing_price);

  const nameEl = listingEl.querySelector('.listing-title h5');
  const itemName =
    (nameEl ? [...nameEl.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim()).filter(Boolean).join(' ') : '') ||
    itemEl.dataset.name ||
    itemEl.title ||
    null;

  return { offerLinkEl, intent, currencies, itemName: itemName || null, forItem: null };
}

/** React-вёрстка `next.backpack.tf/classifieds`, `next.backpack.tf/stats` —
 *  портировано из "next"-ветки `processListings`. Другая структура карточки
 *  объявления целиком: css-классы вместо data-атрибутов, цена — текст внутри
 *  `.item__price` (с иконкой внутри, которую нужно вырезать перед чтением
 *  текста), а `for_item` тут неоткуда взять из data-атрибута — только из
 *  href самой ссылки на объявление (`/classifieds/<appid>_<assetid>`). */
function parseNextListing(listingEl: HTMLElement): ParsedListing {
  const offerLinkEl = listingEl.querySelector<HTMLAnchorElement>('.listing__details__actions a.listing__details__actions__action');

  const intentEl = listingEl.querySelector('.listing__details__header .text-sell, .listing__details__header .text-buy');
  const intent: 'buy' | 'sell' | null = intentEl ? (intentEl.classList.contains('text-sell') ? 'sell' : 'buy') : null;

  let currencies: Currencies | null = null;
  const priceEl = listingEl.querySelector('.item__price');
  if (priceEl) {
    const clone = priceEl.cloneNode(true) as HTMLElement;
    clone.querySelector('svg')?.remove();
    currencies = parseCurrencies(clone.textContent?.trim());
  }

  let itemName: string | null = null;
  const headerLinkEl = listingEl.querySelector<HTMLAnchorElement>('a.listing__details__header');
  if (headerLinkEl) {
    const clone = headerLinkEl.cloneNode(true) as HTMLElement;
    clone.querySelector('.text-sell, .text-buy')?.remove();
    itemName = clone.textContent?.replace(/\s+/g, ' ').trim() || null;
  }

  let forItem: string | null = null;
  if (intent === 'sell' && headerLinkEl) {
    const match = headerLinkEl.getAttribute('href')?.match(/\/classifieds\/(\d+)_(\d+)$/);
    // TF2 Trade Suite Tools — расширение только под TF2 (contextid всегда '2', см.
    // utils/trade-offer.ts#TF2_CONTEXTID), поэтому не читаем его из ссылки.
    if (match) forItem = `${match[1]}_2_${match[2]}`;
  }

  return { offerLinkEl, intent, currencies, itemName, forItem };
}

const PROCESSED_ATTR = 'data-tf2s-listing-params';

/** Дописывает параметры в ОДНУ ссылку "предложить сделку" — общая часть для
 *  обоих режимов разметки после того, как объявление уже разобрано. */
function applyParams(listing: ParsedListing): void {
  const { offerLinkEl, intent, currencies } = listing;
  const href = offerLinkEl?.getAttribute('href');
  if (!offerLinkEl || !href || href.startsWith('steam://') || !intent || !currencies) return;

  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return; // битая/относительная не туда ссылка — не наш случай, пропускаем молча
  }

  const listingIntent: ListingIntent = intent === 'buy' ? 0 : 1;
  url.searchParams.set('listing_intent', String(listingIntent));
  if (currencies.keys) url.searchParams.set('listing_currencies_keys', String(currencies.keys));
  if (currencies.metal) url.searchParams.set('listing_currencies_metal', String(currencies.metal));
  if (listing.itemName) url.searchParams.set('listing_item_name', listing.itemName);

  // Только ДОБАВЛЯЕМ for_item, если backpack.tf его САМ ещё не положил —
  // не перезаписываем: живой тест подтвердил (см. README), что для продажи
  // native-ссылка backpack.tf уже несёт корректный for_item сама, трогать
  // готовое правильное значение своим — лишний риск разойтись с оригиналом.
  if (listing.forItem && listingIntent === 1 && !url.searchParams.has('for_item')) {
    url.searchParams.set('for_item', listing.forItem);
  }

  offerLinkEl.href = url.toString();
}

/** Один проход по всем ещё не обработанным объявлениям на странице —
 *  портировано из `processListings`. Режим ("next" или классика)
 *  определяется по хосту один раз для всей страницы (next.backpack.tf
 *  целиком на React, обычный backpack.tf — целиком нет, смешения не
 *  бывает). */
function scan(): void {
  const isNext = window.location.hostname.startsWith('next.');
  const listingEls = document.querySelectorAll<HTMLElement>('.listing');

  for (const listingEl of listingEls) {
    if (listingEl.hasAttribute(PROCESSED_ATTR)) continue;
    listingEl.setAttribute(PROCESSED_ATTR, '1');

    const parsed = isNext ? parseNextListing(listingEl) : parseLegacyListing(listingEl);
    applyParams(parsed);
  }
}

/**
 * Запускает модуль: один проход сразу + `MutationObserver` на случай
 * подгрузки объявлений без перезагрузки страницы (next.backpack.tf —
 * React SPA, у backpack.tf/stats тоже встречаются динамические блоки).
 * Классические `backpack.tf/classifieds` пагинируют обычной перезагрузкой
 * страницы, так что там `MutationObserver`, по сути, никогда не сработает —
 * но и не мешает, а не добавлять его ради этого частного случая означало бы
 * держать два разных пути только чтобы сэкономить один наблюдатель.
 */
export function startBptfListingTradeParams(): { stop: () => void } {
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
