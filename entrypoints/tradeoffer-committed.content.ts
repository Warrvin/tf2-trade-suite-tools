import { defineContentScript } from 'wxt/sandbox';
import { isFeatureEnabled, watchSettings } from '../utils/settings';
import { startTradeOfferCommittedTracker } from '../modules/trade-committed-items/tradeoffer-apply';
import { COMMITTED_ITEMS_FEATURE_ID } from '../modules/trade-committed-items/types';
import '../styles/committed-items.css';

/**
 * Entrypoint отслеживания и подсветки занятых предметов на странице оформления оффера (/tradeoffer/*).
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;
    let enabled = await isFeatureEnabled(COMMITTED_ITEMS_FEATURE_ID);

    if (enabled) {
      handle = startTradeOfferCommittedTracker();
    }

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[COMMITTED_ITEMS_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          handle = startTradeOfferCommittedTracker();
        } else {
          handle?.stop();
          handle = null;
        }
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
