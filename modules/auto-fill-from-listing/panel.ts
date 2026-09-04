import { requestFromMain } from '../../utils/bridge';
import type { Locale } from '../../utils/i18n';
import { AUTO_FILL_CHANNEL, AutoFillRequest, AutoFillResponse, ForItemRef, ListingIntent } from './types';

const UI = {
  ru: {
    addListingPrice: 'Добавить цену объявления',
    offerNotEditable: 'Оффер сейчас нельзя изменить',
    priceNotSatisfied: 'Добавлено не всё — не хватило валюты на цену объявления',
    itemGone: 'Предмет по этой ссылке уже недоступен — похоже, его продали или обменяли',
    partnerInventoryTimeout: 'Не удалось загрузить инвентарь партнёра — попробуйте обновить страницу',
    priceAutoFillTimeout: 'Не удалось автоматически добавить всю цену объявления — не хватило валюты',
    ambiguousOwnItem: 'В инвентаре несколько подходящих предметов с таким названием — добавьте нужный сами',
    ownItemNotFound: 'Подходящий предмет по названию объявления не найден в вашем инвентаре',
    ownItemTimeout: 'Не удалось автоматически подобрать предмет по названию объявления',
  },
  en: {
    addListingPrice: 'Add listing price',
    offerNotEditable: "The offer can't be changed right now",
    priceNotSatisfied: "Couldn't add everything — not enough currency for the listing price",
    itemGone: "This item's link is no longer available — it looks like it was sold or traded away",
    partnerInventoryTimeout: "Couldn't load the partner's inventory — try refreshing the page",
    priceAutoFillTimeout: "Couldn't automatically add the full listing price — not enough currency",
    ambiguousOwnItem: 'Several matching items with that name are in your inventory — add the right one yourself',
    ownItemNotFound: "Couldn't find a matching item for the listing's name in your inventory",
    ownItemTimeout: "Couldn't automatically match an item for the listing's name",
  },
} as const;

/**
 * ISOLATED-половина автозаполнения — портирована из Steam Trade Offer
 * Enhancer (см. core.ts за источником и README за полным разбором). Этот
 * файл — единственное место, где разбирается `location.search`: URL общий
 * для MAIN и ISOLATED миров, но конкретно ЗДЕСЬ он нужен только чтобы решить,
 * что показать пользователю (кнопку цены объявления, сообщение) — вся работа
 * с состоянием оффера всё равно идёт в MAIN через bridge.ts, как и у
 * остальных модулей.
 *
 * На обычной ссылке (без `for_item`/`listing_intent` от backpack.tf) модулю
 * нечего делать — панель вообще НЕ монтируется (пустой `destroy`), чтобы не
 * добавлять лишний DOM на подавляющем большинстве обычных офферов. Это
 * решается ОДИН раз по содержимому самой ссылки и не зависит от тумблеров
 * ниже — если на ссылке в принципе нет ни предмета, ни цены, показывать
 * нечего в любом случае.
 *
 * ДВА НЕЗАВИСИМЫХ ТУМБЛЕРА (по прямой просьбе пользователя — баг-репорт
 * "хочу включать по отдельности", см. types.ts за деталями):
 *  - `autoFillEnabled` — полностью автоматический режим: сам, без единого
 *    клика, добавляет и предмет по `for_item` (только продажа), и валюту по
 *    цене объявления (оба вида объявлений) — опрашивает MAIN раз в секунду,
 *    как и раньше делал только для предмета.
 *  - `priceButtonEnabled` — независимая кнопка "Добавить цену объявления":
 *    видна и работает вне зависимости от `autoFillEnabled`. Идемпотентность
 *    самого добавления валюты (чтобы не задвоить при одновременной работе
 *    обоих путей) обеспечена в core.ts (`addListingPrice`/
 *    `addListingPriceGuarded`), здесь об этом заботиться не нужно.
 * Опции передаются при монтировании и могут меняться на лету через
 * `setOptions` — настройки могут переключить пользователь, пока страница
 * оффера уже открыта (см. вызывающий entrypoint).
 *
 * ИСПРАВЛЕННЫЙ БАГ (баг-репорт пользователя: пустая "полоса" над панелью
 * quick-add-items, когда в ссылке есть `for_item`, но нет кнопки цены
 * объявления — т.е. на практике почти всегда, см. README за тем, почему).
 * Раньше `.tf2s-panel.tf2s-autofill` создавался ВСЕГДА, если было хоть что-то
 * (for_item ИЛИ кнопка цены) — а внутри нередко оказывался только скрытый
 * (`hidden`) элемент сообщения без кнопки. У `.tf2s-panel`/`.tf2s-autofill`
 * есть padding/margin (см. panel.css) — они применяются к контейнеру
 * независимо от того, скрыты ли ЕГО ДЕТИ, поэтому пустая на вид, но с
 * реальной высотой/отступами область оставалась видна как пустая полоса.
 * Панель по-прежнему создаётся ЛЕНИВО (`ensurePanel`) и удаляется, как
 * только показывать больше нечего (`removePanelIfEmpty`) — теперь это
 * работает одинаково и для кнопки, и для сообщений, независимо от того,
 * какой тумблер их вызвал.
 */

const CHECK_POLL_MS = 1000;
/** ~20 секунд на подгрузку инвентаря партнёра — после этого тихо сдаёмся
 *  (для предмета) или показываем сообщение (для валюты), не считая это
 *  обязательно реальной ошибкой: возможно, просто медленное соединение, а
 *  не пропавший предмет/пустой инвентарь (см. core.ts#checkForItem). */
const CHECK_MAX_ATTEMPTS = 20;

export interface AutoFillPanelOptions {
  /** "Автозаполнение по ссылке с backpack.tf" — полностью автоматический
   *  режим, без кликов (см. AUTO_FILL_FEATURE_ID в types.ts). */
  autoFillEnabled: boolean;
  /** "Добавить цену объявления" — независимая ручная кнопка (см.
   *  LISTING_PRICE_BUTTON_FEATURE_ID в types.ts). */
  priceButtonEnabled: boolean;
}

function parseForItem(params: URLSearchParams): ForItemRef | null {
  const raw = params.get('for_item');
  if (!raw) return null;
  const [appid, contextid, assetid] = raw.split('_');
  if (!appid || !contextid || !assetid) return null;
  return { appid, contextid, assetid };
}

function parseListingIntent(params: URLSearchParams): ListingIntent | null {
  const raw = params.get('listing_intent');
  if (raw === '0') return 0;
  if (raw === '1') return 1;
  return null;
}

function parseItemName(params: URLSearchParams): string | null {
  const raw = params.get('listing_item_name');
  return raw && raw.trim() ? raw.trim() : null;
}

export function mountAutoFillPanel(
  container: HTMLElement,
  options: AutoFillPanelOptions,
  locale: Locale,
): { destroy: () => void; setOptions: (options: AutoFillPanelOptions) => void } {
  const params = new URLSearchParams(window.location.search);
  const forItem = parseForItem(params);
  const listingIntent = parseListingIntent(params);
  const itemName = parseItemName(params);
  const keys = parseFloat(params.get('listing_currencies_keys') ?? '') || 0;
  const metal = parseFloat(params.get('listing_currencies_metal') ?? '') || 0;
  const hasForItem = forItem !== null;
  const hasPriceData = listingIntent !== null && (keys > 0 || metal > 0);
  // Свой предмет по имени — только для ПОКУПКИ (см. core.ts#findOwnItemByName
  // за тем, почему для продажи это не нужно — там уже есть точный for_item).
  const hasOwnItemByName = listingIntent === 0 && itemName !== null;

  if (!hasForItem && !hasPriceData && !hasOwnItemByName) {
    return { destroy: () => {}, setOptions: () => {} };
  }

  const root = document.createElement('div');
  root.className = 'tf2s-root';
  container.appendChild(root);

  let destroyed = false;
  let messageTimer: number | undefined;
  let messageEl: HTMLElement | null = null;
  let btnEl: HTMLButtonElement | null = null;
  let itemPollTimer: number | undefined;
  let itemPollActive = false;
  let pricePollTimer: number | undefined;
  let pricePollActive = false;
  let ownItemPollTimer: number | undefined;
  let ownItemPollActive = false;

  /** Панель создаётся по требованию (см. комментарий выше) — если уже есть
   *  (кнопка её создала), просто возвращает существующую. */
  function ensurePanel(): HTMLElement {
    let panel = root.querySelector<HTMLElement>('.tf2s-autofill');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'tf2s-panel tf2s-autofill';
      root.appendChild(panel);
    }
    return panel;
  }

  /** Убирает панель целиком, если в ней не осталось ничего видимого —
   *  ни кнопки, ни активного сообщения. Проверяется после КАЖДОГО
   *  изменения содержимого (скрытие кнопки, истечение сообщения). */
  function removePanelIfEmpty() {
    const panel = root.querySelector('.tf2s-autofill');
    if (panel && panel.children.length === 0) panel.remove();
  }

  function showMessage(text: string, kind: 'info' | 'error') {
    window.clearTimeout(messageTimer);
    const panel = ensurePanel();
    if (!messageEl) {
      messageEl = document.createElement('div');
      panel.appendChild(messageEl);
    }
    messageEl.textContent = text;
    messageEl.className = `tf2s-autofill__message${kind === 'error' ? ' tf2s-autofill__message--error' : ''}`;
    messageTimer = window.setTimeout(() => {
      messageEl?.remove();
      messageEl = null;
      removePanelIfEmpty();
    }, 6000);
  }

  async function sendRequest(req: AutoFillRequest): Promise<AutoFillResponse | null> {
    try {
      return await requestFromMain<AutoFillRequest, AutoFillResponse>(AUTO_FILL_CHANNEL, req);
    } catch {
      return null;
    }
  }

  function showButton() {
    if (btnEl || !hasPriceData) return;
    const panel = ensurePanel();
    btnEl = document.createElement('button');
    btnEl.className = 'tf2s-btn tf2s-btn--accent tf2s-autofill__btn';
    btnEl.textContent = UI[locale].addListingPrice;
    btnEl.addEventListener('click', () => {
      void (async () => {
        const res = await sendRequest({ kind: 'ADD_LISTING_PRICE', listingIntent: listingIntent as ListingIntent, keys, metal });
        if (destroyed || !res || res.kind !== 'ADD_LISTING_PRICE') return;

        if (res.satisfied === null) showMessage(UI[locale].offerNotEditable, 'error');
        else if (res.satisfied === false) showMessage(UI[locale].priceNotSatisfied, 'info');
      })();
    });
    panel.appendChild(btnEl);
  }

  function hideButton() {
    if (!btnEl) return;
    btnEl.remove();
    btnEl = null;
    removePanelIfEmpty();
  }

  /**
   * Стейтless-опрос вместо однократного колбэка "инвентарь партнёра
   * загружен" (которого у нас нет, см. core.ts#checkForItem) — спрашиваем
   * MAIN раз в секунду, добавлен ли предмет из ссылки, пока не придёт
   * окончательный ответ ('added'/'dead'), не выключат тумблер или не
   * кончится терпение.
   *
   * ИСПРАВЛЕНО: раньше по истечении попыток опрос тихо останавливался без
   * единого сообщения (расчёт был на то, что 'dead' почти всегда успеет
   * определиться раньше — см. core.ts за тем, почему раньше это было не
   * так). Теперь core.ts#checkForItem гораздо надёжнее ловит 'dead', так
   * что реальный тайм-аут — это, как правило, действительно нештатная
   * ситуация (инвентарь партнёра не смог загрузиться вовсе), и молчать о
   * ней больше не стоит.
   */
  async function pollForItem(ref: ForItemRef, attempt: number) {
    if (destroyed || !itemPollActive) return;

    const res = await sendRequest({ kind: 'CHECK_FOR_ITEM', forItem: ref });
    if (destroyed || !itemPollActive) return;

    const state = res?.kind === 'CHECK_FOR_ITEM' ? res.state : 'pending';
    if (state === 'added') return; // тихий успех — предмет уже виден в слоте партнёра
    if (state === 'dead') {
      showMessage(UI[locale].itemGone, 'error');
      return;
    }
    if (attempt < CHECK_MAX_ATTEMPTS) {
      itemPollTimer = window.setTimeout(() => void pollForItem(ref, attempt + 1), CHECK_POLL_MS);
    } else {
      showMessage(UI[locale].partnerInventoryTimeout, 'error');
    }
  }

  function startItemPoll() {
    if (itemPollActive || !forItem) return;
    itemPollActive = true;
    void pollForItem(forItem, 1);
  }

  function stopItemPoll() {
    itemPollActive = false;
    window.clearTimeout(itemPollTimer);
  }

  /**
   * Тот же принцип опроса, что и `pollForItem`, но для валюты — раньше
   * добавление цены объявления запускалось ТОЛЬКО кликом по кнопке; теперь,
   * когда включено `autoFillEnabled`, оно должно происходить само, без
   * клика (прямое требование пользователя), причём для ОБОИХ видов
   * объявлений (при покупке валюту кладёт партнёр — как и с `for_item`, его
   * инвентарь может быть ещё не подгружен, поэтому тоже нужен повтор, а не
   * одна попытка). Само добавление в MAIN идемпотентно (см. core.ts), так
   * что повторный опрос после уже случившегося успеха — безопасный no-op.
   */
  async function pollAddPrice(attempt: number) {
    if (destroyed || !pricePollActive) return;

    const res = await sendRequest({ kind: 'ADD_LISTING_PRICE', listingIntent: listingIntent as ListingIntent, keys, metal });
    if (destroyed || !pricePollActive) return;

    if (res?.kind === 'ADD_LISTING_PRICE' && res.satisfied === true) return; // тихий успех
    if (attempt < CHECK_MAX_ATTEMPTS) {
      pricePollTimer = window.setTimeout(() => void pollAddPrice(attempt + 1), CHECK_POLL_MS);
    } else {
      showMessage(UI[locale].priceAutoFillTimeout, 'error');
    }
  }

  function startPricePoll() {
    if (pricePollActive || !hasPriceData) return;
    pricePollActive = true;
    void pollAddPrice(1);
  }

  function stopPricePoll() {
    pricePollActive = false;
    window.clearTimeout(pricePollTimer);
  }

  /**
   * Опрос "найди и добавь мой предмет по имени объявления" — только для
   * покупки (см. `hasOwnItemByName` выше), часть автоматического режима
   * (`autoFillEnabled`), отдельной кнопки для этого нет (по ответу
   * пользователя: подбирать самим, только если совпадение однозначное —
   * см. core.ts#findOwnItemByName). 'ambiguous'/'not_found' — терминальные
   * состояния, повторять опрос нет смысла (инвентарь не пополнится сам за
   * время открытой страницы оффера); 'pending'/'locked' — временные,
   * пробуем ещё раз.
   */
  async function pollAddOwnItem(name: string, attempt: number) {
    if (destroyed || !ownItemPollActive) return;

    const res = await sendRequest({ kind: 'ADD_ITEM_BY_NAME', itemName: name });
    if (destroyed || !ownItemPollActive) return;

    const state = res?.kind === 'ADD_ITEM_BY_NAME' ? res.state : 'pending';
    if (state === 'added') return; // тихий успех
    if (state === 'ambiguous') {
      showMessage(UI[locale].ambiguousOwnItem, 'info');
      return;
    }
    if (state === 'not_found') {
      showMessage(UI[locale].ownItemNotFound, 'error');
      return;
    }
    if (attempt < CHECK_MAX_ATTEMPTS) {
      ownItemPollTimer = window.setTimeout(() => void pollAddOwnItem(name, attempt + 1), CHECK_POLL_MS);
    } else {
      showMessage(UI[locale].ownItemTimeout, 'error');
    }
  }

  function startOwnItemPoll() {
    if (ownItemPollActive || !hasOwnItemByName || !itemName) return;
    ownItemPollActive = true;
    void pollAddOwnItem(itemName, 1);
  }

  function stopOwnItemPoll() {
    ownItemPollActive = false;
    window.clearTimeout(ownItemPollTimer);
  }

  function applyOptions(opts: AutoFillPanelOptions) {
    if (opts.priceButtonEnabled) showButton();
    else hideButton();

    if (opts.autoFillEnabled) {
      startItemPoll();
      startPricePoll();
      startOwnItemPoll();
    } else {
      stopItemPoll();
      stopPricePoll();
      stopOwnItemPoll();
    }
  }

  applyOptions(options);

  return {
    destroy: () => {
      destroyed = true;
      stopItemPoll();
      stopPricePoll();
      stopOwnItemPoll();
      window.clearTimeout(messageTimer);
      root.remove();
    },
    setOptions: (next) => {
      if (destroyed) return;
      applyOptions(next);
    },
  };
}
