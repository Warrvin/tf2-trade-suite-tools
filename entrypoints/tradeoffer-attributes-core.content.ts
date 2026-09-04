import { defineContentScript } from 'wxt/sandbox';
import { registerAttributesCoreHandler } from '../modules/trade-item-attributes/core';

/**
 * MAIN-world сторона модуля "Иконки и рамки предметов в оффере" — читает
 * window.g_rgAppContextData/g_rgPartnerAppContextData (см. core.ts) и
 * отвечает на запросы ISOLATED-скрипта (tradeoffer-attributes.content.ts).
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  world: 'MAIN',
  main() {
    registerAttributesCoreHandler();
  },
});
