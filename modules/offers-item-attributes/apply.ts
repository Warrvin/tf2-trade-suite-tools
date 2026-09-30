import {
  applyItemAttributesToElement,
  getProcessedKey,
  PROCESSED_ATTR,
  undecorateItemAttributesElement,
} from '../../utils/item-attribute-render';
import type { IconDetailLevel } from '../../utils/icon-detail-level';
import type { Locale } from '../../utils/i18n';
import { getOffersItemAttributes, parseEconomyItem } from './core';

/**
 * Запускает разметку атрибутов предметов на странице офферов (/tradeoffers) и истории (/tradehistory).
 * Сканирует элементы с [data-economy-item], запрашивает атрибуты с защитой от rate limit
 * и применяет визуальные стили (Unusual-эффекты, Strange-рамки, uncraft, значки spell/killstreak/parts).
 */
export function startOffersItemAttributes(
  initialDetailLevel: IconDetailLevel,
  locale: Locale,
): { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } {
  let stopped = false;
  let detailLevel = initialDetailLevel;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;

  function scan() {
    if (stopped) return;

    const items = document.querySelectorAll<HTMLElement>('.trade_item[data-economy-item], .history_item[data-economy-item], [data-economy-item]');

    items.forEach((el) => {
      const rawEconomy = el.getAttribute('data-economy-item');
      const parsed = parseEconomyItem(rawEconomy);
      if (!parsed || parsed.appId !== '440') return;

      const itemKey = `${parsed.classId}:${parsed.instanceId}`;
      const currentProcessed = getProcessedKey(el);

      // Если элемент уже размечен под этот же itemKey — пропускаем
      if (currentProcessed === itemKey || currentProcessed === `loading:${itemKey}`) {
        return;
      }

      // Если элемент был размечен под другой ключ — очищаем
      if (el.hasAttribute(PROCESSED_ATTR)) {
        undecorateItemAttributesElement(el);
      }

      // Помечаем как загружающийся, чтобы параллельные сканы не запускали повторную обработку того же узла
      el.setAttribute(PROCESSED_ATTR, `loading:${itemKey}`);

      // Гарантируем относительное позиционирование для абсолютных значков и рамок
      if (window.getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }

      void getOffersItemAttributes(parsed.appId, parsed.classId, parsed.instanceId).then((attrs) => {
        if (stopped || !el.isConnected) return;

        // Проверяем, что элемент не был переиспользован под другой предмет во время запроса
        if (el.getAttribute('data-economy-item') !== rawEconomy) {
          undecorateItemAttributesElement(el);
          return;
        }

        if (attrs) {
          applyItemAttributesToElement(el, attrs, detailLevel, itemKey, locale);
        } else {
          // Если атрибуты не вернулись (ошибка сети/таймаут), снимаем loading-пометку,
          // чтобы следующий скан мог повторить попытку
          el.removeAttribute(PROCESSED_ATTR);
        }
      });
    });
  }

  // Первый проход сразу
  scan();

  // Наблюдение за изменениями DOM (подгрузка офферов, переключение вкладок, удаление дубликатов offer-item-summary)
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 200);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    stop() {
      stopped = true;
      observer.disconnect();
      clearTimeout(scanTimer);
      // Очищаем все навешанные классы и разметку
      document.querySelectorAll<HTMLElement>(`[${PROCESSED_ATTR}]`).forEach((el) => {
        undecorateItemAttributesElement(el);
      });
    },
    setDetailLevel(newLevel: IconDetailLevel) {
      if (newLevel === detailLevel) return;
      detailLevel = newLevel;
      // Снимаем разметку со всех элементов и пересканируем (атрибуты уже в кэше)
      document.querySelectorAll<HTMLElement>(`[${PROCESSED_ATTR}]`).forEach((el) => {
        undecorateItemAttributesElement(el);
      });
      scan();
    },
  };
}
