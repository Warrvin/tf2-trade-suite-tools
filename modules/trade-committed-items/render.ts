import type { CommittedOffer } from '../../utils/committed-offers';
import type { CommittedItemsOptions } from './types';

export const COMMITTED_ATTR = 'data-tf2s-committed';
export const COMMITTED_BADGE_CLASS = 'tf2s-committed-badge';
const BORDER_CLASS = 'tf2s-committed--border';
const BG_CLASS = 'tf2s-committed--bg';

/**
 * Преобразует HEX-цвет (#RRGGBB) в rgba(R, G, B, alpha)
 */
export function hexToRgba(hex: string, alpha: number): string {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return `rgba(245, 158, 11, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Синхронизирует глобальные CSS-переменные для цвета рамки и подложки.
 * Вызывается один раз при старте или смене настроек — избавляет от необходимости
 * выставлять inline-стили на сотни DOM-узлов предметов.
 */
export function updateCommittedGlobalStyles(options: CommittedItemsOptions): void {
  const root = document.documentElement;
  if (!root) return;

  if (options.showBorder) {
    root.style.setProperty('--tf2s-committed-border-color', options.borderColor);
  } else {
    root.style.removeProperty('--tf2s-committed-border-color');
  }

  if (options.showBackground) {
    root.style.setProperty(
      '--tf2s-committed-bg-color',
      hexToRgba(options.backgroundColor, options.backgroundAlpha),
    );
  } else {
    root.style.removeProperty('--tf2s-committed-bg-color');
  }
}

/**
 * Применяет выбранные пользователем стили к тайлу предмета.
 * Оптимизировано:
 * 1. Без вызовов window.getComputedStyle (исключены принудительные синхронные пересчёты верстки layout thrashing).
 * 2. Без inline-стилей box-shadow и background-color (используются быстрые CSS-классы и переменные).
 * 3. Идемпотентно: если предмет уже размечен под тот же assetKey и опции не менялись, DOM не затрагивается.
 */
export function applyCommittedStyle(
  el: HTMLElement,
  offers: CommittedOffer[],
  options: CommittedItemsOptions,
  assetKey: string,
): void {
  const currentKey = el.getAttribute(COMMITTED_ATTR);
  if (currentKey !== assetKey) {
    el.setAttribute(COMMITTED_ATTR, assetKey);
    const partners = offers.map((o) => `«${o.partnerName}» (оффер #${o.offerId})`).join(', ');
    el.setAttribute('title', `Предмет уже предложен в оффере для ${partners}`);
  }

  // 1. Значок ⇄ в правом нижнем углу
  if (options.showBadge) {
    if (!el.querySelector(`.${COMMITTED_BADGE_CLASS}`)) {
      const badge = document.createElement('span');
      badge.className = COMMITTED_BADGE_CLASS;
      badge.textContent = '⇄';
      el.appendChild(badge);
    }
  } else {
    el.querySelector(`.${COMMITTED_BADGE_CLASS}`)?.remove();
  }

  // 2. Рамка и фон через легковесные CSS-классы
  if (options.showBorder) {
    if (!el.classList.contains(BORDER_CLASS)) el.classList.add(BORDER_CLASS);
  } else if (el.classList.contains(BORDER_CLASS)) {
    el.classList.remove(BORDER_CLASS);
  }

  if (options.showBackground) {
    if (!el.classList.contains(BG_CLASS)) el.classList.add(BG_CLASS);
  } else if (el.classList.contains(BG_CLASS)) {
    el.classList.remove(BG_CLASS);
  }

  // Очистка старых inline-стилей, если они остались от предыдущих версий
  if (el.style.boxShadow) el.style.removeProperty('box-shadow');
  if (el.style.backgroundColor) el.style.removeProperty('background-color');
}

/**
 * Полностью снимает разметку занятости с элемента.
 */
export function removeCommittedStyle(el: HTMLElement): void {
  if (!el.hasAttribute(COMMITTED_ATTR)) return;
  el.removeAttribute(COMMITTED_ATTR);
  el.removeAttribute('title');
  el.classList.remove(BORDER_CLASS, BG_CLASS);
  el.querySelector(`.${COMMITTED_BADGE_CLASS}`)?.remove();
  if (el.style.boxShadow) el.style.removeProperty('box-shadow');
  if (el.style.backgroundColor) el.style.removeProperty('background-color');
}
