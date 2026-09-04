import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, getModuleOption, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountScrapItemModal, ScrapModalHandle } from '../modules/scrap-item-modal/panel';
import { parseScrapItemAttributes } from '../modules/scrap-item-modal/attributes';
import { buildFullDisplayName, buildPricedbPriceableName } from '../modules/scrap-item-modal/links';
import {
  DEFAULT_SCRAP_MODAL_TRIGGER,
  matchesScrapModalTrigger,
  SCRAP_MODAL_TRIGGER_OPTION_KEY,
  ScrapModalTrigger,
} from '../modules/scrap-item-modal/trigger';
import { SCRAP_ITEM_MODAL_FEATURE_ID } from '../modules/scrap-item-modal/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/scrap-item-modal/panel.css?inline';

/**
 * "Модалка ссылок по настраиваемому клику" — единственный content-скрипт
 * модуля, ISOLATED-мир (как и stn-item-links): вся нужная информация о
 * предмете лежит в обычных data-атрибутах его div'а, чужой JS-реалм
 * страницы трогать незачем.
 *
 * Страницы — ВЕСЬ scrap.tf (`*://scrap.tf/*`), а не только те, для
 * которых пользователь прислал живой HTML. Изначально матчились только
 * /buy/* и /auctions* (страницы с подтверждённым `.item.hoverable`) — не
 * сработало на /unusuals/89 (не входила в исходный список), по просьбе
 * пользователя расширено на весь домен. Это осознанный риск без повторной
 * live-HTML проверки каждой страницы: `.item.hoverable` — общий для сайта
 * компонент карточки предмета (подтверждён идентичным на двух ПО-РАЗНОМУ
 * устроенных страницах — сеточный /buy/* и карточки-аукционы /auctions —
 * так что почти наверняка тот же и на /unusuals, /sell и любых будущих
 * страницах листинга), а сам обработчик активируется только по клику
 * ИМЕННО на `.item.hoverable` — на остальной разметке домена (в т.ч. на
 * несуществующей `/bank`, см. utils/registry.ts) он просто ничего не
 * найдёт и не сработает, никакого риска сломать что-то ещё. Если на
 * какой-то странице разметка карточки всё же отличается — модалка там
 * просто молча не появится (не упадёт), об этом стоит сообщить отдельно.
 *
 * Триггер — НАСТРАИВАЕМАЯ комбинация (modules/scrap-item-modal/trigger.ts),
 * по прямой просьбе пользователя вместо изначально зашитых среднего клика
 * и Ctrl/Cmd+клика ("сделать чтобы пользователь сам мог задать бинд, а не
 * чтобы только Ctrl или СКМ"). По умолчанию — средняя кнопка без
 * модификаторов (см. DEFAULT_SCRAP_MODAL_TRIGGER), настраивается на
 * странице опций (components/FeatureToggle.vue). Живое обновление — та же
 * watchSettings-подписка, что и у enabled/disabled ниже, т.к. это тоже
 * просто значение в TF2SuiteSettings (moduleOptions), просто с ключом, а
 * не с фичей.
 *
 * Три отдельных обработчика вместо одного — по разным причинам, все три
 * решают одну и ту же проблему для РАЗНЫХ значений кнопки:
 *  - `mousedown` (capture) — сама активация. preventDefault() съедает
 *    автопрокрутку/т.п. по не-левой кнопке; matcher — e.button, а не позже
 *    возникающий 'click'/'auxclick'/'contextmenu' (Chrome вообще не
 *    генерирует 'click' на среднюю/правую кнопку — 'mousedown' единственное
 *    событие, которое гарантированно приходит для любой кнопки одинаково).
 *  - `click` (capture) — нужен, ТОЛЬКО когда настроенная кнопка — левая:
 *    гасит нативный `onclick="ScrapTF.Auctions.RedirectToAuction(...)"` на
 *    всей карточке аукциона (/auctions, см. живой HTML), который слушает
 *    именно 'click', а не 'mousedown' — stopPropagation() на mousedown его
 *    бы не остановил. Для средней/правой кнопки этот обработчик не нужен —
 *    Chrome не генерирует для них 'click' вообще, редирект в принципе не
 *    получает событие.
 *  - `contextmenu` (capture) — нужен, ТОЛЬКО когда настроенная кнопка —
 *    правая: без него после срабатывания в mousedown браузер всё равно
 *    откроет свою нативную менюшку поверх нашего окна. Завязан на флаг
 *    `suppressNextContextMenu`, который выставляет сам mousedown-обработчик
 *    (а не на повторную проверку модификаторов) — так гарантированно гасится
 *    именно то нажатие, которое реально активировало модалку, ни больше ни
 *    меньше.
 */
export default defineContentScript({
  matches: ['*://scrap.tf/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let handle: ScrapModalHandle | null = null;
    let locale: Locale = await getLocale();

    const ui = await createShadowRootUi(ctx, {
      name: 'tf2suite-scrap-item-modal',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      css: tokensCss + panelCss,
      onMount: (container) => {
        handle = mountScrapItemModal(container, locale);
        return handle;
      },
      onRemove: () => {
        handle?.destroy();
        handle = null;
      },
    });

    let enabled = await isFeatureEnabled(SCRAP_ITEM_MODAL_FEATURE_ID);
    if (enabled) ui.mount();

    let trigger: ScrapModalTrigger = await getModuleOption<ScrapModalTrigger>(
      SCRAP_ITEM_MODAL_FEATURE_ID,
      SCRAP_MODAL_TRIGGER_OPTION_KEY,
      DEFAULT_SCRAP_MODAL_TRIGGER,
    );

    function activateFromItem(item: HTMLElement) {
      if (!handle) return;
      const attrs = parseScrapItemAttributes(item);
      handle.update(attrs, buildPricedbPriceableName(attrs), buildFullDisplayName(attrs));
    }

    let suppressNextContextMenu = false;

    document.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        const item = (e.target as HTMLElement | null)?.closest<HTMLElement>('.item.hoverable');
        if (!item) return;
        if (!matchesScrapModalTrigger(e, trigger)) return;

        e.preventDefault();
        if (trigger.button === 'right') suppressNextContextMenu = true;
        activateFromItem(item);
      },
      true,
    );

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        if (trigger.button !== 'left') return; // см. doc-блок — актуально только для левой кнопки
        const item = (e.target as HTMLElement | null)?.closest<HTMLElement>('.item.hoverable');
        if (!item) return;
        if (!matchesScrapModalTrigger(e, trigger)) return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    document.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        if (!suppressNextContextMenu) return;
        suppressNextContextMenu = false;
        e.preventDefault();
      },
      true,
    );

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[SCRAP_ITEM_MODAL_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          ui.mount();
        } else {
          ui.remove();
        }
      } else if (enabled && settings.locale !== locale) {
        // Смена локали — тем же путём, что и вкл/выкл (полный remove+mount,
        // см. utils/i18n.ts за общим объяснением этого решения).
        locale = settings.locale;
        ui.remove();
        ui.mount();
      }
      trigger = (settings.moduleOptions[SCRAP_ITEM_MODAL_FEATURE_ID]?.[SCRAP_MODAL_TRIGGER_OPTION_KEY] as
        | ScrapModalTrigger
        | undefined) ?? DEFAULT_SCRAP_MODAL_TRIGGER;
    });
    ctx.onInvalidated(stopWatching);
  },
});
