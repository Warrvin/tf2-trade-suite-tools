import { requestFromMain } from '../../utils/bridge';
import {
  applyItemAttributesToElement,
  getProcessedKey,
  PROCESSED_ATTR,
  undecorateItemAttributesElement,
} from '../../utils/item-attribute-render';
import type { IconDetailLevel } from '../../utils/icon-detail-level';
import type { Locale } from '../../utils/i18n';
import {
  INVENTORY_ATTRIBUTES_CHANNEL,
  InventoryAttributesRequest,
  InventoryAttributesSnapshot,
} from './types';

/**
 * Формат id элемента предмета на СТРАНИЦЕ ИНВЕНТАРЯ:
 * <appid>_<contextid>_<assetId> — БЕЗ префикса "item", в отличие от окна
 * оффера (там item440_2_<assetId>). Подтверждено tf2TradingUtils
 * (unusualEffectBackground/content.js, ".itemHolder .item[id^=\"440_2_\"]").
 */
const ITEM_ID_RE = /^(\d+)_(\d+)_(\d+)$/;

/**
 * Запускает разметку атрибутов предметов на странице инвентаря: спрашивает
 * MAIN-сторону (см. core.ts) за текущим снимком и сканирует DOM в поисках
 * ещё не обработанных элементов .item. В отличие от окна оффера снимок тут
 * растёт постепенно по мере скролла страницы (Steam подгружает инвентарь
 * постранично), поэтому опрашивается почаще и подольше, а не только в
 * первые секунды после открытия. Построение значков/классов на элементе —
 * общий рендерer, см. utils/item-attribute-render.ts (использует его же
 * trade-item-attributes, требование 4 — не дублировать функционал).
 */
export function startInventoryItemAttributes(
  initialDetailLevel: IconDetailLevel,
  locale: Locale,
): { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } {
  let stopped = false;
  let detailLevel = initialDetailLevel;
  let snapshot: InventoryAttributesSnapshot | null = null;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function scan() {
    if (stopped || !snapshot) return;

    // Сканируем ВСЕ .item, а не только ещё не помеченные: страница инвентаря
    // при постраничной навигации ("<" / "N из M" / ">") переиспользует один и
    // тот же пул DOM-узлов под другие предметы (виртуализация) — просто
    // меняет id/фон существующего узла, без добавления/удаления. Если
    // пропускать уже помеченные узлы, переиспользованный узел со старой
    // пометкой навсегда останется без новых иконок. Сверяем assetId, а не
    // просто наличие пометки (см. PROCESSED_ATTR).
    const items = document.querySelectorAll<HTMLElement>('.itemHolder .item[id]');
    items.forEach((el) => {
      const match = el.id.match(ITEM_ID_RE);
      if (!match) return;
      const [, appid, contextid, assetId] = match;
      if (appid !== '440' || contextid !== '2') return; // на всякий случай — вдруг на странице ещё что-то с .item
      if (getProcessedKey(el) === assetId) return; // уже размечен под этот же предмет

      // Узел уже помечен, но под ДРУГИМ assetId — переиспользован под другой
      // предмет; снимаем старую (чужую) разметку сразу, чтобы не показывать
      // иконки не того предмета, даже если атрибуты нового ещё не готовы.
      if (el.hasAttribute(PROCESSED_ATTR)) undecorateItemAttributesElement(el);

      const attrs = snapshot![assetId];
      if (attrs) applyItemAttributesToElement(el, attrs, detailLevel, assetId, locale);
      // если атрибутов нет — оставляем неразмеченным: страница ещё не
      // подгрузила описание этого предмета своим собственным запросом,
      // подхватим на следующем опросе ниже.
    });
  }

  async function refresh() {
    if (stopped) return;
    try {
      snapshot = await requestFromMain<InventoryAttributesRequest, InventoryAttributesSnapshot>(INVENTORY_ATTRIBUTES_CHANNEL, {});
    } catch {
      // MAIN-скрипт ещё не готов (страница только открылась) — подождём
      // следующего планового опроса ниже.
    }
    scan();
  }

  void refresh();
  // В отличие от окна оффера (весь инвентарь отдан сразу, снимок нужно
  // обновить пару раз на всякий случай), тут снимок РАСТЁТ по мере скролла
  // всё время, пока открыта вкладка — опрашиваем на протяжении всей жизни
  // модуля, не только в первые секунды.
  pollTimer = setInterval(() => void refresh(), 1500);

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 150);
  });
  // attributes: true + attributeFilter: ['id'] — важно для переиспользуемых
  // узлов при пагинации (см. комментарий в scan() выше и у PROCESSED_ATTR):
  // смена страницы иногда меняет ТОЛЬКО id/фон уже существующего узла, без
  // childList-мутации, которую childList:true сам по себе не поймает.
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });

  return {
    stop: () => {
      stopped = true;
      observer.disconnect();
      clearTimeout(scanTimer);
      clearInterval(pollTimer);
    },
    setDetailLevel: (level: IconDetailLevel) => {
      if (level === detailLevel) return;
      detailLevel = level;
      // Перерисовываем уже обработанные предметы новым уровнем детализации.
      document.querySelectorAll<HTMLElement>(`.itemHolder .item[${PROCESSED_ATTR}]`).forEach(undecorateItemAttributesElement);
      scan();
    },
  };
}
