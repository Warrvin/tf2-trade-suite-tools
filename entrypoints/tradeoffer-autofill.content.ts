import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountAutoFillPanel, AutoFillPanelOptions } from '../modules/auto-fill-from-listing/panel';
import { AUTO_FILL_FEATURE_ID, LISTING_PRICE_BUTTON_FEATURE_ID } from '../modules/auto-fill-from-listing/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/auto-fill-from-listing/panel.css?inline';

/**
 * ISOLATED-половина автозаполнения — см. README §"Модуль
 * `auto-fill-from-listing`" и modules/auto-fill-from-listing/{core,panel}.ts.
 *
 * Тот же якорь, что и у quick-add-items (`.trade_box_contents`) — обе
 * панели живут в одном месте страницы оффера; если включены обе, эта
 * встанет ПОСЛЕ панели быстрого добавления (append: 'last').
 *
 * ДВА НЕЗАВИСИМЫХ ТУМБЛЕРА в одной панели (см. types.ts): UI монтируется,
 * если включён ХОТЯ БЫ ОДИН из них (`AUTO_FILL_FEATURE_ID` — автоматический
 * режим без кликов, `LISTING_PRICE_BUTTON_FEATURE_ID` — ручная кнопка), а
 * дальше panel.ts сам решает, что именно показывать/опрашивать — см.
 * `mountAutoFillPanel`'s `AutoFillPanelOptions`. Оба значения читаются из
 * настроек и передаются внутрь панели живым `setOptions`, так что
 * переключение любого тумблера на лету (без перезагрузки страницы оффера)
 * применяется сразу.
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let mountedHandle: { destroy: () => void; setOptions: (options: AutoFillPanelOptions) => void } | null = null;
    let autoFillEnabled = await isFeatureEnabled(AUTO_FILL_FEATURE_ID);
    let priceButtonEnabled = await isFeatureEnabled(LISTING_PRICE_BUTTON_FEATURE_ID);
    let locale: Locale = await getLocale();

    const ui = await createShadowRootUi(ctx, {
      name: 'tf2suite-autofill-panel',
      position: 'inline',
      anchor: '#inventory_box div.trade_box_contents',
      append: 'last',
      css: tokensCss + panelCss,
      onMount: (container) => {
        mountedHandle = mountAutoFillPanel(container, { autoFillEnabled, priceButtonEnabled }, locale);
        return mountedHandle;
      },
      onRemove: () => {
        mountedHandle?.destroy();
        mountedHandle = null;
      },
    });

    let enabled = autoFillEnabled || priceButtonEnabled;
    if (enabled) ui.mount();

    const stopWatching = watchSettings((settings) => {
      const nextAutoFill = settings.features[AUTO_FILL_FEATURE_ID] ?? false;
      const nextPriceButton = settings.features[LISTING_PRICE_BUTTON_FEATURE_ID] ?? false;
      autoFillEnabled = nextAutoFill;
      priceButtonEnabled = nextPriceButton;

      const shouldBeEnabled = autoFillEnabled || priceButtonEnabled;
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

      // Смена локали, пока панель остаётся смонтированной — polling-колбэки
      // (pollForItem/pollAddPrice/pollAddOwnItem) держат `locale` в своём
      // замыкании, setOptions() его не обновит, поэтому тут — полный
      // remove+mount, как и у остальных модулей (см. utils/i18n.ts).
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        ui.remove();
        ui.mount();
        return;
      }

      // Уже смонтировано и остаётся смонтированным — просто передать новые
      // значения тумблеров живой панели (без пересоздания DOM).
      if (enabled) mountedHandle?.setOptions({ autoFillEnabled, priceButtonEnabled });
    });
    ctx.onInvalidated(stopWatching);
  },
});
