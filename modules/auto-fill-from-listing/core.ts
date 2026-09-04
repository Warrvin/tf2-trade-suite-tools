import { respondInMain } from '../../utils/bridge';
import { METAL_NAME_BY_KIND, METAL_SCRAP_VALUE, refinedValueToScrap } from '../../utils/currency';
import {
  TF2_APPID,
  TF2_CONTEXTID,
  TradeInventoryItem,
  TradeOfferWindow,
  addItemsByElements,
  canModifyOffer,
  findKeys,
  forceRefresh,
  getElementsForItems,
  getInventory,
  getItemsForMetalByScrap,
  getSlotAssetIds,
  getTheirSlots,
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
function checkForItem(win: TradeOfferWindow, ref: ForItemRef): ForItemState {
  const status = win.g_rgCurrentTradeStatus;
  if (!status) return 'pending';

  const key = forItemKey(ref);
  const already = status.them.assets.some((a) => `${a.appid}_${a.contextid}_${a.assetid}` === key);

  if (!already) {
    status.them.assets.push({ appid: ref.appid, contextid: ref.contextid, assetid: ref.assetid, amount: 1 });
    if (win.GTradeStateManager) win.GTradeStateManager.m_bChangesMade = true;
    forceRefresh(win, status);
    return 'pending'; // дать Steam кадр на попытку отрисовать тайл, проверим на следующем опросе
  }

  const inventory = getInventory(win, false);
  if (inventory[ref.assetid]) return 'added';

  const inventoryLoaded = Object.keys(inventory).length > 0;
  const isDeadByDom = getTheirSlots()?.querySelector('a[href$="_undefined"]') != null;

  if (inventoryLoaded || isDeadByDom) {
    status.them.assets = status.them.assets.filter((a) => `${a.appid}_${a.contextid}_${a.assetid}` !== key);
    forceRefresh(win, status);
    return 'dead';
  }

  return 'pending';
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
async function addListingPrice(win: TradeOfferWindow, listingIntent: ListingIntent, keys: number, metal: number): Promise<boolean | null> {
  if (keys <= 0 && metal <= 0) return true; // нечего добавлять — не ошибка

  const isYou = listingIntent === 1;
  const targetScrap = metal > 0 ? refinedValueToScrap(metal) : 0;
  const current = getCurrentCurrency(win, isYou);
  const neededKeys = Math.max(0, keys - current.keys);
  const neededScrap = Math.max(0, targetScrap - current.metalScrap);

  if (neededKeys === 0 && neededScrap === 0) return true; // уже полностью добавлено — см. комментарий выше

  const elements: HTMLElement[] = [];

  if (neededKeys > 0) {
    const r = findKeys(win, isYou, neededKeys, 0);
    elements.push(...r.items);
  }
  if (neededScrap > 0) {
    const r = getItemsForMetalByScrap(win, isYou, neededScrap, 0);
    elements.push(...r.items);
  }

  addItemsByElements(win, elements);
  await nextFrame();

  // Не верим тому, что НАШЛИСЬ элементы — проверяем, что реально осело в
  // слотах (см. комментарий выше про rgItem-гонку).
  const after = getCurrentCurrency(win, isYou);
  return after.keys >= keys && after.metalScrap >= targetScrap;
}

/**
 * Ищет СВОЙ предмет по названию из объявления и, если совпадение
 * однозначное, добавляет его в оффер — новая функция, по прямому запросу
 * пользователя ("хочу, чтобы автозаполнение пыталось само подобрать мой
 * предмет по названию, но только если совпадение однозначное").
 *
 * Нужна ТОЛЬКО для объявлений на ПОКУПКУ (`listingIntent === 0`): тогда
 * именно пользователь отдаёт предмет, а backpack.tf не даёт точный assetId
 * (см. шапку файла) — единственная зацепка, которую можно прочитать из
 * ссылки — `listing_item_name` (пишет `bptf-listing-trade-params`). Для
 * продажи эта функция не вызывается вовсе: там уже есть точный `for_item`.
 *
 * СОЗНАТЕЛЬНО НЕ автоматизируем неоднозначный случай. Название
 * (`market_hash_name`) — не уникальный идентификатор: у одноимённых
 * предметов могут различаться качество, killstreak-тир, spell'ы, износ —
 * это разные по ценности вещи. Если подходящих предметов в инвентаре
 * пользователя НЕСКОЛЬКО, автовыбор "на глаз" рискует отдать не тот
 * экземпляр — вместо этого возвращаем `'ambiguous'`, ISOLATED показывает
 * сообщение и ничего не трогает, выбор предмета остаётся за пользователем
 * (например, кнопкой "Добавить" из `quick-add-items`).
 *
 * `'pending'` — свой инвентарь ещё не подгрузился (на практике редко: он
 * готов почти сразу после открытия страницы, но проверяем на всякий
 * случай, тем же способом, что и `checkForItem` для инвентаря партнёра —
 * см. её комментарий) ИЛИ данные уже есть, но DOM-тайл для найденного
 * предмета ещё не отрисован (`getElementsForItems` не нашёл элемент) —
 * оба случая одинаково стоит просто повторить опрос чуть позже, а не
 * считать это отсутствием предмета.
 */
function findOwnItemByName(win: TradeOfferWindow, itemName: string): OwnItemMatchState {
  const inventory = getInventory(win, true);
  if (Object.keys(inventory).length === 0) return 'pending';

  const addedIds = getSlotAssetIds(true);
  const matches = Object.values(inventory).filter(
    (item) => item.market_hash_name === itemName && !addedIds.has(String(item.id))
  );

  if (matches.length === 0) return 'not_found';
  if (matches.length > 1) return 'ambiguous';

  const elements = getElementsForItems(matches);
  if (elements.length === 0) return 'pending'; // данные есть, тайл ещё не отрисован — не "не найдено"

  addItemsByElements(win, elements);
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
function addListingPriceGuarded(win: TradeOfferWindow, listingIntent: ListingIntent, keys: number, metal: number): Promise<boolean | null> {
  if (addListingPriceInFlight) return addListingPriceInFlight;
  addListingPriceInFlight = addListingPrice(win, listingIntent, keys, metal).finally(() => {
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
      return { kind: 'CHECK_FOR_ITEM', state: checkForItem(win, req.forItem) };
    }

    if (req.kind === 'ADD_ITEM_BY_NAME') {
      if (!canModifyOffer()) return { kind: 'ADD_ITEM_BY_NAME', state: 'locked' };
      return { kind: 'ADD_ITEM_BY_NAME', state: findOwnItemByName(win, req.itemName) };
    }

    if (!canModifyOffer()) return { kind: 'ADD_LISTING_PRICE', satisfied: null };

    const satisfied = await addListingPriceGuarded(win, req.listingIntent, req.keys, req.metal);
    return { kind: 'ADD_LISTING_PRICE', satisfied };
  });
}
