import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startBptfKsTierButtons } from '../modules/bptf-ks-tier-buttons/core';
import { BPTF_KS_TIER_BUTTONS_FEATURE_ID } from '../modules/bptf-ks-tier-buttons/types';
import '../styles/bptf-ks-tier-buttons.css';

/**
 * Единственный entrypoint модуля — см. modules/bptf-ks-tier-buttons/core.ts.
 *
 * Матчи — ТОЛЬКО classic backpack.tf (`/stats/*`, `/classifieds*`), БЕЗ
 * `next.backpack.tf`, в отличие от bptf-listing-trade-params (который
 * поддерживает оба варианта интерфейса): пользователь явно подтвердил, что
 * пользуется classic-версией, а портируемая реализация (tf2TradingUtils,
 * oldUI/addKSButtons) сама существует только под classic-разметку — под
 * next.backpack.tf там отдельный, гораздо более простой React-модуль
 * (newUI/addKSButton), который не подходит для порта тем же кодом. Причина
 * та же, что у backpacktf-listing-params.content.ts, только в обратную
 * сторону: там оба режима разбираются одним модулем, потому что реально
 * нужны оба, здесь — только один, потому что нужен только один.
 *
 * `defaultEnabled: true` в utils/registry.ts — модуль ничего не отправляет
 * и не необратим (просто ссылки-фильтры), включён по умолчанию.
 */
export default defineContentScript({
  matches: ['*://backpack.tf/stats/*', '*://backpack.tf/classifieds*'],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(BPTF_KS_TIER_BUTTONS_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startBptfKsTierButtons(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[BPTF_KS_TIER_BUTTONS_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startBptfKsTierButtons(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startBptfKsTierButtons(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
