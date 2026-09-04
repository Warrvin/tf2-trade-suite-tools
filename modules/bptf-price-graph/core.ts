import { resolveSku } from '../../utils/pricedb';

/**
 * График цены PriceDB.io на странице предмета classic backpack.tf
 * (`/stats/<Quality>/<Item>/Tradable/Craftable[...]`) — вставляется ПЕРЕД
 * заголовком "Classifieds" (по прямой просьбе пользователя: "я бы хотел
 * чтобы он был сверху перед листинингами а не как в оригинале снизу"),
 * стилизован под нативные секции самой страницы (по просьбе "стилизовать
 * под бэкпак тф"), а не как тёмный бокс оригинала-источника.
 *
 * Портировано из tf2trader (offish/tf2-trader, utils/graph.ts
 * #createPricedbGraphIframe + entrypoints/backpack-stats.content.ts
 * #insertGraph — оба зачитаны целиком через jsdelivr) c ТРЕМЯ изменениями:
 *
 *  1. Точка вставки. Оригинал вставляет график перед
 *     `.guttered:has(.stats-graph)` — это нативный график Timeline ВВЕРХУ
 *     страницы (первая секция после заголовка предмета), а не перед
 *     Classifieds. Пользователь явно попросил другое место — прямо перед
 *     листингами. Устойчивый на сегодня якорь для этого —
 *     `document.getElementById('classifieds')` (`<h2 id="classifieds">`):
 *     живым HTML подтверждено на ДВУХ разных страницах предметов с разным
 *     набором секций статистики перед ним —
 *       - .../Strange/Specialized%20Killstreak%20Rocket%20Launcher/...:
 *         Timeline -> "Strange Parts" -> "Classifieds"
 *       - .../Haunted/Crone's%20Dome/...:
 *         Timeline -> "Paint Distribution" -> "Level Distribution" ->
 *         "Classifieds"
 *     в обоих случаях сразу после `<h2 id="classifieds">` идёт
 *     `<div class="guttered"><div class="row">` с Sell/Buy Orders — то есть
 *     сам якорь не зависит от того, какие необязательные секции статистики
 *     есть у конкретного предмета. `moveClassifiedsToTop()` оригинала (она
 *     физически переставляет секцию Classifieds в начало страницы) НЕ
 *     портируется — это отдельная, не запрошенная функциональность.
 *
 *  2. Разметка/стили блока. Оригинал — свой тёмный inline-стилизованный
 *     div (`background:#1b1b1b;border:1px solid #222`), чужеродный на
 *     светлой панели backpack.tf. Здесь вместо этого — их же классы,
 *     скопированные с нативных нижних секций статистики ("Strange Parts"/
 *     "Paint Distribution" на подтверждённом выше живом HTML): пара
 *     `<h2>` + `<div class="guttered"><div class="stats-graph">...</div>
 *     </div>` — тот же паттерн, что у ЛЮБОЙ их родной секции графика. Сам
 *     iframe нативного класса не имеет (в оригинале это тоже просто
 *     `<iframe>` без класса) — под его размер здесь только и нужен
 *     собственный CSS, см. styles/bptf-price-graph.css.
 *
 *  3. SKU для URL графика (`https://pricedb.io/api/graph/<sku>`) — та же
 *     идея, что у оригинала (`getSkuFromMarketplaceLink`), но с фолбэком,
 *     которого у оригинала нет:
 *       - Тир 1 — родная ссылка Marketplace.tf на странице, если она есть:
 *         `a.price-box[href*="marketplace.tf/partneritem"]`, SKU — её
 *         query-параметр `sku` (пример из живого HTML: href
 *         `.../partneritem?sku=920;13&attrib=bp` -> sku `920;13`). Даёт
 *         точный SKU без единого сетевого запроса.
 *       - Тир 2 (фолбэк) — эта ссылка есть НЕ у каждого предмета: на живой
 *         странице Strange Specialized Killstreak Rocket Launcher в блоке
 *         price-box была только ссылка на Steam Community Market, без
 *         Marketplace.tf. Оригинал в этом случае строит SKU сам (парсинг
 *         URL + своя карта названий качеств `TAG_TO_QUALITY`). Здесь вместо
 *         этого — уже реализованный в проекте `utils/pricedb.ts#resolveSku`
 *         (тот же провайдер, PriceDB.io, свой SKU-резолвер по имени;
 *         используется также в pricedb-check-button/market-pricedb-check-
 *         button/trade-item-summary, требование 4 — не дублировать) по
 *         "человеческому" имени предмета — Quality + Item из сегментов
 *         текущего пути `/stats/...`. Формат пути и индексы сегментов —
 *         НЕ новая догадка, а уже подтверждённая живым HTML разметка,
 *         используемая (для другой цели, сверки с оружием) в
 *         bptf-ks-tier-buttons/core.ts#getBaseWeaponName — тот же
 *         `['', 'stats', Quality, Item, 'Tradable', 'Craftable'|
 *         'Non-Craftable', EffectId?]`. В отличие от неё, префиксы
 *         Killstreak/Australium/Festive здесь НЕ срезаются — PriceDB.io
 *         ожидает полное человеческое имя (как market_hash_name), а не
 *         голое название оружия для сверки со списком, см.
 *         utils/pricedb.ts#buildPriceableName. Unusual-предметы (для них
 *         market_hash_name/сегмент пути не содержит названия эффекта, а
 *         без него resolveSku не находит нужный SKU — см. doc-блок
 *         buildPriceableName) живым HTML под /stats не проверялись; в этом
 *         случае resolveSku просто вернёт null и график не появится
 *         (см. ниже — тихий отказ, а не ошибка).
 *
 * Без MutationObserver: как и bptf-ks-tier-buttons, `<h2 id="classifieds">`
 * и всё, что перед ним, отдаётся сервером сразу в исходном HTML страницы
 * (подтверждено обоими живыми дампами) — только сами объявления внутри
 * секции подгружаются AJAX'ом на /stats (см. doc-блок
 * bptf-listing-trade-params), сама секция и её заголовок — нет. Одного
 * прохода при старте content-скрипта достаточно.
 *
 * Сетевой resolveSku() вызывается из ISOLATED-стороны (обычный, не MAIN,
 * content-script — как и требует doc-блок utils/pricedb.ts), host_permissions
 * на pricedb.io/sku.pricedb.io уже даны в wxt.config.ts для остальных
 * модулей, использующих тот же файл.
 */

import type { Locale } from '../../utils/i18n';

const HEADING_CLASS = 'tf2s-price-graph-heading';
const WRAPPER_CLASS = 'tf2s-price-graph-guttered';
const GRAPH_BASE = 'https://pricedb.io/api/graph/';

const UI = {
  ru: { heading: 'График цены' },
  en: { heading: 'Price Graph' },
} as const;

/** Тир 1 — SKU из родной ссылки Marketplace.tf на странице, если она есть (см. doc-блок файла). */
function getMarketplaceSku(): string | null {
  const link = document.querySelector<HTMLAnchorElement>('a.price-box[href*="marketplace.tf/partneritem"]');
  if (!link) return null;
  try {
    return new URL(link.href).searchParams.get('sku');
  } catch {
    return null;
  }
}

/** Полное человеческое имя предмета из сегментов пути /stats/<Quality>/<Item>/... — см. doc-блок файла. */
function getFullItemName(): string | null {
  if (!location.pathname.startsWith('/stats/')) return null;
  const segs = location.pathname.split('/').map(decodeURIComponent);
  const quality = segs[2];
  const item = segs[3];
  if (!quality || !item) return null;
  return `${quality} ${item}`;
}

/** Тир 1 (marketplace-ссылка), затем тир 2 (resolveSku по имени из пути) — см. doc-блок файла. */
async function resolveGraphSku(): Promise<string | null> {
  const marketplaceSku = getMarketplaceSku();
  if (marketplaceSku) return marketplaceSku;

  const name = getFullItemName();
  if (!name) return null;
  return resolveSku(name);
}

function buildGraphBlock(sku: string, locale: Locale): { heading: HTMLHeadingElement; wrapper: HTMLDivElement } {
  const heading = document.createElement('h2');
  heading.className = HEADING_CLASS;
  heading.textContent = UI[locale].heading;

  const wrapper = document.createElement('div');
  // guttered — их же класс секции-обёртки (см. doc-блок файла), не своя разметка.
  wrapper.className = `guttered ${WRAPPER_CLASS}`;

  const graphBox = document.createElement('div');
  // stats-graph — их же класс контейнера графика внутри guttered-секции (см. doc-блок файла).
  graphBox.className = 'stats-graph';

  const iframe = document.createElement('iframe');
  iframe.src = GRAPH_BASE + encodeURIComponent(sku);
  iframe.loading = 'lazy';
  iframe.className = 'tf2s-price-graph-iframe';
  // Без скролла внутри самого iframe — на скриншоте пользователя при
  // недостаточной высоте (см. styles/bptf-price-graph.css) появлялся
  // отдельный скроллбар внутри блока графика вместо обычной прокрутки
  // страницы; теперь, когда высоты хватает на весь график целиком, скролл
  // внутри iframe вообще не нужен и явно отключён, а не просто "не должен
  // был понадобиться".
  iframe.setAttribute('scrolling', 'no');

  graphBox.appendChild(iframe);
  wrapper.appendChild(graphBox);

  return { heading, wrapper };
}

export function startBptfPriceGraph(locale: Locale): { stop: () => void } {
  let cancelled = false;
  let insertedHeading: HTMLElement | null = null;
  let insertedWrapper: HTMLElement | null = null;

  const classifiedsHeading = document.getElementById('classifieds');
  // Нет якоря (страница без секции Classifieds) или график уже вставлен
  // (повторный вкл/выкл настройки быстрее, чем успел отработать fetch) —
  // ничего не делаем.
  if (classifiedsHeading && !document.querySelector(`.${WRAPPER_CLASS}`)) {
    resolveGraphSku().then((sku) => {
      // Модуль выключили настройкой, пока резолвился SKU — тихо выходим,
      // ничего не вставляем (см. stop() ниже — там тоже страхуемся на этот случай).
      if (cancelled || !sku) return;
      const { heading, wrapper } = buildGraphBlock(sku, locale);
      classifiedsHeading.before(heading, wrapper);
      insertedHeading = heading;
      insertedWrapper = wrapper;
    });
  }

  return {
    stop: () => {
      cancelled = true;
      insertedHeading?.remove();
      insertedWrapper?.remove();
      // На случай гонки (см. комментарий выше) — подчищаем и по классу,
      // не только по сохранённой ссылке.
      document.querySelectorAll(`.${HEADING_CLASS}, .${WRAPPER_CLASS}`).forEach((el) => el.remove());
    },
  };
}
