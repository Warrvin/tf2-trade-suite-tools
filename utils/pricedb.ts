import type { ItemAttributes, SteamEconItem } from './item-attributes';
import { getEffectName } from './unusual-effects';

/**
 * Интеграция с PriceDB.io (docs.pricedb.io) — публичный агрегатор цен TF2,
 * без ключа/авторизации. Три части:
 *  1. buildPriceableName — чистая функция, строит "человеческое" имя
 *     предмета в формате, который понимает их SKU-резолвер (см. ниже).
 *     Не делает сети, можно звать из MAIN world (см. core.ts).
 *  2. resolveSku/fetchPrice/lookupPrice — сетевые вызовы. ВАЖНО: их нужно
 *     звать ИМЕННО из ISOLATED-стороны (panel.ts), а не из MAIN
 *     (core.ts) — pricedb.io/sku.pricedb.io чужой домен относительно
 *     steamcommunity.com, а fetch из MAIN world выполняется как обычный
 *     запрос СТРАНИЦЫ и подчиняется её CORS; расширению с
 *     host_permissions на эти домены (см. wxt.config.ts) браузер разрешает
 *     кросс-доменный fetch именно из привилегированного контекста
 *     content-скрипта (ISOLATED world), в обход CORS-ответа сервера.
 *  3. Модуль пригодится не только trade-item-summary (режим 'priced'), но
 *     и будущему pricedb-check-button (utils/registry.ts, тот же
 *     провайдер цен) — поэтому вся логика вынесена сюда одним файлом, а не
 *     продублирована внутри modules/trade-item-summary (требование 4).
 *
 * Источник API-контракта — https://docs.pricedb.io/docs/pricedb и
 * https://docs.pricedb.io/docs/sku (живьём проверено WebFetch перед
 * реализацией, реальные примеры см. в комментариях ниже).
 */

const SKU_API_BASE = 'https://sku.pricedb.io/api/name/';
const PRICE_API_BASE = 'https://pricedb.io/api/item/';
/** Человеческая (не API) страница конкретного предмета на pricedb.io — то,
 *  на что открыто ссылается кнопка-проверка цены в panel.ts (пользователь
 *  явно попросил способ перепроверить, что цена подобрана к правильному
 *  предмету/эффекту). Подтверждено живым запросом (WebFetch): рабочая
 *  страница, показывает "Suggested Price" buy/sell в ref. */
const ITEM_PAGE_BASE = 'https://pricedb.io/item/';
/** Страница поиска — используется как фолбэк-ссылка для предметов, для
 *  которых МЫ не смогли зарезолвить SKU (см. PricedItem.sku === undefined
 *  ниже): пользователь по ссылке может поискать предмет на pricedb.io сам и
 *  увидеть, почему автопоиск не сработал (опечатка в имени, предмета правда
 *  нет в базе и т.п.) — тоже способ проверить, не тупик. */
const SEARCH_PAGE_BASE = 'https://pricedb.io/search?q=';

/** Таймаут одного сетевого запроса — чтобы зависший pricedb.io не подвесил
 *  панель навсегда; предмет просто останется "без цены" (см. panel.ts). */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Строит имя предмета в формате, который понимает GET
 * https://sku.pricedb.io/api/name/<имя> — для подавляющего большинства
 * предметов это ровно market_hash_name как его отдаёт Steam ("Strange
 * Professional Killstreak Backburner", "Australium Rocket Launcher" —
 * подтверждено примерами из документации и живыми запросами).
 *
 * ИСКЛЮЧЕНИЕ — Unusual: market_hash_name у Стима для Unusual-предметов НЕ
 * содержит названия эффекта (только "Unusual <предмет>"), а без эффекта
 * цена бессмысленна (у SKU-резолвера "Unusual Team Captain" резолвится в
 * effect:null — базовое "какой-то анусуал", не то, что реально в оффере).
 * Резолвер, наоборот, ожидает "<Effect Name> <Item Name>" БЕЗ слова
 * "Unusual" (подтверждено живым запросом: "Burning Flames Team Captain" ->
 * effect:13, sku "378;5;u13") — поэтому для предметов с найденным effect
 * (см. getItemAttributes) вырезаем "Unusual " и подставляем имя эффекта из
 * utils/unusual-effects.ts (тот же численный id, что кладём в бейдж на
 * иконке предмета, requirement 4 — не дублируем определение эффекта).
 *
 * market_hash_name предпочтён item.name намеренно — как и в
 * utils/currency.ts: name может быть переименован тег-нейм-тагом
 * пользователя и потерять связь с реальным предметом, market_hash_name
 * всегда каноническое имя Стима.
 */
export function buildPriceableName(item: SteamEconItem, attrs: ItemAttributes): string {
  const base = item.market_hash_name ?? item.name ?? '';
  if (attrs.effect !== undefined) {
    const effectName = getEffectName(attrs.effect);
    if (effectName) {
      const withoutUnusual = base.replace(/^Unusual\s+/, '');
      return `${effectName} ${withoutUnusual}`;
    }
  }
  return base;
}

interface SkuResolveResponse {
  success: boolean;
  data?: { sku?: string };
}

interface PriceApiResponse {
  sell?: { keys?: number; metal?: number };
}

export interface PricedbPrice {
  keys: number;
  metal: number;
}

export type PricedbLookupResult = { ok: true; sku: string; sell: PricedbPrice } | { ok: false };

// Кэш на время жизни вкладки/бандла ISOLATED content-скрипта — оба
// смонтированных экземпляра панели (своя и партнёра) используют один и тот
// же модульный кэш, т.к. оба живут в одном бандле
// (entrypoints/tradeoffer-summary.content.ts импортирует panel.ts дважды,
// но это один и тот же JS-модуль). Без TTL: цены не обновляются настолько
// быстро, чтобы имело смысл перезапрашивать в рамках одной открытой
// страницы оффера, а сброс кэша просто перезагрузкой вкладки — достаточно.
const skuCache = new Map<string, string | null>();
const priceCache = new Map<string, PricedbLookupResult>();

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Экспортирован наружу (не только для lookupPrice внутри этого файла) —
 * modules/pricedb-check-button и modules/market-pricedb-check-button нужен
 * ТОЛЬКО SKU для ссылки на страницу предмета (без реальной цены, которую
 * никак не показывают), поэтому им незачем делать второй сетевой запрос
 * (fetchPrice) ради значения, которое не используется — используют этот же
 * кэш, что и lookupPrice (требование 4).
 */
export async function resolveSku(name: string): Promise<string | null> {
  const cached = skuCache.get(name);
  if (cached !== undefined) return cached;

  const data = await fetchJson<SkuResolveResponse>(SKU_API_BASE + encodeURIComponent(name));
  const sku = data?.success && typeof data.data?.sku === 'string' ? data.data.sku : null;
  // Кэшируем и неудачу ("предмет не найден") — резолвер не найдёт его и в
  // следующий раз, пересчитывать смысла нет. Сетевые сбои НЕ кэшируем (see
  // fetchJson: сюда попадёт null и от 404, и от таймаута/офлайна одинаково —
  // разграничивать не критично, обе ситуации одинаково значат "нет цены
  // сейчас", а не "предмет точно непрайсабельный навсегда").
  skuCache.set(name, sku);
  return sku;
}

async function fetchPrice(sku: string): Promise<PricedbLookupResult> {
  const cached = priceCache.get(sku);
  if (cached) return cached;

  const data = await fetchJson<PriceApiResponse>(PRICE_API_BASE + encodeURIComponent(sku));
  const result: PricedbLookupResult =
    data && typeof data.sell?.metal === 'number' && typeof data.sell?.keys === 'number'
      ? { ok: true, sku, sell: { keys: data.sell.keys, metal: data.sell.metal } }
      : { ok: false };
  priceCache.set(sku, result);
  return result;
}

/** Имя -> цена продажи (sell — "во что оценивается предмет", то же, что
 *  игроки обычно имеют в виду под "сколько стоит"), с резолвом SKU внутри.
 *  Вызывать ТОЛЬКО из ISOLATED world — см. комментарий в шапке файла. */
export async function lookupPrice(name: string): Promise<PricedbLookupResult> {
  const sku = await resolveSku(name);
  if (!sku) return { ok: false };
  return fetchPrice(sku);
}

/** Ссылка на страницу конкретного SKU — открыть, чтобы глазами сверить
 *  название/эффект/цену на самом pricedb.io (см. ITEM_PAGE_BASE). */
export function pricedbItemUrl(sku: string): string {
  return ITEM_PAGE_BASE + encodeURIComponent(sku);
}

/** Ссылка на поиск по имени — фолбэк, когда SKU не зарезолвился (см. SEARCH_PAGE_BASE). */
export function pricedbSearchUrl(name: string): string {
  return SEARCH_PAGE_BASE + encodeURIComponent(name);
}

/** Один "вид" НЕ-валютного предмета оффера с результатом оценки — по одной
 *  записи на УНИКАЛЬНОЕ имя (см. priceOtherItems), а не по assetId: если в
 *  оффере 2 одинаковых предмета, это одна запись с amount:2, а не 2 строки. */
export interface PricedItem {
  name: string;
  amount: number;
  /** Цена ОДНОЙ штуки (для amount>1 — сумму даёт amount * sell). undefined,
   *  если предмет не оценён (SKU не резолвится или нет цены у PriceDB.io). */
  sell?: PricedbPrice;
  /** SKU — есть даже если сама цена не нашлась (резолвер мог найти предмет
   *  в схеме, а прайсер — не иметь по нему котировки); undefined — не
   *  зарезолвился вообще ничего похожего, тогда panel.ts ссылается на
   *  pricedbSearchUrl(name), а не pricedbItemUrl(sku). */
  sku?: string;
}

export interface PricedOtherItemsTotal {
  keys: number;
  metal: number;
  /** Сколько штук (амount) НЕ удалось оценить (SKU не резолвится / нет
   *  цены у PriceDB.io) — показывается отдельно, не теряется молча. */
  unpricedCount: number;
}

export interface PricedOtherItemsResult {
  /** По одной записи на уникальное имя — для панели: у каждого своя строка
   *  с кнопкой "проверить на PriceDB.io" (пользователь явно попросил
   *  способ перепроверить, что цена подобрана к правильному предмету —
   *  агрегированного одного числа для этого недостаточно). */
  items: PricedItem[];
  total: PricedOtherItemsTotal;
}

/**
 * Считает цену списка не-валютных предметов оффера (имя + сколько штук —
 * см. TradeSideSummary.otherItems в modules/trade-item-summary/types.ts) —
 * и по каждому уникальному имени отдельно (для панели), и суммарно (для
 * краткого итога). Запросы по уникальным именам идут параллельно
 * (Promise.all) — типичный оффер это единицы уникальных предметов, даже с
 * учётом кэша это дёшево и укладывается в лимит PriceDB.io (360
 * запросов/мин/IP, см. документацию).
 */
export async function priceOtherItems(items: { name: string; amount: number }[]): Promise<PricedOtherItemsResult> {
  const uniqueNames = [...new Set(items.map((i) => i.name))];
  const results = await Promise.all(uniqueNames.map((name) => lookupPrice(name)));
  const byName = new Map(uniqueNames.map((name, i) => [name, results[i]]));

  let keys = 0;
  let metal = 0;
  let unpricedCount = 0;
  const pricedItems: PricedItem[] = [];

  for (const item of items) {
    const result = byName.get(item.name);
    if (result?.ok) {
      keys += result.sell.keys * item.amount;
      metal += result.sell.metal * item.amount;
      pricedItems.push({ name: item.name, amount: item.amount, sell: result.sell, sku: result.sku });
    } else {
      unpricedCount += item.amount;
      pricedItems.push({ name: item.name, amount: item.amount });
    }
  }

  return { items: pricedItems, total: { keys, metal, unpricedCount } };
}
