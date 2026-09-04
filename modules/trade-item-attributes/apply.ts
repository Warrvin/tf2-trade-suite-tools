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
    // предметов может переиспользовать DOM-узлы под другие предметы (см.
    // комментарий у PROCESSED_ATTR) — сверяем assetId, а не просто наличие
    // пометки.
    const items = document.querySelectorAll<HTMLElement>('div.item[id^="item440_2_"]');
    items.forEach((el) => {
      const match = el.id.match(ITEM_ID_RE);
      if (!match) return;
      const assetId = match[3];
      if (getProcessedKey(el) === assetId) return; // уже размечен под этот же предмет
      // Узел уже помечен, но под ДРУГИМ assetId — переиспользован под другой
      // предмет (пагинация/скролл); снимаем старую (чужую) разметку сразу,
      // чтобы не показывать иконки не того предмета, даже если атрибуты
      // нового ещё не готовы.
      if (el.hasAttribute(PROCESSED_ATTR)) undecorateItemAttributesElement(el);

      const side = sideFor(el);
      if (!side) return; // сторона пока не определяется — попробуем на следующем скане

      const attrs = (side === 'me' ? snapshot!.me : snapshot!.partner)[assetId];
      if (attrs) applyItemAttributesToElement(el, attrs, detailLevel, assetId, locale);
      // если атрибутов нет — оставляем неразмеченным: возможно, это более
      // свежий снимок инвентаря ещё не подъехал (см. refresh ниже), подхватим
      // на следующем скане
    });
  }

  async function refresh() {
    if (stopped) return;
    try {
      snapshot = await requestFromMain<AttributesRequest, AttributesSnapshot>(ATTRIBUTES_CHANNEL, {});
    } catch {
      // MAIN-скрипт ещё не готов (страница только открылась) — подождём
      // следующей плановой попытки ниже.
    }
    scan();
  }

  void refresh();
  // Инвентарь партнёра (особенно большой) иногда догружается не сразу —
  // повторяем запрос снимка ещё несколько раз в первые секунды.
  for (const ms of [1000, 2500, 5000, 10000]) {
    refreshTimers.push(setTimeout(() => void refresh(), ms));
  }

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 150);
  });
  // attributes: true + attributeFilter: ['id'] — важно для переиспользуемых
  // узлов (см. PROCESSED_ATTR): Steam иногда меняет ТОЛЬКО id/фон
  // существующего .item под новый предмет, без добавления/удаления узлов, и
  // childList-мутация в этом случае не происходит вовсе.
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });

  return {
    stop: () => {
      stopped = true;
      observer.disconnect();
      clearTimeout(scanTimer);
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
