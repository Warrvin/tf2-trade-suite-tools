import { pricedbItemUrl, pricedbSearchUrl, resolveSku } from '../../utils/pricedb';
import type { Locale } from '../../utils/i18n';

const UI = {
  ru: { checkOnPricedb: 'Проверить на PriceDB.io' },
  en: { checkOnPricedb: 'Check on PriceDB.io' },
} as const;

/**
 * Быстрые ссылки на странице конкретного предмета stntrading.eu
 * (`/item/tf2/<имя>`) — куда сходить проверить его на других площадках.
 *
 * Изначально в реестре (utils/registry.ts) это было расписано как пять
 * отдельных ссылок — bp.tf / mannco.store / marketplace.tf / Steam Market
 * / Wiki, как у портируемого stntrading.eu/itemLinks в tf2TradingUtils.
 * Но у этого оригинала внутри — Полноценный движок с TF2-схемой (имя ->
 * defindex, ~180Кб вшитого JSON, utils/tf2ItemSchema.js) ради ЕДИНСТВЕННОЙ
 * цели — построить marketplace.tf/pricedb.io-style "sku" (defindex;
 * quality;модификаторы). Пользователь явно предложил более простой путь:
 * у нас в проекте УЖЕ есть точно такой же sku-резолвер — PriceDB.io
 * (utils/pricedb.ts, requirement 4 — тот же провайдер, что и в
 * pricedb-check-button / market-pricedb-check-button, ни строчки не
 * продублировано) — а страница конкретного предмета на PriceDB.io САМА
 * ссылается на добрый десяток других площадок разом, включая Steam Market
 * (подтверждено живым запросом WebFetch на pricedb.io/item/143;6 —
 * Backpack.tf, Backpack.tf Next, STN Trading, Mannco.store, Skinport,
 * Merchant.tf, CTrade.tf, Steam Community Market, Gladiator.tf —
 * marketplace.tf среди них не было, но остальные четыре из изначального
 * списка покрыты и с запасом). Поэтому вместо пяти отдельно построенных
 * ссылок — ОДНА: сама PriceDB.io. Собственную ссылку на Steam Market
 * (изначально была — своя, без обращения к PriceDB.io) убрали по
 * явной просьбе пользователя: та, что уже есть на странице PriceDB.io,
 * строится ИЗ РЕЗОЛВНУТОГО SKU, то есть гарантированно ведёт на
 * правильный предмет любого качества — а наша своя версия просто
 * URL-кодировала текст `<h1>` напрямую, без проверки, что Steam вообще
 * знает такой market_hash_name. Wiki и marketplace.tf сознательно не
 * строим отдельно — Wiki ссылается на СТАТЬЮ базового предмета без учёта
 * качества (потребовал бы то же самое "срезать качество из имени", что и
 * у backpack.tf stats в исходнике — отдельная небольшая функция, которой
 * сейчас нигде в проекте нет, дублировать ради одной кнопки не стали), а
 * marketplace.tf и так недостижим без той же самой TF2-схемы, которую мы
 * решили не тащить.
 *
 * Разметка страницы — ЖИВОЙ HTML с реального аккаунта пользователя
 * (stntrading.eu/item/tf2/Taunt%3A+The+High+Five%21, вставлен целиком в
 * чат через "Просмотр кода страницы", т.к. WebFetch эту страницу видит
 * только через markdown-конвертацию и теряет точные классы). Название
 * предмета — в <h1 class="fs-3 card-title"> (ДВА одинаковых h1 на
 * странице: один в d-block d-sm-none контейнере для мобилки, другой в
 * d-none d-sm-block для десктопа — оба текстом идентичны, но только ОДИН
 * виден при любой ширине экрана). Полное имя (с префиксом качества/
 * Non-Craftable, как Steam market_hash_name) — ровно текст h1, никакого
 * парсинга не требуется.
 *
 * Кнопка вставляется рядом с "Request Repricing" (`#request_reprice`) —
 * их собственной кнопкой той же природы ("узнать больше про этот
 * предмет"), и ОФОРМЛЕНА ТЕМИ ЖЕ bootstrap-классами, что и она
 * (`btn btn-secondary rounded-0` — подтверждено живым HTML: их framework
 * это Bootstrap 5, уже загружен на странице, свои цвета/hover/паддинги
 * подхватываются бесплатно, без единого литерального hex-цвета с нашей
 * стороны). `#request_reprice` — id, один на странице, НЕ дублируется под
 * mobile/desktop (в отличие от h1) — единственная точка вставки, не две.
 * На случай если у какого-то типа предмета этой кнопки вдруг нет (не
 * проверено живым тестом на каждом типе) — резервный путь: вставка после
 * КАЖДОГО `<h1 class="card-title">` (оба варианта, mobile+desktop), тем
 * же приёмом, что раньше был основным.
 *
 * Ошибочная страница несуществующего предмета не проверена живым тестом
 * (не встретилась) — но раз мы просто ищем `#request_reprice`/
 * `h1.card-title` и тихо ничего не делаем при их отсутствии, отдельная
 * проверка на конкретный класс ошибки (как у оригинала — `.error-box`,
 * актуальность которого не подтверждена) не нужна.
 */

const PROCESSED_ATTR = 'data-tf2s-stn-links';
const LINK_CLASS = 'tf2s-stn-link-btn';
const ITEM_ATTR = 'data-tf2s-stn-item';

function buildLink(itemName: string, locale: Locale): HTMLAnchorElement {
  const pricedbLink = document.createElement('a');
  // btn btn-secondary rounded-0 — те же классы, что у соседней "Request
  // Repricing" (см. шапку файла); tf2s-stn-link-btn — только маленький
  // сброс своих полей (styles/stn-item-links.css), без цветов.
  // ms-2/my-1 — их же bootstrap-утилиты отступов (см. живой HTML: та же
  // "Request Repricing" использует ms-sm-3): ms-2 разносит с соседней
  // кнопкой в общем flex-ряду, my-1 не даёт слипнуться в резервном пути
  // (после <h1>, вне flex-ряда). Порядок "текст, потом иконка" — как у
  // их же "Add to Wishlist <i class="fas fa-heart"></i>"/
  // "Request Repricing <i class="fas fa-search-dollar"></i>".
  pricedbLink.className = `btn btn-secondary rounded-0 ms-2 my-1 ${LINK_CLASS}`;
  pricedbLink.target = '_blank';
  pricedbLink.rel = 'noopener noreferrer';
  pricedbLink.href = pricedbSearchUrl(itemName); // оптимистично, апгрейдим ниже — тот же приём, что и market-pricedb-check-button/apply.ts
  pricedbLink.innerHTML = `${UI[locale].checkOnPricedb} <i class="fas fa-tags"></i>`;
  pricedbLink.setAttribute(ITEM_ATTR, itemName);

  void resolveSku(itemName).then((sku) => {
    // Кнопка могла успеть обработаться заново под другое имя (SPA-переход
    // без перезагрузки), пока резолвился SKU — проверяем, что ссылка всё
    // ещё "наша" для этого же предмета, прежде чем менять href.
    if (pricedbLink.getAttribute(ITEM_ATTR) !== itemName) return;
    if (sku) pricedbLink.href = pricedbItemUrl(sku);
  });

  return pricedbLink;
}

function processAnchorButton(anchor: HTMLElement, locale: Locale): void {
  const itemName = document.querySelector('h1.card-title')?.textContent?.trim();
  if (!itemName) return;
  anchor.setAttribute(PROCESSED_ATTR, '1');
  anchor.insertAdjacentElement('afterend', buildLink(itemName, locale));
}

function processHeading(h1: HTMLElement, locale: Locale): void {
  if (h1.hasAttribute(PROCESSED_ATTR)) return;
  const itemName = h1.textContent?.trim();
  if (!itemName) return;
  h1.setAttribute(PROCESSED_ATTR, '1');
  h1.insertAdjacentElement('afterend', buildLink(itemName, locale));
}

function scan(locale: Locale): void {
  const repriceButton = document.querySelector<HTMLElement>('#request_reprice');
  if (repriceButton && !repriceButton.hasAttribute(PROCESSED_ATTR)) {
    processAnchorButton(repriceButton, locale);
    return; // предпочтительное место сработало — резервный путь по h1 не нужен
  }
  if (repriceButton) return; // уже обработан на прошлом скане

  // Резервный путь — #request_reprice не найден на этом типе страницы.
  document.querySelectorAll<HTMLElement>('h1.card-title').forEach((h1) => processHeading(h1, locale));
}

export function startStnItemLinks(locale: Locale): { stop: () => void } {
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
      document.querySelectorAll(`.${LINK_CLASS}`).forEach((el) => el.remove());
      document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => el.removeAttribute(PROCESSED_ATTR));
    },
  };
}
