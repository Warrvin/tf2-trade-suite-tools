import { respondInMain } from '../../utils/bridge';
import { METAL_NAME_BY_KIND, METAL_SCRAP_VALUE, refinedValueToScrap } from '../../utils/currency';

const TF2_CURRENCY_CLASSIDS = new Set(['101785959', '2674', '5564', '2675']);
function isCurrencyEconomyKey(key: string): boolean {
  for (const cid of TF2_CURRENCY_CLASSIDS) {
    if (key.includes(`/440/${cid}/`)) return true;
  }
  return false;
}


import {
  TF2_APPID,
  TF2_CONTEXTID,
  TradeInventoryItem,
  TradeOfferWindow,
  addItems,
  addItemsByElements,
  canModifyOffer,
  findKeys,
  findKeysPrioritizingFree,
  forceRefresh,
  getElementsForItems,
  getInventory,
  getItemsForMetalByScrap,
  getItemsForMetalByScrapPrioritizingFree,
  getSlotAssetIds,
  getTheirSlots,
  isInventoryLoaded,
  nextFrame,
} from '../../utils/trade-offer';
import { AUTO_FILL_CHANNEL, AutoFillRequest, AutoFillResponse, ForItemRef, ForItemState, ListingIntent, OwnItemMatchState } from './types';

/**
 * MAIN-world "движок" автозаполнения — портирован из Steam Trade Offer
 * Enhancer (juliarose/steam-trade-offer-enhancer,
 * src/js/steamcommunity.com.tradeoffer.js: обработка `urlParams.for_item`/
 * `urlParams.listing_intent` + `addListingPrice`), см. README за разбором.
 * Общие с quick-add-items куски (поиск ключей/металла, добавление найденных
 * элементов, форс-перерисовка, типы window/оффера) — в utils/trade-offer.ts
 * (требование 4, см. её шапку); здесь только то, что специфично для этого
 * модуля: добавление конкретного предмета по assetid из ссылки и добавление
 * валюты по цене объявления.
 *
 * ПОЧЕМУ `for_item` всегда кладётся в `them.assets` (сторону партнёра), а не
 * в зависимости от listing_intent: ссылку с `for_item` backpack.tf выдаёт
 * ТОЛЬКО для объявлений на ПРОДАЖУ (у объявления на покупку нет одного
 * конкретного ассета — покупатель готов взять любой подходящий предмет,
 * который продавец выберет сам). Переход по такой ссылке всегда означает
 * "я хочу купить именно этот предмет у партнёра" — значит предмет всегда
 * лежит в инвентаре ИМЕННО партнёра, независимо от того, кто в итоге платит
 * валюту (см. ListingIntent в types.ts).
 */

function forItemKey(ref: ForItemRef): string {
  return `${ref.appid}_${ref.contextid}_${ref.assetid}`;
}

/**
 * Добавляет предмет по ссылке (если его там ещё нет) и проверяет его
 * текущую судьбу — стейтless-проверка, безопасно звать повторно на каждый
 * опрос ISOLATED-стороны (см. panel.ts), никакого состояния в MAIN между
 * вызовами не держим:
 *
 *  - 'added'   — предмет нашёлся среди уже загруженных данных инвентаря
 *    партнёра (`g_rgPartnerAppContextData`) — успех, дальше Steam сам
 *    отрисует нормальный тайл.
 *  - 'dead'    — инвентарь партнёра УЖЕ загружен (см. ниже, почему это можно
 *    утверждать раньше, чем через DOM-признак), а искомого assetId в нём
 *    нет — значит объявленный предмет уже продан/обменян. Убираем его из
 *    оффера, чтобы не оставлять пустой тайл.
 *  - 'pending' — инвентарь партнёра ещё не подгрузился, ни то ни другое
 *    пока не известно — ISOLATED опросит ещё раз чуть позже.
 *
 * Оригинал ждёт ОДНОКРАТНЫЙ колбэк `inventoryManager.register(...)`,
 * который срабатывает ровно один раз, когда контекст инвентаря партнёра
 * догрузится. У нас такого колбэка нет (ISOLATED и MAIN разделены RPC без
 * пуша от MAIN — см. utils/bridge.ts), поэтому вместо одного колбэка —
 * многократный стейтless-опрос с тем же результатом, но устойчивее к
 * гонкам (не важно, сколько раз и когда именно спросят).
 *
 * ИСПРАВЛЕННЫЙ БАГ (баг-репорт живым тестом: sell-order, где предмет из
 * ссылки НЕ добавлялся вообще без единого сообщения об ошибке — по
 * наблюдению пользователя, тот конкретный экземпляр из объявления уже не
 * в инвентаре бота, хотя другие копии того же предмета там есть). Раньше
 * "мёртвость" определялась ТОЛЬКО по DOM-признаку — Steam якобы рисует
 * тайл-заглушку со ссылкой `a[href$="_undefined"]`, когда не может
 * сопоставить assetid с реальным предметом партнёра. На практике (и это
 * подтвердил живой тест) Steam для НЕСУЩЕСТВУЮЩЕГО assetId часто вообще
 * ничего не рисует — ни нормального тайла, ни этой заглушки — поэтому
 * DOM-признак никогда не срабатывал, и опрос молча зависал в 'pending' до
 * тайм-аута без единого сообщения.
 *
 * Более надёжный признак: инвентарь партнёра (`g_rgPartnerAppContextData`)
 * Steam подгружает ЦЕЛИКОМ одним запросом на контекст (не по одному
 * предмету) — значит, если объект инвентаря по TF2-контексту уже НЕПУСТОЙ
 * (`getInventory` вернул хотя бы одну запись), то он уже полностью
 * загружен, и если искомого assetId в нём всё ещё нет — он не появится
 * никогда в рамках этой загрузки (не "ещё не успел", а гарантированно его
 * нет). Для листинга на продажу бот по определению не может иметь пустой
 * инвентарь (он же выставил хотя бы этот один предмет), так что
 * "непустой, но без нужного assetId" почти сразу отличимо от "ещё не
 * загрузился" (пустой). DOM-признак оставлен как ДОПОЛНИТЕЛЬНАЯ проверка
 * (на случай редкой ситуации, когда сам Steam всё-таки рисует заглушку) —
 * теперь просто как альтернативный путь к тому же выводу, а не
 * единственный.
 */
function checkForItem(win: TradeOfferWindow, ref: ForItemRef, itemName?: string): ForItemState {
  const status = win.g_rgCurrentTradeStatus;
  if (!status) return 'pending';

  const key = forItemKey(ref);
  const already = status.them.assets.some((a) => `${a.appid}_${a.contextid}_${a.assetid}` === key);
  ensurePartnerInventoryLoading(win);

  const inventoryLoaded = isInventoryLoaded(win, false);
  const inventory = getInventory(win, false);

  // 1. Пока инвентарь партнёра ещё не загрузился — ждём (не объявляем 'dead' раньше времени!)
  if (!inventoryLoaded) {
    if (!already) {
      status.them.assets.push({ appid: Number(ref.appid), contextid: String(ref.contextid), assetid: String(ref.assetid), amount: 1 });
      if (win.GTradeStateManager) win.GTradeStateManager.m_bChangesMade = true;
      forceRefresh(win, status);
    }
    return 'pending';
  }

  // --- ИНВЕНТАРЬ ЗАГРУЖЕН ---

  // 2. Точный экземпляр по assetid найден в инвентаре партнёра
  if (inventory[ref.assetid]) {
    if (!already) {
      status.them.assets.push({ appid: Number(ref.appid), contextid: String(ref.contextid), assetid: String(ref.assetid), amount: 1 });
      if (win.GTradeStateManager) win.GTradeStateManager.m_bChangesMade = true;
      forceRefresh(win, status);
    } else {
      // Форсируем обновление, чтобы Steam связал загруженные описания со слотом
      forceRefresh(win, status);
    }
    return 'added';
  }

  // 3. Точного assetid нет, но в слотах партнёра УЖЕ лежит подходящий предмет (подставленный ранее альтернативный экземпляр)
  if (itemName) {
    const themSlotIds = getSlotAssetIds(false);
    const hasMatchingInSlot = Object.values(inventory).some(
      (item) => themSlotIds.has(String(item.id)) && isMatchItem(item, itemName),
    );
    if (hasMatchingInSlot) {
      return 'added';
    }
  }

  // 4. Точного assetid нет — ищем другой доступный экземпляр того же предмета по названию
  if (itemName) {
    const themSlotIds = getSlotAssetIds(false);
    const matches = Object.values(inventory).filter(
      (item) => !themSlotIds.has(String(item.id)) && isMatchItem(item, itemName),
    );

    if (matches.length > 0) {
      // Убираем устаревший assetid из слотов
      status.them.assets = status.them.assets.filter((a) => `${a.appid}_${a.contextid}_${a.assetid}` !== key);
      const fallbackItem = matches[0];
      status.them.assets.push({
        appid: Number(fallbackItem.appid ?? ref.appid),
        contextid: String(fallbackItem.contextid ?? ref.contextid),
        assetid: String(fallbackItem.id),
        amount: 1,
      });
      if (win.GTradeStateManager) win.GTradeStateManager.m_bChangesMade = true;
      forceRefresh(win, status);
      return 'added';
    }
  }

  // 5. Инвентарь точно загружен, и ни точного assetid, ни альтернативного предмета с таким названием нет
  status.them.assets = status.them.assets.filter((a) => `${a.appid}_${a.contextid}_${a.assetid}` !== key);
  forceRefresh(win, status);
  return 'dead';
}

/**
 * Сколько валюты УЖЕ лежит в слотах данной стороны — по имени каждого
 * ассета через тот же инвентарь, которым пользуется поиск (`getInventory`).
 * Нужно, чтобы `addListingPrice` ниже был идемпотентным (см. её комментарий
 * про два независимых способа его вызвать) — добавляет только НЕДОСТАЮЩЕЕ,
 * а не всегда полную цену объявления заново.
 */
function getCurrentCurrency(win: TradeOfferWindow, isYou: boolean): { keys: number; metalScrap: number } {
  const status = win.g_rgCurrentTradeStatus;
  const side = isYou ? status?.me : status?.them;
  if (!side) return { keys: 0, metalScrap: 0 };

  const inventory = getInventory(win, isYou);
  let keys = 0;
  let metalScrap = 0;

  for (const asset of side.assets) {
    const item: TradeInventoryItem | undefined = inventory[asset.assetid];
    const name = item?.market_hash_name;
    if (!name) continue;

    if (name === 'Mann Co. Supply Crate Key') {
      keys++;
      continue;
    }
    for (const kind of ['refined', 'reclaimed', 'scrap'] as const) {
      if (name === METAL_NAME_BY_KIND[kind]) {
        metalScrap += METAL_SCRAP_VALUE[kind];
        break;
      }
    }
  }

  return { keys, metalScrap };
}

/**
 * Сколько валюты ДОСТУПНО для добавления в оффер прямо сейчас — то же, что
 * и getCurrentCurrency, но считает НЕ то, что уже лежит в слотах оффера, а
 * то, что ЕЩЁ можно оттуда взять: весь инвентарь этой стороны за вычетом
 * уже добавленных в слоты ассетов (см. getSlotAssetIds в utils/trade-offer.ts
 * — тот же набор "уже использовано", которым пользуется pickItemsForSide,
 * чтобы не предлагать дважды один и тот же предмет).
 *
 * Нужна ТОЛЬКО для проверки нехватки ниже (см. addListingPrice) — в отличие
 * от getCurrentCurrency (что уже В оффере), это "что ЕЩЁ есть в инвентаре
 * и можно добавить".
 */
function countAvailableCurrency(win: TradeOfferWindow, isYou: boolean): { keys: number; metalScrap: number } {
  const inventory = getInventory(win, isYou);
  const addedIds = getSlotAssetIds(isYou);
  let keys = 0;
  let metalScrap = 0;

  for (const id of Object.keys(inventory)) {
    if (addedIds.has(id)) continue;
    const name = inventory[id]?.market_hash_name;
    if (!name) continue;

    if (name === 'Mann Co. Supply Crate Key') {
      keys++;
      continue;
    }
    for (const kind of ['refined', 'reclaimed', 'scrap'] as const) {
      if (name === METAL_NAME_BY_KIND[kind]) {
        metalScrap += METAL_SCRAP_VALUE[kind];
        break;
      }
    }
  }

  return { keys, metalScrap };
}

/**
 * Добавляет валюту по цене объявления — портировано из `addListingPrice`/
 * `addCurrencies`. `isYou`: см. ListingIntent в types.ts — при объявлении на
 * продажу (1) платим МЫ (предмет уже добавлен из партнёра выше), при
 * объявлении на покупку (0) платит ПАРТНЁР (а предмет для продажи
 * пользователь добавляет сам, например кнопкой "Добавить" из
 * quick-add-items).
 *
 * ИДЕМПОТЕНТНО (важно): этот вызов теперь достижим ДВУМЯ независимыми
 * путями — кнопкой "Добавить цену объявления" (`listing-price-button`,
 * включается отдельно) и автоматическим опросом при включённом
 * `auto-fill-from-listing` (см. panel.ts) — оба могут быть включены
 * ОДНОВРЕМЕННО, и пользователь может нажать кнопку уже ПОСЛЕ того, как
 * автозаполнение само всё добавило. Если бы функция каждый раз добавляла
 * ПОЛНУЮ цену заново (как в оригинале — там кнопка ровно одна, повторного
 * пути не было), второй вызов удвоил бы валюту в оффере: `pickItemsForSide`
 * не находит уже добавленные ассеты повторно, значит просто взял бы ЕЩЁ
 * столько же новых. Поэтому сначала считаем, сколько уже лежит в слотах
 * (`getCurrentCurrency`), и добавляем только НЕДОСТАЮЩЕЕ — повторный
 * вызов, когда всё уже добавлено, безопасный no-op (`satisfied: true`
 * сразу, никаких новых предметов).
 *
 * ИСПРАВЛЕННЫЙ БАГ (баг-репорт живым тестом: в buy orders валюта партнёра
 * добавлялась "через раз" — иногда срабатывало, иногда нет, без видимой
 * закономерности). Раньше `satisfied` вычислялся из того, НАШЛИСЬ ЛИ вообще
 * DOM-элементы нужных предметов (`findKeys`/`getItemsForMetalByScrap` ищут
 * по данным инвентаря `g_rgPartnerAppContextData` и проверяют только, что
 * `document.getElementById(...)` не вернул null) — но найденный элемент ещё
 * не значит, что Steam уже успел повесить на него `rgItem` (см.
 * `addItemsByElements` в utils/trade-offer.ts — если `elItem.rgItem`
 * не готов, элемент молча пропускается, ничего не добавляется). Для СВОЕГО
 * инвентаря это никогда не проявлялось (оно загружено задолго до первого
 * взаимодействия), а для инвентаря ПАРТНЁРА — вполне: наш автоопрос
 * реагирует на данные (`g_rgPartnerAppContextData`) сразу, как только они
 * появились, а сама отрисовка тайлов (и простановка `rgItem`) — отдельный,
 * не обязательно синхронный шаг рендера Steam, между которыми есть зазор.
 * Раньше в этот зазор можно было попасть и получить `satisfied: true`, хотя
 * реально не добавилось НИЧЕГО (или добавилось частично).
 *
 * Исправление: вместо того чтобы верить "элементы нашлись — значит
 * добавилось", проверяем РЕАЛЬНЫЙ результат — считаем текущую валюту в
 * слотах ДО и ПОСЛЕ попытки (`getCurrentCurrency`, тот же источник правды,
 * что и для расчёта недостачи) и сравниваем с целью. Если что-то не
 * добавилось из-за этого зазора, `satisfied` теперь честно будет `false`, и
 * автоопрос (см. panel.ts#pollAddPrice) просто попробует ещё раз через
 * секунду — к тому моменту Steam обычно уже успевает довесить `rgItem`.
 */
let lastRequestedPartnerId: string | number | null = null;
let lastPartnerInventoryLoadTime = 0;

function ensurePartnerInventoryLoading(win: TradeOfferWindow): void {
  const winAny = win as unknown as Record<string, any>;
  const userThem = winAny.UserThem;
  if (!userThem) return;

  const currentPartnerId = win.g_ulTradePartnerSteamID ?? userThem.strSteamId ?? 'unknown';
  if (lastRequestedPartnerId !== currentPartnerId) {
    lastRequestedPartnerId = currentPartnerId;
    lastPartnerInventoryLoadTime = 0;
  }

  const tf2Context = userThem.rgContexts?.[TF2_APPID]?.[TF2_CONTEXTID];
  const inv = tf2Context?.inventory;

  // 1. Уже загружен
  if (inv?.m_bLoaded || (inv?.rgInventory && Object.keys(inv.rgInventory).length > 0)) {
    return;
  }

  // 2. В процессе загрузки Steam'ом
  if (inv?.m_bLoading) {
    return;
  }

  // 3. Защита от спама (не чаще одного запроса в 15 секунд)
  const now = Date.now();
  if (now - lastPartnerInventoryLoadTime < 15000) {
    return;
  }
  lastPartnerInventoryLoadTime = now;

  try {
    if (typeof userThem.loadInventory === 'function') {
      userThem.loadInventory(440, 2);
    } else if (typeof userThem.getInventory === 'function') {
      userThem.getInventory(440, 2);
    }
  } catch (e) {
    console.warn('[AutoFill] Failed to request partner inventory:', e);
  }
}

async function addListingPrice(
  win: TradeOfferWindow,
  listingIntent: ListingIntent,
  keys: number,
  metal: number,
  committedAssetIds?: string[],
  committedEconomyKeys?: string[],
): Promise<boolean | null> {
  if (keys <= 0 && metal <= 0) return true; // нечего добавлять — не ошибка

  const isYou = listingIntent === 1;
  if (!isYou) {
    ensurePartnerInventoryLoading(win);
    if (!isInventoryLoaded(win, false)) {
      return false; // инвентарь партнёра ещё подгружается из Steam
    }
  }

  const targetScrap = metal > 0 ? refinedValueToScrap(metal) : 0;
  const current = getCurrentCurrency(win, isYou);
  const neededKeys = Math.max(0, keys - current.keys);
  const neededScrap = Math.max(0, targetScrap - current.metalScrap);

  if (neededKeys === 0 && neededScrap === 0) return true; // уже полностью добавлено — см. комментарий выше

  /**
   * ИСПРАВЛЕНО (баг-репорт пользователя): если валюты для полной цены
   * объявления НЕ ХВАТАЕТ ЦЕЛИКОМ, не добавлять её ЧАСТИЧНО — предмет по
   * ссылке (for_item/findOwnItemByName) при этом всё равно добавляется как
   * обычно, эта проверка касается ТОЛЬКО валюты.
   *
   * Раньше при нехватке функция всё равно клала в оффер всё, что нашла
   * (findKeys/getItemsForMetalByScrap просто берут сколько есть, до
   * `amountToAdd`), даже если это заведомо меньше нужного — а автоопрос
   * (см. panel.ts#pollAddPrice) повторял попытку до 20 раз, каждый раз
   * пытаясь добавить ещё, до итогового тайм-аута с ошибкой. Результат —
   * реальная валюта уже ушла в слоты оффера, хотя сделка всё равно не
   * могла состояться по этой цене целиком.
   *
   * Проверяем ТОЛЬКО свою сторону (isYou): именно тогда валюта берётся из
   * инвентаря ПОЛЬЗОВАТЕЛЯ (см. прямую просьбу — "чтобы не добавляло из
   * моего инвентаря"). Когда платит партнёр (isYou === false), инвентарь,
   * из которого берётся валюта, не наш — частичное добавление там такого
   * риска не несёт, поведение для этого случая не меняется.
   */
  if (isYou) {
    const available = countAvailableCurrency(win, true);
    if (available.keys < neededKeys || available.metalScrap < neededScrap) {
      return false;
    }
  }

  // Множество занятых предметов в активных офферах (учитываем только при отдаче своих предметов)
  const committedSet = new Set<string>(isYou ? (committedAssetIds ?? []) : []);
  if (isYou) {
    document
      .querySelectorAll<HTMLElement>('#your_slots div.item[data-tf2s-committed], #inventory_box div.item[data-tf2s-committed]')
      .forEach((el) => {
        const match = el.id.match(/^item440_2_(\d+)$/);
        if (match) committedSet.add(match[1]);
      });
  }

  const elements: HTMLElement[] = [];
  const invItems: TradeInventoryItem[] = [];

  if (neededKeys > 0) {
    const r = findKeysPrioritizingFree(win, isYou, neededKeys, 0, isYou ? committedSet : undefined);
    elements.push(...r.items);
    if (r.inventoryItems) invItems.push(...r.inventoryItems);
  }
  if (neededScrap > 0) {
    const r = getItemsForMetalByScrapPrioritizingFree(win, isYou, neededScrap, 0, isYou ? committedSet : undefined);
    elements.push(...r.items);
    if (r.inventoryItems) invItems.push(...r.inventoryItems);
  }

  for (const item of invItems) {
    item.is_their_item = !isYou;
    item.appid = item.appid ?? 440;
    item.contextid = item.contextid ?? 2;
  }

  addItems(win, { items: elements, inventoryItems: invItems, satisfied: true });
  await nextFrame();

  // Не верим тому, что НАШЛИСЬ элементы — проверяем, что реально осело в
  // слотах (см. комментарий выше про rgItem-гонку).
  const after = getCurrentCurrency(win, isYou);
  return after.keys >= keys && after.metalScrap >= targetScrap;
}

/**
 * Проверяет, задействован ли конкретный предмет инвентаря в других активных офферах.
 */
function isItemCommitted(
  item: TradeInventoryItem,
  committedAssetIds?: Set<string>,
  committedEconomyKeys?: Set<string>,
): boolean {
  const idStr = String(item.id);
  if (committedAssetIds?.has(idStr)) return true;

  if (committedEconomyKeys && item.classid) {
    const econKey = `classinfo/${item.appid}/${item.classid}/${item.instanceid ?? '0'}`;
    if (!isCurrencyEconomyKey(econKey) && committedEconomyKeys.has(econKey)) {
      return true;
    }
  }

  const el = document.getElementById(`item${item.appid}_${item.contextid}_${item.id}`);
  if (el?.hasAttribute('data-tf2s-committed')) {
    return true;
  }

  return false;
}

function normalizeItemName(name: string): string {
  return name
    .trim()
    .replace(/[\u2018\u2019\u02BC\u2032`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*Level\s+\d+[^)]*\)/gi, '')
    .replace(/\s*#\d+$/g, '')
    .trim();
}

function isItemNameMatch(rawCandidateName: string | undefined, rawTargetName: string): boolean {
  if (!rawCandidateName || !rawTargetName) return false;
  if (rawCandidateName === rawTargetName) return true;

  const normCandidate = normalizeItemName(rawCandidateName);
  const normTarget = normalizeItemName(rawTargetName);

  if (normCandidate === normTarget) return true;
  if (normCandidate.toLowerCase() === normTarget.toLowerCase()) return true;

  const stripThe = (s: string) => s.replace(/^the\s+/i, '').trim();
  if (stripThe(normCandidate).toLowerCase() === stripThe(normTarget).toLowerCase()) return true;

  return false;
}

function isItemUncraftable(item: TradeInventoryItem): boolean {
  if (!item.descriptions || !Array.isArray(item.descriptions)) return false;
  return item.descriptions.some(
    (d) =>
      !d.color &&
      /^\(\s*(?:Not.*Usable in Crafting|Нельзя использовать в ковке|Нельзя ковать)/i.test(d.value),
  );
}

function isMatchItem(item: TradeInventoryItem, rawTargetName: string): boolean {
  if (!rawTargetName) return false;

  const targetIsUncraft = /^(?:Non-Craftable|Non-Craft|Uncraftable)\s+/i.test(rawTargetName);
  const targetCleanName = rawTargetName.replace(/^(?:Non-Craftable|Non-Craft|Uncraftable)\s+/i, '');

  const candidateIsUncraft = isItemUncraftable(item);

  // Если в целевом названии из объявления указано Non-Craftable, требуем соответствия крафтовости
  if (targetIsUncraft !== candidateIsUncraft) {
    return false;
  }

  const hashName = item.market_hash_name || '';
  const name = item.name || '';

  return isItemNameMatch(hashName, targetCleanName) || isItemNameMatch(name, targetCleanName);
}

/**
 * Ищет СВОЙ предмет по названию из объявления и, если совпадение
 * однозначное, добавляет его в оффер.
 *
 * Сначала выбирает среди свободных (незанятых) предметов. Если свободных предметов
 * нет вовсе, но есть ровно один занятый — выбирает его.
 */
function findOwnItemByName(
  win: TradeOfferWindow,
  itemName: string,
  committedAssetIds?: Set<string>,
  committedEconomyKeys?: Set<string>,
): OwnItemMatchState {
  const inventory = getInventory(win, true);
  if (Object.keys(inventory).length === 0) return 'pending';

  const addedIds = getSlotAssetIds(true);

  // Если подходящий предмет УЖЕ лежит в слотах нашего предложения — это успех
  const alreadyInSlots = Object.values(inventory).some(
    (item) => addedIds.has(String(item.id)) && isMatchItem(item, itemName),
  );
  if (alreadyInSlots) {
    return 'added';
  }

  const matches = Object.values(inventory).filter(
    (item) => !addedIds.has(String(item.id)) && isMatchItem(item, itemName),
  );

  if (matches.length === 0) return 'not_found';

  // Разделяем найденные предметы на свободные и занятые в других офферах
  const freeMatches = matches.filter((item) => !isItemCommitted(item, committedAssetIds, committedEconomyKeys));
  const busyMatches = matches.filter((item) => isItemCommitted(item, committedAssetIds, committedEconomyKeys));

  let chosenItem: TradeInventoryItem | null = null;

  if (freeMatches.length === 1) {
    // Ровно один свободный предмет — выбираем его
    chosenItem = freeMatches[0];
  } else if (freeMatches.length > 1) {
    // Несколько свободных предметов с таким названием — неоднозначно
    return 'ambiguous';
  } else {
    // Свободных предметов нет вовсе: подбираем занятый, если он ровно один
    if (busyMatches.length === 1) {
      chosenItem = busyMatches[0];
    } else if (busyMatches.length > 1) {
      return 'ambiguous';
    } else {
      return 'not_found';
    }
  }

  // Гарантируем обязательные поля для добавления в оффер
  chosenItem.appid = chosenItem.appid ?? 440;
  chosenItem.contextid = chosenItem.contextid ?? 2;
  chosenItem.is_their_item = false;

  const elements = getElementsForItems([chosenItem]);
  addItems(win, { items: elements, inventoryItems: [chosenItem], satisfied: true });
  return 'added';
}

/**
 * Защита от гонки между ДВУМЯ независимыми путями вызова ADD_LISTING_PRICE
 * (кнопка и автоопрос — см. types.ts про два тумблера): если запрос уже
 * выполняется, второй не запускает СВОЙ отдельный расчёт "сколько не
 * хватает" (который в теории мог бы устареть ровно на середине первого
 * `await`), а просто ждёт результата уже идущего. `addListingPrice` и без
 * этого идемпотентен на СЛЕДУЮЩИЙ вызов — это только про два вызова
 * ОДНОВРЕМЕННО.
 */
let addListingPriceInFlight: Promise<boolean | null> | null = null;
function addListingPriceGuarded(
  win: TradeOfferWindow,
  listingIntent: ListingIntent,
  keys: number,
  metal: number,
  committedAssetIds?: string[],
  committedEconomyKeys?: string[],
): Promise<boolean | null> {
  if (addListingPriceInFlight) return addListingPriceInFlight;
  addListingPriceInFlight = addListingPrice(win, listingIntent, keys, metal, committedAssetIds, committedEconomyKeys).finally(() => {
    addListingPriceInFlight = null;
  });
  return addListingPriceInFlight;
}

export function registerAutoFillCoreHandler(): () => void {
  return respondInMain<AutoFillRequest, AutoFillResponse>(AUTO_FILL_CHANNEL, async (req) => {
    const win = window as unknown as TradeOfferWindow;

    if (req.kind === 'CHECK_FOR_ITEM') {
      // Модуль — только под TF2 (см. README), посторонний appid игнорируем.
      if (req.forItem.appid !== TF2_APPID || req.forItem.contextid !== TF2_CONTEXTID) {
        return { kind: 'CHECK_FOR_ITEM', state: 'dead' };
      }
      return { kind: 'CHECK_FOR_ITEM', state: checkForItem(win, req.forItem, req.itemName) };
    }

    if (req.kind === 'ADD_ITEM_BY_NAME') {
      if (!canModifyOffer()) return { kind: 'ADD_ITEM_BY_NAME', state: 'locked' };
      const committedSet = new Set<string>(req.committedAssetIds ?? []);
      const economySet = new Set<string>(req.committedEconomyKeys ?? []);
      document
        .querySelectorAll<HTMLElement>('#your_slots div.item[data-tf2s-committed], #inventory_box div.item[data-tf2s-committed]')
        .forEach((el) => {
          const match = el.id.match(/^item440_2_(\d+)$/);
          if (match) committedSet.add(match[1]);
        });
      return { kind: 'ADD_ITEM_BY_NAME', state: findOwnItemByName(win, req.itemName, committedSet, economySet) };
    }

    if (!canModifyOffer()) return { kind: 'ADD_LISTING_PRICE', satisfied: null };

    const satisfied = await addListingPriceGuarded(
      win,
      req.listingIntent,
      req.keys,
      req.metal,
      req.committedAssetIds,
      req.committedEconomyKeys,
    );
    return { kind: 'ADD_LISTING_PRICE', satisfied };
  });
}

