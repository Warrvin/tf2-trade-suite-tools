import { defineContentScript } from 'wxt/sandbox';
import { getLocale, getModuleOption, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { DEFAULT_ICON_DETAIL_LEVEL, ICON_DETAIL_OPTION_KEY, IconDetailLevel } from '../utils/icon-detail-level';
import { startMarketItemAttributes } from '../modules/market-item-attributes/apply';
import { MARKET_ATTRIBUTES_FEATURE_ID } from '../modules/market-item-attributes/types';
// Общий файл с trade-item-attributes и inventory-item-attributes (требование
// 4 — не дублировать функционал): классы, которые строит
// utils/item-attribute-render.ts, одинаковы независимо от страницы.
import '../styles/item-attributes.css';

export default defineContentScript({
  matches: ['*://steamcommunity.com/market/listings/440/*'],
  async main(ctx) {
    let handle: { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } | null = null;
    let enabled = await isFeatureEnabled(MARKET_ATTRIBUTES_FEATURE_ID);
    let detailLevel = await getModuleOption<IconDetailLevel>(
      MARKET_ATTRIBUTES_FEATURE_ID,
      ICON_DETAIL_OPTION_KEY,
      DEFAULT_ICON_DETAIL_LEVEL,
    );
    let locale: Locale = await getLocale();
    if (enabled) handle = startMarketItemAttributes(detailLevel, locale);

    // Живой тумблер/опция — как и у двух других "атрибуты предмета"-модулей,
    // включение/выключение и смена уровня детализации в настройках
    // применяются сразу, без перезагрузки вкладки. Смена языка — тем же
    // путём (см. entrypoints/tradeoffer-attributes.content.ts за
    // объяснением, почему просто stop+start).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[MARKET_ATTRIBUTES_FEATURE_ID] ?? false;
      const nextDetailLevel =
        (settings.moduleOptions[MARKET_ATTRIBUTES_FEATURE_ID]?.[ICON_DETAIL_OPTION_KEY] as IconDetailLevel | undefined) ??
        DEFAULT_ICON_DETAIL_LEVEL;

      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          detailLevel = nextDetailLevel;
          locale = settings.locale;
          handle = startMarketItemAttributes(detailLevel, locale);
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
        handle = startMarketItemAttributes(detailLevel, locale);
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
