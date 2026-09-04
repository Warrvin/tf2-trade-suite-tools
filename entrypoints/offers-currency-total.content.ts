import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startOfferCurrencyTotal } from '../modules/offer-currency-total/core';
import { OFFER_CURRENCY_TOTAL_FEATURE_ID } from '../modules/offer-currency-total/types';
import '../styles/offer-currency-total.css';

/**
 * Единственный entrypoint модуля — см. README §"Модуль
 * `offer-currency-total`" и core.ts за тем, почему тут нет пары
 * MAIN/ISOLATED (как и у `bptf-listing-trade-params`): ни список офферов,
 * ни история не отдают ничего специфичного для JS-реалма страницы.
 *
 * `/tradeoffers`(`/sent`) и `/tradehistory` — обе разновидности адреса
 * (`/id/<vanity>/...`, `/profiles/<id>/...`, `/my/...` — последний Steam сам
 * редиректит на профиль пользователя, но матчим и его на случай, если
 * редирект не успеет до инъекции content-script'а).
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

    let enabled = await isFeatureEnabled(OFFER_CURRENCY_TOTAL_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startOfferCurrencyTotal(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[OFFER_CURRENCY_TOTAL_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startOfferCurrencyTotal(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startOfferCurrencyTotal(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
