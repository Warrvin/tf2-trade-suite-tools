import { defineContentScript } from 'wxt/sandbox';
import { registerMarketPricedbCoreHandler } from '../modules/market-pricedb-check-button/core';

/**
 * MAIN-world сторона модуля "Проверить цену на PriceDB.io" (Steam Market) —
 * читает те же данные страницы, что и market-item-attributes
 * (utils/market-item-source.ts, требование 4), поэтому здесь тоже не нужен
 * явный runAt: 'document_start' — см. комментарий в
 * entrypoints/market-attributes-core.content.ts (там же объяснение, почему
 * этого не требуется для Market, в отличие от инвентаря).
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/market/listings/440/*'],
  world: 'MAIN',
  main() {
    registerMarketPricedbCoreHandler();
  },
});
