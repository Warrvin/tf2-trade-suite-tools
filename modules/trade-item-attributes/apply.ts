import { requestFromMain } from '../../utils/bridge';
import {
  applyItemAttributesToElement,
  getProcessedKey,
  PROCESSED_ATTR,
  undecorateItemAttributesElement,
} from '../../utils/item-attribute-render';
import type { Locale } from '../../utils/i18n';
import type { IconDetailLevel } from './types';
import { ATTRIBUTES_CHANNEL, AttributesRequest, AttributesSnapshot } from './types';

/** Формат id элемента предмета у Стима на СТРАНИЦЕ ОФФЕРА: item<appid>_<contextid>_<assetId>. */
const ITEM_ID_RE = /^item(\d+)_(\d+)_(\d+)$/;

/**
 * Запускает разметку атрибутов предметов на странице /tradeoffer/*:
 * периодически спрашивает MAIN-сторону за снимком атрибутов (см. core.ts) и
 * сканирует DOM в поисках ещё не обработанных элементов .item. Само
 * построение значков/классов на элементе — общий рендерer, см.
 * utils/item-attribute-render.ts (использует его же inventory-item-attributes,
 * требование 4 — не дублировать функционал).
 *
 * `detailLevel` можно поменять "на лету" через returned `setDetailLevel` —
 * уже обработанные элементы будут перерисованы заново без повторного
 * запроса к MAIN (атрибуты не зависят от уровня детализации, только их
 * отображение).
 *
 * Возвращает { stop }, вызывается при выключении фичи в настройках или при
 * инвалидации контент-скрипта.
 */
export function startItemAttributes(
  initialDetailLevel: IconDetailLevel,
  locale: Locale,
): { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } {
  let stopped = false;
  let detailLevel = initialDetailLevel;
  let snapshot: AttributesSnapshot | null = null;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  const refreshTimers: ReturnType<typeof setTimeout>[] = [];

  /** Определяет, чей это предмет — по ближайшему известному контейнеру. */
  function sideFor(el: HTMLElement): 'me' | 'partner' | null {
    if (el.closest('#your_slots')) return 'me';
    if (el.closest('#their_slots')) return 'partner';

    // Панель просмотра инвентаря (когда выбираете предметы для добавления в
    // оффер) переключается между "вашим" и "их" инвентарём — контейнер несёт
    // steamid в своём id (inventory_<steamid>_440_2), см. utils/steamInventory
    // паттерн у tf2TradingUtils.
    const invEl = el.closest<HTMLElement>('[id^="inventory_"]');
    const match = invEl?.id.match(/^inventory_(\d+)_/);
    if (!match || !snapshot) return null;

    const steamId = match[1];
    if (steamId === snapshot.meSteamId) return 'me';
    if (steamId === snapshot.partnerSteamId) return 'partner';
    return null;
  }

  function scan() {
    if (stopped || !snapshot) return;

    // Сканируем ВСЕ .item, а не только ещё не помеченные: панель выбора
    // предметов может переиспользовать DOM-узлы под другие предметы
    const items = document.querySelectorAll<HTMLElement>('div.item[id^="item440_2_"]');
    items.forEach((el) => {
      const match = el.id.match(ITEM_ID_RE);
      if (!match) return;
      const assetId = match[3];
      if (getProcessedKey(el) === assetId) return; // уже размечен под этот же предмет

      if (el.hasAttribute(PROCESSED_ATTR)) undecorateItemAttributesElement(el);

      const side = sideFor(el);
      // Устойчивый поиск: если сторона определена — ищем в ней; если нет или не найдено,
      // ищем по обоим снимкам (assetId уникален для каждого предмета в Steam)
      const attrs =
        (side === 'me' ? snapshot!.me[assetId] : side === 'partner' ? snapshot!.partner[assetId] : null) ??
        snapshot!.me[assetId] ??
        snapshot!.partner[assetId];

      if (attrs) applyItemAttributesToElement(el, attrs, detailLevel, assetId, locale);
    });
  }

  let partnerRetryAttempts = 0;
  let partnerRetryTimer: ReturnType<typeof setTimeout> | undefined;

  async function refresh() {
    if (stopped) return;
    try {
      snapshot = await requestFromMain<AttributesRequest, AttributesSnapshot>(ATTRIBUTES_CHANNEL, {});
    } catch {
      // MAIN-скрипт ещё не готов (страница только открылась) — подождём
    }
    scan();

    // Если инвентарь партнёра ещё пустой, планируем быстрые до-опросы пока Steam его грузит
    if (snapshot && Object.keys(snapshot.partner).length === 0 && partnerRetryAttempts < 8) {
      partnerRetryAttempts++;
      clearTimeout(partnerRetryTimer);
      partnerRetryTimer = setTimeout(() => void refresh(), 1500);
    }
  }

  void refresh();
  // Повторяем запрос снимка в первые секунды для подхвата асинхронно догружаемого инвентаря партнёра
  for (const ms of [300, 800, 1800, 3500, 7000]) {
    refreshTimers.push(setTimeout(() => void refresh(), ms));
  }

  // При клике на вкладки инвентарей или перелистывание страниц — мгновенно обновляем
  const onTabClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.inventory_tab, [id^="inventory_select_"], .trade_partner_header, .pagebtn')) {
      setTimeout(() => void refresh(), 250);
      setTimeout(() => void refresh(), 1000);
    }
  };
  document.addEventListener('click', onTabClick, true);

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 60);
  });

  const invContainer = document.getElementById('inventory_box') || document.getElementById('inventories') || document.body;
  observer.observe(invContainer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['id', 'class', 'style'],
  });

  // Также наблюдаем за слотами трейда, если они вне inventory_box
  const yourSlots = document.getElementById('your_slots');
  const theirSlots = document.getElementById('their_slots');
  if (yourSlots) observer.observe(yourSlots, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'class', 'style'] });
  if (theirSlots) observer.observe(theirSlots, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'class', 'style'] });

  return {
    stop: () => {
      stopped = true;
      observer.disconnect();
      document.removeEventListener('click', onTabClick, true);
      clearTimeout(scanTimer);
      clearTimeout(partnerRetryTimer);
      refreshTimers.forEach(clearTimeout);
    },
    setDetailLevel: (level: IconDetailLevel) => {
      if (level === detailLevel) return;
      detailLevel = level;
      // Перерисовываем уже обработанные предметы новым уровнем детализации.
      document.querySelectorAll<HTMLElement>(`div.item[${PROCESSED_ATTR}]`).forEach(undecorateItemAttributesElement);
      scan();
    },
  };
}
