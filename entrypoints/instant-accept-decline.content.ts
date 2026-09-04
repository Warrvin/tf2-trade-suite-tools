import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startInstantAcceptDecline } from '../modules/instant-accept-decline/core';
import { INSTANT_ACCEPT_DECLINE_FEATURE_ID } from '../modules/instant-accept-decline/types';
import '../styles/instant-accept-decline.css';

/**
 * Единственный entrypoint модуля — см. modules/instant-accept-decline/core.ts
 * за подробным обоснованием. Обычный (ISOLATED) content-script, как и у
 * offer-currency-total/offer-item-summary (той же страницы) — SteamID64
 * партнёра берём из обычного DOM-атрибута (utils/steamid.ts), sessionid — из
 * cookie (utils/steam-trade-offer-api.ts), MAIN-мир не нужен.
 *
 * Только `/tradeoffers` (входящие) — НЕ `/tradehistory` (там принимать/
 * отклонять уже нечего, только прошлые записи) и НЕ `/tradeoffers/sent`
 * (свои исходящие офферы принимать нельзя — там только "Cancel", другая по
 * смыслу операция, не входит в эту функцию).
 */
export default defineContentScript({
  matches: [
    '*://steamcommunity.com/id/*/tradeoffers*',
    '*://steamcommunity.com/profiles/*/tradeoffers*',
    '*://steamcommunity.com/my/tradeoffers*',
  ],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(INSTANT_ACCEPT_DECLINE_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startInstantAcceptDecline(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[INSTANT_ACCEPT_DECLINE_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startInstantAcceptDecline(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startInstantAcceptDecline(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
