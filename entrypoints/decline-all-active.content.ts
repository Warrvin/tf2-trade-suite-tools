import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startDeclineAllActive } from '../modules/decline-all-active/core';
import { DECLINE_ALL_ACTIVE_FEATURE_ID } from '../modules/decline-all-active/types';
import '../styles/decline-all-active.css';

/**
 * Единственный entrypoint модуля — см. modules/decline-all-active/core.ts.
 * `defaultEnabled: false` в utils/registry.ts (сама фича — массовое
 * необратимое действие, включена по умолчанию быть не должна) — тумблер
 * всё равно есть в настройках, включается вручную.
 *
 * Матчи и причина отсутствия MAIN-мира — те же, что у
 * `instant-accept-decline` (см. его doc-блок): sessionid из cookie,
 * SteamID64 партнёра из DOM-атрибута, `/sent` отсекается рантайм-проверкой
 * внутри core.ts, а не матч-паттерном (WXT это не умеет).
 */
export default defineContentScript({
  matches: [
    '*://steamcommunity.com/id/*/tradeoffers*',
    '*://steamcommunity.com/profiles/*/tradeoffers*',
    '*://steamcommunity.com/my/tradeoffers*',
  ],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(DECLINE_ALL_ACTIVE_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startDeclineAllActive(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[DECLINE_ALL_ACTIVE_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startDeclineAllActive(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startDeclineAllActive(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
