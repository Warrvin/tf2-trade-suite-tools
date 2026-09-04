import { METAL_NAME_BY_KIND, METAL_SCRAP_VALUE, refinedValueToScrap } from './currency';
import type { SteamEconItem } from './item-attributes';

/**
 * Общие MAIN-world примитивы для работы со страницей трейд-оффера Steam
 * (`window.g_rgCurrentTradeStatus`, `g_rg(Partner)AppContextData` и т.д.) —
 * вынесены сюда из `modules/quick-add-items/core.ts`, когда тот же самый
 * код понадобился второй раз, модулю `auto-fill-from-listing` (оба читают/
 * пишут в оффер, оба ищут ключи/металл в инвентаре по фильтру) — требование
 * 4 ("не повторять функционал"), см. utils/registry.ts. Портировано из
 * Steam Trade Offer Enhancer (juliarose/steam-trade-offer-enhancer,
 * src/js/steamcommunity.com.tradeoffer.js) — см. README за подробным
 * разбором обоих модулей и историей багов, найденных при портировании
 * `quick-add-items`.
 *
 * ISOLATED-половины обоих модулей этот файл не видят и не импортируют — он
 * целиком MAIN-only (использует `window`-глобали, недоступные вне MAIN
 * world), как и раньше.
 */

export const TF2_APPID = '440';
export const TF2_CONTEXTID = '2';

/** Минимальная форма предмета из window.g_rg(Partner)AppContextData, нужная
 *  для сбора и добавления в оффер (id/appid/contextid плюс то, что уже есть
 *  в SteamEconItem — market_hash_name и т.д., см. utils/item-attributes.ts). */
export interface TradeInventoryItem extends SteamEconItem {
  id: string;
  appid: string | number;
  contextid: string | number;
  is_stackable?: boolean;
  is_their_item?: boolean;
}

export interface SteamAppContextData {
  [appid: string]: {
    rgContexts?: {
      [contextid: string]: {
        inventory?: {
          rgInventory?: Record<string, TradeInventoryItem>;
        };
      };
    };
  };
}

export interface TradeStatusAsset {
  appid: string | number;
  contextid: string | number;
  assetid: string;
  amount?: number | string;
}
export interface TradeStatusSide {
  assets: TradeStatusAsset[];
  currency: TradeStatusAsset[];
  ready?: boolean;
}
export interface SteamCurrentTradeStatus {
  version: number;
  me: TradeStatusSide;
  them: TradeStatusSide;
}

/**
 * `m_bChangesMade` — единственное поле отсюда, которое реально используется
 * (просто флаг "что-то поменялось"). `RemoveItemsFromTrade` сюда сознательно
 * не включён: см. README/modules/quick-add-items/core.ts#clearSide — на это
 * внутреннее API больше не полагаемся (баг-репорт пользователя, кнопки
 * "Очистить" не работали).
 */
export interface SteamTradeStateManager {
  m_bChangesMade: boolean;
}

/** Форма window на /tradeoffer/* — те функции/глобали Steam, которыми
 *  оригинальный скрипт напрямую управляет состоянием оффера (в MAIN world
 *  видны как обычные глобальные переменные страницы). Общая для всех
 *  MAIN-модулей страницы оффера, которым нужно не только читать, но и
 *  менять состояние (сейчас — quick-add-items и auto-fill-from-listing). */
export interface TradeOfferWindow {
  g_rgAppContextData?: SteamAppContextData;
  g_rgPartnerAppContextData?: SteamAppContextData;
  g_rgCurrentTradeStatus?: SteamCurrentTradeStatus;
  GTradeStateManager?: SteamTradeStateManager;
  RefreshTradeStatus?: (status: SteamCurrentTradeStatus, force?: boolean) => void;
  BIsInTradeSlot?: (el: HTMLElement) => boolean;
  Economy_UseResponsiveLayout?: () => boolean;
  ResponsiveTrade_SwitchMode?: (mode: number) => void;
}

export interface CollectResult {
  items: HTMLElement[];
  satisfied: boolean;
}

export function getYourSlots(): HTMLElement | null {
  return document.getElementById('your_slots');
}
export function getTheirSlots(): HTMLElement | null {
  return document.getElementById('their_slots');
}

export function isElementVisible(el: HTMLElement | null): boolean {
  return !!el && el.offsetParent !== null;
}

/** Аналог jQuery `.inventory_ctn:visible` — сейчас отображаемая панель инвентаря
 *  (своего/партнёра/конкретной игры — какая вкладка выбрана прямо сейчас). */
export function getVisibleInventoryContainer(): HTMLElement | null {
  const containers = document.querySelectorAll<HTMLElement>('.inventory_ctn');
  for (const el of containers) {
    if (isElementVisible(el)) return el;
  }
  return null;
}

/** Предмет виден на экране — сам .item не несёт display:none, это делает родитель. */
export function isItemElementVisible(el: HTMLElement): boolean {
  return el.parentElement?.style.display !== 'none';
}

/**
 * Можно ли сейчас менять оффер — портировано из `addItems`' `canModify`.
 * Ложно, когда оффер уже отправлен и Steam показывает только кнопку
 * "Change offer" вместо редактируемых слотов.
 */
export function canModifyOffer(): boolean {
  const inventory = getVisibleInventoryContainer();
  const hasVisibleInventoryWithId = !!inventory && /(\d+)_(\d+)$/.test(inventory.id);
  const anyModifyTradeOfferVisible = [...document.querySelectorAll<HTMLElement>('div.modify_trade_offer')].some(isElementVisible);
  const changeOfferButton = document.querySelector<HTMLElement>('#modify_trade_offer_opts div.content');

  return (hasVisibleInventoryWithId || !anyModifyTradeOfferVisible) && !isElementVisible(changeOfferButton);
}

export function getInventory(win: TradeOfferWindow, isYou: boolean): Record<string, TradeInventoryItem> {
  const source = isYou ? win.g_rgAppContextData : win.g_rgPartnerAppContextData;
  return source?.[TF2_APPID]?.rgContexts?.[TF2_CONTEXTID]?.inventory?.rgInventory ?? {};
}

/** assetId предметов TF2, уже лежащих в слотах данной стороны оффера. */
export function getSlotAssetIds(isYou: boolean): Set<string> {
  const container = isYou ? getYourSlots() : getTheirSlots();
  const result = new Set<string>();
  container?.querySelectorAll<HTMLElement>('.item').forEach((el) => {
    const rgItem = (el as unknown as { rgItem?: { id?: string; appid?: string | number } }).rgItem;
    if (rgItem?.id !== undefined && String(rgItem.appid) === TF2_APPID) result.add(String(rgItem.id));
  });
  return result;
}

/**
 * Сдвигает индекс так, чтобы набрать `amount` предметов, даже если начиная
 * ровно с `index` их не хватает до конца списка — портировано дословно
 * (`offsetIndex`), багов здесь не было.
 */
export function offsetIndex(index: number, amount: number, length: number): number {
  if (index < 0) return Math.max(0, length - (amount + index + 1));
  if (index + amount >= length) return Math.max(0, length - amount);
  return index;
}

/**
 * Выбирает до `amount` предметов одной стороны, подходящих под `filter`,
 * начиная с позиции `index` среди подходящих (не среди всех) предметов.
 *
 * ИСПРАВЛЕННЫЙ БАГ оригинала: там подстраховка "не хватило по индексу — сдвинь
 * назад и возьми что есть" была `if (items < amount)` — сравнение МАССИВА с
 * числом, из-за приведения типов результат JS-выражения истинен только когда
 * items ПУСТОЙ (`[].toString() === ''` → `0 < amount`), а не когда его длина
 * меньше amount, как явно задумано по соседнему комментарию/логике. Здесь —
 * `items.length < amount`, как и должно быть.
 */
export function pickItemsForSide(
  win: TradeOfferWindow,
  isYou: boolean,
  amount: number,
  index: number,
  filter: (item: TradeInventoryItem) => boolean
): TradeInventoryItem[] {
  const inventory = getInventory(win, isYou);
  const addedIds = getSlotAssetIds(isYou);
  const ids = Object.keys(inventory);

  let idx = index;
  if (idx < 0) {
    idx = (idx + 1) * -1;
    ids.reverse();
  }

  const total: TradeInventoryItem[] = [];
  let items: TradeInventoryItem[] = [];
  let currentIndex = 0;

  for (const id of ids) {
    const item = inventory[id];
    if (addedIds.has(id)) {
      if (idx !== 0 && filter(item)) currentIndex++;
      continue;
    }
    if (items.length >= amount) break;
    if (filter(item)) {
      if (currentIndex >= idx) items.push(item);
      total.push(item);
      currentIndex++;
    }
  }

  if (items.length < amount) {
    const offset = offsetIndex(idx, amount, total.length);
    items = total.slice(offset, offset + amount);
  }

  return items;
}

export function getElementsForItems(items: TradeInventoryItem[]): HTMLElement[] {
  return items
    .map((item) => document.getElementById(`item${item.appid}_${item.contextid}_${item.id}`))
    .filter((el): el is HTMLElement => el !== null);
}

/** Ищет до `amount` ключей (Mann Co. Supply Crate Key) — общий фильтр,
 *  которым пользуются и кнопка "Ключи" в quick-add-items, и добавление
 *  цены листинга в auto-fill-from-listing. */
export function findKeys(win: TradeOfferWindow, isYou: boolean, amount: number, index: number): CollectResult {
  const filter = (item: TradeInventoryItem) => String(item.appid) === TF2_APPID && item.market_hash_name === 'Mann Co. Supply Crate Key';
  const found = pickItemsForSide(win, isYou, amount, index, filter);
  const items = getElementsForItems(found);
  return { items, satisfied: amount === items.length };
}

/**
 * Набирает металл на сумму `targetScrap` (целое число, минимальная единица
 * металла в TF2 — см. utils/currency.ts) — жадно, от Refined к Scrap,
 * портировано из `getItemsForMetal`. Целочисленный scrap, а не ref в
 * параметрах — намеренно: `auto-fill-from-listing` считает "сколько ещё не
 * хватает" сам (см. её core.ts#getCurrentCurrency) и передаёт остаток
 * СРАЗУ в scrap, без обратного перевода в ref и назад — лишний
 * ref->scrap->ref круг открывает дверь для ошибок округления там, где их
 * не должно быть в принципе (это же не то, что ввёл пользователь, а уже
 * точно известное целое число).
 */
export function getItemsForMetalByScrap(win: TradeOfferWindow, isYou: boolean, targetScrap: number, index: number): CollectResult {
  let totalScrap = 0;
  const collected: TradeInventoryItem[] = [];
  const order: Array<'refined' | 'reclaimed' | 'scrap'> = ['refined', 'reclaimed', 'scrap'];

  for (const kind of order) {
    if (totalScrap === targetScrap) break;
    const value = METAL_SCRAP_VALUE[kind];
    const amountToAdd = Math.floor((targetScrap - totalScrap) / value);
    if (amountToAdd <= 0) continue;

    const name = METAL_NAME_BY_KIND[kind];
    const filter = (item: TradeInventoryItem) => String(item.appid) === TF2_APPID && item.market_hash_name === name;
    const found = pickItemsForSide(win, isYou, amountToAdd, index, filter);
    const amountAdded = Math.min(amountToAdd, found.length);

    totalScrap += amountAdded * value;
    collected.push(...found);
  }

  return { items: getElementsForItems(collected), satisfied: totalScrap === targetScrap };
}

/**
 * Набирает металл на сумму `amountRef` (в ref, дробное — то, что ввёл
 * пользователь в поле "amount" кнопки "Металл") — обёртка над
 * `getItemsForMetalByScrap` выше, переводит ref в scrap через
 * utils/currency.ts#refinedValueToScrap (общая арифметика, требование 4).
 */
export function getItemsForMetal(win: TradeOfferWindow, isYou: boolean, amountRef: number, index: number): CollectResult {
  return getItemsForMetalByScrap(win, isYou, refinedValueToScrap(amountRef), index);
}

/**
 * Добавляет уже НАЙДЕННЫЕ элементы предметов в оффер — портировано из
 * `addItemsByElements`. Читает `elItem.rgItem` — JS-свойство, которое сам
 * Steam вешает на DOM-узел предмета (не HTML-атрибут); видно ТОЛЬКО из
 * MAIN world, тот же реалм, что и у собственных скриптов страницы — поэтому
 * вызывающий entrypoint обязан исполняться с `world: 'MAIN'`.
 */
export function addItemsByElements(win: TradeOfferWindow, itemsList: HTMLElement[]): void {
  if (win.Economy_UseResponsiveLayout?.() && win.ResponsiveTrade_SwitchMode) {
    win.ResponsiveTrade_SwitchMode(0);
  }

  const status = win.g_rgCurrentTradeStatus;
  const stateManager = win.GTradeStateManager;
  if (!status || !stateManager) return;

  const slotsCache: Record<'me' | 'them', Record<string, number>> = { me: {}, them: {} };
  let changed = false;

  for (const elItem of itemsList) {
    if (win.BIsInTradeSlot?.(elItem)) continue;

    const item = (elItem as unknown as { rgItem?: TradeInventoryItem }).rgItem;
    if (!item || item.is_stackable) continue;

    const cacheKey: 'me' | 'them' = item.is_their_item ? 'them' : 'me';
    const slots = status[cacheKey].assets;

    if (Object.keys(slotsCache[cacheKey]).length === 0 && slots.length > 0) {
      slots.forEach((slot, i) => {
        slotsCache[cacheKey][`${slot.appid}_${slot.contextid}_${slot.assetid}`] = i;
      });
    }

    const key = `${item.appid}_${item.contextid}_${item.id}`;
    const existingIndex = slotsCache[cacheKey][key];

    if (existingIndex !== undefined) {
      if (slots[existingIndex].amount !== 1) {
        slots[existingIndex].amount = 1;
        changed = true;
      }
    } else {
      slots.push({ appid: item.appid, contextid: item.contextid, assetid: item.id, amount: 1 });
      slotsCache[cacheKey][key] = slots.length - 1;
      changed = true;
    }
  }

  if (changed) stateManager.m_bChangesMade = true;

  status.version = (status.version ?? 0) + 1;
  win.RefreshTradeStatus?.(status);
}

/**
 * Форсит ПОЛНУЮ перерисовку (version++ и `RefreshTradeStatus(status, true)`)
 * — см. README §"Модуль `quick-add-items`", ИСПРАВЛЕНО (3)/(4), и
 * modules/quick-add-items/core.ts#clearSide за полной историей, почему это
 * именно `force: true`, а не обычный вызов.
 */
export function forceRefresh(win: TradeOfferWindow, status: SteamCurrentTradeStatus): void {
  status.version = (status.version ?? 0) + 1;
  win.RefreshTradeStatus?.(status, true);
}

/** Ждёт один кадр отрисовки — см. modules/quick-add-items/core.ts#clearSide
 *  и modules/auto-fill-from-listing/core.ts за тем, зачем это нужно между
 *  изменениями состояния оффера. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
