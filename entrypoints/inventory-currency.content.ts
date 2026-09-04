import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { mountInventoryCurrencyPanel } from '../modules/inventory-currency-counter/panel';
import { INVENTORY_CURRENCY_FEATURE_ID } from '../modules/inventory-currency-counter/types';
import tokensCss from '../styles/tokens.css?inline';
import panelCss from '../modules/inventory-currency-counter/panel.css?inline';

/**
 * ISOLATED-половина модуля "Живой счётчик валюты в инвентаре" — требование
 * пользователя явно: НЕ плавающее окно поверх вкладки (как
 * modules/wallet-summary), а блок, встроенный в саму разметку страницы
 * Steam. Поэтому вместо WXT-шного autoMount (который просто вставляет UI
 * при каждой загрузке страницы и всё) здесь ручное управление
 * mount()/remove() по месту и по условию: панель должна появляться СРАЗУ
 * ПОД панелью фильтров инвентаря, и только пока активна именно вкладка TF2.
 */

/**
 * Якорь — панель фильтров инвентаря (.filter_ctn.inventory_filters),
 * общая для ВСЕХ вкладок игр и присутствующая на странице сразу после
 * загрузки, даже до первого открытия вкладки TF2 (подтверждено живой
 * проверкой на steamcommunity.com/id/<vanity>/inventory/). Фолбэк — родитель
 * контейнера сетки TF2, на случай если Valve уберёт общую панель фильтров.
 */
function findAnchor(): Element | null {
  return (
    document.querySelector('.filter_ctn.inventory_filters') ??
    document.querySelector<HTMLElement>('[id^="inventory_"][id$="_440_2"]')?.parentElement ??
    null
  );
}

/**
 * true, когда сейчас показана именно вкладка TF2 (appid 440) — у остальных
 * игр аккаунта нет TF2-валюты, панели там не место. location.hash
 * переключается на "#<appid>" по клику на вкладку, НО на самой первой
 * загрузке страницы хэш может быть ПУСТЫМ, даже если какая-то вкладка
 * (часто именно TF2, если это основная игра аккаунта) уже показана по
 * умолчанию — тогда смотрим на реальную видимость самого контейнера сетки
 * TF2 (Steam переключает вкладки через display:none/block, никогда не
 * удаляя контейнер целиком — тоже подтверждено живой проверкой).
 */
function isTf2TabActive(): boolean {
  if (location.hash) return location.hash === '#440';
  const container = document.querySelector<HTMLElement>('[id^="inventory_"][id$="_440_2"]');
  if (!container) return false;
  if (container.style.display === 'none') return false;
  return getComputedStyle(container).display !== 'none';
}

export default defineContentScript({
  matches: ['*://steamcommunity.com/id/*/inventory*', '*://steamcommunity.com/profiles/*/inventory*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let mountedHandle: { destroy: () => void } | null = null;
    let enabled = await isFeatureEnabled(INVENTORY_CURRENCY_FEATURE_ID);
    let locale: Locale = await getLocale();
    let mountedLocale: Locale | null = null;

    const ui = await createShadowRootUi(ctx, {
      name: 'tf2suite-inventory-currency-panel',
      position: 'inline',
      anchor: findAnchor,
      append: 'after',
      css: tokensCss + panelCss,
      onMount: (container) => {
        mountedHandle = mountInventoryCurrencyPanel(container, locale);
        mountedLocale = locale;
        return mountedHandle;
      },
      onRemove: () => {
        mountedHandle?.destroy();
        mountedHandle = null;
      },
    });

    // БАГ (исправлено): WXT-шный ui.mount() — это НЕ "показать, если ещё не
    // показано". Он БЕЗУСЛОВНО заново вызывает options.onMount(...) при
    // каждом вызове (см. node_modules/wxt/dist/client/content-scripts/ui/index.mjs
    // — mount() всегда переустанавливает shadowHost в DOM и вызывает
    // onMount), а mountInventoryCurrencyPanel(container) при каждом своём
    // вызове ДОБАВЛЯЕТ новый .tf2s-root внутрь того же контейнера, не убирая
    // предыдущий. Раньше sync() дергал ui.mount() на КАЖДОЕ срабатывание
    // (hashchange/MutationObserver/поллинг-таймеры) даже когда панель уже
    // была видна "чтобы подхватить смену якоря" — в реальности это просто
    // штамповало новую копию панели при каждом срабатывании, отсюда
    // бесконечно растущий список одинаковых строк, который заметил
    // пользователь. Правильно: mount()/remove() вызываются ТОЛЬКО на
    // изменении состояния видимости (или если хост реально выпал из DOM —
    // Steam иногда пересобирает разметку вокруг вкладок).
    let visible = false;
    function sync() {
      const shouldShow = enabled && isTf2TabActive() && findAnchor() !== null;
      if (shouldShow) {
        if (!visible) {
          ui.mount();
          visible = true;
        } else if (!document.contains(ui.shadowHost) || locale !== mountedLocale) {
          // Хост существовал, но Steam выкинул его из DOM вместе с якорем (или
          // сменилась локаль) — remove() перед повторным mount(), а не голый
          // mount() поверх уже "смонтированного" (но осиротевшего) состояния.
          ui.remove();
          ui.mount();
        }
      } else if (visible) {
        ui.remove();
        visible = false;
      }
    }

    sync();
    // Страница ещё дорисовывает вкладки/контейнеры после первого рендера —
    // несколько отложенных проверок ловят это без постоянного поллинга (тот
    // же таймлайн, что и в референсном tf2TradingUtils/inventoryCurrencyCounter).
    const initialTimers = [600, 1500, 3000].map((delay) => window.setTimeout(sync, delay));

    const onHashChange = () => sync();
    window.addEventListener('hashchange', onHashChange);

    // Клик по вкладке игры не всегда синхронно бьёт hashchange с тем,
    // когда Steam переключает display у контейнеров — debounced
    // MutationObserver на #tabcontent_inventory ловит сам факт переключения
    // вкладок/досоздания контейнеров независимо от hashchange.
    const tabContent = document.getElementById('tabcontent_inventory') ?? document.body;
    let debounceTimer: number | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(sync, 150);
    });
    observer.observe(tabContent, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

    // Живой тумблер — включение/выключение фичи в настройках применяется
    // сразу, без перезагрузки вкладки Steam.
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[INVENTORY_CURRENCY_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        sync();
        return;
      }
      // Смена локали — sync() сам перемонтирует панель, увидев расхождение
      // locale !== mountedLocale (тот же приём, что и потеря якоря).
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        sync();
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      window.removeEventListener('hashchange', onHashChange);
      observer.disconnect();
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      initialTimers.forEach((t) => window.clearTimeout(t));
    });
  },
});
