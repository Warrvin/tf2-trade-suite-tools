import { defineContentScript } from 'wxt/sandbox';
import { registerAutoFillCoreHandler } from '../modules/auto-fill-from-listing/core';

export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    registerAutoFillCoreHandler();
  },
});
