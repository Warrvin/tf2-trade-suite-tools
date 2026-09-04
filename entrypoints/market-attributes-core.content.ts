import { defineContentScript } from 'wxt/sandbox';
import { registerMarketAttributesCoreHandler } from '../modules/market-item-attributes/core';

/**
 * MAIN-world сторона модуля "Иконки предметов на Steam Market" — читает
 * window.g_rgAssets (см. core.ts) и отвечает на запросы ISOLATED-скрипта
 * (market-attributes.content.ts). В отличие от inventory-item-attributes
 * здесь ничего не перехватывается (нет fetch/XHR-моста) — данные читаются
 * по запросу напрямую, поэтому явный runAt: 'document_start' тут не нужен
 * (тот баг был именно про то, что перехват сети должен встать РАНЬШЕ первого
 * запроса страницы — здесь такого перехвата нет).
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/market/listings/440/*'],
  world: 'MAIN',
  main() {
    registerMarketAttributesCoreHandler();
  },
});
