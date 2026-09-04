import { defineContentScript } from 'wxt/sandbox';
import { isFeatureEnabled, watchSettings } from '../utils/settings';
import { startOfferItemSummary } from '../modules/offer-item-summary/core';
import { OFFER_ITEM_SUMMARY_FEATURE_ID } from '../modules/offer-item-summary/types';
import '../styles/offer-item-summary.css';

/**
 * Единственный entrypoint модуля — см. README §"Модуль
 * `offer-item-summary`" и core.ts за тем, почему тут нет пары MAIN/ISOLATED.
 * Те же адреса, что и у `offer-currency-total` (soседний модуль той же
 * страницы) — см. её entrypoint за разбором вариантов URL.
 */
export default defineContentScript({
  matches: [
    '*://steamcommunity.com/id/*/tradeoffers*',
    '*://steamcommunity.com/profiles/*/tradeoffers*',
    '*://steamcommunity.com/my/tradeoffers*',
    '*://steamcommunity.com/id/*/tradehistory*',
    '*://steamcommunity.com/profiles/*/tradehistory*',
    '*://steamcommunity.com/my/tradehistory*',
  ],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(OFFER_ITEM_SUMMARY_FEATURE_ID);
    if (enabled) handle = startOfferItemSummary();

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[OFFER_ITEM_SUMMARY_FEATURE_ID] ?? false;
      if (shouldBeEnabled === enabled) return;
      enabled = shouldBeEnabled;
      if (enabled) {
        handle = startOfferItemSummary();
      } else {
        handle?.stop();
        handle = null;
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
