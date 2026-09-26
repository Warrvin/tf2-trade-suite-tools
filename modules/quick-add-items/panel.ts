import { requestFromMain } from '../../utils/bridge';
import type { Locale } from '../../utils/i18n';
import { DEFAULT_METAL_BUTTON_MODE, MetalButtonMode, QUICK_ADD_CHANNEL, QuickAddMode, QuickAddRequest, QuickAddResponse } from './types';

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
 * (сообщение статуса, слот кнопки «Металл») через прямые ссылки на уже
 * существующие узлы, а не через повторный innerHTML всей панели — сами поля
 * ввода при переключении режима металла не трогаются, фокус/курсор целы.
 *
 * РЕЖИМ КНОПКИ «МЕТАЛЛ» (по прямой просьбе пользователя): «Металл» добавляет
 * металл НА СУММУ `amount` ref, жадным разменом сверху вниз (см.
 * utils/trade-offer.ts#getItemsForMetal) — удобно для округлой цены, но не
 * годится, когда нужно добавить РОВНО N Reclaimed/Scrap, а не "что-то на эту
 * сумму". Режим 'split' (см. utils/metal-button-mode.ts) меняет местами
 * «Металл» на три кнопки «Реф»/«Рек»/«Скр» — каждая добавляет РОВНО `amount`
 * штук одного конкретного номинала, тем же способом, что и «Ключи» (по
 * счёту, не по стоимости, см. utils/trade-offer.ts#findMetalByKind). Только
 * один из двух видов виден одновременно — они делят одно и то же место в
 * разметке (см. renderMetalSlot ниже).
 *
 * Выбор режима живёт на options-странице (components/FeatureToggle.vue,
 * тот же паттерн, что и режим trade-item-summary/уровень детализации
 * иконок) — не здесь: панель только ПРИМЕНЯЕТ текущий режим (initialMode
 * при монтировании, setMetalMode при живой смене, см. entrypoint
 * tradeoffer-quickadd.content.ts) и не хранит собственного переключателя.
 */
export function mountQuickAddPanel(
  container: HTMLElement,
  locale: Locale,
  initialMode: MetalButtonMode = DEFAULT_METAL_BUTTON_MODE,
): { destroy: () => void; setMetalMode: (mode: MetalButtonMode) => void } {
  const root = document.createElement('div');
  root.className = 'tf2s-root';
  container.appendChild(root);

  /** Разметка одного поля с кастомным спиннером — заменяет нативные стрелки
   *  браузера (см. panel.css: нативные скрыты через ::-webkit-*-spin-button/
   *  -moz-appearance) на пару треугольников в стиле остальной панели —
   *  токены/цвета те же, что у остальных элементов (--tf2s-*, см.
   *  styles/tokens.css), а не голубые/серые нативные квадратики ОС/браузера. */
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
        <button class="tf2s-btn tf2s-btn--accent tf2s-quickadd__btn" data-action="ITEMS">${UI[locale].add}</button>
        <button class="tf2s-btn tf2s-quickadd__btn" data-action="KEYS">${UI[locale].keys}</button>
        <span class="tf2s-quickadd__metal-slot" data-metal-slot></span>
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
  const metalSlot = root.querySelector<HTMLElement>('[data-metal-slot]')!;

  let destroyed = false;
  let messageTimer: number | undefined;

  /** Текущий режим (см. utils/metal-button-mode.ts) — приходит СНАРУЖИ
   *  (initialMode при монтировании, setMetalMode при живой смене на
   *  options-странице), панель сама его не переключает и не хранит выбор. */
  let metalMode: MetalButtonMode = initialMode;

  function renderMetalSlot() {
    metalSlot.innerHTML =
      metalMode === 'combined'
        ? `<button class="tf2s-btn tf2s-quickadd__btn" data-action="METAL">${UI[locale].metal}</button>`
        : `
            <button class="tf2s-btn tf2s-quickadd__btn" data-action="REFINED">${UI[locale].refined}</button>
            <button class="tf2s-btn tf2s-quickadd__btn" data-action="RECLAIMED">${UI[locale].reclaimed}</button>
            <button class="tf2s-btn tf2s-quickadd__btn" data-action="SCRAP">${UI[locale].scrap}</button>
          `;
  }
  renderMetalSlot();

  /** Клик по кастомной стрелке спиннера — эмулирует нативный шаг браузерного
   *  number-инпута (тот же `step`, то же зажатие снизу по `min`), просто
   *  своей отрисовкой (см. spinnerField выше). */
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
      case 'REFINED':
      case 'RECLAIMED':
      case 'SCRAP':
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
    setMetalMode: (mode: MetalButtonMode) => {
      if (destroyed || mode === metalMode) return;
      metalMode = mode;
      renderMetalSlot();
    },
  };
}
