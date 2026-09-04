import { defineContentScript } from 'wxt/sandbox';
import { registerPricedbCheckCoreHandler } from '../modules/pricedb-check-button/core';

// MAIN-world половина модуля — тот же перехват fetch/XHR инвентаря
// (utils/inventory-watch.ts), что и у inventory-item-attributes /
// inventory-currency-counter (требование 4). runAt: 'document_start' по той
// же причине, что и у entrypoints/inventory-attributes-core.content.ts (см.
// её комментарий) — иначе первые ~100-150 предметов (первые постраничные
// запросы Steam) проходят мимо перехвата.
export default defineContentScript({
  matches: ['*://steamcommunity.com/id/*/inventory*', '*://steamcommunity.com/profiles/*/inventory*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    registerPricedbCheckCoreHandler();
  },
});
