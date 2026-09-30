import { defineContentScript } from 'wxt/sandbox';
import { getLocale, getModuleOption, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { DEFAULT_ICON_DETAIL_LEVEL, ICON_DETAIL_OPTION_KEY, IconDetailLevel } from '../utils/icon-detail-level';
import { startOffersItemAttributes } from '../modules/offers-item-attributes/apply';
import { OFFERS_ATTRIBUTES_FEATURE_ID } from '../modules/offers-item-attributes/types';
import '../styles/item-attributes.css';

/**
 * Entrypoint модуля отображения атрибутов предметов в списке офферов и истории.
 * Единственный ISOLATED-скрипт без MAIN-bridge (same-origin запросы к itemclasshover).
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
    let handle: { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } | null = null;
    let enabled = await isFeatureEnabled(OFFERS_ATTRIBUTES_FEATURE_ID);
    let detailLevel = await getModuleOption<IconDetailLevel>(
      OFFERS_ATTRIBUTES_FEATURE_ID,
      ICON_DETAIL_OPTION_KEY,
      DEFAULT_ICON_DETAIL_LEVEL,
    );
    let locale: Locale = await getLocale();
    if (enabled) handle = startOffersItemAttributes(detailLevel, locale);

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[OFFERS_ATTRIBUTES_FEATURE_ID] ?? false;
      const nextDetailLevel =
        (settings.moduleOptions[OFFERS_ATTRIBUTES_FEATURE_ID]?.[ICON_DETAIL_OPTION_KEY] as IconDetailLevel | undefined) ??
        DEFAULT_ICON_DETAIL_LEVEL;

      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          detailLevel = nextDetailLevel;
          locale = settings.locale;
          handle = startOffersItemAttributes(detailLevel, locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }

      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        detailLevel = nextDetailLevel;
        handle?.stop();
        handle = startOffersItemAttributes(detailLevel, locale);
        return;
      }

      if (nextDetailLevel !== detailLevel) {
        detailLevel = nextDetailLevel;
        handle?.setDetailLevel(detailLevel);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
