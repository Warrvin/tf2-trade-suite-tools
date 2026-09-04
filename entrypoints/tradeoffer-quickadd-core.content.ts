import { defineContentScript } from 'wxt/sandbox';
import { registerQuickAddCoreHandler } from '../modules/quick-add-items/core';

export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    registerQuickAddCoreHandler();
  },
});
