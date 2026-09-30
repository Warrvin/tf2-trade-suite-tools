import { defineContentScript } from 'wxt/sandbox';
import { isFeatureEnabled, watchSettings } from '../utils/settings';
import { startInventoryCommittedTracker } from '../modules/trade-committed-items/inventory-apply';
import { COMMITTED_ITEMS_FEATURE_ID } from '../modules/trade-committed-items/types';
import '../styles/committed-items.css';

/**
 * Entrypoint отслеживания и подсветки занятых предметов на странице инвентаря Steam.
 */
export default defineContentScript({
  matches: [
    '*://steamcommunity.com/id/*/inventory*',
    '*://steamcommunity.com/profiles/*/inventory*',
    '*://steamcommunity.com/my/inventory*',
  ],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;
    let enabled = await isFeatureEnabled(COMMITTED_ITEMS_FEATURE_ID);

    if (enabled) {
      handle = startInventoryCommittedTracker();
    }

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[COMMITTED_ITEMS_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          handle = startInventoryCommittedTracker();
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
