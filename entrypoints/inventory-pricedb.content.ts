import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountPricedbCheckButton } from '../modules/pricedb-check-button/panel';
import { PRICEDB_CHECK_FEATURE_ID } from '../modules/pricedb-check-button/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/pricedb-check-button/panel.css?inline';

/**
 * ISOLATED-половина модуля "Проверить цену на PriceDB.io" (инвентарь) —
 * см. README §"pricedb-check-button". Кнопка встраивается ВНУТРЬ панели
 * информации о ВЫБРАННОМ предмете (#iteminfoN), а не куда-то рядом с ней —
 * поэтому, в отличие от inventory-currency-counter (один статический якорь
 * на всю жизнь вкладки), якорь тут постоянно меняется: и сам DOM-узел
 * панели (React полностью пересобирает #iteminfoN при каждом выборе
 * предмета), и то, ДЛЯ КАКОГО предмета сейчас нужна кнопка.
 */

/**
 * Видимая панель информации о предмете — Steam рисует несколько таких узлов
 * (#iteminfo0, #iteminfo1, ...), по одному на "слот", скрытые через
 * display:none — стабильный (не хэшированный) id, единственная зацепка
 * среди хэшированных CSS-модулей вокруг содержимого панели.
 */
function findActivePanel(): HTMLElement | null {
  const panels = document.querySelectorAll<HTMLElement>('.inventory_page_right [id^="iteminfo"]');
  for (const panel of panels) {
    if (panel.offsetParent !== null) return panel;
  }
  return null;
}

/**
 * БАГ (исправлено дважды): раньше кнопку монтировали последним ребёнком
 * САМОЙ `#iteminfoN` — но визуально рамка карточки предмета рисуется ОДНИМ
 * хэшированным div'ом ВНУТРИ `#iteminfoN` (он лишь позиционирующая
 * обёртка), поэтому кнопка оказывалась СНАРУЖИ оранжевой рамки, под
 * карточкой. Первый фикс (findCardBody ниже) переносил её ВНУТРЬ рамки, но
 * последним элементом ВСЕЙ карточки (после строки Tags) — пользователь
 * прислал второй скриншот и явно попросил "возле View in Community
 * Market", а не просто где угодно внутри рамки.
 *
 * Найдено живой проверкой (реальный публичный инвентарь, DevTools): ссылка
 * "Просмотреть на торговой площадке"/"View in Community Market" — это
 * ОБЫЧНЫЙ `<a href="https://steamcommunity.com/market/listings/440/...">`
 * (не `<button>`, туда действительно переходят, а не просто дёргают SPA-
 * действие) — локаль-независимый и структурно надёжный якорь, в отличие от
 * текста кнопки или хэшированных классов. Подтверждено вживую (проверено
 * inserted-тестом на реальной странице): её РОДИТЕЛЬ — это один "ряд"
 * действия (иконка + ссылка), а РОДИТЕЛЬ РЯДА — тот самый div с
 * `border: 1px solid #CF6A32` (сам strange-оранжевый бордер карточки,
 * подтверждено через getComputedStyle) — и он же группирует ВСЕ ряды
 * действий карточки (Wiki/Inspect, Market, и, судя по всему, Sell —
 * симметрично). Кнопка встраивается ПОСЛЕДНИМ элементом именно в эту
 * группу действий — окажется сразу после Market (и после Sell, если он
 * есть), а не где-то среди описания/тегов.
 */
function findMarketLink(panel: HTMLElement): HTMLAnchorElement | null {
  return panel.querySelector<HTMLAnchorElement>('a[href*="/market/listings/440/"]');
}

/** Фолбэк для предметов БЕЗ ссылки на Market (непродаваемые/непереводимые —
 *  например подарочные предметы без торговой площадки, см. живую проверку
 *  в README) — тот же "первый фикс", последний элемент всей рамки карточки,
 *  раз группы действий с Market-рядом тут просто не существует. */
function findCardBody(panel: HTMLElement): HTMLElement {
  const children = [...panel.children] as HTMLElement[];
  if (children.length === 0) return panel;
  const withButtons = children.find((el) => el.querySelector('button, a'));
  return withButtons ?? children[children.length - 1];
}

function findMountTarget(): HTMLElement | null {
  const panel = findActivePanel();
  if (!panel) return null;
  const marketLink = findMarketLink(panel);
  const actionsGroup = marketLink?.parentElement?.parentElement;
  return actionsGroup ?? findCardBody(panel);
}

/**
 * assetId выбранного сейчас предмета — плитка сетки инвентаря получает
 * класс .activeInfo при выборе, а её собственный id — это ГОТОВЫЙ
 * "<appid>_<contextid>_<assetId>" (в отличие от панели информации, тут
 * реальный id есть, Steam сам его туда кладёт).
 */
function findActiveAssetId(): string | null {
  const tile = document.querySelector<HTMLElement>('.item.activeInfo');
  const parts = (tile?.id ?? '').split('_');
  return parts.length === 3 ? parts[2] : null;
}

export default defineContentScript({
  matches: ['*://steamcommunity.com/id/*/inventory*', '*://steamcommunity.com/profiles/*/inventory*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let enabled = await isFeatureEnabled(PRICEDB_CHECK_FEATURE_ID);
    let locale: Locale = await getLocale();
    let mountedHandle: { destroy: () => void } | null = null;
    let mountedAssetId: string | null = null;
    let mountedLocale: Locale | null = null;

    const ui = await createShadowRootUi(ctx, {
      name: 'tf2suite-pricedb-check-button',
      position: 'inline',
      anchor: findMountTarget,
      append: 'last',
      css: tokensCss + panelCss,
      onMount: (container) => {
        // mountedAssetId уже выставлен в sync() ДО вызова ui.mount() ниже.
        mountedHandle = mountPricedbCheckButton(container, mountedAssetId as string, locale);
        mountedLocale = locale;
        return mountedHandle;
      },
      onRemove: () => {
        mountedHandle?.destroy();
        mountedHandle = null;
      },
    });

    let visible = false;

    /**
     * Перемонтирует кнопку при смене выбранного предмета ИЛИ если хост
     * "осиротел" (React полностью пересобрал innerHTML #iteminfoN — см.
     * README, "панель регенерируется на каждый клик") — в обоих случаях
     * старая кнопка уже недействительна или физически исчезла из DOM.
     * В отличие от inventory-currency.content.ts (один и тот же анкор всю
     * жизнь модуля) тут ПОЛНЫЙ remove()+mount() на каждую смену assetId —
     * это и есть способ подставить новый assetId в onMount выше и заново
     * найти актуальный #iteminfoN.
     */
    function sync() {
      const assetId = enabled ? findActiveAssetId() : null;
      const panel = enabled ? findActivePanel() : null;
      const shouldShow = assetId !== null && panel !== null;

      if (!shouldShow) {
        if (visible) {
          ui.remove();
          visible = false;
          mountedAssetId = null;
        }
        return;
      }

      if (!visible || assetId !== mountedAssetId || locale !== mountedLocale || !document.contains(ui.shadowHost)) {
        if (visible) ui.remove();
        mountedAssetId = assetId;
        ui.mount();
        visible = true;
      }
    }

    sync();
    const initialTimers = [600, 1500, 3000].map((delay) => window.setTimeout(sync, delay));

    let debounceTimer: number | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(sync, 120);
    });
    const observeRoot = document.querySelector('.inventory_page_right') ?? document.body;
    observer.observe(observeRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'id'] });

    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[PRICEDB_CHECK_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        sync();
        return;
      }
      // Смена локали — sync() сам перемонтирует кнопку, увидев расхождение
      // locale !== mountedLocale (тот же приём, что и смена assetId).
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        sync();
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      observer.disconnect();
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      initialTimers.forEach((t) => window.clearTimeout(t));
    });
  },
});
