import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountWalletPanel } from '../modules/wallet-summary/panel';
import { WALLET_FEATURE_ID } from '../modules/wallet-summary/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/wallet-summary/panel.css?inline';

export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let mountedHandle: { destroy: () => void } | null = null;
    let locale: Locale = await getLocale();

    const ui = await createShadowRootUi(ctx, {
      name: 'tf2suite-wallet-panel',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      css: tokensCss + panelCss,
      onMount: (container) => {
        mountedHandle = mountWalletPanel(container, locale);
        return mountedHandle;
      },
      onRemove: () => {
        mountedHandle?.destroy();
        mountedHandle = null;
      },
    });

    let enabled = await isFeatureEnabled(WALLET_FEATURE_ID);
    if (enabled) ui.mount();

    // Живой тумблер: пользователь щёлкнул фичу на options-странице — панель
    // появляется/исчезает без перезагрузки вкладки Steam. Смена локали —
    // тем же путём, что и вкл/выкл (полный remove+mount, см. utils/i18n.ts).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[WALLET_FEATURE_ID] ?? false;
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
