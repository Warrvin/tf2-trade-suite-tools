import { defineContentScript } from 'wxt/sandbox';
import { getLocale, getModuleOption, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { DEFAULT_ICON_DETAIL_LEVEL, ICON_DETAIL_OPTION_KEY, IconDetailLevel } from '../utils/icon-detail-level';
import { startInventoryItemAttributes } from '../modules/inventory-item-attributes/apply';
import { INVENTORY_ATTRIBUTES_FEATURE_ID } from '../modules/inventory-item-attributes/types';
// Обычный (НЕ ?inline) импорт — тот же общий файл, что и у trade-item-attributes
// (требование 4 — не дублировать функционал): классы, которые строит
// utils/item-attribute-render.ts, одинаковы независимо от страницы.
import '../styles/item-attributes.css';

export default defineContentScript({
  matches: ['*://steamcommunity.com/id/*/inventory*', '*://steamcommunity.com/profiles/*/inventory*'],
  async main(ctx) {
    let handle: { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } | null = null;
    let enabled = await isFeatureEnabled(INVENTORY_ATTRIBUTES_FEATURE_ID);
    let detailLevel = await getModuleOption<IconDetailLevel>(
      INVENTORY_ATTRIBUTES_FEATURE_ID,
      ICON_DETAIL_OPTION_KEY,
      DEFAULT_ICON_DETAIL_LEVEL,
    );
    let locale: Locale = await getLocale();
    if (enabled) handle = startInventoryItemAttributes(detailLevel, locale);

    // Живой тумблер/опция — как и у trade-item-attributes, включение/
    // выключение и смена уровня детализации в настройках применяются сразу,
    // без перезагрузки вкладки. Смена языка — тем же путём, что и у
    // trade-item-attributes (см. его entrypoint за объяснением, почему
    // просто stop+start, а не отдельный "setLocale").
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[INVENTORY_ATTRIBUTES_FEATURE_ID] ?? false;
      const nextDetailLevel =
        (settings.moduleOptions[INVENTORY_ATTRIBUTES_FEATURE_ID]?.[ICON_DETAIL_OPTION_KEY] as IconDetailLevel | undefined) ??
        DEFAULT_ICON_DETAIL_LEVEL;

      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          detailLevel = nextDetailLevel;
          locale = settings.locale;
          handle = startInventoryItemAttributes(detailLevel, locale);
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
        handle = startInventoryItemAttributes(detailLevel, locale);
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
