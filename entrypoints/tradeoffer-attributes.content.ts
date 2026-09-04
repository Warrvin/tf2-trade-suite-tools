import { defineContentScript } from 'wxt/sandbox';
import { getLocale, getModuleOption, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startItemAttributes } from '../modules/trade-item-attributes/apply';
import {
  ATTRIBUTES_FEATURE_ID,
  DEFAULT_ICON_DETAIL_LEVEL,
  ICON_DETAIL_OPTION_KEY,
  IconDetailLevel,
} from '../modules/trade-item-attributes/types';
// Обычный (НЕ ?inline) импорт — css уходит в manifest content_scripts,
// Chrome/Firefox сами инжектят его в страницу целиком, без shadow root:
// классы должны прицепиться к настоящим .item-элементам Стима. Общий файл
// (styles/item-attributes.css) — те же классы использует и
// inventory-item-attributes (требование 4 — не дублировать функционал).
import '../styles/item-attributes.css';

export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  async main(ctx) {
    let handle: { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } | null = null;
    let enabled = await isFeatureEnabled(ATTRIBUTES_FEATURE_ID);
    let detailLevel = await getModuleOption<IconDetailLevel>(ATTRIBUTES_FEATURE_ID, ICON_DETAIL_OPTION_KEY, DEFAULT_ICON_DETAIL_LEVEL);
    let locale: Locale = await getLocale();
    if (enabled) handle = startItemAttributes(detailLevel, locale);

    // Живой тумблер/опция — как и в wallet-summary, включение/выключение и
    // смена уровня детализации в настройках применяются сразу, без
    // перезагрузки вкладки. Смена языка (locale) — тем же путём: полный
    // stop+start, а не точечный setDetailLevel — редких подписей (см.
    // utils/item-attribute-render.ts) немного, не стоило заводить под них
    // отдельный "setLocale" в handle, когда простой перезапуск уже даёт
    // тот же видимый результат (см. utils/i18n.ts за общим объяснением
    // этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[ATTRIBUTES_FEATURE_ID] ?? false;
      const nextDetailLevel = (settings.moduleOptions[ATTRIBUTES_FEATURE_ID]?.[ICON_DETAIL_OPTION_KEY] as IconDetailLevel | undefined) ?? DEFAULT_ICON_DETAIL_LEVEL;

      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          detailLevel = nextDetailLevel;
          locale = settings.locale;
          handle = startItemAttributes(detailLevel, locale);
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
        handle = startItemAttributes(detailLevel, locale);
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
