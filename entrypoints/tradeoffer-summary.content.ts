import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, getModuleOption, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountTradeSummaryPanel } from '../modules/trade-item-summary/panel';
import { DEFAULT_TRADE_SUMMARY_MODE, TRADE_SUMMARY_FEATURE_ID, TRADE_SUMMARY_MODE_OPTION_KEY, TradeSummaryMode } from '../modules/trade-item-summary/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/trade-item-summary/panel.css?inline';

type PanelHandle = { destroy: () => void; setMode: (mode: TradeSummaryMode) => void };

/**
 * Якоря — заголовок КАЖДОЙ стороны оффера (.offerheader внутри #trade_yours /
 * #trade_theirs: аватар + название), сразу ПЕРЕД блоком слотов
 * (.trade_item_box). Подтверждено структурой реальной сохранённой страницы
 * оффера, которую прислал пользователь (см. README §"trade-item-summary"):
 *   #trade_yours > .offerheader, .trade_item_box (#your_slots_currency, #your_slots)
 *   #trade_theirs > .offerheader, .trade_item_box (#their_slots_currency, #their_slots)
 * Оба .offerheader присутствуют в разметке сразу при загрузке страницы (не
 * дорисовываются JS позже) — в отличие от inventory-currency-counter здесь не
 * нужны ни retry-таймеры, ни отслеживание переключения вкладок.
 */
function findYourAnchor(): Element | null {
  return document.querySelector('#trade_yours .offerheader');
}
function findTheirAnchor(): Element | null {
  return document.querySelector('#trade_theirs .offerheader');
}

export default defineContentScript({
  matches: ['*://steamcommunity.com/tradeoffer/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let yourHandle: PanelHandle | null = null;
    let theirHandle: PanelHandle | null = null;
    let mode = await getModuleOption<TradeSummaryMode>(TRADE_SUMMARY_FEATURE_ID, TRADE_SUMMARY_MODE_OPTION_KEY, DEFAULT_TRADE_SUMMARY_MODE);
    let locale: Locale = await getLocale();

    const yourUi = await createShadowRootUi(ctx, {
      name: 'tf2suite-trade-summary-yours',
      position: 'inline',
      anchor: findYourAnchor,
      append: 'after',
      css: tokensCss + panelCss,
      onMount: (container) => {
        yourHandle = mountTradeSummaryPanel(container, 'me', '#your_slots', locale, mode);
        return yourHandle;
      },
      onRemove: () => {
        yourHandle?.destroy();
        yourHandle = null;
      },
    });

    const theirUi = await createShadowRootUi(ctx, {
      name: 'tf2suite-trade-summary-theirs',
      position: 'inline',
      anchor: findTheirAnchor,
      append: 'after',
      css: tokensCss + panelCss,
      onMount: (container) => {
        theirHandle = mountTradeSummaryPanel(container, 'partner', '#their_slots', locale, mode);
        return theirHandle;
      },
      onRemove: () => {
        theirHandle?.destroy();
        theirHandle = null;
      },
    });

    let enabled = await isFeatureEnabled(TRADE_SUMMARY_FEATURE_ID);
    if (enabled) {
      yourUi.mount();
      theirUi.mount();
    }

    // Живой тумблер/опция — как и во всех остальных модулях: щёлкнули фичу
    // или сменили режим на options-странице — применяется сразу, без
    // перезагрузки вкладки Steam. mount()/remove() вызываются ТОЛЬКО на
    // смене состояния (см. баг с бесконечным дублированием, исправленный в
    // entrypoints/inventory-currency.content.ts) — здесь sync-вызовов на
    // каждую DOM-мутацию нет вообще, поэтому такой баг тут не воспроизводится.
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[TRADE_SUMMARY_FEATURE_ID] ?? false;
      const nextMode = (settings.moduleOptions[TRADE_SUMMARY_FEATURE_ID]?.[TRADE_SUMMARY_MODE_OPTION_KEY] as TradeSummaryMode | undefined) ?? DEFAULT_TRADE_SUMMARY_MODE;

      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          mode = nextMode;
          locale = settings.locale;
          yourUi.mount();
          theirUi.mount();
        } else {
          yourUi.remove();
          theirUi.remove();
        }
        return;
      }

      // Смена локали, пока панели остаются смонтированными — polling-цикл
      // (refresh/refreshPricing) держит `locale` в своём замыкании, setMode()
      // его не обновит, поэтому тут — полный remove+mount для обеих сторон
      // (тот же приём, что и у остальных модулей, см. utils/i18n.ts).
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        yourUi.remove();
        theirUi.remove();
        yourUi.mount();
        theirUi.mount();
        return;
      }

      if (nextMode !== mode) {
        mode = nextMode;
        yourHandle?.setMode(mode);
        theirHandle?.setMode(mode);
      }
    });
    ctx.onInvalidated(stopWatching);
  },
});
