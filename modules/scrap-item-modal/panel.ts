import { ScrapItemAttributes } from './attributes';
import { pricedbItemUrl, pricedbSearchUrl, resolveSku } from '../../utils/pricedb';
import type { Locale } from '../../utils/i18n';

const UI = {
  ru: { close: 'Закрыть', checkOnPricedb: 'Проверить на PriceDB.io' },
  en: { close: 'Close', checkOnPricedb: 'Check on PriceDB.io' },
} as const;

/**
 * Плавающее окошко ссылок — по прямой просьбе пользователя должно быть и
 * ПЕРЕМЕЩАЕМЫМ, и РЕГУЛИРУЕМЫМ по ширине/высоте одновременно. Перетаскивание
 * за заголовок — тот же приём (Pointer Events на data-drag-handle,
 * запоминание позиции в localStorage), что уже используется в
 * modules/wallet-summary/panel.ts — единственная в проекте панель того же
 * типа "плавающее окно поверх страницы". Изменение размера — родное CSS
 * `resize: both` на самой панели (panel.css) вместо своего перетаскивания
 * уголка мышью: браузер уже умеет это надёжно и кроссбраузерно сам, ничего
 * дополнительного кодировать не пришлось — мы только запоминаем итоговый
 * размер через ResizeObserver, чтобы он тоже пережил обновление страницы
 * (как и позиция).
 */

const POSITION_KEY = 'tf2suite:scrap-modal-pos';
const SIZE_KEY = 'tf2suite:scrap-modal-size';

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null; // приватный режим / localStorage недоступен — просто не запоминаем
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // не критично — окно просто не запомнит позицию/размер до следующего раза
  }
}

// Акцентный цвет заголовка по качеству предмета — переиспользуем ту же
// палитру, что и вся остальная разметка расширения (styles/tokens.css),
// вместо своих цветов.
const QUALITY_COLOR: Record<ScrapItemAttributes['quality'], string> = {
  Normal: 'var(--tf2s-text-dim)',
  Genuine: 'var(--tf2s-q-genuine)',
  Vintage: 'var(--tf2s-q-vintage)',
  Unusual: 'var(--tf2s-q-unusual)',
  Unique: 'var(--tf2s-q-unique)',
  'Self-Made': 'var(--tf2s-q-unique)',
  Strange: 'var(--tf2s-q-strange)',
  Haunted: 'var(--tf2s-q-haunted)',
  "Collector's": 'var(--tf2s-q-collectors)',
  'Decorated Weapon': 'var(--tf2s-q-decorated)',
};

export interface ScrapModalHandle {
  /** Обновляет содержимое и делает окно видимым (создаётся один раз, дальше только переиспользуется — как и в оригинале tf2TradingUtils). `priceableName` — см. links.ts#buildPricedbPriceableName. */
  update: (attrs: ScrapItemAttributes, priceableName: string, displayName: string) => void;
  destroy: () => void;
}

export function mountScrapItemModal(container: HTMLElement, locale: Locale): ScrapModalHandle {
  const host = document.createElement('div');
  host.className = 'tf2s-scrapmodal-host';
  host.hidden = true; // до первого среднего клика/Ctrl+клика окна не видно вовсе
  container.appendChild(host);

  const savedPos = loadJSON<{ left: number; top: number }>(POSITION_KEY);
  if (savedPos) {
    host.style.left = `${savedPos.left}px`;
    host.style.top = `${savedPos.top}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  }

  const root = document.createElement('div');
  root.className = 'tf2s-root';
  host.appendChild(root);

  root.innerHTML = `
    <div class="tf2s-panel tf2s-scrapmodal">
      <div class="tf2s-scrapmodal__header" data-drag-handle>
        <span class="tf2s-scrapmodal__title" data-name>…</span>
        <button type="button" class="tf2s-btn tf2s-btn--icon" data-action="close" title="${UI[locale].close}" aria-label="${UI[locale].close}">×</button>
      </div>
      <div class="tf2s-scrapmodal__body" data-links></div>
    </div>
  `;

  const panelEl = root.querySelector<HTMLElement>('.tf2s-scrapmodal')!;
  const savedSize = loadJSON<{ width: number; height: number }>(SIZE_KEY);
  if (savedSize) {
    panelEl.style.width = `${savedSize.width}px`;
    panelEl.style.height = `${savedSize.height}px`;
  }

  const nameEl = root.querySelector<HTMLElement>('[data-name]')!;
  const linksEl = root.querySelector<HTMLElement>('[data-links]')!;
  const dragHandle = root.querySelector<HTMLElement>('[data-drag-handle]')!;

  root.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    host.hidden = true;
  });

  setupDrag();
  setupResizePersist();

  function setupDrag() {
    dragHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (e.button !== 0) return;

      const hostRect = host.getBoundingClientRect();
      // Переключаемся с left/bottom (исходное CSS-позиционирование, см.
      // panel.css) на left/top — иначе перетаскивание считало бы движение
      // от противоположного угла экрана (то же решение, что и в
      // wallet-summary/panel.ts).
      host.style.left = `${hostRect.left}px`;
      host.style.top = `${hostRect.top}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = hostRect.left;
      const startTop = hostRect.top;

      dragHandle.setPointerCapture(e.pointerId);
      dragHandle.classList.add('tf2s-scrapmodal__header--dragging');

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const maxLeft = Math.max(0, window.innerWidth - host.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - host.offsetHeight);
        host.style.left = `${Math.min(Math.max(0, startLeft + dx), maxLeft)}px`;
        host.style.top = `${Math.min(Math.max(0, startTop + dy), maxTop)}px`;
      };
      const onUp = () => {
        dragHandle.releasePointerCapture(e.pointerId);
        dragHandle.classList.remove('tf2s-scrapmodal__header--dragging');
        dragHandle.removeEventListener('pointermove', onMove);
        dragHandle.removeEventListener('pointerup', onUp);
        saveJSON(POSITION_KEY, {
          left: parseFloat(host.style.left || '0'),
          top: parseFloat(host.style.top || '0'),
        });
      };

      dragHandle.addEventListener('pointermove', onMove);
      dragHandle.addEventListener('pointerup', onUp, { once: true });
    });
  }

  /** Родное resize:both (panel.css) — браузер сам ведёт перетаскивание уголка, здесь только запоминаем итоговый размер. Первое срабатывание ResizeObserver — это стартовый размер при монтировании, не результат ресайза, его не сохраняем. */
  function setupResizePersist() {
    if (typeof ResizeObserver === 'undefined') return;
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      saveJSON(SIZE_KEY, { width: panelEl.offsetWidth, height: panelEl.offsetHeight });
    });
    observer.observe(panelEl);
  }

  let destroyed = false;
  // Пользователь может кликнуть следующий предмет раньше, чем резолвится
  // SKU предыдущего — этот счётчик защищает от того, что уже устаревший
  // ответ перезапишет href под другой предмет (тот же приём, что и
  // ITEM_ATTR-проверка в modules/stn-item-links/core.ts#buildLink, только
  // без DOM-атрибута — ссылка тут одна и пересоздаётся с нуля на каждый клик).
  let requestId = 0;

  return {
    update(attrs, priceableName, displayName) {
      if (destroyed) return;
      host.hidden = false;
      nameEl.textContent = displayName;
      nameEl.style.color = QUALITY_COLOR[attrs.quality] ?? 'var(--tf2s-text)';

      const thisRequestId = ++requestId;

      const link = document.createElement('a');
      link.className = 'tf2s-btn tf2s-btn--accent tf2s-scrapmodal__link';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.href = pricedbSearchUrl(priceableName); // оптимистично, апгрейдим ниже до точного /item/<sku>, если резолвится
      link.textContent = UI[locale].checkOnPricedb;
      linksEl.innerHTML = '';
      linksEl.appendChild(link);

      void resolveSku(priceableName).then((sku) => {
        if (destroyed || thisRequestId !== requestId) return; // окно уже обновили под другой предмет
        if (sku) link.href = pricedbItemUrl(sku);
      });
    },
    destroy() {
      destroyed = true;
      host.remove();
    },
  };
}
