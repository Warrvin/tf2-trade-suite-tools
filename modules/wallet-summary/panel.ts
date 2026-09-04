import { requestFromMain } from '../../utils/bridge';
import { CurrencyCounts } from '../../utils/currency';
import type { Locale } from '../../utils/i18n';
import { WALLET_CHANNEL, WalletRequest, WalletResponse } from './types';

const UI = {
  ru: {
    title: 'Сводка валюты',
    refresh: 'Обновить',
    expand: 'Развернуть',
    collapse: 'Свернуть',
    me: 'Вы',
    partner: 'Партнёр',
    loading: 'Загрузка…',
    itemCount: (n: number) => `${n} предм.`,
    private: 'Инвентарь скрыт настройками приватности',
    network: 'Сетевая ошибка при загрузке инвентаря',
    unknown: 'Не удалось получить данные (обновите страницу)',
  },
  en: {
    title: 'Currency summary',
    refresh: 'Refresh',
    expand: 'Expand',
    collapse: 'Collapse',
    me: 'You',
    partner: 'Partner',
    loading: 'Loading…',
    itemCount: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
    private: 'Inventory is hidden by privacy settings',
    network: 'Network error while loading the inventory',
    unknown: "Couldn't load the data (refresh the page)",
  },
} as const;

interface PanelState {
  me: WalletResponse | null;
  partner: WalletResponse | null;
  loading: boolean;
  collapsed: boolean;
}

const DRAG_POSITION_KEY = 'tf2suite:wallet-panel-pos';

/** Сохранённая позиция окна (left/top в px) — переживает обновление страницы. */
function loadSavedPosition(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem(DRAG_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') return parsed;
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — просто не запоминаем позицию.
  }
  return null;
}

function savePosition(left: number, top: number) {
  try {
    localStorage.setItem(DRAG_POSITION_KEY, JSON.stringify({ left, top }));
  } catch {
    // не критично — окно просто не запомнит позицию до следующего перетаскивания.
  }
}

/**
 * Монтирует панель "Сводка валюты" внутрь shadow-root контейнера, который
 * ей дал createShadowRootUi (см. entrypoints/tradeoffer-wallet.content.ts).
 * Вся разметка — на токенах из styles/tokens.css, поэтому визуально
 * идентична любому другому модулю расширения.
 */
export function mountWalletPanel(container: HTMLElement, locale: Locale): { destroy: () => void } {
  const host = document.createElement('div');
  host.className = 'tf2s-wallet-host';
  container.appendChild(host);

  // Если окно уже когда-то перетаскивали — открываем на том же месте.
  const saved = loadSavedPosition();
  if (saved) {
    host.style.left = `${saved.left}px`;
    host.style.top = `${saved.top}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  }

  const root = document.createElement('div');
  root.className = 'tf2s-root';
  host.appendChild(root);

  const state: PanelState = { me: null, partner: null, loading: true, collapsed: false };
  let destroyed = false;

  render();
  void load();

  function render() {
    if (destroyed) return;
    root.innerHTML = `
      <div class="tf2s-panel tf2s-wallet${state.collapsed ? ' tf2s-wallet--collapsed' : ''}">
        <div class="tf2s-wallet__header" data-drag-handle>
          <span class="tf2s-wallet__title">${UI[locale].title}</span>
          <button class="tf2s-btn tf2s-btn--icon" data-action="refresh" title="${UI[locale].refresh}" ${state.loading ? 'disabled' : ''}>⟳</button>
          <button class="tf2s-btn tf2s-btn--icon" data-action="collapse" title="${state.collapsed ? UI[locale].expand : UI[locale].collapse}">${state.collapsed ? '+' : '–'}</button>
        </div>
        <div class="tf2s-wallet__body">
          ${renderSide(UI[locale].me, state.me)}
          ${renderSide(UI[locale].partner, state.partner)}
        </div>
      </div>
    `;

    root.querySelector('[data-action="refresh"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      void load();
    });
    root.querySelector('[data-action="collapse"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      state.collapsed = !state.collapsed;
      render();
    });

    const handle = root.querySelector<HTMLElement>('[data-drag-handle]');
    if (handle) setupDrag(handle);
  }

  /** Перетаскивание окна за заголовок — мышью или тачем (Pointer Events покрывают оба). */
  function setupDrag(handle: HTMLElement) {
    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (e.button !== undefined && e.button !== 0) return;

      const hostRect = host.getBoundingClientRect();
      // Переключаемся с right/bottom (исходное CSS-позиционирование) на
      // left/top — иначе при перетаскивании right/bottom считались бы от
      // противоположного угла экрана и движение выглядело бы зеркальным.
      host.style.left = `${hostRect.left}px`;
      host.style.top = `${hostRect.top}px`;
      host.style.right = 'auto';
      host.style.bottom = 'auto';

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = hostRect.left;
      const startTop = hostRect.top;

      handle.setPointerCapture(e.pointerId);
      handle.classList.add('tf2s-wallet__header--dragging');

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const maxLeft = Math.max(0, window.innerWidth - host.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - host.offsetHeight);
        const nextLeft = Math.min(Math.max(0, startLeft + dx), maxLeft);
        const nextTop = Math.min(Math.max(0, startTop + dy), maxTop);
        host.style.left = `${nextLeft}px`;
        host.style.top = `${nextTop}px`;
      };

      const onUp = () => {
        handle.releasePointerCapture(e.pointerId);
        handle.classList.remove('tf2s-wallet__header--dragging');
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        const left = parseFloat(host.style.left || '0');
        const top = parseFloat(host.style.top || '0');
        savePosition(left, top);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp, { once: true });
    });
  }

  function renderSide(label: string, data: WalletResponse | null): string {
    if (state.loading && !data) {
      return `
        <div class="tf2s-wallet__side">
          <div class="tf2s-wallet__side-label">${label}</div>
          <div class="tf2s-wallet__status">${UI[locale].loading}</div>
        </div>`;
    }
    if (!data || !data.ok) {
      const reason = data && !data.ok ? data.reason : 'unknown';
      const text = reason === 'private' ? UI[locale].private : reason === 'network' ? UI[locale].network : UI[locale].unknown;
      return `
        <div class="tf2s-wallet__side">
          <div class="tf2s-wallet__side-label">${label}</div>
          <div class="tf2s-wallet__status tf2s-wallet__status--error">${text}</div>
        </div>`;
    }
    return `
      <div class="tf2s-wallet__side">
        <div class="tf2s-wallet__side-label">${label}${data.totalItems ? ` · ${UI[locale].itemCount(data.totalItems)}` : ''}</div>
        ${renderRow('keys', 'Keys', data.counts)}
        ${renderRow('refined', 'Ref', data.counts)}
        ${renderRow('reclaimed', 'Rec', data.counts)}
        ${renderRow('scrap', 'Scrap', data.counts)}
      </div>`;
  }

  function renderRow(kind: keyof CurrencyCounts, label: string, counts: CurrencyCounts): string {
    return `
      <div class="tf2s-wallet__row">
        <span class="tf2s-wallet__key tf2s-wallet__key--${kind}">${label}</span>
        <span class="tf2s-wallet__value">${counts[kind]}</span>
      </div>`;
  }

  async function load() {
    state.loading = true;
    render();

    const [me, partner] = await Promise.allSettled([
      requestFromMain<WalletRequest, WalletResponse>(WALLET_CHANNEL, { who: 'me' }),
      requestFromMain<WalletRequest, WalletResponse>(WALLET_CHANNEL, { who: 'partner' }),
    ]);

    state.me = me.status === 'fulfilled' ? me.value : { who: 'me', ok: false, reason: 'unknown' };
    state.partner = partner.status === 'fulfilled' ? partner.value : { who: 'partner', ok: false, reason: 'unknown' };
    state.loading = false;
    render();
  }

  return {
    destroy: () => {
      destroyed = true;
      host.remove();
    },
  };
}
