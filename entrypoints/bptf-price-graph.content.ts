import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startBptfPriceGraph } from '../modules/bptf-price-graph/core';
import { BPTF_PRICE_GRAPH_FEATURE_ID } from '../modules/bptf-price-graph/types';
import '../styles/bptf-price-graph.css';

/**
 * Единственный entrypoint модуля — см. modules/bptf-price-graph/core.ts.
 *
 * Только classic backpack.tf `/stats/*` (страница конкретного предмета,
 * где есть и `#classifieds`-якорь, и путь `/stats/<Quality>/<Item>/...`,
 * из которого строится имя предмета для SKU-резолва — см. core.ts) — БЕЗ
 * `/classifieds*` (это страница поиска по всем предметам сразу, там нет
 * ни одного конкретного SKU для графика) и БЕЗ next.backpack.tf (разметка
 * там не проверялась, тот же принцип "только подтверждённое", что и у
 * bptf-filter-special/bptf-ks-tier-buttons).
 */
export default defineContentScript({
  matches: ['*://backpack.tf/stats/*'],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(BPTF_PRICE_GRAPH_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startBptfPriceGraph(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[BPTF_PRICE_GRAPH_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startBptfPriceGraph(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startBptfPriceGraph(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
