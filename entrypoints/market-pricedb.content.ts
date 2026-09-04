import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startMarketPricedbCheckButton } from '../modules/market-pricedb-check-button/apply';
import { MARKET_PRICEDB_FEATURE_ID } from '../modules/market-pricedb-check-button/types';
// НЕ shadow root (см. row-button.css) — по кнопке на КАЖДУЮ строку
// листинга, обычная manifest-инъекция CSS в light DOM, как у
// styles/item-attributes.css.
import '../modules/market-pricedb-check-button/row-button.css';

export default defineContentScript({
  matches: ['*://steamcommunity.com/market/listings/440/*'],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;
    let enabled = await isFeatureEnabled(MARKET_PRICEDB_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startMarketPricedbCheckButton(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[MARKET_PRICEDB_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startMarketPricedbCheckButton(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startMarketPricedbCheckButton(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
