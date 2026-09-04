import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountQuickAddPanel } from '../modules/quick-add-items/panel';
import { QUICK_ADD_FEATURE_ID } from '../modules/quick-add-items/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/quick-add-items/panel.css?inline';

/**
 * ISOLATED-половина панели "Быстрое добавление предметов" — см. README
 * §"Модуль `quick-add-items`" и modules/quick-add-items/{core,panel}.ts.
 *
 * Якорь — `.trade_box_contents` внутри `#inventory_box`: это классическая
 * (не React) разметка страницы оффера, тот же контейнер, в который
 * оригинальный Steam Trade Offer Enhancer добавляет свою панель управления
 * (`$tradeBox.append(...)`, см. core.ts) — стабильна, в отличие от
 * React-панели предмета в инвентаре (см. pricedb-check-button), поэтому
 * достаточно строкового якоря без пересчёта на каждый ремонт.
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let mountedHandle: { destroy: () => void } | null = null;
    let locale: Locale = await getLocale();

    const ui = await createShadowRootUi(ctx, {
      name: 'tf2suite-quickadd-panel',
      position: 'inline',
      anchor: '#inventory_box div.trade_box_contents',
      append: 'last',
      css: tokensCss + panelCss,
      onMount: (container) => {
        mountedHandle = mountQuickAddPanel(container, locale);
        return mountedHandle;
      },
      onRemove: () => {
        mountedHandle?.destroy();
        mountedHandle = null;
      },
    });

    let enabled = await isFeatureEnabled(QUICK_ADD_FEATURE_ID);
    if (enabled) ui.mount();

    // Смена локали — тем же путём, что и вкл/выкл (полный remove+mount, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[QUICK_ADD_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          ui.mount();
        } else {
          ui.remove();
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        ui.remove();
        ui.mount();
      }
    });
    ctx.onInvalidated(stopWatching);
  },
});
