import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startStnItemLinks } from '../modules/stn-item-links/core';
import { STN_ITEM_LINKS_FEATURE_ID } from '../modules/stn-item-links/types';
import '../styles/stn-item-links.css';

/**
 * Единственный entrypoint модуля — см. modules/stn-item-links/core.ts за
 * тем, почему тут нет пары MAIN/ISOLATED (как и у `offer-currency-total`/
 * `offer-item-summary`): вся нужная информация (имя предмета) — обычный
 * текст в разметке страницы, чужого JS-реалма трогать незачем.
 *
 * Только страница КОНКРЕТНОГО предмета (`/item/tf2/<имя>`), не
 * `/item-overview/tf2/<имя>` (это страница ПОИСКА/списка результатов по
 * похожим именам, там нет ни одного <h1 class="card-title"> — подтверждено
 * живым запросом WebFetch, структура вообще другая, список ссылок на
 * отдельные предметы).
 */
export default defineContentScript({
  matches: ['*://stntrading.eu/item/tf2/*'],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(STN_ITEM_LINKS_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startStnItemLinks(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[STN_ITEM_LINKS_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startStnItemLinks(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startStnItemLinks(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
