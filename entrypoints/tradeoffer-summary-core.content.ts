import { defineContentScript } from 'wxt/sandbox';
import { registerTradeSummaryCoreHandler } from '../modules/trade-item-summary/core';

export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    registerTradeSummaryCoreHandler();
  },
});
