import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startBptfFilterSpecial } from '../modules/bptf-filter-special/core';
import { BPTF_FILTER_SPECIAL_FEATURE_ID } from '../modules/bptf-filter-special/types';
import '../styles/bptf-filter-special.css';

/**
 * Единственный entrypoint модуля — см. modules/bptf-filter-special/core.ts.
 *
 * Матчи — те же две страницы, что у bptf-ks-tier-buttons (`/stats/*`,
 * `/classifieds*`, только classic backpack.tf, без next.backpack.tf — тот
 * же пользователем подтверждённый вариант сайта), т.к. `ul.media-list` со
 * списком объявлений встречается на обеих.
 */
export default defineContentScript({
  matches: ['*://backpack.tf/stats/*', '*://backpack.tf/classifieds*'],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(BPTF_FILTER_SPECIAL_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startBptfFilterSpecial(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[BPTF_FILTER_SPECIAL_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startBptfFilterSpecial(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startBptfFilterSpecial(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
