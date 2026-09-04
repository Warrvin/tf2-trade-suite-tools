import { requestFromMain } from '../../utils/bridge';
import {
  applyItemAttributesToElement,
  getProcessedKey,
  PROCESSED_ATTR,
  undecorateItemAttributesElement,
} from '../../utils/item-attribute-render';
import type { IconDetailLevel } from '../../utils/icon-detail-level';
import type { Locale } from '../../utils/i18n';
import { getMarketBetaBuyButtons, getMarketClassicRows, getMarketRowAssetId } from '../../utils/market-dom';
import { MARKET_ATTRIBUTES_CHANNEL, MarketAttributesRequest, MarketAttributesResult, MarketAttributesSnapshot } from './types';

/**
 * Иконка предмета на странице листингов рисуется через <img
 * class="market_listing_item_img">, а НЕ через CSS background-image на
 * контейнере, как .item на офере/инвентаре — поэтому unusual-эффект (мы
 * ставим его фоном на контейнер через общий рендерer) без доп. настройки
 * был бы полностью перекрыт непрозрачной картинкой сверху. Тут только
 * готовим контейнер (position: relative — иначе наши абсолютно
 * спозиционированные значки/lowcraft уедут не туда), сам transparent-фон у
 * <img> при unusual — это CSS-правило в styles/item-attributes.css
 * (".tf2s-attr-unusual img.market_listing_item_img"), т.к. это статическое
 * условие, а не то, что нужно выставлять из JS каждый раз.
 */
function prepareContainer(container: HTMLElement) {
  if (container.style.position !== 'relative') container.style.position = 'relative';
}

/**
 * БЕТА (экспериментально, см. README §"Известное ограничение"): находит
 * "рамку" вокруг иконки предмета для Buy-кнопки — контейнер, которому
 * applyItemAttributesToElement можно смело отдать под unusual-фон.
 *
 * БАГ (исправлено): сама иконка предмета в разметке беты — div с
 * background-image через CSS custom property `--bg-image` (не <img>, как на
 * классике, и не .item с background, как в офере/инвентаре). Изначально
 * unusual-фон ставился ПРЯМО на этот div — но тогда applyItemAttributesToElement
 * инлайновым el.style.backgroundImage перезаписывает background-image
 * целиком, стирая саму иконку предмета: оставался виден только эффект-вихрь,
 * а сама шапка/предмет пропадала (заметил пользователь на реальной
 * странице). На офере/инвентаре так и задумано (см. utils/item-attribute-
 * render.ts — там это 1:1 повторяет Steam Trade Offer Enhancer, "только
 * вихрь, без предмета"), но на Market (и классика, и бета) нужно ДРУГОЕ
 * поведение — предмет виден, вихрь позади него (см. как это уже решено для
 * классики через CSS-прозрачность у <img> ниже). Фикс: возвращаем не сам
 * div с иконкой, а его РОДИТЕЛЯ (у него своего background нет вообще) —
 * unusual-фон ложится на родителя, а div с иконкой остаётся на месте поверх
 * него в обычном потоке документа и рисует предмет как обычно; PNG иконки
 * предметов прозрачны вне силуэта предмета, поэтому вихрь на родителе
 * виден вокруг/через прозрачные края — ровно то же визуальное сочетание
 * "предмет + вихрь позади", что и на классической странице Market.
 *
 * Название класса самого div хэшировано и НЕ используется — вместо этого
 * ищем по инлайн-стилю (`--bg-image` пишет сам React при рендере, это не
 * то, что мы придумали) вверх по дереву от Buy-кнопки на ограниченную
 * глубину.
 */
function findBetaIconFrame(buyButton: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = buyButton.parentElement;
  for (let depth = 0; cur && depth < 8; depth++) {
    const iconDiv = cur.querySelector<HTMLElement>('[style*="--bg-image"]');
    if (iconDiv) return iconDiv.parentElement ?? iconDiv;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Запускает разметку атрибутов предметов на странице листингов Steam Market
 * (steamcommunity.com/market/listings/440/*): периодически спрашивает MAIN-
 * сторону за снимком атрибутов (см. core.ts) и сканирует страницу ОБОИМИ
 * способами — классическим (scan, по assetId из Buy-ссылки) и бета
 * (scanBeta, позиционно по Buy-кнопкам, см. её комментарий и README). На
 * каждой конкретной странице реально сработает только один из двух: на
 * классике `scanBeta` не находит ни одной `button[data-accent-color]`, на
 * бете `scan` не находит ни одной `.market_listing_row` — второй скан
 * всегда дешёвый no-op, поэтому не пытаемся заранее угадать, какая это
 * версия страницы, а просто гоняем оба.
 *
 * Построение значков/классов — общий рендерer, см.
 * utils/item-attribute-render.ts (тот же, что у trade- и
 * inventory-item-attributes, требование 4 — не дублировать функционал).
 *
 * Классические строки результатов переключаются постранично (кнопки
 * "Prev"/"Next" — 10 листингов на страницу): не полагаемся на то, что Steam
 * всегда полностью пересоздаёт DOM-узлы строк при смене страницы (могло бы
 * оказаться так же, как с плитками инвентаря — переиспользование, см. фикс
 * там), поэтому используем ту же защиту: сверяем PROCESSED_ATTR с реальным
 * assetId строки, а не просто наличие пометки.
 */
export function startMarketItemAttributes(
  initialDetailLevel: IconDetailLevel,
  locale: Locale,
): { stop: () => void; setDetailLevel: (level: IconDetailLevel) => void } {
  let stopped = false;
  let detailLevel = initialDetailLevel;
  let snapshot: MarketAttributesSnapshot | null = null;
  let betaOrder: string[] | undefined;
  // Сколько первых элементов betaOrder уже успешно размечены (или для них
  // явно нет соответствующей Buy-кнопки/иконки) — двигается только вперёд,
  // строго по порядку: если атрибуты для очередного assetId ещё не
  // подъехали, останавливаемся именно на нём и ждём следующего опроса,
  // никогда не перескакиваем через "дырку" (иначе вся последующая
  // нумерация карточка<->assetId разъедется).
  let betaMatchedCount = 0;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function scan() {
    if (stopped || !snapshot) return;

    const rows = getMarketClassicRows();
    rows.forEach((row) => {
      const assetId = getMarketRowAssetId(row);
      if (!assetId) return;

      const container = row.querySelector<HTMLElement>('div.market_listing_item_img_container');
      if (!container) return;

      if (getProcessedKey(container) === assetId) return; // уже размечен под этот же листинг
      if (container.hasAttribute(PROCESSED_ATTR)) undecorateItemAttributesElement(container); // строка переиспользована под другой листинг

      const attrs = snapshot![assetId];
      if (!attrs) return; // g_rgAssets ещё не подъехал для этого листинга — подхватим на следующем опросе

      prepareContainer(container);
      applyItemAttributesToElement(container, attrs, detailLevel, assetId, locale);
    });
  }

  function scanBeta() {
    if (stopped || !snapshot || !betaOrder || betaOrder.length === 0) return;

    const buyButtons = getMarketBetaBuyButtons();
    const upTo = Math.min(buyButtons.length, betaOrder.length);

    while (betaMatchedCount < upTo) {
      const assetId = betaOrder[betaMatchedCount];
      const attrs = snapshot![assetId];
      if (!attrs) break; // ещё не пришли атрибуты для этого (и по порядку — любого следующего) листинга

      const frame = findBetaIconFrame(buyButtons[betaMatchedCount]);
      if (!frame) break; // DOM карточки ещё не готов — попробуем на следующем опросе, не пропуская индекс

      if (getProcessedKey(frame) !== assetId) {
        prepareContainer(frame);
        applyItemAttributesToElement(frame, attrs, detailLevel, assetId, locale);
      }
      betaMatchedCount++;
    }
  }

  async function refresh() {
    if (stopped) return;
    try {
      const result = await requestFromMain<MarketAttributesRequest, MarketAttributesResult>(MARKET_ATTRIBUTES_CHANNEL, {});
      snapshot = result.snapshot;
      betaOrder = result.betaOrder;
    } catch {
      // MAIN-скрипт ещё не готов (страница только открылась) — подождём
      // следующего планового опроса ниже.
    }
    scan();
    scanBeta();
  }

  void refresh();
  // Смена страницы результатов (Prev/Next на классике, бесконечная
  // подгрузка при скролле на бете) подгружает новые листинги через AJAX без
  // перезагрузки — опрашиваем на протяжении всей жизни модуля, а не только
  // в первые секунды (как офер, где данные приходят один раз).
  pollTimer = setInterval(() => void refresh(), 1500);

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scan();
      scanBeta();
    }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });

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
      // Не сузили селектор до классического #searchResultsRows — тот же
      // PROCESSED_ATTR вешается и на бета-иконки (findBetaIconDiv), которые
      // живут в совсем другой части DOM.
      document.querySelectorAll<HTMLElement>(`[${PROCESSED_ATTR}]`).forEach(undecorateItemAttributesElement);
      betaMatchedCount = 0;
      scan();
      scanBeta();
    },
  };
}
