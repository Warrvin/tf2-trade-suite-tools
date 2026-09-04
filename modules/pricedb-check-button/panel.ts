import { requestFromMain } from '../../utils/bridge';
import { pricedbItemUrl, pricedbSearchUrl, resolveSku } from '../../utils/pricedb';
import type { Locale } from '../../utils/i18n';
import { PRICEDB_CHECK_CHANNEL, PricedbCheckRequest, PricedbNameSnapshot } from './types';

const UI = {
  ru: {
    checking: 'Проверка цены на PriceDB.io',
    label: 'Цена на PriceDB.io',
    unavailableTitle: 'Предмет ещё не загружен — попробуйте снова через момент',
    exactTitle: 'Открыть страницу этого предмета на PriceDB.io',
    searchTitle: 'Точная страница предмета не нашлась — открыть поиск на PriceDB.io',
  },
  en: {
    checking: 'Checking the price on PriceDB.io',
    label: 'Price on PriceDB.io',
    unavailableTitle: "The item hasn't loaded yet — try again in a moment",
    exactTitle: "Open this item's page on PriceDB.io",
    searchTitle: "Couldn't find the exact item page — open PriceDB.io search",
  },
} as const;

/**
 * Кнопка-ссылка "Проверить цену на PriceDB.io" внутри панели информации о
 * выбранном предмете инвентаря (#iteminfoN, см.
 * entrypoints/inventory-pricedb.content.ts#findActivePanel) — пользователь
 * явно попросил способ перепроверить, что цена (в других модулях — режим
 * 'priced' у trade-item-summary) подобрана к правильному предмету/эффекту,
 * см. README.
 *
 * Монтируется ЗАНОВО при каждой смене выбранного предмета — управление
 * mount()/remove() (и то, ДЛЯ КАКОГО assetId монтировать) целиком лежит на
 * entrypoint'е (createShadowRootUi + sync(), см. inventory-pricedb.content.ts),
 * этот файл отвечает только за то, ЧТО нарисовать для уже известного
 * assetId — не дублирует логику отслеживания DOM.
 */
export function mountPricedbCheckButton(container: HTMLElement, assetId: string, locale: Locale): { destroy: () => void } {
  container.replaceChildren();

  const root = document.createElement('div');
  root.className = 'tf2s-root';
  container.appendChild(root);

  let destroyed = false;
  render('loading');
  void resolve();

  /**
   * Редизайн (по просьбе пользователя, после того как кнопка переехала
   * ВНУТРЬ карточки предмета, см. entrypoints/inventory-pricedb.content.ts):
   * раньше это была громкая заливная кнопка (`tf2s-btn--accent`) — рядом с
   * родными приглушёнными кнопками Steam ("View in Community Market", тонкая
   * серая обводка) она визуально "кричала" и не читалась как часть той же
   * карточки. Теперь — тот же приглушённый "вторичный" стиль, что и у
   * родных кнопок (тонкая рамка, тёмный фон), акцентный цвет — только у
   * иконки и в hover, а не заливкой всей кнопки. Разметка на 2 span'а
   * (иконка/текст) — точечный контроль отступа между ними в CSS, без
   * межсимвольных пробелов внутри строки.
   */
  function render(state: 'loading' | 'unavailable' | { url: string; exact: boolean }) {
    if (destroyed) return;
    if (state === 'loading') {
      root.innerHTML = `
        <div class="tf2s-pricedb-check tf2s-pricedb-check--pending">
          <span class="tf2s-pricedb-check__icon">⋯</span>
          <span class="tf2s-pricedb-check__label">${UI[locale].checking}</span>
        </div>`;
      return;
    }
    if (state === 'unavailable') {
      root.innerHTML = `
        <div class="tf2s-pricedb-check tf2s-pricedb-check--pending" title="${UI[locale].unavailableTitle}">
          <span class="tf2s-pricedb-check__icon">↗</span>
          <span class="tf2s-pricedb-check__label">${UI[locale].label}</span>
        </div>`;
      return;
    }
    const title = state.exact ? UI[locale].exactTitle : UI[locale].searchTitle;
    root.innerHTML = `
      <a class="tf2s-pricedb-check" href="${state.url}" target="_blank" rel="noopener noreferrer" title="${title}">
        <span class="tf2s-pricedb-check__icon">↗</span>
        <span class="tf2s-pricedb-check__label">${UI[locale].label}</span>
      </a>`;
  }

  async function resolveName(retryOnMiss: boolean): Promise<string | null> {
    try {
      const snapshot = await requestFromMain<PricedbCheckRequest, PricedbNameSnapshot>(PRICEDB_CHECK_CHANNEL, {});
      const name = snapshot[assetId];
      if (name) return name;
      // Гонка: панель уже открыта, а MAIN ещё не успел увидеть этот assetId
      // через перехват fetch/XHR (installInventoryWatch) — крайне редко, но
      // на всякий случай один короткий повтор вместо немедленного отказа.
      if (retryOnMiss) {
        await new Promise((r) => setTimeout(r, 400));
        return resolveName(false);
      }
      return null;
    } catch {
      return null;
    }
  }

  async function resolve() {
    const name = await resolveName(true);
    if (destroyed) return;
    if (!name) {
      render('unavailable');
      return;
    }
    // Оптимистично показываем рабочую ссылку сразу (страница поиска),
    // апгрейдим на точную страницу предмета, когда SKU зарезолвится — тот
    // же приём, что и в modules/trade-item-summary/panel.ts.
    render({ url: pricedbSearchUrl(name), exact: false });
    try {
      const sku = await resolveSku(name);
      if (destroyed) return;
      if (sku) render({ url: pricedbItemUrl(sku), exact: true });
    } catch {
      // Уже показана рабочая ссылка на поиск — не критично, оставляем её.
    }
  }

  return {
    destroy: () => {
      destroyed = true;
      root.remove();
    },
  };
}
