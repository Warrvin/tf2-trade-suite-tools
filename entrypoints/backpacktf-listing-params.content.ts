import { defineContentScript } from 'wxt/sandbox';
import { isFeatureEnabled, watchSettings } from '../utils/settings';
import { startBptfListingTradeParams } from '../modules/bptf-listing-trade-params/core';
import { BPTF_LISTING_PARAMS_FEATURE_ID } from '../modules/bptf-listing-trade-params/types';

/**
 * Единственный entrypoint модуля — см. README §"Модуль
 * `bptf-listing-trade-params`" и core.ts за тем, почему тут нет пары
 * MAIN/ISOLATED, как у остальных модулей: страница backpack.tf не прячет
 * ничего в JS-объектах, видимых только тому же реалму, поэтому обычного
 * (ISOLATED) content-script'а достаточно.
 *
 * `classifieds`/`stats` — единственные страницы backpack.tf, где встречаются
 * объявления (`.listing`) с кнопкой "предложить сделку"; профиль
 * (`backpack.tf/profiles`, `/id`) сюда не входит — там витрина инвентаря
 * без объявлений на продажу/покупку.
 */
export default defineContentScript({
  matches: [
    '*://backpack.tf/classifieds*',
    '*://backpack.tf/stats/*',
    '*://next.backpack.tf/classifieds*',
    '*://next.backpack.tf/stats*',
  ],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(BPTF_LISTING_PARAMS_FEATURE_ID);
    if (enabled) handle = startBptfListingTradeParams();

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[BPTF_LISTING_PARAMS_FEATURE_ID] ?? false;
      if (shouldBeEnabled === enabled) return;
      enabled = shouldBeEnabled;
      if (enabled) {
        handle = startBptfListingTradeParams();
      } else {
        handle?.stop();
        handle = null;
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
