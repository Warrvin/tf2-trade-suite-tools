import { requestFromMain } from '../../utils/bridge';
import type { Locale } from '../../utils/i18n';
import { QUICK_ADD_CHANNEL, QuickAddMode, QuickAddRequest, QuickAddResponse } from './types';

const UI = {
  ru: {
    amountPlaceholder: 'кол-во / ref',
    amountTitle: 'Количество предметов (для «Металл» — стоимость в ref)',
    indexPlaceholder: 'индекс',
    indexTitle: 'С какой позиции начинать (можно отрицательный — с конца)',
    add: 'Добавить',
    keys: 'Ключи',
    metal: 'Металл',
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
    amountTitle: 'Item count (for "Metal" — the value in ref)',
    indexPlaceholder: 'index',
    indexTitle: 'Which position to start from (negative counts from the end)',
    add: 'Add',
    keys: 'Keys',
    metal: 'Metal',
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
 * ISOLATED-половина панели "Быстрое добавление предметов" — портирована из
 * Steam Trade Offer Enhancer (см. core.ts за источником и README за полным
 * разбором). Этот файл знает только про UI: что ввёл пользователь, какая
 * кнопка нажата, какая сторона (своя/партнёра) сейчас выбрана в НАТИВНОМ
 * переключателе Steam — вся работа с внутренним состоянием оффера идёт в
 * MAIN world (core.ts) через bridge.ts.
 *
 * Режима "добавить по списку ID" здесь больше нет (был в оригинале, убран по
 * прямой просьбе пользователя — неудобное в использовании поле, см. README).
 *
 * Есть текстовые поля, которые пользователь АКТИВНО печатает — полный
 * re-render на каждое нажатие клавиши стёр бы курсор/фокус. Поэтому разметка
 * строится ОДИН РАЗ при монтировании, а дальше меняются только точечные вещи
 * (сообщение статуса) через прямые ссылки на уже существующие узлы, а не
 * через повторный innerHTML.
 */
export function mountQuickAddPanel(container: HTMLElement, locale: Locale): { destroy: () => void } {
  const root = document.createElement('div');
  root.className = 'tf2s-root';
  container.appendChild(root);

  root.innerHTML = `
    <div class="tf2s-panel tf2s-quickadd">
      <div class="tf2s-quickadd__row">
        <input class="tf2s-quickadd__input" type="number" min="0" step="any" placeholder="${UI[locale].amountPlaceholder}" data-field="amount" title="${UI[locale].amountTitle}"/>
        <input class="tf2s-quickadd__input" type="number" min="0" placeholder="${UI[locale].indexPlaceholder}" data-field="index" title="${UI[locale].indexTitle}"/>
      </div>
      <div class="tf2s-quickadd__row">
        <button class="tf2s-btn tf2s-btn--accent tf2s-quickadd__btn" data-action="ITEMS">${UI[locale].add}</button>
        <button class="tf2s-btn tf2s-quickadd__btn" data-action="KEYS">${UI[locale].keys}</button>
        <button class="tf2s-btn tf2s-quickadd__btn" data-action="METAL">${UI[locale].metal}</button>
        <button class="tf2s-btn tf2s-quickadd__btn" data-action="RECENT">${UI[locale].recent}</button>
      </div>
      <div class="tf2s-quickadd__row">
        <button class="tf2s-btn tf2s-quickadd__btn tf2s-muted" data-action="CLEAR_ME">${UI[locale].clearMe}</button>
        <button class="tf2s-btn tf2s-quickadd__btn tf2s-muted" data-action="CLEAR_THEM">${UI[locale].clearThem}</button>
      </div>
      <div class="tf2s-quickadd__message" data-message hidden></div>
    </div>
  `;

  const amountInput = root.querySelector<HTMLInputElement>('[data-field="amount"]')!;
  const indexInput = root.querySelector<HTMLInputElement>('[data-field="index"]')!;
  const messageEl = root.querySelector<HTMLElement>('[data-message]')!;

  let destroyed = false;
  let messageTimer: number | undefined;

  function showMessage(text: string, kind: 'info' | 'error') {
    window.clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `tf2s-quickadd__message${kind === 'error' ? ' tf2s-quickadd__message--error' : ''}`;
    messageEl.hidden = false;
    messageTimer = window.setTimeout(() => {
      messageEl.hidden = true;
    }, 4000);
  }

  /** Свежее значение выбранной стороны — читается заново на каждый клик, а не
   *  кэшируется: пользователь может переключить вкладку "своё"/"партнёра"
   *  между вводом количества и нажатием кнопки. */
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
        return UI[locale].notEnoughKeys;
      case 'METAL':
        return UI[locale].notEnoughMetal;
      default:
        return UI[locale].notEnoughItems;
    }
  }

  async function runAdd(mode: QuickAddMode) {
    const req: QuickAddRequest = {
      mode,
      amount: readAmount(),
      index: readIndex(),
      isYou: isYourInventorySelected(),
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
    // satisfied:true — очищено (или уже было пусто), молча, без сообщения.
    // null — страница ещё не готова/не удалось: раньше это падало тихо и
    // выглядело как "кнопка не работает", теперь видно причину.
    if (res.satisfied === null) showMessage(UI[locale].clearFailed, 'error');
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
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
      window.clearTimeout(messageTimer);
      root.remove();
    },
  };
}
