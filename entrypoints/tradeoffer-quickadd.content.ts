import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, getModuleOption, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountQuickAddPanel } from '../modules/quick-add-items/panel';
import { DEFAULT_METAL_BUTTON_MODE, METAL_BUTTON_MODE_OPTION_KEY, MetalButtonMode, QUICK_ADD_FEATURE_ID } from '../modules/quick-add-items/types';
import {
  COMMITTED_ITEMS_FEATURE_ID,
  COMMITTED_OPTIONS_KEY,
  CommittedItemsOptions,
  DEFAULT_COMMITTED_ITEMS_OPTIONS,
} from '../modules/trade-committed-items/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/quick-add-items/panel.css?inline';

/**
 * ISOLATED-половина панели "Быстрое добавление предметов" — см. README
 * §"Модуль `quick-add-items`" и modules/quick-add-items/{core,panel}.ts.
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  async main(ctx) {
    let mountedHandle: {
      destroy: () => void;
      setMetalMode: (mode: MetalButtonMode) => void;
      setShowFreeButtons: (show: boolean) => void;
    } | null = null;
    let locale: Locale = await getLocale();
    let metalMode = await getModuleOption<MetalButtonMode>(QUICK_ADD_FEATURE_ID, METAL_BUTTON_MODE_OPTION_KEY, DEFAULT_METAL_BUTTON_MODE);
    const committedOptions = await getModuleOption<CommittedItemsOptions>(
      COMMITTED_ITEMS_FEATURE_ID,
      COMMITTED_OPTIONS_KEY,
      DEFAULT_COMMITTED_ITEMS_OPTIONS,
    );
    let committedEnabled = await isFeatureEnabled(COMMITTED_ITEMS_FEATURE_ID);
    let showFreeButtons = committedEnabled && (committedOptions.enableQuickAddButtons ?? true);

    const ui = await createShadowRootUi(ctx, {
      name: 'tf2suite-quickadd-panel',
      position: 'inline',
      anchor: '#inventory_box div.trade_box_contents',
      append: 'last',
      css: tokensCss + panelCss,
      onMount: (container) => {
        mountedHandle = mountQuickAddPanel(container, locale, metalMode, showFreeButtons);
        return mountedHandle;
      },
      onRemove: () => {
        mountedHandle?.destroy();
        mountedHandle = null;
      },
    });

    let enabled = await isFeatureEnabled(QUICK_ADD_FEATURE_ID);
    if (enabled) ui.mount();

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[QUICK_ADD_FEATURE_ID] ?? false;
      const nextMetalMode = (settings.moduleOptions[QUICK_ADD_FEATURE_ID]?.[METAL_BUTTON_MODE_OPTION_KEY] as MetalButtonMode | undefined) ?? DEFAULT_METAL_BUTTON_MODE;
      const nextCommittedOptions = (settings.moduleOptions[COMMITTED_ITEMS_FEATURE_ID]?.[COMMITTED_OPTIONS_KEY] as CommittedItemsOptions | undefined) ?? DEFAULT_COMMITTED_ITEMS_OPTIONS;
      const nextCommittedEnabled = settings.features[COMMITTED_ITEMS_FEATURE_ID] ?? false;
      const nextShowFreeButtons = nextCommittedEnabled && (nextCommittedOptions.enableQuickAddButtons ?? true);

      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          metalMode = nextMetalMode;
          showFreeButtons = nextShowFreeButtons;
          ui.mount();
        } else {
          ui.remove();
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        metalMode = nextMetalMode;
        showFreeButtons = nextShowFreeButtons;
        ui.remove();
        ui.mount();
        return;
      }
      if (nextMetalMode !== metalMode) {
        metalMode = nextMetalMode;
        mountedHandle?.setMetalMode(metalMode);
      }
      if (nextShowFreeButtons !== showFreeButtons) {
        showFreeButtons = nextShowFreeButtons;
        mountedHandle?.setShowFreeButtons(showFreeButtons);
      }
    });
    ctx.onInvalidated(stopWatching);
  },
});
