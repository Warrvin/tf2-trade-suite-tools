/**
 * Контракт RPC для модуля "Автозаполнение по ссылке с backpack.tf" — см.
 * README §"Модуль `auto-fill-from-listing`" за разбором формата ссылки.
 *
 * Ссылка на трейд-оффер, сгенерированная backpack.tf (кнопка "Trade"/цена
 * на странице classifieds/профиля), несёт в query-параметрах:
 *  - `for_item=<appid>_<contextid>_<assetid>` — какой именно предмет
 *    партнёра имелся в виду (кладётся самим backpack.tf, не расширением);
 *  - `listing_intent` — 0 (объявление на покупку) | 1 (объявление на
 *    продажу);
 *  - `listing_currencies_keys` / `listing_currencies_metal` — цена
 *    объявления в ключах/рефайнде.
 *
 * ISOLATED-половина (panel.ts) разбирает `location.search` сама (URL общий
 * для обоих миров) и присылает уже готовые значения — MAIN ничего не знает
 * про query-строку, только про состояние оффера, как и остальные модули.
 *
 * ДВА НЕЗАВИСИМЫХ ТУМБЛЕРА (по прямой просьбе пользователя, баг-репорт
 * "хочу включать по отдельности"), хотя код и канал общие:
 *  - `AUTO_FILL_FEATURE_ID` — полностью автоматический режим: сам добавляет
 *    предмет по `for_item` (только продажа), валюту по цене объявления
 *    (оба типа объявлений) И, для объявлений на ПОКУПКУ, свой предмет по
 *    `listing_item_name` — но только если совпадение в инвентаре
 *    однозначное (см. core.ts#findOwnItemByName за тем, почему неоднозначные
 *    случаи сознательно НЕ автоматизируются) — без единого клика, см.
 *    panel.ts#pollAddPrice/pollAddOwnItem.
 *  - `LISTING_PRICE_BUTTON_FEATURE_ID` — независимая от него кнопка
 *    "Добавить цену объявления": работает даже если автозаполнение
 *    выключено, и наоборот. Оба тумблера могут быть включены одновременно
 *    без риска задвоить валюту — см. core.ts#addListingPrice (идемпотентно).
 */

import type { ListingIntent } from '../../utils/listing-intent';

export const AUTO_FILL_CHANNEL = 'tf2suite:auto-fill-from-listing';
export const AUTO_FILL_FEATURE_ID = 'auto-fill-from-listing';
export const LISTING_PRICE_BUTTON_FEATURE_ID = 'listing-price-button';

export type { ListingIntent };

export interface ForItemRef {
  appid: string;
  contextid: string;
  assetid: string;
}

export type ForItemState = 'pending' | 'added' | 'dead';

/**
 * Судьба попытки найти и добавить СВОЙ предмет по имени (объявления на
 * покупку, см. core.ts#findOwnItemByName):
 *  - 'added'     — в инвентаре нашёлся РОВНО один подходящий предмет, добавлен.
 *  - 'ambiguous' — подходящих предметов НЕСКОЛЬКО (разное качество/killstreak/
 *    spell'ы и т.п.) — сознательно не выбираем сами, показываем сообщение.
 *  - 'not_found' — ни одного подходящего предмета в инвентаре нет.
 *  - 'pending'   — свой инвентарь (данные или отрисовка тайла) ещё не готов —
 *    спросят ещё раз чуть позже.
 *  - 'locked'    — оффер сейчас нельзя менять (см. canModifyOffer).
 */
export type OwnItemMatchState = 'added' | 'ambiguous' | 'not_found' | 'pending' | 'locked';

export type AutoFillRequest =
  | { kind: 'CHECK_FOR_ITEM'; forItem: ForItemRef }
  | { kind: 'ADD_LISTING_PRICE'; listingIntent: ListingIntent; keys: number; metal: number }
  | { kind: 'ADD_ITEM_BY_NAME'; itemName: string };

export type AutoFillResponse =
  | { kind: 'CHECK_FOR_ITEM'; state: ForItemState }
  | { kind: 'ADD_LISTING_PRICE'; satisfied: boolean | null }
  | { kind: 'ADD_ITEM_BY_NAME'; state: OwnItemMatchState };
