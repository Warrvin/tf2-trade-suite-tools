import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startOffersListCommittedTracker } from '../modules/trade-committed-items/offers-list-apply';
import { COMMITTED_ITEMS_FEATURE_ID } from '../modules/trade-committed-items/types';
import '../styles/committed-items.css';

/**
 * Entrypoint синхронизации активных отправленных офферов и предупреждения о конфликтах на странице списка офферов (/tradeoffers).
 */
export default defineContentScript({
  matches: [
    '*://steamcommunity.com/id/*/tradeoffers*',
    '*://steamcommunity.com/profiles/*/tradeoffers*',
    '*://steamcommunity.com/my/tradeoffers*',
    '*://steamcommunity.com/tradeoffers*',
  ],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;
    let enabled = await isFeatureEnabled(COMMITTED_ITEMS_FEATURE_ID);
    let locale: Locale = await getLocale();

    if (enabled) {
      handle = startOffersListCommittedTracker(locale);
    }

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[COMMITTED_ITEMS_FEATURE_ID] ?? false;

      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startOffersListCommittedTracker(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }

      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startOffersListCommittedTracker(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
