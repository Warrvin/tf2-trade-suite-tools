import { defineContentScript } from 'wxt/sandbox';
import { registerWalletCoreHandler } from '../modules/wallet-summary/core';

export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    registerWalletCoreHandler();
  },
});
