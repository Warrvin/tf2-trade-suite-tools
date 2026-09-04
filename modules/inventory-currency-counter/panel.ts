import { requestFromMain } from '../../utils/bridge';
import { CurrencyCounts, formatMetalScrap, metalValueInScrap } from '../../utils/currency';
import type { Locale } from '../../utils/i18n';
import { INVENTORY_CURRENCY_CHANNEL, InventoryCurrencyRequest, InventoryCurrencySnapshot } from './types';

const UI = {
  ru: {
    label: 'Валюта в инвентаре:',
    refreshTitle: 'Точный подсчёт (полная загрузка инвентаря)',
    loading: 'загрузка…',
    private: 'инвентарь скрыт настройками приватности',
    network: 'сетевая ошибка',
    unknown: 'не удалось посчитать',
    totalTitle: 'Суммарная стоимость металла в ref, без учёта ключей',
    partialTitle:
      'Оценка по предметам, которые Steam уже подгрузил на этой странице — пролистайте инвентарь до конца или нажмите ⟳ для точного подсчёта',
    shown: (loaded: number, total: number | null | undefined) => `~ показано ${loaded}${total ? ` из ${total}` : ''}`,
    exact: (loaded: number) => `точно · ${loaded} предм.`,
  },
  en: {
    label: 'Inventory currency:',
    refreshTitle: 'Exact count (loads the full inventory)',
    loading: 'loading…',
    private: 'inventory is hidden by privacy settings',
    network: 'network error',
    unknown: "couldn't count",
    totalTitle: 'Total metal value in ref, keys not included',
    partialTitle:
      "An estimate from the items Steam has already loaded on this page — scroll to the end of the inventory or press ⟳ for an exact count",
    shown: (loaded: number, total: number | null | undefined) => `~ ${loaded}${total ? ` of ${total}` : ''} shown`,
    exact: (loaded: number) => `exact · ${loaded} item${loaded === 1 ? '' : 's'}`,
  },
} as const;

interface PanelState {
  data: InventoryCurrencySnapshot | null;
  loading: boolean;
  /** true пока идёт именно forceFullFetch (не быстрая фоновая оценка) — чтобы
   *  крутить спиннер на кнопке "Обновить", а не мигать всей панелью на
   *  каждый фоновый опрос. */
  refreshing: boolean;
}

/** Как часто по-тихому пересчитывать бесплатную оценку, пока панель на
 *  экране — 0 доп. сетевых запросов (см. core.ts: quickEstimate читает уже
 *  накопленную MAIN-world карту), поэтому можно не экономить. Даёт эффект
 *  "живого" счётчика по мере того, как Steam догружает страницы при
 *  скролле — без необходимости городить отдельный event bus поверх
 *  bridge.ts ради одного этого. */
const QUICK_POLL_MS = 2000;

/**
 * Монтирует ВСТРОЕННУЮ (не плавающую) панель счётчика валюты внутрь
 * контейнера, который даёт createShadowRootUi (см.
 * entrypoints/inventory-currency.content.ts). В отличие от
 * modules/wallet-summary/panel.ts здесь: без position:fixed-хоста, без
 * заголовка-ручки для перетаскивания, без сохранения позиции в
 * localStorage — панель просто занимает своё место в потоке разметки,
 * туда, куда её вставил anchor у createShadowRootUi (сразу под панелью
 * фильтров инвентаря), как обычный блок дизайна самой страницы Steam.
 */
export function mountInventoryCurrencyPanel(container: HTMLElement, locale: Locale): { destroy: () => void } {
  // Защита от повторного монтирования в один и тот же контейнер (см. баг,
  // исправленный в entrypoints/inventory-currency.content.ts: ui.mount() у
  // WXT безусловно вызывает onMount заново при каждом вызове) — если тут
  // вдруг уже есть наша разметка, снимаем её перед тем как рисовать новую,
  // а не копим одинаковые панели одну под другой.
  container.replaceChildren();

  const root = document.createElement('div');
  root.className = 'tf2s-root';
  container.appendChild(root);

  const state: PanelState = { data: null, loading: true, refreshing: false };
  let destroyed = false;
  let pollTimer: number | null = null;

  render();
  void loadQuick();
  schedulePoll();

  function schedulePoll() {
    pollTimer = window.setInterval(() => {
      if (!state.refreshing) void loadQuick(true);
    }, QUICK_POLL_MS);
  }

  function render() {
    if (destroyed) return;
    root.innerHTML = `
      <div class="tf2s-panel tf2s-invcur">
        <span class="tf2s-invcur__label">${UI[locale].label}</span>
        ${renderBody()}
        <button class="tf2s-btn tf2s-btn--icon tf2s-invcur__refresh" data-action="refresh" title="${UI[locale].refreshTitle}" ${state.refreshing ? 'disabled' : ''}>
          ${state.refreshing ? '…' : '⟳'}
        </button>
      </div>
    `;

    root.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
      void loadFull();
    });
  }

  function renderBody(): string {
    if (state.loading && !state.data) {
      return `<span class="tf2s-invcur__status">${UI[locale].loading}</span>`;
    }
    if (!state.data || !state.data.ok) {
      const reason = state.data && !state.data.ok ? state.data.reason : 'unknown';
      const text = reason === 'private' ? UI[locale].private : reason === 'network' ? UI[locale].network : UI[locale].unknown;
      return `<span class="tf2s-invcur__status tf2s-invcur__status--error">${text}</span>`;
    }

    const { counts, partial, loadedCount, totalCount } = state.data;
    return `
      ${renderChip('keys', 'Keys', counts.keys)}
      ${renderChip('refined', 'Ref', counts.refined)}
      ${renderChip('reclaimed', 'Rec', counts.reclaimed)}
      ${renderChip('scrap', 'Scrap', counts.scrap)}
      <span class="tf2s-invcur__total" title="${UI[locale].totalTitle}">
        ≈ ${formatMetalScrap(metalValueInScrap(counts))}
      </span>
      ${
        partial
          ? `<span class="tf2s-invcur__hint" title="${UI[locale].partialTitle}">
              ${UI[locale].shown(loadedCount, totalCount)}
            </span>`
          : `<span class="tf2s-invcur__hint tf2s-invcur__hint--exact">${UI[locale].exact(loadedCount)}</span>`
      }
    `;
  }

  function renderChip(kind: keyof CurrencyCounts, label: string, value: number): string {
    return `
      <span class="tf2s-invcur__chip">
        <span class="tf2s-invcur__dot tf2s-invcur__dot--${kind}"></span>
        <span class="tf2s-invcur__chip-value">${value}</span>
        <span class="tf2s-invcur__chip-label">${label}</span>
      </span>`;
  }

  async function loadQuick(silent = false) {
    if (!silent) state.loading = true;
    if (!silent) render();
    try {
      const data = await requestFromMain<InventoryCurrencyRequest, InventoryCurrencySnapshot>(INVENTORY_CURRENCY_CHANNEL, {
        forceFullFetch: false,
      });
      if (destroyed) return;
      state.data = data;
    } catch {
      if (destroyed) return;
      if (!state.data) state.data = { ok: false, reason: 'unknown' };
    }
    state.loading = false;
    render();
  }

  async function loadFull() {
    state.refreshing = true;
    render();
    try {
      const data = await requestFromMain<InventoryCurrencyRequest, InventoryCurrencySnapshot>(INVENTORY_CURRENCY_CHANNEL, {
        forceFullFetch: true,
      });
      if (destroyed) return;
      state.data = data;
    } catch {
      if (destroyed) return;
      state.data = { ok: false, reason: 'unknown' };
    }
    state.refreshing = false;
    state.loading = false;
    render();
  }

  return {
    destroy: () => {
      destroyed = true;
      if (pollTimer !== null) window.clearInterval(pollTimer);
      root.remove();
    },
  };
}
