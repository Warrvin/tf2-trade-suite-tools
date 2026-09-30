import { requestFromMain } from '../../utils/bridge';
import type { Locale } from '../../utils/i18n';
import { getCommittedOffers, syncSentOffersViaNetwork, type CommittedOffer } from '../../utils/committed-offers';
import {
  DEFAULT_METAL_BUTTON_MODE,
  MetalButtonMode,
  QUICK_ADD_CHANNEL,
  QuickAddMode,
  QuickAddRequest,
  QuickAddResponse,
} from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const UI = {
  ru: {
    amountPlaceholder: 'кол-во / ref',
    amountTitle: 'Количество предметов (для «Металл» — стоимость в ref; для «Реф»/«Рек»/«Скр» — количество штук)',
    indexPlaceholder: 'индекс',
    indexTitle: 'С какой позиции начинать (можно отрицательный — с конца)',
    add: 'Добавить',
    keys: 'Ключи',
    metal: 'Металл',
    refined: 'Реф',
    reclaimed: 'Рек',
    scrap: 'Скр',
    freeKeys: 'Ключи (своб.)',
    freeMetal: 'Металл (своб.)',
    freeRefined: 'Реф (своб.)',
    freeReclaimed: 'Рек (своб.)',
    freeScrap: 'Скр (своб.)',
    fromOffer: '📋 Из оффера ▾',
    noActiveOffers: 'Нет активных офферов с вашими предметами',
    offerItemsCount: (count: number) => `${count} предм.`,
    clonedFromOffer: (partner: string, count: number) => `Добавлено ${count} предм. из оффера для «${partner}»`,
    clonedNone: 'Предметы из оффера уже добавлены или отсутствуют в инвентаре',
    recent: 'Недавние',
    clearMe: 'Очистить мои',
    clearThem: 'Очистить партнёра',
    notEnoughKeys: 'Добавлено не всё — не хватило ключей',
    notEnoughMetal: 'Добавлено не всё — не хватило металла на такую сумму',
    notEnoughItems: 'Добавлено не всё — подходящих предметов не хватило',
    offerNotEditable: 'Оффер сейчас нельзя изменить',
    clearFailed: 'Не удалось очистить — обновите страницу и попробуйте снова',
  },
  en: {
    amountPlaceholder: 'qty / ref',
    amountTitle: 'Item count (for "Metal" — the value in ref; for "Ref"/"Rec"/"Scr" — the count)',
    indexPlaceholder: 'index',
    indexTitle: 'Which position to start from (negative counts from the end)',
    add: 'Add',
    keys: 'Keys',
    metal: 'Metal',
    refined: 'Ref',
    reclaimed: 'Rec',
    scrap: 'Scr',
    freeKeys: 'Keys (free)',
    freeMetal: 'Metal (free)',
    freeRefined: 'Ref (free)',
    freeReclaimed: 'Rec (free)',
    freeScrap: 'Scr (free)',
    fromOffer: '📋 From offer ▾',
    noActiveOffers: 'No active offers with your items',
    offerItemsCount: (count: number) => `${count} items`,
    clonedFromOffer: (partner: string, count: number) => `Added ${count} items from offer to "${partner}"`,
    clonedNone: 'Items from offer are already added or not in your inventory',
    recent: 'Recent',
    clearMe: 'Clear mine',
    clearThem: "Clear partner's",
    notEnoughKeys: "Couldn't add everything — not enough keys",
    notEnoughMetal: "Couldn't add everything — not enough metal for that amount",
    notEnoughItems: "Couldn't add everything — not enough matching items",
    offerNotEditable: "The offer can't be changed right now",
    clearFailed: "Couldn't clear — refresh the page and try again",
  },
} as const;

/**
 * ISOLATED-половина панели "Быстрое добавление предметов".
 * Управляет формой, кнопками быстрого добавления (включая свободные ключи/металл
 * и дублирование из активных офферов) и отправляет команды в MAIN world через bridge.
 */
export function mountQuickAddPanel(
  container: HTMLElement,
  locale: Locale,
  initialMode: MetalButtonMode = DEFAULT_METAL_BUTTON_MODE,
  initialShowFreeButtons: boolean = true,
): {
  destroy: () => void;
  setMetalMode: (mode: MetalButtonMode) => void;
  setShowFreeButtons: (show: boolean) => void;
} {
  const root = document.createElement('div');
  root.className = 'tf2s-root';
  container.appendChild(root);

  function spinnerField(field: 'amount' | 'index', placeholder: string, title: string, min: string, step: string): string {
    return `
      <span class="tf2s-spinner">
        <input class="tf2s-quickadd__input" type="number" min="${min}" step="${step}" placeholder="${placeholder}" data-field="${field}" title="${title}"/>
        <span class="tf2s-spinner__ctrl">
          <button type="button" class="tf2s-spinner__btn" data-spin="${field}" data-dir="1" tabindex="-1" aria-label="+">▲</button>
          <button type="button" class="tf2s-spinner__btn" data-spin="${field}" data-dir="-1" tabindex="-1" aria-label="-">▼</button>
        </span>
      </span>
    `;
  }

  root.innerHTML = `
    <div class="tf2s-panel tf2s-quickadd">
      <div class="tf2s-quickadd__row">
        ${spinnerField('amount', UI[locale].amountPlaceholder, UI[locale].amountTitle, '0', 'any')}
        ${spinnerField('index', UI[locale].indexPlaceholder, UI[locale].indexTitle, '0', '1')}
      </div>
      <div class="tf2s-quickadd__row">
        <button type="button" class="tf2s-btn tf2s-btn--accent tf2s-quickadd__btn" data-action="ITEMS">${UI[locale].add}</button>
        <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="KEYS">${UI[locale].keys}</button>
        <span class="tf2s-quickadd__metal-slot" data-metal-slot></span>
        <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="RECENT">${UI[locale].recent}</button>
      </div>
      <div class="tf2s-quickadd__row tf2s-quickadd__free-row" data-free-row style="${initialShowFreeButtons ? '' : 'display: none;'}">
        <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="FREE_KEYS">${UI[locale].freeKeys}</button>
        <span class="tf2s-quickadd__metal-slot" data-free-metal-slot></span>
        <div class="tf2s-offer-clone-container">
          <button type="button" class="tf2s-btn tf2s-quickadd__btn tf2s-offer-clone-btn" data-toggle-clone-menu>
            ${UI[locale].fromOffer}
          </button>
          <div class="tf2s-offer-clone-menu" data-clone-menu></div>
        </div>
      </div>
      <div class="tf2s-quickadd__row">
        <button type="button" class="tf2s-btn tf2s-quickadd__btn tf2s-muted" data-action="CLEAR_ME">${UI[locale].clearMe}</button>
        <button type="button" class="tf2s-btn tf2s-quickadd__btn tf2s-muted" data-action="CLEAR_THEM">${UI[locale].clearThem}</button>
      </div>
      <div class="tf2s-quickadd__message" data-message hidden></div>
    </div>
  `;

  const amountInput = root.querySelector<HTMLInputElement>('[data-field="amount"]')!;
  const indexInput = root.querySelector<HTMLInputElement>('[data-field="index"]')!;
  const messageEl = root.querySelector<HTMLElement>('[data-message]')!;
  const metalSlot = root.querySelector<HTMLElement>('[data-metal-slot]')!;
  const freeMetalSlot = root.querySelector<HTMLElement>('[data-free-metal-slot]')!;
  const freeRow = root.querySelector<HTMLElement>('[data-free-row]')!;
  const cloneMenu = root.querySelector<HTMLElement>('[data-clone-menu]')!;

  let destroyed = false;
  let messageTimer: number | undefined;
  let metalMode: MetalButtonMode = initialMode;

  function renderMetalSlot() {
    metalSlot.innerHTML =
      metalMode === 'combined'
        ? `<button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="METAL">${UI[locale].metal}</button>`
        : `
            <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="REFINED">${UI[locale].refined}</button>
            <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="RECLAIMED">${UI[locale].reclaimed}</button>
            <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="SCRAP">${UI[locale].scrap}</button>
          `;

    freeMetalSlot.innerHTML =
      metalMode === 'combined'
        ? `<button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="FREE_METAL">${UI[locale].freeMetal}</button>`
        : `
            <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="FREE_REFINED">${UI[locale].freeRefined}</button>
            <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="FREE_RECLAIMED">${UI[locale].freeReclaimed}</button>
            <button type="button" class="tf2s-btn tf2s-quickadd__btn" data-action="FREE_SCRAP">${UI[locale].freeScrap}</button>
          `;
  }
  renderMetalSlot();

  root.querySelectorAll<HTMLButtonElement>('[data-spin]').forEach((spinBtn) => {
    spinBtn.addEventListener('click', () => {
      const field = spinBtn.dataset.spin as 'amount' | 'index';
      const input = field === 'amount' ? amountInput : indexInput;
      const dir = Number(spinBtn.dataset.dir);
      const step = parseFloat(input.step) || 1;
      const min = input.min !== '' ? parseFloat(input.min) : undefined;
      const current = parseFloat(input.value) || 0;
      let next = current + dir * step;
      if (min !== undefined) next = Math.max(min, next);
      input.value = String(Math.round(next * 100) / 100);
      input.focus();
    });
  });

  function showMessage(text: string, kind: 'info' | 'error') {
    window.clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `tf2s-quickadd__message${kind === 'error' ? ' tf2s-quickadd__message--error' : ''}`;
    messageEl.hidden = false;
    messageTimer = window.setTimeout(() => {
      messageEl.hidden = true;
    }, 4000);
  }

  function isYourInventorySelected(): boolean {
    return document.getElementById('inventory_select_your_inventory')?.classList.contains('active') ?? true;
  }

  function readAmount(): number {
    return parseFloat(amountInput.value) || 1;
  }
  function readIndex(): number {
    return parseInt(indexInput.value, 10) || 0;
  }

  async function sendRequest(req: QuickAddRequest): Promise<QuickAddResponse> {
    try {
      return await requestFromMain<QuickAddRequest, QuickAddResponse>(QUICK_ADD_CHANNEL, req);
    } catch {
      return { satisfied: null };
    }
  }

  function describeUnsatisfied(mode: QuickAddMode): string {
    switch (mode) {
      case 'KEYS':
      case 'FREE_KEYS':
        return UI[locale].notEnoughKeys;
      case 'METAL':
      case 'FREE_METAL':
      case 'REFINED':
      case 'FREE_REFINED':
      case 'RECLAIMED':
      case 'FREE_RECLAIMED':
      case 'SCRAP':
      case 'FREE_SCRAP':
        return UI[locale].notEnoughMetal;
      default:
        return UI[locale].notEnoughItems;
    }
  }

  async function runAdd(mode: QuickAddMode) {
    let committedAssetIds: string[] | undefined;
    let committedEconomyKeys: string[] | undefined;

    if (mode.startsWith('FREE_')) {
      const offers = await getCommittedOffers();
      const ids: string[] = [];
      const keys: string[] = [];
      for (const offer of Object.values(offers)) {
        if (offer.assetIds) ids.push(...offer.assetIds);
        if (offer.economyKeys) keys.push(...offer.economyKeys);
      }
      committedAssetIds = ids;
      committedEconomyKeys = keys;
    }

    const req: QuickAddRequest = {
      mode,
      amount: readAmount(),
      index: readIndex(),
      isYou: isYourInventorySelected(),
      committedAssetIds,
      committedEconomyKeys,
    };
    const res = await sendRequest(req);
    if (destroyed) return;

    if (res.satisfied === null) {
      showMessage(UI[locale].offerNotEditable, 'error');
    } else if (res.satisfied === false) {
      showMessage(describeUnsatisfied(mode), 'info');
    }
  }

  async function runClear(mode: 'CLEAR_ME' | 'CLEAR_THEM') {
    const res = await sendRequest({ mode, amount: 0, index: 0, isYou: null });
    if (destroyed) return;
    if (res.satisfied === null) showMessage(UI[locale].clearFailed, 'error');
  }

  function renderCloneMenuList(offers: Record<string, CommittedOffer>) {
    const list = Object.values(offers).filter(
      (o) => (o.assetIds && o.assetIds.length > 0) || (o.economyKeys && o.economyKeys.length > 0),
    );

    if (list.length === 0) {
      cloneMenu.innerHTML = `<div class="tf2s-offer-clone-empty">${UI[locale].noActiveOffers}</div>`;
    } else {
      cloneMenu.innerHTML = list
        .map((o) => {
          const count = o.assetIds && o.assetIds.length > 0 ? o.assetIds.length : (o.economyKeys?.length ?? 0);
          return `
            <button type="button" class="tf2s-offer-clone-item" data-clone-offer-id="${o.offerId}">
              <span class="tf2s-offer-clone-item__partner">${escapeHtml(o.partnerName)}</span>
              <span class="tf2s-offer-clone-item__details">#${o.offerId} · ${UI[locale].offerItemsCount(count)}</span>
            </button>
          `;
        })
        .join('');
    }
  }

  async function toggleCloneMenu() {
    if (cloneMenu.classList.contains('tf2s-offer-clone-menu--open')) {
      cloneMenu.classList.remove('tf2s-offer-clone-menu--open');
      return;
    }

    const offers = await getCommittedOffers();
    renderCloneMenuList(offers);
    cloneMenu.classList.add('tf2s-offer-clone-menu--open');

    // Фоново актуализируем список, если меню открыто
    void syncSentOffersViaNetwork().then((fresh) => {
      if (!destroyed && fresh && cloneMenu.classList.contains('tf2s-offer-clone-menu--open')) {
        renderCloneMenuList(fresh);
      }
    });
  }

  async function cloneFromOffer(offerId: string) {
    cloneMenu.classList.remove('tf2s-offer-clone-menu--open');
    const offers = await getCommittedOffers();
    const offer = offers[offerId];
    if (!offer) return;
    const hasAssets = offer.assetIds && offer.assetIds.length > 0;
    const hasKeys = offer.economyKeys && offer.economyKeys.length > 0;
    if (!hasAssets && !hasKeys) return;

    const count = hasAssets ? offer.assetIds.length : (offer.economyKeys?.length ?? 0);

    const res = await sendRequest({
      mode: 'FROM_OFFER',
      amount: count,
      index: 0,
      isYou: true,
      targetAssetIds: offer.assetIds,
      targetEconomyKeys: offer.economyKeys,
    });
    if (destroyed) return;

    if (res.satisfied === null) {
      showMessage(UI[locale].offerNotEditable, 'error');
    } else if (res.addedCount && res.addedCount > 0) {
      showMessage(UI[locale].clonedFromOffer(offer.partnerName, res.addedCount), 'info');
    } else {
      showMessage(UI[locale].clonedNone, 'info');
    }
  }

  // Закрытие меню при клике снаружи
  const onDocumentClick = (e: MouseEvent) => {
    if (!root.contains(e.target as Node)) {
      cloneMenu.classList.remove('tf2s-offer-clone-menu--open');
    }
  };
  document.addEventListener('click', onDocumentClick);

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('[data-toggle-clone-menu]')) {
      void toggleCloneMenu();
      return;
    }

    const cloneItem = target.closest<HTMLButtonElement>('[data-clone-offer-id]');
    if (cloneItem) {
      const offerId = cloneItem.dataset.cloneOfferId!;
      void cloneFromOffer(offerId);
      return;
    }

    const btn = target.closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action!;

    if (action === 'CLEAR_ME' || action === 'CLEAR_THEM') {
      void runClear(action);
      return;
    }
    void runAdd(action as QuickAddMode);
  });

  return {
    destroy: () => {
      destroyed = true;
      document.removeEventListener('click', onDocumentClick);
      window.clearTimeout(messageTimer);
      root.remove();
    },
    setMetalMode: (mode: MetalButtonMode) => {
      if (destroyed || mode === metalMode) return;
      metalMode = mode;
      renderMetalSlot();
    },
    setShowFreeButtons: (show: boolean) => {
      if (destroyed) return;
      freeRow.style.display = show ? '' : 'none';
    },
  };
}
