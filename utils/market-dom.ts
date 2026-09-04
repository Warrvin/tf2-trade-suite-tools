/**
 * DOM-хелперы, общие для КЛАССИЧЕСКОЙ страницы Market между
 * modules/market-item-attributes и modules/market-pricedb-check-button
 * (требование 4 — единая логика разбора разметки листингов, не по копии в
 * каждом модуле). Бета-версия своего аналога не имеет — там нет вообще
 * никакого id в разметке, оба модуля сопоставляют её позиционно каждый
 * своим независимым курсором поверх общего betaOrder (см.
 * utils/market-item-source.ts).
 */

/** Сама "Buy"-ссылка строки листинга классической страницы — общая точка
 *  для getMarketRowAssetId (парсинг id) и market-pricedb-check-button
 *  (нужен сам элемент как якорь, куда вставить свою кнопку рядом, см.
 *  modules/market-pricedb-check-button/apply.ts). */
export function getMarketRowBuyLink(row: HTMLElement): HTMLAnchorElement | null {
  return row.querySelector<HTMLAnchorElement>('div.market_listing_buy_button a');
}

/**
 * Достаёт assetId предмета из "Buy"-ссылки строки листинга — сам id нигде
 * не лежит в атрибутах строки (в отличие от .item[id] на офере/инвентаре),
 * только внутри javascript:-ссылки вида
 * BuyMarketListing('listing','<sellerId>','440','2','<assetId>').
 * Разбор 1:1 портирован из tf2trader (entrypoints/steam-market-listings.content.ts) —
 * рабочий, проверенный в реальном расширении вариант. Работает ТОЛЬКО на
 * классической странице — на бете такой ссылки в разметке нет вообще.
 */
export function getMarketRowAssetId(row: HTMLElement): string | null {
  const buyLink = getMarketRowBuyLink(row);
  if (!buyLink) return null;
  const href = buyLink.getAttribute('href') ?? '';
  if (!href.includes('BuyMarketListing')) return null;

  const params = href.replace('javascript:BuyMarketListing', '').replace(/[,()/ ]/g, '');
  const parts = params.split(/'(.+?)'/g).filter(Boolean);
  // parts = ['listing', sellerSteamId, appid, contextid, assetId]
  const assetId = parts[4];
  return assetId || null;
}

/** Строки результатов на классической странице — общий селектор (требование 4). */
export function getMarketClassicRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('#searchResultsRows .market_listing_row')];
}

/** Buy-кнопки на бете, в порядке отрисовки — сопоставляются позиционно с
 *  betaOrder (см. utils/market-item-source.ts) каждым модулем отдельно. */
export function getMarketBetaBuyButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[data-accent-color="green"]')];
}
